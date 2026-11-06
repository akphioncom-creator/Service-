import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Keyboard } from 'react-native';

// অ্যাপে ঢোকার পাসওয়ার্ড — বদলাতে চাইলে শুধু এই লাইনটি বদলান
const APP_PASSWORD = '1234';

export default function LoginScreen({ onLoginSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (password.trim() === APP_PASSWORD) {
      Keyboard.dismiss();
      setError('');
      setPassword('');
      if (onLoginSuccess) onLoginSuccess();
    } else {
      setError('পাসওয়ার্ড ভুল হয়েছে, আবার চেষ্টা করুন।');
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
          onSubmitEditing={handleLogin}
          returnKeyType="done"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, !password.trim() && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={!password.trim()}
        >
          <Text style={styles.btnText}>লগইন</Text>
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
