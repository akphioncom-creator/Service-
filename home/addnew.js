import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, Image, ScrollView, Keyboard, Platform, Modal, ActivityIndicator, Animated, Easing, useWindowDimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
// ছবি ক্রপ করে সেভ করার জন্য (card.js-এ আগে থেকেই ব্যবহার হচ্ছে, তাই নতুন কোনো প্যাকেজ লাগছে না)
import { captureRef } from 'react-native-view-shot';
// সার্ভারে নিবন্ধনের তথ্য পাঠানোর ফাইল
import { sendRegistrationToServer } from './serverApi';

const STORAGE_KEY = 'smart_cards_data';

// ক্রপ করা ছবির মাপ (dp): ক্যামেরার ফ্রেমের ভেতরের অংশ এই মাপের বর্গাকার ছবি হয়ে সেভ হবে
const CROP_DP = 480;

// ক্যামেরা ঘোরানোর আইকন: লোডিং-এর মতো গোল রিং ও তীরের মাথা — কোনো প্যাকেজ ছাড়া শুধু View দিয়ে আঁকা
function RotateIcon({ size = 30, color = '#fff' }) {
  const w = Math.max(2, Math.round(size * 0.11));
  const hs = Math.round(size * 0.4);
  const r = size / 2 - w / 2;
  const c = size / 2;
  const theta = (315 * Math.PI) / 180; // রিংয়ের ফাঁকের বাম প্রান্ত (১০:৩০ এর দিক)
  const px = c + r * Math.sin(theta);
  const py = c - r * Math.cos(theta);

  return (
    <View style={{ width: size, height: size }}>
      {/* গোল রিং, উপরের অংশে ফাঁক */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: w,
          borderColor: color,
          borderTopColor: 'transparent',
        }}
      />
      {/* ফাঁকের দিকে মুখ করা তীরের মাথা (ত্রিভুজ) */}
      <View
        style={{
          position: 'absolute',
          left: px - hs / 2,
          top: py - hs / 2,
          width: 0,
          height: 0,
          borderLeftWidth: hs / 2,
          borderRightWidth: hs / 2,
          borderBottomWidth: hs,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

// ড্রপডাউনের অপশনসমূহ
const OCCUPATION_OPTIONS = ['কৃষক', 'শ্রমিক', 'ব্যবসায়ী', 'গৃহিণী', 'অন্যান্য'];
const GENDER_OPTIONS = ['পুরুষ', 'মহিলা', 'তৃতীয় লিঙ্গ'];
const MARITAL_OPTIONS = ['বিবাহিত', 'অবিবাহিত', 'বিধবা', 'বিপত্নিক'];
// সামাজিক অবস্থান (হতদরিদ্র, দরিদ্র, মধ্যবিত্ত, প্রতিবন্ধী) — অপশন ও কার্ডে ইংরেজিতে দেখানো হবে
const SOCIAL_STATUS_OPTIONS = ['Extremely Poor', 'Poor', 'Middle Class', 'Disabled'];
const MARRIED = 'বিবাহিত';

// বাংলা সংখ্যা (০-৯) কে ইংরেজি সংখ্যায় রূপান্তর
const toEnglishDigits = (text) =>
  String(text).replace(/[০-৯]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x09e6 + 48));

// জন্ম তারিখ (DD/MM/YYYY) সঠিক কিনা যাচাই।
// দিন বা মাস জানা না থাকলে ০০ দেওয়া যাবে: মাস ০০ হলে শুধু বছর ধরে, দিন ০০ হলে বছর ও মাস ধরে বয়স হিসাব হবে।
const isValidDob = (value) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return false;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year < 1900 || year > currentYear) return false;
  if (month > 12 || day > 31) return false;

  // মাস অজানা (০০): শুধু বছর দিয়েই গ্রহণযোগ্য
  if (month === 0) return true;

  // ভবিষ্যতের মাস নয়
  if (year === currentYear && month > currentMonth) return false;

  // দিন অজানা (০০): বছর ও মাস দিয়েই গ্রহণযোগ্য
  if (day === 0) return true;

  // দিন-মাস-বছর পূর্ণ: বাস্তব তারিখ ও ভবিষ্যতের নয়
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return false;
  }

  return date.getTime() <= now.getTime();
};

// ইংরেজি সংখ্যাকে বাংলা সংখ্যায় রূপান্তর (বয়স দেখানোর জন্য)
const toBengaliDigits = (value) =>
  String(value).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);

// জন্ম তারিখ (DD/MM/YYYY) থেকে আজকের তারিখ পর্যন্ত বয়স হিসাব করা:
// - পুরো তারিখ জানা থাকলে: বছর, মাস, দিন
// - দিন ০০ হলে: বছর ও মাস
// - মাস ০০ হলে: শুধু বছর (বছর-ভিত্তিক আনুমানিক হিসাব)
const calculateAge = (value) => {
  if (!isValidDob(value)) return null;

  const [dayStr, monthStr, yearStr] = value.split('/');
  const birthDay = parseInt(dayStr, 10);
  const birthMonth = parseInt(monthStr, 10);
  const birthYear = parseInt(yearStr, 10);

  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  let years = todayYear - birthYear;

  // মাস অজানা: শুধু বছর
  if (birthMonth === 0) {
    return {
      years,
      months: null,
      days: null,
      text: `${toBengaliDigits(years)} বছর`,
    };
  }

  let months = todayMonth - birthMonth;

  // দিন অজানা: বছর ও মাস
  if (birthDay === 0) {
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    return {
      years,
      months,
      days: null,
      text: `${toBengaliDigits(years)} বছর ${toBengaliDigits(months)} মাস`,
    };
  }

  // পুরো তারিখ জানা: বছর, মাস, দিন
  let days = todayDay - birthDay;
  if (days < 0) {
    months -= 1;
    // আগের মাসের মোট দিন যোগ করা
    days += new Date(todayYear, today.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return {
    years,
    months,
    days,
    text: `${toBengaliDigits(years)} বছর ${toBengaliDigits(months)} মাস ${toBengaliDigits(days)} দিন`,
  };
};

// চাপ দিলে অপশন খোলে, একটি সিলেক্ট করা যায় — এমন ড্রপডাউন কম্পোনেন্ট
function DropdownField({ label, value, placeholder, options, onSelect, onOpen }) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    Keyboard.dismiss();
    const next = !open;
    setOpen(next);
    if (next && onOpen) onOpen();
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity
        style={[styles.input, styles.dropdownBox]}
        onPress={toggle}
        activeOpacity={0.7}
      >
        <Text style={value ? styles.dropdownValue : styles.dropdownPlaceholder}>
          {value || placeholder}
        </Text>
        <Text style={styles.dropdownArrow}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={styles.optionsBox}>
          {options.map((option) => {
            const selected = option === value;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.optionItem, selected && styles.optionItemSelected]}
                onPress={() => {
                  onSelect(option);
                  setOpen(false);
                }}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function AddNewScreen({ onNext, onBack }) {
  const [image, setImage] = useState(null);

  // ক্যামেরা সংক্রান্ত স্টেট: ক্যামেরা মডাল খোলা আছে কিনা, কোন ক্যামেরা (সামনে/পিছনে), ছবি তোলা চলছে কিনা
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('back');
  const [isCapturing, setIsCapturing] = useState(false);
  // সার্ভারে পাঠানোর সময় বাটন বন্ধ রাখতে (দুইবার চাপ ঠেকাতে)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cameraRef = useRef(null);
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  // ক্যামেরার মাঝের বর্গাকার ফ্রেমের মাপ: শুধু এই ফ্রেমের ভেতরের অংশটুকুই সেভ হবে
  const frameSize = Math.min(winWidth * 0.88, winHeight * 0.5);
  // তোলা ছবি ক্রপ করার কাজ (ছবির তথ্য থাকলে অদৃশ্য ভিউতে বসিয়ে মাঝের বর্গ অংশ ক্যাপচার হয়)
  const [cropJob, setCropJob] = useState(null);
  const cropRef = useRef(null);
  const cropDoneRef = useRef(false);
  // ক্যামেরা ঘোরানোর আইকনের ঘূর্ণন অ্যানিমেশন
  const spinValue = useRef(new Animated.Value(0)).current;
  const spinCountRef = useRef(0);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [name, setName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [nid, setNid] = useState('');
  const [phone, setPhone] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [gender, setGender] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [spouseNid, setSpouseNid] = useState('');
  const [occupation, setOccupation] = useState('');
  const [socialStatus, setSocialStatus] = useState('');
  const [ward, setWard] = useState('');
  const [village, setVillage] = useState('');
  const [upazila, setUpazila] = useState('');
  const [district, setDistrict] = useState('');

  // জন্ম তারিখ: দিন, মাস, বছরের তিনটি ঘর থেকে একত্র করা (এক সংখ্যার দিন/মাসের আগে নিজে থেকে ০ বসবে)
  const dayPart = dobDay.length === 1 ? '0' + dobDay : dobDay;
  const monthPart = dobMonth.length === 1 ? '0' + dobMonth : dobMonth;
  const dob =
    dayPart.length === 2 && monthPart.length === 2 && dobYear.length === 4
      ? `${dayPart}/${monthPart}/${dobYear}`
      : '';

  // জন্ম তারিখ সঠিক হলে বয়স নিজে থেকে হিসাব হবে, না হলে null
  const ageInfo = calculateAge(dob);

  // কিবোর্ডের উচ্চতা, যাতে কিবোর্ড খোলা থাকলেও নিচের ঘরগুলো স্ক্রল করে দেখা যায়
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef(null);

  // দিন, মাস, বছরের ঘরের রেফ (এক ঘর পূর্ণ হলে পরের ঘরে কার্সর নেওয়ার জন্য)
  const dayRef = useRef(null);
  const monthRef = useRef(null);
  const yearRef = useRef(null);

  // শুধু সংখ্যা রাখা (বাংলা সংখ্যা লিখলেও ইংরেজিতে বদলে যাবে)
  const cleanDigits = (text, max) => toEnglishDigits(text).replace(/\D/g, '').slice(0, max);

  // দিন: সর্বোচ্চ ৩১ (০০ মানে দিন অজানা)। ৩১ এর বেশি লেখা যাবে না।
  const handleDayChange = (text) => {
    const value = cleanDigits(text, 2);

    // প্রথম সংখ্যা ৪-৯ হলে দিন এক সংখ্যারই হবে (যেমন ৫ => ০৫), তাই নিজে থেকে ০ বসিয়ে পরের ঘরে যাবে
    if (value.length === 1 && parseInt(value, 10) > 3) {
      setDobDay('0' + value);
      if (monthRef.current) monthRef.current.focus();
      return;
    }

    // দুই সংখ্যা ৩১ এর বেশি হলে গ্রহণ করা হবে না (আগের মানই থাকবে)
    if (value.length === 2 && parseInt(value, 10) > 31) return;

    setDobDay(value);
    if (value.length === 2 && monthRef.current) monthRef.current.focus();
  };

  // মাস: সর্বোচ্চ ১২ (০০ মানে মাস অজানা)। ১২ এর বেশি লেখা যাবে না।
  const handleMonthChange = (text) => {
    const value = cleanDigits(text, 2);

    // প্রথম সংখ্যা ২-৯ হলে মাস এক সংখ্যারই হবে (যেমন ৫ => ০৫), তাই নিজে থেকে ০ বসিয়ে পরের ঘরে যাবে
    if (value.length === 1 && parseInt(value, 10) > 1) {
      setDobMonth('0' + value);
      if (yearRef.current) yearRef.current.focus();
      return;
    }

    // দুই সংখ্যা ১২ এর বেশি হলে গ্রহণ করা হবে না (আগের মানই থাকবে)
    if (value.length === 2 && parseInt(value, 10) > 12) return;

    setDobMonth(value);
    if (value.length === 2 && yearRef.current) yearRef.current.focus();
  };

  // বছর: সর্বোচ্চ ৪ সংখ্যা, ৪ সংখ্যার বেশি লেখা যাবে না
  const handleYearChange = (text) => {
    setDobYear(cleanDigits(text, 4));
  };

  // ঘর থেকে বেরোনোর সময় এক সংখ্যা থাকলে আগে ০ বসানো (যেমন ৫ => ০৫)
  const padOnBlur = (value, setter) => {
    if (value.length === 1) setter('0' + value);
    handleFieldBlur();
  };

  // ঘর খালি থাকা অবস্থায় ব্যাকস্পেস চাপলে আগের ঘরে ফেরা
  const handleBackspaceToPrev = (value, prevRef) => ({ nativeEvent }) => {
    if (nativeEvent.key === 'Backspace' && value === '' && prevRef.current) {
      prevRef.current.focus();
    }
  };

  // প্রতিটি ঘরের অবস্থান (y) ও বর্তমানে ফোকাসে থাকা ঘর মনে রাখার জন্য
  const fieldYRef = useRef({});
  const focusedFieldRef = useRef(null);

  const onFieldLayout = (key) => (e) => {
    fieldYRef.current[key] = e.nativeEvent.layout.y;
  };

  // নির্দিষ্ট ঘরটি স্ক্রল করে কিবোর্ডের উপরে দৃশ্যমান জায়গায় আনা (একটু দেরিতে, যাতে নিচের ফাঁকা জায়গা আগে তৈরি হয়ে যায়)
  const scrollToField = (key) => {
    setTimeout(() => {
      const y = fieldYRef.current[key];
      if (scrollRef.current && y !== undefined) {
        scrollRef.current.scrollTo({ y: Math.max(0, y - 100), animated: true });
      }
    }, 250);
  };

  const handleFieldFocus = (key) => {
    focusedFieldRef.current = key;
    scrollToField(key);
  };

  const handleFieldBlur = () => {
    focusedFieldRef.current = null;
  };

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates ? e.endCoordinates.height : 0);
      // কোনো ঘরে ফোকাস থাকলে কিবোর্ড আসার পর সেই ঘর স্ক্রল করে দেখানো হবে
      if (focusedFieldRef.current) {
        scrollToField(focusedFieldRef.current);
      }
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // গ্যালারি থেকে ছবি বাছাই করার ফাংশন (আগের মতোই ১:১ ক্রপ সহ)
  const pickImageFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('ত্রুটি', 'গ্যালারি খুলতে সমস্যা হয়েছে।');
    }
  };

  // ছবির ঘরে চাপ দিলে ক্যামেরা খুলবে। অনুমতি না দিলে সরাসরি গ্যালারি খুলবে
  const openCamera = async () => {
    Keyboard.dismiss();

    let granted = cameraPermission && cameraPermission.granted;
    if (!granted) {
      const response = await requestCameraPermission();
      granted = response && response.granted;
    }

    if (!granted) {
      Alert.alert('অনুমতি প্রয়োজন', 'ক্যামেরা ব্যবহারের অনুমতি পাওয়া যায়নি, তাই গ্যালারি থেকে ছবি বাছাই করুন।');
      pickImageFromGallery();
      return;
    }

    setCameraFacing('back');
    setCameraVisible(true);
  };

  const closeCamera = () => {
    setCameraVisible(false);
  };

  // ছবির আসল মাপ জানা (ক্রপের হিসাবের জন্য)
  const getImageSize = (uri) =>
    new Promise((resolve, reject) => {
      Image.getSize(uri, (w, h) => resolve({ w, h }), reject);
    });

  // ক্যামেরার মাঝের বাটনে চাপ দিলে ছবি তোলা হবে।
  // পুরো ছবি সেভ হয় না: ক্যামেরার মাঝের বর্গাকার ফ্রেমে যতটুকু দেখা যাচ্ছিল শুধু ততটুকু কেটে সেভ হয়
  const takePicture = async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (photo && photo.uri) {
        const size = await getImageSize(photo.uri);
        cropDoneRef.current = false;
        // এখান থেকে ক্রপের কাজ handleCropImageLoaded এ চলবে; সেখানে শেষ হলে isCapturing বন্ধ হবে
        setCropJob({ uri: photo.uri, w: size.w, h: size.h });
        return;
      }
      setIsCapturing(false);
    } catch (error) {
      console.error('Camera capture error:', error);
      Alert.alert('ত্রুটি', 'ছবি তুলতে সমস্যা হয়েছে।');
      setIsCapturing(false);
    }
  };

  // অদৃশ্য ভিউতে ছবি আঁকা হয়ে গেলে মাঝের বর্গ অংশটুকু ক্যাপচার করে ফর্মের ছবি হিসেবে বসানো
  const handleCropImageLoaded = () => {
    if (cropDoneRef.current || !cropJob) return;
    cropDoneRef.current = true;

    setTimeout(async () => {
      try {
        const croppedUri = await captureRef(cropRef, { format: 'jpg', quality: 0.9 });
        setImage(croppedUri);
        setCameraVisible(false);
      } catch (error) {
        console.error('Crop error:', error);
        Alert.alert('ত্রুটি', 'ছবি কেটে সংরক্ষণ করতে সমস্যা হয়েছে, আবার চেষ্টা করুন।');
      } finally {
        setCropJob(null);
        setIsCapturing(false);
      }
    }, 120);
  };

  // ক্যামেরার বাম পাশের গ্যালারি বাটন: ক্যামেরা বন্ধ করে গ্যালারি খোলা হবে
  // (ক্যামেরা মডাল পুরো বন্ধ হওয়ার জন্য একটু অপেক্ষা, নাহলে আইফোনে গ্যালারি খুলতে সমস্যা হয়)
  const openGalleryFromCamera = () => {
    setCameraVisible(false);
    setTimeout(() => {
      pickImageFromGallery();
    }, 400);
  };

  const toggleCameraFacing = () => {
    setCameraFacing((prev) => (prev === 'back' ? 'front' : 'back'));
    // প্রতিবার চাপলে আইকন ১৮০° ঘুরবে
    spinCountRef.current += 1;
    Animated.timing(spinValue, {
      toValue: spinCountRef.current,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  // বৈবাহিক অবস্থা পরিবর্তন: "বিবাহিত" ছাড়া অন্য কিছু হলে স্বামী/স্ত্রীর এনআইডি মুছে যাবে
  const handleMaritalSelect = (option) => {
    setMaritalStatus(option);
    if (option !== MARRIED) {
      setSpouseNid('');
    }
  };

  // ডেটা সেভ এবং নেক্সট স্ক্রিনে যাওয়ার ফাংশন
  const handleNext = async () => {
    if (isSubmitting) return;
    if (
      !name.trim() || !fatherName.trim() || !motherName.trim() || !nid.trim() || !phone.trim() ||
      !dob.trim() || !gender || !maritalStatus || !occupation || !socialStatus || !ward.trim() ||
      !village.trim() || !upazila.trim() || !district.trim()
    ) {
      Alert.alert('সতর্কতা', 'দয়া করে সবগুলো ঘর সঠিকভাবে পূরণ করুন!');
      return;
    }

    if (!isValidDob(dob.trim())) {
      Alert.alert('সতর্কতা', 'জন্ম তারিখ সঠিক নয়! দিন, মাস ও বছর সঠিকভাবে লিখুন (যেমন: 25 / 12 / 1990)। দিন বা মাস জানা না থাকলে ০০ লিখুন।');
      return;
    }

    // বিবাহিত হলে স্বামী/স্ত্রীর এনআইডি বাধ্যতামূলক
    if (maritalStatus === MARRIED && !spouseNid.trim()) {
      Alert.alert('সতর্কতা', 'বিবাহিত হলে স্বামী/স্ত্রীর এনআইডি কার্ড নম্বর দেওয়া বাধ্যতামূলক!');
      return;
    }

    setIsSubmitting(true);
    try {
      const existingData = await AsyncStorage.getItem(STORAGE_KEY);
      let list = existingData ? JSON.parse(existingData) : [];

      if (list.length >= 2000) {
        Alert.alert('লিমিট পূর্ণ', 'সর্বোচ্চ ২০০০টি ডেটার সীমা পূর্ণ হয়ে গেছে!');
        return;
      }

      const newItem = {
        id: Date.now().toString(),
        image,
        name: name.trim(),
        fatherName: fatherName.trim(),
        motherName: motherName.trim(),
        nid: nid.trim(),
        phone: phone.trim(),
        dob: dob.trim(),
        age: ageInfo ? ageInfo.years : null,
        ageText: ageInfo ? ageInfo.text : '',
        gender,
        maritalStatus,
        spouseNid: maritalStatus === MARRIED ? spouseNid.trim() : '',
        occupation,
        socialStatus,
        ward: ward.trim(),
        village: village.trim(),
        upazila: upazila.trim(),
        district: district.trim(),
        // কার্ড খোলার (নিবন্ধনের) তারিখ: যে মুহূর্তে তথ্য জমা দেওয়া হচ্ছে সেই সময়, সার্ভারে যাবে
        createdAt: new Date().toISOString()
      };

      // মূল কাজ: আগে সার্ভারে সংরক্ষণ। সার্ভারে সংরক্ষণ না হলে কার্ড খোলা হবে না
      const result = await sendRegistrationToServer(newItem);

      if (!result.ok) {
        if (result.status === 409) {
          Alert.alert('আগেই নিবন্ধিত', 'এই এনআইডি দিয়ে কার্ড আগেই তৈরি করা আছে।');
        } else {
          Alert.alert('সার্ভারে সংরক্ষণ হয়নি', result.message);
        }
        return;
      }

      // সার্ভারের তৈরি ইউনিক কোড ও কার্ড খোলার তারিখ বসিয়ে নেওয়া (কিউআর কোডে এই কোডই যাবে)
      newItem.uniqueCode = result.card.uniqueCode;
      newItem.createdAt = result.card.createdAt;

      list.unshift(newItem);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));

      // সফলভাবে সেভ হওয়ার পর card.js (onNext) এ ডেটা পাঠিয়ে দেওয়া
      if (onNext) {
        onNext(newItem);
      }
    } catch (error) {
      Alert.alert('ত্রুটি', 'ডেটা সংরক্ষণ করতে সমস্যা হয়েছে।');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={[styles.container, { paddingBottom: 15 + keyboardHeight }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.mainTitle}>Smart Card Register</Text>

      {/* ফটো আপলোড অপশন */}
      <View style={styles.imageContainer}>
        <TouchableOpacity style={styles.imagePickerBtn} onPress={openCamera}>
          {image ? (
            <Image source={{ uri: image }} style={styles.previewImage} />
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Image source={{ uri: 'ic_camera' }} style={styles.imagePickerIcon} resizeMode="contain" />
              <Text style={styles.imagePickerText}>ছবি তুলুন</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ইনপুট ফিল্ডসমূহ */}
      <View style={styles.inputGroup} onLayout={onFieldLayout('name')}>
        <Text style={styles.label}>Name (নাম):</Text>
        <TextInput
          style={styles.input}
          placeholder="ব্যক্তির নাম লিখুন..."
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
          onFocus={() => handleFieldFocus('name')}
          onBlur={handleFieldBlur}
        />
      </View>

      <View style={styles.inputGroup} onLayout={onFieldLayout('fatherName')}>
        <Text style={styles.label}>Father's Name (পিতার নাম):</Text>
        <TextInput
          style={styles.input}
          placeholder="পিতার নাম লিখুন..."
          placeholderTextColor="#999"
          value={fatherName}
          onChangeText={setFatherName}
          onFocus={() => handleFieldFocus('fatherName')}
          onBlur={handleFieldBlur}
        />
      </View>

      <View style={styles.inputGroup} onLayout={onFieldLayout('motherName')}>
        <Text style={styles.label}>Mother's Name (মাতার নাম):</Text>
        <TextInput
          style={styles.input}
          placeholder="মাতার নাম লিখুন..."
          placeholderTextColor="#999"
          value={motherName}
          onChangeText={setMotherName}
          onFocus={() => handleFieldFocus('motherName')}
          onBlur={handleFieldBlur}
        />
      </View>

      <View style={styles.inputGroup} onLayout={onFieldLayout('nid')}>
        <Text style={styles.label}>NID Card No. (এনআইডি নম্বর):</Text>
        <TextInput
          style={styles.input}
          placeholder="এনআইডি কার্ড নম্বর লিখুন..."
          placeholderTextColor="#999"
          value={nid}
          onChangeText={setNid}
          keyboardType="numeric"
          onFocus={() => handleFieldFocus('nid')}
          onBlur={handleFieldBlur}
        />
      </View>

      <View style={styles.inputGroup} onLayout={onFieldLayout('phone')}>
        <Text style={styles.label}>Phone Number (ফোন নম্বর):</Text>
        <TextInput
          style={styles.input}
          placeholder="ফোন নম্বর লিখুন..."
          placeholderTextColor="#999"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          onFocus={() => handleFieldFocus('phone')}
          onBlur={handleFieldBlur}
        />
      </View>

      <View style={styles.inputGroup} onLayout={onFieldLayout('dob')}>
        <Text style={styles.label}>Date of Birth (জন্ম তারিখ):</Text>
        <View style={styles.dobRow}>
          <TextInput
            ref={dayRef}
            style={[styles.input, styles.dobBox]}
            placeholder="দিন"
            placeholderTextColor="#999"
            value={dobDay}
            onChangeText={handleDayChange}
            keyboardType="numeric"
            maxLength={2}
            onFocus={() => handleFieldFocus('dob')}
            onBlur={() => padOnBlur(dobDay, setDobDay)}
          />
          <TextInput
            ref={monthRef}
            style={[styles.input, styles.dobBox]}
            placeholder="মাস"
            placeholderTextColor="#999"
            value={dobMonth}
            onChangeText={handleMonthChange}
            keyboardType="numeric"
            maxLength={2}
            onKeyPress={handleBackspaceToPrev(dobMonth, dayRef)}
            onFocus={() => handleFieldFocus('dob')}
            onBlur={() => padOnBlur(dobMonth, setDobMonth)}
          />
          <TextInput
            ref={yearRef}
            style={[styles.input, styles.dobBox, styles.dobYearBox]}
            placeholder="বছর"
            placeholderTextColor="#999"
            value={dobYear}
            onChangeText={handleYearChange}
            keyboardType="numeric"
            maxLength={4}
            onKeyPress={handleBackspaceToPrev(dobYear, monthRef)}
            onFocus={() => handleFieldFocus('dob')}
            onBlur={handleFieldBlur}
          />
        </View>
        <Text style={styles.hintText}>দিন সর্বোচ্চ ৩১, মাস সর্বোচ্চ ১২ এবং বছর ৪ সংখ্যার হবে। দিন বা মাস জানা না থাকলে ০০ লিখুন</Text>
      </View>

      {/* বয়স: জন্ম তারিখ থেকে নিজে থেকে বসে, হাতে লেখা যায় না */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Age (বয়স):</Text>
        <View style={[styles.input, styles.readOnlyBox]}>
          <Text style={ageInfo ? styles.readOnlyValue : styles.readOnlyPlaceholder}>
            {ageInfo ? ageInfo.text : 'জন্ম তারিখ দিলে বয়স নিজে থেকে বসবে'}
          </Text>
        </View>
      </View>

      <View style={styles.inputGroup} onLayout={onFieldLayout('gender')}>
        <DropdownField
          label="Gender (লিঙ্গ):"
          value={gender}
          placeholder="লিঙ্গ নির্বাচন করুন"
          options={GENDER_OPTIONS}
          onSelect={setGender}
          onOpen={() => scrollToField('gender')}
        />
      </View>

      <View style={styles.inputGroup} onLayout={onFieldLayout('maritalStatus')}>
        <DropdownField
          label="Marital Status (বৈবাহিক অবস্থা):"
          value={maritalStatus}
          placeholder="বৈবাহিক অবস্থা নির্বাচন করুন"
          options={MARITAL_OPTIONS}
          onSelect={handleMaritalSelect}
          onOpen={() => scrollToField('maritalStatus')}
        />
      </View>

      {/* "বিবাহিত" সিলেক্ট করলে স্বামী/স্ত্রীর এনআইডি দেওয়ার ঘর খুলবে (বাধ্যতামূলক) */}
      {maritalStatus === MARRIED && (
        <View style={styles.inputGroup} onLayout={onFieldLayout('spouseNid')}>
          <Text style={styles.label}>Spouse NID Card No. (স্বামী/স্ত্রীর এনআইডি নম্বর): *</Text>
          <TextInput
            style={styles.input}
            placeholder="স্বামী/স্ত্রীর এনআইডি কার্ড নম্বর লিখুন..."
            placeholderTextColor="#999"
            value={spouseNid}
            onChangeText={setSpouseNid}
            keyboardType="numeric"
            onFocus={() => handleFieldFocus('spouseNid')}
            onBlur={handleFieldBlur}
          />
        </View>
      )}

      <View style={styles.inputGroup} onLayout={onFieldLayout('occupation')}>
        <DropdownField
          label="Occupation (পেশা):"
          value={occupation}
          placeholder="পেশা নির্বাচন করুন"
          options={OCCUPATION_OPTIONS}
          onSelect={setOccupation}
          onOpen={() => scrollToField('occupation')}
        />
      </View>

      <View style={styles.inputGroup} onLayout={onFieldLayout('socialStatus')}>
        <DropdownField
          label="Social Status (সামাজিক অবস্থান):"
          value={socialStatus}
          placeholder="সামাজিক অবস্থান নির্বাচন করুন"
          options={SOCIAL_STATUS_OPTIONS}
          onSelect={setSocialStatus}
          onOpen={() => scrollToField('socialStatus')}
        />
      </View>

      <View style={styles.inputGroup} onLayout={onFieldLayout('ward')}>
        <Text style={styles.label}>Ward No (ওয়ার্ড নং):</Text>
        <TextInput
          style={styles.input}
          placeholder="ওয়ার্ড নম্বর লিখুন..."
          placeholderTextColor="#999"
          value={ward}
          onChangeText={setWard}
          keyboardType="numeric"
          onFocus={() => handleFieldFocus('ward')}
          onBlur={handleFieldBlur}
        />
      </View>

      <View style={styles.inputGroup} onLayout={onFieldLayout('village')}>
        <Text style={styles.label}>Village (গ্রাম):</Text>
        <TextInput
          style={styles.input}
          placeholder="গ্রামের নাম লিখুন..."
          placeholderTextColor="#999"
          value={village}
          onChangeText={setVillage}
          onFocus={() => handleFieldFocus('village')}
          onBlur={handleFieldBlur}
        />
      </View>

      <View style={styles.inputGroup} onLayout={onFieldLayout('upazila')}>
        <Text style={styles.label}>Upazila (উপজেলা):</Text>
        <TextInput
          style={styles.input}
          placeholder="উপজেলার নাম লিখুন..."
          placeholderTextColor="#999"
          value={upazila}
          onChangeText={setUpazila}
          onFocus={() => handleFieldFocus('upazila')}
          onBlur={handleFieldBlur}
        />
      </View>

      <View style={styles.inputGroup} onLayout={onFieldLayout('district')}>
        <Text style={styles.label}>District (জেলা):</Text>
        <TextInput
          style={styles.input}
          placeholder="জেলার নাম লিখুন..."
          placeholderTextColor="#999"
          value={district}
          onChangeText={setDistrict}
          onFocus={() => handleFieldFocus('district')}
          onBlur={handleFieldBlur}
        />
      </View>

      {/* নেক্সট বাটন */}
      <TouchableOpacity
        style={[styles.btn, isSubmitting && { opacity: 0.7 }]}
        onPress={handleNext}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>নেক্সট (কার্ড দেখুন)</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.backBtn]} onPress={onBack}>
        <Text style={styles.btnText}>ফিরে যান</Text>
      </TouchableOpacity>

      {/* ক্যামেরা স্ক্রিন: মাঝে বর্গাকার ফ্রেম (শুধু এটুকুই সেভ হবে), নিচে বামে গ্যালারি, মাঝে ছবি তোলা, ডানে ক্যামেরা ঘোরানো */}
      <Modal
        visible={cameraVisible}
        animationType="slide"
        onRequestClose={closeCamera}
      >
        <View style={styles.cameraScreen}>
          {/* উপরে বন্ধ করার বাটন ও শিরোনাম */}
          <View style={styles.cameraTopBar}>
            <TouchableOpacity style={styles.cameraCloseBtn} onPress={closeCamera}>
              <Text style={styles.cameraCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>ছবি তুলুন</Text>
          </View>

          {/* মাঝের অংশ: ক্যামেরার ফ্রেম ও নির্দেশনা */}
          <View style={styles.cameraMiddle}>
            <View style={[styles.cameraFrame, { width: frameSize, height: frameSize }]}>
              {cameraVisible && (
                <CameraView
                  ref={cameraRef}
                  style={styles.cameraView}
                  facing={cameraFacing}
                />
              )}
              {/* ফ্রেমের চার কোণের দাগ: ছবির যে অংশ সেভ হবে তা বোঝানোর ইশারা */}
              <View style={[styles.corner, styles.cornerTL]} pointerEvents="none" />
              <View style={[styles.corner, styles.cornerTR]} pointerEvents="none" />
              <View style={[styles.corner, styles.cornerBL]} pointerEvents="none" />
              <View style={[styles.corner, styles.cornerBR]} pointerEvents="none" />
            </View>
            <Text style={styles.cameraHint}>
              মুখ ফ্রেমের ভেতরে রাখুন। ফ্রেমের ভেতরের অংশটুকুই সেভ হবে।
            </Text>
          </View>

          {/* নিচের বাটন বার */}
          <View style={styles.cameraBottomBar}>
            {/* বাম: স্টোরেজ থেকে ছবি আপলোড (add_photo.xml) */}
            <TouchableOpacity style={styles.cameraSideBtn} onPress={openGalleryFromCamera}>
              <Image source={{ uri: 'add_photo' }} style={styles.cameraSideIconImg} resizeMode="contain" />
              <Text style={styles.cameraSideText}>গ্যালারি</Text>
            </TouchableOpacity>

            {/* মাঝ: ছবি তোলা */}
            <TouchableOpacity
              style={styles.shutterOuter}
              onPress={takePicture}
              disabled={isCapturing}
              activeOpacity={0.7}
            >
              {isCapturing ? (
                <ActivityIndicator size="large" color="#1A365D" />
              ) : (
                <View style={styles.shutterInner} />
              )}
            </TouchableOpacity>

            {/* ডান: সামনে/পিছনের ক্যামেরা পাল্টানো (নিজে আঁকা ঘূর্ণন আইকন) */}
            <TouchableOpacity
              style={styles.cameraSideBtn}
              onPress={toggleCameraFacing}
              disabled={isCapturing}
            >
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <RotateIcon size={30} color="#fff" />
              </Animated.View>
              <Text style={styles.cameraSideText}>ক্যামেরা</Text>
            </TouchableOpacity>
          </View>

          {/* অদৃশ্য ক্রপ ভিউ: তোলা ছবির মাঝের বর্গ অংশ এখানে বসিয়ে ক্যাপচার করা হয় (স্ক্রিনের বাইরে থাকে) */}
          {cropJob ? (
            <View style={styles.cropOffscreen} pointerEvents="none">
              <View
                ref={cropRef}
                collapsable={false}
                style={{ width: CROP_DP, height: CROP_DP, overflow: 'hidden', backgroundColor: '#000' }}
              >
                {(() => {
                  const scale = CROP_DP / Math.min(cropJob.w, cropJob.h);
                  const dw = cropJob.w * scale;
                  const dh = cropJob.h * scale;
                  return (
                    <Image
                      source={{ uri: cropJob.uri }}
                      fadeDuration={0}
                      onLoad={handleCropImageLoaded}
                      style={{
                        position: 'absolute',
                        width: dw,
                        height: dh,
                        left: -(dw - CROP_DP) / 2,
                        top: -(dh - CROP_DP) / 2,
                      }}
                    />
                  );
                })()}
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 15, backgroundColor: '#f8f9fa', paddingTop: 40 },
  mainTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#1A365D' },
  imageContainer: { alignItems: 'center', marginBottom: 20 },
  imagePickerBtn: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#e9ecef', borderWidth: 2, borderColor: '#007bff', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%' },
  imagePickerText: { fontSize: 12, textAlign: 'center', color: '#007bff', fontWeight: 'bold' },

  /* ক্যামেরা স্ক্রিন */
  cameraScreen: { flex: 1, backgroundColor: '#000' },
  cameraTopBar: { paddingTop: 40, paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', alignItems: 'center' },
  cameraCloseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  cameraCloseText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  cameraTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 16, fontWeight: 'bold', marginRight: 40 },
  cameraMiddle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cameraFrame: { backgroundColor: '#111', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  cameraView: { width: '100%', height: '100%' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#fff' },
  cornerTL: { top: 10, left: 10, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: 10, right: 10, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: 10, left: 10, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: 10, right: 10, borderBottomWidth: 4, borderRightWidth: 4 },
  cameraHint: { color: '#fff', fontSize: 13, textAlign: 'center', marginTop: 14, paddingHorizontal: 30, opacity: 0.9 },
  cameraBottomBar: { paddingTop: 20, paddingBottom: 35, paddingHorizontal: 25, backgroundColor: '#000', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cameraSideBtn: { width: 70, alignItems: 'center', justifyContent: 'center' },
  cameraSideIconImg: { width: 30, height: 30, tintColor: '#fff' },
  cameraSideText: { color: '#fff', fontSize: 12, marginTop: 4 },
  shutterOuter: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#fff', borderWidth: 4, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center' },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff', borderWidth: 2, borderColor: '#1A365D' },
  cropOffscreen: { position: 'absolute', top: 0, left: -20000 },
  imagePickerIcon: { width: 28, height: 28, tintColor: '#007bff', marginBottom: 4 },
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  input: { height: 48, borderWidth: 1, borderColor: '#ced4da', borderRadius: 8, paddingHorizontal: 15, backgroundColor: '#fff', fontSize: 16, color: '#000' },

  /* জন্ম তারিখের তিনটি ছোট ছক (দিন, মাস, বছর) */
  dobRow: { flexDirection: 'row' },
  dobBox: { flex: 1, marginRight: 8, paddingHorizontal: 4, textAlign: 'center' },
  dobYearBox: { flex: 1.6, marginRight: 0 },
  hintText: { fontSize: 11, color: '#888', marginTop: 4 },

  /* ড্রপডাউন (পেশা, লিঙ্গ, বৈবাহিক অবস্থা) */
  dropdownBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownValue: { fontSize: 16, color: '#000', flex: 1 },
  dropdownPlaceholder: { fontSize: 16, color: '#999', flex: 1 },
  dropdownArrow: { fontSize: 12, color: '#1A365D', marginLeft: 8 },
  optionsBox: { marginTop: 4, borderWidth: 1, borderColor: '#ced4da', borderRadius: 8, backgroundColor: '#fff', overflow: 'hidden' },
  optionItem: { paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  optionItemSelected: { backgroundColor: '#e7f1ff' },
  optionText: { fontSize: 16, color: '#333' },
  optionTextSelected: { color: '#007bff', fontWeight: 'bold' },

  /* বয়সের ঘর (শুধু দেখার জন্য) */
  readOnlyBox: { justifyContent: 'center', backgroundColor: '#e9ecef' },
  readOnlyValue: { fontSize: 16, color: '#000', fontWeight: 'bold' },
  readOnlyPlaceholder: { fontSize: 14, color: '#999' },

  btn: { backgroundColor: '#28a745', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 10, marginBottom: 10 },
  backBtn: { backgroundColor: '#6c757d', marginBottom: 30 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});