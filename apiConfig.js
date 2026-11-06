export const BASE_URL = 'https://redesigned-enigma-xr4w5gwqjvjq3prx9-3000.app.github.dev';
// ↑↑↑ ----------------------------------------- ↑↑↑

// কোনো পথ (যেমন '/api/cards') থেকে পুরো ঠিকানা বানায়
export const apiUrl = (path = '') => `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

// সব API ঠিকানা এক জায়গায়
export const API = {
  health: () => apiUrl('/api/health'),

  // লগইন: অ্যাপ শুধু পাসওয়ার্ড পাঠায়, পাসওয়ার্ড ঠিক কিনা সার্ভার ঠিক করে
  appLogin: () => apiUrl('/api/auth/app-login'),
  login: () => apiUrl('/api/auth/login'), // ইউজারনেম+পাসওয়ার্ড লগইন (অ্যাডমিনের জন্য)

  // কার্ডের তথ্য
  cards: () => apiUrl('/api/cards'),                                   // POST: নতুন কার্ড, GET: তালিকা
  checkNid: (nid) => apiUrl(`/api/cards/check-nid/${encodeURIComponent(nid)}`), // এনআইডি সার্ভারে আছে কিনা
  card: (code) => apiUrl(`/api/cards/${code}`),                        // GET / PUT / DELETE
  cardPhoto: (code) => apiUrl(`/api/cards/${code}/photo`),             // ব্যক্তির ছবি (লগইন লাগে)
  cardHistory: (code) => apiUrl(`/api/cards/${code}/history`),         // কার্ডের ইতিহাস
  cardEvents: (code) => apiUrl(`/api/cards/${code}/events`),           // card_opened / card_saved জানানো
  cardRestore: (code) => apiUrl(`/api/cards/${code}/restore`),         // মুছে ফেলা কার্ড ফেরানো (admin)

  // অনুদানের কার্ড স্ক্যান
  cardScan: (code) => apiUrl(`/api/cards/${code}/scan`),               // POST: স্ক্যান (একবারই চলবে)
  scansSummary: () => apiUrl('/api/cards/scans/summary'),              // GET: মোট ও স্ক্যান হওয়া কার্ডের সংখ্যা
  scansReset: () => apiUrl('/api/cards/scans/reset'),                  // POST: নতুন দফা শুরু, সব কার্ড আবার স্ক্যানযোগ্য (admin)

  // কিউআর যাচাই (লগইন লাগে না)
  verify: (code) => apiUrl(`/api/verify/${code}`),
};

export default API;

/*
  ব্যবহারের নিয়ম (অন্য ফাইলে):

  import API from './apiConfig';

  // কার্ডের ইতিহাস দেখা (টোকেন serverApi.js নিজে সামলায়, সরাসরি fetch না করে সেখানকার ফাংশন ব্যবহার করুন)

  // কার্ডের ইতিহাস দেখা
  const history = await fetch(API.cardHistory(code), {
    headers: { Authorization: `Bearer ${token}` },
  });

  // শুধু ঠিকানা লাগলে (যেমন Image এ)
  import { BASE_URL } from './apiConfig';
*/