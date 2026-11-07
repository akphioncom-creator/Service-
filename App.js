import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar, NativeModules, Image, BackHandler, Alert, ActivityIndicator, Modal, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

// কাস্টম সেফ এরিয়া নেটিভ মডিউল ইমপোর্ট করা
const { SafeAreaModule } = NativeModules;

// screens ফোল্ডার থেকে ফাইলগুলো ইমপোর্ট করা
import QRScannerScreen from './home/qrscanner';
import AddNewScreen from './home/addnew';
import PersonListScreen from './home/personlist';
import CreatingCardScreen from './home/creatingcard';
import EmailChangeScreen from './home/emailchange';
import SettingScreen from './home/setting';
import PasswordChangeScreen from './home/passwordchange';
import LockOptionScreen from './home/lockoption';
import CardScreen from './home/card'; 
import LoginScreen from './home/loginscreen';
import { hasSavedToken, clearToken, setAuthExpiredHandler, verifyCurrentPasswordOnServer } from './home/serverApi';

// ব্যাক চাপলে কোন স্ক্রিনে ফিরবে: পাসওয়ার্ড চেঞ্জ ও লক অপশন থেকে সেটিং-এ, বাকি সব জায়গা থেকে হোমে
const getBackTarget = (screen) => (screen === 'passwordchange' || screen === 'lockoption' ? 'setting' : 'home');

// হোমের যে পাঁচটি অপশনের লক আলাদা আলাদা ঠিক করা যায় (lockoption.js এর LOCK_ITEMS এর সাথে মিল)
const GATED_SCREENS = ['qrscanner', 'addnew', 'personlist', 'creatingcard', 'setting'];

// লকের শুরুর মান (প্রথমবার বা ফোনে কিছু সংরক্ষিত না থাকলে): আগের আচরণই বজায়: কিউআর স্ক্যানারে ফিঙ্গারপ্রিন্ট নেই, বাকিতে আছে; কোথাও পাসওয়ার্ড নেই
const DEFAULT_LOCK_SETTINGS = {
  fingerprint: { qrscanner: false, addnew: true, personlist: true, creatingcard: true, setting: true },
  password: { qrscanner: false, addnew: false, personlist: false, creatingcard: false, setting: false },
};
const LOCK_STORAGE_KEY = 'app_lock_settings';

// ফোনে সংরক্ষিত লক সেটিংকে শুরুর মানের সাথে মিলিয়ে নেওয়া (কোনো কী বাদ পড়লে শুরুর মান বসে)
const mergeLockSettings = (saved) => ({
  fingerprint: { ...DEFAULT_LOCK_SETTINGS.fingerprint, ...((saved && saved.fingerprint) || {}) },
  password: { ...DEFAULT_LOCK_SETTINGS.password, ...((saved && saved.password) || {}) },
});

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [selectedCardData, setSelectedCardData] = useState(null); 
  const [insets, setInsets] = useState({ top: 0, bottom: 0, left: 0, right: 0 });
  // লগইনের অবস্থা: 'checking' (দেখা হচ্ছে) | 'loggedOut' | 'loggedIn'
  const [authState, setAuthState] = useState('checking');

  // কোন অপশনে ফিঙ্গারপ্রিন্ট ও কোনটিতে পাসওয়ার্ড লাগবে (এই ফোনে সংরক্ষিত থাকে)
  const [lockSettings, setLockSettings] = useState(DEFAULT_LOCK_SETTINGS);

  // পাসওয়ার্ড চাওয়ার ছোট বক্স (ঢোকার আগে অ্যাপের পাসওয়ার্ড যাচাই)
  const [promptVisible, setPromptVisible] = useState(false);
  const [promptPassword, setPromptPassword] = useState('');
  const [promptError, setPromptError] = useState('');
  const [promptBusy, setPromptBusy] = useState(false);
  const promptActionRef = useRef(null); // পাসওয়ার্ড মিললে যে কাজটি হবে

  // বের হওয়ার কনফার্মেশন বক্স একসাথে একাধিকবার খোলা ঠেকানোর জন্য
  const exitDialogOpenRef = useRef(false);

  // অ্যাপ খোলার সময় আগে লগইন করা ছিল কিনা দেখা (সার্ভারের টোকেন ফোনে জমা আছে কিনা)
  useEffect(() => {
    let isActive = true;
    const checkLogin = async () => {
      const loggedIn = await hasSavedToken();
      if (isActive) setAuthState(loggedIn ? 'loggedIn' : 'loggedOut');
    };
    checkLogin();
    return () => {
      isActive = false;
    };
  }, []);

  // অ্যাপ খোলার সময় ফোনে সংরক্ষিত লক সেটিং পড়া
  useEffect(() => {
    let isActive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(LOCK_STORAGE_KEY);
        if (raw && isActive) setLockSettings(mergeLockSettings(JSON.parse(raw)));
      } catch (e) {
        // পড়া না গেলে শুরুর মানই থাকবে
      }
    })();
    return () => {
      isActive = false;
    };
  }, []);

  // লক সেটিং বদলালে সঙ্গে সঙ্গে কাজে লাগানো ও ফোনে সংরক্ষণ
  const updateLockSettings = (next) => {
    const merged = mergeLockSettings(next);
    setLockSettings(merged);
    AsyncStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify(merged)).catch(() => {
      Alert.alert('ত্রুটি', 'লক সেটিং ফোনে সংরক্ষণ করা যায়নি।');
    });
  };

  // পাসওয়ার্ড বক্স খোলা: অ্যাপের পাসওয়ার্ড মিললে তবেই onSuccess চলবে
  const requirePassword = (onSuccess) => {
    promptActionRef.current = onSuccess;
    setPromptPassword('');
    setPromptError('');
    setPromptBusy(false);
    setPromptVisible(true);
  };

  const closePasswordPrompt = () => {
    if (promptBusy) return;
    promptActionRef.current = null;
    setPromptVisible(false);
    setPromptPassword('');
    setPromptError('');
  };

  // পাসওয়ার্ড সার্ভারে যাচাই (ভুল হলে লগআউট হয় না, শুধু বার্তা দেখায়)
  const submitPasswordPrompt = async () => {
    if (promptBusy) return;
    if (!promptPassword) {
      setPromptError('পাসওয়ার্ড লিখুন।');
      return;
    }

    setPromptBusy(true);
    setPromptError('');
    const result = await verifyCurrentPasswordOnServer(promptPassword);
    setPromptBusy(false);

    if (!result.ok) {
      setPromptError(result.message);
      return;
    }

    const action = promptActionRef.current;
    promptActionRef.current = null;
    setPromptVisible(false);
    setPromptPassword('');
    if (action) action();
  };

  // সার্ভার টোকেন না মানলে (মেয়াদ শেষ বা বাতিল) নিজে নিজে লগইন স্ক্রিনে ফেরা
  useEffect(() => {
    setAuthExpiredHandler(() => {
      setSelectedCardData(null);
      setCurrentScreen('home');
      setAuthState('loggedOut');
      Alert.alert('আবার লগইন করুন', 'আপনার লগইনের মেয়াদ শেষ হয়ে গেছে। পাসওয়ার্ড দিয়ে আবার ঢুকুন।');
    });
    return () => setAuthExpiredHandler(null);
  }, []);

  // সার্ভার সঠিক পাসওয়ার্ড মেনে নিলে (টোকেন ইতিমধ্যে জমা হয়েছে) অ্যাপের ভেতরে ঢোকা
  const handleLoginSuccess = () => {
    setAuthState('loggedIn');
  };

  // লগআউট: নিশ্চিত করে টোকেন মুছে ফেলা, তারপর লগইন স্ক্রিনে ফেরা
  const handleLogout = () => {
    Alert.alert('লগআউট', 'আপনি কি লগআউট করতে চান?', [
      { text: 'বাতিল', style: 'cancel' },
      {
        text: 'লগআউট',
        style: 'destructive',
        onPress: async () => {
          await clearToken();
          setSelectedCardData(null);
          setCurrentScreen('home');
          setAuthState('loggedOut');
        },
      },
    ]);
  };

  // বায়োমেট্রিক বা ডিভাইস লক ভেরিফিকেশন ফাংশন
  const authenticateUser = async (onSuccess) => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        onSuccess();
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'নিরাপত্তার জন্য আপনার ফিঙ্গারপ্রিন্ট বা পিন দিন',
        subTitle: 'Smart Service সিকিউরিটি ভেরিফিকেশন',
        fallbackLabel: 'পিন বা প্যাটার্ন ব্যবহার করুন',
        cancelLabel: 'বাতিল',
        disableDeviceFallback: false,
      });

      if (result.success) {
        onSuccess();
      } else {
        console.log('Authentication cancelled or failed by user');
      }
    } catch (error) {
      console.error('Authentication error:', error);
    }
  };

  // কটলিন নেটিভ মডিউল থেকে স্ট্যাটাস বার ও নেভিগেশনবারের সঠিক মাপ নিয়ে আসা
  useEffect(() => {
    async function fetchSafeAreaInsets() {
      try {
        if (SafeAreaModule && SafeAreaModule.getInsets) {
          const nativeInsets = await SafeAreaModule.getInsets();
          if (nativeInsets) {
            setInsets(nativeInsets);
          }
        }
      } catch (error) {
        console.log('SafeAreaModule error:', error);
      }
    }
    fetchSafeAreaInsets();
  }, []);

  // সিস্টেমের (ফোনের) ব্যাক বাটন নিয়ন্ত্রণ:
  // - অন্য কোনো স্ক্রিনে থাকলে => মেইন হোমে ফিরে আসবে (পাসওয়ার্ড চেঞ্জ থেকে আগে সেটিং-এ)
  // - মেইন হোমে (বা লগইন স্ক্রিনে) থাকলে => বের হওয়ার জন্য কনফার্মেশন নোটিফিকেশন দেখাবে
  useEffect(() => {
    const onHardwareBackPress = () => {
      if (currentScreen !== 'home') {
        setCurrentScreen(getBackTarget(currentScreen));
        return true; // ডিফল্ট ব্যাক (অ্যাপ বন্ধ হওয়া) ঠেকানো হলো
      }

      // মেইন হোমে আছি: বের হওয়ার আগে কনফার্ম করা
      if (!exitDialogOpenRef.current) {
        exitDialogOpenRef.current = true;

        Alert.alert(
          'অ্যাপ থেকে বের হবেন?',
          'আপনি কি অ্যাপ্লিকেশন থেকে বের হতে চান?',
          [
            {
              text: 'বাতিল',
              style: 'cancel',
              onPress: () => {
                exitDialogOpenRef.current = false;
              },
            },
            {
              text: 'ওকে',
              onPress: () => {
                exitDialogOpenRef.current = false;
                BackHandler.exitApp();
              },
            },
          ],
          {
            cancelable: true,
            // বক্সের বাইরে ট্যাপ বা ব্যাক চাপলেও যেন আবার বক্স খোলা যায়
            onDismiss: () => {
              exitDialogOpenRef.current = false;
            },
          }
        );
      }

      return true; // সরাসরি অ্যাপ বন্ধ হওয়া ঠেকানো হলো
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBackPress);

    return () => {
      subscription.remove();
    };
  }, [currentScreen]);

  // স্ক্রিন পরিবর্তনের সময় সিকিউরিটি লক চেক করার ফাংশন
  const handleScreenChange = (targetScreen) => {
    // 'home' ও 'cardview' (নতুন ব্যক্তি যুক্ত করার পর কার্ড দেখা) এ সবসময় সরাসরি যাওয়া যায়
    if (targetScreen === 'home' || targetScreen === 'cardview') {
      setCurrentScreen(targetScreen);
      return;
    }

    const enter = () => setCurrentScreen(targetScreen);

    // হোমের পাঁচ অপশনের লক "লক অপশন" থেকে ঠিক করা; অন্য কোনো স্ক্রিনে আগের মতো ফিঙ্গারপ্রিন্ট লাগবে, পাসওয়ার্ড নয়
    const isGated = GATED_SCREENS.includes(targetScreen);
    const needFingerprint = isGated ? lockSettings.fingerprint[targetScreen] : true;
    const needPassword = isGated ? lockSettings.password[targetScreen] : false;

    // ক্রম: আগে ফিঙ্গারপ্রিন্ট/পিন (লাগলে), তারপর পাসওয়ার্ড (লাগলে), তারপর ঢোকা
    const afterFingerprint = () => {
      if (needPassword) requirePassword(enter);
      else enter();
    };

    if (needFingerprint) authenticateUser(afterFingerprint);
    else afterFingerprint();
  };

  // নেভিগেশনের জন্য স্ক্রিন রেন্ডার করার ফাংশন
  const renderScreen = () => {
    switch (currentScreen) {
      case 'qrscanner':
        return <QRScannerScreen onBack={() => handleScreenChange('home')} />;
      case 'addnew':
        return (
          <AddNewScreen 
            onBack={() => handleScreenChange('home')} 
            onNext={(cardData) => {
              setSelectedCardData(cardData);
              handleScreenChange('cardview'); 
            }} 
          />
        );
      case 'cardview':
        return <CardScreen cardData={selectedCardData} onBack={() => handleScreenChange('home')} />;
      case 'personlist':
        return <PersonListScreen onBack={() => handleScreenChange('home')} />;
      case 'creatingcard':
        return <CreatingCardScreen onBack={() => handleScreenChange('home')} />;
      case 'emailchange':
        return <EmailChangeScreen onBack={() => handleScreenChange('home')} />;
      case 'setting':
        // সেটিং-এ ঢোকার সময়ই ফিঙ্গারপ্রিন্ট/পিন চাওয়া হয়েছে (handleScreenChange এর লক), তাই ভেতরের পাতায় আবার চাওয়া হয় না
        return (
          <SettingScreen
            onBack={() => handleScreenChange('home')}
            onOpenPasswordChange={() => setCurrentScreen('passwordchange')}
            // লক অপশন বদলানোর পাতায় ঢুকতে সবসময় পাসওয়ার্ড লাগে, নইলে সেটিং-এর ফিঙ্গারপ্রিন্ট বন্ধ করে যে কেউ সব লক খুলে ফেলতে পারত
            onOpenLockOption={() => requirePassword(() => setCurrentScreen('lockoption'))}
          />
        );
      case 'lockoption':
        return (
          <LockOptionScreen
            settings={lockSettings}
            onChange={updateLockSettings}
            onBack={() => setCurrentScreen('setting')}
          />
        );
      case 'passwordchange':
        return <PasswordChangeScreen onBack={() => setCurrentScreen('setting')} />;
      default:
        return (
          <View style={styles.dashboardGrid}>
            {/* অপশন ১: QR code scanner (কোনো লক ছাড়াই সরাসরি প্রবেশ করবে) */}
            <TouchableOpacity 
              style={[styles.dashboardCard, styles.lightCard]} 
              onPress={() => handleScreenChange('qrscanner')}
            >
              <Image source={{ uri: 'ic_camera' }} style={[styles.cardIconImage, { tintColor: '#1A365D' }]} />
              <Text style={[styles.cardTitle, styles.lightText]}>QR code scanner</Text>
              <Text style={styles.cardDesc}>স্ক্যান করে দ্রুত তথ্য নিশ্চিত করুন</Text>
            </TouchableOpacity>

            {/* অপশন ২: add new person */}
            <TouchableOpacity 
              style={[styles.dashboardCard, styles.lightCard]} 
              onPress={() => handleScreenChange('addnew')}
            >
              <Image source={{ uri: 'account_ic' }} style={[styles.cardIconImage, { tintColor: '#1A365D' }]} />
              <Text style={[styles.cardTitle, styles.lightText]}>add new person</Text>
              <Text style={styles.cardDesc}>নতুন ব্যক্তি বা ডেটা যুক্ত করুন</Text>
            </TouchableOpacity>

            {/* অপশন ৩: all person list */}
            <TouchableOpacity 
              style={[styles.dashboardCard, styles.lightCard]} 
              onPress={() => handleScreenChange('personlist')}
            >
              <Text style={styles.cardIcon}>📋</Text>
              <Text style={[styles.cardTitle, styles.lightText]}>all person list</Text>
              <Text style={styles.cardDesc}>সকল ব্যক্তির তালিকা ও সার্চ করুন</Text>
            </TouchableOpacity>

            {/* অপশন ৪: creating all card */}
            <TouchableOpacity 
              style={[styles.dashboardCard, styles.lightCard]} 
              onPress={() => handleScreenChange('creatingcard')}
            >
              <Image source={{ uri: 'downloadicon' }} style={[styles.cardIconImage, { tintColor: '#1A365D' }]} />
              <Text style={[styles.cardTitle, styles.lightText]}>creating all card</Text>
              <Text style={styles.cardDesc}>সবগুলোর জন্য কার্ড তৈরি করুন</Text>
            </TouchableOpacity>

            {/* অপশন ৫: setting (ফিঙ্গারপ্রিন্ট/পিন লাগবে) */}
            <TouchableOpacity
              style={[styles.dashboardCard, styles.lightCard]}
              onPress={() => handleScreenChange('setting')}
            >
              <Image source={{ uri: 'ic_settings' }} style={[styles.cardIconImage, { tintColor: '#1A365D' }]} />
              <Text style={[styles.cardTitle, styles.lightText]}>setting</Text>
              <Text style={styles.cardDesc}>পাসওয়ার্ড ও অন্যান্য সেটিং</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  // লগইন অবস্থা দেখা চলছে: সাদা পর্দায় ছোট চাকা (যাতে এক ঝলক লগইন স্ক্রিন বা হোম না দেখায়)
  if (authState === 'checking') {
    return (
      <SafeAreaView style={[styles.container, styles.lightContainer, styles.centered]}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color="#1A365D" />
      </SafeAreaView>
    );
  }

  // লগইন করা না থাকলে শুধু লগইন স্ক্রিন দেখাবে
  if (authState === 'loggedOut') {
    return (
      <SafeAreaView style={[
        styles.container,
        styles.lightContainer,
        { paddingTop: insets.top, paddingBottom: insets.bottom }
      ]}>
        <StatusBar barStyle="dark-content" />
        <View style={{ flex: 1 }}>
          <LoginScreen onLoginSuccess={handleLoginSuccess} />
        </View>
        <View style={styles.footer}>
          <Text style={[styles.footerText, styles.lightSubText]}>
            &copy; Made by Akphion 
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[
      styles.container, 
      styles.lightContainer,
      { paddingTop: insets.top, paddingBottom: insets.bottom }
    ]}>
      <StatusBar barStyle="dark-content" />

      {/* উপরে এক লাইন লেখা: Smart Service এবং ব্যাক বাটন */}
      <View style={[styles.upServersBar, styles.lightBar]}>
        <TouchableOpacity onPress={() => setCurrentScreen(getBackTarget(currentScreen))} style={{ flexDirection: 'row', alignItems: 'center' }}>
          {currentScreen !== 'home' && (
            <Image source={{ uri: 'back_icon' }} style={[styles.headerBackIcon, { tintColor: '#1A365D' }]} />
          )}
          <Text style={[styles.barTitle, styles.lightText]}>Smart Service</Text>
        </TouchableOpacity>

        {/* হোম স্ক্রিনে ডানদিকে লগআউট বাটন */}
        {currentScreen === 'home' && (
          <TouchableOpacity onPress={handleLogout} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.logoutText}>লগআউট</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ডায়নামিক স্ক্রিন রেন্ডারিং */}
      <View style={{ flex: 1 }}>
        {renderScreen()}
      </View>

      {/* ফুটার */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, styles.lightSubText]}>
          &copy; Made by Akphion
        </Text>
      </View>

      {/* পাসওয়ার্ড চাওয়ার বক্স: লক অপশনে "পাসওয়ার্ড" চালু থাকা স্ক্রিনে ঢোকার আগে এবং লক অপশন পাতায় ঢোকার আগে আসে */}
      <Modal
        visible={promptVisible}
        transparent
        animationType="fade"
        onRequestClose={closePasswordPrompt}
      >
        <View style={styles.promptOverlay}>
          <View style={styles.promptBox}>
            <Text style={styles.promptTitle}>পাসওয়ার্ড দিন</Text>
            <Text style={styles.promptDesc}>এখানে ঢুকতে অ্যাপের পাসওয়ার্ড লাগবে।</Text>

            <TextInput
              style={[styles.promptInput, !!promptError && styles.promptInputError]}
              placeholder="পাসওয়ার্ড লিখুন..."
              placeholderTextColor="#999"
              value={promptPassword}
              onChangeText={(text) => {
                setPromptPassword(text);
                setPromptError('');
              }}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              editable={!promptBusy}
              returnKeyType="done"
              onSubmitEditing={submitPasswordPrompt}
            />
            {promptError ? <Text style={styles.promptError}>{promptError}</Text> : null}

            <View style={styles.promptButtons}>
              <TouchableOpacity
                style={[styles.promptBtn, styles.promptCancelBtn]}
                onPress={closePasswordPrompt}
                disabled={promptBusy}
              >
                <Text style={styles.promptBtnText}>বাতিল</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.promptBtn, styles.promptOkBtn, (promptBusy || !promptPassword) && { opacity: 0.5 }]}
                onPress={submitPasswordPrompt}
                disabled={promptBusy || !promptPassword}
              >
                {promptBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.promptBtnText}>ঠিক আছে</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightContainer: {
    backgroundColor: '#f8f9fa',
  },
  upServersBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    elevation: 4,
  },
  lightBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  barTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#dc3545',
  },
  headerBackIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  dashboardGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    justifyContent: 'space-between',
    alignContent: 'space-between',
  },
  // পাঁচটি অপশন: দুই কলাম, তিন সারি (আগে চারটি বড় ঘর ছিল, এখন ছোট)
  dashboardCard: {
    width: '48%',
    height: '31.5%',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  lightCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e0e0e0',
  },
  cardIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  cardIconImage: {
    width: 28,
    height: 28,
    marginBottom: 6,
    resizeMode: 'contain',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 3,
  },
  cardDesc: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  lightText: {
    color: '#333333',
  },
  lightSubText: {
    color: '#888888',
  },
  footer: {
    padding: 10,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
  },

  /* পাসওয়ার্ড চাওয়ার বক্স */
  promptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  promptBox: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
  },
  promptTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A365D' },
  promptDesc: { fontSize: 13, color: '#666', marginTop: 4, marginBottom: 14 },
  promptInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#000',
  },
  promptInputError: { borderColor: '#dc3545', borderWidth: 2 },
  promptError: { fontSize: 12, color: '#dc3545', fontWeight: 'bold', marginTop: 6 },
  promptButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18 },
  promptBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginLeft: 10, minWidth: 90, alignItems: 'center' },
  promptCancelBtn: { backgroundColor: '#6c757d' },
  promptOkBtn: { backgroundColor: '#28a745' },
  promptBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});