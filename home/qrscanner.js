import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Image } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

export default function QRScannerScreen({ onBack }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [scannedData, setScannedData] = useState('স্ক্যান করার জন্য ক্যামেরা নির্দেশ করুন অথবা গ্যালারি থেকে ছবি আপলোড করুন...');
  const [selectedImage, setSelectedImage] = useState(null);

  // ক্যামেরা পারমিশন নেওয়া
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  // ক্যামেরা দ্বারা কিউআর কোড স্ক্যান হ্যান্ডলার
  const handleBarCodeScanned = ({ type, data }) => {
    setScanned(true);
    setScannedData(`সফলভাবে স্ক্যান হয়েছে!\nতথ্য: ${data}`);
    Alert.alert("স্ক্যান সফল", `QR Code Data:\n${data}`, [
      { text: "আবার স্ক্যান করুন", onPress: () => setScanned(false) }
    ]);
  };

  // গ্যালারি থেকে ছবি পিক এবং এডিটিং/ক্রপ করার ব্যবস্থা (যেমনটি AddNewScreen-এ করা হয়েছিল)
  const pickImageFromGallery = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // ক্রপ বা নির্দিষ্ট করার সিস্টেম
        aspect: [1, 1],
        quality: 1.0,
      });

      if (!result.canceled) {
        const imageUri = result.assets[0].uri;
        setSelectedImage(imageUri);
        
        // এখানে গ্যালারির ছবি থেকে কিউআর কোড প্রসেস করার লজিক বা ডেমো ফলাফল দেখানো হচ্ছে
        setScannedData(`গ্যালারি থেকে ছবি সিলেক্ট করা হয়েছে।\nফাইল পাথ: ${imageUri.substring(imageUri.lastIndexOf('/') + 1)}`);
        Alert.alert("সফল", "গ্যালারি থেকে ছবি সফলভাবে সিলেক্ট করা হয়েছে!");
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('ত্রুটি', 'গ্যালারি থেকে ছবি লোড করা সম্ভব হয়নি।');
    }
  };

  if (hasPermission === null) {
    return <View style={styles.container}><Text>ক্যামেরা পারমিশন চেক করা হচ্ছে...</Text></View>;
  }
  if (hasPermission === false) {
    return <View style={styles.container}><Text style={styles.errorText}>ক্যামেরার অনুমতি পাওয়া যায়নি!</Text></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>QR Code Scanner</Text>

      {/* ক্যামেরা প্রিভিউ অথবা গ্যালারির ছবি প্রিভিউ এরিয়া */}
      <View style={styles.scannerBox}>
        {selectedImage ? (
          <Image source={{ uri: selectedImage }} style={styles.previewImage} />
        ) : (
          <CameraView
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "pdf417"],
            }}
            style={StyleSheet.absoluteFillObject}
          />
        )}
        
        {!selectedImage && (
          <View style={styles.overlayBox}>
            <Text style={styles.scannerText}>বক্সের ভেতরে কিউআর কোড রাখুন</Text>
          </View>
        )}
      </View>

      <Text style={styles.resultText}>{scannedData}</Text>

      {/* গ্যালারি থেকে ছবি নিয়ে স্ক্যান করার বাটন */}
      <TouchableOpacity style={styles.galleryBtn} onPress={pickImageFromGallery}>
        <Text style={styles.btnText}>📁 গ্যালারি থেকে ছবি আপলোড ও স্ক্যান করুন</Text>
      </TouchableOpacity>

      {scanned && (
        <TouchableOpacity style={styles.btn} onPress={() => setScanned(false)}>
          <Text style={styles.btnText}>পুনরায় স্ক্যান করুন</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={[styles.btn, styles.backBtn]} onPress={onBack}>
        <Text style={styles.btnText}>ফিরে যান</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, color: '#1A365D' },
  scannerBox: { width: '100%', height: 280, borderWidth: 2, borderColor: '#007bff', borderRadius: 12, overflow: 'hidden', backgroundColor: '#000', marginBottom: 15, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  previewImage: { width: '100%', height: '100%' },
  overlayBox: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 20 },
  scannerText: { fontSize: 13, color: '#fff', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  resultText: { fontSize: 14, fontWeight: 'bold', color: '#28a745', textAlign: 'center', marginBottom: 15, paddingHorizontal: 10 },
  btn: { backgroundColor: '#007bff', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, width: '100%', alignItems: 'center', marginBottom: 10, elevation: 2 },
  galleryBtn: { backgroundColor: '#17a2b8', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, width: '100%', alignItems: 'center', marginBottom: 10, elevation: 2 },
  backBtn: { backgroundColor: '#6c757d' },
  errorText: { fontSize: 16, color: 'red' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' }
});
