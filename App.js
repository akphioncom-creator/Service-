import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar, NativeModules, Image } from 'react-native';

// কাস্টম সেফ এরিয়া নেটিভ মডিউল ইমপোর্ট করা
const { SafeAreaModule } = NativeModules;

// screens ফোল্ডার থেকে ফাইলগুলো ইমপোর্ট করা
import QRScannerScreen from './home/qrscanner';
import AddNewScreen from './home/addnew';
import PersonListScreen from './home/personlist';
import CreatingCardScreen from './home/creatingcard';
import EmailChangeScreen from './home/emailchange';
import CardScreen from './home/card'; 

export default function App() {
  const [theme, setTheme] = useState('light');
  const [currentScreen, setCurrentScreen] = useState('home'); 
  const [selectedCardData, setSelectedCardData] = useState(null); 
  const [insets, setInsets] = useState({ top: 0, bottom: 0, left: 0, right: 0 });

  // কটলিন নেটিভ মডিউল থেকে স্ট্যাটাস বার ও নেভিগেশনবারের সঠিক মাপ নিয়ে আসা
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

  const isDark = theme === 'dark';

  // নেভিগেশনের জন্য স্ক্রিন রেন্ডার করার ফাংশন
  const renderScreen = () => {
    switch (currentScreen) {
      case 'qrscanner':
        return <QRScannerScreen onBack={() => setCurrentScreen('home')} />;
      case 'addnew':
        return (
          <AddNewScreen 
            onBack={() => setCurrentScreen('home')} 
            onNext={(cardData) => {
              setSelectedCardData(cardData);
              setCurrentScreen('cardview'); 
            }} 
          />
        );
      case 'cardview':
        return <CardScreen cardData={selectedCardData} onBack={() => setCurrentScreen('home')} />;
      case 'personlist':
        return <PersonListScreen onBack={() => setCurrentScreen('home')} />;
      case 'creatingcard':
        return <CreatingCardScreen onBack={() => setCurrentScreen('home')} />;
      case 'emailchange':
        return <EmailChangeScreen onBack={() => setCurrentScreen('home')} />;
      default:
        return (
          <View style={styles.dashboardGrid}>
            {/* অপশন ১: QR code scanner */}
            <TouchableOpacity 
              style={[styles.dashboardCard, isDark ? styles.darkCard : styles.lightCard]} 
              onPress={() => setCurrentScreen('qrscanner')}
            >
              <Image source={{ uri: 'ic_camera' }} style={[styles.cardIconImage, { tintColor: isDark ? '#fff' : '#1A365D' }]} />
              <Text style={[styles.cardTitle, isDark ? styles.darkText : styles.lightText]}>QR code scanner</Text>
              <Text style={styles.cardDesc}>স্ক্যান করে দ্রুত তথ্য নিশ্চিত করুন</Text>
            </TouchableOpacity>

            {/* অপশন ২: add new person */}
            <TouchableOpacity 
              style={[styles.dashboardCard, isDark ? styles.darkCard : styles.lightCard]} 
              onPress={() => setCurrentScreen('addnew')}
            >
              <Image source={{ uri: 'account_ic' }} style={[styles.cardIconImage, { tintColor: isDark ? '#fff' : '#1A365D' }]} />
              <Text style={[styles.cardTitle, isDark ? styles.darkText : styles.lightText]}>add new person</Text>
              <Text style={styles.cardDesc}>নতুন ব্যক্তি বা ডেটা যুক্ত করুন</Text>
            </TouchableOpacity>

            {/* অপশন ৩: all person list */}
            <TouchableOpacity 
              style={[styles.dashboardCard, isDark ? styles.darkCard : styles.lightCard]} 
              onPress={() => setCurrentScreen('personlist')}
            >
              <Text style={styles.cardIcon}>📋</Text>
              <Text style={[styles.cardTitle, isDark ? styles.darkText : styles.lightText]}>all person list</Text>
              <Text style={styles.cardDesc}>সকল ব্যক্তির তালিকা ও সার্চ করুন</Text>
            </TouchableOpacity>

            {/* অপশন ৪: creating all card */}
            <TouchableOpacity 
              style={[styles.dashboardCard, isDark ? styles.darkCard : styles.lightCard]} 
              onPress={() => setCurrentScreen('creatingcard')}
            >
              <Image source={{ uri: 'downloadicon' }} style={[styles.cardIconImage, { tintColor: isDark ? '#fff' : '#1A365D' }]} />
              <Text style={[styles.cardTitle, isDark ? styles.darkText : styles.lightText]}>creating all card</Text>
              <Text style={styles.cardDesc}>সবগুলোর জন্য কার্ড তৈরি করুন</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={[
      styles.container, 
      isDark ? styles.darkContainer : styles.lightContainer,
      { paddingTop: insets.top, paddingBottom: insets.bottom }
    ]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* উপরে এক লাইন লেখা: Smart Service এবং ব্যাক বাটন */}
      <View style={[styles.upServersBar, isDark ? styles.darkBar : styles.lightBar]}>
        <TouchableOpacity onPress={() => setCurrentScreen('home')} style={{ flexDirection: 'row', alignItems: 'center' }}>
          {currentScreen !== 'home' && (
            <Image source={{ uri: 'back_icon' }} style={[styles.headerBackIcon, { tintColor: isDark ? '#fff' : '#1A365D' }]} />
          )}
          <Text style={[styles.barTitle, isDark ? styles.darkText : styles.lightText]}>Smart Service</Text>
        </TouchableOpacity>
      </View>

      {/* ডায়নামিক স্ক্রিন রেন্ডারিং */}
      <View style={{ flex: 1 }}>
        {renderScreen()}
      </View>

      {/* ফুটার */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, isDark ? styles.darkSubText : styles.lightSubText]}>
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
  darkContainer: {
    backgroundColor: '#121212',
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
  darkBar: {
    backgroundColor: '#1e1e2f',
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
  darkCard: {
    backgroundColor: '#1e1e1e',
    borderColor: '#333333',
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
  darkText: {
    color: '#ffffff',
  },
  lightSubText: {
    color: '#888888',
  },
  darkSubText: {
    color: '#aaaaaa',
  },
  footer: {
    padding: 10,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
  },
});
