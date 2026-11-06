import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, TextInput, FlatList, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../../apiConfig';
import { fetchCardsFromServer, deleteCardOnServer, getAuthToken } from './serverApi';

// স্ক্যানের চিহ্ন (লাল/সবুজ) এখনো ফোনেই জমা থাকে, তাই শুধু সেই চিহ্ন পড়ার জন্য এই কী ব্যবহার হয়
// ব্যক্তির তথ্য এখন আর এখান থেকে আসে না, সবই সার্ভার থেকে আসে
const SCAN_STORAGE_KEY = 'persistent_numbers_data';
const PAGE_SIZE = 30;

// যেকোনো মানকে নিরাপদে স্ট্রিং-এ রূপান্তর (খালি/undefined হলে ক্র্যাশ এড়াতে)
const safeText = (value) => (value === undefined || value === null ? '' : String(value));

// ISO সময়কে পড়ার উপযোগী তারিখ-সময়ে রূপান্তর (দিন/মাস/বছর ঘণ্টা:মিনিট)
const formatDateTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ফোনে জমা স্ক্যানের চিহ্নগুলো ইউনিক কোড ধরে একটি তালিকায় সাজানো: { কোড: { scannedAt } }
const loadScanMap = async () => {
  try {
    const data = await AsyncStorage.getItem(SCAN_STORAGE_KEY);
    const parsed = data ? JSON.parse(data) : [];
    const map = {};
    if (Array.isArray(parsed)) {
      parsed.forEach((r) => {
        if (r && r.uniqueCode && r.scanned) {
          map[String(r.uniqueCode)] = { scannedAt: r.scannedAt || null };
        }
      });
    }
    return map;
  } catch (error) {
    console.error('Scan data read error:', error);
    return {};
  }
};

export default function PersonListScreen({ onBack }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState(null); // ছবি দেখানোর জন্য
  const [scanMap, setScanMap] = useState({});

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0); // দ্রুত সার্চ করলে পুরনো উত্তর যেন নতুনটাকে ঢেকে না দেয়

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // সার্ভার থেকে একটি পাতা আনা। mode: 'initial' (নতুন করে) | 'more' (আরও) | 'refresh' (টেনে রিফ্রেশ)
  const loadPage = useCallback(async (pageNum, query, mode) => {
    const reqId = ++requestIdRef.current;
    if (mode === 'more') setLoadingMore(true);
    else if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError('');

    const result = await fetchCardsFromServer({ page: pageNum, limit: PAGE_SIZE, q: query });
    if (!mountedRef.current || reqId !== requestIdRef.current) return;

    if (result.ok) {
      const [map, tk] = await Promise.all([loadScanMap(), getAuthToken().catch(() => null)]);
      if (!mountedRef.current || reqId !== requestIdRef.current) return;

      setScanMap(map);
      if (tk) setToken(tk);
      setItems((prev) =>
        mode === 'more'
          ? [...prev, ...result.items.filter((n) => !prev.some((p) => p.uniqueCode === n.uniqueCode))]
          : result.items
      );
      setTotal(result.total);
      setPage(result.page);
    } else {
      setError(result.message);
    }

    setLoading(false);
    setLoadingMore(false);
    setRefreshing(false);
  }, []);

  // টাইপ থামার ০.৪ সেকেন্ড পর সার্ভারে খোঁজা হবে (প্রতিটি অক্ষরে নয়)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    loadPage(1, debouncedQuery, 'initial');
  }, [debouncedQuery, loadPage]);

  const handleEndReached = () => {
    if (loading || loadingMore || refreshing || error) return;
    if (items.length >= total) return;
    loadPage(page + 1, debouncedQuery, 'more');
  };

  // সার্ভার থেকে নির্দিষ্ট ব্যক্তির তথ্য মুছে ফেলা (সার্ভারে শুধু admin পারে)
  const deleteItem = async (item) => {
    const result = await deleteCardOnServer(item.uniqueCode);
    if (!result.ok) {
      Alert.alert(
        'মুছে ফেলা যায়নি',
        result.status === 403 ? 'শুধু অ্যাডমিন তথ্য মুছতে পারে।' : result.message
      );
      return;
    }
    setItems((prev) => prev.filter((r) => r.uniqueCode !== item.uniqueCode));
    setTotal((prev) => Math.max(0, prev - 1));
  };

  // রিস্টার্ট: সবার স্ক্যানের চিহ্ন মুছে ফেলা, ফলে সবাই আবার সবুজ হবে (স্ক্যানের চিহ্ন ফোনে জমা থাকে)
  const restartAll = async () => {
    try {
      const data = await AsyncStorage.getItem(SCAN_STORAGE_KEY);
      const parsed = data ? JSON.parse(data) : [];
      const cleaned = Array.isArray(parsed)
        ? parsed.map((record) => {
            const { scanned, scannedAt, ...rest } = record;
            return rest;
          })
        : [];
      await AsyncStorage.setItem(SCAN_STORAGE_KEY, JSON.stringify(cleaned));
      setScanMap({});

      Alert.alert('সফল', 'রিস্টার্ট সম্পন্ন হয়েছে। সবাই এখন আবার সবুজ।');
    } catch (err) {
      console.error('Restart error:', err);
      Alert.alert('ত্রুটি', 'রিস্টার্ট করার সময় একটি সমস্যা হয়েছে।');
    }
  };

  // রিস্টার্ট বাটনে চাপ দিলে ৩ ধাপের সতর্কবার্তা, তিন ধাপ পার হলে তবেই রিস্টার্ট হবে
  const confirmRestart = () => {
    if (Object.keys(scanMap).length === 0) {
      Alert.alert('রিস্টার্ট', 'রিস্টার্ট করার মতো কোনো স্ক্যান করা তথ্য নেই।');
      return;
    }

    Alert.alert(
      'সতর্কতা (১/৩)',
      'রিস্টার্ট দিলে সবার স্ক্যানের তথ্য মুছে যাবে এবং সবাই আবার সবুজ হয়ে যাবে। আপনি কি এগিয়ে যেতে চান?',
      [
        { text: 'বাতিল', style: 'cancel' },
        {
          text: 'এগিয়ে যান',
          onPress: () =>
            Alert.alert(
              'সতর্কতা (২/৩)',
              'এই কাজ ফেরানো যাবে না। যাদের কার্ড আগে স্ক্যান হয়েছে, তাদের কার্ড আবার স্ক্যান করা যাবে। আপনি কি নিশ্চিত?',
              [
                { text: 'বাতিল', style: 'cancel' },
                {
                  text: 'হ্যাঁ, নিশ্চিত',
                  onPress: () =>
                    Alert.alert(
                      'চূড়ান্ত সতর্কতা (৩/৩)',
                      'এটিই শেষ ধাপ। "রিস্টার্ট করুন" চাপলে এখনই সবার স্ক্যানের তথ্য মুছে যাবে।',
                      [
                        { text: 'বাতিল', style: 'cancel' },
                        { text: 'রিস্টার্ট করুন', style: 'destructive', onPress: restartAll },
                      ]
                    ),
                },
              ]
            ),
        },
      ]
    );
  };

  // ডিলিট করার আগে নিশ্চিতকরণ বার্তা
  const confirmDelete = (item) => {
    Alert.alert(
      'মুছে ফেলুন',
      `আপনি কি "${safeText(item.name)}" এর তথ্য মুছে ফেলতে চান?`,
      [
        { text: 'বাতিল', style: 'cancel' },
        { text: 'মুছে ফেলুন', style: 'destructive', onPress: () => deleteItem(item) },
      ]
    );
  };

  const renderEmpty = () => {
    if (loading) {
      return <ActivityIndicator size="large" color="#1A365D" style={styles.centerSpinner} />;
    }
    if (error) return null;
    return <Text style={styles.emptyText}>কোনো তথ্য পাওয়া যায়নি।</Text>;
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="নাম, নম্বর বা কিউআর কোড দিয়ে সার্চ করুন..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {/* রিস্টার্ট বাটন */}
        <TouchableOpacity style={styles.restartBtn} onPress={confirmRestart}>
          <Text style={styles.restartIcon}>↻</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>All Person List ({total})</Text>

      {/* সার্ভার থেকে তথ্য আনতে সমস্যা হলে বার্তা ও আবার চেষ্টার বাটন */}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadPage(1, debouncedQuery, 'initial')}>
            <Text style={styles.retryText}>আবার চেষ্টা করুন</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item, index) => safeText(item.uniqueCode || item.id) || String(index)}
        refreshing={refreshing}
        onRefresh={() => loadPage(1, debouncedQuery, 'refresh')}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color="#1A365D" style={{ marginVertical: 12 }} /> : null
        }
        renderItem={({ item, index }) => {
          // একবার স্ক্যান হলে লাল, একবারও স্ক্যান না হলে সবুজ
          const scan = scanMap[safeText(item.uniqueCode)];
          const isScanned = !!scan;

          // ব্যক্তির ছবি সার্ভার থেকে আসে (লগইন-টোকেন সহ)
          const photoSource =
            item.photoUrl && token
              ? { uri: API.cardPhoto(item.uniqueCode), headers: { Authorization: `Bearer ${token}` } }
              : null;

          return (
            <View style={[styles.card, isScanned ? styles.cardScanned : styles.cardNotScanned]}>
              <Text style={styles.index}>#{index + 1}</Text>

              {photoSource ? <Image source={photoSource} style={styles.userImage} /> : null}

              <View style={{ flex: 1 }}>
                <Text style={styles.nameText}>{item.name}</Text>

                <Text style={styles.numberText}>এনআইডি: {item.nid}</Text>

                {item.phone ? (
                  <Text style={styles.detailText}>মোবাইল: {item.phone}</Text>
                ) : null}

                {item.district || item.upazila || item.village ? (
                  <Text style={styles.detailText}>
                    {[item.district, item.upazila, item.village ? 'গ্রাম: ' + item.village : '']
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                ) : null}

                {/* কার্ড খোলার (নিবন্ধনের) তারিখ ও সময় */}
                {item.createdAt ? (
                  <Text style={styles.detailText}>কার্ড খোলার তারিখ: {formatDateTime(item.createdAt)}</Text>
                ) : null}

                {/* কার্ডের কিউআর কোডে বসানো ইউনিক সংখ্যা */}
                {item.uniqueCode ? (
                  <View style={styles.codeBox}>
                    <Text style={styles.codeLabel}>QR কোড:</Text>
                    <Text style={styles.codeText} selectable>{item.uniqueCode}</Text>
                  </View>
                ) : null}

                {/* স্ক্যান স্ট্যাটাস */}
                <Text style={[styles.statusText, isScanned ? styles.statusScanned : styles.statusNotScanned]}>
                  {isScanned
                    ? 'স্ক্যান হয়েছে' + (scan.scannedAt ? ' (' + formatDateTime(scan.scannedAt) + ')' : '')
                    : 'এখনো স্ক্যান হয়নি'}
                </Text>
              </View>

              {/* ডিলিট বাটন (deleteicon.xml) */}
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => confirmDelete(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Image source={{ uri: 'deleteicon' }} style={styles.deleteIconStyle} />
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f8f9fa', paddingTop: 15 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#333' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  input: { flex: 1, height: 48, borderWidth: 1, borderColor: '#ced4da', borderRadius: 8, paddingHorizontal: 15, backgroundColor: '#fff', fontSize: 16 },
  restartBtn: { width: 48, height: 48, marginLeft: 10, borderRadius: 8, borderWidth: 1, borderColor: '#ced4da', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  restartIcon: { fontSize: 28, color: '#1A365D', lineHeight: 32 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e9ecef' },
  cardScanned: { backgroundColor: '#fdecea', borderColor: '#dc3545', borderWidth: 1.5 },
  cardNotScanned: { backgroundColor: '#eaf7ee', borderColor: '#28a745', borderWidth: 1.5 },
  statusText: { fontSize: 12, fontWeight: 'bold', marginTop: 5 },
  statusScanned: { color: '#dc3545' },
  statusNotScanned: { color: '#28a745' },
  index: { fontSize: 14, fontWeight: 'bold', color: '#888', marginRight: 15 },
  userImage: { width: 50, height: 62, borderRadius: 4, borderWidth: 1, borderColor: '#ccc', marginRight: 12 },
  nameText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  numberText: { fontSize: 14, color: '#666' },
  detailText: { fontSize: 13, color: '#666', marginTop: 1 },
  codeBox: { flexDirection: 'row', alignItems: 'center', marginTop: 4, backgroundColor: '#eef4ff', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 4, alignSelf: 'flex-start' },
  codeLabel: { fontSize: 12, color: '#1A365D', marginRight: 6 },
  codeText: { fontSize: 13, fontWeight: 'bold', color: '#1A365D', letterSpacing: 0.5 },
  deleteBtn: { padding: 8, backgroundColor: '#ffffff', borderRadius: 6, marginLeft: 8, justifyContent: 'center', alignItems: 'center' },
  deleteIconStyle: { width: 22, height: 22, tintColor: '#dc3545' },
  centerSpinner: { marginTop: 40 },
  emptyText: { textAlign: 'center', color: '#888', fontSize: 15, marginTop: 40 },
  errorBox: { backgroundColor: '#fdecea', borderColor: '#dc3545', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 10 },
  errorText: { color: '#a71d2a', fontSize: 14, textAlign: 'center' },
  retryBtn: { alignSelf: 'center', marginTop: 8, paddingVertical: 6, paddingHorizontal: 16, backgroundColor: '#dc3545', borderRadius: 6 },
  retryText: { color: '#fff', fontWeight: 'bold', fontSize: 13 }
});
