import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, Image, ScrollView, Keyboard, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'smart_cards_data';

export default function AddNewScreen({ onNext, onBack }) {
  const [image, setImage] = useState(null);
  const [name, setName] = useState('');
  const [nid, setNid] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [upazila, setUpazila] = useState('');
  const [district, setDistrict] = useState('');

  // কিবোর্ডের উচ্চতা, যাতে কিবোর্ড খোলা থাকলেও নিচের ঘরগুলো স্ক্রল করে দেখা যায়
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef(null);
  const lowerFieldFocusedRef = useRef(false);

  // স্ক্রল একদম নিচে নেওয়ার ফাংশন (একটু দেরিতে, যাতে নিচের ফাঁকা জায়গা আগে তৈরি হয়ে যায়)
  const scrollToBottomSoon = () => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollToEnd({ animated: true });
      }
    }, 250);
  };

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates ? e.endCoordinates.height : 0);
      // উপজেলা বা জেলার ঘরে থাকলে কিবোর্ড আসার পর নিচে স্ক্রল হবে
      if (lowerFieldFocusedRef.current) {
        scrollToBottomSoon();
      }
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // নিচের দিকের ঘরে (উপজেলা/জেলা) ফোকাস করলে স্ক্রল করে ঘরটি কিবোর্ডের উপরে আনা
  const handleLowerFieldFocus = () => {
    lowerFieldFocusedRef.current = true;
    scrollToBottomSoon();
  };

  const handleLowerFieldBlur = () => {
    lowerFieldFocusedRef.current = false;
  };

  // ছবি পিক করার ফাংশন
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  // ডেটা সেভ এবং নেক্সট স্ক্রিনে যাওয়ার ফাংশন
  const handleNext = async () => {
    if (!name.trim() || !nid.trim() || !phone.trim() || !village.trim() || !upazila.trim() || !district.trim()) {
      Alert.alert('সতর্কতা', 'দয়া করে সবগুলো ঘর সঠিকভাবে পূরণ করুন!');
      return;
    }

    try {
      const existingData = await AsyncStorage.getItem(STORAGE_KEY);
      let list = existingData ? JSON.parse(existingData) : [];

      if (list.length >= 2000) {
        Alert.alert('লিমিট পূর্ণ', 'সর্বোচ্চ ২০০০টি ডেটার সীমা পূর্ণ হয়ে গেছে!');
        return;
      }

      const newItem = {
        id: Date.now().toString(),
        image,
        name: name.trim(),
        nid: nid.trim(),
        phone: phone.trim(),
        village: village.trim(),
        upazila: upazila.trim(),
        district: district.trim(),
        createdAt: new Date().toLocaleDateString()
      };

      list.unshift(newItem);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));

      // সফলভাবে সেভ হওয়ার পর card.js (onNext) এ ডেটা পাঠিয়ে দেওয়া
      if (onNext) {
        onNext(newItem);
      }
    } catch (error) {
      Alert.alert('ত্রুটি', 'ডেটা সংরক্ষণ করতে সমস্যা হয়েছে।');
    }
  };

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={[styles.container, { paddingBottom: 15 + keyboardHeight }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.mainTitle}>Smart Card Register</Text>

      {/* ফটো আপলোড অপশন */}
      <View style={styles.imageContainer}>
        <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
          {image ? (
            <Image source={{ uri: image }} style={styles.previewImage} />
          ) : (
            <Text style={styles.imagePickerText}>📷 ছবি আপলোড করুন</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ইনপুট ফিল্ডসমূহ */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Name (নাম):</Text>
        <TextInput
          style={styles.input}
          placeholder="ব্যক্তির নাম লিখুন..."
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>NID Card No. (এনআইডি নম্বর):</Text>
        <TextInput
          style={styles.input}
          placeholder="এনআইডি কার্ড নম্বর লিখুন..."
          placeholderTextColor="#999"
          value={nid}
          onChangeText={setNid}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Phone Number (ফোন নম্বর):</Text>
        <TextInput
          style={styles.input}
          placeholder="ফোন নম্বর লিখুন..."
          placeholderTextColor="#999"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Village (গ্রাম):</Text>
        <TextInput
          style={styles.input}
          placeholder="গ্রামের নাম লিখুন..."
          placeholderTextColor="#999"
          value={village}
          onChangeText={setVillage}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Upazila (উপজেলা):</Text>
        <TextInput
          style={styles.input}
          placeholder="উপজেলার নাম লিখুন..."
          placeholderTextColor="#999"
          value={upazila}
          onChangeText={setUpazila}
          onFocus={handleLowerFieldFocus}
          onBlur={handleLowerFieldBlur}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>District (জেলা):</Text>
        <TextInput
          style={styles.input}
          placeholder="জেলার নাম লিখুন..."
          placeholderTextColor="#999"
          value={district}
          onChangeText={setDistrict}
          onFocus={handleLowerFieldFocus}
          onBlur={handleLowerFieldBlur}
        />
      </View>

      {/* নেক্সট বাটন */}
      <TouchableOpacity style={styles.btn} onPress={handleNext}>
        <Text style={styles.btnText}>নেক্সট (কার্ড দেখুন)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.backBtn]} onPress={onBack}>
        <Text style={styles.btnText}>ফিরে যান</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 15, backgroundColor: '#f8f9fa', paddingTop: 40 },
  mainTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#1A365D' },
  imageContainer: { alignItems: 'center', marginBottom: 20 },
  imagePickerBtn: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#e9ecef', borderWidth: 2, borderColor: '#007bff', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%' },
  imagePickerText: { fontSize: 12, textAlign: 'center', color: '#007bff', fontWeight: 'bold' },
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  input: { height: 48, borderWidth: 1, borderColor: '#ced4da', borderRadius: 8, paddingHorizontal: 15, backgroundColor: '#fff', fontSize: 16, color: '#000' },
  btn: { backgroundColor: '#28a745', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 10, marginBottom: 10 },
  backBtn: { backgroundColor: '#6c757d', marginBottom: 30 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
