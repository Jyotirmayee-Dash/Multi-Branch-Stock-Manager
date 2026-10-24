package com.stockpulse.app.model

enum class StockStatus {
    IN_STOCK,
    LOW_STOCK,
    OUT_OF_STOCK
}

enum class UserRole {
    OWNER,
    MANAGER,
    STAFF
}

enum class TransactionType {
    SALE,
    RESTOCK,
    ADJUSTMENT,
    REVERSAL
}

data class Business(
    val id: String = "",
    val name: String = "",
    val ownerId: String = "",
    val createdAt: String = "",
    val updatedAt: String = ""
)

data class Branch(
    val id: String = "",
    val businessId: String = "",
    val name: String = "",
    val code: String = "",
    val location: String = "",
    val phone: String = "",
    val createdAt: String = "",
    val updatedAt: String = ""
)

data class UserProfile(
    val id: String = "",
    val businessId: String = "",
    val email: String = "",
    val displayName: String = "",
    val role: UserRole = UserRole.STAFF,
    val assignedBranchIds: List<String> = emptyList(),
    val createdAt: String = "",
    val updatedAt: String = ""
)

data class CatalogItem(
    val id: String = "",
    val businessId: String = "",
    val partNumber: String = "",
    val name: String = "",
    val description: String = "",
    val category: String = "",
    val unitPrice: Double = 0.0,
    val status: String = "active", // "active" | "archived"
    val createdAt: String = "",
    val updatedAt: String = ""
)

data class BranchInventory(
    val id: String = "",
    val businessId: String = "",
    val branchId: String = "",
    val itemId: String = "",
    val partNumber: String = "",
    val itemName: String = "",
    val quantity: Int = 0,
    val minQuantity: Int = 0,
    val restockTarget: Int = 0,
    val status: StockStatus = StockStatus.IN_STOCK,
    val lastAlertState: String = "NONE",
    val lastAlertAt: String = "",
    val updatedAt: String = ""
)

data class StockTransaction(
    val id: String = "",
    val idempotencyKey: String = "",
    val businessId: String = "",
    val branchId: String = "",
    val itemId: String = "",
    val partNumber: String = "",
    val itemName: String = "",
    val type: TransactionType = TransactionType.SALE,
    val quantityChange: Int = 0,
    val previousQuantity: Int = 0,
    val resultingQuantity: Int = 0,
    val reason: String = "",
    val notes: String = "",
    val userId: String = "",
    val userEmail: String = "",
    val timestamp: String = ""
)

data class AlertRecord(
    val id: String = "",
    val businessId: String = "",
    val branchId: String = "",
    val branchName: String = "",
    val itemId: String = "",
    val partNumber: String = "",
    val itemName: String = "",
    val alertType: StockStatus = StockStatus.LOW_STOCK,
    val currentStock: Int = 0,
    val minRequired: Int = 0,
    val message: String = "",
    val acknowledged: Boolean = false,
    val createdAt: String = ""
)
