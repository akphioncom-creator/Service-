// সার্ভারের সাথে যোগাযোগের ফাইল: পাসওয়ার্ড দিয়ে লগইন, টোকেন জমানো, নিবন্ধনের তথ্য পাঠানো, তালিকা আনা
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../apiConfig';

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

// ---------- পাসওয়ার্ড বদলানো ----------

// বর্তমান পাসওয়ার্ড ঠিক কিনা সার্ভারে যাচাই (ভুল হলে এখান থেকে লগআউট হয় না)
// সফল হলে: { ok: true }   ব্যর্থ হলে: { ok: false, message }
export async function verifyCurrentPasswordOnServer(password) {
  try {
    const res = await authedFetch(API.verifyPassword(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true };
    return { ok: false, status: res.status, message: json.error || 'পাসওয়ার্ড যাচাই করা যায়নি।' };
  } catch (error) {
    console.error('verifyCurrentPasswordOnServer error:', error);
    return { ok: false, status: 0, message: NETWORK_ERROR_MESSAGE };
  }
}

// পাসওয়ার্ড বদলানো: সার্ভার বর্তমান পাসওয়ার্ড আবার যাচাই করে নতুনটি সংরক্ষণ করে
// সফল হলে সার্ভারের দেওয়া নতুন টোকেন ফোনে বসে যায় (এই ফোনে আবার লগইন লাগে না; অন্য ফোনে নতুন পাসওয়ার্ড দিয়ে ঢুকতে হবে)
// সফল হলে: { ok: true }   ব্যর্থ হলে: { ok: false, message }
export async function changePasswordOnServer(currentPassword, newPassword) {
  try {
    const res = await authedFetch(API.changePassword(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const json = await res.json().catch(() => ({}));

    if (res.ok && json.token) {
      await AsyncStorage.setItem(TOKEN_KEY, json.token);
      return { ok: true };
    }
    return { ok: false, status: res.status, message: json.error || 'পাসওয়ার্ড বদলানো যায়নি।' };
  } catch (error) {
    console.error('changePasswordOnServer error:', error);
    return { ok: false, status: 0, message: NETWORK_ERROR_MESSAGE };
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
      areaType: item.areaType, // ইউনিয়ন বা পৌরসভা
      areaName: item.areaName, // ইউনিয়ন/পৌরসভার নাম
      ward: item.ward,
      village: item.village, // এখন areaName-এর সমান (পুরোনো সার্ভার কোডের জন্য)
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

// এনআইডি নম্বর সার্ভারে আগে থেকেই আছে কিনা দেখা
// সফল হলে: { ok: true, exists: true/false }   ব্যর্থ হলে: { ok: false, message }
export async function checkNidOnServer(nid) {
  try {
    const res = await authedFetch(API.checkNid(nid));
    const json = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, exists: Boolean(json.exists) };
    return { ok: false, status: res.status, message: json.error || 'এনআইডি যাচাই করা যায়নি।' };
  } catch (error) {
    console.error('checkNidOnServer error:', error);
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

// ---------- অনুদানের কার্ড স্ক্যান ----------

// পারসন লিস্ট ও কিউআর স্ক্যানারের সাথে একই স্টোরেজ কী (ফোনে থাকা নিজস্ব তালিকা)
const PERSON_LIST_KEY = 'persistent_numbers_data';

// ফোনের তালিকায় (পারসন লিস্টের জন্য) স্ক্যান চিহ্ন মিলিয়ে রাখা; ব্যর্থ হলে চুপচাপ বাদ
// scannedAt থাকলে "স্ক্যান হয়েছে" বসে, null হলে চিহ্ন মুছে যায়; code না দিলে সব কার্ড
async function mirrorScanLocally(scannedAt, code) {
  try {
    const data = await AsyncStorage.getItem(PERSON_LIST_KEY);
    const list = data ? JSON.parse(data) : [];
    if (!Array.isArray(list)) return;

    let changed = false;
    list.forEach((person) => {
      if (code && String(person.uniqueCode) !== String(code)) return;
      if (scannedAt) {
        person.scanned = true;
        person.scannedAt = scannedAt;
      } else {
        delete person.scanned;
        delete person.scannedAt;
      }
      changed = true;
    });
    if (changed) await AsyncStorage.setItem(PERSON_LIST_KEY, JSON.stringify(list));
  } catch (e) {
    // উপেক্ষা
  }
}

// কিউআর কোড সার্ভারে যাচাই ও "স্ক্যান হয়েছে" চিহ্ন বসানো
// সার্ভারের উত্তর পেলে: { ok: true, status: 'success' | 'duplicate' | 'notfound', card?, summary? }
// সার্ভারে যোগাযোগ না হলে বা অন্য ত্রুটি হলে: { ok: false, message }  (এটাকে "নিবন্ধিত নয়" ধরা যাবে না)
export async function scanCardOnServer(code) {
  try {
    const res = await authedFetch(API.cardScan(code), { method: 'POST' });
    const json = await res.json().catch(() => ({}));

    // শুধু সার্ভার নিজে 'status' দিলেই সেটা আসল ফলাফল; ঠিকানা না পাওয়ার (পুরোনো সার্ভার) 404 ও এখানে আসবে না
    if (json && ['success', 'duplicate', 'notfound'].includes(json.status)) {
      if (json.card && json.card.scannedAt && json.status !== 'notfound') {
        await mirrorScanLocally(json.card.scannedAt, code);
      }
      return { ok: true, status: json.status, card: json.card, summary: json.summary };
    }
    return { ok: false, status: res.status, message: json.error || 'কার্ড যাচাই করা যায়নি।' };
  } catch (error) {
    console.error('scanCardOnServer error:', error);
    return { ok: false, status: 0, message: NETWORK_ERROR_MESSAGE };
  }
}

// স্ক্যানের অগ্রগতি: { ok: true, total, scanned }
export async function fetchScanSummary() {
  try {
    const res = await authedFetch(API.scansSummary());
    const json = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, total: json.total || 0, scanned: json.scanned || 0 };
    return { ok: false, status: res.status, message: json.error || 'অগ্রগতি আনা যায়নি।' };
  } catch (error) {
    return { ok: false, status: 0, message: NETWORK_ERROR_MESSAGE };
  }
}

// নতুন দফা শুরু (রিস্টার্ট): সব কার্ডের স্ক্যান চিহ্ন মুছে আবার সবাইকে স্ক্যান করা যাবে (সার্ভারে শুধু admin পারে)
// সফল হলে ফোনের পারসন লিস্টের স্ক্যান চিহ্নও মুছে যায়। সফল হলে: { ok: true, cleared }
export async function resetAllScansOnServer() {
  try {
    const res = await authedFetch(API.scansReset(), { method: 'POST' });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      await mirrorScanLocally(null, null);
      return { ok: true, cleared: json.cleared || 0 };
    }
    return { ok: false, status: res.status, message: json.error || 'রিস্টার্ট করা যায়নি।' };
  } catch (error) {
    console.error('resetAllScansOnServer error:', error);
    return { ok: false, status: 0, message: NETWORK_ERROR_MESSAGE };
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