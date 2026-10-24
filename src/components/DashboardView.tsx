import React from 'react';
import {
  Package,
  AlertTriangle,
  XCircle,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  ShoppingCart,
  PackagePlus,
  Sliders,
  Download,
  Building2,
  Layers,
  Clock,
} from 'lucide-react';
import { Branch, CatalogItem, BranchInventory, StockTransaction, UserProfile } from '../types';

interface DashboardViewProps {
  branches: Branch[];
  selectedBranchId: string;
  items: CatalogItem[];
  inventoryMap: Record<string, BranchInventory>;
  transactions: StockTransaction[];
  currentUser: UserProfile;
  onOpenSaleModal: () => void;
  onOpenRestockModal: (itemId?: string) => void;
  onOpenAdjustmentModal: (itemId?: string) => void;
  onNavigateToTab: (tab: string) => void;
  onExportCSV: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  branches,
  selectedBranchId,
  items,
  inventoryMap,
  transactions,
  currentUser,
  onOpenSaleModal,
  onOpenRestockModal,
  onOpenAdjustmentModal,
  onNavigateToTab,
  onExportCSV,
}) => {
  const isConsolidated = selectedBranchId === 'all';
  const currentBranch = branches.find((b) => b.id === selectedBranchId);

  // Relevant inventory items for the selected branch or consolidated
  const relevantInventory = React.useMemo(() => {
    if (!isConsolidated) {
      return Object.values(inventoryMap).filter((inv) => inv.branchId === selectedBranchId);
    }
    return Object.values(inventoryMap);
  }, [inventoryMap, selectedBranchId, isConsolidated]);

  // Key Metrics
  const totalCatalogCount = items.filter((i) => i.status === 'active').length;

  const inStockCount = relevantInventory.filter((inv) => inv.quantity > inv.minQuantity).length;
  const lowStockCount = relevantInventory.filter(
    (inv) => inv.quantity > 0 && inv.quantity <= inv.minQuantity
  ).length;
  const outOfStockCount = relevantInventory.filter((inv) => inv.quantity === 0).length;

  // Replenishment items: low or out of stock
  const replenishmentItems = relevantInventory
    .filter((inv) => inv.quantity <= inv.minQuantity)
    .sort((a, b) => a.quantity - b.quantity);

  const branchMap = new Map(branches.map((b) => [b.id, b]));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Banner / Header Bar */}
      <div className="bg-gradient-to-r from-teal-900/60 via-slate-900 to-sky-950/60 border border-teal-500/20 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-400">
              <Building2 className="w-4 h-4" />
              {isConsolidated ? 'Consolidated Multi-Branch View' : currentBranch?.name}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
              {isConsolidated ? 'All Branches Overview' : currentBranch?.name || 'Stock Dashboard'}
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              {isConsolidated
                ? 'Displaying inventory metrics across all authorized store branches. Local branch shortages are tracked independently.'
                : `Store code: ${currentBranch?.code} • Location: ${currentBranch?.location || 'Main floor'}`}
            </p>
          </div>

          {/* Quick Action FABs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenSaleModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-2xl shadow-lg shadow-teal-500/20 transition-all active:scale-95"
            >
              <ShoppingCart className="w-4 h-4" /> Record Sale
            </button>
            <button
              onClick={() => onOpenRestockModal()}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-2xl border border-slate-700 transition-colors"
            >
              <PackagePlus className="w-4 h-4 text-emerald-400" /> Restock
            </button>
            <button
              onClick={() => onOpenAdjustmentModal()}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-2xl border border-slate-700 transition-colors"
            >
              <Sliders className="w-4 h-4 text-amber-400" /> Adjust
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Catalog Items */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-3xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Central Catalog</span>
            <Package className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">{totalCatalogCount}</div>
          <div className="text-[11px] text-slate-400">Total active SKUs in business</div>
        </div>

        {/* In-Stock Level */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-3xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Healthy Stock</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400">{inStockCount}</div>
          <div className="text-[11px] text-slate-400">Items above minimum threshold</div>
        </div>

        {/* Low-Stock Warning */}
        <div
          onClick={() => onNavigateToTab('alerts')}
          className="bg-slate-900/80 border border-amber-800/40 p-4 rounded-3xl space-y-2 cursor-pointer hover:bg-slate-800/60 transition-all group"
        >
          <div className="flex items-center justify-between text-amber-400 text-xs font-semibold">
            <span>Low Stock</span>
            <AlertTriangle className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-400">{lowStockCount}</div>
          <div className="text-[11px] text-amber-300/80 flex items-center justify-between">
            <span>At or below min threshold</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Out of Stock Critical */}
        <div
          onClick={() => onNavigateToTab('alerts')}
          className="bg-slate-900/80 border border-rose-800/40 p-4 rounded-3xl space-y-2 cursor-pointer hover:bg-slate-800/60 transition-all group"
        >
          <div className="flex items-center justify-between text-rose-400 text-xs font-semibold">
            <span>Out of Stock</span>
            <XCircle className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-400">{outOfStockCount}</div>
          <div className="text-[11px] text-rose-300/80 flex items-center justify-between">
            <span>0 units available!</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* Requirement 4: Consolidated Multi-Branch Stock Matrix */}
      {isConsolidated && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400" />
                Branch-by-Branch Breakdown (Zero Blind Combining)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Every branch is isolated. Local shortages are clearly exposed rather than masked by warehouse sums.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Part # & Name</th>
                  {branches.map((b) => (
                    <th key={b.id} className="py-2.5 px-3 font-semibold">
                      {b.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items
                  .filter((i) => i.status === 'active')
                  .slice(0, 7)
                  .map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-3">
                        <span className="font-mono font-bold text-teal-400 mr-2">
                          {item.partNumber}
                        </span>
                        <span className="text-slate-200">{item.name}</span>
                      </td>
                      {branches.map((branch) => {
                        const inv = inventoryMap[`${branch.id}_${item.id}`];
                        const qty = inv ? inv.quantity : 0;
                        const min = inv ? inv.minQuantity : 5;
                        const isOut = qty === 0;
                        const isLow = qty > 0 && qty <= min;

                        return (
                          <td key={branch.id} className="py-3 px-3">
                            <span
                              className={`px-2 py-1 rounded-md text-[11px] font-mono font-bold inline-block ${
                                isOut
                                  ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                                  : isLow
                                  ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                                  : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                              }`}
                            >
                              {qty} / min {min}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Replenishment Checklist & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Urgent Replenishment List */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Replenishment Needed</h3>
                <p className="text-[11px] text-slate-400">Items below minimum safety stock</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateToTab('alerts')}
              className="text-xs text-teal-400 hover:underline flex items-center gap-1"
            >
              View all ({replenishmentItems.length}) &rarr;
            </button>
          </div>

          {replenishmentItems.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs bg-slate-950/40 rounded-2xl border border-slate-800">
              🎉 All items at or above minimum safety thresholds!
            </div>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {replenishmentItems.slice(0, 5).map((inv) => {
                const branch = branchMap.get(inv.branchId);
                const shortage = Math.max(0, (inv.restockTarget || inv.minQuantity * 2) - inv.quantity);
                const isOut = inv.quantity === 0;

                return (
                  <div
                    key={inv.id}
                    className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-teal-400">
                          {inv.partNumber}
                        </span>
                        <span className="text-xs font-semibold text-slate-200 truncate">
                          {inv.itemName}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {branch?.name} • Current:{' '}
                        <span className={isOut ? 'text-rose-400 font-bold' : 'text-amber-400 font-bold'}>
                          {inv.quantity}
                        </span>{' '}
                        (Min: {inv.minQuantity})
                      </div>
                    </div>

                    <button
                      onClick={() => onOpenRestockModal(inv.itemId)}
                      className="px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white rounded-xl text-xs font-semibold transition-colors flex-shrink-0"
                    >
                      Restock +{shortage}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Transactions Feed */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Recent Transactions</h3>
                <p className="text-[11px] text-slate-400">Real-time stock audit ledger</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateToTab('transactions')}
              className="text-xs text-teal-400 hover:underline flex items-center gap-1"
            >
              Full Ledger &rarr;
            </button>
          </div>

          {transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs bg-slate-950/40 rounded-2xl border border-slate-800">
              No transactions recorded yet. Record a sale to start.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {transactions.slice(0, 5).map((tx) => {
                const branch = branchMap.get(tx.branchId);
                const isSale = tx.type === 'SALE';
                const isRestock = tx.type === 'RESTOCK';

                return (
                  <div
                    key={tx.id}
                    className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isSale
                              ? 'bg-rose-950 text-rose-400 border border-rose-800/60'
                              : isRestock
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                              : 'bg-amber-950 text-amber-400 border border-amber-800/60'
                          }`}
                        >
                          {tx.type}
                        </span>
                        <span className="font-semibold text-slate-200 truncate">{tx.itemName}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {branch?.name} • {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span
                        className={`font-mono font-bold text-sm ${
                          tx.quantityChange > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {tx.quantityChange > 0 ? `+${tx.quantityChange}` : tx.quantityChange}
                      </span>
                      <div className="text-[10px] text-slate-500">Bal: {tx.resultingQuantity}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
