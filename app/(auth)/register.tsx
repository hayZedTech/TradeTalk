import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function Register() {
  const { setIsVerified } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

async function handleRegister() {
    // 1. Basic Validations
    if (!email || !password || !username) {
      Alert.alert('Missing Fields', 'Please fill in all details.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords Match', 'Your passwords do not match!');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password should be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      // 2. Sign up the user in Supabase Auth
      // The trigger 'on_auth_user_created' in your database handles the public.users insert.
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { 
          data: { username: username.trim() }, 
          emailRedirectTo: 'tradetalk://login' 
        },
      });

      if (signUpError) {
        // Handle the specific case where the username is already taken in public.users
        // This error comes back from your database via the trigger
        if (signUpError.message.includes('users_username_key')) {
          Alert.alert('Username Taken', 'This username is already in use. Please try another.');
        } 
        // Handle the case where the email is already registered in Auth
        else if (signUpError.message.includes('User already registered')) {
          Alert.alert('Account Exists', 'This email is already registered. Please login instead.');
        } 
        else {
          throw signUpError;
        }
        setLoading(false);
        return;
      }

      // 3. Success - Confirmation Alert
      setLoading(false);
      Alert.alert(
        'Registration Successful',
        'We sent a confirmation link to ' + email.toLowerCase() + '. Please check your inbox before logging in.',
        [{ text: 'OK', onPress: () => router.back() }]
      );

    } catch (error: any) {
      setLoading(false);
      Alert.alert('Error', error.message || 'An unexpected error occurred.');
    }
  }

  
  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join TradeTalk and start swapping</Text>
        </View>

        <View style={styles.form}>
          {/* Username Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Get Started</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.linkButton} 
          onPress={() => router.back()}
        >
          <Text style={styles.linkText}>
            Already have an account? <Text style={styles.linkTextBold}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
    textAlign:"center"
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 8,
    textAlign:"center"
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 60,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
  },
  button: {
    backgroundColor: '#2255ee',
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#2255ee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  linkButton: {
    marginTop: 32,
    alignItems: 'center',
  },
  linkText: {
    color: '#4b5563',
    fontSize: 15,
  },
  linkTextBold: { color: '#2255ee',  textDecorationLine:"underline", },
});