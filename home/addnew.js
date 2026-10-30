import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, Image, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'react-native-qrcode-svg';

const STORAGE_KEY = 'smart_cards_data';

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

  // ডেটা সেভ এবং কার্ড তৈরির ফাংশন
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

      // কার্ড প্রিভিউ সেট করা
      setGeneratedCard(newItem);
      Alert.alert('সফল', 'স্মার্ট কার্ড সফলভাবে তৈরি এবং সংরক্ষিত হয়েছে!');
    } catch (error) {
      Alert.alert('ত্রুটি', 'ডেটা সংরক্ষণ করতে সমস্যা হয়েছে।');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.mainTitle}>Smart Card Register</Text>

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

      <TouchableOpacity style={styles.btn} onPress={handleSave}>
        <Text style={styles.btnText}>কার্ড তৈরি করুন</Text>
      </TouchableOpacity>

      {/* ৩. প্রফেশনাল আইডি কার্ড প্রিভিউ ডিজাইন */}
      {generatedCard && (
        <View style={styles.cardContainer}>
          {/* কার্ডের মূল বডি */}
          <View style={styles.cardBody}>
            {/* বাম পাশ: ছবি ও ঠিকানা */}
            <View style={styles.cardLeftSection}>
              {generatedCard.image ? (
                <Image source={{ uri: generatedCard.image }} style={styles.cardUserImage} />
              ) : (
                <View style={[styles.cardUserImage, { backgroundColor: '#ccc' }]} />
              )}
              <Text style={styles.cardAddressText}>{generatedCard.district}</Text>
              <Text style={styles.cardAddressText}>{generatedCard.upazila}</Text>
              <Text style={styles.cardAddressText}>গ্রাম: {generatedCard.village}</Text>
            </View>

            {/* ডান পাশ: নাম, নম্বর, তারিখ ও কিউআর কোড */}
            <View style={styles.cardRightSection}>
              <View>
                <Text style={styles.fieldLabel}>নাম</Text>
                <Text style={styles.fieldValue}>{generatedCard.name}</Text>

                <Text style={styles.fieldLabel}>জাতীয় পরিচয়পত্র নম্বর</Text>
                <Text style={styles.fieldValue}>{generatedCard.nid}</Text>

                <Text style={styles.fieldLabel}>মোবাইল নম্বর</Text>
                <Text style={styles.fieldValue}>{generatedCard.phone}</Text>

                <Text style={styles.fieldLabel}>তারিখ</Text>
                <Text style={styles.fieldValue}>{generatedCard.createdAt}</Text>
              </View>

              {/* কিউআর কোড */}
              <View style={styles.qrCodeWrapper}>
                <QRCode value={generatedCard.nid || 'smart-card'} size={60} />
              </View>
            </View>
          </View>
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
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  
  /* প্রফেশনাল আইডি কার্ড প্রিভিউ স্টাইল */
  cardContainer: { width: '100%', backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#1A365D', borderRadius: 8, padding: 12, marginTop: 15, marginBottom: 15, elevation: 4 },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between' },
  cardLeftSection: { width: '36%', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#eee', paddingRight: 6 },
  cardUserImage: { width: 70, height: 85, borderRadius: 4, borderWidth: 1, borderColor: '#ccc', marginBottom: 4 },
  cardAddressText: { fontSize: 10, color: '#333', textAlign: 'center' },
  cardRightSection: { width: '62%', justifyContent: 'space-between', paddingLeft: 4 },
  fieldLabel: { fontSize: 9, color: '#666', marginTop: 2 },
  fieldValue: { fontSize: 12, fontWeight: 'bold', color: '#000' },
  qrCodeWrapper: { alignSelf: 'flex-end', marginTop: 4 }
});
