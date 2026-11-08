import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ScrollView, Image, NativeModules, ActivityIndicator, Platform, PermissionsAndroid, ToastAndroid, BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';

const STORAGE_KEY = 'smart_cards_data';
// card.js তৈরি হওয়া কার্ডের ছবি ক্যাশ মেমোরিতে রেখে তার ঠিকানা এই কী-তে জমা করে: { ইউনিক কোড: { uri, ratio, at } }
const CARD_CACHE_KEY = 'card_image_cache';
const { GalleryModule, SaveNotification } = NativeModules;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toast = (message) => {
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
};

// সেভ নোটিফিকেশনের সহায়ক ফাংশন: নোটিফিকেশনে কোনো সমস্যা হলে অ্যাপ বা সেভ থামবে না
const notifyApi = {
  // নোটিফিকেশন সত্যিই দেখানো গেলে true, না গেলে false
  start: async (id, title, text, percent) => {
    try {
      if (!SaveNotification) return false;
      return !!(await SaveNotification.start(id, title, text, percent));
    } catch (e) {
      return false;
    }
  },
  update: (id, text, percent) => {
    try { SaveNotification && SaveNotification.update(id, text, percent); } catch (e) {}
  },
  complete: (id, title, text, uri) => {
    try { SaveNotification && SaveNotification.complete(id, title, text, uri || null); } catch (e) {}
  },
  fail: (id, title, text) => {
    try { SaveNotification && SaveNotification.fail(id, title, text); } catch (e) {}
  },
};

// Android 13+ এ নোটিফিকেশন দেখাতে অনুমতি লাগে; না দিলেও সেভ চলবে (তখন শেষে অ্যালার্টে ফলাফল দেখাবে)
const requestNotificationPermission = async () => {
  if (Platform.OS !== 'android' || Platform.Version < 33) return;
  try {
    const perm = PermissionsAndroid.PERMISSIONS && PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    if (!perm) return;
    const granted = await PermissionsAndroid.check(perm);
    if (!granted) await PermissionsAndroid.request(perm);
  } catch (e) {}
};

// কার্ডের ছবির নির্দিষ্ট মাপ (পিক্সেলে): সব সময় হুবহু ৩৮৪০ × ২৫৬৭ (card.js এর মতোই)
const EXPORT_WIDTH_PX = 3840;
const EXPORT_HEIGHT_PX = 2567;
const CARD_ASPECT = EXPORT_WIDTH_PX / EXPORT_HEIGHT_PX;

// ইংরেজি সংখ্যাকে বাংলা সংখ্যায় রূপান্তর
const toBengaliDigits = (value) =>
  String(value).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);

// কার্ড তৈরির তারিখ বাংলা সংখ্যায় দিন/মাস/বছর (যেমন ০৫/১১/২০২৬) আকারে (শুধু ক্যাশের ছবি না থাকলে দেখানো কার্ডে লাগে)
const formatCreatedDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return toBengaliDigits(value);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return toBengaliDigits(`${dd}/${mm}/${d.getFullYear()}`);
};

export default function CreatingCardScreen({ onBack }) {
  const [cardsList, setCardsList] = useState([]);
  const cardRefs = useRef({});
  // ক্যাশ মেমোরিতে রাখা কার্ডের ছবির তালিকা, আর যেগুলোর ফাইল মুছে গেছে (সিস্টেম ক্যাশ পরিষ্কার করলে)
  const [cacheMap, setCacheMap] = useState({});
  const [brokenCache, setBrokenCache] = useState({});
  // স্ক্রিনে ঢোকার পর প্রথমে লোডিং দেখিয়ে যাচাই করা হয় আইডি কার্ড আছে কিনা
  const [loading, setLoading] = useState(true);
  // কোন কার্ড এখন সেভের লাইনে ('queued') বা সেভ হচ্ছে ('saving'): { কার্ড আইডি: অবস্থা }
  const [saveState, setSaveState] = useState({});

  const isMountedRef = useRef(true);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  // সেভ চলার সময় পুরোনো (stale) state এড়াতে সর্বশেষ মানগুলো ref-এ রাখা হয়
  const cacheMapRef = useRef({});
  const brokenCacheRef = useRef({});
  cacheMapRef.current = cacheMap;
  brokenCacheRef.current = brokenCache;

  // সেভের লাইন (queue): একসাথে অনেক রিকোয়েস্ট এলে একটির পর একটি সেভ হবে এবং একটিই নোটিফিকেশন চলবে
  const queueRef = useRef([]);
  const inQueueRef = useRef(new Set());
  const runningRef = useRef(false);
  const currentIdRef = useRef(null);
  const lastNotifIdRef = useRef(0);
  // কার্ডের ছবি তোলার ধাপ চলছে কিনা (এই ধাপে স্ক্রিন খোলা থাকতে হয়) এবং এর মাঝে ব্যাক চাপা হয়েছে কিনা
  const captureActiveRef = useRef(false);
  const pendingBackRef = useRef(false);

  // AsyncStorage থেকে সকল কার্ডের ডেটা লোড করা
  useEffect(() => {
    isMountedRef.current = true;
    loadSavedCards();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadSavedCards = async () => {
    try {
      // লোডিং হঠাৎ ঝলকে না যায়, তাই অন্তত ০.৪ সেকেন্ড লোডিং দেখানো হয়
      const [data, cacheRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(CARD_CACHE_KEY),
        sleep(400),
      ]);
      if (data) {
        setCardsList(JSON.parse(data));
      }
      if (cacheRaw) {
        try {
          const parsed = JSON.parse(cacheRaw);
          if (parsed && typeof parsed === 'object') setCacheMap(parsed);
        } catch (e) {
          // ক্যাশ তালিকা নষ্ট হলে উপেক্ষা, তখন সাধারণ কার্ড দেখাবে
        }
      }
    } catch (error) {
      console.error('Error loading cards:', error);
      Alert.alert('ত্রুটি', 'সংরক্ষিত কার্ডের ডেটা লোড করতে সমস্যা হয়েছে।');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  // কোনো কার্ডের জন্য ক্যাশে ছবি আছে এবং ফাইলটি এখনো ঠিক আছে কিনা
  const getCachedEntry = (item) => {
    const code = item && item.uniqueCode ? String(item.uniqueCode) : '';
    if (!code || brokenCache[code]) return null;
    const entry = cacheMap[code];
    return entry && entry.uri ? entry : null;
  };

  // ক্যাশের ছবি খোলা না গেলে (ফাইল মুছে গেছে) চিহ্ন রাখা, যাতে সাধারণ কার্ড দেখানো হয়
  const markCacheBroken = (item) => {
    const code = item && item.uniqueCode ? String(item.uniqueCode) : '';
    if (code) setBrokenCache((prev) => ({ ...prev, [code]: true }));
  };

  // ক্যাশ তালিকা থেকে কার্ড বাদ দিয়ে সংরক্ষণ (কার্ড মুছলে)
  const removeFromCache = async (codes) => {
    try {
      const next = { ...cacheMap };
      codes.forEach((c) => delete next[String(c)]);
      await AsyncStorage.setItem(CARD_CACHE_KEY, JSON.stringify(next));
      setCacheMap(next);
    } catch (error) {
      console.warn('Cache remove error:', error);
    }
  };

  // সেভ চলাকালীন (সর্বশেষ মান নিয়ে) ক্যাশে ছবি আছে কিনা
  const getCachedFromRefs = (item) => {
    const code = item && item.uniqueCode ? String(item.uniqueCode) : '';
    if (!code || brokenCacheRef.current[code]) return null;
    const entry = cacheMapRef.current[code];
    return entry && entry.uri ? entry : null;
  };

  // কার্ডের সেভ-অবস্থা (লাইনে আছে / সেভ হচ্ছে) বদলানো; value = null হলে অবস্থা মুছে যায়
  const patchState = (id, value) => {
    if (!isMountedRef.current) return;
    setSaveState((prev) => {
      const next = { ...prev };
      if (value) next[id] = value;
      else delete next[id];
      return next;
    });
  };

  // স্ক্রিনের কার্ড ভিউ থেকে ছবি তোলা (এর জন্য স্ক্রিন খোলা থাকতে হয়)
  const captureItem = async (item) => {
    const ref = cardRefs.current[item.id];
    if (!ref) throw new Error('Card view not available');
    return captureRef(ref, {
      format: 'png',
      quality: 1.0,
      width: EXPORT_WIDTH_PX,
      height: EXPORT_HEIGHT_PX,
    });
  };

  // একটি কার্ড সেভ: ক্যাশে ছবি থাকলে সেটাই (4K মানের), না থাকলে স্ক্রিনের কার্ড ক্যাপচার করে সেভ হয়
  // onProgress(০-১ এর মধ্যে অংশ, ধাপের লেখা) দিয়ে নোটিফিকেশনের অগ্রগতি জানানো হয়
  const saveOne = async (item, onProgress) => {
    const cached = getCachedFromRefs(item);
    onProgress(0.1, 'কার্ডের ছবি প্রস্তুত হচ্ছে...');

    let uri;
    if (cached) {
      uri = cached.uri;
    } else {
      captureActiveRef.current = true;
      try {
        uri = await captureItem(item);
      } finally {
        captureActiveRef.current = false;
      }
    }

    onProgress(0.6, 'গ্যালারিতে সংরক্ষণ হচ্ছে...');

    try {
      return await GalleryModule.saveImageToGallery(uri);
    } catch (saveError) {
      if (!cached) throw saveError;
      // ক্যাশের ফাইল মুছে গেছে: সাধারণ কার্ডে ফিরে নিজে থেকেই আবার চেষ্টা
      markCacheBroken(item);
      await sleep(600);
      captureActiveRef.current = true;
      try {
        const retryUri = await captureItem(item);
        return await GalleryModule.saveImageToGallery(retryUri);
      } finally {
        captureActiveRef.current = false;
      }
    }
  };

  // এখনো স্ক্রিন লাগবে কিনা: চলমান ছবি তোলা আছে, অথবা লাইনে এমন কার্ড আছে যার ক্যাশ-ছবি নেই
  const needsScreen = () =>
    captureActiveRef.current || queueRef.current.some((it) => !getCachedFromRefs(it));

  // ব্যাক চাপা অপেক্ষায় থাকলে এবং স্ক্রিন আর না লাগলে এখন ফিরে যাওয়া
  const maybeLeave = () => {
    if (pendingBackRef.current && !needsScreen()) {
      pendingBackRef.current = false;
      if (onBackRef.current) onBackRef.current();
    }
  };

  // মোবাইলের ব্যাক বাটন: ছবি তোলা বাকি থাকলে শেষ হওয়া পর্যন্ত অপেক্ষা করে তারপর ফিরবে (সেভ ব্যর্থ হবে না)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (needsScreen()) {
        pendingBackRef.current = true;
        toast('কার্ডের ছবি তৈরি হচ্ছে, শেষ হলেই ফিরে যাবে...');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  // সব সেভ শেষে একটিমাত্র ফলাফল: নোটিফিকেশন (না দেখানো গেলে অ্যালার্ট)
  const finishBatch = (batch) => {
    const total = batch.ok + batch.failed;
    if (total === 0) return;

    let title;
    let text;
    let uri = null;
    let isError = false;

    if (batch.failed === 0) {
      title = 'সেভ সম্পন্ন';
      if (total === 1) {
        text = batch.lastName
          ? `"${batch.lastName}" এর কার্ড গ্যালারিতে সংরক্ষিত হয়েছে।`
          : 'স্মার্ট কার্ডটি গ্যালারিতে সংরক্ষিত হয়েছে।';
        uri = batch.lastUri;
      } else {
        text = `${toBengaliDigits(total)}টি কার্ড গ্যালারিতে সংরক্ষিত হয়েছে।`;
      }
    } else if (batch.ok === 0) {
      title = 'সেভ ব্যর্থ হয়েছে';
      text = total === 1
        ? 'কার্ডটি সেভ করা সম্ভব হয়নি।'
        : `${toBengaliDigits(total)}টি কার্ডের কোনোটিই সেভ করা যায়নি।`;
      isError = true;
    } else {
      title = 'সেভ আংশিক সম্পন্ন';
      text = `${toBengaliDigits(batch.ok)}টি সফল, ${toBengaliDigits(batch.failed)}টি ব্যর্থ হয়েছে।`;
    }

    if (batch.notified) {
      if (isError) notifyApi.fail(batch.id, title, text);
      else notifyApi.complete(batch.id, title, text, uri);
    } else {
      Alert.alert(isError ? 'ত্রুটি' : title, text);
    }
  };

  // লাইনের কার্ডগুলো একটির পর একটি সেভ করে; পুরো সময় একটিই নোটিফিকেশন চলে (n/মোট দেখায়)
  const runQueue = async () => {
    runningRef.current = true;

    // প্রতিটি ব্যাচের আলাদা আইডি (Int এর সীমার ভেতরে), যাতে আগের ফলাফল-নোটিফিকেশন মুছে না যায়
    let notifId = Math.floor(Date.now() % 1000000000);
    if (notifId <= lastNotifIdRef.current) notifId = lastNotifIdRef.current + 1;
    lastNotifIdRef.current = notifId;

    const batch = { id: notifId, ok: 0, failed: 0, done: 0, lastUri: null, lastName: '', notified: false };

    try {
      await requestNotificationPermission();

      batch.notified = await notifyApi.start(batch.id, 'স্মার্ট কার্ড সেভ হচ্ছে', 'শুরু হচ্ছে...', 0);
      if (batch.notified) toast('সেভ শুরু হয়েছে, নোটিফিকেশনে দেখুন');

      while (queueRef.current.length > 0) {
        const item = queueRef.current.shift();
        currentIdRef.current = item.id;
        patchState(item.id, 'saving');

        // মোট সংখ্যা চলার মাঝেও বাড়তে পারে (নতুন কার্ড লাইনে যোগ হলে), তাই প্রতিবার নতুন করে হিসাব
        const report = (fraction, stage) => {
          if (!batch.notified) return;
          const total = batch.done + 1 + queueRef.current.length;
          const percent = Math.round(((batch.done + fraction) / total) * 100);
          const text =
            total > 1
              ? `কার্ড ${toBengaliDigits(batch.done + 1)}/${toBengaliDigits(total)}: ${stage}`
              : stage;
          notifyApi.update(batch.id, text, percent);
        };

        try {
          const savedUri = await saveOne(item, report);
          if (savedUri) {
            batch.ok += 1;
            batch.lastUri = typeof savedUri === 'string' ? savedUri : null;
            batch.lastName = item.name || '';
          } else {
            batch.failed += 1;
          }
        } catch (error) {
          console.error('Save error:', error);
          batch.failed += 1;
        }

        batch.done += 1;
        currentIdRef.current = null;
        inQueueRef.current.delete(item.id);
        patchState(item.id, null);
        maybeLeave();
      }
    } catch (error) {
      console.error('Queue error:', error);
      // অপ্রত্যাশিত ত্রুটিতে লাইনের বাকি কার্ড বাদ দিয়ে অবস্থা পরিষ্কার করা, যাতে বাটন আটকে না থাকে
      queueRef.current.forEach((it) => {
        inQueueRef.current.delete(it.id);
        patchState(it.id, null);
        batch.failed += 1;
      });
      queueRef.current = [];
    }

    // এখান থেকে runningRef = false পর্যন্ত কোনো await নেই, তাই মাঝখানে নতুন রিকোয়েস্ট হারিয়ে যাবে না
    finishBatch(batch);
    runningRef.current = false;
    maybeLeave();
  };

  // সেভ বাটনে চাপ: কার্ডটি লাইনে যোগ হয় এবং সেভ ব্যাকগ্রাউন্ডে নোটিফিকেশনের মাধ্যমে চলে
  const saveSingleCardToGallery = (item) => {
    if (inQueueRef.current.has(item.id)) {
      toast('এই কার্ডটি ইতোমধ্যে সেভের তালিকায় আছে');
      return;
    }

    inQueueRef.current.add(item.id);
    queueRef.current.push(item);
    patchState(item.id, 'queued');

    if (runningRef.current) {
      toast('সেভের তালিকায় যোগ হয়েছে');
      return;
    }
    runQueue();
  };

  // কার্ড মুছলে সেটি সেভের লাইন থেকেও বাদ দেওয়া
  const removeFromQueue = (ids) => {
    const set = new Set(ids);
    queueRef.current = queueRef.current.filter((it) => !set.has(it.id));
    ids.forEach((id) => {
      // এখন যেটি সেভ হচ্ছে তার অবস্থা runQueue নিজেই পরিষ্কার করবে
      if (currentIdRef.current !== id) {
        inQueueRef.current.delete(id);
        patchState(id, null);
      }
    });
  };

  // ৩ ধাপের সতর্কবার্তা: তিন ধাপ পার হলে তবেই onConfirm চলবে
  const threeStepConfirm = ({ step1, step2, step3, onConfirm }) => {
    Alert.alert('সতর্কতা (১/৩)', step1, [
      { text: 'বাতিল', style: 'cancel' },
      {
        text: 'এগিয়ে যান',
        onPress: () =>
          Alert.alert('সতর্কতা (২/৩)', step2, [
            { text: 'বাতিল', style: 'cancel' },
            {
              text: 'হ্যাঁ, নিশ্চিত',
              onPress: () =>
                Alert.alert('চূড়ান্ত সতর্কতা (৩/৩)', step3, [
                  { text: 'বাতিল', style: 'cancel' },
                  { text: 'মুছে ফেলুন', style: 'destructive', onPress: onConfirm },
                ]),
            },
          ]),
      },
    ]);
  };

  // নির্দিষ্ট একটি কার্ড মুছে ফেলা
  const deleteCard = async (item) => {
    try {
      removeFromQueue([item.id]);
      const newList = cardsList.filter((card) => card.id !== item.id);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newList));

      delete cardRefs.current[item.id];
      setCardsList(newList);
      if (item.uniqueCode) await removeFromCache([item.uniqueCode]);
    } catch (error) {
      console.error('Delete error:', error);
      Alert.alert('ত্রুটি', 'কার্ডটি মুছে ফেলার সময় একটি সমস্যা হয়েছে।');
    }
  };

  // সবগুলো কার্ড একসাথে মুছে ফেলা
  const deleteAllCards = async () => {
    try {
      removeFromQueue(cardsList.map((c) => c.id));
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));

      cardRefs.current = {};
      setCardsList([]);
      await removeFromCache(cardsList.map((c) => c.uniqueCode).filter(Boolean));
    } catch (error) {
      console.error('Delete all error:', error);
      Alert.alert('ত্রুটি', 'সবগুলো কার্ড মুছে ফেলার সময় একটি সমস্যা হয়েছে।');
    }
  };

  // একটি কার্ড ডিলিটের জন্য ৩ ধাপের সতর্কবার্তা
  const confirmDeleteCard = (item) => {
    threeStepConfirm({
      step1: `আপনি কি "${item.name || ''}" এর কার্ডটি মুছে ফেলতে চান?`,
      step2: 'এই কাজ ফেরানো যাবে না। কার্ডের সব তথ্য মুছে যাবে। আপনি কি নিশ্চিত?',
      step3: 'এটিই শেষ ধাপ। "মুছে ফেলুন" চাপলে এখনই কার্ডটি মুছে যাবে।',
      onConfirm: () => deleteCard(item),
    });
  };

  // সব কার্ড ডিলিটের জন্য ৩ ধাপের সতর্কবার্তা
  const confirmDeleteAll = () => {
    if (cardsList.length === 0) {
      Alert.alert('ডিলিট', 'মুছে ফেলার মতো কোনো কার্ড নেই।');
      return;
    }

    threeStepConfirm({
      step1: `আপনি কি সবগুলো কার্ড (${cardsList.length}টি) মুছে ফেলতে চান?`,
      step2: 'এই কাজ ফেরানো যাবে না। সবগুলো কার্ডের সব তথ্য মুছে যাবে। আপনি কি নিশ্চিত?',
      step3: `এটিই শেষ ধাপ। "মুছে ফেলুন" চাপলে এখনই সবগুলো কার্ড (${cardsList.length}টি) মুছে যাবে।`,
      onConfirm: deleteAllCards,
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* হেডার: শুধু টাইটেল (ব্যাক বাটন সরানো হয়েছে); কার্ডের সংখ্যা যাচাই শেষ হলে দেখাবে */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>
          {loading ? 'All Registered Cards' : `All Registered Cards (${cardsList.length})`}
        </Text>
      </View>

      {/* সব কার্ড ডিলিট করার অপশন (deleteicon.xml) */}
      {!loading && cardsList.length > 0 && (
        <TouchableOpacity style={styles.deleteAllBtn} onPress={confirmDeleteAll}>
          <Image source={{ uri: 'deleteicon' }} style={styles.btnIconStyle} />
          <Text style={styles.saveBtnText}>সব কার্ড ডিলিট করুন</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        /* স্ক্রিনে ঢুকে প্রথমে লোডিং: আইডি কার্ড আছে কিনা যাচাই করা হচ্ছে */
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1A365D" />
          <Text style={styles.loadingText}>আইডি কার্ড আছে কিনা যাচাই করা হচ্ছে...</Text>
        </View>
      ) : cardsList.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>কোনো কার্ডের ডেটা পাওয়া যায়নি!</Text>
        </View>
      ) : (
        cardsList.map((item) => (
          <View key={item.id} style={styles.cardWrapper}>
            {/* ক্যাশ মেমোরিতে কার্ডের ছবি থাকলে আসল কার্ডটিই দেখানো হয় (গ্যালারিতে সেভ না করলেও) */}
            {getCachedEntry(item) ? (
              <View style={styles.cachedCardBox}>
                <Image
                  source={{ uri: getCachedEntry(item).uri }}
                  style={[styles.cachedCardImage, { aspectRatio: getCachedEntry(item).ratio || CARD_ASPECT }]}
                  resizeMode="contain"
                  resizeMethod="resize"
                  fadeDuration={0}
                  onError={() => markCacheBroken(item)}
                />
              </View>
            ) : (
              /* ক্যাশে ছবি না থাকলে (পুরনো কার্ড বা ক্যাশ পরিষ্কার হয়ে গেলে) সাধারণ কার্ড তথ্য থেকে আঁকা হয় */
              <View 
                ref={(el) => (cardRefs.current[item.id] = el)} 
                collapsable={false} 
                style={styles.cardContainer}
              >
                {/* ব্যাকগ্রাউন্ডে অফিশিয়াল লোগো ওয়াটারমার্ক */}
                <View style={styles.watermarkContainer} pointerEvents="none">
                  <Image 
                    source={{ uri: 'https://i.ibb.co.com/84p56b3/bd-logo.png' }} 
                    style={styles.watermarkImage} 
                    resizeMode="contain"
                  />
                </View>

                {/* কার্ডের মূল বডি */}
                <View style={styles.cardBody}>
                  {/* বাম পাশ: ছবি ও ঠিকানা */}
                  <View style={styles.cardLeftSection}>
                    {item.image ? (
                      <Image source={{ uri: item.image }} style={styles.cardUserImage} />
                    ) : (
                      <View style={[styles.cardUserImage, { backgroundColor: '#ccc' }]} />
                    )}
                    <Text style={styles.cardAddressText}>{item.district}</Text>
                    <Text style={styles.cardAddressText}>{item.upazila}</Text>
                    <Text style={styles.cardAddressText}>গ্রাম: {item.village}</Text>
                  </View>

                  {/* মাঝের অংশ: নাম, এনআইডি, মোবাইল ও তারিখ */}
                  <View style={styles.cardMiddleSection}>
                    <Text style={styles.fieldLabel}>নাম</Text>
                    <Text style={styles.fieldValue} numberOfLines={1}>{item.name}</Text>

                    <Text style={styles.fieldLabel}>জাতীয় পরিচয়পত্র নম্বর</Text>
                    <Text style={styles.fieldValue}>{item.nid}</Text>

                    <Text style={styles.fieldLabel}>মোবাইল নম্বর</Text>
                    <Text style={styles.fieldValue}>{item.phone}</Text>

                    <Text style={styles.fieldLabel}>কার্ড তৈরির তারিখ</Text>
                    <Text style={styles.fieldValue}>{formatCreatedDate(item.createdAt)}</Text>
                  </View>

                  {/* ডান পাশ: বড় কিউআর কোড (আসল কার্ডের মতোই ইউনিক কোড) */}
                  <View style={styles.cardRightSection}>
                    <QRCode value={item.uniqueCode || item.nid || 'smart-card'} size={85} />
                  </View>
                </View>
              </View>
            )}

            {/* প্রতিটি কার্ডের জন্য পৃথক সেভ বাটন (add_photo আইকন সহ) ও ডিলিট বাটন (deleteicon) */}
            <View style={styles.actionRow}>
              <TouchableOpacity 
                style={[styles.saveBtn, saveState[item.id] && { opacity: 0.6 }]} 
                onPress={() => saveSingleCardToGallery(item)}
                disabled={!!saveState[item.id]}
              >
                <Image source={{ uri: 'add_photo' }} style={styles.btnIconStyle} />
                <Text style={styles.saveBtnText}>
                  {saveState[item.id] === 'saving'
                    ? 'সেভ হচ্ছে...'
                    : saveState[item.id] === 'queued'
                    ? 'লাইনে আছে...'
                    : 'এই কার্ডটি গ্যালারিতে সেভ করুন'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => confirmDeleteCard(item)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Image source={{ uri: 'deleteicon' }} style={styles.deleteIconStyle} />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 15, backgroundColor: '#f8f9fa', paddingTop: 30 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 12, fontWeight: 'normal', color: '#1A365D', flex: 1 },
  loadingContainer: { alignItems: 'center', marginTop: 80 },
  loadingText: { fontSize: 15, color: '#666', marginTop: 14 },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { fontSize: 16, color: '#666' },

  /* সব কার্ড ডিলিট বাটন */
  deleteAllBtn: { flexDirection: 'row', backgroundColor: '#dc3545', paddingVertical: 10, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginBottom: 20, elevation: 2 },

  cardWrapper: { marginBottom: 25 },

  /* ক্যাশ মেমোরির কার্ডের ছবি */
  cachedCardBox: { width: '100%', borderRadius: 10, overflow: 'hidden', elevation: 3, backgroundColor: '#fff' },
  cachedCardImage: { width: '100%' },

  /* প্রফেশনাল আইডি কার্ড প্রিভিউ স্টাইল ও ওয়াটারমার্ক */
  cardContainer: { width: '100%', aspectRatio: CARD_ASPECT, justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#1A365D', borderRadius: 10, padding: 12, elevation: 4, position: 'relative', overflow: 'hidden' },
  watermarkContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 0 },
  // মাঝের ছবির স্বচ্ছতা: আগে ০.১ ছিল, এখন এক-তৃতীয়াংশ কমিয়ে ০.০৭ (আরও অস্পষ্ট)
  watermarkImage: { width: 140, height: 140, opacity: 0.07 },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 },
  cardLeftSection: { width: '27%', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#eee', paddingRight: 6 },
  cardUserImage: { width: 60, height: 75, borderRadius: 4, borderWidth: 1, borderColor: '#ccc', marginBottom: 4 },
  cardAddressText: { fontSize: 9, color: '#333', textAlign: 'center' },
  cardMiddleSection: { width: '37%', paddingLeft: 6, paddingRight: 6 },
  fieldLabel: { fontSize: 8, color: '#666', marginTop: 2 },
  fieldValue: { fontSize: 11, fontWeight: 'bold', color: '#000' },
  cardRightSection: { width: '36%', alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: '#eee', paddingLeft: 6 },

  actionRow: { flexDirection: 'row', alignItems: 'stretch', marginTop: 8 },
  saveBtn: { flex: 1, flexDirection: 'row', backgroundColor: '#007bff', paddingVertical: 10, borderRadius: 6, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  deleteBtn: { width: 48, marginLeft: 8, backgroundColor: '#dc3545', borderRadius: 6, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  deleteIconStyle: { width: 22, height: 22, tintColor: '#fff' },
  btnIconStyle: { width: 18, height: 18, marginRight: 8, tintColor: '#fff' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' }
});