package com.stockpulse.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build

class StockPulseApplication : Application() {

    companion object {
        const val STOCK_ALERTS_CHANNEL_ID = "stock_alerts_channel"
        const val CHANNEL_NAME = "Stock Shortage Alerts"
        const val CHANNEL_DESCRIPTION = "Real-time alerts for low stock and out-of-stock items across branches"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(
                STOCK_ALERTS_CHANNEL_ID,
                CHANNEL_NAME,
                importance
            ).apply {
                description = CHANNEL_DESCRIPTION
                enableVibration(true)
                setShowBadge(true)
            }

            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
}
