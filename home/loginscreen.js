import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Keyboard, ActivityIndicator } from 'react-native';
import { loginWithPassword } from './serverApi';

// পাসওয়ার্ড ঠিক কিনা সার্ভার ঠিক করে; এখানে কোনো পাসওয়ার্ড লেখা নেই
// সার্ভারে পাসওয়ার্ড বদলাতে: সার্ভারের .env ফাইলের APP_PASSWORD
export default function LoginScreen({ onLoginSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading || !password.trim()) return;

    Keyboard.dismiss();
    setLoading(true);
    setError('');

    const result = await loginWithPassword(password.trim());

    setLoading(false);
    if (result.ok) {
      setPassword('');
      if (onLoginSuccess) onLoginSuccess();
    } else {
      setError(result.message);
      setPassword('');
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.box}>
        <Text style={styles.title}>Smart Service</Text>
        <Text style={styles.subtitle}>চালিয়ে যেতে পাসওয়ার্ড দিন</Text>

        <TextInput
          style={[styles.input, error ? styles.inputError : null]}
          placeholder="পাসওয়ার্ড"
          placeholderTextColor="#999"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (error) setError('');
          }}
          secureTextEntry
          keyboardType="numeric"
          autoFocus
          editable={!loading}
          onSubmitEditing={handleLogin}
          returnKeyType="done"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, (!password.trim() || loading) && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={!password.trim() || loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>লগইন</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  box: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1A365D', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 6, marginBottom: 22 },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    paddingHorizontal: 15,
    backgroundColor: '#f8f9fa',
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 4,
  },
  inputError: { borderColor: '#dc3545' },
  errorText: { color: '#dc3545', fontSize: 13, textAlign: 'center', marginTop: 8 },
  btn: { backgroundColor: '#1A365D', paddingVertical: 13, borderRadius: 8, alignItems: 'center', marginTop: 18 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
