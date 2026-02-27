import { useEffect, useState, useRef, useCallback } from 'react';
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
  RefreshControl,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { chatService } from '../../../services/chatService';
import { supabase, Message, Chat } from '../../../lib/supabase';

function formatTime(dateString?: string) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(dateString?: string) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  return date.toLocaleDateString();
}

export default function ChatRoom() {
  const params = useLocalSearchParams();
  const chatId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [messages, setMessages] = useState<any[]>([]);
  const [chatDetails, setChatDetails] = useState<Chat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<any | null>(null);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const fetchData = useCallback(async (showLoadingSpinner = false) => {
    if (showLoadingSpinner) setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
    if (!chatId) { setLoading(false); return; }

    try {
      const msgs = await chatService.getMessages(chatId);
      setMessages(msgs);
      const { data } = await supabase
        .from('chats')
        .select(`*, buyer:users!buyer_id(username), seller:users!seller_id(username)`)
        .eq('id', chatId)
        .single();
      if (data) setChatDetails(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [chatId]);

  useEffect(() => { fetchData(true); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(false);
  }, [fetchData]);

  const handleActionMenu = (id: string) => {
    setActiveMenuId(activeMenuId === id ? null : id);
  };

  const startReply = (item: any) => {
    setReplyingTo(item);
    setEditingMessage(null);
    setActiveMenuId(null);
    inputRef.current?.focus();
  };

  const startEdit = (item: any) => {
    setEditingMessage(item);
    setReplyingTo(null);
    setNewMessage(item.content);
    setActiveMenuId(null);
    inputRef.current?.focus();
  };

  const confirmDelete = (msgId: string) => {
    Alert.alert("Delete Message", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMessage(msgId) }
    ]);
  };

  const deleteMessage = async (msgId: string) => {
    try {
      const { error } = await supabase.from('messages').delete().eq('id', msgId);
      
      if (error) throw error;

      // Filter out the deleted message AND any messages that were replying to it
      setMessages(prev => prev.filter(m => m.id !== msgId && m.parent_id !== msgId));
      setActiveMenuId(null);
    } catch (err) {
      console.error("Delete failed:", err);
      Alert.alert("Error", "Could not delete message");
    }
  };

  async function handleSend() {
    if (!newMessage.trim() || sending || !currentUserId) return;
    const text = newMessage.trim();
    setSending(true);

    try {
      if (editingMessage) {
        await supabase.from('messages').update({ content: text, is_edited: true }).eq('id', editingMessage.id);
        setMessages(prev => prev.map(m => m.id === editingMessage.id ? { ...m, content: text, is_edited: true } : m));
        setEditingMessage(null);
      } else {
        const payload: any = { chat_id: chatId, sender_id: currentUserId, content: text };
        if (replyingTo) payload.parent_id = replyingTo.id;
        const { data } = await supabase.from('messages').insert([payload]).select().single();
        if (data) setMessages(prev => [...prev, data]);
      }
      setNewMessage('');
      setReplyingTo(null);
    } catch {
      Alert.alert('Error', 'Failed to process message');
    } finally {
      setSending(false);
    }
  }

  const renderMessage = ({ item }: { item: any }) => {
    const mine = item.sender_id === currentUserId;
    const isMenuOpen = activeMenuId === item.id;
    const repliedMessage = messages.find(m => m.id === item.parent_id);

    return (
      <View style={[
        styles.row, 
        mine ? styles.right : styles.left,
        { zIndex: isMenuOpen ? 9999 : 1 }
      ]}>
        <TouchableOpacity 
          activeOpacity={0.9}
          onLongPress={() => handleActionMenu(item.id)}
          style={[
            styles.bubble, 
            mine ? styles.myBubble : styles.theirBubble,
          ]}
        >
          {repliedMessage && (
            <View style={[styles.replyInBubble, { backgroundColor: mine ? 'rgba(255,100,100,0.5)' : 'rgba(0,0,0,0.05)' }]}>
              <Text numberOfLines={1} style={[styles.replyTextSmall, { color: mine ? '#fff' : '#666' }]}>
                {repliedMessage.content}
              </Text>
            </View>
          )}

          <Text style={[styles.text, mine ? styles.myText : styles.theirText]}>
            {item.content}
          </Text>

          {isMenuOpen && (
            <View style={[styles.menuDropdown, mine ? { right: 100 } : { left: 0 }]}>
              {/* Only show Reply for others */}
              {!mine && (
                <TouchableOpacity style={styles.menuBtn} onPress={() => startReply(item)}>
                  <Ionicons name="arrow-undo-outline" size={14} color="#374151" />
                  <Text style={styles.menuBtnText}>Reply</Text>
                </TouchableOpacity>
              )}
              
              {/* Only show Edit for mine */}
              {mine && (
                <TouchableOpacity style={styles.menuBtn} onPress={() => startEdit(item)}>
                  <Ionicons name="pencil-outline" size={14} color="#374151" />
                  <Text style={styles.menuBtnText}>Edit</Text>
                </TouchableOpacity>
              )}

              {/* Show Delete for everyone (as per request: mine (edit/delete) others (reply/delete)) */}
              <TouchableOpacity style={styles.menuBtn} onPress={() => confirmDelete(item.id)}>
                <Ionicons name="trash-outline" size={14} color="#ef4444" />
                <Text style={[styles.menuBtnText, { color: '#ef4444' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.timeContainer}>
            <Text style={[styles.time, mine && styles.myTime]}>
              {item.is_edited && 'Edited • '}{formatTime(item.created_at)}  {formatDate(item.created_at)}
            </Text>
          </View>
        </TouchableOpacity>
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
      >
        <Pressable 
          style={styles.flex} 
          onPress={() => setActiveMenuId(null)}
          disabled={!activeMenuId}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.replace("../chat-list")}>
              <Ionicons name="chevron-back" size={28} color="#111" />
            </TouchableOpacity>
            <Text style={styles.title}>{chatDetails?.buyer?.username || 'Chat'}</Text>
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={i => i.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => !editingMessage && flatListRef.current?.scrollToEnd({ animated: true })}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh} 
                colors={["#2255ee"]}
                tintColor="#2255ee"
              />
            }
          />

          {(editingMessage || replyingTo) && (
            <View style={styles.preInputBar}>
              <View style={styles.preInputContent}>
                <Ionicons name={editingMessage ? "pencil" : "arrow-undo"} size={16} color="#2255ee" />
                <Text style={styles.preInputText} numberOfLines={1}>
                  {editingMessage ? `Editing: ${editingMessage.content}` : `Replying to: ${replyingTo.content}`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setEditingMessage(null); setReplyingTo(null); setNewMessage(''); }}>
                <Ionicons name="close-circle" size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputBar}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Type a message…"
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              placeholderTextColor="#9ca3af"
            />
            <TouchableOpacity onPress={handleSend} style={styles.send} disabled={sending || !newMessage.trim()}>
              {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: '#fff' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fff' },
  title: { marginLeft: 8, fontWeight: '700', fontSize: 18, color: '#111' },
  listContent: { padding: 16, paddingBottom: 20 },
  row: { flexDirection: 'row', marginBottom: 15 },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },
  
  bubble: { 
    maxWidth: '85%', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 18,
    minWidth: 100,
  },
  myBubble: { backgroundColor: '#2255ee22', borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: '#dd881122', borderBottomLeftRadius: 4 }, 
  
  text: { 
    fontSize: 15, 
    lineHeight: 20,
  },
  myText: { color: '#000' },
  theirText: { color: '#000' },
  
  menuDropdown: {
    position: 'absolute',
    top: -15,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 4,
    width: 140, 
    zIndex: 9999,
    ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 5 },
        android: { elevation: 10 }
    })
  },
  menuBtn: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  menuBtnText: { marginLeft: 10, fontSize: 14, color: '#374151', fontWeight: '500', width:140 },

  replyInBubble: { padding: 6, borderRadius: 8, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: '#2255ee', },
  replyTextSmall: { fontSize: 12, fontStyle: 'italic' }, 

  timeContainer: { 
    marginTop: 4, 
    flexDirection: 'row', 
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  time: { 
    fontSize: 10, 
    color: '#6b7280',
    flexWrap: 'nowrap',
  },
  myTime: { color: '#bfdbfe' },

  preInputBar: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#f3f4f6', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  preInputContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  preInputText: { marginLeft: 8, fontSize: 13, color: '#4b5563', fontStyle: 'italic', width:300 },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6', backgroundColor: '#fff' },
  input: { flex: 1, backgroundColor: '#e9faff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#111', borderWidth: 3, borderColor: '#e5e7eb' },
  send: { marginLeft: 10, backgroundColor: '#2255ee', borderRadius: 25, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});