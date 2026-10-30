import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'persistent_numbers_data';

export default function AddNewScreen({ onBack }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('সতর্কতা', 'নাম এবং নম্বর উভয়ই পূরণ করুন!');
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
        name: name.trim(),
        number: phone.trim(),
        createdAt: new Date().toLocaleDateString()
      };

      list.unshift(newItem);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));

      Alert.alert('সফল', 'নতুন ডেটা সফলভাবে সংরক্ষিত হয়েছে!');
      setName('');
      setPhone('');
    } catch (error) {
      Alert.alert('ত্রুটি', 'ডেটা সংরক্ষণ করতে সমস্যা হয়েছে।');
      console.log('Save error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add New Person</Text>

      <TextInput
        style={styles.input}
        placeholder="ব্যক্তির নাম লিখুন..."
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={styles.input}
        placeholder="নম্বর লিখুন (যেমন: 017...)"
        value={phone}
        onChangeText={setPhone}
        keyboardType="numeric"
      />

      <TouchableOpacity style={styles.btn} onPress={handleSave}>
        <Text style={styles.btnText}>সংরক্ষণ করুন</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.backBtn]} onPress={onBack}>
        <Text style={styles.btnText}>ফিরে যান</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#f8f9fa' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#333' },
  input: { height: 48, borderWidth: 1, borderColor: '#ced4da', borderRadius: 8, paddingHorizontal: 15, backgroundColor: '#fff', fontSize: 16, marginBottom: 15 },
  btn: { backgroundColor: '#28a745', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  backBtn: { backgroundColor: '#6c757d' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});