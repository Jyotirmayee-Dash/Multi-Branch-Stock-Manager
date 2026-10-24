import { doc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Business, Branch, CatalogItem, BranchInventory, UserProfile } from '../types';
import { calculateStockStatus } from './inventoryService';

export const DEFAULT_BUSINESS_ID = 'biz_apex_auto_1';

export const INITIAL_BRANCHES: Branch[] = [
  {
    id: 'branch_central',
    businessId: DEFAULT_BUSINESS_ID,
    name: 'Central Hub & Warehouse',
    code: 'CENTRAL-01',
    location: '100 Industrial Parkway, Sector 4',
    phone: '+1 (555) 019-2831',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'branch_downtown',
    businessId: DEFAULT_BUSINESS_ID,
    name: 'Downtown Retail Store',
    code: 'DOWNTOWN-02',
    location: '450 Market Street, Suite 12',
    phone: '+1 (555) 014-9921',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'branch_westside',
    businessId: DEFAULT_BUSINESS_ID,
    name: 'Westside Logistics Depot',
    code: 'WESTSIDE-03',
    location: '820 Airport Boulevard',
    phone: '+1 (555) 018-4432',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const INITIAL_CATALOG_ITEMS: CatalogItem[] = [
  {
    id: 'item_bs2041',
    businessId: DEFAULT_BUSINESS_ID,
    partNumber: 'BS-2041',
    name: 'Heavy-Duty Brake Shoe Set',
    description: 'Direct-fit OEM grade ceramic formulation with anti-squeal shims',
    category: 'Braking Systems',
    unitPrice: 48.5,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'item_of1092',
    businessId: DEFAULT_BUSINESS_ID,
    partNumber: 'OF-1092',
    name: 'Premium Synthetic Oil Filter',
    description: 'High-efficiency 99% filtration down to 20 microns with silicone anti-drain valve',
    category: 'Filters & Lubrication',
    unitPrice: 12.99,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'item_sp4402',
    businessId: DEFAULT_BUSINESS_ID,
    partNumber: 'SP-4402',
    name: 'Laser Iridium Spark Plug 4-Pack',
    description: '0.6mm fine-wire center electrode for maximum spark ignitability',
    category: 'Ignition',
    unitPrice: 38.0,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'item_bl8800',
    businessId: DEFAULT_BUSINESS_ID,
    partNumber: 'BL-8800',
    name: 'Front Ceramic Disc Brake Pads',
    description: 'Low-dust copper-free formula with stainless hardware clips',
    category: 'Braking Systems',
    unitPrice: 56.0,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'item_fl3301',
    businessId: DEFAULT_BUSINESS_ID,
    partNumber: 'FL-3301',
    name: 'Extended Life 50/50 Antifreeze 1 Gal',
    description: 'Prediluted silicate-free ethylene glycol coolant for all makes/models',
    category: 'Fluids & Chemicals',
    unitPrice: 18.75,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'item_wr7711',
    businessId: DEFAULT_BUSINESS_ID,
    partNumber: 'WR-7711',
    name: '72-Tooth Quick-Release Ratchet 1/2"',
    description: 'Chrome vanadium alloy with ergonomic quick-reversing lever',
    category: 'Shop Tools',
    unitPrice: 34.25,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'item_bt9904',
    businessId: DEFAULT_BUSINESS_ID,
    partNumber: 'BT-9904',
    name: 'AGM 12V 800-CCA Automotive Battery',
    description: 'Maintenance-free sealed absorbed glass mat with deep-cycle resistance',
    category: 'Electrical',
    unitPrice: 189.0,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Branch inventory levels: designed to showcase IN_STOCK, LOW_STOCK, and OUT_OF_STOCK
export const INITIAL_BRANCH_INVENTORY: Record<string, Record<string, { qty: number; min: number; target: number }>> = {
  branch_central: {
    item_bs2041: { qty: 45, min: 10, target: 60 },
    item_of1092: { qty: 120, min: 25, target: 150 },
    item_sp4402: { qty: 80, min: 20, target: 100 },
    item_bl8800: { qty: 35, min: 8, target: 50 },
    item_fl3301: { qty: 60, min: 15, target: 80 },
    item_wr7711: { qty: 25, min: 5, target: 30 },
    item_bt9904: { qty: 15, min: 4, target: 20 },
  },
  branch_downtown: {
    item_bs2041: { qty: 4, min: 8, target: 20 }, // LOW STOCK!
    item_of1092: { qty: 18, min: 15, target: 30 },
    item_sp4402: { qty: 9, min: 12, target: 25 }, // LOW STOCK!
    item_bl8800: { qty: 0, min: 6, target: 15 }, // OUT OF STOCK!
    item_fl3301: { qty: 22, min: 10, target: 30 },
    item_wr7711: { qty: 7, min: 4, target: 10 },
    item_bt9904: { qty: 2, min: 3, target: 8 }, // LOW STOCK!
  },
  branch_westside: {
    item_bs2041: { qty: 0, min: 5, target: 15 }, // OUT OF STOCK!
    item_of1092: { qty: 6, min: 10, target: 25 }, // LOW STOCK!
    item_sp4402: { qty: 24, min: 10, target: 30 },
    item_bl8800: { qty: 14, min: 8, target: 20 },
    item_fl3301: { qty: 5, min: 8, target: 20 }, // LOW STOCK!
    item_wr7711: { qty: 1, min: 3, target: 8 }, // LOW STOCK!
    item_bt9904: { qty: 0, min: 2, target: 6 }, // OUT OF STOCK!
  },
};

export async function seedInitialDatabaseIfNeeded(userId: string, userEmail: string): Promise<boolean> {
  try {
    const bizRef = doc(db, 'businesses', DEFAULT_BUSINESS_ID);
    const bizSnap = await getDoc(bizRef);

    if (bizSnap.exists()) {
      return false; // Already seeded
    }

    const batch = writeBatch(db);

    // 1. Create Business
    const business: Business = {
      id: DEFAULT_BUSINESS_ID,
      name: 'Apex Auto Parts & Hardware',
      ownerId: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    batch.set(bizRef, business);

    // 2. Create User Profile
    const userRef = doc(db, 'users', userId);
    const userProfile: UserProfile = {
      id: userId,
      businessId: DEFAULT_BUSINESS_ID,
      email: userEmail,
      displayName: userEmail.split('@')[0] || 'Business Owner',
      role: 'owner',
      assignedBranchIds: ['branch_central', 'branch_downtown', 'branch_westside'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    batch.set(userRef, userProfile);

    // 3. Create Branches
    for (const branch of INITIAL_BRANCHES) {
      const bRef = doc(db, 'branches', branch.id);
      batch.set(bRef, branch);
    }

    // 4. Create Catalog Items
    for (const item of INITIAL_CATALOG_ITEMS) {
      const itemRef = doc(db, 'items', item.id);
      batch.set(itemRef, item);
    }

    // 5. Create Branch Inventory Records
    for (const branch of INITIAL_BRANCHES) {
      const branchStock = INITIAL_BRANCH_INVENTORY[branch.id] || {};
      for (const item of INITIAL_CATALOG_ITEMS) {
        const spec = branchStock[item.id] || { qty: 10, min: 5, target: 20 };
        const status = calculateStockStatus(spec.qty, spec.min);
        const invDocId = `${branch.id}_${item.id}`;
        const invRef = doc(db, 'branch_inventory', invDocId);

        const inventoryData: BranchInventory = {
          id: invDocId,
          businessId: DEFAULT_BUSINESS_ID,
          branchId: branch.id,
          itemId: item.id,
          partNumber: item.partNumber,
          itemName: item.name,
          quantity: spec.qty,
          minQuantity: spec.min,
          restockTarget: spec.target,
          status,
          lastAlertState: status === 'LOW_STOCK' ? 'LOW_STOCK' : status === 'OUT_OF_STOCK' ? 'OUT_OF_STOCK' : 'NONE',
          lastAlertAt: status !== 'IN_STOCK' ? new Date().toISOString() : '',
          updatedAt: new Date().toISOString(),
        };

        batch.set(invRef, inventoryData);

        // Pre-create initial alert records for existing shortages
        if (status === 'LOW_STOCK' || status === 'OUT_OF_STOCK') {
          const alertId = `alt_init_${branch.id}_${item.id}`;
          const alertRef = doc(db, 'alerts', alertId);
          batch.set(alertRef, {
            id: alertId,
            businessId: DEFAULT_BUSINESS_ID,
            branchId: branch.id,
            branchName: branch.name,
            itemId: item.id,
            partNumber: item.partNumber,
            itemName: item.name,
            alertType: status,
            currentStock: spec.qty,
            minRequired: spec.min,
            message:
              status === 'OUT_OF_STOCK'
                ? `Out of Stock — ${branch.name}: ${item.name} (${item.partNumber}). Current stock: ${spec.qty}.`
                : `Low Stock — ${branch.name}: ${item.name} (${item.partNumber}). Current stock: ${spec.qty}. Minimum required: ${spec.min}.`,
            acknowledged: false,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    await batch.commit();
    return true;
  } catch (error) {
    console.error('Failed to seed initial database:', error);
    return false;
  }
}
