import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

export default function QRScannerScreen({ onBack }) {
  const [scannedData, setScannedData] = useState('স্ক্যান করার জন্য ক্যামেরা নির্দেশ করুন...');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>QR Code Scanner</Text>
      
      <View style={styles.scannerBox}>
        <Text style={styles.scannerText}>[ ক্যামেরা প্রিভিউ এরিয়া ]</Text>
        <Text style={styles.resultText}>{scannedData}</Text>
      </View>

      <TouchableOpacity style={styles.btn} onPress={() => setScannedData('BD-1500 (সফলভাবে স্ক্যান হয়েছে)')}>
        <Text style={styles.btnText}>টেস্ট স্ক্যান করুন</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.backBtn]} onPress={onBack}>
        <Text style={styles.btnText}>ফিরে যান</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  scannerBox: { width: '100%', height: 300, borderWidth: 2, borderColor: '#007bff', borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#e9ecef', marginBottom: 20 },
  scannerText: { fontSize: 16, color: '#666', marginBottom: 10 },
  resultText: { fontSize: 16, fontWeight: 'bold', color: '#28a745', textAlign: 'center', paddingHorizontal: 10 },
  btn: { backgroundColor: '#007bff', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, width: '100%', alignItems: 'center', marginBottom: 10 },
  backBtn: { backgroundColor: '#6c757d' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
