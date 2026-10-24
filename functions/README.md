# Multi-Branch Stock Manager — Backend Cloud Functions

## Overview
This directory contains production-ready Firebase Cloud Functions for atomic inventory modifications, transaction ledger writes, idempotency enforcement, and Firebase Cloud Messaging (FCM) real-time Android push notifications.

## Cloud Functions Included
1. **`recordSale` (HTTPS Callable)**:
   - Validates caller authentication & branch authorization.
   - Evaluates idempotency key to prevent double deduction.
   - Atomically deducts inventory using Firestore transactions.
   - Rejects sales exceeding available stock.
   - Evaluates alert thresholds (`IN_STOCK` -> `LOW_STOCK`, `IN_STOCK` -> `OUT_OF_STOCK`).
   - Appends immutable audit ledger record to `transactions/`.

2. **`onStockAlertCreated` (Firestore Trigger on `alerts/{alertId}`)**:
   - Triggers whenever a low-stock or out-of-stock alert is generated.
   - Queries registered Android FCM tokens from `device_tokens/` matching branch subscriptions.
   - Dispatches high-priority Android push notifications with custom channel `stock_alerts_channel` and deep link data payloads.

## Deployment Steps

```bash
# 1. Install dependencies
cd functions
npm install

# 2. Build TypeScript
npm run build

# 3. Deploy functions and firestore rules
firebase deploy --only functions,firestore:rules
```
