import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar, NativeModules, Image, BackHandler, Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

// কাস্টম সেফ এরিয়া নেটিভ মডিউল ইমপোর্ট করা
const { SafeAreaModule } = NativeModules;

// screens ফোল্ডার থেকে ফাইলগুলো ইমপোর্ট করা
import QRScannerScreen from './home/qrscanner';
import AddNewScreen from './home/addnew';
import PersonListScreen from './home/personlist';
import CreatingCardScreen from './home/creatingcard';
import EmailChangeScreen from './home/emailchange';
import CardScreen from './home/card'; 

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('home'); 
  const [selectedCardData, setSelectedCardData] = useState(null); 
  const [insets, setInsets] = useState({ top: 0, bottom: 0, left: 0, right: 0 });

  // বের হওয়ার কনফার্মেশন বক্স একসাথে একাধিকবার খোলা ঠেকানোর জন্য
  const exitDialogOpenRef = useRef(false);

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
  // - অন্য কোনো স্ক্রিনে থাকলে => মেইন হোমে ফিরে আসবে
  // - মেইন হোমে থাকলে => বের হওয়ার জন্য কনফার্মেশন নোটিফিকেশন দেখাবে
  useEffect(() => {
    const onHardwareBackPress = () => {
      if (currentScreen !== 'home') {
        setCurrentScreen('home');
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
    // যদি লক্ষ্য করা স্ক্রিনটি 'home', 'cardview' অথবা 'qrscanner' হয়, তবে কোনো লক ছাড়াই সরাসরি প্রবেশ করতে দেবে
    if (targetScreen === 'home' || targetScreen === 'cardview' || targetScreen === 'qrscanner') {
      setCurrentScreen(targetScreen);
      return;
    }

    // অন্য নির্দিষ্ট স্ক্রিনগুলোতে যাওয়ার আগে ফিঙ্গারপ্রিন্ট বা সিকিউরিটি লক ভেরিফাই করবে
    authenticateUser(() => {
      setCurrentScreen(targetScreen);
    });
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
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={[
      styles.container, 
      styles.lightContainer,
      { paddingTop: insets.top, paddingBottom: insets.bottom }
    ]}>
      <StatusBar barStyle="dark-content" />

      {/* উপরে এক লাইন লেখা: Smart Service এবং ব্যাক বাটন */}
      <View style={[styles.upServersBar, styles.lightBar]}>
        <TouchableOpacity onPress={() => handleScreenChange('home')} style={{ flexDirection: 'row', alignItems: 'center' }}>
          {currentScreen !== 'home' && (
            <Image source={{ uri: 'back_icon' }} style={[styles.headerBackIcon, { tintColor: '#1A365D' }]} />
          )}
          <Text style={[styles.barTitle, styles.lightText]}>Smart Service</Text>
        </TouchableOpacity>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  dashboardCard: {
    width: '48%',
    height: '48%',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
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
    fontSize: 35,
    marginBottom: 10,
  },
  cardIconImage: {
    width: 35,
    height: 35,
    marginBottom: 10,
    resizeMode: 'contain',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  cardDesc: {
    fontSize: 12,
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
});
