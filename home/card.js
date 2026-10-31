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
      <Text style={styles.mainTitle}>Digital Smart ID Card</Text>

      {/* ক্যাপচার করার জন্য মূল কার্ড ভিউ */}
      <View ref={cardRef} collapsable={false} style={styles.cardContainer}>
        
        {/* ব্যাকগ্রাউন্ডে আপনার দেওয়া মূল লোগো ওয়াটারমার্ক (অপাসিটি বাড়িয়ে স্পষ্ট ও ভাসমান করা হয়েছে) */}
        <View style={styles.watermarkContainer} pointerEvents="none">
          <Svg height="170" width="170" viewBox="0 0 200 200" style={{ opacity: 0.22 }}>
            {/* ১. বাইরের গোল বৃত্ত */}
            <Circle cx="100" cy="100" r="92" stroke="#006a4e" strokeWidth="3.5" fill="none" />
            <Circle cx="100" cy="100" r="88" stroke="#006a4e" strokeWidth="1" fill="none" />

            {/* ২. নিচের পানির ঢেউ (Wave lines) */}
            <Path fill="#006a4e" d="M42,142 Q70,132 100,142 Q130,152 158,142 Q158,154 100,166 Q42,154 42,142 Z" />
            <Path fill="#006a4e" d="M48,150 Q74,142 100,150 Q126,158 152,150 Q152,162 100,172 Q48,162 48,150 Z" />

            {/* ৩. শাপলা ফুল (মাঝের পাপড়ি ও চারপাশের পাপড়িসমূহ) */}
            <Path fill="none" stroke="#006a4e" strokeWidth="2.5" d="M100,50 L103,115 L100,142 L97,115 Z" />
            <Path fill="none" stroke="#006a4e" strokeWidth="1.8" d="M100,68 L126,92 L116,124 L100,132 Z" />
            <Path fill="none" stroke="#006a4e" strokeWidth="1.8" d="M100,68 L74,92 L84,124 L100,132 Z" />
            <Path fill="none" stroke="#006a4e" strokeWidth="1.5" d="M100,82 L150,102 L136,128 L100,135 Z" />
            <Path fill="none" stroke="#006a4e" strokeWidth="1.5" d="M100,82 L50,102 L64,128 L100,135 Z" />

            {/* ৪. দুই পাশের ধানের শীষের মালা (Wreath) */}
            <Path fill="none" stroke="#006a4e" strokeWidth="2" d="M35,125 Q22,85 45,52" />
            <Path fill="none" stroke="#006a4e" strokeWidth="2" d="M165,125 Q178,85 155,52" />

            {/* ৫. উপরে পাটপাতা ও ৪টি তারকা */}
            {/* পাটপাতা */}
            <Path fill="#006a4e" d="M100,22 Q95,32 100,42 Q105,32 100,22 Z" />
            <Path fill="none" stroke="#006a4e" strokeWidth="1.2" d="M100,25 Q90,20 84,28 M100,25 Q110,20 116,28 M100,31 Q92,27 88,34 M100,31 Q108,27 112,34" />

            {/* ৪টি তারকা */}
            <Path fill="#006a4e" d="M68,46 L70,51 L75,51 L71,54 L73,59 L68,56 L63,59 L65,54 L61,51 L66,51 Z" />
            <Path fill="#006a4e" d="M86,39 L88,44 L93,44 L89,47 L91,52 L86,49 L81,52 L83,47 L79,44 L84,44 Z" />
            <Path fill="#006a4e" d="M114,39 L116,44 L121,44 L117,47 L119,52 L114,49 L109,52 L111,47 L107,44 L112,44 Z" />
            <Path fill="#006a4e" d="M132,46 L134,51 L139,51 L135,54 L137,59 L132,56 L127,59 L129,54 L125,51 L130,51 Z" />
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
