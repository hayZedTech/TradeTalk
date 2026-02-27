import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';

function RootLayoutNav() {
  const { isVerified, setIsVerified } = useAuth();
  const [session, setSession] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const segments = useSegments();
  const router = useRouter();

  // 1. Handle Session and Auth State Changes
  useEffect(() => {
    const checkInitialSession = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      
      if (initialSession) {
        setSession(initialSession);
        // Note: isVerified remains false to force Biometric check on app start
      }
      
      setIsInitializing(false);
    };

    checkInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);

      // Handle the deep link for password recovery
      if (event === 'PASSWORD_RECOVERY') {
        setIsVerified(true); 
        router.replace('/(auth)/reset-password');
      }

      if (!currentSession) {
        setIsVerified(false); 
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Handle Protected Route Redirection Logic
  useEffect(() => {
    if (isInitializing) return;

    const routeSegments = segments as string[];
    const inAuthGroup = routeSegments[0] === '(auth)';
    const isResetting = routeSegments.includes('reset-password');

    // If no session exists, always push to login
    if (!session) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } 
    // If session exists but biometrics haven't passed
    else if (!isVerified) {
      // Allow them to stay in (auth) to reset password or login
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    }
    // If authenticated and verified
    else {
      // If user is in (auth) but NOT resetting password, send to (tabs)
      if (inAuthGroup && !isResetting) {
        router.replace('/(tabs)');
      }
    }
  }, [session, isInitializing, segments, isVerified]);

  if (isInitializing) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}