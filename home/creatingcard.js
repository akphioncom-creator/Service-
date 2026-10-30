import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';

export default function CreatingCardScreen({ onBack }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Creating All Card</Text>
      
      <View style={styles.previewCard}>
        <Text style={styles.cardHeader}>UP Servers ID Card</Text>
        <Text style={styles.cardBody}>ডিজিটাল সিকিউরিটি ও আইডি কার্ড ম্যানেজমেন্ট সিস্টেম</Text>
      </View>

      <TouchableOpacity style={styles.btn} onPress={() => Alert.alert('সফল', 'সকল কার্ড সফলভাবে জেনারেট করা হয়েছে!')}>
        <Text style={styles.btnText}>সবগুলোর জন্য কার্ড তৈরি করুন</Text>
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
  previewCard: { backgroundColor: '#007bff', padding: 20, borderRadius: 12, alignItems: 'center', marginBottom: 25, elevation: 4 },
  cardHeader: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  cardBody: { fontSize: 14, color: '#e0e0e0', textAlign: 'center' },
  btn: { backgroundColor: '#ffc107', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  backBtn: { backgroundColor: '#6c757d' },
  btnText: { color: '#000', fontSize: 16, fontWeight: 'bold' }
});
