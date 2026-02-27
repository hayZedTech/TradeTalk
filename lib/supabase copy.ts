import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// --- Chunking Logic to bypass Expo SecureStore 2048 byte limit ---
const MAX_CHUNK_SIZE = 2000; 

const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    try {
      // Check for chunked data first (explicitly checking for null)
      const chunk0 = await SecureStore.getItemAsync(`${key}-0`);
      if (chunk0 !== null) {
        const chunk1 = await SecureStore.getItemAsync(`${key}-1`);
        const chunk2 = await SecureStore.getItemAsync(`${key}-2`);
        return (chunk0 || '') + (chunk1 || '') + (chunk2 || '');
      }
      // Fallback for non-chunked small sessions
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      return null;
    }
  },

  setItem: async (key: string, value: string) => {
    try {
      if (value.length > MAX_CHUNK_SIZE) {
        // Split into chunks
        const chunk0 = value.slice(0, MAX_CHUNK_SIZE);
        const chunk1 = value.slice(MAX_CHUNK_SIZE, MAX_CHUNK_SIZE * 2);
        const chunk2 = value.slice(MAX_CHUNK_SIZE * 2);

        await SecureStore.setItemAsync(`${key}-0`, chunk0);
        await SecureStore.setItemAsync(`${key}-1`, chunk1);
        if (chunk2) await SecureStore.setItemAsync(`${key}-2`, chunk2);
        
        // Remove the single-key version if it exists to keep storage clean
        await SecureStore.deleteItemAsync(key);
      } else {
        // If data is small, use the standard key and wipe any old chunks
        await SecureStore.setItemAsync(key, value);
        await SecureStore.deleteItemAsync(`${key}-0`);
        await SecureStore.deleteItemAsync(`${key}-1`);
        await SecureStore.deleteItemAsync(`${key}-2`);
      }
    } catch (e) {
      console.error("Supabase Storage setItem error:", e);
    }
  },

  removeItem: async (key: string) => {
    try {
      // Clean up all possible storage variations
      await Promise.all([
        SecureStore.deleteItemAsync(key),
        SecureStore.deleteItemAsync(`${key}-0`),
        SecureStore.deleteItemAsync(`${key}-1`),
        SecureStore.deleteItemAsync(`${key}-2`),
      ]);
    } catch (e) {
      console.error("Supabase Storage removeItem error:", e);
    }
  },
};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("Supabase credentials missing! Biometrics and Auth will fail.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// --- Database Types ---

export interface User {
  id: string;
  email: string;
  username: string;
  avatar_url?: string;
  created_at: string;
}

export interface Product {
  id: string;
  user_id: string;
  title: string;
  description: string;
  image_url: string;
  category: string;
  condition: string;
  created_at: string;
  price: number;
  owner?: User;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: User;
}

export interface Chat {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  created_at: string;
  product?: Product;
  last_message?: Message;
  buyer?: User;
  seller?: User;
  messages?: Message[]; 
}