import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, FlatList, TouchableOpacity, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'persistent_numbers_data';

// যেকোনো মানকে নিরাপদে স্ট্রিং-এ রূপান্তর (খালি/undefined হলে ক্র্যাশ এড়াতে)
const safeText = (value) => (value === undefined || value === null ? '' : String(value));

export default function PersonListScreen({ onBack }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dataList, setDataList] = useState([]);
  const [filteredList, setFilteredList] = useState([]);

  useEffect(() => {
    let isActive = true;

    const loadData = async () => {
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEY);
        if (data && isActive) {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            setDataList(parsed);
            setFilteredList(parsed);
          }
        }
      } catch (error) {
        console.error('Storage read error:', error);
      }
    };

    loadData();

    return () => {
      isActive = false;
    };
  }, []);

  const handleSearch = (text) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setFilteredList(dataList);
      return;
    }
    const query = text.toLowerCase();

    // নাম, নম্বর, এনআইডি, মোবাইল, ঠিকানা ও ইউনিক কিউআর কোড দিয়ে সার্চ
    const results = dataList.filter(item =>
      safeText(item.number).toLowerCase().includes(query) ||
      safeText(item.name).toLowerCase().includes(query) ||
      safeText(item.nid).toLowerCase().includes(query) ||
      safeText(item.phone).toLowerCase().includes(query) ||
      safeText(item.district).toLowerCase().includes(query) ||
      safeText(item.upazila).toLowerCase().includes(query) ||
      safeText(item.village).toLowerCase().includes(query) ||
      safeText(item.uniqueCode).toLowerCase().includes(query)
    );
    setFilteredList(results);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>All Person List ({filteredList.length})</Text>

      <TextInput
        style={styles.input}
        placeholder="নাম, নম্বর বা কিউআর কোড দিয়ে সার্চ করুন..."
        value={searchQuery}
        onChangeText={handleSearch}
      />

      <FlatList
        data={filteredList}
        keyExtractor={(item, index) => safeText(item.id || item.uniqueCode) || String(index)}
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <Text style={styles.index}>#{index + 1}</Text>

            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.userImage} />
            ) : null}

            <View style={{ flex: 1 }}>
              <Text style={styles.nameText}>{item.name}</Text>

              {/* পুরোনো এন্ট্রির জন্য আগের মতোই number দেখাবে, নতুন কার্ডে এনআইডি আলাদা দেখানো হবে */}
              {item.nid ? (
                <Text style={styles.numberText}>এনআইডি: {item.nid}</Text>
              ) : (
                <Text style={styles.numberText}>{item.number}</Text>
              )}

              {item.phone ? (
                <Text style={styles.detailText}>মোবাইল: {item.phone}</Text>
              ) : null}

              {item.district || item.upazila || item.village ? (
                <Text style={styles.detailText}>
                  {[item.district, item.upazila, item.village ? 'গ্রাম: ' + item.village : '']
                    .filter(Boolean)
                    .join(', ')}
                </Text>
              ) : null}

              {item.createdAt ? (
                <Text style={styles.detailText}>তারিখ: {item.createdAt}</Text>
              ) : null}

              {/* কার্ডের কিউআর কোডে বসানো ইউনিক সংখ্যা */}
              {item.uniqueCode ? (
                <View style={styles.codeBox}>
                  <Text style={styles.codeLabel}>QR কোড:</Text>
                  <Text style={styles.codeText} selectable>{item.uniqueCode}</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={[styles.btn, styles.backBtn]} onPress={onBack}>
        <Text style={styles.btnText}>ফিরে যান</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f8f9fa', paddingTop: 40 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#333' },
  input: { height: 48, borderWidth: 1, borderColor: '#ced4da', borderRadius: 8, paddingHorizontal: 15, backgroundColor: '#fff', fontSize: 16, marginBottom: 15 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e9ecef' },
  index: { fontSize: 14, fontWeight: 'bold', color: '#888', marginRight: 15 },
  userImage: { width: 50, height: 62, borderRadius: 4, borderWidth: 1, borderColor: '#ccc', marginRight: 12 },
  nameText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  numberText: { fontSize: 14, color: '#666' },
  detailText: { fontSize: 13, color: '#666', marginTop: 1 },
  codeBox: { flexDirection: 'row', alignItems: 'center', marginTop: 4, backgroundColor: '#eef4ff', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 4, alignSelf: 'flex-start' },
  codeLabel: { fontSize: 12, color: '#1A365D', marginRight: 6 },
  codeText: { fontSize: 13, fontWeight: 'bold', color: '#1A365D', letterSpacing: 0.5 },
  btn: { backgroundColor: '#6c757d', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
