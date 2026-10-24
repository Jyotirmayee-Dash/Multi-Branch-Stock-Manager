# Security Specification & Threat Model

## 1. System Invariants
1. **Branch Isolation**: A stock modification or read for Branch B must never be permissible by a staff member only assigned to Branch A.
2. **Immutable Ledger**: Stock transactions once written cannot be updated or deleted by any client.
3. **Role Enforcement**:
   - `owner`: full control across all branches, catalog, settings, user assignments.
   - `manager`: manage stock, restock, adjustments for assigned branches. Cannot modify business ownership or other branches.
   - `staff`: search catalog, execute authorized sales and restocks for assigned branches. Cannot change branch thresholds, delete catalog, or alter role assignments.
4. **Catalog Integrity**: Part numbers must be unique, non-empty, and adhere to alphanumeric regex format `^[a-zA-Z0-9_\-\.]+$` with max length 60.
5. **Stock Threshold Rules**:
   - `IN_STOCK`: quantity > minQuantity
   - `LOW_STOCK`: 0 < quantity <= minQuantity
   - `OUT_OF_STOCK`: quantity == 0
6. **Device Token Ownership**: Users can only register and update their own device FCM tokens.

## 2. The "Dirty Dozen" Vulnerability Payloads

1. **Unassigned Branch Sale Attempt**
   - Payload: `POST /transactions` with `branchId: "branch-b"` by user assigned only to `branch-a`.
   - Expected: PERMISSION_DENIED.

2. **Transaction Ledger Tampering**
   - Payload: `PATCH /transactions/tx-123` with `{ "resultingQuantity": 999 }`.
   - Expected: PERMISSION_DENIED (Transactions are strictly immutable).

3. **Direct Stock Manipulation Bypass**
   - Payload: `PATCH /branch_inventory/inv-456` with `{ "quantity": 1000 }` without transaction ledger.
   - Expected: PERMISSION_DENIED.

4. **Negative Stock Sale Injection**
   - Payload: `POST /transactions` with `{ "quantityChange": -50 }` when current stock is 5.
   - Expected: Validation Failure & PERMISSION_DENIED.

5. **Role Privilege Escalation**
   - Payload: `PATCH /users/{staffUid}` with `{ "role": "owner" }` by staff.
   - Expected: PERMISSION_DENIED.

6. **Denial of Wallet String Injection**
   - Payload: `POST /items` with `partNumber` of 2MB junk text.
   - Expected: Validation Failure (max 60 chars constraint).

7. **Foreign Device Token Stealing**
   - Payload: `PUT /device_tokens/foreign-user-token` with `{ "userId": "victim-user" }` by attacker.
   - Expected: PERMISSION_DENIED (Must match `request.auth.uid`).

8. **Unauthenticated Business Read**
   - Payload: `GET /businesses` with `request.auth = null`.
   - Expected: PERMISSION_DENIED.

9. **Catalog Deletion by Staff**
   - Payload: `DELETE /items/item-1` by user with role `staff`.
   - Expected: PERMISSION_DENIED.

10. **Branch Creation by Non-Owner**
    - Payload: `POST /branches` by user with role `manager`.
    - Expected: PERMISSION_DENIED.

11. **Negative Min Threshold Tamper**
    - Payload: `PATCH /branch_inventory/inv-1` with `{ "minQuantity": -10 }`.
    - Expected: Validation Failure.

12. **Alert State Deletion by Staff**
    - Payload: `DELETE /alerts/alert-99` by unauthorized user.
    - Expected: PERMISSION_DENIED.
