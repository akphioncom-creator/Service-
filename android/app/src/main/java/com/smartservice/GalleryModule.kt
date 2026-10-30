package com.smartservice.app

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Environment
import android.provider.MediaStore
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStream

class GalleryModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "GalleryModule"
    }

    @ReactMethod
    fun saveImageToGallery(imagePath: String, promise: Promise) {
        val context: Context = reactApplicationContext
        try {
            val cleanPath = imagePath.replace("file://", "")
            val bitmap = BitmapFactory.decodeFile(cleanPath)

            if (bitmap == null) {
                promise.reject("ERR_BITMAP", "ছবি লোড করা যায়নি!")
                return
            }

            var fos: OutputStream? = null
            var imageUri: Uri? = null
            val filename = "SmartCard_${System.currentTimeMillis()}.png"

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                val resolver = context.contentResolver
                val contentValues = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, filename)
                    put(MediaStore.MediaColumns.MIME_TYPE, "image/png")
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/SmartCards")
                }
                imageUri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues)
                imageUri?.let {
                    fos = resolver.openOutputStream(it)
                }
            } else {
                val imagesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
                val appDir = File(imagesDir, "SmartCards")
                if (!appDir.exists()) {
                    appDir.mkdirs()
                }
                val image = File(appDir, filename)
                fos = FileOutputStream(image)
                imageUri = Uri.fromFile(image)
            }

            fos?.use {
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)
                promise.resolve(imageUri.toString())
            } ?: run {
                promise.reject("ERR_OUTPUT_STREAM", "আউটপুট স্ট্রিম তৈরি করা যায়নি!")
            }

        } catch (e: Exception) {
            promise.reject("ERR_SAVE_IMAGE", e.message, e)
        }
    }
}
