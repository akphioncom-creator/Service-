package com.smartservice.app

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.ConcurrentHashMap

/**
 * কার্ড সেভের অগ্রগতি নোটিফিকেশনে দেখায় (ডাউনলোডের মতো প্রগ্রেস বার)।
 * কোনো থার্ড পার্টি লাইব্রেরি লাগে না: শুধু Android-এর নিজস্ব Notification API।
 *
 * JS থেকে ব্যবহার: NativeModules.SaveNotification (সরাসরি নয়, saveNotification.js ফাইলের মাধ্যমে)
 */
class SaveNotificationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val CHANNEL_PROGRESS = "card_save_progress"
        private const val CHANNEL_RESULT = "card_save_result"
    }

    // প্রতিটি নোটিফিকেশনের শিরোনাম মনে রাখা, যাতে আপডেটের সময় শুধু লেখা ও শতাংশ পাঠালেই হয়
    private val titles = ConcurrentHashMap<Int, String>()

    override fun getName(): String = "SaveNotification"

    private val ctx: Context
        get() = reactContext.applicationContext

    // নোটিফিকেশন চ্যানেল তৈরি (Android 8+ এর জন্য বাধ্যতামূলক)
    private fun ensureChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (nm.getNotificationChannel(CHANNEL_PROGRESS) == null) {
            // কম গুরুত্ব: সেভ চলার সময় কোনো শব্দ/ভাইব্রেশন হবে না, শুধু প্রগ্রেস বার দেখা যাবে
            val progress = NotificationChannel(
                CHANNEL_PROGRESS,
                "কার্ড সেভের অগ্রগতি",
                NotificationManager.IMPORTANCE_LOW
            )
            progress.description = "কার্ড গ্যালারিতে সেভ হওয়ার অগ্রগতি দেখায়"
            progress.setShowBadge(false)
            nm.createNotificationChannel(progress)
        }

        if (nm.getNotificationChannel(CHANNEL_RESULT) == null) {
            // সেভ শেষ বা ব্যর্থ হলে সাধারণ গুরুত্বের নোটিফিকেশন
            val result = NotificationChannel(
                CHANNEL_RESULT,
                "কার্ড সেভের ফলাফল",
                NotificationManager.IMPORTANCE_DEFAULT
            )
            result.description = "কার্ড সেভ সম্পন্ন বা ব্যর্থ হলে জানায়"
            nm.createNotificationChannel(result)
        }
    }

    // নোটিফিকেশন বন্ধ থাকলে (বা Android 13+ এ অনুমতি না দিলে) false ফেরত দেয়, অ্যাপ ক্র্যাশ করে না
    @SuppressLint("MissingPermission")
    private fun post(id: Int, notification: Notification): Boolean {
        return try {
            val manager = NotificationManagerCompat.from(ctx)
            if (!manager.areNotificationsEnabled()) return false
            manager.notify(id, notification)
            true
        } catch (e: SecurityException) {
            false
        } catch (e: Exception) {
            false
        }
    }

    // নোটিফিকেশনে চাপ দিলে কী খুলবে: সেভ হওয়া ছবি (content:// হলে) অথবা অ্যাপ
    private fun contentIntent(id: Int, uriString: String?): PendingIntent? {
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)

        val intent: Intent? =
            if (!uriString.isNullOrEmpty() && uriString.startsWith("content://")) {
                Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(Uri.parse(uriString), "image/*")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            } else {
                ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
            }

        return intent?.let { PendingIntent.getActivity(ctx, id, it, flags) }
    }

    private fun progressNotification(id: Int, title: String, text: String, percent: Int): Notification {
        val builder = NotificationCompat.Builder(ctx, CHANNEL_PROGRESS)
            .setSmallIcon(android.R.drawable.stat_sys_download) // ডাউনলোডের মতো তীর আইকন
            .setContentTitle(title)
            .setContentText(text)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            .setProgress(100, percent.coerceIn(0, 100), false)
        contentIntent(id, null)?.let { builder.setContentIntent(it) }
        return builder.build()
    }

    /**
     * সেভ শুরুর নোটিফিকেশন। নোটিফিকেশন সত্যিই দেখানো গেলে true, না গেলে false ফেরত দেয়
     * (false হলে JS আগের মতো অ্যালার্টে ফলাফল জানায়)।
     */
    @ReactMethod
    fun start(id: Int, title: String, text: String, percent: Int, promise: Promise) {
        try {
            ensureChannels()
            titles[id] = title
            promise.resolve(post(id, progressNotification(id, title, text, percent)))
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    /** অগ্রগতি আপডেট (লেখা ও শতাংশ) */
    @ReactMethod
    fun update(id: Int, text: String, percent: Int) {
        try {
            val title = titles[id] ?: "স্মার্ট কার্ড সেভ হচ্ছে"
            post(id, progressNotification(id, title, text, percent))
        } catch (e: Exception) {
            // নোটিফিকেশনের ত্রুটিতে সেভ থামানো যাবে না
        }
    }

    /** সেভ সম্পন্ন: প্রগ্রেস বার সরে গিয়ে "ডাউনলোড সম্পন্ন" আইকন বসে, চাপলে ছবি খোলে */
    @ReactMethod
    fun complete(id: Int, title: String, text: String, uri: String?) {
        try {
            ensureChannels()
            titles.remove(id)
            val builder = NotificationCompat.Builder(ctx, CHANNEL_RESULT)
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setContentTitle(title)
                .setContentText(text)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setOngoing(false)
                .setAutoCancel(true)
                .setProgress(0, 0, false)
            contentIntent(id, uri)?.let { builder.setContentIntent(it) }
            post(id, builder.build())
        } catch (e: Exception) {
            // নোটিফিকেশনের ত্রুটিতে কিছু করার নেই
        }
    }

    /** সেভ ব্যর্থ: প্রগ্রেস বার সরে গিয়ে ত্রুটির আইকন ও বার্তা বসে */
    @ReactMethod
    fun fail(id: Int, title: String, text: String) {
        try {
            ensureChannels()
            titles.remove(id)
            val builder = NotificationCompat.Builder(ctx, CHANNEL_RESULT)
                .setSmallIcon(android.R.drawable.stat_notify_error)
                .setContentTitle(title)
                .setContentText(text)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setOngoing(false)
                .setAutoCancel(true)
                .setProgress(0, 0, false)
            contentIntent(id, null)?.let { builder.setContentIntent(it) }
            post(id, builder.build())
        } catch (e: Exception) {
            // নোটিফিকেশনের ত্রুটিতে কিছু করার নেই
        }
    }
}
