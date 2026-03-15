import { useEffect, useState, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '../lib/supabase';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

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
  
  // Ref to store the chatId if the user is not logged in when they tap the notification
  const pendingChatId = useRef<string | null>(null);

  const segments = useSegments();
  const router = useRouter();

  // Helper to register for push notifications
  async function registerForPushNotificationsAsync(userId: string) {
    if (!Device.isDevice) return;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    try {
      const token = (await Notifications.getExpoPushTokenAsync({
        projectId: "d7cf8412-3e30-4d59-91c4-8a4b7f3f0c52" 
      })).data;

      // Update the user's push token in Supabase
      await supabase
        .from('users')
        .update({ push_token: token })
        .eq('id', userId);
    } catch (error) {
      console.error("Error getting push token:", error);
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

    // CHECK FOR INITIAL NOTIFICATION (if app was closed)
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
      // User is authenticated
      const targetChatId = pendingChatId.current;
      
      if (targetChatId) {
        pendingChatId.current = null; // Clear it immediately
        // Use replace to ensure the home stack doesn't load underneath
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

    // Function to update online status and last seen in database
    const updateOnlineStatus = async (isOnline: boolean) => {
      await supabase
        .from('users')
        .update({ 
          is_online: isOnline,
          last_seen: new Date().toISOString() 
        })
        .eq('id', userId);
    };

    // Set user as online when they connect
    updateOnlineStatus(true);

    const channel = supabase.channel('global_presence', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            online_at: new Date().toISOString(),
            status: 'Online',
          });
        }
      });

    // Keep online status fresh (every 30 seconds)
    const interval = setInterval(() => updateOnlineStatus(true), 30 * 1000);

    // Handle app state changes (background/foreground)
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        updateOnlineStatus(true);
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        updateOnlineStatus(false);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      updateOnlineStatus(false); // Set offline when component unmounts
      clearInterval(interval);
      channel.unsubscribe();
      subscription?.remove();
    };
  }, [session, isVerified]);

  // 5. Handle Notification Response (Deep Linking to Chat)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const chatId = response.notification.request.content.data?.chatId as string | undefined;
      
      if (chatId) {
        if (session && isVerified) {
          router.push(`/(tabs)/chat/${chatId}`);
        } else {
          pendingChatId.current = chatId;
        }
      }
    });

    return () => subscription.remove();
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