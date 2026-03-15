import { useState, useEffect, useRef } from 'react';
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const { setIsVerified } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<string[]>([]);
   const passwordInputRef = useRef<TextInput>(null);

  useEffect(() => {
    checkDeviceSupport();
    loadSavedAccounts();
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

  const loadSavedAccounts = async () => {
    try {
      const existing = await SecureStore.getItemAsync('saved_accounts');
      if (existing) {
        setSavedAccounts(JSON.parse(existing));
      }
    } catch (e) {
      console.error("Failed to load accounts", e);
    }
  };

  const updateAccountOrder = async (recentEmail: string) => {
    try {
      const existingAccountsStr = await SecureStore.getItemAsync('saved_accounts');
      let accountsArray: string[] = [];
      if (existingAccountsStr) {
        const parsed = JSON.parse(existingAccountsStr);
        if (Array.isArray(parsed)) accountsArray = parsed;
      }

      const filtered = accountsArray.filter(acc => acc !== recentEmail);
      const updated = [recentEmail, ...filtered];
      
      await SecureStore.setItemAsync('saved_accounts', JSON.stringify(updated));
      setSavedAccounts(updated);
    } catch (e) {
      console.error("Failed to update account order:", e);
    }
  };

  const removeAccount = async (emailToRemove: string) => {
  Alert.alert(
    "Remove Account?",
    `Are you sure you want to remove ${emailToRemove} from the login screen?`,
    [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Remove", 
        style: "destructive",
        onPress: async () => {
          try {
            // 1. Filter the list
            const updated = savedAccounts.filter(acc => acc !== emailToRemove);
            
            // 2. Update SecureStore for the list
            await SecureStore.setItemAsync('saved_accounts', JSON.stringify(updated));
            
            // 3. Remove the specific refresh token for this email
            await SecureStore.deleteItemAsync(`token_${emailToRemove}`);
            
            // 4. Update the UI state
            setSavedAccounts(updated);

            // 5. Check if the removed account is the one currently logged in
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.email?.toLowerCase() === emailToRemove.toLowerCase()) {
              handleHardLogout();
            }
          } catch (e) {
            console.error("Failed to remove account:", e);
          }
        } 
      }
    ]
  );
};

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Missing Info', 'Please enter both email and password');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      if (error.message.includes("Email not confirmed")) {
        Alert.alert(
          'Verify Your Email', 
          'You need to confirm your email address before you can log in. Please check your inbox for the confirmation link.'
        );
      } else {
        Alert.alert('Login Failed', error.message);
      }
      setLoading(false); 
    } else {
      await updateAccountOrder(email.toLowerCase());
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
      redirectTo: 'tradetalk://reset-password', 
    });

    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Password reset link has been sent to your email.');
    }
  }

  async function handleBiometricAuth(targetEmail?: string) {
    const authEmail = targetEmail || email;
    if (!authEmail) return;

    setLoading(true);
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      setLoading(false);
     Alert.alert('No Session', 'Please sign in with your password first.', [
        { text: 'OK', onPress: () => passwordInputRef.current?.focus() }
      ]);
      return;
    }

    if (authEmail.toLowerCase() !== session.user.email?.toLowerCase()) {
      setLoading(false);
      Alert.alert(
        'Account Mismatch', 
        `The saved biometric session is for ${session.user.email}. To use ${authEmail}, please enter your password.`,
        [{ 
          text: 'OK', 
          onPress: () => passwordInputRef.current?.focus() 
        }]
      );
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Sign in as ${session.user.email}`,
      fallbackLabel: 'Use Password',
    });

    if (result.success) {
      await updateAccountOrder(authEmail.toLowerCase());
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

  // const confirmLogout = () => {
  //   Alert.alert(
  //     "Clear Session?",
  //     "This will log you out and clear all saved data for this account.",
  //     [
  //       { text: "Cancel", style: "cancel" },
  //       { text: "Clear & Logout", onPress: () => handleHardLogout(), style: "destructive" }
  //     ]
  //   );
  // };

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

        {savedAccounts.length > 0 && (
          <View style={styles.accountSelector}>
            <Text style={styles.accountLabel}>Recent Accounts:</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.accountScroll}
              alwaysBounceHorizontal={true}
            >
              {savedAccounts.map((savedEmail) => (
                <View key={savedEmail} style={styles.accountWrapper}>
                  <TouchableOpacity 
                    style={styles.accountChip}
                    onPress={() => {
                      setEmail(savedEmail);
                      handleBiometricAuth(savedEmail);
                    }}
                  >
                    <View style={styles.accountAvatar}>
                      <Text style={styles.avatarText}>{savedEmail ? savedEmail[0].toUpperCase() : '?'}</Text>
                    </View>
                    <Text numberOfLines={1} style={styles.accountChipText}>{savedEmail.split('@')[0]}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.removeBadge} 
                    onPress={() => removeAccount(savedEmail)}
                  >
                    <MaterialCommunityIcons name="close-circle" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

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
            <Text  style={styles.inputLabel}>Password</Text>
            <TouchableOpacity onPress={handleForgotPassword}>
              <Text style={styles.forgotText}>Forgot?</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              ref={passwordInputRef}
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
                onPress={() => handleBiometricAuth()}
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

        {/* <TouchableOpacity style={{ marginTop: 20 }} onPress={confirmLogout}>
          <Text style={{ color: '#9ca3af', textAlign: 'center', fontSize: 13 }}>
            Want to use a different account? <Text style={{ fontWeight: 'bold', color: '#2255ee', fontSize:16 }}>Clear session</Text>
          </Text>
        </TouchableOpacity> */}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40, justifyContent: 'center' },
  header: { marginBottom: 30 },
  title: { fontSize: 32, fontWeight: '800', color: '#111827', textAlign:"center" },
  subtitle: { fontSize: 16, color: '#6b7280', marginTop: 4, textAlign:"center" },
  
  // Account Selector Styles
  accountSelector: { marginBottom: 20 },
  accountLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 },
  accountScroll: { paddingRight: 20 },
  accountWrapper: { position: 'relative', marginRight: 15 },
  accountChip: { alignItems: 'center', backgroundColor: '#f3f4f6', padding: 12, borderRadius: 16, width: 100, borderWidth: 1, borderColor: '#e5e7eb' },
  accountAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2255ee', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  accountChipText: { fontSize: 10, color: '#374151', fontWeight: '300', width:100, textAlign:"center"  },
  removeBadge: { position: 'absolute', top: -3, right: -6, backgroundColor: '#fff', borderRadius: 10, },

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
  linkTextBold: { color: '#2255ee', textDecorationLine:"underline" },
});