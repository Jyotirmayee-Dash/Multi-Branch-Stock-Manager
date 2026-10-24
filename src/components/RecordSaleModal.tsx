import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Building2,
  Hash,
  ShieldCheck,
  Package,
} from 'lucide-react';
import { Branch, CatalogItem, BranchInventory, UserProfile } from '../types';
import { InventoryService, generateIdempotencyKey } from '../services/inventoryService';

interface RecordSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches: Branch[];
  selectedBranchId: string;
  items: CatalogItem[];
  inventoryMap: Record<string, BranchInventory>; // keyed by `${branchId}_${itemId}`
  currentUser: UserProfile;
  onSaleSuccess: (message: string, alertCreated: any) => void;
}

export const RecordSaleModal: React.FC<RecordSaleModalProps> = ({
  isOpen,
  onClose,
  branches,
  selectedBranchId,
  items,
  inventoryMap,
  currentUser,
  onSaleSuccess,
}) => {
  // Step tracker: 1: Branch -> 2: Search -> 3: Confirm Item & Stock -> 4: Enter Qty -> 5: Review -> 6: Success
  const [step, setStep] = useState<number>(2);
  const [activeBranchId, setActiveBranchId] = useState<string>(
    selectedBranchId === 'all' ? branches[0]?.id || '' : selectedBranchId
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [quantitySold, setQuantitySold] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  // Filter items by search query (exact or partial, case insensitive)
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items.filter((i) => i.status === 'active').slice(0, 8);
    const q = searchQuery.toLowerCase().trim();
    return items
      .filter((i) => i.status === 'active')
      .filter(
        (i) =>
          i.partNumber.toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(q) ||
          (i.category && i.category.toLowerCase().includes(q))
      );
  }, [items, searchQuery]);

  if (!isOpen) return null;

  const currentBranch = branches.find((b) => b.id === activeBranchId) || branches[0];

  // Current branch inventory for selected item
  const currentInvRecord = selectedItem
    ? inventoryMap[`${activeBranchId}_${selectedItem.id}`]
    : null;
  const availableStock = currentInvRecord ? currentInvRecord.quantity : 0;
  const minThreshold = currentInvRecord ? currentInvRecord.minQuantity : 0;

  const handleSelectItem = (item: CatalogItem) => {
    setSelectedItem(item);
    setQuantitySold(1);
    setErrorMessage(null);
    setStep(3); // Move to item confirmation & stock inspection
  };

  const handleProceedToQty = () => {
    if (availableStock <= 0) {
      setErrorMessage(`Cannot record sale: This item is currently OUT OF STOCK at ${currentBranch.name}.`);
      return;
    }
    setErrorMessage(null);
    setStep(4);
  };

  const handleProceedToReview = () => {
    if (!quantitySold || quantitySold <= 0 || !Number.isInteger(Number(quantitySold))) {
      setErrorMessage('Quantity sold must be a positive whole integer (1, 2, 3...).');
      return;
    }
    if (quantitySold > availableStock) {
      setErrorMessage(
        `Quantity requested (${quantitySold}) exceeds available stock (${availableStock}) at ${currentBranch.name}.`
      );
      return;
    }
    // Generate fresh idempotency key for this sale session
    setIdempotencyKey(generateIdempotencyKey(activeBranchId, selectedItem!.id, 'sale'));
    setErrorMessage(null);
    setStep(5);
  };

  const handleConfirmSale = async () => {
    if (!selectedItem || !currentBranch) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await InventoryService.recordSale({
        businessId: currentBranch.businessId,
        branchId: currentBranch.id,
        branchName: currentBranch.name,
        itemId: selectedItem.id,
        partNumber: selectedItem.partNumber,
        itemName: selectedItem.name,
        quantitySold: Number(quantitySold),
        userId: currentUser.id,
        userEmail: currentUser.email,
        idempotencyKey,
        notes: notes.trim() || 'Direct sale',
      });

      onSaleSuccess(
        `Sale recorded successfully! Deducted ${quantitySold} unit(s) of ${selectedItem.name} at ${currentBranch.name}.`,
        result.alertCreated
      );
      onClose();
    } catch (err: any) {
      console.error('Sale failure:', err);
      setErrorMessage(err.message || 'Failed to record atomic sale transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Top Bar */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">Record a Sale</h3>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-teal-400" />
                <span>Branch:</span>
                <span className="font-semibold text-teal-300">{currentBranch?.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span className={`font-semibold ${step >= 2 ? 'text-teal-400' : ''}`}>1. Branch & Item</span>
          <span>&rarr;</span>
          <span className={`font-semibold ${step >= 3 ? 'text-teal-400' : ''}`}>2. Verify Stock</span>
          <span>&rarr;</span>
          <span className={`font-semibold ${step >= 4 ? 'text-teal-400' : ''}`}>3. Quantity</span>
          <span>&rarr;</span>
          <span className={`font-semibold ${step === 5 ? 'text-teal-400' : ''}`}>4. Confirm</span>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {errorMessage && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-600/50 rounded-2xl text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1 & 2: Search Item & Select Branch */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  1. Selling From Branch:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {branches.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setActiveBranchId(b.id)}
                      className={`p-3 rounded-xl border text-left text-xs transition-all ${
                        activeBranchId === b.id
                          ? 'bg-teal-500/20 border-teal-500 text-white font-semibold ring-1 ring-teal-500'
                          : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="font-bold truncate">{b.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{b.code}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  2. Search Item by Part Number or Name:
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search e.g. BS-2041 or Brake Shoe..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 text-slate-100 placeholder-slate-500"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
                  Select Item ({filteredItems.length} found):
                </span>
                {filteredItems.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs bg-slate-950/40 rounded-2xl border border-slate-800">
                    No matching catalog items found. Check spelling or part number.
                  </div>
                ) : (
                  filteredItems.map((item) => {
                    const inv = inventoryMap[`${activeBranchId}_${item.id}`];
                    const stock = inv ? inv.quantity : 0;
                    const isOut = stock === 0;
                    const isLow = stock > 0 && stock <= (inv?.minQuantity || 5);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectItem(item)}
                        className="w-full p-3 rounded-2xl bg-slate-800/40 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 flex items-center justify-between text-left transition-all group"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-800/50">
                              {item.partNumber}
                            </span>
                            <span className="font-semibold text-xs sm:text-sm text-slate-200 truncate">
                              {item.name}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 truncate">
                            {item.category || 'General Catalog'}
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <div
                            className={`text-xs font-bold px-2.5 py-1 rounded-full inline-block ${
                              isOut
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : isLow
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            }`}
                          >
                            {stock} in stock
                          </div>
                          {item.unitPrice && (
                            <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                              ${item.unitPrice.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Confirm Correct Item & Current Stock */}
          {step === 3 && selectedItem && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">
                    Step 3: Confirm Item Details
                  </span>
                  <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                    {selectedItem.partNumber}
                  </span>
                </div>

                <div>
                  <h4 className="text-base font-bold text-white">{selectedItem.name}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedItem.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800 text-xs">
                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Branch:</span>
                    <span className="font-bold text-slate-200">{currentBranch.name}</span>
                  </div>
                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Current Available:</span>
                    <span
                      className={`font-bold text-sm ${
                        availableStock === 0
                          ? 'text-rose-400'
                          : availableStock <= minThreshold
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {availableStock} units
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 bg-slate-900/50 p-2.5 rounded-xl flex items-center justify-between">
                  <span>Minimum Threshold: {minThreshold} units</span>
                  {selectedItem.unitPrice && (
                    <span className="font-mono text-slate-300 font-semibold">
                      Unit Price: ${selectedItem.unitPrice.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {availableStock <= 0 ? (
                <div className="p-4 bg-rose-950/40 border border-rose-700/60 rounded-2xl text-xs text-rose-300 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-400" /> Item Out of Stock
                  </p>
                  <p>
                    There are 0 units at {currentBranch.name}. A sale cannot be recorded without available stock.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Item verified. Stock is sufficient for recording a sale.</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Change Item
                </button>
                <button
                  type="button"
                  onClick={handleProceedToQty}
                  disabled={availableStock <= 0}
                  className="flex-1 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  Enter Quantity <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Enter Quantity Sold */}
          {step === 4 && selectedItem && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-teal-400">{selectedItem.partNumber}</span>
                  <span className="text-slate-400">{selectedItem.name}</span>
                </div>
                <div className="text-xs text-slate-400">
                  Available to sell at {currentBranch.name}:{' '}
                  <strong className="text-emerald-400 font-mono text-sm">{availableStock}</strong> units
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Enter Quantity Sold (whole numbers only):
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantitySold(Math.max(1, quantitySold - 1))}
                    className="w-12 h-12 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold text-lg flex items-center justify-center border border-slate-700 active:scale-95 transition-all"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={availableStock}
                    step="1"
                    value={quantitySold}
                    onChange={(e) => setQuantitySold(Math.floor(Number(e.target.value)))}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-2xl py-3 px-4 text-center font-mono text-xl font-bold text-teal-400 focus:outline-none focus:border-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantitySold(Math.min(availableStock, quantitySold + 1))}
                    className="w-12 h-12 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold text-lg flex items-center justify-center border border-slate-700 active:scale-95 transition-all"
                  >
                    +
                  </button>
                </div>

                <div className="flex justify-between items-center mt-2 px-1 text-xs">
                  <span className="text-slate-500">Min: 1 unit</span>
                  <span className="text-slate-500">Max available: {availableStock} units</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Transaction Notes / Customer Reference (Optional):
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Counter invoice #5021 or Retail walk-in"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="button"
                  onClick={handleProceedToReview}
                  className="flex-1 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  Review Transaction <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Review Transaction Summary & Atomic Confirm */}
          {step === 5 && selectedItem && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950/90 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                  <span className="font-semibold text-teal-400">Transaction Review</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Key: {idempotencyKey.slice(0, 14)}...
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Branch:</span>
                    <span className="font-bold text-white">{currentBranch.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Part Number:</span>
                    <span className="font-mono text-teal-300 font-bold">{selectedItem.partNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Item Name:</span>
                    <span className="font-semibold text-slate-200">{selectedItem.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cashier / User:</span>
                    <span className="text-slate-300">{currentUser.displayName} ({currentUser.role})</span>
                  </div>
                  {selectedItem.unitPrice && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Price:</span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        ${(selectedItem.unitPrice * quantitySold).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-900 p-2 rounded-xl">
                    <div className="text-[10px] text-slate-400">Current Stock</div>
                    <div className="font-bold text-slate-300 mt-0.5">{availableStock}</div>
                  </div>
                  <div className="bg-slate-900 p-2 rounded-xl border border-teal-500/30">
                    <div className="text-[10px] text-teal-400 font-semibold">Deducting</div>
                    <div className="font-bold text-rose-400 mt-0.5">-{quantitySold}</div>
                  </div>
                  <div className="bg-slate-900 p-2 rounded-xl">
                    <div className="text-[10px] text-slate-400">Resulting Stock</div>
                    <div
                      className={`font-bold mt-0.5 ${
                        availableStock - quantitySold === 0
                          ? 'text-rose-400'
                          : availableStock - quantitySold <= minThreshold
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {availableStock - quantitySold}
                    </div>
                  </div>
                </div>

                {/* Status change prediction */}
                {availableStock - quantitySold === 0 ? (
                  <div className="p-2.5 bg-rose-950/50 border border-rose-800/60 rounded-xl text-[11px] text-rose-300 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                    <span>Warning: This sale will drop stock to 0 and trigger an OUT OF STOCK alert.</span>
                  </div>
                ) : availableStock - quantitySold <= minThreshold ? (
                  <div className="p-2.5 bg-amber-950/50 border border-amber-800/60 rounded-xl text-[11px] text-amber-300 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                    <span>Notice: Resulting stock will reach threshold ({minThreshold}) triggering a LOW STOCK alert.</span>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
                <ShieldCheck className="w-4 h-4 text-teal-400 flex-shrink-0" />
                <span>Idempotent atomic transaction protects against duplicate taps and network glitches.</span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  disabled={isSubmitting}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Edit Quantity
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSale}
                  disabled={isSubmitting}
                  className="flex-1 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-teal-900/40 transition-all active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Validating & Deducting...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Sale</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
