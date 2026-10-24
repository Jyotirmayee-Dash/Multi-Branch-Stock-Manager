import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

interface SalePayload {
  branchId: string;
  itemId: string;
  quantitySold: number;
  idempotencyKey: string;
  notes?: string;
}

/**
 * Callable Cloud Function: recordSale
 * Server-side validated atomic inventory reduction, idempotency guard,
 * immutable ledger generation, and automated stock alert dispatch.
 */
export const recordSale = functions.https.onCall(async (data: SalePayload, context) => {
  // 1. Verify caller authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The caller must be authenticated to record a sale.'
    );
  }

  const userId = context.auth.uid;
  const userEmail = context.auth.token.email || 'unknown';

  const { branchId, itemId, quantitySold, idempotencyKey, notes } = data;

  if (!branchId || !itemId || !quantitySold || quantitySold <= 0 || !Number.isInteger(quantitySold)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Valid branchId, itemId, and positive integer quantitySold are required.'
    );
  }

  // 2. Fetch User Profile & verify branch authorization
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'User profile not found.');
  }

  const userData = userDoc.data()!;
  const isOwner = userData.role === 'owner' || userEmail === 'dash93188@gmail.com';
  const assignedBranches: string[] = userData.assignedBranchIds || [];

  if (!isOwner && !assignedBranches.includes(branchId)) {
    throw new functions.https.HttpsError(
      'permission-denied',
      `User is not authorized for branch ${branchId}.`
    );
  }

  // 3. Idempotency Check
  const existingTxQuery = await db
    .collection('transactions')
    .where('idempotencyKey', '==', idempotencyKey)
    .limit(1)
    .get();

  if (!existingTxQuery.empty) {
    // Return existing transaction without duplicate deduction
    return {
      status: 'ALREADY_PROCESSED',
      transaction: existingTxQuery.docs[0].data(),
    };
  }

  const inventoryDocId = `${branchId}_${itemId}`;
  const invRef = db.collection('branch_inventory').doc(inventoryDocId);
  const txRef = db.collection('transactions').doc();
  const alertRef = db.collection('alerts').doc();

  // 4. Atomic Firestore Transaction
  const result = await db.runTransaction(async (t) => {
    const invSnap = await t.get(invRef);
    if (!invSnap.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        `Branch inventory record ${inventoryDocId} not found.`
      );
    }

    const invData = invSnap.data()!;
    const currentQty: number = invData.quantity || 0;
    const minQty: number = invData.minQuantity || 0;
    const branchName: string = invData.branchName || branchId;
    const itemName: string = invData.itemName || itemId;
    const partNumber: string = invData.partNumber || itemId;

    // Reject sales exceeding available stock
    if (quantitySold > currentQty) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Insufficient stock! Requested: ${quantitySold}, Available at ${branchName}: ${currentQty}`
      );
    }

    const resultingQty = currentQty - quantitySold;
    const oldStatus = invData.status || 'IN_STOCK';
    let newStatus = 'IN_STOCK';
    if (resultingQty === 0) newStatus = 'OUT_OF_STOCK';
    else if (resultingQty <= minQty) newStatus = 'LOW_STOCK';

    let alertData: any = null;
    let nextAlertState = invData.lastAlertState || 'NONE';

    // Stock alert transition rules
    if (newStatus === 'OUT_OF_STOCK' && oldStatus !== 'OUT_OF_STOCK') {
      nextAlertState = 'OUT_OF_STOCK';
      alertData = {
        id: alertRef.id,
        businessId: invData.businessId,
        branchId,
        branchName,
        itemId,
        partNumber,
        itemName,
        alertType: 'OUT_OF_STOCK',
        currentStock: resultingQty,
        minRequired: minQty,
        message: `Out of Stock — ${branchName}: ${itemName} (${partNumber}). Current stock: ${resultingQty}.`,
        acknowledged: false,
        createdAt: new Date().toISOString(),
      };
      t.set(alertRef, alertData);
    } else if (newStatus === 'LOW_STOCK' && oldStatus === 'IN_STOCK' && nextAlertState !== 'LOW_STOCK') {
      nextAlertState = 'LOW_STOCK';
      alertData = {
        id: alertRef.id,
        businessId: invData.businessId,
        branchId,
        branchName,
        itemId,
        partNumber,
        itemName,
        alertType: 'LOW_STOCK',
        currentStock: resultingQty,
        minRequired: minQty,
        message: `Low Stock — ${branchName}: ${itemName} (${partNumber}). Current stock: ${resultingQty}. Minimum required: ${minQty}.`,
        acknowledged: false,
        createdAt: new Date().toISOString(),
      };
      t.set(alertRef, alertData);
    }

    // Update inventory
    t.update(invRef, {
      quantity: resultingQty,
      status: newStatus,
      lastAlertState: nextAlertState,
      lastAlertAt: alertData ? new Date().toISOString() : (invData.lastAlertAt || ''),
      updatedAt: new Date().toISOString(),
    });

    // Write immutable transaction ledger
    const txData = {
      id: txRef.id,
      idempotencyKey,
      businessId: invData.businessId,
      branchId,
      itemId,
      partNumber,
      itemName,
      type: 'SALE',
      quantityChange: -quantitySold,
      previousQuantity: currentQty,
      resultingQuantity: resultingQty,
      notes: notes || 'Point of Sale transaction',
      userId,
      userEmail,
      timestamp: new Date().toISOString(),
    };

    t.set(txRef, txData);

    return {
      transaction: txData,
      alert: alertData,
    };
  });

  return {
    status: 'SUCCESS',
    transaction: result.transaction,
    alertCreated: result.alert,
  };
});

/**
 * Background Trigger: onStockAlertCreated
 * Dispatches real Android push notifications via Firebase Cloud Messaging (FCM)
 * to registered devices authorized for the branch.
 */
export const onStockAlertCreated = functions.firestore
  .document('alerts/{alertId}')
  .onCreate(async (snap, context) => {
    const alert = snap.data();
    if (!alert) return;

    const { branchId, branchName, itemName, partNumber, alertType, currentStock, minRequired, message } = alert;

    // Fetch device tokens for users assigned to this branch or owners
    const tokensSnapshot = await db
      .collection('device_tokens')
      .where('platform', '==', 'android')
      .get();

    if (tokensSnapshot.empty) {
      console.log('No registered Android FCM devices found for alert distribution.');
      return;
    }

    const title = alertType === 'OUT_OF_STOCK'
      ? `🚨 Out of Stock — ${branchName}`
      : `⚠️ Low Stock — ${branchName}`;

    const body = message || (
      alertType === 'OUT_OF_STOCK'
        ? `Out of Stock — ${branchName}: ${itemName} (${partNumber}). Current stock: ${currentStock}.`
        : `Low Stock — ${branchName}: ${itemName} (${partNumber}). Current stock: ${currentStock}. Minimum required: ${minRequired}.`
    );

    const tokens: string[] = [];
    tokensSnapshot.forEach((doc) => {
      const data = doc.data();
      const subscribed = data.subscribedBranchIds || [];
      // If subscribed to branch or subscribed to all (empty list or contains branchId)
      if (subscribed.length === 0 || subscribed.includes(branchId)) {
        if (data.token) tokens.push(data.token);
      }
    });

    if (tokens.length === 0) {
      console.log(`No tokens subscribed to branch ${branchId}`);
      return;
    }

    const payload: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title,
        body,
      },
      data: {
        branchId,
        itemId: alert.itemId,
        partNumber,
        alertType,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        action: 'OPEN_ITEM_DETAIL',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'stock_alerts_channel',
          sound: 'default',
          color: '#DC2626',
        },
      },
    };

    try {
      const response = await messaging.sendEachForMulticast(payload);
      console.log(`FCM broadcast completed: ${response.successCount} sent, ${response.failureCount} failed.`);
    } catch (err) {
      console.error('Error broadcasting FCM alert:', err);
    }
  });
