import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("Supabase credentials missing! Auth will fail.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
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