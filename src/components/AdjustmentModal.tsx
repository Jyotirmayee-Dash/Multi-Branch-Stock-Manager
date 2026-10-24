import React, { useState } from 'react';
import { X, Sliders, CheckCircle2, AlertCircle } from 'lucide-react';
import { Branch, CatalogItem, BranchInventory, UserProfile } from '../types';
import { InventoryService } from '../services/inventoryService';

interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches: Branch[];
  selectedBranchId: string;
  items: CatalogItem[];
  inventoryMap: Record<string, BranchInventory>;
  currentUser: UserProfile;
  initialItemId?: string;
  onAdjustmentSuccess: (msg: string, alertCreated: any) => void;
}

const MANDATORY_REASONS = [
  'Physical Count Audit (Discrepancy Correction)',
  'Damaged / Broken in Warehouse',
  'Customer Return to Shelf',
  'Supplier Credit / Defective Return',
  'Expired / Shelf-Life Reached',
  'Internal Shrinkage / Loss',
  'Stock Transfer Adjustment',
  'Other (Specify in Notes)',
];

export const AdjustmentModal: React.FC<AdjustmentModalProps> = ({
  isOpen,
  onClose,
  branches,
  selectedBranchId,
  items,
  inventoryMap,
  currentUser,
  initialItemId,
  onAdjustmentSuccess,
}) => {
  const [branchId, setBranchId] = useState<string>(
    selectedBranchId === 'all' ? branches[0]?.id || '' : selectedBranchId
  );
  const [itemId, setItemId] = useState<string>(initialItemId || items[0]?.id || '');
  const [reason, setReason] = useState<string>(MANDATORY_REASONS[0]);
  const [newQuantity, setNewQuantity] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentBranch = branches.find((b) => b.id === branchId) || branches[0];
  const selectedItem = items.find((i) => i.id === itemId) || items[0];
  const invRecord = selectedItem ? inventoryMap[`${branchId}_${selectedItem.id}`] : null;
  const currentStock = invRecord?.quantity || 0;
  const diff = Number(newQuantity) - currentStock;

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !currentBranch) return;

    if (!reason || reason.trim().length === 0) {
      setErrorMessage('A mandatory reason is required.');
      return;
    }

    if (newQuantity < 0 || !Number.isInteger(Number(newQuantity))) {
      setErrorMessage('New quantity must be a non-negative whole integer (0, 1, 2...).');
      return;
    }

    if (diff === 0) {
      setErrorMessage('New quantity is equal to current stock. No adjustment needed.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await InventoryService.recordAdjustment({
        businessId: currentBranch.businessId,
        branchId: currentBranch.id,
        branchName: currentBranch.name,
        itemId: selectedItem.id,
        partNumber: selectedItem.partNumber,
        itemName: selectedItem.name,
        newQuantity: Number(newQuantity),
        reason,
        userId: currentUser.id,
        userEmail: currentUser.email,
        notes: notes.trim(),
      });

      onAdjustmentSuccess(
        `Stock adjusted for ${selectedItem.name} at ${currentBranch.name}: ${currentStock} &rarr; ${newQuantity} (${
          diff > 0 ? '+' : ''
        }${diff} units). Reason: ${reason}.`,
        res.alertCreated
      );
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Stock adjustment failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">Stock Adjustment</h3>
              <p className="text-xs text-slate-400">Audit correction or damage record</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleAdjust} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-950/60 border border-rose-600/50 rounded-xl text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Branch:</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Item:</label>
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
            >
              {items
                .filter((i) => i.status === 'active')
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    [{i.partNumber}] {i.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs flex items-center justify-between">
            <span className="text-slate-400">Current Recorded Stock:</span>
            <span className="font-bold text-white text-sm">{currentStock} units</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              New Counted Quantity:
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={newQuantity}
              onChange={(e) => setNewQuantity(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-center font-mono text-lg font-bold text-amber-400 focus:outline-none focus:border-amber-500"
            />
            <div className="mt-1 text-center text-xs font-semibold">
              Net Change:{' '}
              <span className={diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-rose-400' : 'text-slate-400'}>
                {diff > 0 ? `+${diff}` : diff} units
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Mandatory Reason <span className="text-rose-400">*</span>:
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              required
            >
              {MANDATORY_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Additional Details / Audit Notes:
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Recount verified with physical shelf count"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || diff === 0}
              className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-amber-900/40"
            >
              {isSubmitting ? (
                'Saving...'
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Save Adjustment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
