package com.smartservice.app
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SafeAreaModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "SafeAreaModule"
    }

    @ReactMethod
    fun getInsets(promise: Promise) {
        try {
            val resources = reactApplicationContext.resources
            val density = resources.displayMetrics.density

            // স্ট্যাটাস বার (ওপরের বার) এর উচ্চতা মাপা
            var statusBarHeight = 0f
            val statusId = resources.getIdentifier("status_bar_height", "dimen", "android")
            if (statusId > 0) {
                statusBarHeight = resources.getDimensionPixelSize(statusId) / density
            }

            // নেভিগেশন বার (নিচের বাটনগুলো) এর উচ্চতা মাপা
            var navBarHeight = 0f
            val navId = resources.getIdentifier("navigation_bar_height", "dimen", "android")
            if (navId > 0) {
                navBarHeight = resources.getDimensionPixelSize(navId) / density
            }

            // React Native এর জন্য Map তৈরি করা
            val map = Arguments.createMap()
            map.putDouble("top", statusBarHeight.toDouble())
            map.putDouble("bottom", navBarHeight.toDouble())
            map.putDouble("left", 0.0)
            map.putDouble("right", 0.0)

            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("SAFE_AREA_ERROR", e.message)
        }
    }
}
