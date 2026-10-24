import React, { useState, useMemo } from 'react';
import {
  Search,
  Receipt,
  Download,
  Filter,
  Undo2,
  Calendar,
  Building2,
  User,
  ArrowDownRight,
  ArrowUpRight,
  SlidersHorizontal,
} from 'lucide-react';
import { StockTransaction, Branch, UserProfile, TransactionType } from '../types';
import { InventoryService } from '../services/inventoryService';

interface TransactionsViewProps {
  transactions: StockTransaction[];
  branches: Branch[];
  selectedBranchId: string;
  currentUser: UserProfile;
  onExportCSV: () => void;
  onTransactionReversed: (msg: string) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  branches,
  selectedBranchId,
  currentUser,
  onExportCSV,
  onTransactionReversed,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>(selectedBranchId);
  const [isReversingId, setIsReversingId] = useState<string | null>(null);

  const branchMap = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);

  const filteredTransactions = useMemo(() => {
    let list = [...transactions];

    if (selectedBranchFilter !== 'all') {
      list = list.filter((t) => t.branchId === selectedBranchFilter);
    }

    if (typeFilter !== 'ALL') {
      list = list.filter((t) => t.type === typeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.partNumber.toLowerCase().includes(q) ||
          t.itemName.toLowerCase().includes(q) ||
          (t.userEmail && t.userEmail.toLowerCase().includes(q)) ||
          (t.reason && t.reason.toLowerCase().includes(q)) ||
          (t.notes && t.notes.toLowerCase().includes(q)) ||
          t.id.toLowerCase().includes(q)
      );
    }

    // Chronological (newest first)
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return list;
  }, [transactions, selectedBranchFilter, typeFilter, searchQuery]);

  const handleReverse = async (tx: StockTransaction) => {
    const reason = prompt(
      `Enter mandatory reason for reversing transaction ${tx.id} (${tx.type} for ${tx.itemName}):`,
      'Correction of accidental entry'
    );
    if (!reason || !reason.trim()) return;

    const branch = branchMap.get(tx.branchId);
    setIsReversingId(tx.id);

    try {
      await InventoryService.reverseTransaction(
        tx,
        reason.trim(),
        currentUser.id,
        currentUser.email,
        branch?.name || tx.branchId
      );
      onTransactionReversed(
        `Transaction ${tx.id} reversed successfully! Inventory restored.`
      );
    } catch (err: any) {
      alert(`Reversal failed: ${err.message}`);
    } finally {
      setIsReversingId(null);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-400">
            <Building2 className="w-4 h-4" />
            <span>Immutable Audit Trail</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">Stock Transactions Ledger</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Every sale, restock, adjustment, and reversal is permanently logged with atomic timestamps and author credentials.
          </p>
        </div>

        <button
          onClick={onExportCSV}
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-900/30 transition-all self-start sm:self-auto"
        >
          <Download className="w-4 h-4" /> Export Transactions CSV
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by part #, item name, user, notes, or Tx ID..."
            className="w-full bg-slate-900/90 border border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-500"
          />
        </div>

        {/* Branch Filter */}
        <select
          value={selectedBranchFilter}
          onChange={(e) => setSelectedBranchFilter(e.target.value)}
          className="bg-slate-900/90 border border-slate-700 rounded-2xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
        >
          <option value="all">All Branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        {/* Type Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {(['ALL', 'SALE', 'RESTOCK', 'ADJUSTMENT', 'REVERSAL'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                typeFilter === type
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table / Feed */}
      <div className="space-y-3">
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs bg-slate-900/40 rounded-3xl border border-slate-800">
            No transactions match the selected criteria.
          </div>
        ) : (
          filteredTransactions.map((tx) => {
            const branch = branchMap.get(tx.branchId);
            const isNegative = tx.quantityChange < 0;
            const isReversible =
              currentUser.role === 'owner' || currentUser.role === 'manager';

            return (
              <div
                key={tx.id}
                className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 transition-all shadow-md space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          tx.type === 'SALE'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : tx.type === 'RESTOCK'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : tx.type === 'REVERSAL'
                            ? 'bg-purple-950 text-purple-300 border border-purple-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {tx.type}
                      </span>
                      <span className="font-mono text-xs font-bold text-teal-400">
                        {tx.partNumber}
                      </span>
                      <h4 className="font-bold text-sm text-white truncate">{tx.itemName}</h4>
                    </div>

                    <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                      <span className="text-slate-300 font-medium">{branch?.name}</span>
                      <span>•</span>
                      <span>{new Date(tx.timestamp).toLocaleString()}</span>
                      <span>•</span>
                      <span className="text-slate-400">by {tx.userEmail || tx.userId}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 flex-shrink-0">
                    <div className="text-right">
                      <div
                        className={`font-mono text-lg font-black flex items-center justify-end gap-1 ${
                          isNegative ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {isNegative ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        {tx.quantityChange > 0 ? `+${tx.quantityChange}` : tx.quantityChange}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {tx.previousQuantity} &rarr; {tx.resultingQuantity} units
                      </div>
                    </div>

                    {isReversible && tx.type !== 'REVERSAL' && (
                      <button
                        onClick={() => handleReverse(tx)}
                        disabled={isReversingId === tx.id}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1"
                        title="Safe Reversal Transaction"
                      >
                        <Undo2 className="w-3.5 h-3.5" /> Reverse
                      </button>
                    )}
                  </div>
                </div>

                {(tx.reason || tx.notes) && (
                  <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 flex items-center gap-2">
                    <span className="font-semibold text-slate-300">
                      {tx.reason ? `Reason: ${tx.reason}` : 'Notes:'}
                    </span>
                    <span className="truncate">{tx.notes}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
