package com.stockpulse.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.core.content.ContextCompat
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.messaging.FirebaseMessaging
import com.stockpulse.app.model.Branch
import com.stockpulse.app.theme.StockPulseTheme

sealed class Screen(val route: String, val title: String, val icon: ImageVector) {
    object Dashboard : Screen("dashboard", "Dashboard", Icons.Default.Dashboard)
    object Inventory : Screen("inventory", "Inventory", Icons.Default.Inventory2)
    object RecordSale : Screen("record_sale", "Record Sale", Icons.Default.PointOfSale)
    object Alerts : Screen("alerts", "Alerts", Icons.Default.NotificationsActive)
    object Transactions : Screen("transactions", "Transactions", Icons.Default.ReceiptLong)
}

class MainActivity : ComponentActivity() {

    private val requestNotificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { isGranted ->
            if (isGranted) {
                // Permission granted, subscribe to FCM topics
                subscribeToFCM()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        checkNotificationPermission()

        val extraBranchId = intent.getStringExtra("EXTRA_BRANCH_ID")
        val extraItemId = intent.getStringExtra("EXTRA_ITEM_ID")

        setContent {
            StockPulseTheme {
                MainAppScaffold(
                    initialBranchId = extraBranchId,
                    initialItemId = extraItemId
                )
            }
        }
    }

    private fun checkNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                requestNotificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            } else {
                subscribeToFCM()
            }
        } else {
            subscribeToFCM()
        }
    }

    private fun subscribeToFCM() {
        FirebaseMessaging.getInstance().subscribeToTopic("stock_alerts")
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainAppScaffold(
    initialBranchId: String? = null,
    initialItemId: String? = null
) {
    var currentScreen by remember { mutableStateOf<Screen>(Screen.Dashboard) }
    var selectedBranch by remember {
        mutableStateOf(
            Branch(
                id = initialBranchId ?: "branch_central",
                name = "Central Hub & Warehouse",
                code = "CENTRAL-01"
            )
        )
    }

    val sampleBranches = listOf(
        Branch("branch_central", "biz_apex_auto_1", "Central Hub & Warehouse", "CENTRAL-01"),
        Branch("branch_downtown", "biz_apex_auto_1", "Downtown Retail Store", "DOWNTOWN-02"),
        Branch("branch_westside", "biz_apex_auto_1", "Westside Logistics Depot", "WESTSIDE-03")
    )

    var showBranchSelector by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "StockPulse",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text(
                            text = selectedBranch.name,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { showBranchSelector = true }) {
                        Icon(Icons.Default.Storefront, contentDescription = "Switch Branch")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            )
        },
        bottomBar = {
            NavigationBar {
                val screens = listOf(
                    Screen.Dashboard,
                    Screen.Inventory,
                    Screen.RecordSale,
                    Screen.Alerts,
                    Screen.Transactions
                )
                screens.forEach { screen ->
                    NavigationBarItem(
                        icon = { Icon(screen.icon, contentDescription = screen.title) },
                        label = { Text(screen.title) },
                        selected = currentScreen.route == screen.route,
                        onClick = { currentScreen = screen }
                    )
                }
            }
        }
    ) { innerPadding ->
        Box(modifier = Modifier.padding(innerPadding)) {
            when (currentScreen) {
                Screen.Dashboard -> {
                    Text(
                        text = "Dashboard for ${selectedBranch.name}",
                        modifier = Modifier.padding(16.dp),
                        style = MaterialTheme.typography.headlineSmall
                    )
                }
                Screen.Inventory -> {
                    Text(
                        text = "Inventory Catalog & Search",
                        modifier = Modifier.padding(16.dp),
                        style = MaterialTheme.typography.headlineSmall
                    )
                }
                Screen.RecordSale -> {
                    Text(
                        text = "Record Sale at ${selectedBranch.name}",
                        modifier = Modifier.padding(16.dp),
                        style = MaterialTheme.typography.headlineSmall
                    )
                }
                Screen.Alerts -> {
                    Text(
                        text = "Stock Shortage Alerts",
                        modifier = Modifier.padding(16.dp),
                        style = MaterialTheme.typography.headlineSmall
                    )
                }
                Screen.Transactions -> {
                    Text(
                        text = "Audit Ledger",
                        modifier = Modifier.padding(16.dp),
                        style = MaterialTheme.typography.headlineSmall
                    )
                }
            }
        }

        if (showBranchSelector) {
            AlertDialog(
                onDismissRequest = { showBranchSelector = false },
                title = { Text("Select Branch") },
                text = {
                    Column {
                        sampleBranches.forEach { branch ->
                            ListItem(
                                headlineContent = { Text(branch.name) },
                                supportingContent = { Text("Code: ${branch.code}") },
                                leadingContent = {
                                    RadioButton(
                                        selected = selectedBranch.id == branch.id,
                                        onClick = {
                                            selectedBranch = branch
                                            showBranchSelector = false
                                        }
                                    )
                                }
                            )
                        }
                    }
                },
                confirmButton = {
                    TextButton(onClick = { showBranchSelector = false }) {
                        Text("Close")
                    }
                }
            )
        }
    }
}
