import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View, TextInput, FlatList, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import API from '../apiConfig';
import {
  fetchCardsFromServer,
  deleteCardOnServer,
  getAuthToken,
  resetAllScansOnServer,
  fetchScanSummary,
} from './serverApi';

// ব্যক্তির তথ্য ও স্ক্যানের চিহ্ন (লাল/সবুজ) দুটোই এখন সার্ভার থেকে আসে (item.scannedAt)
const PAGE_SIZE = 30;

// যেকোনো মানকে নিরাপদে স্ট্রিং-এ রূপান্তর (খালি/undefined হলে ক্র্যাশ এড়াতে)
const safeText = (value) => (value === undefined || value === null ? '' : String(value));

// সার্চ বক্সে শুধু এনআইডি (সংখ্যা) লেখা যাবে: বাংলা সংখ্যা ইংরেজিতে বদলে যায়, সংখ্যা ছাড়া সব অক্ষর বাদ যায়
// (এনআইডি সর্বোচ্চ ১৭ ডিজিটের হয়)
const NID_MAX_LENGTH = 17;
const sanitizeNid = (text) =>
  String(text || '')
    .replace(/[০-৯]/g, (d) => '০১২৩৪৫৬৭৮৯'.indexOf(d))
    .replace(/[^0-9]/g, '')
    .slice(0, NID_MAX_LENGTH);

// ISO সময়কে পড়ার উপযোগী তারিখ-সময়ে রূপান্তর (দিন/মাস/বছর ঘণ্টা:মিনিট)
const formatDateTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  const [restarting, setRestarting] = useState(false); // রিস্টার্ট চলাকালীন বারবার চাপ ঠেকাতে

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
      const tk = await getAuthToken().catch(() => null);
      if (!mountedRef.current || reqId !== requestIdRef.current) return;

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

  // কিবোর্ডের সার্চ (🔍) বাটনে চাপ দিলে ০.৪ সেকেন্ড অপেক্ষা না করে সাথে সাথে খোঁজা হবে
  const handleSubmitSearch = () => {
    const q = searchQuery.trim();
    if (q === debouncedQuery) loadPage(1, q, 'initial');
    else setDebouncedQuery(q);
  };

  // শুধু এনআইডি দিয়ে সার্চ: সার্ভার নাম/মোবাইল/কিউআর কোডেও মিলিয়ে ফেলতে পারে (যেমন "7273" কিউআর কোডের সাথে মিলে যায়),
  // তাই ফলাফল থেকে শুধু যাদের এনআইডিতে সংখ্যাটি আছে তাদেরই দেখানো হয়
  const visibleItems = useMemo(() => {
    if (!debouncedQuery) return items;
    return items.filter((it) => safeText(it.nid).includes(debouncedQuery));
  }, [items, debouncedQuery]);

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

  // রিস্টার্ট: সার্ভারে সবার স্ক্যানের চিহ্ন মুছে ফেলা, ফলে সবাই আবার সবুজ হবে এবং সবার কার্ড আবার স্ক্যান করা যাবে
  // সার্ভার সফল না হলে কিছুই বদলায় না এবং কারণ দেখানো হয় (সার্ভারে শুধু admin পারে)
  const restartAll = async () => {
    if (restarting) return;
    setRestarting(true);
    try {
      const result = await resetAllScansOnServer();
      if (!mountedRef.current) return;

      if (!result.ok) {
        Alert.alert(
          'রিস্টার্ট হয়নি',
          result.status === 403 ? 'শুধু অ্যাডমিন রিস্টার্ট করতে পারে।' : result.message
        );
        return;
      }

      // তালিকার সবার চিহ্ন সঙ্গে সঙ্গে সবুজ করা, তারপর সার্ভার থেকে নতুন করে আনা
      setItems((prev) => prev.map((r) => ({ ...r, scannedAt: null })));
      loadPage(1, debouncedQuery, 'refresh');

      Alert.alert('সফল', 'সার্ভারে রিস্টার্ট সম্পন্ন হয়েছে। সবাই এখন আবার সবুজ, সবার কার্ড আবার স্ক্যান করা যাবে।');
    } catch (err) {
      console.error('Restart error:', err);
      Alert.alert('ত্রুটি', 'রিস্টার্ট করার সময় একটি সমস্যা হয়েছে।');
    } finally {
      if (mountedRef.current) setRestarting(false);
    }
  };

  // রিস্টার্ট বাটনে চাপ দিলে ৩ ধাপের সতর্কবার্তা, তিন ধাপ পার হলে তবেই রিস্টার্ট হবে
  // রিস্টার্ট করার মতো স্ক্যান আছে কিনা সার্ভারের হিসাব থেকে দেখা হয় (তালিকার শুধু বর্তমান পাতা নয়)
  const confirmRestart = async () => {
    if (restarting) return;

    const summary = await fetchScanSummary();
    if (summary.ok && summary.scanned === 0) {
      Alert.alert('রিস্টার্ট', 'রিস্টার্ট করার মতো কোনো স্ক্যান করা তথ্য নেই।');
      return;
    }
    // সার্ভারের হিসাব না পেলে (নেট সমস্যা) এখানে আটকানো হয় না; রিস্টার্টের সময়ই ত্রুটি জানানো হবে

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
          placeholder="এনআইডি নম্বর লিখুন"
          placeholderTextColor="#adb5bd"
          value={searchQuery}
          onChangeText={(t) => setSearchQuery(sanitizeNid(t))}
          keyboardType="number-pad"
          returnKeyType="search"
          maxLength={NID_MAX_LENGTH}
          onSubmitEditing={handleSubmitSearch}
          autoCorrect={false}
        />

        {/* রিস্টার্ট বাটন */}
        <TouchableOpacity
          style={[styles.restartBtn, restarting && { opacity: 0.5 }]}
          onPress={confirmRestart}
          disabled={restarting}
        >
          {restarting ? (
            <ActivityIndicator color="#1A365D" />
          ) : (
            <Text style={styles.restartIcon}>↻</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>All Person List ({debouncedQuery ? visibleItems.length : total})</Text>

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
        data={visibleItems}
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
          // স্ক্যানের তথ্য সার্ভার থেকে আসে (scannedAt থাকলে স্ক্যান হয়েছে)
          const scan = item.scannedAt ? { scannedAt: item.scannedAt } : null;
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

                {item.district || item.upazila || item.areaName || item.village ? (
                  <Text style={styles.detailText}>
                    {[
                      item.district,
                      item.upazila,
                      item.areaName || item.village
                        ? (item.areaType === 'পৌরসভা' ? 'পৌরসভা: ' : 'ইউনিয়ন: ') + (item.areaName || item.village)
                        : '',
                      item.ward ? 'ওয়ার্ড: ' + item.ward : '',
                    ]
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
  title: { fontSize: 9, fontWeight: 'normal', marginBottom: 6, textAlign: 'center', color: '#9aa0a6' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  input: { flex: 1, height: 34, borderWidth: 1, borderColor: '#ced4da', borderRadius: 6, paddingVertical: 0, paddingHorizontal: 10, backgroundColor: '#fff', fontSize: 13 },
  restartBtn: { width: 34, height: 34, marginLeft: 8, borderRadius: 6, borderWidth: 1, borderColor: '#ced4da', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  restartIcon: { fontSize: 20, color: '#1A365D', lineHeight: 24 },
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