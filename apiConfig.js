// সার্ভারের ঠিকানা ও API পথ — অ্যাপের সব ফাইল এখান থেকেই সার্ভারের ঠিকানা নেবে
// সার্ভারের ঠিকানা বদলালে (যেমন নতুন কোডস্পেস বা আসল হোস্টিং) শুধু নিচের BASE_URL বদলালেই সব ফাইলে বদলে যাবে

// ↓↓↓ শুধু এই লাইনটি বদলান (শেষে '/' দেবেন না) ↓↓↓
export const BASE_URL = 'https://redesigned-enigma-xr4w5gwqjvjq3prx9-3000.app.github.dev';
// ↑↑↑ ----------------------------------------- ↑↑↑

// অ্যাপ সার্ভারে নিজে নিজে লগইন করতে এই ইউজারনেম/পাসওয়ার্ড ব্যবহার করবে
// সার্ভারে আগে এই ইউজার বানাতে হবে:  node seed.js operator1 পাসওয়ার্ড operator
// সতর্কতা: অ্যাপের ভেতরে রাখা পাসওয়ার্ড APK খুলে দেখা সম্ভব, তাই এখানে admin নয়, সীমিত অনুমতির operator ইউজার দিন
export const APP_LOGIN = {
  username: 'operator1',
  password: 'CHANGE_ME_PASSWORD',
};

// কোনো পথ (যেমন '/api/cards') থেকে পুরো ঠিকানা বানায়
export const apiUrl = (path = '') => `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

// সব API ঠিকানা এক জায়গায়
export const API = {
  health: () => apiUrl('/api/health'),

  // লগইন
  login: () => apiUrl('/api/auth/login'),

  // কার্ডের তথ্য
  cards: () => apiUrl('/api/cards'),                                   // POST: নতুন কার্ড, GET: তালিকা
  card: (code) => apiUrl(`/api/cards/${code}`),                        // GET / PUT / DELETE
  cardPhoto: (code) => apiUrl(`/api/cards/${code}/photo`),             // ব্যক্তির ছবি (লগইন লাগে)
  cardHistory: (code) => apiUrl(`/api/cards/${code}/history`),         // কার্ডের ইতিহাস
  cardEvents: (code) => apiUrl(`/api/cards/${code}/events`),           // card_opened / card_saved জানানো
  cardRestore: (code) => apiUrl(`/api/cards/${code}/restore`),         // মুছে ফেলা কার্ড ফেরানো (admin)

  // কিউআর যাচাই (লগইন লাগে না)
  verify: (code) => apiUrl(`/api/verify/${code}`),
};

export default API;

/*
  ব্যবহারের নিয়ম (অন্য ফাইলে):

  import API from './apiConfig';

  // লগইন
  const res = await fetch(API.login(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  // কার্ডের ইতিহাস দেখা
  const history = await fetch(API.cardHistory(code), {
    headers: { Authorization: `Bearer ${token}` },
  });

  // শুধু ঠিকানা লাগলে (যেমন Image এ)
  import { BASE_URL } from './apiConfig';
*/
