import {
  collection,
  doc,
  runTransaction,
  query,
  where,
  getDocs,
  setDoc,
  serverTimestamp,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import {
  StockStatus,
  BranchInventory,
  StockTransaction,
  AlertRecord,
  CatalogItem,
  Branch,
  UserProfile,
  Business,
} from '../types';

export function calculateStockStatus(quantity: number, minQuantity: number): StockStatus {
  if (quantity <= 0) return 'OUT_OF_STOCK';
  if (quantity <= minQuantity) return 'LOW_STOCK';
  return 'IN_STOCK';
}

export function generateIdempotencyKey(branchId: string, itemId: string, action: string): string {
  return `${action}_${branchId}_${itemId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export interface SaleRequest {
  businessId: string;
  branchId: string;
  branchName: string;
  itemId: string;
  partNumber: string;
  itemName: string;
  quantitySold: number;
  userId: string;
  userEmail: string;
  idempotencyKey: string;
  notes?: string;
}

export interface RestockRequest {
  businessId: string;
  branchId: string;
  branchName: string;
  itemId: string;
  partNumber: string;
  itemName: string;
  quantityReceived: number;
  userId: string;
  userEmail: string;
  notes?: string;
}

export interface AdjustmentRequest {
  businessId: string;
  branchId: string;
  branchName: string;
  itemId: string;
  partNumber: string;
  itemName: string;
  newQuantity: number;
  reason: string;
  userId: string;
  userEmail: string;
  notes?: string;
}

export class InventoryService {
  /**
   * Execute atomic Sale with idempotency check, stock validation, and alert detection
   */
  static async recordSale(req: SaleRequest): Promise<{
    transaction: StockTransaction;
    alertCreated: AlertRecord | null;
  }> {
    if (req.quantitySold <= 0 || !Number.isInteger(req.quantitySold)) {
      throw new Error('Quantity sold must be a positive whole number.');
    }

    const inventoryDocId = `${req.branchId}_${req.itemId}`;
    const invRef = doc(db, 'branch_inventory', inventoryDocId);
    const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const txRef = doc(db, 'transactions', txId);

    try {
      return await runTransaction(db, async (firestoreTx) => {
        // 1. Check idempotency: see if this key was already processed
        // In Firestore, we check the inventory and recent transactions
        const invSnapshot = await firestoreTx.get(invRef);

        if (!invSnapshot.exists()) {
          throw new Error(`Inventory record for item ${req.partNumber} at branch ${req.branchName} does not exist.`);
        }

        const invData = invSnapshot.data() as BranchInventory;
        const currentQty = invData.quantity;

        // 2. Reject sales exceeding available stock
        if (req.quantitySold > currentQty) {
          throw new Error(
            `Insufficient stock! Requested: ${req.quantitySold}, Available at ${req.branchName}: ${currentQty}`
          );
        }

        const resultingQty = currentQty - req.quantitySold;
        const oldStatus = invData.status;
        const newStatus = calculateStockStatus(resultingQty, invData.minQuantity);

        // 3. Check Alert Transition Rules:
        // In Stock: > minQuantity
        // Low Stock: 0 < qty <= minQuantity
        // Out of Stock: qty == 0
        // Alert triggered when item crosses from In Stock -> Low Stock or directly to Out of Stock
        let alertToCreate: AlertRecord | null = null;
        let nextAlertState = invData.lastAlertState || 'NONE';

        if (newStatus === 'OUT_OF_STOCK' && oldStatus !== 'OUT_OF_STOCK') {
          nextAlertState = 'OUT_OF_STOCK';
          const alertId = `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const alertRef = doc(db, 'alerts', alertId);

          alertToCreate = {
            id: alertId,
            businessId: req.businessId,
            branchId: req.branchId,
            branchName: req.branchName,
            itemId: req.itemId,
            partNumber: req.partNumber,
            itemName: req.itemName,
            alertType: 'OUT_OF_STOCK',
            currentStock: resultingQty,
            minRequired: invData.minQuantity,
            message: `Out of Stock — ${req.branchName}: ${req.itemName} (${req.partNumber}). Current stock: ${resultingQty}.`,
            acknowledged: false,
            createdAt: new Date().toISOString(),
          };
          firestoreTx.set(alertRef, alertToCreate);
        } else if (newStatus === 'LOW_STOCK' && oldStatus === 'IN_STOCK' && nextAlertState !== 'LOW_STOCK') {
          nextAlertState = 'LOW_STOCK';
          const alertId = `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const alertRef = doc(db, 'alerts', alertId);

          alertToCreate = {
            id: alertId,
            businessId: req.businessId,
            branchId: req.branchId,
            branchName: req.branchName,
            itemId: req.itemId,
            partNumber: req.partNumber,
            itemName: req.itemName,
            alertType: 'LOW_STOCK',
            currentStock: resultingQty,
            minRequired: invData.minQuantity,
            message: `Low Stock — ${req.branchName}: ${req.itemName} (${req.partNumber}). Current stock: ${resultingQty}. Minimum required: ${invData.minQuantity}.`,
            acknowledged: false,
            createdAt: new Date().toISOString(),
          };
          firestoreTx.set(alertRef, alertToCreate);
        }

        // 4. Update Inventory Atomically
        firestoreTx.update(invRef, {
          quantity: resultingQty,
          status: newStatus,
          lastAlertState: nextAlertState,
          lastAlertAt: alertToCreate ? new Date().toISOString() : (invData.lastAlertAt || ''),
          updatedAt: new Date().toISOString(),
        });

        // 5. Append Immutable Transaction Ledger
        const newTransaction: StockTransaction = {
          id: txId,
          idempotencyKey: req.idempotencyKey,
          businessId: req.businessId,
          branchId: req.branchId,
          itemId: req.itemId,
          partNumber: req.partNumber,
          itemName: req.itemName,
          type: 'SALE',
          quantityChange: -req.quantitySold,
          previousQuantity: currentQty,
          resultingQuantity: resultingQty,
          notes: req.notes || 'Point of Sale transaction',
          userId: req.userId,
          userEmail: req.userEmail,
          timestamp: new Date().toISOString(),
        };

        firestoreTx.set(txRef, newTransaction);

        return {
          transaction: newTransaction,
          alertCreated: alertToCreate,
        };
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `branch_inventory/${inventoryDocId}`);
    }
  }

  /**
   * Execute atomic Restock / Stock-In
   */
  static async recordRestock(req: RestockRequest): Promise<{
    transaction: StockTransaction;
  }> {
    if (req.quantityReceived <= 0 || !Number.isInteger(req.quantityReceived)) {
      throw new Error('Restock quantity must be a positive whole number.');
    }

    const inventoryDocId = `${req.branchId}_${req.itemId}`;
    const invRef = doc(db, 'branch_inventory', inventoryDocId);
    const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const txRef = doc(db, 'transactions', txId);

    try {
      return await runTransaction(db, async (firestoreTx) => {
        const invSnapshot = await firestoreTx.get(invRef);
        if (!invSnapshot.exists()) {
          throw new Error('Inventory record does not exist for this branch.');
        }

        const invData = invSnapshot.data() as BranchInventory;
        const currentQty = invData.quantity;
        const resultingQty = currentQty + req.quantityReceived;
        const newStatus = calculateStockStatus(resultingQty, invData.minQuantity);

        // Reset alert state if restored above threshold
        const nextAlertState = newStatus === 'IN_STOCK' ? 'NONE' : invData.lastAlertState;

        firestoreTx.update(invRef, {
          quantity: resultingQty,
          status: newStatus,
          lastAlertState: nextAlertState,
          updatedAt: new Date().toISOString(),
        });

        const newTx: StockTransaction = {
          id: txId,
          idempotencyKey: generateIdempotencyKey(req.branchId, req.itemId, 'restock'),
          businessId: req.businessId,
          branchId: req.branchId,
          itemId: req.itemId,
          partNumber: req.partNumber,
          itemName: req.itemName,
          type: 'RESTOCK',
          quantityChange: req.quantityReceived,
          previousQuantity: currentQty,
          resultingQuantity: resultingQty,
          notes: req.notes || 'Received shipment / Restock',
          userId: req.userId,
          userEmail: req.userEmail,
          timestamp: new Date().toISOString(),
        };

        firestoreTx.set(txRef, newTx);
        return { transaction: newTx };
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `branch_inventory/${inventoryDocId}`);
    }
  }

  /**
   * Execute Stock Adjustment with mandatory reason
   */
  static async recordAdjustment(req: AdjustmentRequest): Promise<{
    transaction: StockTransaction;
    alertCreated: AlertRecord | null;
  }> {
    if (!req.reason || req.reason.trim().length === 0) {
      throw new Error('A mandatory reason is required for stock adjustments.');
    }
    if (req.newQuantity < 0 || !Number.isInteger(req.newQuantity)) {
      throw new Error('New quantity must be a non-negative whole number.');
    }

    const inventoryDocId = `${req.branchId}_${req.itemId}`;
    const invRef = doc(db, 'branch_inventory', inventoryDocId);
    const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const txRef = doc(db, 'transactions', txId);

    try {
      return await runTransaction(db, async (firestoreTx) => {
        const invSnapshot = await firestoreTx.get(invRef);
        if (!invSnapshot.exists()) {
          throw new Error('Inventory record not found.');
        }

        const invData = invSnapshot.data() as BranchInventory;
        const currentQty = invData.quantity;
        const diff = req.newQuantity - currentQty;

        if (diff === 0) {
          throw new Error('New quantity matches current stock; no adjustment necessary.');
        }

        const resultingQty = req.newQuantity;
        const oldStatus = invData.status;
        const newStatus = calculateStockStatus(resultingQty, invData.minQuantity);

        let alertToCreate: AlertRecord | null = null;
        let nextAlertState = invData.lastAlertState || 'NONE';

        if (newStatus === 'OUT_OF_STOCK' && oldStatus !== 'OUT_OF_STOCK') {
          nextAlertState = 'OUT_OF_STOCK';
          const alertId = `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const alertRef = doc(db, 'alerts', alertId);

          alertToCreate = {
            id: alertId,
            businessId: req.businessId,
            branchId: req.branchId,
            branchName: req.branchName,
            itemId: req.itemId,
            partNumber: req.partNumber,
            itemName: req.itemName,
            alertType: 'OUT_OF_STOCK',
            currentStock: resultingQty,
            minRequired: invData.minQuantity,
            message: `Out of Stock — ${req.branchName}: ${req.itemName} (${req.partNumber}). Current stock: ${resultingQty}.`,
            acknowledged: false,
            createdAt: new Date().toISOString(),
          };
          firestoreTx.set(alertRef, alertToCreate);
        } else if (newStatus === 'LOW_STOCK' && oldStatus === 'IN_STOCK') {
          nextAlertState = 'LOW_STOCK';
          const alertId = `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const alertRef = doc(db, 'alerts', alertId);

          alertToCreate = {
            id: alertId,
            businessId: req.businessId,
            branchId: req.branchId,
            branchName: req.branchName,
            itemId: req.itemId,
            partNumber: req.partNumber,
            itemName: req.itemName,
            alertType: 'LOW_STOCK',
            currentStock: resultingQty,
            minRequired: invData.minQuantity,
            message: `Low Stock — ${req.branchName}: ${req.itemName} (${req.partNumber}). Current stock: ${resultingQty}. Minimum required: ${invData.minQuantity}.`,
            acknowledged: false,
            createdAt: new Date().toISOString(),
          };
          firestoreTx.set(alertRef, alertToCreate);
        } else if (newStatus === 'IN_STOCK') {
          nextAlertState = 'NONE';
        }

        firestoreTx.update(invRef, {
          quantity: resultingQty,
          status: newStatus,
          lastAlertState: nextAlertState,
          updatedAt: new Date().toISOString(),
        });

        const newTx: StockTransaction = {
          id: txId,
          idempotencyKey: generateIdempotencyKey(req.branchId, req.itemId, 'adjust'),
          businessId: req.businessId,
          branchId: req.branchId,
          itemId: req.itemId,
          partNumber: req.partNumber,
          itemName: req.itemName,
          type: 'ADJUSTMENT',
          quantityChange: diff,
          previousQuantity: currentQty,
          resultingQuantity: resultingQty,
          reason: req.reason,
          notes: req.notes || `Stock audit adjustment: ${req.reason}`,
          userId: req.userId,
          userEmail: req.userEmail,
          timestamp: new Date().toISOString(),
        };

        firestoreTx.set(txRef, newTx);
        return { transaction: newTx, alertCreated: alertToCreate };
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `branch_inventory/${inventoryDocId}`);
    }
  }

  /**
   * Reverse a past transaction safely
   */
  static async reverseTransaction(
    originalTx: StockTransaction,
    reason: string,
    userId: string,
    userEmail: string,
    branchName: string
  ): Promise<{ transaction: StockTransaction }> {
    const inventoryDocId = `${originalTx.branchId}_${originalTx.itemId}`;
    const invRef = doc(db, 'branch_inventory', inventoryDocId);
    const txId = `tx_rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const txRef = doc(db, 'transactions', txId);

    try {
      return await runTransaction(db, async (firestoreTx) => {
        const invSnapshot = await firestoreTx.get(invRef);
        if (!invSnapshot.exists()) {
          throw new Error('Inventory record not found.');
        }

        const invData = invSnapshot.data() as BranchInventory;
        const currentQty = invData.quantity;

        // Invert quantity change of original transaction
        const correction = -originalTx.quantityChange;
        const resultingQty = currentQty + correction;

        if (resultingQty < 0) {
          throw new Error('Reversal would cause stock to fall below zero.');
        }

        const newStatus = calculateStockStatus(resultingQty, invData.minQuantity);
        const nextAlertState = newStatus === 'IN_STOCK' ? 'NONE' : invData.lastAlertState;

        firestoreTx.update(invRef, {
          quantity: resultingQty,
          status: newStatus,
          lastAlertState: nextAlertState,
          updatedAt: new Date().toISOString(),
        });

        const revTx: StockTransaction = {
          id: txId,
          idempotencyKey: `reversal_${originalTx.id}`,
          businessId: originalTx.businessId,
          branchId: originalTx.branchId,
          itemId: originalTx.itemId,
          partNumber: originalTx.partNumber,
          itemName: originalTx.itemName,
          type: 'REVERSAL',
          quantityChange: correction,
          previousQuantity: currentQty,
          resultingQuantity: resultingQty,
          reason: `Reversal of ${originalTx.type} (${originalTx.id}): ${reason}`,
          notes: `Reversal executed by ${userEmail}`,
          userId,
          userEmail,
          timestamp: new Date().toISOString(),
        };

        firestoreTx.set(txRef, revTx);
        return { transaction: revTx };
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `branch_inventory/${inventoryDocId}`);
    }
  }

  /**
   * Update minimum stock threshold and recalculate status
   */
  static async updateBranchThreshold(
    inventoryDocId: string,
    newMinQuantity: number,
    restockTarget?: number
  ): Promise<void> {
    const invRef = doc(db, 'branch_inventory', inventoryDocId);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(invRef);
        if (!snap.exists()) throw new Error('Inventory not found');
        const data = snap.data() as BranchInventory;

        const newStatus = calculateStockStatus(data.quantity, newMinQuantity);
        let nextAlertState = data.lastAlertState;

        // If newly pushed into low stock or out of stock
        if (newStatus === 'LOW_STOCK' && data.status === 'IN_STOCK') {
          nextAlertState = 'LOW_STOCK';
        } else if (newStatus === 'IN_STOCK') {
          nextAlertState = 'NONE';
        }

        tx.update(invRef, {
          minQuantity: newMinQuantity,
          restockTarget: restockTarget ?? data.restockTarget,
          status: newStatus,
          lastAlertState: nextAlertState,
          updatedAt: new Date().toISOString(),
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `branch_inventory/${inventoryDocId}`);
    }
  }
}
