import { supabase, Chat, Message, User } from '../lib/supabase';

export const chatService = {
  // Get user's chats with latest message
  async getUserChats(): Promise<Chat[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('chats')
      .select(`
        *,
        product:products (*),
        buyer:users!buyer_id (*, is_online, last_seen),
        seller:users!seller_id (*, is_online, last_seen),
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
        type: 'product',
        product_id: productId,
        buyer_id: user.id,
        seller_id: sellerId,
      })
      .select('*, product:products(*)')
      .single();

    if (error) throw error;
    return data;
  },

  // ===============================
  // 🔥 DIRECT CHAT LOGIC (UPDATED)
  // ===============================

  async getAllUsersExceptMe(): Promise<any[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: users, error } = await supabase
      .from('users')
      .select('*, is_online, last_seen')
      .neq('id', user.id);

    if (error) throw error;
    if (!users || users.length === 0) return [];

    const usersWithLastMessage = await Promise.all(
      users.map(async (otherUser) => {
        const { data: chat } = await supabase
          .from('chats')
          .select('id')
          .eq('type', 'direct')
          .or(
            `and(buyer_id.eq.${user.id},seller_id.eq.${otherUser.id}),and(buyer_id.eq.${otherUser.id},seller_id.eq.${user.id})`
          )
          .maybeSingle();

        if (!chat) {
          return { ...otherUser, last_message: null };
        }

        const { data: lastMessage } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', chat.id)
          .or(`deleted_for_everyone.is.null,deleted_for_everyone.eq.false`)
          .or(`deleted_for_self.is.null,deleted_for_self.eq.false,sender_id.neq.${user.id}`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...otherUser,
          last_message: lastMessage || null,
        };
      })
    );

    usersWithLastMessage.sort((a, b) => {
      if (!a.last_message) return 1;
      if (!b.last_message) return -1;

      return (
        new Date(b.last_message.created_at).getTime() -
        new Date(a.last_message.created_at).getTime()
      );
    });

    return usersWithLastMessage;
  },

  async getOrCreateDirectChat(otherUserId: string): Promise<Chat> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: existing } = await supabase
      .from('chats')
      .select(`
        *,
        buyer:users!buyer_id (*, is_online, last_seen),
        seller:users!seller_id (*, is_online, last_seen)
      `)
      .eq('type', 'direct')
      .or(`and(buyer_id.eq.${user.id},seller_id.eq.${otherUserId}),and(buyer_id.eq.${otherUserId},seller_id.eq.${user.id})`)
      .maybeSingle();

    if (existing) return existing;

    const { data, error } = await supabase
      .from('chats')
      .insert({
        type: 'direct',
        buyer_id: user.id,
        seller_id: otherUserId,
        product_id: null
      })
      .select(`
        *,
        buyer:users!buyer_id (*, is_online, last_seen),
        seller:users!seller_id (*, is_online, last_seen)
      `)
      .single();

    if (error) {
      console.error("Insert error:", error);
      throw error;
    }

    return data;
  },

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

  // ===============================
  // ✅ PRESENCE & NOTIFICATIONS
  // ===============================

  async savePushToken(token: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('users')
      .update({ push_token: token })
      .eq('id', user.id);

    if (error) console.error('Error saving push token:', error);
  },

  subscribeToPresence(chatId: string, userId: string, onPresenceChange: (onlineUserIds: string[]) => void) {
    const channel = supabase.channel(`presence:${chatId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const onlineIds = Object.keys(newState);
        onPresenceChange(onlineIds);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            online_at: new Date().toISOString(),
          });
        }
      });

    return channel;
  },

  // ===============================
  // ✅ DELIVERY & READ SYSTEM
  // ===============================

  // Mark a single message as delivered (called when recipient's client receives the message)
  async markMessageDelivered(messageId: string): Promise<void> {
    if (!messageId) return;
    const { data: sessionUser } = await supabase.auth.getUser();
    if (!sessionUser?.user) return;

    const { error } = await supabase
      .from('messages')
      .update({
        is_delivered: true,
        delivered_at: new Date().toISOString()
      })
      .eq('id', messageId)
      // Safety: Only mark as delivered if I am NOT the sender
      .neq('sender_id', sessionUser.user.id)
      .eq('is_delivered', false);

    if (error) {
      console.error('markMessageDelivered error', error);
    }
  },

  async markMessagesAsRead(chatId: string, readerId: string): Promise<void> {
    if (!chatId || !readerId) return;

    const { error } = await supabase
      .from('messages')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('chat_id', chatId)
      // Only mark messages sent by the OTHER person
      .neq('sender_id', readerId)
      .eq('is_read', false);

    if (error) console.error('markMessagesAsRead error:', error);
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};