import { BranchInventory, StockTransaction, Branch } from '../types';

export function exportInventoryToCSV(
  inventory: BranchInventory[],
  branches: Branch[],
  branchFilterName: string = 'All Branches'
) {
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));

  const headers = [
    'Branch Name',
    'Part Number',
    'Item Name',
    'Current Stock',
    'Minimum Threshold',
    'Target Restock Level',
    'Stock Status',
    'Units to Replenish',
    'Last Updated',
  ];

  const rows = inventory.map((inv) => {
    const branchName = branchMap.get(inv.branchId) || inv.branchId;
    const replenishmentNeed =
      inv.quantity <= inv.minQuantity
        ? Math.max(0, (inv.restockTarget || inv.minQuantity * 2) - inv.quantity)
        : 0;

    return [
      `"${branchName.replace(/"/g, '""')}"`,
      `"${inv.partNumber.replace(/"/g, '""')}"`,
      `"${inv.itemName.replace(/"/g, '""')}"`,
      inv.quantity,
      inv.minQuantity,
      inv.restockTarget || '-',
      `"${inv.status}"`,
      replenishmentNeed,
      `"${new Date(inv.updatedAt).toLocaleString()}"`,
    ];
  });

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  downloadBlob(
    csvContent,
    `stockpulse_inventory_${branchFilterName.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
  );
}

export function exportTransactionsToCSV(
  transactions: StockTransaction[],
  branches: Branch[]
) {
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));

  const headers = [
    'Timestamp',
    'Transaction ID',
    'Branch Name',
    'Part Number',
    'Item Name',
    'Type',
    'Quantity Change',
    'Previous Stock',
    'Resulting Stock',
    'User Email',
    'Reason / Notes',
  ];

  const rows = transactions.map((tx) => {
    const branchName = branchMap.get(tx.branchId) || tx.branchId;
    const note = [tx.reason, tx.notes].filter(Boolean).join(' | ');

    return [
      `"${new Date(tx.timestamp).toLocaleString()}"`,
      `"${tx.id}"`,
      `"${branchName.replace(/"/g, '""')}"`,
      `"${tx.partNumber.replace(/"/g, '""')}"`,
      `"${tx.itemName.replace(/"/g, '""')}"`,
      `"${tx.type}"`,
      tx.quantityChange,
      tx.previousQuantity,
      tx.resultingQuantity,
      `"${tx.userEmail || tx.userId}"`,
      `"${note.replace(/"/g, '""')}"`,
    ];
  });

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  downloadBlob(
    csvContent,
    `stockpulse_transactions_${new Date().toISOString().slice(0, 10)}.csv`
  );
}

function downloadBlob(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
