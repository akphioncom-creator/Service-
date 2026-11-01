import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ScrollView, Image, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';

const STORAGE_KEY = 'smart_cards_data';
const { GalleryModule } = NativeModules;

export default function CreatingCardScreen({ onBack }) {
  const [cardsList, setCardsList] = useState([]);
  const cardRefs = useRef({});

  // AsyncStorage থেকে সকল কার্ডের ডেটা লোড করা
  useEffect(() => {
    loadSavedCards();
  }, []);

  const loadSavedCards = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        setCardsList(JSON.parse(data));
      }
    } catch (error) {
      console.error('Error loading cards:', error);
      Alert.alert('ত্রুটি', 'সংরক্ষিত কার্ডের ডেটা লোড করতে সমস্যা হয়েছে।');
    }
  };

  // নির্দিষ্ট কার্ড গ্যালারিতে সেভ করার ফাংশন
  const saveSingleCardToGallery = async (cardId) => {
    try {
      const ref = cardRefs.current[cardId];
      if (!ref) {
        Alert.alert('ত্রুটি', 'কার্ড রেফারেন্স পাওয়া যায়নি!');
        return;
      }

      const uri = await captureRef(ref, {
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

  // ৩ ধাপের সতর্কবার্তা: তিন ধাপ পার হলে তবেই onConfirm চলবে
  const threeStepConfirm = ({ step1, step2, step3, onConfirm }) => {
    Alert.alert('সতর্কতা (১/৩)', step1, [
      { text: 'বাতিল', style: 'cancel' },
      {
        text: 'এগিয়ে যান',
        onPress: () =>
          Alert.alert('সতর্কতা (২/৩)', step2, [
            { text: 'বাতিল', style: 'cancel' },
            {
              text: 'হ্যাঁ, নিশ্চিত',
              onPress: () =>
                Alert.alert('চূড়ান্ত সতর্কতা (৩/৩)', step3, [
                  { text: 'বাতিল', style: 'cancel' },
                  { text: 'মুছে ফেলুন', style: 'destructive', onPress: onConfirm },
                ]),
            },
          ]),
      },
    ]);
  };

  // নির্দিষ্ট একটি কার্ড মুছে ফেলা
  const deleteCard = async (item) => {
    try {
      const newList = cardsList.filter((card) => card.id !== item.id);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newList));

      delete cardRefs.current[item.id];
      setCardsList(newList);
    } catch (error) {
      console.error('Delete error:', error);
      Alert.alert('ত্রুটি', 'কার্ডটি মুছে ফেলার সময় একটি সমস্যা হয়েছে।');
    }
  };

  // সবগুলো কার্ড একসাথে মুছে ফেলা
  const deleteAllCards = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));

      cardRefs.current = {};
      setCardsList([]);
    } catch (error) {
      console.error('Delete all error:', error);
      Alert.alert('ত্রুটি', 'সবগুলো কার্ড মুছে ফেলার সময় একটি সমস্যা হয়েছে।');
    }
  };

  // একটি কার্ড ডিলিটের জন্য ৩ ধাপের সতর্কবার্তা
  const confirmDeleteCard = (item) => {
    threeStepConfirm({
      step1: `আপনি কি "${item.name || ''}" এর কার্ডটি মুছে ফেলতে চান?`,
      step2: 'এই কাজ ফেরানো যাবে না। কার্ডের সব তথ্য মুছে যাবে। আপনি কি নিশ্চিত?',
      step3: 'এটিই শেষ ধাপ। "মুছে ফেলুন" চাপলে এখনই কার্ডটি মুছে যাবে।',
      onConfirm: () => deleteCard(item),
    });
  };

  // সব কার্ড ডিলিটের জন্য ৩ ধাপের সতর্কবার্তা
  const confirmDeleteAll = () => {
    if (cardsList.length === 0) {
      Alert.alert('ডিলিট', 'মুছে ফেলার মতো কোনো কার্ড নেই।');
      return;
    }

    threeStepConfirm({
      step1: `আপনি কি সবগুলো কার্ড (${cardsList.length}টি) মুছে ফেলতে চান?`,
      step2: 'এই কাজ ফেরানো যাবে না। সবগুলো কার্ডের সব তথ্য মুছে যাবে। আপনি কি নিশ্চিত?',
      step3: `এটিই শেষ ধাপ। "মুছে ফেলুন" চাপলে এখনই সবগুলো কার্ড (${cardsList.length}টি) মুছে যাবে।`,
      onConfirm: deleteAllCards,
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* হেডার: কাস্টম back_icon এবং টাইটেল */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.topBackBtn} onPress={onBack}>
          <Image source={{ uri: 'back_icon' }} style={styles.iconStyle} />
        </TouchableOpacity>
        <Text style={styles.title}>All Registered Cards ({cardsList.length})</Text>
      </View>

      {/* সব কার্ড ডিলিট করার অপশন (deleteicon.xml) */}
      {cardsList.length > 0 && (
        <TouchableOpacity style={styles.deleteAllBtn} onPress={confirmDeleteAll}>
          <Image source={{ uri: 'deleteicon' }} style={styles.btnIconStyle} />
          <Text style={styles.saveBtnText}>সব কার্ড ডিলিট করুন</Text>
        </TouchableOpacity>
      )}

      {cardsList.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>কোনো কার্ডের ডেটা পাওয়া যায়নি!</Text>
        </View>
      ) : (
        cardsList.map((item) => (
          <View key={item.id} style={styles.cardWrapper}>
            {/* ক্যাপচার করার জন্য মূল কার্ড প্রিভিউ */}
            <View 
              ref={(el) => (cardRefs.current[item.id] = el)} 
              collapsable={false} 
              style={styles.cardContainer}
            >
              {/* ব্যাকগ্রাউন্ডে অফিশিয়াল লোগো ওয়াটারমার্ক */}
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
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.cardUserImage} />
                  ) : (
                    <View style={[styles.cardUserImage, { backgroundColor: '#ccc' }]} />
                  )}
                  <Text style={styles.cardAddressText}>{item.district}</Text>
                  <Text style={styles.cardAddressText}>{item.upazila}</Text>
                  <Text style={styles.cardAddressText}>গ্রাম: {item.village}</Text>
                </View>

                {/* মাঝের অংশ: নাম, এনআইডি, মোবাইল ও তারিখ */}
                <View style={styles.cardMiddleSection}>
                  <Text style={styles.fieldLabel}>নাম</Text>
                  <Text style={styles.fieldValue} numberOfLines={1}>{item.name}</Text>

                  <Text style={styles.fieldLabel}>জাতীয় পরিচয়পত্র নম্বর</Text>
                  <Text style={styles.fieldValue}>{item.nid}</Text>

                  <Text style={styles.fieldLabel}>মোবাইল নম্বর</Text>
                  <Text style={styles.fieldValue}>{item.phone}</Text>

                  <Text style={styles.fieldLabel}>তারিখ</Text>
                  <Text style={styles.fieldValue}>{item.createdAt}</Text>
                </View>

                {/* ডান পাশ: বড় কিউআর কোড */}
                <View style={styles.cardRightSection}>
                  <QRCode value={item.nid || 'smart-card'} size={85} />
                </View>
              </View>
            </View>

            {/* প্রতিটি কার্ডের জন্য পৃথক সেভ বাটন (add_photo আইকন সহ) ও ডিলিট বাটন (deleteicon) */}
            <View style={styles.actionRow}>
              <TouchableOpacity 
                style={styles.saveBtn} 
                onPress={() => saveSingleCardToGallery(item.id)}
              >
                <Image source={{ uri: 'add_photo' }} style={styles.btnIconStyle} />
                <Text style={styles.saveBtnText}>এই কার্ডটি গ্যালারিতে সেভ করুন</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => confirmDeleteCard(item)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Image source={{ uri: 'deleteicon' }} style={styles.deleteIconStyle} />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 15, backgroundColor: '#f8f9fa', paddingTop: 30 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  topBackBtn: { padding: 6, backgroundColor: '#e9ecef', borderRadius: 6, marginRight: 15, justifyContent: 'center', alignItems: 'center' },
  iconStyle: { width: 22, height: 22, tintColor: '#1A365D' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1A365D', flex: 1 },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { fontSize: 16, color: '#666' },

  /* সব কার্ড ডিলিট বাটন */
  deleteAllBtn: { flexDirection: 'row', backgroundColor: '#dc3545', paddingVertical: 10, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginBottom: 20, elevation: 2 },

  cardWrapper: { marginBottom: 25 },

  /* প্রফেশনাল আইডি কার্ড প্রিভিউ স্টাইল ও ওয়াটারমার্ক */
  cardContainer: { width: '100%', backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#1A365D', borderRadius: 10, padding: 12, elevation: 4, position: 'relative', overflow: 'hidden' },
  watermarkContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 0 },
  watermarkImage: { width: 140, height: 140, opacity: 0.1 },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 },
  cardLeftSection: { width: '27%', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#eee', paddingRight: 6 },
  cardUserImage: { width: 60, height: 75, borderRadius: 4, borderWidth: 1, borderColor: '#ccc', marginBottom: 4 },
  cardAddressText: { fontSize: 9, color: '#333', textAlign: 'center' },
  cardMiddleSection: { width: '37%', paddingLeft: 6, paddingRight: 6 },
  fieldLabel: { fontSize: 8, color: '#666', marginTop: 2 },
  fieldValue: { fontSize: 11, fontWeight: 'bold', color: '#000' },
  cardRightSection: { width: '36%', alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: '#eee', paddingLeft: 6 },

  actionRow: { flexDirection: 'row', alignItems: 'stretch', marginTop: 8 },
  saveBtn: { flex: 1, flexDirection: 'row', backgroundColor: '#007bff', paddingVertical: 10, borderRadius: 6, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  deleteBtn: { width: 48, marginLeft: 8, backgroundColor: '#dc3545', borderRadius: 6, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  deleteIconStyle: { width: 22, height: 22, tintColor: '#fff' },
  btnIconStyle: { width: 18, height: 18, marginRight: 8, tintColor: '#fff' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' }
});
