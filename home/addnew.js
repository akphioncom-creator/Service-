import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, Image, ScrollView, Keyboard, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'smart_cards_data';

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

// জন্ম তারিখ লেখার সময় নিজে থেকে দিন/মাস/বছর (DD/MM/YYYY) আকারে সাজানো
const formatDob = (text) => {
  const digits = toEnglishDigits(text).replace(/\D/g, '').slice(0, 8);
  let out = digits.slice(0, 2);
  if (digits.length > 2) out += '/' + digits.slice(2, 4);
  if (digits.length > 4) out += '/' + digits.slice(4, 8);
  return out;
};

// জন্ম তারিখ সঠিক কিনা (বাস্তব তারিখ ও ভবিষ্যতের নয়) যাচাই
const isValidDob = (value) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return false;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (year < 1900) return false;

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return false;
  }

  return date.getTime() <= Date.now();
};

// ইংরেজি সংখ্যাকে বাংলা সংখ্যায় রূপান্তর (বয়স দেখানোর জন্য)
const toBengaliDigits = (value) =>
  String(value).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);

// জন্ম তারিখ (DD/MM/YYYY) থেকে আজকের তারিখ পর্যন্ত বয়স (বছর, মাস, দিন) হিসাব করা
const calculateAge = (value) => {
  if (!isValidDob(value)) return null;

  const [dayStr, monthStr, yearStr] = value.split('/');
  const birthDay = parseInt(dayStr, 10);
  const birthMonth = parseInt(monthStr, 10);
  const birthYear = parseInt(yearStr, 10);

  const today = new Date();
  let years = today.getFullYear() - birthYear;
  let months = today.getMonth() + 1 - birthMonth;
  let days = today.getDate() - birthDay;

  if (days < 0) {
    months -= 1;
    // আগের মাসের মোট দিন যোগ করা
    days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
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
  const [name, setName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [nid, setNid] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [spouseNid, setSpouseNid] = useState('');
  const [occupation, setOccupation] = useState('');
  const [socialStatus, setSocialStatus] = useState('');
  const [ward, setWard] = useState('');
  const [village, setVillage] = useState('');
  const [upazila, setUpazila] = useState('');
  const [district, setDistrict] = useState('');

  // জন্ম তারিখ সঠিক হলে বয়স নিজে থেকে হিসাব হবে, না হলে null
  const ageInfo = calculateAge(dob.trim());

  // কিবোর্ডের উচ্চতা, যাতে কিবোর্ড খোলা থাকলেও নিচের ঘরগুলো স্ক্রল করে দেখা যায়
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef(null);

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

  // ছবি পিক করার ফাংশন
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  // বৈবাহিক অবস্থা পরিবর্তন: "বিবাহিত" ছাড়া অন্য কিছু হলে স্বামী/স্ত্রীর এনআইডি মুছে যাবে
  const handleMaritalSelect = (option) => {
    setMaritalStatus(option);
    if (option !== MARRIED) {
      setSpouseNid('');
    }
  };

  // ডেটা সেভ এবং নেক্সট স্ক্রিনে যাওয়ার ফাংশন
  const handleNext = async () => {
    if (
      !name.trim() || !fatherName.trim() || !motherName.trim() || !nid.trim() || !phone.trim() ||
      !dob.trim() || !gender || !maritalStatus || !occupation || !socialStatus || !ward.trim() ||
      !village.trim() || !upazila.trim() || !district.trim()
    ) {
      Alert.alert('সতর্কতা', 'দয়া করে সবগুলো ঘর সঠিকভাবে পূরণ করুন!');
      return;
    }

    if (!isValidDob(dob.trim())) {
      Alert.alert('সতর্কতা', 'জন্ম তারিখ সঠিক নয়! দিন/মাস/বছর আকারে লিখুন (যেমন: 25/12/1990)।');
      return;
    }

    // বিবাহিত হলে স্বামী/স্ত্রীর এনআইডি বাধ্যতামূলক
    if (maritalStatus === MARRIED && !spouseNid.trim()) {
      Alert.alert('সতর্কতা', 'বিবাহিত হলে স্বামী/স্ত্রীর এনআইডি কার্ড নম্বর দেওয়া বাধ্যতামূলক!');
      return;
    }

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
        createdAt: new Date().toLocaleDateString()
      };

      list.unshift(newItem);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));

      // সফলভাবে সেভ হওয়ার পর card.js (onNext) এ ডেটা পাঠিয়ে দেওয়া
      if (onNext) {
        onNext(newItem);
      }
    } catch (error) {
      Alert.alert('ত্রুটি', 'ডেটা সংরক্ষণ করতে সমস্যা হয়েছে।');
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
        <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
          {image ? (
            <Image source={{ uri: image }} style={styles.previewImage} />
          ) : (
            <Text style={styles.imagePickerText}>📷 ছবি আপলোড করুন</Text>
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
        <TextInput
          style={styles.input}
          placeholder="দিন/মাস/বছর (যেমন: 25/12/1990)"
          placeholderTextColor="#999"
          value={dob}
          onChangeText={(text) => setDob(formatDob(text))}
          keyboardType="numeric"
          maxLength={10}
          onFocus={() => handleFieldFocus('dob')}
          onBlur={handleFieldBlur}
        />
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
      <TouchableOpacity style={styles.btn} onPress={handleNext}>
        <Text style={styles.btnText}>নেক্সট (কার্ড দেখুন)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.backBtn]} onPress={onBack}>
        <Text style={styles.btnText}>ফিরে যান</Text>
      </TouchableOpacity>
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
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  input: { height: 48, borderWidth: 1, borderColor: '#ced4da', borderRadius: 8, paddingHorizontal: 15, backgroundColor: '#fff', fontSize: 16, color: '#000' },

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
