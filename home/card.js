import React, { useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Alert, ScrollView, NativeModules } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';

// কাস্টম নেটিভ গ্যালারি মডিউল ইমপোর্ট করা
const { GalleryModule } = NativeModules;

export default function CardScreen({ cardData, onBack }) {
  const cardRef = useRef();

  // কাস্টম নেটিভ মডিউল ব্যবহার করে গ্যালারিতে কার্ড সেভ করার ফাংশন
  const saveCardToGallery = async () => {
    try {
      // কার্ডটি ইমেজ হিসেবে ক্যাপচার করা
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1.0,
      });

      // কাস্টম কটলিন নেটিভ মডিউল কল করা
      const savedUri = await GalleryModule.saveImageToGallery(uri);
      
      if (savedUri) {
        Alert.alert('সফল!', 'স্মার্ট কার্ডটি সফলভাবে আপনার গ্যালারিতে সংরক্ষিত হয়েছে!');
      } else {
        Alert.alert('ত্রুটি', 'কার্ডটি গ্যালারিতে সেভ করা সম্ভব হয়নি।');
      }
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('ত্রুটি', 'কার্ডটি সেভ করার সময় একটি সমস্যা হয়েছে।');
    }
  };

  if (!cardData) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>কোনো কার্ডের ডেটা পাওয়া যায়নি!</Text>
        <TouchableOpacity style={styles.btn} onPress={onBack}>
          <Text style={styles.btnText}>ফিরে যান</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.mainTitle}>Digital Smart ID Card</Text>

      {/* ক্যাপচার করার জন্য মূল কার্ড ভিউ */}
      <View ref={cardRef} collapsable={false} style={styles.cardContainer}>
        {/* ব্যাকগ্রাউন্ডে অফিশিয়াল লোগো ওয়াটারমার্ক */}
        <View style={styles.watermarkContainer} pointerEvents="none">
          <Image 
            source={{ uri: 'https://i.ibb.co.com/84p56b3/bd-logo.png' }} 
            style={styles.watermarkImage} 
            resizeMode="contain"
          />
        </View>

        {/* কার্ডের মূল বডি */}
        <View style={styles.cardBody}>
          {/* বাম পাশ: ছবি ও ঠিকানা */}
          <View style={styles.cardLeftSection}>
            {cardData.image ? (
              <Image source={{ uri: cardData.image }} style={styles.cardUserImage} />
            ) : (
              <View style={[styles.cardUserImage, { backgroundColor: '#ccc' }]} />
            )}
            <Text style={styles.cardAddressText}>{cardData.district}</Text>
            <Text style={styles.cardAddressText}>{cardData.upazila}</Text>
            <Text style={styles.cardAddressText}>গ্রাম: {cardData.village}</Text>
          </View>

          {/* মাঝের অংশ: নাম, এনআইডি, মোবাইল ও তারিখ */}
          <View style={styles.cardMiddleSection}>
            <Text style={styles.fieldLabel}>নাম</Text>
            <Text style={styles.fieldValue} numberOfLines={1}>{cardData.name}</Text>

            <Text style={styles.fieldLabel}>জাতীয় পরিচয়পত্র নম্বর</Text>
            <Text style={styles.fieldValue}>{cardData.nid}</Text>

            <Text style={styles.fieldLabel}>মোবাইল নম্বর</Text>
            <Text style={styles.fieldValue}>{cardData.phone}</Text>

            <Text style={styles.fieldLabel}>তারিখ</Text>
            <Text style={styles.fieldValue}>{cardData.createdAt}</Text>
          </View>

          {/* ডান পাশ: বড় কিউআর কোড */}
          <View style={styles.cardRightSection}>
            <QRCode value={cardData.nid || 'smart-card'} size={105} />
          </View>
        </View>
      </View>

      {/* গ্যালারিতে সেভ করার বাটন */}
      <TouchableOpacity style={styles.saveBtn} onPress={saveCardToGallery}>
        <Text style={styles.btnText}>📥 গ্যালারিতে সেভ করুন</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.backBtn]} onPress={onBack}>
        <Text style={styles.btnText}>ফিরে যান</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 15, backgroundColor: '#f8f9fa', alignItems: 'center', paddingTop: 40 },
  mainTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#1A365D' },
  errorText: { fontSize: 16, color: 'red', marginBottom: 20 },
  
  /* প্রফেশনাল আইডি কার্ড প্রিভিউ স্টাইল ও ওয়াটারমার্ক */
  cardContainer: { width: '100%', backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#1A365D', borderRadius: 10, padding: 14, marginTop: 15, marginBottom: 20, elevation: 5, position: 'relative', overflow: 'hidden' },
  watermarkContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 0 },
  watermarkImage: { width: 160, height: 160, opacity: 0.1 },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 },
  cardLeftSection: { width: '27%', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#eee', paddingRight: 6 },
  cardUserImage: { width: 68, height: 85, borderRadius: 4, borderWidth: 1, borderColor: '#ccc', marginBottom: 6 },
  cardAddressText: { fontSize: 10, color: '#333', textAlign: 'center' },
  cardMiddleSection: { width: '37%', paddingLeft: 8, paddingRight: 6 },
  fieldLabel: { fontSize: 9, color: '#666', marginTop: 3 },
  fieldValue: { fontSize: 12, fontWeight: 'bold', color: '#000' },
  cardRightSection: { width: '36%', alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: '#eee', paddingLeft: 6 },

  btn: { backgroundColor: '#28a745', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8, alignItems: 'center', marginTop: 10, width: '100%' },
  saveBtn: { backgroundColor: '#007bff', paddingVertical: 14, paddingHorizontal: 30, borderRadius: 8, alignItems: 'center', width: '100%', marginBottom: 10, elevation: 3 },
  backBtn: { backgroundColor: '#6c757d', marginBottom: 30 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
