import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert } from 'react-native';

export default function EmailChangeScreen({ onBack }) {
  const [newEmail, setNewEmail] = useState('');

  const handleUpdateEmail = () => {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      Alert.alert('ত্রুটি', 'দয়া করে একটি সঠিক ইমেইল ঠিকানা লিখুন!');
      return;
    }

    Alert.alert('সফল', `ইমেইল সফলভাবে পরিবর্তন করে "${newEmail}" করা হয়েছে!`);
    setNewEmail('');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Email Change Setting</Text>

      <TextInput
        style={styles.input}
        placeholder="নতুন ইমেইল ঠিকানা লিখুন..."
        value={newEmail}
        onChangeText={setNewEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TouchableOpacity style={styles.btn} onPress={handleUpdateEmail}>
        <Text style={styles.btnText}>ইমেইল আপডেট করুন</Text>
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
  btn: { backgroundColor: '#17a2b8', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  backBtn: { backgroundColor: '#6c757d' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
