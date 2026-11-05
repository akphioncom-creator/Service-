import React, { useRef, useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Alert, ScrollView, NativeModules, PixelRatio } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import Svg, { Path, Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { GalleryModule } = NativeModules;

// পারসন লিস্ট ফাইলের সাথে একই স্টোরেজ কী (key) ব্যবহার করা হয়েছে
const STORAGE_KEY = 'persistent_numbers_data';

// গ্যালারিতে সেভ হওয়া কার্ড ছবির প্রস্থ (পিক্সেলে): ৩৮৪০ = 4K (UHD)
const EXPORT_WIDTH_PX = 3840;

// ইংরেজি সংখ্যাকে বাংলা সংখ্যায় রূপান্তর (বয়স দেখানোর জন্য)
const toBengaliDigits = (value) =>
  String(value).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);

// কার্ড তৈরির তারিখকে বাংলা সংখ্যায় দিন/মাস/বছর (যেমন ০৫/১১/২০২৬) আকারে সাজায়
const formatCreatedDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return toBengaliDigits(value);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return toBengaliDigits(`${dd}/${mm}/${d.getFullYear()}`);
};

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

// ছবির চারপাশে ধোঁয়াশা: কোনো প্যাকেজ ছাড়াই, একটার ভেতর একটা সাদা ফ্রেম (রিং) বসানো হয়েছে।
// বাইরের রিং প্রায় পুরো সাদা, ভেতরের দিকে ক্রমশ স্বচ্ছ — ফলে ছবির কিনারা কার্ডের সাদা ব্যাকগ্রাউন্ডে মিশে যায়
const HAZE_RINGS = 9;
const renderPhotoHaze = (s) => {
  const step = 1 * s;
  const outerRadius = 9 * s;
  const rings = [];
  for (let i = 0; i < HAZE_RINGS; i++) {
    const t = i / (HAZE_RINGS - 1); // ০ (বাইরে) থেকে ১ (ভেতরে)
    const alpha = Math.pow(1 - t, 1.6) * 0.97; // মসৃণভাবে কমে আসা স্বচ্ছতা
    rings.push(
      <View
        key={i}
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: i * step,
          left: i * step,
          right: i * step,
          bottom: i * step,
          borderWidth: step,
          borderRadius: Math.max(outerRadius - i * step, 0),
          borderColor: `rgba(255,255,255,${alpha.toFixed(3)})`,
        }}
      />
    );
  }
  return rings;
};

// লেখার কিনারা দিয়ে খুব হালকা সাদা আভা (হ্যালো): পেছনের লোগোর উপরেও অক্ষর স্পষ্ট থাকে, অথচ চোখে আলাদা করে ধরা পড়ে না
// আভা বাড়াতে চাইলে HALO_RADIUS বাড়ান, কমাতে চাইলে কমান
const HALO_RADIUS = 4;
const makeHalo = (s) => ({
  textShadowColor: '#ffffff',
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: HALO_RADIUS * s,
});

// কার্ডের স্টাইল: s = স্কেল (১ = স্ক্রিনে দেখানো কার্ড, বড় সংখ্যা = 4K সেভের জন্য অদৃশ্য কার্ড)
// সব মাপ একই অনুপাতে বাড়ে, তাই কার্ডের ডিজাইন ও লেআউট হুবহু একই থাকে
const makeCardStyles = (s, hiRes) =>
  StyleSheet.create({
    /* প্রফেশনাল আইডি কার্ড প্রিভিউ স্টাইল ও গ্রাফিক ডিজাইন ব্যাকগ্রাউন্ড */
    cardContainer: { width: '100%', backgroundColor: '#ffffff', borderWidth: 1.5 * s, borderColor: '#1A365D', borderRadius: 10 * s, padding: 14 * s, marginTop: 10 * s, marginBottom: 20 * s, elevation: hiRes ? 0 : 5, position: 'relative', overflow: 'hidden' },
    watermarkContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 0 },
    cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 3 },
    backingLayer: { zIndex: 1 },
    logoLayer: { zIndex: 2 },
    cardBgCircle: { height: '100%', aspectRatio: 1, borderRadius: 100000, backgroundColor: '#ffffff' },
    cardBgImage: { width: '80%', height: '100%', opacity: 0.5 },
    govLogo: { position: 'absolute', top: 3 * s, left: 3 * s, width: 24 * s, height: 24 * s, zIndex: 4 },
    cardLeftSection: { width: '30%', alignItems: 'center', borderRightWidth: 1 * s, borderRightColor: '#eee', paddingRight: 6 * s },
    // ছবির চারপাশে ধোঁয়াশা (ফেদার) ইফেক্টের জন্য ছবির মোড়ক ও ছবি
    userPhotoWrap: { width: 52 * s, height: 52 * s, borderRadius: 9 * s, overflow: 'hidden', marginTop: 12 * s, marginBottom: 5 * s, backgroundColor: '#ffffff' },
    userPhotoFill: { width: '100%', height: '100%' },
    cardAddressText: { fontSize: 11 * s, color: '#222', textAlign: 'center', marginTop: 2 * s, ...makeHalo(s) },
    cardStatusText: { fontSize: 11 * s, fontWeight: 'bold', color: '#1A365D', textAlign: 'center', marginTop: 4 * s, ...makeHalo(s) },
    cardMiddleSection: { width: '39%', paddingLeft: 6 * s, paddingRight: 2 * s },
    fieldLine: { fontSize: 13 * s, marginVertical: 3 * s, ...makeHalo(s) },
    fieldLabel: { color: '#555', fontWeight: 'normal' },
    fieldValue: { color: '#000', fontWeight: 'bold' },
    cardRightSection: { width: '31%', alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1 * s, borderLeftColor: '#eee', paddingLeft: 6 * s },
    createdDateText: { fontSize: 10 * s, color: '#333', marginBottom: 4 * s, textAlign: 'center', ...makeHalo(s) },
    qrCodeText: { fontSize: 10 * s, color: '#333', marginTop: 4 * s, letterSpacing: 0.5 * s, textAlign: 'center', ...makeHalo(s) },
    qrPlaceholder: { width: 84 * s, height: 84 * s, alignItems: 'center', justifyContent: 'center' },
    qrPlaceholderText: { fontSize: 18 * s, color: '#999' },
  });

export default function CardScreen({ cardData, onBack }) {
  const cardRef = useRef();
  // 4K সেভের জন্য স্ক্রিনের বাইরে রাখা বড় আকারের কার্ড
  const hiResCardRef = useRef();
  const initDoneRef = useRef(false);
  const isMountedRef = useRef(true);

  // স্টোরেজ থেকে পড়া অ্যাসিঙ্ক্রোনাস, তাই কোড তৈরি হওয়ার আগ পর্যন্ত এটি null থাকবে
  const [uniqueCode, setUniqueCode] = useState(null);
  // সেভ চলাকালীন বারবার চাপ দেওয়া ঠেকানোর জন্য
  const [isSaving, setIsSaving] = useState(false);
  // স্ক্রিনে দেখানো কার্ডের প্রস্থ (dp) — এখান থেকেই 4K এর স্কেল বের হয়
  const [cardWidth, setCardWidth] = useState(0);
  // কার্ড তৈরির তারিখ: প্রথমবার খোলার সময় অটোমেটিক বসে, পরে একই তারিখ থাকে
  const [createdAt, setCreatedAt] = useState(null);

  // স্ক্রিনে দেখানো কার্ডের স্টাইল (স্কেল ১)
  const cardStyles = useMemo(() => makeCardStyles(1, false), []);

  // 4K কার্ডের স্কেল: (৩৮৪০ পিক্সেল) ÷ (কার্ডের প্রস্থ × স্ক্রিনের ডেনসিটি)
  const exportScale = cardWidth > 0 ? EXPORT_WIDTH_PX / (cardWidth * PixelRatio.get()) : 0;
  const hiResStyles = useMemo(
    () => (exportScale > 0 ? makeCardStyles(exportScale, true) : null),
    [exportScale]
  );

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

        // তারিখ: কার্ডের ডেটায় থাকলে সেটা, না থাকলে আগের সেভ করা তারিখ, তা-ও না থাকলে আজকের তারিখ (অটোমেটিক)
        const previous = records.find((r) => String(r.uniqueCode) === String(code));
        const createdAtValue =
          cardData.createdAt || (previous && previous.createdAt) || new Date().toISOString();

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
          createdAt: createdAtValue,
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

        if (isMountedRef.current) {
          setCreatedAt(createdAtValue);
          setUniqueCode(code);
        }
      } catch (error) {
        console.error('Storage save error:', error);
        Alert.alert('ত্রুটি', 'কার্ডের তথ্য সংরক্ষণ করার সময় একটি সমস্যা হয়েছে।');
      }
    };

    initCard();
  }, [cardData]);

  // 4K (৩৮৪০ পিক্সেল চওড়া) ছবি তৈরি: স্ক্রিনের বাইরের বড় কার্ডটি ক্যাপচার করা হয়,
  // ফলে লেখা, লোগো, ব্যাকগ্রাউন্ড ও কিউআর কোড সব আসল রেজোলিউশনে রেন্ডার হয় (ছোট ছবি টেনে বড় করা হয় না)
  const captureHighRes = async () => {
    if (!hiResCardRef.current || !hiResStyles) {
      throw new Error('High resolution card is not ready');
    }
    // বড় কার্ডের লেআউট ও ছবি পুরোপুরি আঁকা হওয়ার জন্য অল্প অপেক্ষা
    await new Promise((resolve) => setTimeout(resolve, 250));
    return captureRef(hiResCardRef, {
      format: 'png',
      quality: 1.0,
    });
  };

  const saveCardToGallery = async () => {
    if (isSaving) return;

    if (!uniqueCode) {
      Alert.alert('অপেক্ষা করুন', 'কার্ডের কিউআর কোড তৈরি হচ্ছে, একটু পরে আবার চেষ্টা করুন।');
      return;
    }

    setIsSaving(true);
    try {
      let uri;
      try {
        uri = await captureHighRes();
      } catch (hiResError) {
        // কোনো কারণে 4K তৈরি না হলে (যেমন মেমোরি কম) আগের মতো সাধারণ কোয়ালিটিতে সেভ হবে
        console.warn('4K capture failed, falling back to normal capture:', hiResError);
        uri = await captureRef(cardRef, {
          format: 'png',
          quality: 1.0,
        });
      }

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

  // কার্ডের পুরো ডিজাইন একটি ফাংশনে রাখা হয়েছে, যাতে স্ক্রিনের কার্ড এবং 4K কার্ড দুটোই হুবহু একই ডিজাইনে তৈরি হয়
  // s = স্কেল, cs = সেই স্কেলের স্টাইল, width = (শুধু 4K কার্ডের জন্য) নির্দিষ্ট প্রস্থ
  const renderCard = ({ s, cs, width, innerRef, onLayout }) => (
    <View
      ref={innerRef}
      collapsable={false}
      onLayout={onLayout}
      style={[cs.cardContainer, width ? { width } : null]}
    >

      {/* ব্যাকগ্রাউন্ডে স্পষ্ট কালো ও ছাইরঙা (Black & White/Gray) সিকিউরিটি গ্রাফিক ডিজাইন */}
      <View style={cs.watermarkContainer} pointerEvents="none">
        <Svg height={180 * s} width={300 * s} viewBox="0 0 300 180" style={{ opacity: 0.28 }}>
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

      {/* un ছবি যতটুকু জায়গা জুড়ে থাকবে, ততটুকু জায়গার গ্রাফিক ডিজাইন ঢেকে দেওয়ার জন্য কার্ডের মতো সাদা গোলাকার ব্যাকিং (যাতে ডিজাইন ও un ছবি মিলে উল্টাপাল্টা না হয়) */}
      <View style={[cs.watermarkContainer, cs.backingLayer]} pointerEvents="none">
        <View style={cs.cardBgCircle} />
      </View>

      {/* গ্রাফিক ডিজাইনের উপরে (লেয়ার ২), কার্ডের মাঝখানে un.png (drawable/un.png) */}
      <View style={[cs.watermarkContainer, cs.logoLayer]} pointerEvents="none">
        <Image
          source={{ uri: 'un' }}
          style={cs.cardBgImage}
          resizeMode="contain"
        />
      </View>

      {/* কার্ডের বাম পাশের উপরে ছোট করে gov.png (drawable/gov.png) */}
      <Image
        source={{ uri: 'gov' }}
        style={cs.govLogo}
        resizeMode="contain"
        resizeMethod="resize"
        fadeDuration={0}
      />

      {/* কার্ডের মূল বডি */}
      <View style={cs.cardBody}>
        {/* বাম পাশ: ছবি, তার নিচে গ্রাম, ওয়ার্ড নং, থানা ও জেলা */}
        <View style={cs.cardLeftSection}>
          {/* ছবির চারপাশে ধোঁয়াশা/ফেদার ইফেক্ট: ছবির উপরে ক্রমশ স্বচ্ছ সাদা রিং */}
          <View style={cs.userPhotoWrap}>
            {cardData.image ? (
              <Image source={{ uri: cardData.image }} style={cs.userPhotoFill} resizeMode="cover" />
            ) : (
              <View style={[cs.userPhotoFill, { backgroundColor: '#ccc' }]} />
            )}
            {renderPhotoHaze(s)}
          </View>
          <Text style={cs.cardAddressText}>গ্রাম: {cardData.village}</Text>
          <Text style={cs.cardAddressText}>ওয়ার্ড নং: {cardData.ward}</Text>
          <Text style={cs.cardAddressText}>থানা: {cardData.upazila}</Text>
          <Text style={cs.cardAddressText}>জেলা: {cardData.district}</Text>
          {cardData.socialStatus ? (
            <Text style={cs.cardStatusText}>{cardData.socialStatus}</Text>
          ) : null}
        </View>

        {/* মাঝের অংশ: নাম, পিতার নাম, মাতার নাম, এনআইডি, লিঙ্গ, পেশা, মোবাইল ও বয়স */}
        <View style={cs.cardMiddleSection}>
          {middleFields.map(([label, value]) => (
            <Text
              key={label}
              style={cs.fieldLine}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              <Text style={cs.fieldLabel}>{label}: </Text>
              <Text style={cs.fieldValue}>{value}</Text>
            </Text>
          ))}
        </View>

        {/* ডান পাশ: বড় কিউআর কোড (ভেতরে ইউনিক সংখ্যা) */}
        <View style={cs.cardRightSection}>
          {uniqueCode ? (
            <>
              <Text style={cs.createdDateText}>তারিখ: {formatCreatedDate(createdAt)}</Text>
              <QRCode value={uniqueCode} size={84 * s} />
              <Text style={cs.qrCodeText}>{uniqueCode}</Text>
            </>
          ) : (
            <View style={cs.qrPlaceholder}>
              <Text style={cs.qrPlaceholderText}>...</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* হেডার উইথ ব্যাক আইকন (back_icon.xml) */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.topBackBtn} onPress={onBack}>
            <Image source={{ uri: 'back_icon' }} style={styles.headerIconStyle} />
          </TouchableOpacity>
          <Text style={styles.mainTitle}>Digital Smart ID Card</Text>
        </View>

        {/* স্ক্রিনে দেখানো মূল কার্ড ভিউ (4K সেভ ব্যর্থ হলে এটিই ক্যাপচার হবে) */}
        {renderCard({
          s: 1,
          cs: cardStyles,
          width: null,
          innerRef: cardRef,
          onLayout: (e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && Math.abs(w - cardWidth) > 0.5) setCardWidth(w);
          },
        })}

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

      {/* 4K সেভের জন্য স্ক্রিনের বাইরে রাখা অদৃশ্য বড় কার্ড (একই ডিজাইন, শুধু বড় মাপে) */}
      {hiResStyles ? (
        <View
          style={styles.offscreen}
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
        >
          {renderCard({
            s: exportScale,
            cs: hiResStyles,
            width: cardWidth * exportScale,
            innerRef: hiResCardRef,
            onLayout: undefined,
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  offscreen: { position: 'absolute', top: 0, left: -20000 },
  container: { flexGrow: 1, padding: 15, backgroundColor: '#f8f9fa', alignItems: 'center', paddingTop: 30 },
  headerRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 10 },
  topBackBtn: { padding: 8, backgroundColor: '#e9ecef', borderRadius: 6, marginRight: 15, justifyContent: 'center', alignItems: 'center' },
  headerIconStyle: { width: 22, height: 22, tintColor: '#1A365D' },
  mainTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A365D' },
  errorText: { fontSize: 16, color: 'red', marginBottom: 20 },

  btn: { backgroundColor: '#28a745', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8, alignItems: 'center', marginTop: 10, width: '100%' },
  saveBtn: { backgroundColor: '#007bff', paddingVertical: 14, paddingHorizontal: 30, borderRadius: 8, alignItems: 'center', width: '100%', marginBottom: 10, elevation: 3 },
  backBtn: { backgroundColor: '#6c757d', marginBottom: 30 },
  btnIconStyle: { width: 20, height: 20, marginRight: 10, tintColor: '#fff' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});