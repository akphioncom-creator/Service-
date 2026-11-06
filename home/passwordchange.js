import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Keyboard } from 'react-native';
// সার্ভারের সাথে যোগাযোগের ফাইল: বর্তমান পাসওয়ার্ড যাচাই ও নতুন পাসওয়ার্ড সংরক্ষণ
import { verifyCurrentPasswordOnServer, changePasswordOnServer } from './serverApi';

// সার্ভারের নিয়মের সাথে মিল রাখতে হবে (auth.js এর PASSWORD_MIN)
const PASSWORD_MIN = 4;

// পাসওয়ার্ডের ঘর: লেখা ঢাকা থাকে, "দেখুন/লুকান" চাপলে দেখা যায়
function PasswordField({ label, value, onChangeText, placeholder, editable = true, error, onSubmitEditing, inputRef, returnKeyType }) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, !editable && styles.inputRowDisabled, error && styles.inputRowError]}>
        <TextInput
          ref={inputRef}
          style={styles.inputInner}
          placeholder={placeholder}
          placeholderTextColor="#999"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          editable={editable}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
        />
        <TouchableOpacity onPress={() => setVisible((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.toggleText}>{visible ? 'লুকান' : 'দেখুন'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function PasswordChangeScreen({ onBack }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // বর্তমান পাসওয়ার্ড সার্ভারে মিলেছে কিনা: মিললে তবেই নতুন পাসওয়ার্ডের ঘরগুলো দেখা যায়
  const [verified, setVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const mountedRef = useRef(true);
  const newRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // বর্তমান পাসওয়ার্ডের ঘরে কিছু বদলালে আগের যাচাই বাতিল; নতুন ঘরগুলো লুকিয়ে যায়
  const handleCurrentChange = (text) => {
    setCurrentPassword(text);
    setVerifyError('');
    if (verified) {
      setVerified(false);
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const verifyCurrent = async () => {
    if (isVerifying || verified) return;
    if (!currentPassword) {
      setVerifyError('বর্তমান পাসওয়ার্ড লিখুন।');
      return;
    }

    Keyboard.dismiss();
    setIsVerifying(true);
    setVerifyError('');
    try {
      const result = await verifyCurrentPasswordOnServer(currentPassword);
      if (!mountedRef.current) return;

      if (result.ok) {
        setVerified(true);
        setTimeout(() => newRef.current && newRef.current.focus(), 200);
      } else {
        setVerifyError(result.message);
      }
    } finally {
      if (mountedRef.current) setIsVerifying(false);
    }
  };

  // নতুন পাসওয়ার্ডের অবস্থা: দুই ঘর মিললে ও নিয়ম মানলে তবেই সেভ বাটন চালু
  const tooShort = newPassword.length > 0 && newPassword.length < PASSWORD_MIN;
  const sameAsCurrent = newPassword.length > 0 && newPassword === currentPassword;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSave =
    verified &&
    !isSaving &&
    newPassword.length >= PASSWORD_MIN &&
    newPassword === confirmPassword &&
    !sameAsCurrent;

  const savePassword = async () => {
    if (!canSave) return;

    Keyboard.dismiss();
    setIsSaving(true);
    try {
      const result = await changePasswordOnServer(currentPassword, newPassword);
      if (!mountedRef.current) return;

      if (!result.ok) {
        Alert.alert('পাসওয়ার্ড বদলানো যায়নি', result.message);
        return;
      }

      // লেখা পাসওয়ার্ড ফোনের স্মৃতি থেকে মুছে ফেলা
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setVerified(false);

      Alert.alert(
        'সফল',
        'পাসওয়ার্ড বদলানো হয়েছে। অন্য ফোনে অ্যাপ ব্যবহার করলে সেখানে নতুন পাসওয়ার্ড দিয়ে আবার ঢুকতে হবে।',
        [{ text: 'ঠিক আছে', onPress: () => onBack && onBack() }]
      );
    } finally {
      if (mountedRef.current) setIsSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.mainTitle}>Change Password</Text>
      <Text style={styles.subTitle}>পাসওয়ার্ড পরিবর্তন</Text>

      {/* ধাপ ১: বর্তমান পাসওয়ার্ড */}
      <PasswordField
        label="Current Password (বর্তমান পাসওয়ার্ড):"
        value={currentPassword}
        onChangeText={handleCurrentChange}
        placeholder="বর্তমান পাসওয়ার্ড লিখুন..."
        editable={!isVerifying && !isSaving}
        error={!!verifyError}
        onSubmitEditing={verifyCurrent}
        returnKeyType="done"
      />
      {verifyError ? <Text style={styles.errorText}>{verifyError}</Text> : null}
      {verified ? <Text style={styles.okText}>✓ বর্তমান পাসওয়ার্ড মিলেছে।</Text> : null}

      {!verified ? (
        <TouchableOpacity
          style={[styles.btn, (isVerifying || !currentPassword) && { opacity: 0.5 }]}
          onPress={verifyCurrent}
          disabled={isVerifying || !currentPassword}
        >
          {isVerifying ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>যাচাই করুন</Text>}
        </TouchableOpacity>
      ) : null}

      {/* ধাপ ২: বর্তমান পাসওয়ার্ড মিললে নতুন পাসওয়ার্ড ও কনফার্ম পাসওয়ার্ডের দুটি ঘর */}
      {verified ? (
        <View style={styles.newBox}>
          <PasswordField
            label="New Password (নতুন পাসওয়ার্ড):"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="নতুন পাসওয়ার্ড লিখুন..."
            editable={!isSaving}
            error={tooShort || sameAsCurrent}
            inputRef={newRef}
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current && confirmRef.current.focus()}
          />
          {tooShort ? (
            <Text style={styles.errorText}>নতুন পাসওয়ার্ড কমপক্ষে {PASSWORD_MIN} অক্ষরের হতে হবে।</Text>
          ) : null}
          {sameAsCurrent ? (
            <Text style={styles.errorText}>নতুন পাসওয়ার্ড বর্তমানটির মতো হতে পারবে না।</Text>
          ) : null}

          <PasswordField
            label="Confirm Password (পাসওয়ার্ড নিশ্চিত করুন):"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="নতুন পাসওয়ার্ডটি আবার লিখুন..."
            editable={!isSaving}
            error={mismatch}
            inputRef={confirmRef}
            returnKeyType="done"
            onSubmitEditing={savePassword}
          />
          {mismatch ? <Text style={styles.errorText}>দুই ঘরের পাসওয়ার্ড মিলছে না।</Text> : null}
          {!mismatch && confirmPassword.length > 0 && newPassword === confirmPassword && !tooShort && !sameAsCurrent ? (
            <Text style={styles.okText}>✓ দুই ঘরের পাসওয়ার্ড মিলেছে।</Text>
          ) : null}

          {/* দুই ঘর মিললে তবেই বাটন চালু হয় */}
          <TouchableOpacity
            style={[styles.btn, styles.saveBtn, !canSave && { opacity: 0.5 }]}
            onPress={savePassword}
            disabled={!canSave}
          >
            {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>পাসওয়ার্ড পরিবর্তন করুন</Text>}
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity style={[styles.btn, styles.backBtn]} onPress={onBack} disabled={isSaving}>
        <Text style={styles.btnText}>ফিরে যান</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 15, backgroundColor: '#f8f9fa', paddingTop: 40 },
  mainTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: '#1A365D' },
  subTitle: { fontSize: 14, textAlign: 'center', color: '#666', marginBottom: 20, marginTop: 2 },

  inputGroup: { marginBottom: 6, marginTop: 6 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  inputRow: { height: 48, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ced4da', borderRadius: 8, paddingHorizontal: 15, backgroundColor: '#fff' },
  inputRowDisabled: { backgroundColor: '#e9ecef' },
  inputRowError: { borderColor: '#dc3545', borderWidth: 2 },
  inputInner: { flex: 1, fontSize: 16, color: '#000', paddingVertical: 0 },
  toggleText: { fontSize: 13, color: '#007bff', fontWeight: 'bold', marginLeft: 10 },

  errorText: { fontSize: 12, color: '#dc3545', fontWeight: 'bold', marginBottom: 4 },
  okText: { fontSize: 12, color: '#28a745', fontWeight: 'bold', marginBottom: 4 },

  newBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e1e5ea' },

  btn: { backgroundColor: '#007bff', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  saveBtn: { backgroundColor: '#28a745' },
  backBtn: { backgroundColor: '#6c757d', marginTop: 20, marginBottom: 30 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
