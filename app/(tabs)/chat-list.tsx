import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { chatService } from '../../services/chatService';
import { Chat, Message } from '../../lib/supabase';

export default function ChatList() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadChats() {
    try {
      const data = await chatService.getUserChats();
      setChats(data);
    } catch (error) {
      console.error('Error loading chats:', error);
      // Only alert if it's the first load to avoid annoying the user
      if (loading) Alert.alert('Error', 'Failed to load chats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // This ensures the list updates when you navigate back from a chat
  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadChats();
  };

  const handleChatPress = (chat: Chat) => {
    router.push({
      pathname: '/chat/[id]',
      params: { id: chat.id },
    });
  };

  const renderChat = ({ item }: { item: Chat }) => {
    const productTitle = item.product?.title || 'Unknown Item';
    const lastMsg: Message | null = item.last_message || null;

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => handleChatPress(item)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {productTitle.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.chatInfo}>
          <Text style={styles.chatTitle}>{productTitle}</Text>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {lastMsg ? lastMsg.content : 'No messages yet'}
          </Text>
          {lastMsg && (
            <Text style={styles.time}>
              {new Date(lastMsg.created_at).toLocaleDateString()} •{' '}
              {new Date(lastMsg.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Messages</Text>

      {chats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No conversations yet</Text>
          <Text style={styles.emptySubtext}>
            Start trading to see messages here
          </Text>
          <TouchableOpacity onPress={onRefresh} style={{marginTop: 20}}>
             <Text style={{color: '#6366f1', fontWeight: 'bold'}}>Tap to Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={chats}
          renderItem={renderChat}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6366f1"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', padding: 16, color: '#1f2937' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  emptySubtext: { fontSize: 14, color: '#6b7280', marginTop: 8 },
  listContent: { padding: 8 },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2255ee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  chatInfo: { flex: 1, marginLeft: 12 },
  chatTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  lastMessage: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  time: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
});