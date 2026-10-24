package com.stockpulse.app.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.stockpulse.app.model.*
import kotlinx.coroutines.tasks.await
import java.time.Instant
import java.util.UUID

class InventoryRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance()
) {

    private fun calculateStatus(qty: Int, minQty: Int): StockStatus {
        return when {
            qty <= 0 -> StockStatus.OUT_OF_STOCK
            qty <= minQty -> StockStatus.LOW_STOCK
            else -> StockStatus.IN_STOCK
        }
    }

    suspend fun recordSale(
        businessId: String,
        branchId: String,
        branchName: String,
        itemId: String,
        partNumber: String,
        itemName: String,
        quantitySold: Int,
        idempotencyKey: String,
        notes: String = ""
    ): Result<StockTransaction> = runCatching {
        require(quantitySold > 0) { "Sale quantity must be positive" }
        val user = auth.currentUser ?: throw IllegalStateException("User not authenticated")

        val invDocId = "${branchId}_$itemId"
        val invRef = firestore.collection("branch_inventory").doc(invDocId)
        val txId = "tx_${System.currentTimeMillis()}_${UUID.randomUUID().toString().take(6)}"
        val txRef = firestore.collection("transactions").doc(txId)

        firestore.runTransaction { transaction ->
            val snapshot = transaction.get(invRef)
            if (!snapshot.exists()) {
                throw IllegalStateException("Inventory record not found for branch.")
            }

            val currentQty = (snapshot.getLong("quantity") ?: 0).toInt()
            val minQty = (snapshot.getLong("minQuantity") ?: 0).toInt()
            val oldStatus = snapshot.getString("status") ?: "IN_STOCK"
            val lastAlertState = snapshot.getString("lastAlertState") ?: "NONE"

            if (quantitySold > currentQty) {
                throw IllegalStateException("Insufficient stock! Available: $currentQty, Requested: $quantitySold")
            }

            val resultingQty = currentQty - quantitySold
            val newStatus = calculateStatus(resultingQty, minQty)

            var nextAlertState = lastAlertState

            // Check alert transition
            if (newStatus == StockStatus.OUT_OF_STOCK && oldStatus != "OUT_OF_STOCK") {
                nextAlertState = "OUT_OF_STOCK"
                val alertId = "alt_${System.currentTimeMillis()}_${UUID.randomUUID().toString().take(6)}"
                val alertRef = firestore.collection("alerts").doc(alertId)
                val alertMap = hashMapOf(
                    "id" to alertId,
                    "businessId" to businessId,
                    "branchId" to branchId,
                    "branchName" to branchName,
                    "itemId" to itemId,
                    "partNumber" to partNumber,
                    "itemName" to itemName,
                    "alertType" to "OUT_OF_STOCK",
                    "currentStock" to resultingQty,
                    "minRequired" to minQty,
                    "message" to "Out of Stock — $branchName: $itemName ($partNumber). Current stock: $resultingQty.",
                    "acknowledged" to false,
                    "createdAt" to Instant.now().toString()
                )
                transaction.set(alertRef, alertMap)
            } else if (newStatus == StockStatus.LOW_STOCK && oldStatus == "IN_STOCK" && lastAlertState != "LOW_STOCK") {
                nextAlertState = "LOW_STOCK"
                val alertId = "alt_${System.currentTimeMillis()}_${UUID.randomUUID().toString().take(6)}"
                val alertRef = firestore.collection("alerts").doc(alertId)
                val alertMap = hashMapOf(
                    "id" to alertId,
                    "businessId" to businessId,
                    "branchId" to branchId,
                    "branchName" to branchName,
                    "itemId" to itemId,
                    "partNumber" to partNumber,
                    "itemName" to itemName,
                    "alertType" to "LOW_STOCK",
                    "currentStock" to resultingQty,
                    "minRequired" to minQty,
                    "message" to "Low Stock — $branchName: $itemName ($partNumber). Current stock: $resultingQty. Minimum required: $minQty.",
                    "acknowledged" to false,
                    "createdAt" to Instant.now().toString()
                )
                transaction.set(alertRef, alertMap)
            }

            // Update inventory
            transaction.update(
                invRef,
                mapOf(
                    "quantity" to resultingQty,
                    "status" to newStatus.name,
                    "lastAlertState" to nextAlertState,
                    "updatedAt" to Instant.now().toString()
                )
            )

            // Insert transaction ledger
            val txMap = hashMapOf(
                "id" to txId,
                "idempotencyKey" to idempotencyKey,
                "businessId" to businessId,
                "branchId" to branchId,
                "itemId" to itemId,
                "partNumber" to partNumber,
                "itemName" to itemName,
                "type" to "SALE",
                "quantityChange" to -quantitySold,
                "previousQuantity" to currentQty,
                "resultingQuantity" to resultingQty,
                "notes" to notes,
                "userId" to user.uid,
                "userEmail" to (user.email ?: ""),
                "timestamp" to Instant.now().toString()
            )
            transaction.set(txRef, txMap)

            StockTransaction(
                id = txId,
                idempotencyKey = idempotencyKey,
                businessId = businessId,
                branchId = branchId,
                itemId = itemId,
                partNumber = partNumber,
                itemName = itemName,
                type = TransactionType.SALE,
                quantityChange = -quantitySold,
                previousQuantity = currentQty,
                resultingQuantity = resultingQty,
                notes = notes,
                userId = user.uid,
                userEmail = user.email ?: "",
                timestamp = Instant.now().toString()
            )
        }.await()
    }

    suspend fun recordRestock(
        businessId: String,
        branchId: String,
        branchName: String,
        itemId: String,
        partNumber: String,
        itemName: String,
        quantityReceived: Int,
        notes: String = ""
    ): Result<StockTransaction> = runCatching {
        require(quantityReceived > 0) { "Restock quantity must be positive" }
        val user = auth.currentUser ?: throw IllegalStateException("User not authenticated")

        val invDocId = "${branchId}_$itemId"
        val invRef = firestore.collection("branch_inventory").doc(invDocId)
        val txId = "tx_restock_${System.currentTimeMillis()}_${UUID.randomUUID().toString().take(6)}"
        val txRef = firestore.collection("transactions").doc(txId)

        firestore.runTransaction { transaction ->
            val snapshot = transaction.get(invRef)
            val currentQty = (snapshot.getLong("quantity") ?: 0).toInt()
            val minQty = (snapshot.getLong("minQuantity") ?: 0).toInt()
            val resultingQty = currentQty + quantityReceived
            val newStatus = calculateStatus(resultingQty, minQty)

            val nextAlertState = if (newStatus == StockStatus.IN_STOCK) "NONE" else snapshot.getString("lastAlertState") ?: "NONE"

            transaction.update(
                invRef,
                mapOf(
                    "quantity" to resultingQty,
                    "status" to newStatus.name,
                    "lastAlertState" to nextAlertState,
                    "updatedAt" to Instant.now().toString()
                )
            )

            val txMap = hashMapOf(
                "id" to txId,
                "idempotencyKey" to "restock_${branchId}_${itemId}_${System.currentTimeMillis()}",
                "businessId" to businessId,
                "branchId" to branchId,
                "itemId" to itemId,
                "partNumber" to partNumber,
                "itemName" to itemName,
                "type" to "RESTOCK",
                "quantityChange" to quantityReceived,
                "previousQuantity" to currentQty,
                "resultingQuantity" to resultingQty,
                "notes" to notes,
                "userId" to user.uid,
                "userEmail" to (user.email ?: ""),
                "timestamp" to Instant.now().toString()
            )
            transaction.set(txRef, txMap)

            StockTransaction(
                id = txId,
                businessId = businessId,
                branchId = branchId,
                itemId = itemId,
                partNumber = partNumber,
                itemName = itemName,
                type = TransactionType.RESTOCK,
                quantityChange = quantityReceived,
                previousQuantity = currentQty,
                resultingQuantity = resultingQty,
                notes = notes,
                userId = user.uid,
                userEmail = user.email ?: "",
                timestamp = Instant.now().toString()
            )
        }.await()
    }
}
