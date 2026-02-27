import { useState, useEffect } from 'react';
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
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const { setIsVerified } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);

  useEffect(() => {
    checkDeviceSupport();
  }, []);

  async function checkDeviceSupport() {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setIsBiometricSupported(compatible && enrolled);

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email) {
      setEmail(session.user.email);
    }
  }

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Missing Info', 'Please enter both email and password');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      Alert.alert('Login Failed', error.message);
      setLoading(false); 
    } else {
      setIsVerified(true);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      Alert.alert('Email Required', 'Please enter your email address first to reset your password.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'tradetalk://reset-password', // Replace with your app's deep link
    });

    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Password reset link has been sent to your email.');
    }
  }

  async function handleBiometricAuth() {
    setLoading(true);
    
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      setLoading(false);
      Alert.alert('No Session', 'Please sign in with your password first.');
      return;
    }

    if (email.toLowerCase() !== session.user.email?.toLowerCase()) {
      setLoading(false);
      Alert.alert(
        'Account Mismatch', 
        `The saved biometric session is for ${session.user.email}. If you want to use ${email}, please use your password.`
      );
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Sign in as ${session.user.email}`,
      fallbackLabel: 'Use Password',
    });

    if (result.success) {
      setIsVerified(true);
    }
    setLoading(false);
  }

  async function handleHardLogout() {
    await supabase.auth.signOut();
    setEmail('');
    setPassword('');
    Alert.alert('Session Cleared', 'You can now log in with a different account.');
  }

  const biometricIcon = (Platform.OS === 'ios' ? 'face-id' : 'finger-print') as any;

  const confirmLogout = () => {
  Alert.alert(
    "Clear Session?",
    "This will log you out and clear all saved data for this account.",
    [
      {
        text: "Cancel",
        style: "cancel"
      },
      { 
        text: "Clear & Logout", 
        onPress: () => handleHardLogout(), // Only runs if they click this
        style: "destructive" 
      }
    ]
  );
};

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1, backgroundColor: '#fff' }}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to your TradeTalk account</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputLabelRow}>
            <Text style={styles.inputLabel}>Email Address</Text>
          </View>
          <View style={styles.inputWrapper}>
            <Ionicons name="mail-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="name@example.com"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputLabelRow}>
            <Text style={styles.inputLabel}>Password</Text>
            <TouchableOpacity onPress={handleForgotPassword}>
              <Text style={styles.forgotText}>Forgot?</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
            </TouchableOpacity>

            {isBiometricSupported && (
              <TouchableOpacity 
                style={styles.biometricButton} 
                onPress={handleBiometricAuth}
                disabled={loading}
              >
                <Ionicons name={biometricIcon} size={30} color="#2255ee" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TouchableOpacity style={styles.linkButton} onPress={() => router.push('/(auth)/register')}>
          <Text style={styles.linkText}>New here? <Text style={styles.linkTextBold}>Create an account</Text></Text>
        </TouchableOpacity>

        <TouchableOpacity style={{ marginTop: 20 }} onPress={confirmLogout}>
          <Text style={{ color: '#9ca3af', textAlign: 'center', fontSize: 13 }}>
            Want to use a different account? <Text style={{ fontWeight: 'bold', color: '#2255ee', fontSize:16 }}>Clear session</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40, justifyContent: 'center' },
  header: { marginBottom: 40 },
  title: { fontSize: 32, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 16, color: '#6b7280', marginTop: 4 },
  form: { width: '100%' },
  inputLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, marginTop: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 16, height: 56, borderWidth: 1, borderColor: '#e5e7eb' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#111827' },
  forgotText: { color: '#2255ee', fontWeight: '600', fontSize: 14 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 32, marginBottom:10 },
  button: { flex: 1, backgroundColor: '#2255ee', height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  biometricButton: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#f0f4ff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#dbe4ff' },
  linkButton: { marginTop: 32, marginBottom: 20, alignItems: 'center' },
  linkText: { color: '#6b7280', fontSize: 15 },
  linkTextBold: { color: '#2255ee', fontWeight: '700' },
});