import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { db, auth, testFirestoreConnection } from './firebase/config';
import { handleFirestoreError, OperationType } from './firebase/errorHandler';
import {
  Branch,
  CatalogItem,
  BranchInventory,
  StockTransaction,
  AlertRecord,
  UserProfile,
  UserRole,
  SimulatedPushNotification,
} from './types';
import { seedInitialDatabaseIfNeeded, DEFAULT_BUSINESS_ID } from './services/seedData';
import { exportInventoryToCSV, exportTransactionsToCSV } from './utils/csvExport';

import { Header } from './components/Header';
import { AndroidFrame } from './components/AndroidFrame';
import { NotificationToast } from './components/NotificationToast';
import { DashboardView } from './components/DashboardView';
import { InventoryView } from './components/InventoryView';
import { AlertsView } from './components/AlertsView';
import { TransactionsView } from './components/TransactionsView';
import { BranchManagementView } from './components/BranchManagementView';
import { AndroidCodeExplorer } from './components/AndroidCodeExplorer';
import { RecordSaleModal } from './components/RecordSaleModal';
import { RestockModal } from './components/RestockModal';
import { AdjustmentModal } from './components/AdjustmentModal';
import { SignInScreen } from './components/SignInScreen';

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [inventoryMap, setInventoryMap] = useState<Record<string, BranchInventory>>({});
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);

  const [selectedBranchId, setSelectedBranchId] = useState<string>('branch_central');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isPhoneMode, setIsPhoneMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeNotification, setActiveNotification] = useState<SimulatedPushNotification | null>(null);

  // Modals state
  const [isSaleModalOpen, setIsSaleModalOpen] = useState<boolean>(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState<boolean>(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState<boolean>(false);
  const [modalTargetItemId, setModalTargetItemId] = useState<string | undefined>(undefined);

  // Active current user profile
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    id: 'user_dash93188',
    businessId: DEFAULT_BUSINESS_ID,
    email: 'dash93188@gmail.com',
    displayName: 'Business Owner',
    role: 'owner',
    assignedBranchIds: ['branch_central', 'branch_downtown', 'branch_westside'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 1. Auth state observer: Only proceed when authenticated!
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
      if (user) {
        const isOwner = user.email === 'dash93188@gmail.com';
        setCurrentUser({
          id: user.uid,
          businessId: DEFAULT_BUSINESS_ID,
          email: user.email || 'user@apexauto.com',
          displayName: user.displayName || user.email?.split('@')[0] || 'Authorized User',
          role: isOwner ? 'owner' : 'staff',
          assignedBranchIds: ['branch_central', 'branch_downtown', 'branch_westside'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });

    return () => unsubAuth();
  }, []);

  // 2. Real-time Firestore snapshot listeners — ONLY when authUser is valid!
  useEffect(() => {
    if (!authUser) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let isMounted = true;

    async function bootstrap() {
      try {
        await testFirestoreConnection();
        await seedInitialDatabaseIfNeeded(authUser!.uid, authUser!.email || 'dash93188@gmail.com');
      } catch (err) {
        console.warn('Initial seeding check:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    bootstrap();

    const unsubBranches = onSnapshot(
      collection(db, 'branches'),
      (snap) => {
        const list: Branch[] = [];
        snap.forEach((d) => list.push(d.data() as Branch));
        if (list.length > 0) setBranches(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'branches')
    );

    const unsubItems = onSnapshot(
      collection(db, 'items'),
      (snap) => {
        const list: CatalogItem[] = [];
        snap.forEach((d) => list.push(d.data() as CatalogItem));
        setItems(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'items')
    );

    const unsubInventory = onSnapshot(
      collection(db, 'branch_inventory'),
      (snap) => {
        const map: Record<string, BranchInventory> = {};
        snap.forEach((d) => {
          const inv = d.data() as BranchInventory;
          map[`${inv.branchId}_${inv.itemId}`] = inv;
        });
        setInventoryMap(map);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'branch_inventory')
    );

    const unsubTransactions = onSnapshot(
      query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(100)),
      (snap) => {
        const list: StockTransaction[] = [];
        snap.forEach((d) => list.push(d.data() as StockTransaction));
        setTransactions(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
    );

    const unsubAlerts = onSnapshot(
      query(collection(db, 'alerts'), orderBy('createdAt', 'desc'), limit(50)),
      (snap) => {
        const list: AlertRecord[] = [];
        snap.forEach((d) => list.push(d.data() as AlertRecord));
        setAlerts(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'alerts')
    );

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const list: UserProfile[] = [];
        snap.forEach((d) => list.push(d.data() as UserProfile));
        setUsers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    return () => {
      isMounted = false;
      unsubBranches();
      unsubItems();
      unsubInventory();
      unsubTransactions();
      unsubAlerts();
      unsubUsers();
    };
  }, [authUser]);

  // Update selected branch if default isn't present yet
  useEffect(() => {
    if (branches.length > 0 && selectedBranchId !== 'all') {
      const exists = branches.some((b) => b.id === selectedBranchId);
      if (!exists) setSelectedBranchId(branches[0].id);
    }
  }, [branches, selectedBranchId]);

  // Handle role switching for permission testing
  const handleChangeRole = (role: UserRole) => {
    setCurrentUser((prev) => ({
      ...prev,
      role,
      displayName: role === 'owner' ? 'Business Owner' : role === 'manager' ? 'Branch Manager' : 'Sales Staff',
      assignedBranchIds:
        role === 'owner'
          ? branches.map((b) => b.id)
          : role === 'manager'
          ? ['branch_central', 'branch_downtown']
          : ['branch_central'],
    }));
  };

  // Re-seed sample data
  const handleReseedData = async () => {
    if (!authUser) return;
    if (confirm('Reset database to default sample automotive multi-branch inventory?')) {
      setIsLoading(true);
      await seedInitialDatabaseIfNeeded(authUser.uid, authUser.email || 'dash93188@gmail.com');
      setIsLoading(false);
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setBranches([]);
      setItems([]);
      setInventoryMap({});
      setTransactions([]);
      setAlerts([]);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Trigger test FCM push notification
  const handleTriggerTestPushNotification = (branchId: string, alertType: 'LOW_STOCK' | 'OUT_OF_STOCK') => {
    const branch = branches.find((b) => b.id === branchId) || branches[0];
    const sampleItem = items[0] || { name: 'Brake Shoe Set', partNumber: 'BS-2041', id: 'item_bs2041' };
    const stock = alertType === 'OUT_OF_STOCK' ? 0 : 4;
    const min = 8;

    const notif: SimulatedPushNotification = {
      id: `push_${Date.now()}`,
      title: alertType === 'OUT_OF_STOCK' ? `🚨 Out of Stock — ${branch?.name || branchId}` : `⚠️ Low Stock — ${branch?.name || branchId}`,
      body:
        alertType === 'OUT_OF_STOCK'
          ? `Out of Stock — ${branch?.name || branchId}: ${sampleItem.name} (${sampleItem.partNumber}). Current stock: ${stock}.`
          : `Low Stock — ${branch?.name || branchId}: ${sampleItem.name} (${sampleItem.partNumber}). Current stock: ${stock}. Minimum required: ${min}.`,
      timestamp: new Date().toISOString(),
      branchId: branch?.id || branchId,
      itemId: sampleItem.id,
      type: alertType,
    };

    setActiveNotification(notif);
  };

  const handleSaleSuccess = (message: string, alertCreated: AlertRecord | null) => {
    if (alertCreated) {
      setActiveNotification({
        id: `push_${Date.now()}`,
        title:
          alertCreated.alertType === 'OUT_OF_STOCK'
            ? `🚨 Out of Stock — ${alertCreated.branchName}`
            : `⚠️ Low Stock — ${alertCreated.branchName}`,
        body: alertCreated.message,
        timestamp: new Date().toISOString(),
        branchId: alertCreated.branchId,
        itemId: alertCreated.itemId,
        type: alertCreated.alertType,
      });
    }
  };

  const unreadAlertCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-teal-500 selection:text-black">
      {/* Real-time Android FCM Push Notification Toast */}
      <NotificationToast
        notification={activeNotification}
        onDismiss={() => setActiveNotification(null)}
        onActionClick={(branchId, itemId) => {
          setSelectedBranchId(branchId);
          setActiveTab('inventory');
        }}
      />

      <AndroidFrame
        isPhoneMode={isPhoneMode}
        onToggleMode={() => setIsPhoneMode(!isPhoneMode)}
      >
        {authLoading ? (
          <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
            <div className="w-10 h-10 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
            <p className="text-xs text-slate-400 font-medium">Authenticating session...</p>
          </div>
        ) : !authUser ? (
          <SignInScreen onSignedIn={() => {}} />
        ) : (
          <>
            {/* Navigation & Header */}
            <Header
              branches={branches}
              selectedBranchId={selectedBranchId}
              onSelectBranch={setSelectedBranchId}
              currentUser={currentUser}
              onChangeRole={handleChangeRole}
              alertCount={unreadAlertCount}
              isPhoneMode={isPhoneMode}
              onTogglePhoneMode={() => setIsPhoneMode(!isPhoneMode)}
              onOpenSaleModal={() => setIsSaleModalOpen(true)}
              onReseedData={handleReseedData}
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              onSignOut={handleSignOut}
            />

            {/* Main Content Body */}
            <main className="p-4 sm:p-6 flex-1 max-w-7xl mx-auto w-full">
              {isLoading ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-3">
                  <div className="w-10 h-10 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
                  <p className="text-xs text-slate-400 font-medium">
                    Connecting to Cloud Firestore & syncing multi-branch ledger...
                  </p>
                </div>
              ) : (
                <>
                  {activeTab === 'dashboard' && (
                    <DashboardView
                      branches={branches}
                      selectedBranchId={selectedBranchId}
                      items={items}
                      inventoryMap={inventoryMap}
                      transactions={transactions}
                      currentUser={currentUser}
                      onOpenSaleModal={() => setIsSaleModalOpen(true)}
                      onOpenRestockModal={(itemId) => {
                        setModalTargetItemId(itemId);
                        setIsRestockModalOpen(true);
                      }}
                      onOpenAdjustmentModal={(itemId) => {
                        setModalTargetItemId(itemId);
                        setIsAdjustmentModalOpen(true);
                      }}
                      onNavigateToTab={setActiveTab}
                      onExportCSV={() =>
                        exportInventoryToCSV(
                          Object.values(inventoryMap),
                          branches,
                          branches.find((b) => b.id === selectedBranchId)?.name || 'All Branches'
                        )
                      }
                    />
                  )}

                  {activeTab === 'inventory' && (
                    <InventoryView
                      branches={branches}
                      selectedBranchId={selectedBranchId}
                      items={items}
                      inventoryMap={inventoryMap}
                      currentUser={currentUser}
                      onOpenSaleModal={() => setIsSaleModalOpen(true)}
                      onOpenRestockModal={(itemId) => {
                        setModalTargetItemId(itemId);
                        setIsRestockModalOpen(true);
                      }}
                      onOpenAdjustmentModal={(itemId) => {
                        setModalTargetItemId(itemId);
                        setIsAdjustmentModalOpen(true);
                      }}
                      onExportCSV={() =>
                        exportInventoryToCSV(
                          Object.values(inventoryMap),
                          branches,
                          branches.find((b) => b.id === selectedBranchId)?.name || 'All Branches'
                        )
                      }
                    />
                  )}

                  {activeTab === 'alerts' && (
                    <AlertsView
                      alerts={alerts}
                      branches={branches}
                      selectedBranchId={selectedBranchId}
                      inventoryMap={inventoryMap}
                      currentUser={currentUser}
                      onOpenRestockModal={(itemId) => {
                        setModalTargetItemId(itemId);
                        setIsRestockModalOpen(true);
                      }}
                      onTriggerTestPushNotification={handleTriggerTestPushNotification}
                    />
                  )}

                  {activeTab === 'transactions' && (
                    <TransactionsView
                      transactions={transactions}
                      branches={branches}
                      selectedBranchId={selectedBranchId}
                      currentUser={currentUser}
                      onExportCSV={() => exportTransactionsToCSV(transactions, branches)}
                      onTransactionReversed={(msg) => alert(msg)}
                    />
                  )}

                  {activeTab === 'branches' && (
                    <BranchManagementView
                      branches={branches}
                      users={users}
                      currentUser={currentUser}
                      onRefreshData={() => {}}
                    />
                  )}

                  {activeTab === 'code' && <AndroidCodeExplorer />}
                </>
              )}
            </main>
          </>
        )}
      </AndroidFrame>

      {/* Record Sale Modal */}
      {isSaleModalOpen && (
        <RecordSaleModal
          isOpen={isSaleModalOpen}
          onClose={() => setIsSaleModalOpen(false)}
          branches={branches}
          selectedBranchId={selectedBranchId}
          items={items}
          inventoryMap={inventoryMap}
          currentUser={currentUser}
          onSaleSuccess={handleSaleSuccess}
        />
      )}

      {/* Restock Modal */}
      {isRestockModalOpen && (
        <RestockModal
          isOpen={isRestockModalOpen}
          onClose={() => {
            setIsRestockModalOpen(false);
            setModalTargetItemId(undefined);
          }}
          branches={branches}
          selectedBranchId={selectedBranchId}
          items={items}
          inventoryMap={inventoryMap}
          currentUser={currentUser}
          initialItemId={modalTargetItemId}
          onRestockSuccess={(msg) => alert(msg)}
        />
      )}

      {/* Adjustment Modal */}
      {isAdjustmentModalOpen && (
        <AdjustmentModal
          isOpen={isAdjustmentModalOpen}
          onClose={() => {
            setIsAdjustmentModalOpen(false);
            setModalTargetItemId(undefined);
          }}
          branches={branches}
          selectedBranchId={selectedBranchId}
          items={items}
          inventoryMap={inventoryMap}
          currentUser={currentUser}
          initialItemId={modalTargetItemId}
          onAdjustmentSuccess={(msg, alertCreated) => {
            if (alertCreated) {
              setActiveNotification({
                id: `push_${Date.now()}`,
                title:
                  alertCreated.alertType === 'OUT_OF_STOCK'
                    ? `🚨 Out of Stock — ${alertCreated.branchName}`
                    : `⚠️ Low Stock — ${alertCreated.branchName}`,
                body: alertCreated.message,
                timestamp: new Date().toISOString(),
                branchId: alertCreated.branchId,
                itemId: alertCreated.itemId,
                type: alertCreated.alertType,
              });
            }
          }}
        />
      )}
    </div>
  );
}
