import React from 'react';
import { Bell, AlertTriangle, XCircle, CheckCircle, X } from 'lucide-react';
import { SimulatedPushNotification } from '../types';

interface NotificationToastProps {
  notification: SimulatedPushNotification | null;
  onDismiss: () => void;
  onActionClick: (branchId: string, itemId: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onDismiss,
  onActionClick,
}) => {
  if (!notification) return null;

  const isOut = notification.type === 'OUT_OF_STOCK';

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md animate-in slide-in-from-top-4 duration-300">
      <div
        className={`p-4 rounded-2xl shadow-2xl border flex items-start gap-3 backdrop-blur-md cursor-pointer transition-transform hover:scale-[1.02] ${
          isOut
            ? 'bg-rose-950/90 border-rose-500/50 text-rose-100'
            : 'bg-amber-950/90 border-amber-500/50 text-amber-100'
        }`}
        onClick={() => {
          onActionClick(notification.branchId, notification.itemId);
          onDismiss();
        }}
      >
        <div
          className={`p-2 rounded-xl flex-shrink-0 ${
            isOut ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
          }`}
        >
          {isOut ? <XCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold tracking-wider uppercase opacity-80 flex items-center gap-1">
              <Bell className="w-3 h-3 inline" /> Android Push Notification • FCM
            </span>
            <span className="text-[10px] opacity-60">Just now</span>
          </div>
          <h4 className="font-bold text-sm mt-0.5 truncate">{notification.title}</h4>
          <p className="text-xs opacity-90 mt-1 line-clamp-2">{notification.body}</p>
          <div className="mt-2 text-[11px] font-medium text-sky-300 underline">
            Tap to open item details in branch &rarr;
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="text-white/60 hover:text-white p-1 rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
