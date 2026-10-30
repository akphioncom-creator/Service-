import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, Image, ScrollView } from 'react-native';
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

  // ডেটা সেভ এবং নেক্সট স্ক্রিনে যাওয়ার ফাংশন
  const handleNext = async () => {
    if (!name.trim() || !nid.trim() || !phone.trim() || !village.trim() || !upazila.trim() || !district.trim()) {
      Alert.alert('সতর্কতা', 'দয়া করে সবগুলো ঘর সঠিকভাবে পূরণ করুন!');
      return;
    }

    try {
      const existingData = await AsyncStorage.getItem(STORAGE_KEY);
      let list = existingData ? JSON.parse(existingData) : [];

      if (list.length >= 2000) {
        Alert.alert('লিমিট পূর্ণ', 'সর্বোচ্চ ২০০০টি ডেটার সীমা পূর্ণ হয়ে গেছে!');
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

      // সফলভাবে সেভ হওয়ার পর card.js (onNext) এ ডেটা পাঠিয়ে দেওয়া
      if (onNext) {
        onNext(newItem);
      }
    } catch (error) {
      Alert.alert('ত্রুটি', 'ডেটা সংরক্ষণ করতে সমস্যা হয়েছে।');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
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
