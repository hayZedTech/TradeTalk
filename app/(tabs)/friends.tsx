import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { FriendRequest } from '../../lib/supabase';
import { router } from 'expo-router';
import { chatService } from '../../services/chatService';

type Tab = 'pending' | 'accepted' | 'declined';

export default function FriendsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [activeTab])
  );

  const loadRequests = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    const { data, error } = await supabase
      .from('friend_requests')
      .select('*, sender:users!sender_id(id, username, avatar_url), receiver:users!receiver_id(id, username, avatar_url)')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .eq('status', activeTab)
      .order('updated_at', { ascending: false });

    if (!error) setRequests(data || []);
    setLoading(false);
  };

  const handleAccept = async (request: FriendRequest) => {
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', request.id);

    if (error) { Alert.alert('Error', 'Failed to accept request'); return; }
    loadRequests();
  };

  const handleDecline = async (request: FriendRequest) => {
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'declined', updated_at: new Date().toISOString() })
      .eq('id', request.id);

    if (error) { Alert.alert('Error', 'Failed to decline request'); return; }
    loadRequests();
  };

  const handleOpenChat = async (request: FriendRequest) => {
    if (!currentUserId) return;
    const otherId = request.sender_id === currentUserId ? request.receiver_id : request.sender_id;
    try {
      const chat = await chatService.getOrCreateDirectChat(otherId);
      router.push({ pathname: `/chat/${chat.id}`, params: { source: 'personal' } });
    } catch {
      Alert.alert('Error', 'Could not open chat');
    }
  };

  const renderItem = ({ item }: { item: FriendRequest }) => {
    if (!currentUserId) return null;
    const isIncoming = item.receiver_id === currentUserId;
    const otherUser = isIncoming ? item.sender : item.receiver;

    return (
      <View style={styles.card}>
        <Image
          source={{ uri: (otherUser as any)?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent((otherUser as any)?.username || 'U')}` }}
          style={styles.avatar}
        />
        <View style={styles.info}>
          <Text style={styles.username}>@{(otherUser as any)?.username}</Text>
          <Text style={styles.subtext}>
            {activeTab === 'pending' && isIncoming ? 'Wants to connect with you' :
             activeTab === 'pending' && !isIncoming ? 'Request sent' :
             activeTab === 'accepted' ? 'Friends' : 'Declined'}
          </Text>
        </View>

        {activeTab === 'pending' && isIncoming && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item)}>
              <Text style={styles.acceptText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.declineBtn} onPress={() => handleDecline(item)}>
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'accepted' && (
          <TouchableOpacity style={styles.chatBtn} onPress={() => handleOpenChat(item)}>
            <Text style={styles.chatBtnText}>Chat</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Friends</Text>

      <View style={styles.tabs}>
        {(['pending', 'accepted', 'declined'] as Tab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2255ee" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No {activeTab} requests</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { fontSize: 22, fontWeight: 'bold', padding: 16, color: '#1f2937' },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8 },
  tab: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: '#2255ee' },
  tabText: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
  activeTabText: { color: '#2255ee' },
  list: { padding: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 14, marginBottom: 10,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e5e7eb' },
  info: { flex: 1, marginLeft: 12 },
  username: { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  subtext: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { backgroundColor: '#2255ee', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  acceptText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  declineBtn: { backgroundColor: '#f3f4f6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  declineText: { color: '#374151', fontWeight: '700', fontSize: 13 },
  chatBtn: { backgroundColor: '#2255ee', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  chatBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#9ca3af', fontSize: 15 },
});
