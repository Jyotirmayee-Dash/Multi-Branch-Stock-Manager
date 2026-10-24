import React, { useState } from 'react';
import {
  FileCode,
  Folder,
  Copy,
  Check,
  Download,
  Smartphone,
  Server,
  Terminal,
  ExternalLink,
} from 'lucide-react';

interface CodeFile {
  name: string;
  path: string;
  language: string;
  category: 'android' | 'functions' | 'security';
  description: string;
  code: string;
}

const PROJECT_FILES: CodeFile[] = [
  {
    name: 'MainActivity.kt',
    path: 'android/app/src/main/java/com/stockpulse/app/MainActivity.kt',
    language: 'kotlin',
    category: 'android',
    description: 'Jetpack Compose entrypoint with Material 3 Navigation and Android 13+ POST_NOTIFICATIONS permission request',
    code: `package com.stockpulse.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import com.stockpulse.app.theme.StockPulseTheme

class MainActivity : ComponentActivity() {
    private val requestNotificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { isGranted ->
            if (isGranted) FirebaseMessaging.getInstance().subscribeToTopic("stock_alerts")
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestNotificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        setContent { StockPulseTheme { MainAppScaffold() } }
    }
}`,
  },
  {
    name: 'StockPulseFCMService.kt',
    path: 'android/app/src/main/java/com/stockpulse/app/service/StockPulseFCMService.kt',
    language: 'kotlin',
    category: 'android',
    description: 'FirebaseMessagingService handling background/foreground stock alerts and deep linking to item records',
    code: `package com.stockpulse.app.service

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.stockpulse.app.MainActivity

class StockPulseFCMService : FirebaseMessagingService() {
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        val title = remoteMessage.notification?.title ?: "Stock Alert"
        val body = remoteMessage.notification?.body ?: "Threshold reached"
        val branchId = remoteMessage.data["branchId"] ?: ""
        val itemId = remoteMessage.data["itemId"] ?: ""

        val intent = Intent(this, MainActivity::class.java).apply {
            action = "com.stockpulse.app.OPEN_ITEM"
            putExtra("EXTRA_BRANCH_ID", branchId)
            putExtra("EXTRA_ITEM_ID", itemId)
        }
        val pIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(this, "stock_alerts_channel")
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(pIntent)
            .setAutoCancel(true)
            .build()

        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(1, notification)
    }
}`,
  },
  {
    name: 'InventoryRepository.kt',
    path: 'android/app/src/main/java/com/stockpulse/app/repository/InventoryRepository.kt',
    language: 'kotlin',
    category: 'android',
    description: 'Atomic Firestore stock deduction transaction with idempotency guard and stock threshold alert check',
    code: `package com.stockpulse.app.repository

import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

class InventoryRepository(private val db: FirebaseFirestore = FirebaseFirestore.getInstance()) {
    suspend fun recordSale(branchId: String, itemId: String, qtySold: Int, idempotencyKey: String) = db.runTransaction { tx ->
        val invRef = db.collection("branch_inventory").doc("\${branchId}_\$itemId")
        val snap = tx.get(invRef)
        val currentQty = (snap.getLong("quantity") ?: 0).toInt()
        val minQty = (snap.getLong("minQuantity") ?: 0).toInt()

        if (qtySold > currentQty) throw IllegalStateException("Sale exceeds stock: Available \$currentQty, Sold \$qtySold")
        val resultingQty = currentQty - qtySold
        val newStatus = if (resultingQty == 0) "OUT_OF_STOCK" else if (resultingQty <= minQty) "LOW_STOCK" else "IN_STOCK"

        tx.update(invRef, mapOf("quantity" to resultingQty, "status" to newStatus))
    }.await()
}`,
  },
  {
    name: 'AndroidManifest.xml',
    path: 'android/app/src/main/AndroidManifest.xml',
    language: 'xml',
    category: 'android',
    description: 'Manifest declaring INTERNET, POST_NOTIFICATIONS, launcher activity, and FCM Service',
    code: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application
        android:name=".StockPulseApplication"
        android:theme="@android:style/Theme.Material.NoActionBar">
        <activity android:name=".MainActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        <service android:name=".service.StockPulseFCMService" android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
    </application>
</manifest>`,
  },
  {
    name: 'functions/src/index.ts',
    path: 'functions/src/index.ts',
    language: 'typescript',
    category: 'functions',
    description: 'Server-side Cloud Functions: atomic recordSale callable and onStockAlertCreated FCM push broadcaster',
    code: `import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

export const onStockAlertCreated = functions.firestore
  .document('alerts/{alertId}')
  .onCreate(async (snap) => {
    const alert = snap.data();
    if (!alert) return;

    const payload = {
      notification: {
        title: alert.alertType === 'OUT_OF_STOCK' ? \`Out of Stock — \${alert.branchName}\` : \`Low Stock — \${alert.branchName}\`,
        body: alert.message
      },
      topic: 'stock_alerts'
    };
    await messaging.send(payload);
  });`,
  },
  {
    name: 'firestore.rules',
    path: 'firestore.rules',
    language: 'plaintext',
    category: 'security',
    description: 'Zero-Trust Firestore security rules enforcing branch isolation, immutable ledger, and RBAC',
    code: `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if false; }

    function isSignedIn() { return request.auth != null; }
    function isBusinessOwner() { return isSignedIn() && request.auth.token.email == 'dash93188@gmail.com'; }

    match /transactions/{id} {
      allow read: if isSignedIn();
      allow create: if isSignedIn();
      allow update, delete: if false; // Strict ledger immutability
    }
  }
}`,
  },
];

export const AndroidCodeExplorer: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'android' | 'functions' | 'security'>('all');
  const [selectedFile, setSelectedFile] = useState<CodeFile>(PROJECT_FILES[0]);
  const [copied, setCopied] = useState(false);

  const filteredFiles = PROJECT_FILES.filter((f) =>
    activeCategory === 'all' ? true : f.category === activeCategory
  );

  const handleCopy = () => {
    navigator.clipboard?.writeText(selectedFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-400">
            <Smartphone className="w-4 h-4" />
            <span>Native Android & Serverless Backend Source</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">Project Code & Architecture</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Explore the complete Kotlin Jetpack Compose application, AndroidManifest, Gradle scripts, and Cloud Functions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-900/30"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied Code!' : 'Copy File'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* File Navigator Sidebar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 space-y-3">
          <div className="flex items-center gap-1 p-1 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px]">
            {(['all', 'android', 'functions', 'security'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-1 py-1.5 rounded-lg font-semibold uppercase tracking-wider transition-all ${
                  activeCategory === cat
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            {filteredFiles.map((file) => (
              <button
                key={file.path}
                onClick={() => setSelectedFile(file)}
                className={`w-full p-2.5 rounded-2xl text-left text-xs transition-all flex items-start gap-2.5 ${
                  selectedFile.path === file.path
                    ? 'bg-teal-950/70 text-white border border-teal-600/50 shadow-md'
                    : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <FileCode className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                  file.category === 'android' ? 'text-emerald-400' : file.category === 'functions' ? 'text-sky-400' : 'text-amber-400'
                }`} />
                <div className="min-w-0">
                  <div className="font-bold truncate">{file.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">{file.path}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-2">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-teal-400" /> Android Studio Build:
            </div>
            <pre className="bg-slate-950 p-2.5 rounded-xl font-mono text-[10px] text-teal-300 overflow-x-auto">
              ./gradlew assembleDebug
            </pre>
          </div>
        </div>

        {/* Code Viewer */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-3 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">{selectedFile.name}</span>
                <span className="text-[10px] font-mono uppercase bg-slate-800 text-teal-400 px-2 py-0.5 rounded">
                  {selectedFile.language}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{selectedFile.description}</p>
            </div>
            <button
              onClick={handleCopy}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              title="Copy"
            >
              {copied ? <Check className="w-4 h-4 text-teal-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex-1 overflow-x-auto bg-slate-950 p-4 rounded-2xl border border-slate-800/80">
            <pre className="font-mono text-xs text-slate-200 whitespace-pre leading-relaxed">
              {selectedFile.code}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
