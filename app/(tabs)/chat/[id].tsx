import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { chatService } from '../../../services/chatService';
import { supabase, Message, Chat } from '../../../lib/supabase';

function formatTime(dateString?: string) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(dateString?: string) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString();
}

export default function ChatRoom() {
  const params = useLocalSearchParams();
  const chatId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [messages, setMessages] = useState<Message[]>([]);
  const [chatDetails, setChatDetails] = useState<Chat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      if (!chatId) return;

      try {
        const msgs = await chatService.getMessages(chatId);
        setMessages(msgs);

        const { data } = await supabase
          .from('chats')
          .select(`
            *,
            buyer:users!buyer_id(username),
            seller:users!seller_id(username)
          `)
          .eq('id', chatId)
          .single();

        if (data) setChatDetails(data);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [chatId]);

  async function handleSend() {
    if (!newMessage.trim() || sending || !currentUserId) return;

    const text = newMessage.trim();
    setNewMessage('');
    setSending(true);

    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      chat_id: chatId!,
      sender_id: currentUserId,
      content: text,
      created_at: new Date().toISOString(),
    } as Message;

    setMessages(prev => [...prev, tempMessage]);

    requestAnimationFrame(() =>
      flatListRef.current?.scrollToEnd({ animated: true })
    );

    try {
      await chatService.sendMessage(chatId!, text);
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
      setNewMessage(text);
      Alert.alert('Error', 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  const renderMessage = ({ item }: { item: Message }) => {
    const mine = item.sender_id === currentUserId;

    return (
      <View style={[styles.row, mine ? styles.right : styles.left]}>
        <View
          style={[
            styles.bubble,
            mine ? styles.myBubble : styles.theirBubble,
            mine ? styles.myAlign : styles.theirAlign,
          ]}
        >
          <Text
            style={[
              styles.text,
              mine && styles.myText,
            ]}
          >
            {item.content}
          </Text>

          <Text style={[styles.time, mine && styles.myTime]}>
            {formatTime(item.created_at)} • {formatDate(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={80}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace("../chat-list")}>
            <Ionicons name="chevron-back" size={32} />
          </TouchableOpacity>
          <Text style={styles.title}>
            {chatDetails?.buyer?.username || 'Chat'}
          </Text>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={i => i.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Type a message…"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
          />
          <TouchableOpacity onPress={handleSend} style={styles.send}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: { marginLeft: 12, fontWeight: '700', fontSize: 16 },

  listContent: {
    padding: 16,
    paddingBottom: 110,
  },

  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },

  bubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 18,
    flexShrink: 1,          // 🔥 critical
    minWidth: 1,            // 🔥 Android fix
  },
  myAlign: { alignSelf: 'flex-end' },
  theirAlign: { alignSelf: 'flex-start' },

  myBubble: { backgroundColor: '#2255ee' },
  theirBubble: { backgroundColor: '#eee' },

  text: {
    width:120,
    fontSize: 16,
    lineHeight: 22,
    flexWrap: 'wrap',       // 🔥 forces wrapping
    includeFontPadding: false, // 🔥 Android clipping fix
  },
  myText: { color: '#fff' },

  time: {
    marginTop: 4,
    fontSize: 11,
    color: '#666',
    alignSelf: 'flex-end',
  },
  myTime: { color: '#e5e7eb' },

  inputBar: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  send: {
    marginLeft: 8,
    backgroundColor: '#2255ee',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
