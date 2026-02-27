import { useState } from 'react';
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

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (!password || password.length < 6) {
      Alert.alert('Invalid', 'Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    
    // Supabase handles the recovery token behind the scenes when 
    // the app is opened via the recovery deep link.
    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Your password has been updated. Please login.');
      // After password update, we redirect back to login
      router.replace('/(auth)/login');
    }
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1, backgroundColor: '#fff' }}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Secure Your Account</Text>
          <Text style={styles.subtitle}>Enter your new password below.</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.inputLabel}>New Password</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Min. 6 characters"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <Text style={[styles.inputLabel, { marginTop: 16 }]}>Confirm Password</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Repeat password"
              placeholderTextColor="#9ca3af"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
            />
          </View>

          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleReset} 
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Update Password</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  header: {
    marginBottom: 40,
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
    marginTop: 32,
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