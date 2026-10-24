import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Plus,
  ShoppingCart,
  PackagePlus,
  Sliders,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Archive,
  Edit2,
  Building2,
  Download,
  X,
} from 'lucide-react';
import { Branch, CatalogItem, BranchInventory, UserProfile, StockStatus } from '../types';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { calculateStockStatus } from '../services/inventoryService';

interface InventoryViewProps {
  branches: Branch[];
  selectedBranchId: string;
  items: CatalogItem[];
  inventoryMap: Record<string, BranchInventory>;
  currentUser: UserProfile;
  onOpenSaleModal: () => void;
  onOpenRestockModal: (itemId?: string) => void;
  onOpenAdjustmentModal: (itemId?: string) => void;
  onExportCSV: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  branches,
  selectedBranchId,
  items,
  inventoryMap,
  currentUser,
  onOpenSaleModal,
  onOpenRestockModal,
  onOpenAdjustmentModal,
  onExportCSV,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | StockStatus>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'partNumber' | 'quantity'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Add Item Modal
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [newPartNumber, setNewPartNumber] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newCategory, setNewCategory] = useState('General Auto Parts');
  const [newPrice, setNewPrice] = useState(25.0);
  const [newMinStock, setNewMinStock] = useState(5);
  const [newInitialStock, setNewInitialStock] = useState(20);
  const [newDescription, setNewDescription] = useState('');
  const [itemError, setItemError] = useState<string | null>(null);

  const currentBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];
  const isConsolidated = selectedBranchId === 'all';

  // Filter & Search Logic
  const filteredItems = useMemo(() => {
    let list = items.filter((i) => i.status === 'active');

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.partNumber.toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(q) ||
          (i.category && i.category.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      list = list.filter((item) => {
        if (!isConsolidated) {
          const inv = inventoryMap[`${selectedBranchId}_${item.id}`];
          return inv ? inv.status === statusFilter : false;
        } else {
          // If consolidated, check if item has this status at ANY branch
          return branches.some((b) => {
            const inv = inventoryMap[`${b.id}_${item.id}`];
            return inv ? inv.status === statusFilter : false;
          });
        }
      });
    }

    // Sorting
    list.sort((a, b) => {
      let valA: any = a.name;
      let valB: any = b.name;

      if (sortBy === 'partNumber') {
        valA = a.partNumber;
        valB = b.partNumber;
      } else if (sortBy === 'quantity') {
        if (!isConsolidated) {
          valA = inventoryMap[`${selectedBranchId}_${a.id}`]?.quantity || 0;
          valB = inventoryMap[`${selectedBranchId}_${b.id}`]?.quantity || 0;
        } else {
          // Total quantity across branches
          valA = branches.reduce(
            (acc, b) => acc + (inventoryMap[`${b.id}_${a.id}`]?.quantity || 0),
            0
          );
          valB = branches.reduce(
            (acc, b) => acc + (inventoryMap[`${b.id}_${b.id}`]?.quantity || 0),
            0
          );
        }
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [
    items,
    searchQuery,
    statusFilter,
    sortBy,
    sortOrder,
    inventoryMap,
    selectedBranchId,
    isConsolidated,
    branches,
  ]);

  const handleAddNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setItemError(null);

    const cleanPartNo = newPartNumber.trim().toUpperCase();
    if (!cleanPartNo) {
      setItemError('Part number is required.');
      return;
    }

    // Requirement 3: Require a unique part number within the business
    const existing = items.find(
      (i) => i.partNumber.toLowerCase() === cleanPartNo.toLowerCase()
    );
    if (existing) {
      setItemError(`Duplicate part number! Part '${cleanPartNo}' is already registered for '${existing.name}'.`);
      return;
    }

    if (!newItemName.trim()) {
      setItemError('Item name is required.');
      return;
    }

    try {
      const itemId = `item_${Date.now()}`;
      const itemRef = doc(db, 'items', itemId);
      const now = new Date().toISOString();

      const newItem: CatalogItem = {
        id: itemId,
        businessId: branches[0]?.businessId || 'biz_apex_auto_1',
        partNumber: cleanPartNo,
        name: newItemName.trim(),
        description: newDescription.trim(),
        category: newCategory.trim(),
        unitPrice: Number(newPrice) || 0,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(itemRef, newItem);

      // Create branch inventory records for every branch
      for (const branch of branches) {
        const invId = `${branch.id}_${itemId}`;
        const invRef = doc(db, 'branch_inventory', invId);
        const qty = branch.id === currentBranch.id ? Number(newInitialStock) : 0;
        const status = calculateStockStatus(qty, Number(newMinStock));

        await setDoc(invRef, {
          id: invId,
          businessId: branch.businessId,
          branchId: branch.id,
          itemId,
          partNumber: cleanPartNo,
          itemName: newItemName.trim(),
          quantity: qty,
          minQuantity: Number(newMinStock),
          restockTarget: Number(newMinStock) * 3,
          status,
          lastAlertState: status !== 'IN_STOCK' ? status : 'NONE',
          lastAlertAt: '',
          updatedAt: now,
        });
      }

      setIsAddItemOpen(false);
      setNewPartNumber('');
      setNewItemName('');
      setNewDescription('');
    } catch (err: any) {
      setItemError(err.message || 'Failed to add catalog item.');
    }
  };

  const handleArchiveItem = async (item: CatalogItem) => {
    if (!confirm(`Are you sure you want to archive "${item.name}" (${item.partNumber})? Transaction history will be fully preserved.`)) {
      return;
    }
    try {
      await updateDoc(doc(db, 'items', item.id), {
        status: 'archived',
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to archive item', err);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-4 rounded-3xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-400">
            <Building2 className="w-3.5 h-3.5" />
            <span>Viewing:</span>
            <span className="text-white font-bold">
              {isConsolidated ? 'All Branches Consolidated' : currentBranch?.name}
            </span>
          </div>
          <h2 className="text-lg font-bold text-white mt-0.5">Inventory Catalog</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-teal-400" />
            Export CSV
          </button>
          <button
            onClick={() => setIsAddItemOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-900/30 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search part # (e.g. BS-2041) or item name..."
            className="w-full bg-slate-900/90 border border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-500"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {(['ALL', 'IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === st
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500'
                  : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              {st === 'ALL'
                ? 'All Items'
                : st === 'IN_STOCK'
                ? 'In Stock'
                : st === 'LOW_STOCK'
                ? 'Low Stock'
                : 'Out of Stock'}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700 rounded-2xl px-3 py-1.5">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-transparent text-xs text-slate-300 focus:outline-none pr-1"
          >
            <option value="name" className="bg-slate-900">Name</option>
            <option value="partNumber" className="bg-slate-900">Part #</option>
            <option value="quantity" className="bg-slate-900">Quantity</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="text-xs text-teal-400 font-bold px-1"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Item List / Cards */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs bg-slate-900/40 rounded-3xl border border-slate-800">
            No items matching your search criteria.
          </div>
        ) : (
          filteredItems.map((item) => {
            const currentInv = inventoryMap[`${currentBranch?.id}_${item.id}`];
            const currentQty = currentInv?.quantity ?? 0;
            const minQty = currentInv?.minQuantity ?? 5;
            const status = currentInv?.status ?? 'IN_STOCK';

            return (
              <div
                key={item.id}
                className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 transition-all shadow-md space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-teal-400 bg-teal-950/70 border border-teal-800/60 px-2 py-0.5 rounded-lg">
                        {item.partNumber}
                      </span>
                      <h3 className="font-bold text-sm sm:text-base text-white truncate">
                        {item.name}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                      {item.description || item.category || 'Standard catalog part'}
                    </p>
                  </div>

                  {/* Stock Status Badge */}
                  <div className="flex items-center gap-3">
                    {!isConsolidated ? (
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">Stock:</span>
                          <span
                            className={`font-mono text-base font-black ${
                              status === 'OUT_OF_STOCK'
                                ? 'text-rose-400'
                                : status === 'LOW_STOCK'
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {currentQty}
                          </span>
                          <span className="text-[11px] text-slate-500">(Min: {minQty})</span>
                        </div>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md inline-block mt-0.5 ${
                            status === 'OUT_OF_STOCK'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : status === 'LOW_STOCK'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    ) : (
                      /* Multi-branch chip preview */
                      <div className="flex flex-wrap gap-1.5">
                        {branches.map((b) => {
                          const inv = inventoryMap[`${b.id}_${item.id}`];
                          const q = inv?.quantity ?? 0;
                          const m = inv?.minQuantity ?? 5;
                          const isOut = q === 0;
                          const isLow = q > 0 && q <= m;

                          return (
                            <span
                              key={b.id}
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                                isOut
                                  ? 'bg-rose-950/70 border-rose-800 text-rose-300'
                                  : isLow
                                  ? 'bg-amber-950/70 border-amber-800 text-amber-300'
                                  : 'bg-slate-950/70 border-slate-700 text-slate-300'
                              }`}
                              title={`${b.name}: ${q} in stock`}
                            >
                              {b.code}: <strong>{q}</strong>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions Row */}
                <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                    {item.unitPrice && (
                      <span className="font-mono text-slate-300">
                        ${item.unitPrice.toFixed(2)} / unit
                      </span>
                    )}
                    <span>Category: {item.category || 'Automotive'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={onOpenSaleModal}
                      className="px-2.5 py-1.5 bg-teal-600/30 hover:bg-teal-600 text-teal-200 hover:text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" /> Sell
                    </button>
                    <button
                      onClick={() => onOpenRestockModal(item.id)}
                      className="px-2.5 py-1.5 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1"
                    >
                      <PackagePlus className="w-3.5 h-3.5" /> Restock
                    </button>
                    <button
                      onClick={() => onOpenAdjustmentModal(item.id)}
                      className="px-2.5 py-1.5 bg-amber-600/30 hover:bg-amber-600 text-amber-200 hover:text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1"
                    >
                      <Sliders className="w-3.5 h-3.5" /> Adjust
                    </button>
                    {currentUser.role === 'owner' && (
                      <button
                        onClick={() => handleArchiveItem(item)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                        title="Archive Item (Preserves history)"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Item Modal */}
      {isAddItemOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-teal-400" /> Add Catalog Item
              </h3>
              <button
                onClick={() => setIsAddItemOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {itemError && (
              <div className="p-3 bg-rose-950/60 border border-rose-600/50 rounded-xl text-rose-200 text-xs">
                {itemError}
              </div>
            )}

            <form onSubmit={handleAddNewItem} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Unique Part Number <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newPartNumber}
                  onChange={(e) => setNewPartNumber(e.target.value)}
                  placeholder="e.g. BS-2041 or FL-1090"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono uppercase text-teal-400 focus:outline-none focus:border-teal-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Must be unique across the entire business catalog.
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Item Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g. Heavy Duty Brake Shoe Set"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Category</label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Unit Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newPrice}
                    onChange={(e) => setNewPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Min Threshold (Default)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newMinStock}
                    onChange={(e) => setNewMinStock(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Initial Stock ({currentBranch.code})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newInitialStock}
                    onChange={(e) => setNewInitialStock(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Optional item specs or fitment details..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddItemOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
