import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Alert, ScrollView, NativeModules } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { GalleryModule } = NativeModules;

// পারসন লিস্ট ফাইলের সাথে একই স্টোরেজ কী (key) ব্যবহার করা হয়েছে
const STORAGE_KEY = 'persistent_numbers_data';

// ইংরেজি সংখ্যাকে বাংলা সংখ্যায় রূপান্তর (বয়স দেখানোর জন্য)
const toBengaliDigits = (value) =>
  String(value).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);

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
  // সেভ চলাকালীন বারবার চাপ দেওয়া ঠেকানোর জন্য
  const [isSaving, setIsSaving] = useState(false);

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
          // কার্ডে দেখানো নতুন তথ্যসমূহ
          fatherName: cardData.fatherName || '',
          motherName: cardData.motherName || '',
          gender: cardData.gender || '',
          occupation: cardData.occupation || '',
          age: cardData.age === undefined || cardData.age === null ? '' : cardData.age,
          ageText: cardData.ageText || '',
          ward: cardData.ward || '',
          socialStatus: cardData.socialStatus || '',
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
    if (isSaving) return;

    if (!uniqueCode) {
      Alert.alert('অপেক্ষা করুন', 'কার্ডের কিউআর কোড তৈরি হচ্ছে, একটু পরে আবার চেষ্টা করুন।');
      return;
    }

    setIsSaving(true);
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
    } finally {
      if (isMountedRef.current) setIsSaving(false);
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

  // বয়স: সংরক্ষিত পুরো লেখা (বছর, মাস, দিন) থাকলে সেটি, না থাকলে শুধু বছর
  const ageDisplay =
    cardData.ageText ||
    (cardData.age !== undefined && cardData.age !== null && cardData.age !== ''
      ? `${toBengaliDigits(cardData.age)} বছর`
      : '');

  // কার্ডের মাঝখানের আটটি তথ্য (উপর থেকে নিচে), প্রতিটি এক লাইনে "লেবেল: মান" আকারে
  const middleFields = [
    ['নাম', cardData.name],
    ['পিতার নাম', cardData.fatherName],
    ['মাতার নাম', cardData.motherName],
    ['এনআইডি', cardData.nid],
    ['লিঙ্গ', cardData.gender],
    ['পেশা', cardData.occupation],
    ['মোবাইল', cardData.phone],
    ['বয়স', ageDisplay],
  ];

  const saveDisabled = !uniqueCode || isSaving;

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

        {/* কার্ডের মাঝখানে ব্যাকগ্রাউন্ড হিসেবে un.png (drawable/un.png) */}
        <View style={styles.watermarkContainer} pointerEvents="none">
          <Image
            source={{ uri: 'un' }}
            style={styles.cardBgImage}
            resizeMode="contain"
          />
        </View>

        {/* কার্ডের বাম পাশের উপরে ছোট করে gov.png (drawable/gov.png) */}
        <Image
          source={{ uri: 'gov' }}
          style={styles.govLogo}
          resizeMode="contain"
        />

        {/* কার্ডের মূল বডি */}
        <View style={styles.cardBody}>
          {/* বাম পাশ: ছবি, তার নিচে গ্রাম, ওয়ার্ড নং, থানা ও জেলা */}
          <View style={styles.cardLeftSection}>
            {cardData.image ? (
              <Image source={{ uri: cardData.image }} style={styles.cardUserImage} resizeMode="cover" />
            ) : (
              <View style={[styles.cardUserImage, { backgroundColor: '#ccc' }]} />
            )}
            <Text style={styles.cardAddressText}>গ্রাম: {cardData.village}</Text>
            <Text style={styles.cardAddressText}>ওয়ার্ড নং: {cardData.ward}</Text>
            <Text style={styles.cardAddressText}>থানা: {cardData.upazila}</Text>
            <Text style={styles.cardAddressText}>জেলা: {cardData.district}</Text>
            {cardData.socialStatus ? (
              <Text style={styles.cardStatusText}>{cardData.socialStatus}</Text>
            ) : null}
          </View>

          {/* মাঝের অংশ: নাম, পিতার নাম, মাতার নাম, এনআইডি, লিঙ্গ, পেশা, মোবাইল ও বয়স */}
          <View style={styles.cardMiddleSection}>
            {middleFields.map(([label, value]) => (
              <Text
                key={label}
                style={styles.fieldLine}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                <Text style={styles.fieldLabel}>{label}: </Text>
                <Text style={styles.fieldValue}>{value}</Text>
              </Text>
            ))}
          </View>

          {/* ডান পাশ: বড় কিউআর কোড (ভেতরে ইউনিক সংখ্যা) */}
          <View style={styles.cardRightSection}>
            {uniqueCode ? (
              <>
                <QRCode value={uniqueCode} size={84} />
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
        style={[styles.saveBtn, saveDisabled && { opacity: 0.6 }]}
        onPress={saveCardToGallery}
        disabled={saveDisabled}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image source={{ uri: 'downloadicon' }} style={styles.btnIconStyle} />
          <Text style={styles.btnText}>
            {isSaving ? 'সেভ হচ্ছে...' : 'গ্যালারিতে সেভ করুন'}
          </Text>
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
  cardBgImage: { width: '80%', height: '100%', opacity: 0.25 },
  govLogo: { position: 'absolute', top: 6, left: 6, width: 26, height: 26, zIndex: 2 },
  cardLeftSection: { width: '30%', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#eee', paddingRight: 6, paddingTop: 18 },
  cardUserImage: { width: 60, height: 60, borderRadius: 2, borderWidth: 1, borderColor: '#ccc', marginBottom: 5 },
  cardAddressText: { fontSize: 11, color: '#222', textAlign: 'center', marginTop: 2 },
  cardStatusText: { fontSize: 11, fontWeight: 'bold', color: '#1A365D', textAlign: 'center', marginTop: 4 },
  cardMiddleSection: { width: '39%', paddingLeft: 6, paddingRight: 2 },
  fieldLine: { fontSize: 13, marginVertical: 3 },
  fieldLabel: { color: '#555', fontWeight: 'normal' },
  fieldValue: { color: '#000', fontWeight: 'bold' },
  cardRightSection: { width: '31%', alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: '#eee', paddingLeft: 6 },
  qrCodeText: { fontSize: 10, color: '#333', marginTop: 4, letterSpacing: 0.5, textAlign: 'center' },
  qrPlaceholder: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  qrPlaceholderText: { fontSize: 18, color: '#999' },

  btn: { backgroundColor: '#28a745', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8, alignItems: 'center', marginTop: 10, width: '100%' },
  saveBtn: { backgroundColor: '#007bff', paddingVertical: 14, paddingHorizontal: 30, borderRadius: 8, alignItems: 'center', width: '100%', marginBottom: 10, elevation: 3 },
  backBtn: { backgroundColor: '#6c757d', marginBottom: 30 },
  btnIconStyle: { width: 20, height: 20, marginRight: 10, tintColor: '#fff' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
