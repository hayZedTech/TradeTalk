import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

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

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  user?: User; // Optional: if we want to show who reacted
  created_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: User;

  // -- Optional fields --
  parent_id?: string | null;

  file_url?: string | null;
  file_type?: "image" | "video" | "audio" | null;

  is_delivered?: boolean;
  delivered_at?: string | null;
  is_read?: boolean;
  read_at?: string | null;
  is_edited?: boolean;
  reactions?: Reaction[];
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
  sender?: User;
  receiver?: User;
}

/** 👇 NEW: Chat type */
export type ChatType = "product" | "direct";

export interface Chat {
  id: string;
  type: ChatType; // 👈 added
  product_id?: string | null; // 👈 now optional for direct chats
  buyer_id: string;
  seller_id: string;
  created_at: string;
  product?: Product;
  last_message?: Message;
  buyer?: User;
  seller?: User;
  messages?: Message[];
}
