import { useEffect, useState, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '../lib/supabase';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// Store current route in a module-level variable
let currentRoute = '';

// Configure how notifications appear when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function RootLayoutNav() {
  const { isVerified, setIsVerified } = useAuth();
  const [session, setSession] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const pendingChatId = useRef<string | null>(null);

  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    currentRoute = segments.join('/');
  }, [segments]);

  // Helper to register for push notifications
  async function registerForPushNotificationsAsync(userId: string) {
    if (!Device.isDevice) {
      // console.log('🚫 Not a physical device - skipping push notifications');
      return;
    }

    // console.log('📱 Starting push notification registration for user:', userId);

    // Create Android notification channel first
    if (Platform.OS === 'android') {
      // console.log('🤖 Setting up Android notification channel...');
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
        sound: 'default',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    // console.log('🔐 Current permission status:', existingStatus);

    if (existingStatus !== 'granted') {
      // console.log('❓ Requesting notification permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // console.log('✅ Final permission status:', finalStatus);

    if (finalStatus !== 'granted') {
      // console.log('❌ Notification permission denied');
      return;
    }

    try {
      // console.log('🎯 Getting Expo push token...');
      const token = (await Notifications.getExpoPushTokenAsync({
        projectId: "d7cf8412-3e30-4d59-91c4-8a4b7f3f0c52" 
      })).data;
      // console.log('🔑 Got push token:', token.substring(0, 20) + '...');

      const { error } = await supabase
        .from('users')
        .update({ push_token: token })
        .eq('id', userId);
      
      if (error) {
        console.error('❌ Error saving push token:', error);
      } else {
        // console.log('✅ Push token saved successfully!');
      }
    } catch (error) {
      console.error('❌ Error getting push token:', error);
    }
  }

  // 1. Handle Session and Auth State Changes
  useEffect(() => {
    const checkInitialSession = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      
      if (initialSession) {
        setSession(initialSession);
      }
      
      setIsInitializing(false);
    };

    checkInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);

      if (event === 'PASSWORD_RECOVERY') {
        setIsVerified(true); 
        router.replace('/(auth)/reset-password');
      }

      if (event === 'SIGNED_OUT') {
        setIsVerified(false); 
      }
    });

    Notifications.getLastNotificationResponseAsync().then(response => {
      const chatId = response?.notification.request.content.data?.chatId as string | undefined;
      if (chatId) pendingChatId.current = chatId;
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Handle Protected Route Redirection Logic
  useEffect(() => {
    if (isInitializing) return;

    const routeSegments = segments as string[];
    const inAuthGroup = routeSegments[0] === '(auth)';
    const isResetting = routeSegments.includes('reset-password');

    if (isResetting) return;

    if (!session || !isVerified) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } 
    else {
      const targetChatId = pendingChatId.current;
      
      if (targetChatId) {
        pendingChatId.current = null; 
        router.replace(`/(tabs)/chat/${targetChatId}`);
      } else if (inAuthGroup) {
        router.replace('/(tabs)');
      }
    }
  }, [session, isInitializing, segments, isVerified]);

  // 3. Register for notifications once verified
  useEffect(() => {
    if (session?.user?.id && isVerified) {
      registerForPushNotificationsAsync(session.user.id);
    }
  }, [session, isVerified]);

  // 4. Global Presence Tracking (Online Status)
  useEffect(() => {
    if (!session?.user?.id || !isVerified) return;

    const userId = session.user.id;

    const updateOnlineStatus = async (isOnline: boolean) => {
      await supabase
        .from('users')
        .update({ 
          is_online: isOnline,
          last_seen: new Date().toISOString() 
        })
        .eq('id', userId);
    };

    updateOnlineStatus(true);

    const channel = supabase.channel('global_presence', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          online_at: new Date().toISOString(),
          status: 'Online',
        });
      }
    });

    const interval = setInterval(() => updateOnlineStatus(true), 30 * 1000);

    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        updateOnlineStatus(true);
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        updateOnlineStatus(false);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      updateOnlineStatus(false); 
      clearInterval(interval);
      channel.unsubscribe();
      subscription?.remove();
    };
  }, [session, isVerified]);

  // 5. Handle Notification Response (Deep Linking to Chat)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      // console.log('🔔 Notification tapped:', response);
      const chatId = response.notification.request.content.data?.chatId as string | undefined;
      
      if (chatId) {
        if (session && isVerified) {
          router.push(`/(tabs)/chat/${chatId}`);
        } else {
          pendingChatId.current = chatId;
        }
      }
    });

    const foregroundSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const chatId = notification.request.content.data?.chatId as string;
      const isInSameChat = currentRoute.includes(`/chat/${chatId}`);
      if (isInSameChat) {
        // console.log('🚫 Suppressing notification - user is in same chat');
      }
      // Push notification already shows itself — no need to schedule a local duplicate
    });

    return () => {
      subscription.remove();
      foregroundSubscription.remove();
    };
  }, [session, isVerified]);

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <SafeAreaProvider>
          <AuthProvider>
            <RootLayoutNav />
          </AuthProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
 