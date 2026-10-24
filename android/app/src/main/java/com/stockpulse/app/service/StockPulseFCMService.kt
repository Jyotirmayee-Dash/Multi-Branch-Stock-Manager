package com.stockpulse.app.service

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.stockpulse.app.MainActivity
import com.stockpulse.app.StockPulseApplication

class StockPulseFCMService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        uploadDeviceToken(token)
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val title = remoteMessage.notification?.title ?: remoteMessage.data["title"] ?: "Stock Alert"
        val body = remoteMessage.notification?.body ?: remoteMessage.data["body"] ?: "Inventory status changed"
        val branchId = remoteMessage.data["branchId"] ?: ""
        val itemId = remoteMessage.data["itemId"] ?: ""

        sendNotification(title, body, branchId, itemId)
    }

    private fun sendNotification(title: String, body: String, branchId: String, itemId: String) {
        val intent = Intent(this, MainActivity::class.java).apply {
            action = "com.stockpulse.app.OPEN_ITEM"
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("EXTRA_BRANCH_ID", branchId)
            putExtra("EXTRA_ITEM_ID", itemId)
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val pendingIntent = PendingIntent.getActivity(this, System.currentTimeMillis().toInt(), intent, flags)

        val notificationBuilder = NotificationCompat.Builder(this, StockPulseApplication.STOCK_ALERTS_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(System.currentTimeMillis().toInt(), notificationBuilder.build())
    }

    private fun uploadDeviceToken(token: String) {
        val user = FirebaseAuth.getInstance().currentUser ?: return
        val db = FirebaseFirestore.getInstance()

        val tokenData = hashMapOf(
            "userId" to user.uid,
            "token" to token,
            "platform" to "android",
            "deviceModel" to "${Build.MANUFACTURER} ${Build.MODEL}",
            "updatedAt" to java.time.Instant.now().toString()
        )

        db.collection("device_tokens")
            .document(token.take(64))
            .set(tokenData)
            .addOnSuccessListener {
                // Token registered
            }
    }
}
