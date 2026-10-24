import React, { useState } from 'react';
import { X, ArrowDownToLine, CheckCircle2, AlertCircle, Building2, PackagePlus } from 'lucide-react';
import { Branch, CatalogItem, BranchInventory, UserProfile } from '../types';
import { InventoryService } from '../services/inventoryService';

interface RestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches: Branch[];
  selectedBranchId: string;
  items: CatalogItem[];
  inventoryMap: Record<string, BranchInventory>;
  currentUser: UserProfile;
  initialItemId?: string;
  onRestockSuccess: (msg: string) => void;
}

export const RestockModal: React.FC<RestockModalProps> = ({
  isOpen,
  onClose,
  branches,
  selectedBranchId,
  items,
  inventoryMap,
  currentUser,
  initialItemId,
  onRestockSuccess,
}) => {
  const [branchId, setBranchId] = useState<string>(
    selectedBranchId === 'all' ? branches[0]?.id || '' : selectedBranchId
  );
  const [itemId, setItemId] = useState<string>(initialItemId || items[0]?.id || '');
  const [quantity, setQuantity] = useState<number>(10);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentBranch = branches.find((b) => b.id === branchId) || branches[0];
  const selectedItem = items.find((i) => i.id === itemId) || items[0];
  const invRecord = selectedItem ? inventoryMap[`${branchId}_${selectedItem.id}`] : null;
  const currentStock = invRecord?.quantity || 0;
  const minThreshold = invRecord?.minQuantity || 5;
  const restockTarget = invRecord?.restockTarget || minThreshold * 2;

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !currentBranch) return;

    if (quantity <= 0 || !Number.isInteger(Number(quantity))) {
      setErrorMessage('Quantity must be a positive integer.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await InventoryService.recordRestock({
        businessId: currentBranch.businessId,
        branchId: currentBranch.id,
        branchName: currentBranch.name,
        itemId: selectedItem.id,
        partNumber: selectedItem.partNumber,
        itemName: selectedItem.name,
        quantityReceived: Number(quantity),
        userId: currentUser.id,
        userEmail: currentUser.email,
        notes: notes.trim() || 'Shipment received / Restock',
      });

      onRestockSuccess(
        `Restocked +${quantity} units of ${selectedItem.name} at ${currentBranch.name}. New balance: ${
          currentStock + Number(quantity)
        }.`
      );
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Restock failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">Restock / Stock In</h3>
              <p className="text-xs text-slate-400">Receive inventory shipment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleRestock} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-950/60 border border-rose-600/50 rounded-xl text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Receiving Branch:
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
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
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
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

          {selectedItem && (
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Current Stock:</span>
                <span className="font-bold text-white">{currentStock} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Min Threshold:</span>
                <span className="text-slate-300">{minThreshold} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Target Level:</span>
                <span className="text-slate-300">{restockTarget} units</span>
              </div>
              <div className="flex justify-between text-emerald-400 pt-1 border-t border-slate-800">
                <span>Suggested Replenishment:</span>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, restockTarget - currentStock))}
                  className="underline font-bold hover:text-emerald-300"
                >
                  +{Math.max(1, restockTarget - currentStock)} units
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Quantity Received:
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 5))}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold"
              >
                -5
              </button>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-center font-mono text-base font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => setQuantity(quantity + 5)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold"
              >
                +5
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Supplier / Batch Notes (Optional):
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. PO #84102 / Vendor ACME Parts"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
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
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/40"
            >
              {isSubmitting ? (
                'Processing...'
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Confirm Restock
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
