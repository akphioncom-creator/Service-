import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

export default function QRScannerScreen({ onBack }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scannedData, setScannedData] = useState('স্ক্যান করার জন্য ক্যামেরা নির্দেশ করুন অথবা গ্যালারি থেকে ছবি আপলোড করুন...');
  const [selectedImage, setSelectedImage] = useState(null);

  // ক্যামেরা পারমিশন নেওয়া
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  // ক্যামেরা দ্বারা কিউআর কোড স্ক্যান হ্যান্ডলার (নোটিফিকেশন পপআপ ছাড়া সরাসরি ডেটা দেখাবে)
  const handleBarCodeScanned = ({ type, data }) => {
    setScannedData(`সফলভাবে স্ক্যান হয়েছে!\nতথ্য: ${data}`);
  };

  // গ্যালারি থেকে ছবি পিক এবং এডিটিং/ক্রপ করার ব্যবস্থা
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
        setScannedData(`গ্যালারি থেকে ছবি সিলেক্ট করা হয়েছে।\nফাইল পাথ: ${imageUri.substring(imageUri.lastIndexOf('/') + 1)}`);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      setScannedData('ত্রুটি: গ্যালারি থেকে ছবি লোড করা সম্ভব হয়নি।');
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
            onBarcodeScanned={handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "pdf417"],
            }}
            style={styles.cameraView}
          />
        )}
        
        {!selectedImage && (
          <View style={styles.overlayBox} pointerEvents="none">
            <View style={styles.scanTargetBox} />
            <Text style={styles.scannerText}>বক্সের ভেতরে কিউআর কোড রাখুন</Text>
          </View>
        )}
      </View>

      <Text style={styles.resultText}>{scannedData}</Text>

      {/* গ্যালারি থেকে ছবি নিয়ে স্ক্যান করার বাটন */}
      <TouchableOpacity style={styles.galleryBtn} onPress={pickImageFromGallery}>
        <Text style={styles.btnText}>📁 গ্যালারি থেকে ছবি আপলোড ও স্ক্যান করুন</Text>
      </TouchableOpacity>

      {/* যদি গ্যালারি ইমেজ সিলেক্ট করা থাকে, তবে পুনরায় ক্যামেরা মোডে ফেরার বাটন */}
      {selectedImage && (
        <TouchableOpacity style={styles.cameraSwitchBtn} onPress={() => { setSelectedImage(null); setScannedData('স্ক্যান করার জন্য ক্যামেরা নির্দেশ করুন...'); }}>
          <Text style={styles.btnText}>📷 ক্যামেরা মোডে ফিরে যান</Text>
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
  cameraView: { width: '100%', height: '100%', position: 'absolute' },
  previewImage: { width: '100%', height: '100%' },
  overlayBox: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  scanTargetBox: { width: 160, height: 160, borderWidth: 2, borderColor: 'rgba(0, 255, 0, 0.7)', borderRadius: 10, backgroundColor: 'transparent', marginBottom: 10 },
  scannerText: { fontSize: 13, color: '#fff', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  resultText: { fontSize: 14, fontWeight: 'bold', color: '#28a745', textAlign: 'center', marginBottom: 15, paddingHorizontal: 10 },
  btn: { backgroundColor: '#007bff', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, width: '100%', alignItems: 'center', marginBottom: 10, elevation: 2 },
  galleryBtn: { backgroundColor: '#17a2b8', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, width: '100%', alignItems: 'center', marginBottom: 10, elevation: 2 },
  cameraSwitchBtn: { backgroundColor: '#ffc107', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, width: '100%', alignItems: 'center', marginBottom: 10, elevation: 2 },
  backBtn: { backgroundColor: '#6c757d' },
  errorText: { fontSize: 16, color: 'red' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' }
});
