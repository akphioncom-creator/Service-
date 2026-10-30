import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, FlatList, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'persistent_numbers_data';

export default function PersonListScreen({ onBack }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dataList, setDataList] = useState([]);
  const [filteredList, setFilteredList] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEY);
        if (data) {
          const parsed = JSON.parse(data);
          setDataList(parsed);
          setFilteredList(parsed);
        }
      } catch (error) {
        console.log('Load error:', error);
      }
    };

    loadData();
  }, []);

  const handleSearch = (text) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setFilteredList(dataList);
      return;
    }

    const results = dataList.filter(item =>
      item.number.toLowerCase().includes(text.toLowerCase()) ||
      item.name.toLowerCase().includes(text.toLowerCase())
    );

    setFilteredList(results);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>All Person List ({filteredList.length})</Text>

      <TextInput
        style={styles.input}
        placeholder="নাম বা নম্বর দিয়ে সার্চ করুন..."
        value={searchQuery}
        onChangeText={handleSearch}
      />

      <FlatList
        data={filteredList}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <Text style={styles.index}>#{index + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.nameText}>{item.name}</Text>
              <Text style={styles.numberText}>{item.number}</Text>
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
  nameText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  numberText: { fontSize: 14, color: '#666' },
  btn: { backgroundColor: '#6c757d', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});