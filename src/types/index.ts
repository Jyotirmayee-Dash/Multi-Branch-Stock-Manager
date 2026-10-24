export type UserRole = 'owner' | 'manager' | 'staff';

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export type TransactionType = 'SALE' | 'RESTOCK' | 'ADJUSTMENT' | 'REVERSAL';

export interface Business {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  businessId: string;
  name: string;
  code: string;
  location?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  businessId: string;
  email: string;
  displayName: string;
  role: UserRole;
  assignedBranchIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CatalogItem {
  id: string;
  businessId: string;
  partNumber: string;
  name: string;
  description?: string;
  category?: string;
  unitPrice?: number;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface BranchInventory {
  id: string; // Typically `${branchId}_${itemId}`
  businessId: string;
  branchId: string;
  itemId: string;
  partNumber: string;
  itemName: string;
  quantity: number;
  minQuantity: number;
  restockTarget?: number;
  status: StockStatus;
  lastAlertState?: 'NONE' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  lastAlertAt?: string;
  updatedAt: string;
}

export interface StockTransaction {
  id: string;
  idempotencyKey: string;
  businessId: string;
  branchId: string;
  itemId: string;
  partNumber: string;
  itemName: string;
  type: TransactionType;
  quantityChange: number; // Negative for sale/adjustment down, positive for restock/adjustment up
  previousQuantity: number;
  resultingQuantity: number;
  reason?: string;
  notes?: string;
  userId: string;
  userEmail?: string;
  timestamp: string;
}

export interface AlertRecord {
  id: string;
  businessId: string;
  branchId: string;
  branchName: string;
  itemId: string;
  partNumber: string;
  itemName: string;
  alertType: 'LOW_STOCK' | 'OUT_OF_STOCK';
  currentStock: number;
  minRequired: number;
  message: string;
  acknowledged: boolean;
  createdAt: string;
}

export interface DeviceToken {
  id: string;
  businessId: string;
  userId: string;
  token: string;
  deviceModel: string;
  platform: 'android' | 'ios' | 'web';
  subscribedBranchIds: string[];
  updatedAt: string;
}

export interface SimulatedPushNotification {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  branchId: string;
  itemId: string;
  type: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'SYSTEM';
}
