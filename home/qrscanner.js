import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ScrollView } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

// কার্ড ও পারসন লিস্টের সাথে একই স্টোরেজ কী (key)
const STORAGE_KEY = 'persistent_numbers_data';
const IDLE_MESSAGE = 'স্ক্যান করার জন্য ক্যামেরা নির্দেশ করুন...';

// স্টোরেজ থেকে সব রেজিস্টার্ড ব্যক্তির তালিকা পড়া (পড়তে ব্যর্থ হলে ত্রুটি ছোড়ে, যাতে ভুলে "নিবন্ধিত নয়" দেখানো না হয়)
const readAllRecords = async () => {
  const data = await AsyncStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  const parsed = JSON.parse(data);
  return Array.isArray(parsed) ? parsed : [];
};

// ISO সময়কে পড়ার উপযোগী তারিখ-সময়ে রূপান্তর (দিন/মাস/বছর ঘণ্টা:মিনিট)
const formatDateTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function QRScannerScreen({ onBack }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scannedData, setScannedData] = useState(IDLE_MESSAGE);
  const [selectedImage, setSelectedImage] = useState(null);

  // স্ক্যান ফলাফল: { status: 'success' | 'duplicate' | 'notfound', person, code }
  const [scanResult, setScanResult] = useState(null);

  // ক্যামেরা একই কোড বারবার পড়ে, তাই একবার প্রসেস শুরু হলে লক রাখা হয়
  const processingRef = useRef(false);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  // স্ক্যান করা কোড যাচাই করা:
  // - তালিকায় নেই        => লাল ক্রস
  // - আছে, আগে স্ক্যান হয়েছে => লাল ক্রস
  // - আছে, প্রথমবার        => সবুজ টিক + "স্ক্যান হয়েছে" হিসেবে সেভ
  const processScan = async (rawData) => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      const code = String(rawData === undefined || rawData === null ? '' : rawData).trim();
      const records = await readAllRecords();

      const index = code
        ? records.findIndex((r) => r.uniqueCode && String(r.uniqueCode) === code)
        : -1;

      if (index < 0) {
        setScanResult({ status: 'notfound', code });
        return;
      }

      const person = records[index];

      if (person.scanned) {
        setScanResult({ status: 'duplicate', person, code });
        return;
      }

      const updatedPerson = {
        ...person,
        scanned: true,
        scannedAt: new Date().toISOString(),
      };
      records[index] = updatedPerson;

      // সেভ সফল হলেই কেবল টিক দেখানো হবে
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));

      setScanResult({ status: 'success', person: updatedPerson, code });
    } catch (error) {
      console.error('Scan process error:', error);
      setScannedData('ত্রুটি: কার্ড যাচাই করার সময় সমস্যা হয়েছে। আবার চেষ্টা করুন।');
      processingRef.current = false;
    }
  };

  const handleBarCodeScanned = ({ type, data }) => {
    processScan(data);
  };

  // পরবর্তী কার্ড স্ক্যানের জন্য সবকিছু রিসেট
  const resetScan = () => {
    processingRef.current = false;
    setScanResult(null);
    setSelectedImage(null);
    setScannedData(IDLE_MESSAGE);
  };

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

        // নতুন ছবি সিলেক্ট করলে আগের ফলাফল ও লক মুছে ফেলা হয়
        processingRef.current = false;
        setScanResult(null);
        setSelectedImage(imageUri);
        setScannedData('ছবি থেকে কিউআর কোড খোঁজা হচ্ছে...');

        // ছবি থেকে কিউআর কোড ডিকোড করা
        const scanner =
          CameraView && typeof CameraView.scanFromURLAsync === 'function'
            ? CameraView
            : Camera && typeof Camera.scanFromURLAsync === 'function'
            ? Camera
            : null;

        if (!scanner) {
          setScannedData('ত্রুটি: এই ভার্সনে ছবি থেকে কিউআর স্ক্যান করা সমর্থিত নয়।');
          return;
        }

        const barcodes = await scanner.scanFromURLAsync(imageUri, ['qr']);

        if (!barcodes || barcodes.length === 0) {
          setScannedData('এই ছবিতে কোনো কিউআর কোড পাওয়া যায়নি।');
          return;
        }

        await processScan(barcodes[0].data);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      setScannedData('ত্রুটি: গ্যালারি থেকে ছবি লোড করা সম্ভব হয়নি।');
    }
  };

  if (hasPermission === null) {
    return <View style={styles.container}><Text>ক্যামেরা পারমিশন চেক করা হচ্ছে...</Text></View>;
  }
  if (hasPermission === false) {
    return <View style={styles.container}><Text style={styles.errorText}>ক্যামেরার অনুমতি পাওয়া যায়নি!</Text></View>;
  }

  // ফলাফল অনুযায়ী আইকন, রং ও বার্তা
  const isSuccess = scanResult && scanResult.status === 'success';
  const resultPerson = scanResult && scanResult.person;

  let resultTitle = '';
  let resultMessage = '';
  if (scanResult) {
    if (scanResult.status === 'success') {
      resultTitle = 'নিবন্ধিত ব্যক্তি';
      resultMessage = 'প্রথমবার স্ক্যান সফল হয়েছে।';
    } else if (scanResult.status === 'duplicate') {
      resultTitle = 'কার্ড আগেই স্ক্যান করা হয়েছে';
      resultMessage = resultPerson && resultPerson.scannedAt
        ? `আগের স্ক্যানের সময়: ${formatDateTime(resultPerson.scannedAt)}`
        : 'এই কার্ড দ্বিতীয়বার ব্যবহার করা যাবে না।';
    } else {
      resultTitle = 'কার্ডের তথ্য মেলেনি';
      resultMessage = 'এই ব্যক্তি নিবন্ধিত নন।';
    }
  }

  return (
    <ScrollView style={styles.scrollRoot} contentContainerStyle={styles.scrollContent}>
      {/* হেডার */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>QR Code Scanner</Text>
      </View>

      {/* ক্যামেরা প্রিভিউ অথবা গ্যালারির ছবি প্রিভিউ এরিয়া */}
      <View style={[styles.scannerBox, scanResult && styles.scannerBoxCompact]}>
        {selectedImage ? (
          <Image source={{ uri: selectedImage }} style={styles.previewImage} />
        ) : (
          <CameraView
            // ফলাফল দেখানোর সময় স্ক্যানিং বন্ধ থাকে
            onBarcodeScanned={scanResult ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "pdf417"],
            }}
            style={styles.cameraView}
          />
        )}

        {!selectedImage && !scanResult && (
          <View style={styles.overlayBox} pointerEvents="none">
            <View style={styles.scanTargetBox} />
            <Text style={styles.scannerText}>বক্সের ভেতরে কিউআর কোড রাখুন</Text>
          </View>
        )}
      </View>

      {/* স্ক্যানের ফলাফল: সবুজ টিক অথবা লাল ক্রস (ছোট আকারে, যাতে সবকিছু এক স্ক্রিনে থাকে) */}
      {scanResult ? (
        <View style={[styles.resultCard, isSuccess ? styles.resultCardSuccess : styles.resultCardError]}>
          <View style={[styles.statusCircle, isSuccess ? styles.circleSuccess : styles.circleError]}>
            <Text style={styles.statusIcon}>{isSuccess ? '✓' : '✕'}</Text>
          </View>

          <View style={styles.resultInfo}>
            <Text style={[styles.resultTitle, isSuccess ? styles.titleSuccess : styles.titleError]}>
              {resultTitle}
            </Text>
            <Text style={styles.resultMessage}>{resultMessage}</Text>

            {resultPerson ? (
              <View style={styles.personBox}>
                <Text style={styles.personName} numberOfLines={1}>{resultPerson.name}</Text>
                {resultPerson.nid ? (
                  <Text style={styles.personDetail}>এনআইডি: {resultPerson.nid}</Text>
                ) : null}
                {resultPerson.phone ? (
                  <Text style={styles.personDetail}>মোবাইল: {resultPerson.phone}</Text>
                ) : null}
                {resultPerson.district || resultPerson.upazila || resultPerson.village ? (
                  <Text style={styles.personDetail} numberOfLines={1}>
                    {[resultPerson.district, resultPerson.upazila, resultPerson.village ? 'গ্রাম: ' + resultPerson.village : '']
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                ) : null}
                <Text style={styles.personCode}>QR কোড: {scanResult.code}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        <Text style={styles.resultText}>{scannedData}</Text>
      )}

      {/* ক্যামেরা মোডে ফলাফল দেখানোর পর পরবর্তী কার্ড স্ক্যানের বাটন */}
      {scanResult && !selectedImage && (
        <TouchableOpacity style={styles.nextScanBtn} onPress={resetScan}>
          <Text style={styles.btnText}>পরবর্তী কার্ড স্ক্যান করুন</Text>
        </TouchableOpacity>
      )}

      {/* add_photo.xml রিসোর্স ব্যবহার করে গ্যালারি থেকে ছবি যুক্ত করার অপশন */}
      <TouchableOpacity style={styles.photoUploadBtn} onPress={pickImageFromGallery}>
        <Image 
          source={{ uri: 'add_photo' }} 
          style={styles.btnIconStyle} 
        />
        <Text style={styles.btnText}>গ্যালারি থেকে ছবি যুক্ত করুন</Text>
      </TouchableOpacity>

      {/* যদি গ্যালারি ইমেজ সিলেক্ট করা থাকে, তবে পুনরায় ক্যামেরা মোডে ফেরার বাটন */}
      {selectedImage && (
        <TouchableOpacity style={styles.cameraSwitchBtn} onPress={resetScan}>
          <Text style={styles.btnText}>📷 ক্যামেরা মোডে ফিরে যান</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 40, backgroundColor: '#f8f9fa', alignItems: 'center' },
  scrollRoot: { flex: 1, backgroundColor: '#f8f9fa' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, backgroundColor: '#f8f9fa', alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', width: '100%', marginBottom: 10 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1A365D' },
  scannerBox: { width: '100%', height: 280, borderWidth: 2, borderColor: '#007bff', borderRadius: 12, overflow: 'hidden', backgroundColor: '#000', marginBottom: 15, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  scannerBoxCompact: { height: 170, marginBottom: 10 },
  cameraView: { width: '100%', height: '100%', position: 'absolute' },
  previewImage: { width: '100%', height: '100%' },
  overlayBox: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  scanTargetBox: { width: 160, height: 160, borderWidth: 2, borderColor: 'rgba(0, 255, 0, 0.7)', borderRadius: 10, backgroundColor: 'transparent', marginBottom: 10 },
  scannerText: { fontSize: 13, color: '#fff', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  resultText: { fontSize: 14, fontWeight: 'bold', color: '#28a745', textAlign: 'center', marginBottom: 15, paddingHorizontal: 10 },

  /* স্ক্যান ফলাফল কার্ড (টিক / ক্রস) */
  resultCard: { width: '100%', flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, borderWidth: 2, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 10 },
  resultCardSuccess: { borderColor: '#28a745' },
  resultCardError: { borderColor: '#dc3545' },
  statusCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  circleSuccess: { backgroundColor: '#28a745' },
  circleError: { backgroundColor: '#dc3545' },
  statusIcon: { fontSize: 32, color: '#fff', fontWeight: 'bold', lineHeight: 38 },
  resultInfo: { flex: 1 },
  resultTitle: { fontSize: 15, fontWeight: 'bold' },
  titleSuccess: { color: '#28a745' },
  titleError: { color: '#dc3545' },
  resultMessage: { fontSize: 12, color: '#555', marginTop: 1 },
  personBox: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#eee' },
  personName: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  personDetail: { fontSize: 12, color: '#666', marginTop: 1 },
  personCode: { fontSize: 11, color: '#1A365D', marginTop: 3, fontWeight: 'bold', letterSpacing: 0.5 },

  nextScanBtn: { backgroundColor: '#007bff', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 8, width: '100%', alignItems: 'center', marginBottom: 8, elevation: 2 },
  photoUploadBtn: { flexDirection: 'row', backgroundColor: '#17a2b8', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 8, width: '100%', justifyContent: 'center', alignItems: 'center', marginBottom: 8, elevation: 2 },
  btnIconStyle: { width: 20, height: 20, marginRight: 8, tintColor: '#fff' },
  cameraSwitchBtn: { backgroundColor: '#ffc107', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 8, width: '100%', alignItems: 'center', marginBottom: 8, elevation: 2 },
  errorText: { fontSize: 16, color: 'red' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' }
});
