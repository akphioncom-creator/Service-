export const BASE_URL = 'https://redesigned-enigma-xr4w5gwqjvjq3prx9-3000.app.github.dev';
// ↑↑↑ ----------------------------------------- ↑↑↑

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
