import React, { useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Alert, ScrollView, NativeModules } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import Svg, { Path, Circle } from 'react-native-svg'; // এসভিজি ব্যবহারের জন্য ইমপোর্ট করা হলো

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
        
        {/* ব্যাকগ্রাউন্ডে অফিশিয়াল লোগো ওয়াটারমার্ক (SVG ফরম্যাটে নিখুঁত রেন্ডারিং) */}
        <View style={styles.watermarkContainer} pointerEvents="none">
          <Svg height="160" width="160" viewBox="0 0 200 200" style={{ opacity: 0.12 }}>
            {/* Outer Green Circle */}
            <Circle cx="100" cy="100" r="90" stroke="#006a4e" strokeWidth="3" fill="none" />

            {/* Inner Water Waves */}
            <Path fill="#006a4e" d="M50,140 Q75,130 100,140 Q125,150 150,140 Q150,155 100,165 Q50,155 50,140 Z" />
            <Path fill="#006a4e" d="M55,148 Q75,140 100,148 Q125,156 145,148 Q145,160 100,170 Q55,160 55,148 Z" />

            {/* Central Water Lily / Shapla Petals */}
            <Path fill="none" stroke="#006a4e" strokeWidth="2" d="M100,60 L105,115 L100,135 L95,115 Z" />
            <Path fill="none" stroke="#006a4e" strokeWidth="1.5" d="M100,75 L125,95 L115,120 L100,125 Z" />
            <Path fill="none" stroke="#006a4e" strokeWidth="1.5" d="M100,75 L75,95 L85,120 L100,125 Z" />
            <Path fill="none" stroke="#006a4e" strokeWidth="1.2" d="M100,85 L145,105 L130,125 L100,130 Z" />
            <Path fill="none" stroke="#006a4e" strokeWidth="1.2" d="M100,85 L55,105 L70,125 L100,130 Z" />

            {/* Paddy Sheaves (Wreath) */}
            <Path fill="#006a4e" stroke="#006a4e" strokeWidth="2" d="M40,120 Q30,90 45,60 Q50,50 60,40" />
            <Path fill="#006a4e" stroke="#006a4e" strokeWidth="2" d="M160,120 Q170,90 155,60 Q150,50 140,40" />

            {/* Top Stars */}
            <Path fill="#006a4e" d="M70,45 L72,50 L77,50 L73,53 L75,58 L70,55 L65,58 L67,53 L63,50 L68,50 Z" />
            <Path fill="#006a4e" d="M90,38 L92,43 L97,43 L93,46 L95,51 L90,48 L85,51 L87,46 L83,43 L88,43 Z" />
            <Path fill="#006a4e" d="M110,38 L112,43 L117,43 L113,46 L115,51 L110,48 L105,51 L107,46 L103,43 L108,43 Z" />
            <Path fill="#006a4e" d="M130,45 L132,50 L137,50 L133,53 L135,58 L130,55 L125,58 L127,53 L123,50 L128,50 Z" />
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
