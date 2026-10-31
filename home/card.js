import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Alert, ScrollView, NativeModules } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import Svg, { Path, Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { GalleryModule } = NativeModules;

// পারসন লিস্ট ফাইলের সাথে একই স্টোরেজ কী (key) ব্যবহার করা হয়েছে
const STORAGE_KEY = 'persistent_numbers_data';

// স্টোরেজ থেকে সব সংরক্ষিত কার্ডের তালিকা পড়ার ফাংশন
const readAllRecords = async () => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Storage read error:', error);
    return [];
  }
};

// এমন একটি ইউনিক সংখ্যা তৈরি করে যা আগের কোনো কার্ডে নেই (১২ ডিজিট)
const generateUniqueCode = (records) => {
  const usedCodes = new Set(records.map((r) => String(r.uniqueCode)));

  for (let i = 0; i < 100; i++) {
    const code = String(Math.floor(100000000000 + Math.random() * 900000000000));
    if (!usedCodes.has(code)) return code;
  }

  // খুব বিরল ক্ষেত্রে (১০০ বার মিলে গেলে) সময়-ভিত্তিক সংখ্যা ব্যবহার হবে
  let fallback = Date.now();
  while (usedCodes.has(String(fallback))) {
    fallback += 1;
  }
  return String(fallback);
};

// এই কার্ডের জন্য ইউনিক কোড বের করা:
// ১) কার্ডের ডেটায় আগে থেকে কোড থাকলে সেটাই ব্যবহার হবে
// ২) একই এনআইডি-র কার্ড আগে তৈরি হয়ে থাকলে তার কোডই ব্যবহার হবে (যাতে একই কার্ড বারবার খুললে কোড না বদলায়)
// ৩) কোনোটিই না থাকলে নতুন ইউনিক কোড তৈরি হবে
const resolveUniqueCode = (cardData, records) => {
  if (cardData.uniqueCode) return String(cardData.uniqueCode);

  if (cardData.nid) {
    const existing = records.find(
      (r) => r.uniqueCode && String(r.nid) === String(cardData.nid)
    );
    if (existing) return String(existing.uniqueCode);
  }

  return generateUniqueCode(records);
};

export default function CardScreen({ cardData, onBack }) {
  const cardRef = useRef();
  const initDoneRef = useRef(false);
  const isMountedRef = useRef(true);

  // স্টোরেজ থেকে পড়া অ্যাসিঙ্ক্রোনাস, তাই কোড তৈরি হওয়ার আগ পর্যন্ত এটি null থাকবে
  const [uniqueCode, setUniqueCode] = useState(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // কার্ড খোলার সময় একবারই কোড নির্ধারণ হবে এবং কার্ডের সকল তথ্য + ইউনিক কোড পারসন লিস্টের স্টোরেজে সংরক্ষণ হবে
  useEffect(() => {
    if (!cardData || initDoneRef.current) return;
    initDoneRef.current = true;

    const initCard = async () => {
      try {
        const records = await readAllRecords();
        const code = resolveUniqueCode(cardData, records);

        const record = {
          id: code,
          uniqueCode: code,
          name: cardData.name || '',
          number: cardData.nid || cardData.phone || '',
          nid: cardData.nid || '',
          phone: cardData.phone || '',
          district: cardData.district || '',
          upazila: cardData.upazila || '',
          village: cardData.village || '',
          image: cardData.image || '',
          createdAt: cardData.createdAt || '',
        };

        const index = records.findIndex(
          (r) => String(r.uniqueCode) === String(code)
        );

        if (index >= 0) {
          // আগে থেকে থাকলে তথ্য আপডেট হবে (ডুপ্লিকেট এন্ট্রি হবে না)
          records[index] = { ...records[index], ...record };
        } else {
          records.push(record);
        }

        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));

        if (isMountedRef.current) setUniqueCode(code);
      } catch (error) {
        console.error('Storage save error:', error);
        Alert.alert('ত্রুটি', 'কার্ডের তথ্য সংরক্ষণ করার সময় একটি সমস্যা হয়েছে।');
      }
    };

    initCard();
  }, [cardData]);

  const saveCardToGallery = async () => {
    if (!uniqueCode) {
      Alert.alert('অপেক্ষা করুন', 'কার্ডের কিউআর কোড তৈরি হচ্ছে, একটু পরে আবার চেষ্টা করুন।');
      return;
    }

    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1.0,
      });

      const savedUri = await GalleryModule.saveImageToGallery(uri);

      if (savedUri) {
        Alert.alert('সফল!', 'স্মার্ট কার্ডটি সফলভাবে আপনার গ্যালারিতে সংরক্ষিত হয়েছে!');
      } else {
        Alert.alert('ত্রুটি', 'কার্ডটি গ্যালারিতে সেভ করা সম্ভব হয়নি।');
      }
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('ত্রুটি', 'কার্ডটি সেভ করার সময় একটি সমস্যা হয়েছে।');
    }
  };

  if (!cardData) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>কোনো কার্ডের ডেটা পাওয়া যায়নি!</Text>
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
            {/* ব্যাকগ্রাউন্ড জিওমেট্রিক ওয়েভ এবং লাইন ডিজাইন (গাঢ় কালো ও ছাই রঙে) */}
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

          {/* ডান পাশ: বড় কিউআর কোড (ভেতরে ইউনিক সংখ্যা) */}
          <View style={styles.cardRightSection}>
            {uniqueCode ? (
              <>
                <QRCode value={uniqueCode} size={105} />
                <Text style={styles.qrCodeText}>{uniqueCode}</Text>
              </>
            ) : (
              <View style={styles.qrPlaceholder}>
                <Text style={styles.qrPlaceholderText}>...</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* গ্যালারিতে সেভ করার বাটন (downloadicon.xml সহ) */}
      <TouchableOpacity
        style={[styles.saveBtn, !uniqueCode && { opacity: 0.6 }]}
        onPress={saveCardToGallery}
        disabled={!uniqueCode}
      >
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
  qrCodeText: { fontSize: 9, color: '#333', marginTop: 4, letterSpacing: 0.5, textAlign: 'center' },
  qrPlaceholder: { width: 105, height: 105, alignItems: 'center', justifyContent: 'center' },
  qrPlaceholderText: { fontSize: 18, color: '#999' },

  btn: { backgroundColor: '#28a745', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8, alignItems: 'center', marginTop: 10, width: '100%' },
  saveBtn: { backgroundColor: '#007bff', paddingVertical: 14, paddingHorizontal: 30, borderRadius: 8, alignItems: 'center', width: '100%', marginBottom: 10, elevation: 3 },
  backBtn: { backgroundColor: '#6c757d', marginBottom: 30 },
  btnIconStyle: { width: 20, height: 20, marginRight: 10, tintColor: '#fff' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
