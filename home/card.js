import React, { useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Alert, ScrollView, NativeModules } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import Svg, { Path, Circle } from 'react-native-svg';

const { GalleryModule } = NativeModules;

export default function CardScreen({ cardData, onBack }) {
  const cardRef = useRef();

  const saveCardToGallery = async () => {
    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1.0,
      });

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
      {/* হেডার উইথ ব্যাক আইকন (back_icon.xml) */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.topBackBtn} onPress={onBack}>
          <Image source={{ uri: 'back_icon' }} style={styles.headerIconStyle} />
        </TouchableOpacity>
        <Text style={styles.mainTitle}>Digital Smart ID Card</Text>
      </View>

      {/* ক্যাপচার করার জন্য মূল কার্ড ভিউ */}
      <View ref={cardRef} collapsable={false} style={styles.cardContainer}>
        
        {/* ব্যাকগ্রাউন্ডে স্পষ্ট কালো ও ছাইরঙা (Black & White/Gray) সিকিউরিটি গ্রাফিক ডিজাইন */}
        <View style={styles.watermarkContainer} pointerEvents="none">
          <Svg height="180" width="300" viewBox="0 0 300 180" style={{ opacity: 0.28 }}>
            {/* ব্যাকগ্রাউন্ড জিওমেট্রিক ওয়েভ এবং লাইন ডিজাইন (গাঢ় কালো ও ছাই রঙে) */}
            <Path fill="none" stroke="#222222" strokeWidth="2" d="M0,20 Q75,80 150,20 T300,20" />
            <Path fill="none" stroke="#555555" strokeWidth="1.8" d="M0,50 Q75,110 150,50 T300,50" />
            <Path fill="none" stroke="#222222" strokeWidth="1.5" d="M0,80 Q75,140 150,80 T300,80" />
            <Path fill="none" stroke="#555555" strokeWidth="1.5" d="M0,110 Q75,170 150,110 T300,110" />
            <Path fill="none" stroke="#222222" strokeWidth="2" d="M0,140 Q75,200 150,140 T300,140" />

            {/* সাইড সিকিউরিটি সার্কেল ও ডেকোরেটিভ এলিমেন্ট */}
            <Circle cx="150" cy="90" r="65" stroke="#222222" strokeWidth="1.2" strokeDasharray="5,5" fill="none" />
            <Circle cx="150" cy="90" r="50" stroke="#555555" strokeWidth="1.2" fill="none" />
          </Svg>
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

      {/* গ্যালারিতে সেভ করার বাটন (downloadicon.xml সহ) */}
      <TouchableOpacity style={styles.saveBtn} onPress={saveCardToGallery}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image source={{ uri: 'downloadicon' }} style={styles.btnIconStyle} />
          <Text style={styles.btnText}>গ্যালারিতে সেভ করুন</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.backBtn]} onPress={onBack}>
        <Text style={styles.btnText}>ফিরে যান</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 15, backgroundColor: '#f8f9fa', alignItems: 'center', paddingTop: 30 },
  headerRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 10 },
  topBackBtn: { padding: 8, backgroundColor: '#e9ecef', borderRadius: 6, marginRight: 15, justifyContent: 'center', alignItems: 'center' },
  headerIconStyle: { width: 22, height: 22, tintColor: '#1A365D' },
  mainTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A365D' },
  errorText: { fontSize: 16, color: 'red', marginBottom: 20 },

  /* প্রফেশনাল আইডি কার্ড প্রিভিউ স্টাইল ও গ্রাফিক ডিজাইন ব্যাকগ্রাউন্ড */
  cardContainer: { width: '100%', backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#1A365D', borderRadius: 10, padding: 14, marginTop: 10, marginBottom: 20, elevation: 5, position: 'relative', overflow: 'hidden' },
  watermarkContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 0 },
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
  btnIconStyle: { width: 20, height: 20, marginRight: 10, tintColor: '#fff' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
