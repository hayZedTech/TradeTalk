import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Helper to trigger the Forgot Password flow
  async function handleForgotPassword() {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;

    if (!email) {
      Alert.alert('Error', 'Could not find your email address.');
      return;
    }

    Alert.alert(
      'Reset Password',
      `We will send a reset link to ${email}. You will be logged out to complete this process.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Send Link', 
          onPress: async () => {
            const { error } = await supabase.auth.resetPasswordForEmail(email);
            if (error) {
              Alert.alert('Error', error.message);
            } else {
              Alert.alert('Success', 'Check your email for the reset link.');
              await supabase.auth.signOut();
              router.replace('/(auth)/login');
            }
          } 
        }
      ]
    );
  }

  async function handleChangePassword() {
    if (!currentPassword) {
      Alert.alert('Required', 'Please enter your current password.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Invalid', 'New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New passwords do not match.');
      return;
    }

    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;

    if (!email) {
      setLoading(false);
      Alert.alert('Error', 'User email not found.');
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email,
      password: currentPassword,
    });

    if (signInError) {
      setLoading(false);
      Alert.alert('Security Check Failed', 'The current password you entered is incorrect.');
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ 
      password: newPassword 
    });

    setLoading(false);

    if (updateError) {
      Alert.alert('Error', updateError.message);
    } else {
      Alert.alert(
        'Success', 
        'Your password has been updated successfully.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace("/settings")} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>Change Password</Text>
          <Text style={styles.subtitle}>Verify your identity to update your password.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.labelRow}>
            <Text style={styles.inputLabel}>Current Password</Text>
            <TouchableOpacity onPress={handleForgotPassword}>
              <Text style={styles.forgotText}>Forgot?</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.inputWrapper}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter current password"
              placeholderTextColor="#9ca3af"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <Text style={styles.inputLabel}>New Password</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Min. 6 characters"
              placeholderTextColor="#9ca3af"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <Text style={[styles.inputLabel, { marginTop: 16 }]}>Confirm New Password</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Repeat new password"
              placeholderTextColor="#9ca3af"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleChangePassword} 
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Update Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  backButton: {
    marginBottom: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 8,
  },
  form: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2255ee',
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  button: {
    backgroundColor: '#2255ee',
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    shadowColor: '#2255ee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});