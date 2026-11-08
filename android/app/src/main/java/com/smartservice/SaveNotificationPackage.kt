package com.smartservice.app
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * SaveNotificationModule-কে React Native-এ নিবন্ধনের প্যাকেজ।
 * MainApplication-এ GalleryPackage-এর পাশে এটিও যোগ করতে হবে:
 *   Kotlin: add(SaveNotificationPackage())
 *   Java:   packages.add(new SaveNotificationPackage());
 */
class SaveNotificationPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(SaveNotificationModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
