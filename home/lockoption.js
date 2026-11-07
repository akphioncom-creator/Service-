import React from 'react';
import { StyleSheet, Text, View, ScrollView, Switch } from 'react-native';

// অ্যাপ খুললে হোমে যে পাঁচটি অপশন দেখায়, সেগুলোর নাম (App.js এর GATED_SCREENS এর সাথে মিল রাখতে হবে)
export const LOCK_ITEMS = [
  { key: 'qrscanner', title: 'QR code scanner', desc: 'কিউআর কোড স্ক্যানার' },
  { key: 'addnew', title: 'add new person', desc: 'নতুন ব্যক্তি যুক্ত করা' },
  { key: 'personlist', title: 'all person list', desc: 'সকল ব্যক্তির তালিকা' },
  { key: 'creatingcard', title: 'creating all card', desc: 'সবগুলোর কার্ড তৈরি' },
  { key: 'setting', title: 'setting', desc: 'সেটিং' },
];

// একটি সারি: নাম ও সুইচ
function LockRow({ item, value, onToggle, last }) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowDesc}>{item.desc}</Text>
      </View>
      <Switch
        value={!!value}
        onValueChange={onToggle}
        trackColor={{ false: '#ced4da', true: '#8fd19e' }}
        thumbColor={value ? '#28a745' : '#f4f3f4'}
      />
    </View>
  );
}

// লক অপশন: কোন অপশনে ঢুকতে ফিঙ্গারপ্রিন্ট/পিন লাগবে এবং কোনটিতে অ্যাপের পাসওয়ার্ড লাগবে — আলাদা আলাদা ঠিক করা যায়
// settings = { fingerprint: { কী: true/false }, password: { কী: true/false } }; বদলালে onChange(নতুন settings) ডাকা হয় (App.js ফোনে সংরক্ষণ করে)
export default function LockOptionScreen({ settings, onChange, onBack }) {
  const toggle = (group, key) => (value) => {
    onChange({
      ...settings,
      [group]: { ...settings[group], [key]: value },
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.mainTitle}>Lock Option</Text>
      <Text style={styles.subTitle}>লক অপশন</Text>

      {/* ১: ফিঙ্গারপ্রিন্ট / পিন */}
      <Text style={styles.sectionTitle}>১. ফিঙ্গারপ্রিন্ট / পিন</Text>
      <Text style={styles.sectionHint}>
        চালু থাকলে এই অপশনে ঢোকার আগে ফিঙ্গারপ্রিন্ট বা ফোনের পিন চাইবে। বন্ধ থাকলে সরাসরি ঢোকা যাবে।
      </Text>
      <View style={styles.list}>
        {LOCK_ITEMS.map((item, index) => (
          <LockRow
            key={item.key}
            item={item}
            value={settings.fingerprint[item.key]}
            onToggle={toggle('fingerprint', item.key)}
            last={index === LOCK_ITEMS.length - 1}
          />
        ))}
      </View>

      {/* ২: অ্যাপের পাসওয়ার্ড */}
      <Text style={styles.sectionTitle}>২. পাসওয়ার্ড</Text>
      <Text style={styles.sectionHint}>
        চালু থাকলে এই অপশনে ঢোকার আগে অ্যাপের পাসওয়ার্ড লিখতে হবে। পাসওয়ার্ড ছাড়া ঢোকা যাবে না।
      </Text>
      <View style={styles.list}>
        {LOCK_ITEMS.map((item, index) => (
          <LockRow
            key={item.key}
            item={item}
            value={settings.password[item.key]}
            onToggle={toggle('password', item.key)}
            last={index === LOCK_ITEMS.length - 1}
          />
        ))}
      </View>

      <Text style={styles.noteText}>
        • এই লক অপশন পাতায় ঢুকতে সবসময় পাসওয়ার্ড লাগে।{'\n'}
        • এই সেটিং শুধু এই ফোনের জন্য; অন্য ফোনে আলাদা করে ঠিক করতে হবে।{'\n'}
        • ফোনে ফিঙ্গারপ্রিন্ট বা স্ক্রিন লক সেট না থাকলে ফিঙ্গারপ্রিন্টের লক কাজ করবে না, তখন পাসওয়ার্ড লক ব্যবহার করুন।
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 15, backgroundColor: '#f8f9fa', paddingTop: 30, paddingBottom: 30 },
  mainTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: '#1A365D' },
  subTitle: { fontSize: 14, textAlign: 'center', color: '#666', marginBottom: 16, marginTop: 2 },

  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A365D', marginTop: 8 },
  sectionHint: { fontSize: 12, color: '#777', marginTop: 2, marginBottom: 8 },

  list: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', overflow: 'hidden', marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  rowLast: { borderBottomWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  rowDesc: { fontSize: 12, color: '#888', marginTop: 1 },

  noteText: { fontSize: 12, color: '#777', lineHeight: 19, marginTop: 4 },
});
