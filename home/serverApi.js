// সার্ভারের সাথে যোগাযোগের ফাইল: পাসওয়ার্ড দিয়ে লগইন, টোকেন জমানো, নিবন্ধনের তথ্য পাঠানো, তালিকা আনা
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from './apiConfig';

const TOKEN_KEY = 'server_auth_token';
const TIMEOUT_MS = 25000;
const NETWORK_ERROR_MESSAGE = 'সার্ভারের সাথে যোগাযোগ করা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।';

// সময়সীমা দিয়ে fetch: নেট খুব ধীর হলে অনন্তকাল ঝুলে থাকবে না
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------- লগইন ----------

// লগইন করা আছে কিনা (ফোনে সার্ভারের টোকেন জমা আছে কিনা)
export async function hasSavedToken() {
  try {
    return Boolean(await AsyncStorage.getItem(TOKEN_KEY));
  } catch (e) {
    return false;
  }
}

// লগআউট: টোকেন মুছে ফেলা
export async function clearToken() {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    // উপেক্ষা
  }
}

// টোকেনের মেয়াদ শেষ হলে বা বাতিল হলে অ্যাপকে জানানোর ব্যবস্থা (App.js এটা বসায়, তখন অ্যাপ লগইন স্ক্রিনে ফিরবে)
let authExpiredHandler = null;
export function setAuthExpiredHandler(handler) {
  authExpiredHandler = handler;
}

// শুধু পাসওয়ার্ড দিয়ে লগইন: পাসওয়ার্ড ঠিক কিনা সার্ভার ঠিক করে
// সফল হলে: { ok: true }   ব্যর্থ হলে: { ok: false, message }
export async function loginWithPassword(password) {
  try {
    const res = await fetchWithTimeout(API.appLogin(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const json = await res.json().catch(() => ({}));

    if (res.ok && json.token) {
      await AsyncStorage.setItem(TOKEN_KEY, json.token);
      return { ok: true };
    }
    return { ok: false, message: json.error || 'লগইন করা যায়নি।' };
  } catch (error) {
    console.error('loginWithPassword error:', error);
    return { ok: false, message: NETWORK_ERROR_MESSAGE };
  }
}

async function getToken() {
  const saved = await AsyncStorage.getItem(TOKEN_KEY);
  if (!saved) {
    await clearToken();
    if (authExpiredHandler) authExpiredHandler();
    throw new Error('লগইন করা নেই।');
  }
  return saved;
}

// টোকেনসহ অনুরোধ পাঠানো; সার্ভার টোকেন না মানলে (401) টোকেন মুছে অ্যাপকে লগইন স্ক্রিনে ফেরানো হয়
async function authedFetch(url, options = {}) {
  const token = await getToken();
  const res = await fetchWithTimeout(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    await clearToken();
    if (authExpiredHandler) authExpiredHandler();
  }
  return res;
}

// নিবন্ধনের তথ্য সার্ভারে পাঠানো — শুধু লেখা (JSON); ছবি বা অন্য কোনো ফাইল পাঠানো হয় না, ছবি শুধু ফোনে থাকে
// সফল হলে: { ok: true, card }   ব্যর্থ হলে: { ok: false, message, status?, uniqueCode? }
export async function sendRegistrationToServer(item) {
  try {
    const payload = {
      clientId: item.id, // একই তথ্য দুইবার গেলেও সার্ভারে ডুপ্লিকেট কার্ড হবে না
      name: item.name,
      fatherName: item.fatherName,
      motherName: item.motherName,
      nid: item.nid,
      phone: item.phone,
      dob: item.dob,
      age: item.age,
      ageText: item.ageText,
      gender: item.gender,
      maritalStatus: item.maritalStatus,
      spouseNid: item.spouseNid,
      occupation: item.occupation,
      socialStatus: item.socialStatus,
      ward: item.ward,
      village: item.village,
      upazila: item.upazila,
      district: item.district,
      createdAt: item.createdAt, // কার্ড খোলার (নিবন্ধনের) তারিখ ও সময়
    };

    const res = await authedFetch(API.cards(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));

    if (res.ok && json.card) {
      return { ok: true, card: json.card, duplicate: Boolean(json.duplicate) };
    }

    let message = json.error || 'সার্ভারে তথ্য সংরক্ষণ করা যায়নি।';
    if (Array.isArray(json.details) && json.details.length) {
      message += '\n' + json.details.join('\n');
    }
    return { ok: false, status: res.status, message, uniqueCode: json.uniqueCode };
  } catch (error) {
    console.error('sendRegistrationToServer error:', error);
    return { ok: false, status: 0, message: NETWORK_ERROR_MESSAGE };
  }
}

// কার্ড খুললে/গ্যালারিতে সেভ করলে সার্ভারের ইতিহাসে জানানো (ব্যর্থ হলে চুপচাপ বাদ, অ্যাপ আটকাবে না)
export async function reportCardEvent(uniqueCode, action) {
  try {
    await authedFetch(API.cardEvents(uniqueCode), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
  } catch (e) {
    // উপেক্ষা
  }
}

// ---------- তালিকা দেখা ও মোছা ----------

// ছবি দেখানোর জন্য টোকেন লাগে (Image এর headers এ বসাতে)
export async function getAuthToken() {
  return getToken();
}

// সার্ভার থেকে কার্ডের তালিকা আনা (পাতা ধরে, চাইলে খুঁজে)
// সফল হলে: { ok: true, items, total, page, limit }   ব্যর্থ হলে: { ok: false, status, message }
export async function fetchCardsFromServer({ page = 1, limit = 30, q = '' } = {}) {
  try {
    const query = `page=${page}&limit=${limit}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
    const res = await authedFetch(`${API.cards()}?${query}`);
    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      return {
        ok: true,
        items: Array.isArray(json.items) ? json.items : [],
        total: json.total || 0,
        page: json.page || page,
        limit: json.limit || limit,
      };
    }
    return { ok: false, status: res.status, message: json.error || 'তালিকা আনা যায়নি।' };
  } catch (error) {
    console.error('fetchCardsFromServer error:', error);
    return { ok: false, status: 0, message: NETWORK_ERROR_MESSAGE };
  }
}

// সার্ভার থেকে কার্ড মুছে ফেলা (সার্ভারে শুধু admin পারে; তথ্য ও ইতিহাস সার্ভারে থেকে যায়, "মুছে ফেলা" চিহ্ন বসে)
export async function deleteCardOnServer(uniqueCode) {
  try {
    const res = await authedFetch(API.card(uniqueCode), { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true };
    return { ok: false, status: res.status, message: json.error || 'মুছে ফেলা যায়নি।' };
  } catch (error) {
    console.error('deleteCardOnServer error:', error);
    return { ok: false, status: 0, message: NETWORK_ERROR_MESSAGE };
  }
}
