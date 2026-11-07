import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert } from 'react-native';

// সেটিং পাতা: এখানে একটি অপশন — "পাসওয়ার্ড চেঞ্জ" (কোনো আইকন ছাড়া)। চাপলে পাসওয়ার্ড চেঞ্জ স্ক্রিন খোলে।
// নতুন সেটিং যোগ করতে চাইলে নিচের তালিকার মতো আরেকটি অপশন বসালেই হবে।
export default function SettingScreen({ onBack, onOpenPasswordChange, onOpenLockOption }) {
  // App.js পুরোনো থাকলে onOpenLockOption আসে না, তখন চাপলে কিছুই হতো না; এখন কারণটা বলে দেয়
  const openLockOption = () => {
    if (typeof onOpenLockOption === 'function') {
      onOpenLockOption();
      return;
    }
    Alert.alert(
      'App.js আপডেট করুন',
      'লক অপশন খুলতে নতুন App.js লাগবে। নতুন App.js ও lockoption.js home ফোল্ডারে বসিয়ে অ্যাপ আবার চালান।'
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.mainTitle}>Setting</Text>
      <Text style={styles.subTitle}>সেটিং</Text>

      <View style={styles.list}>
        <TouchableOpacity style={styles.optionRow} onPress={onOpenPasswordChange} activeOpacity={0.7}>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>পাসওয়ার্ড চেঞ্জ</Text>
            <Text style={styles.optionDesc}>অ্যাপে ঢোকার পাসওয়ার্ড বদলান</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.optionRow, styles.optionRowLast]} onPress={openLockOption} activeOpacity={0.7}>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>lock option</Text>
            <Text style={styles.optionDesc}>কোন অপশনে ফিঙ্গারপ্রিন্ট বা পাসওয়ার্ড লাগবে ঠিক করুন</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 15, backgroundColor: '#f8f9fa', paddingTop: 30, paddingBottom: 30 },
  mainTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: '#1A365D' },
  subTitle: { fontSize: 14, textAlign: 'center', color: '#666', marginBottom: 20, marginTop: 2 },

  list: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', overflow: 'hidden' },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  optionRowLast: { borderBottomWidth: 0 },
  optionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  optionDesc: { fontSize: 12, color: '#888', marginTop: 2 },
  arrow: { fontSize: 26, color: '#1A365D', marginLeft: 10, lineHeight: 28 },
});
