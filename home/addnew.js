import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, Image, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'family_cards_data';

export default function AddNewScreen({ onBack }) {
  const [image, setImage] = useState(null);
  const [name, setName] = useState('');
  const [nid, setNid] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [upazila, setUpazila] = useState('');
  const [district, setDistrict] = useState('');
  const [generatedCard, setGeneratedCard] = useState(null);

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

  // ডেটা সেভ এবং ফ্যামিলি কার্ড তৈরির ফাংশন (AsyncStorage ব্যবহার করে)
  const handleSave = async () => {
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

      // ফ্যামিলি কার্ড প্রিভিউ সেট করা
      setGeneratedCard(newItem);
      Alert.alert('সফল', 'ফ্যামিলি কার্ড সফলভাবে তৈরি এবং সংরক্ষিত হয়েছে!');
    } catch (error) {
      Alert.alert('ত্রুটি', 'ডেটা সংরক্ষণ করতে সমস্যা হয়েছে।');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Smart Family Card Register</Text>

      {/* ১. ফটো আপলোড অপশন (সবার উপরে) */}
      <View style={styles.imageContainer}>
        <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
          {image ? (
            <Image source={{ uri: image }} style={styles.previewImage} />
          ) : (
            <Text style={styles.imagePickerText}>📷 ছবি আপলোড করুন</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ২. ইনপুট ফিল্ডসমূহ */}
      <TextInput
        style={styles.input}
        placeholder="Name (নাম)..."
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={styles.input}
        placeholder="NID Card No. (এনআইডি নম্বর)..."
        value={nid}
        onChangeText={setNid}
        keyboardType="numeric"
      />

      <TextInput
        style={styles.input}
        placeholder="Phone Number (ফোন নম্বর)..."
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      <TextInput
        style={styles.input}
        placeholder="Village (গ্রাম)..."
        value={village}
        onChangeText={setVillage}
      />

      <TextInput
        style={styles.input}
        placeholder="Upazila (উপজেলা)..."
        value={upazila}
        onChangeText={setUpazila}
      />

      <TextInput
        style={styles.input}
        placeholder="District (জেলা)..."
        value={district}
        onChangeText={setDistrict}
      />

      <TouchableOpacity style={styles.btn} onPress={handleSave}>
        <Text style={styles.btnText}>ফ্যামিলি কার্ড তৈরি করুন</Text>
      </TouchableOpacity>

      {/* ৩. ফ্যামিলি কার্ড প্রিভিউ সেকশন */}
      {generatedCard && (
        <View style={styles.cardPreviewBox}>
          <Text style={styles.cardTitle}>🌟 Smart Family Card 🌟</Text>
          {generatedCard.image && <Image source={{ uri: generatedCard.image }} style={styles.cardImage} />}
          <Text style={styles.cardText}>নাম: {generatedCard.name}</Text>
          <Text style={styles.cardText}>এনআইডি: {generatedCard.nid}</Text>
          <Text style={styles.cardText}>মোবাইল: {generatedCard.phone}</Text>
          <Text style={styles.cardText}>গ্রাম: {generatedCard.village}, উপজেলা: {generatedCard.upazila}</Text>
          <Text style={styles.cardText}>জেলা: {generatedCard.district}</Text>
        </View>
      )}

      <TouchableOpacity style={[styles.btn, styles.backBtn]} onPress={onBack}>
        <Text style={styles.btnText}>ফিরে যান</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: '#f8f9fa', paddingTop: 40 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#1A365D' },
  imageContainer: { alignItems: 'center', marginBottom: 20 },
  imagePickerBtn: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#e9ecef', borderWidth: 2, borderColor: '#007bff', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%' },
  imagePickerText: { fontSize: 12, textAlign: 'center', color: '#007bff', fontWeight: 'bold' },
  input: { height: 48, borderWidth: 1, borderColor: '#ced4da', borderRadius: 8, paddingHorizontal: 15, backgroundColor: '#fff', fontSize: 16, marginBottom: 15 },
  btn: { backgroundColor: '#28a745', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  backBtn: { backgroundColor: '#6c757d', marginBottom: 30 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cardPreviewBox: { backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#007bff', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 15, elevation: 5 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#007bff', marginBottom: 12 },
  cardImage: { width: 80, height: 80, borderRadius: 40, marginBottom: 12, borderWidth: 1, borderColor: '#ddd' },
  cardText: { fontSize: 14, color: '#333', marginBottom: 5, textAlign: 'center' }
});
