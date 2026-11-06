// সার্ভারের সাথে যোগাযোগের ফাইল: লগইন (নিজে নিজে), টোকেন জমানো, নিবন্ধনের তথ্য পাঠানো
import AsyncStorage from '@react-native-async-storage/async-storage';
import API, { APP_LOGIN } from '../apiConfig';

const TOKEN_KEY = 'server_auth_token';
const TIMEOUT_MS = 25000;

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

// সার্ভারে লগইন করে টোকেন জমিয়ে রাখা
async function loginAndStoreToken() {
  const res = await fetchWithTimeout(API.login(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(APP_LOGIN),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.token) {
    throw new Error(json.error || 'সার্ভারে লগইন করা যায়নি।');
  }
  await AsyncStorage.setItem(TOKEN_KEY, json.token);
  return json.token;
}

// জমানো টোকেন থাকলে সেটা, না থাকলে নতুন লগইন
async function getToken(forceNew = false) {
  if (!forceNew) {
    const saved = await AsyncStorage.getItem(TOKEN_KEY);
    if (saved) return saved;
  }
  return loginAndStoreToken();
}

// টোকেনসহ অনুরোধ পাঠানো; টোকেনের মেয়াদ শেষ (401) হলে নিজে নতুন লগইন করে একবার আবার চেষ্টা
async function authedFetch(url, options = {}) {
  let token = await getToken();
  let res = await fetchWithTimeout(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    token = await getToken(true);
    res = await fetchWithTimeout(url, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
    });
  }
  return res;
}

const guessMime = (uri) => {
  const lower = String(uri).toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
};

// নিবন্ধনের তথ্য (ও ছবি) সার্ভারে পাঠানো
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

    // ছবি ও তথ্য একসাথে (multipart); Content-Type নিজে বসানো যাবে না, নাহলে সীমানা (boundary) হারায়
    const form = new FormData();
    form.append('data', JSON.stringify(payload));
    if (item.image) {
      form.append('photo', { uri: item.image, name: 'photo.jpg', type: guessMime(item.image) });
    }

    const res = await authedFetch(API.cards(), { method: 'POST', body: form });
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
    return {
      ok: false,
      status: 0,
      message: 'সার্ভারের সাথে যোগাযোগ করা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।',
    };
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

const NETWORK_ERROR_MESSAGE = 'সার্ভারের সাথে যোগাযোগ করা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।';

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
