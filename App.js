import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

export default function QRScannerScreen({ onBack }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scannedData, setScannedData] = useState('স্ক্যান করার জন্য ক্যামেরা নির্দেশ করুন...');
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
    setScannedData(`সফলভাবে স্ক্যান হয়েছে!\nতথ্য: ${data}`);
  };

  // গ্যালারি থেকে ছবি পিক এবং ক্রপ করার ব্যবস্থা
  const pickImageFromGallery = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
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
      {/* হেডার: back_icon রিসোর্স ব্যবহার করে ব্যাক বাটন */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.topBackBtn} onPress={onBack}>
          <Image 
            source={{ uri: 'back_icon' }} 
            style={styles.iconStyle} 
          />
        </TouchableOpacity>
        <Text style={styles.title}>QR Code Scanner</Text>
      </View>

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

      {/* add_photo রিসোর্স ব্যবহার করে গ্যালারি থেকে ছবি যুক্ত করার অপশন */}
      <TouchableOpacity style={styles.photoUploadBtn} onPress={pickImageFromGallery}>
        <Image 
          source={{ uri: 'add_photo' }} 
          style={styles.btnIconStyle} 
        />
        <Text style={styles.btnText}>গ্যালারি থেকে ছবি যুক্ত করুন</Text>
      </TouchableOpacity>

      {/* যদি গ্যালারি ইমেজ সিলেক্ট করা থাকে, তবে পুনরায় ক্যামেরা মোডে ফেরার বাটন */}
      {selectedImage && (
        <TouchableOpacity style={styles.cameraSwitchBtn} onPress={() => { setSelectedImage(null); setScannedData('স্ক্যান করার জন্য ক্যামেরা নির্দেশ করুন...'); }}>
          <Text style={styles.btnText}>📷 ক্যামেরা মোডে ফিরে যান</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 40, backgroundColor: '#f8f9fa', alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', width: '100%', marginBottom: 15 },
  topBackBtn: { padding: 6, backgroundColor: '#e9ecef', borderRadius: 6, marginRight: 15, justifyContent: 'center', alignItems: 'center' },
  iconStyle: { width: 22, height: 22, tintColor: '#1A365D' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1A365D' },
  scannerBox: { width: '100%', height: 280, borderWidth: 2, borderColor: '#007bff', borderRadius: 12, overflow: 'hidden', backgroundColor: '#000', marginBottom: 15, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  cameraView: { width: '100%', height: '100%', position: 'absolute' },
  previewImage: { width: '100%', height: '100%' },
  overlayBox: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  scanTargetBox: { width: 160, height: 160, borderWidth: 2, borderColor: 'rgba(0, 255, 0, 0.7)', borderRadius: 10, backgroundColor: 'transparent', marginBottom: 10 },
  scannerText: { fontSize: 13, color: '#fff', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  resultText: { fontSize: 14, fontWeight: 'bold', color: '#28a745', textAlign: 'center', marginBottom: 15, paddingHorizontal: 10 },
  photoUploadBtn: { flexDirection: 'row', backgroundColor: '#17a2b8', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, width: '100%', justifyContent: 'center', alignItems: 'center', marginBottom: 10, elevation: 2 },
  btnIconStyle: { width: 20, height: 20, marginRight: 8, tintColor: '#fff' },
  cameraSwitchBtn: { backgroundColor: '#ffc107', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, width: '100%', alignItems: 'center', marginBottom: 10, elevation: 2 },
  errorText: { fontSize: 16, color: 'red' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' }
});
