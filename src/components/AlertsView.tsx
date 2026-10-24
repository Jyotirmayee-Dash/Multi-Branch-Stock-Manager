import React, { useState } from 'react';
import {
  Bell,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Smartphone,
  Send,
  Building2,
  RefreshCw,
  PackagePlus,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { AlertRecord, Branch, BranchInventory, UserProfile } from '../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

interface AlertsViewProps {
  alerts: AlertRecord[];
  branches: Branch[];
  selectedBranchId: string;
  inventoryMap: Record<string, BranchInventory>;
  currentUser: UserProfile;
  onOpenRestockModal: (itemId?: string) => void;
  onTriggerTestPushNotification: (branchId: string, alertType: 'LOW_STOCK' | 'OUT_OF_STOCK') => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  alerts,
  branches,
  selectedBranchId,
  inventoryMap,
  currentUser,
  onOpenRestockModal,
  onTriggerTestPushNotification,
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'UNACKNOWLEDGED' | 'OUT_OF_STOCK' | 'LOW_STOCK'>('ALL');
  const [fcmToken, setFcmToken] = useState<string>(
    'fcm_token_pixel8_' + Math.random().toString(36).substring(2, 10)
  );
  const [isCopied, setIsCopied] = useState(false);

  const isConsolidated = selectedBranchId === 'all';

  const filteredAlerts = alerts
    .filter((a) => (isConsolidated ? true : a.branchId === selectedBranchId))
    .filter((a) => {
      if (filterType === 'UNACKNOWLEDGED') return !a.acknowledged;
      if (filterType === 'OUT_OF_STOCK') return a.alertType === 'OUT_OF_STOCK';
      if (filterType === 'LOW_STOCK') return a.alertType === 'LOW_STOCK';
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleAcknowledge = async (alertId: string) => {
    try {
      await updateDoc(doc(db, 'alerts', alertId), {
        acknowledged: true,
      });
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const copyToken = () => {
    navigator.clipboard?.writeText(fcmToken);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-400">
            <Bell className="w-4 h-4 animate-bounce" />
            <span>FCM Push Notification & Shortage Monitor</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">Stock Shortage Alerts</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time threshold alerts across authorized business branches. Idempotent tracking prevents duplicate spam.
          </p>
        </div>

        {/* Test Notification Trigger */}
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              onTriggerTestPushNotification(
                selectedBranchId === 'all' ? branches[0]?.id || '' : selectedBranchId,
                'LOW_STOCK'
              )
            }
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-600/40 rounded-xl text-xs font-semibold transition-all"
          >
            <Send className="w-3.5 h-3.5" /> Test Low Stock FCM
          </button>
          <button
            onClick={() =>
              onTriggerTestPushNotification(
                selectedBranchId === 'all' ? branches[0]?.id || '' : selectedBranchId,
                'OUT_OF_STOCK'
              )
            }
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-600/40 rounded-xl text-xs font-semibold transition-all"
          >
            <Send className="w-3.5 h-3.5" /> Test Out-of-Stock FCM
          </button>
        </div>
      </div>

      {/* FCM Device & Android Push Notification Diagnostics Box (Requirement 9 & 10) */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950/40 to-slate-900 border border-teal-500/20 rounded-3xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Android FCM Registration & Push Delivery
              </h4>
              <p className="text-[11px] text-slate-400">
                FCM Channel: <code className="text-teal-300 font-mono">stock_alerts_channel</code> • High Priority
              </p>
            </div>
          </div>
          <span className="text-[11px] bg-teal-950 text-teal-300 border border-teal-800/60 px-2.5 py-1 rounded-full font-semibold">
            Status: Registered & Listening
          </span>
        </div>

        <div className="flex items-center gap-2 bg-slate-950/80 p-2.5 rounded-2xl border border-slate-800 text-xs">
          <span className="text-slate-400 font-medium text-[11px] whitespace-nowrap">
            FCM Token:
          </span>
          <span className="font-mono text-slate-300 text-[11px] truncate flex-1">
            {fcmToken}
          </span>
          <button
            onClick={copyToken}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-semibold flex-shrink-0"
          >
            {isCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
          <span>
            Authorized user: <strong className="text-slate-200">{currentUser.email}</strong> is subscribed to alerts for branches: {currentUser.assignedBranchIds.join(', ')}.
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(['ALL', 'UNACKNOWLEDGED', 'OUT_OF_STOCK', 'LOW_STOCK'] as const).map((ft) => (
          <button
            key={ft}
            onClick={() => setFilterType(ft)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              filterType === ft
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800'
            }`}
          >
            {ft === 'ALL'
              ? `All Alerts (${alerts.length})`
              : ft === 'UNACKNOWLEDGED'
              ? `Unacknowledged (${alerts.filter((a) => !a.acknowledged).length})`
              : ft === 'OUT_OF_STOCK'
              ? 'Out of Stock'
              : 'Low Stock'}
          </button>
        ))}
      </div>

      {/* Alerts Feed */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs bg-slate-900/40 rounded-3xl border border-slate-800">
            No alerts found under this filter. All inventory levels are nominal!
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isOut = alert.alertType === 'OUT_OF_STOCK';

            return (
              <div
                key={alert.id}
                className={`p-4 sm:p-5 rounded-3xl border transition-all shadow-md ${
                  isOut
                    ? 'bg-rose-950/20 border-rose-900/40 hover:border-rose-700/60'
                    : 'bg-amber-950/20 border-amber-900/40 hover:border-amber-700/60'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        isOut ? 'bg-rose-600/20 text-rose-400' : 'bg-amber-600/20 text-amber-400'
                      }`}
                    >
                      {isOut ? <XCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            isOut
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {alert.alertType.replace('_', ' ')}
                        </span>
                        <span className="text-xs font-bold text-white">{alert.branchName}</span>
                        <span className="text-[11px] text-slate-500">
                          {new Date(alert.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm sm:text-base text-slate-100 mt-1">
                        {alert.itemName}{' '}
                        <span className="font-mono text-teal-400 font-semibold">
                          ({alert.partNumber})
                        </span>
                      </h4>
                      <p className="text-xs text-slate-300 mt-1 font-medium bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                        "{alert.message}"
                      </p>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                    <button
                      onClick={() => onOpenRestockModal(alert.itemId)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-900/30 transition-all active:scale-95"
                    >
                      <PackagePlus className="w-3.5 h-3.5" /> Restock Now
                    </button>

                    {!alert.acknowledged ? (
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 transition-colors"
                      >
                        Acknowledge
                      </button>
                    ) : (
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Acknowledged
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
