import { supabase, Chat, Message, User } from '../lib/supabase';

export const chatService = {
  // Get user's chats with latest message
  async getUserChats(): Promise<Chat[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Fetch chats with nested product, buyer, seller, and all messages
    const { data, error } = await supabase
      .from('chats')
      .select(`
        *,
        product:products (*),
        buyer:users!buyer_id (*),
        seller:users!seller_id (*),
        messages:messages!messages_chat_id_fkey (
          *,
          sender:users (*)
        )
      `)
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching chats:', error);
      throw error;
    }

    // Take only the latest message for each chat
    const chatsWithLastMessage: Chat[] = (data || []).map(chat => {
      const lastMsg = chat.messages?.sort(
        (a: Message, b: Message) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      return { ...chat, last_message: lastMsg || null };
    });

    return chatsWithLastMessage;
  },

  // Get messages for a chat with sender profile
  async getMessages(chatId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:users (*)
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Send a message
  async sendMessage(chatId: string, content: string): Promise<Message> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: user.id,
        content,
      })
      .select(`
        *,
        sender:users (*)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  // Start a new chat for a product
  async startChat(productId: string, sellerId: string): Promise<Chat> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Check if chat already exists
    const { data: existing } = await supabase
      .from('chats')
      .select('*, product:products(*)')
      .eq('product_id', productId)
      .eq('buyer_id', user.id)
      .maybeSingle();

    if (existing) return existing;

    const { data, error } = await supabase
      .from('chats')
      .insert({
        product_id: productId,
        buyer_id: user.id,
        seller_id: sellerId,
      })
      .select('*, product:products(*)')
      .single();

    if (error) throw error;
    return data;
  },

  // Subscribe to new messages in real-time
  subscribeToMessages(chatId: string, callback: (msg: Message) => void) {
    return supabase
      .channel(`chat:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from('messages')
            .select('*, sender:users(*)')
            .eq('id', payload.new.id)
            .single();

          if (data) callback(data);
        }
      )
      .subscribe();
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};
