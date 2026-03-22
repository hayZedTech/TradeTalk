import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { chatService } from '../../../services/chatService';
import { User, supabase } from '../../../lib/supabase';

// Grandfathering cutoff — all users created before this feature launched
const GRANDFATHER_CUTOFF = '2025-07-24T00:00:00.000Z';

export default function ChatroomScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [imageZoomVisible, setImageZoomVisible] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<{[userId: string]: number}>({});

  // ✅ Updated Date Formatter (Today / Yesterday / Date)
  const formatTime = (dateString?: string) => {
    if (!dateString) return '';

    const now = new Date();
    const past = new Date(dateString);

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const pastDate = new Date(past.getFullYear(), past.getMonth(), past.getDate());

    if (pastDate.getTime() === today.getTime()) {
      return 'Today';
    }

    if (pastDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    }

    return past.toLocaleDateString();
  };

  // ✅ NEW: This triggers every time you navigate back to this screen
  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [])
  );

  useEffect(() => {
    if (!search.trim()) {
      setFilteredUsers(users);
    } else {
      const q = search.toLowerCase();
      setFilteredUsers(
        users.filter(u =>
          u.username.toLowerCase().includes(q) ||
          (u.email && u.email.toLowerCase().includes(q))
        )
      );
    }
  }, [search, users]);

  const loadUsers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const data = await chatService.getAllUsersExceptMe();
      
      // Load unread counts for each user's direct chat
      const unreadData: {[userId: string]: number} = {};
      await Promise.all(
        data.map(async (otherUser) => {
          // Find direct chat between current user and this user
          const { data: chat } = await supabase
            .from('chats')
            .select('id')
            .eq('type', 'direct')
            .or(
              `and(buyer_id.eq.${user.id},seller_id.eq.${otherUser.id}),and(buyer_id.eq.${otherUser.id},seller_id.eq.${user.id})`
            )
            .maybeSingle();

          if (chat) {
            const { count } = await supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('chat_id', chat.id)
              .neq('sender_id', user.id)
              .eq('is_read', false);
            unreadData[otherUser.id] = count || 0;
          } else {
            unreadData[otherUser.id] = 0;
          }
        })
      );
      
      setUnreadCounts(unreadData);
      setUsers(data);
      setFilteredUsers(data);
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setLoading(false);
    }
  };

  const startChat = async (otherUser: any) => {
    try {
      const { data: { user: me } } = await supabase.auth.getUser();
      if (!me) return;

      // 1. Grandfathered: both users existed before cutoff → chat freely
      const myCreatedAt = new Date((await supabase.from('users').select('created_at').eq('id', me.id).single()).data?.created_at);
      const theirCreatedAt = new Date(otherUser.created_at);
      const cutoff = new Date(GRANDFATHER_CUTOFF);

      if (myCreatedAt < cutoff && theirCreatedAt < cutoff) {
        const chat = await chatService.getOrCreateDirectChat(otherUser.id);
        router.push({ pathname: `/chat/${chat.id}`, params: { source: 'personal' } });
        return;
      }

      // 2. Check existing friend request
      const { data: existing } = await supabase
        .from('friend_requests')
        .select('id, status, updated_at')
        .or(`and(sender_id.eq.${me.id},receiver_id.eq.${otherUser.id}),and(sender_id.eq.${otherUser.id},receiver_id.eq.${me.id})`)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'accepted') {
          const chat = await chatService.getOrCreateDirectChat(otherUser.id);
          router.push({ pathname: `/chat/${chat.id}`, params: { source: 'personal' } });
          return;
        }
        if (existing.status === 'pending') {
          Alert.alert('Request Pending', 'Your friend request is still pending.');
          return;
        }
        if (existing.status === 'declined') {
          const declinedAt = new Date(existing.updated_at);
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          if (declinedAt > monthAgo) {
            Alert.alert('Request Declined', 'You can resend a friend request after 30 days.');
            return;
          }
          // 30 days passed — delete old declined request and allow resend
          await supabase.from('friend_requests').delete().eq('id', existing.id);
        }
      }

      // 4. Send friend request
      Alert.alert(
        'Send Friend Request',
        `Send ${otherUser.username} a friend request to start chatting?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send Request',
            onPress: async () => {
              const { error } = await supabase.from('friend_requests').insert({
                sender_id: me.id,
                receiver_id: otherUser.id,
                status: 'pending',
              });
              if (error) {
                Alert.alert('Error', 'Failed to send friend request');
              } else {
                Alert.alert('Request Sent', `Friend request sent to ${otherUser.username}`);
                loadUsers();
              }
            },
          },
        ]
      );
    } catch (err) {
      console.error('Failed to start chat', err);
    }
  };

  const handleProfilePress = (user: any) => {
    setSelectedProfile(user);
    setProfileModalVisible(true);
  };

  const closeProfileModal = () => {
    setProfileModalVisible(false);
    setSelectedProfile(null);
  };

  const handleImageZoom = () => {
    if (selectedProfile?.avatar_url) {
      setImageZoomVisible(true);
    }
  };

  const closeImageZoom = () => {
    setImageZoomVisible(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends Messages</Text>
      </View>

      <View style={styles.searchBox}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search users"
          placeholderTextColor="#999"
          style={styles.searchInput}
        />
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.userRow}
            onPress={() => startChat(item)}
          >
            <TouchableOpacity 
              style={styles.avatarContainer}
              onPress={() => handleProfilePress(item)}
            >
              <Image
                source={{
                  uri:
                    item.avatar_url ||
                    'https://ui-avatars.com/api/?name=' +
                      encodeURIComponent(item.username),
                }}
                style={styles.avatar}
              />
              <View style={[styles.statusDot, { 
                backgroundColor: (item as any)?.is_online ? '#10b981' : '#6b7280' 
              }]} />
            </TouchableOpacity>

            <View style={styles.chatContent}>
              <View style={styles.topRow}>
                <Text style={styles.username} numberOfLines={1}>
                  {item.username}
                </Text>
                <View style={styles.rightSection}>
                  {unreadCounts[item.id] > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>
                        {unreadCounts[item.id] > 99 ? '99+' : unreadCounts[item.id]}
                      </Text>
                    </View>
                  )}
                  {item.last_message && (
                    <Text style={styles.timeText}>
                      {formatTime(item.last_message.created_at)}
                    </Text>
                  )}
                </View>
              </View>

              <Text style={styles.subtext} numberOfLines={1}>
                {(item as any)?.is_online 
                  ? 'Online' 
                  : item.last_seen 
                    ? `Last seen ${formatTime(item.last_seen)}` 
                    : item.last_message
                      ? item.last_message.content
                      : 'Tap to start chatting'
                }
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        }
      />

      {/* Profile Modal */}
      <Modal
        visible={profileModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeProfileModal}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={closeProfileModal}
        >
          <View style={styles.profileModal}>
            <TouchableOpacity style={styles.closeButton} onPress={closeProfileModal}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
            
            {selectedProfile && (
              <>
                <View style={styles.profileHeader}>
                  <TouchableOpacity 
                    style={styles.profileAvatarContainer}
                    onPress={handleImageZoom}
                    disabled={!selectedProfile.avatar_url}
                  >
                    <Image 
                      source={{
                        uri: selectedProfile.avatar_url ||
                          'https://ui-avatars.com/api/?name=' +
                            encodeURIComponent(selectedProfile.username),
                      }} 
                      style={styles.profileAvatar} 
                    />
                    <View style={[styles.profileStatusDot, { 
                      backgroundColor: (selectedProfile as any)?.is_online ? '#10b981' : '#6b7280' 
                    }]} />
                  </TouchableOpacity>
                  
                  <Text style={styles.profileUsername}>@{selectedProfile.username || 'Unknown User'}</Text>
                  <Text style={styles.profileStatus}>
                    {(selectedProfile as any)?.is_online ? 'Online' : 'Offline'}
                  </Text>
                </View>
                
                <View style={styles.profileDetails}>
                  {selectedProfile.full_name && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Full Name:</Text>
                      <Text style={styles.detailValue}>{selectedProfile.full_name}</Text>
                    </View>
                  )}
                  
                  {selectedProfile.bio && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Bio:</Text>
                      <Text style={styles.detailValue}>{selectedProfile.bio}</Text>
                    </View>
                  )}
                  
                  {selectedProfile.email && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Email:</Text>
                      <Text style={styles.detailValue}>{selectedProfile.email}</Text>
                    </View>
                  )}
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Member Since:</Text>
                    <Text style={styles.detailValue}>
                      {selectedProfile.created_at ? 
                        new Date(selectedProfile.created_at).toLocaleDateString() : 
                        'Unknown'
                      }
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Image Zoom Modal */}
      <Modal
        visible={imageZoomVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageZoom}
      >
        <TouchableOpacity 
          style={styles.zoomModalOverlay} 
          activeOpacity={1} 
          onPress={closeImageZoom}
        >
          <TouchableOpacity style={styles.zoomCloseButton} onPress={closeImageZoom}>
            <Text style={styles.zoomCloseButtonText}>×</Text>
          </TouchableOpacity>
          
          {selectedProfile?.avatar_url && (
            <Image 
              source={{ uri: selectedProfile.avatar_url }} 
              style={styles.zoomedImage}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  searchBox: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInput: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    fontSize: 14,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    width: '100%',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#eee',
  },
  statusDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  chatContent: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    marginRight: 8,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    fontSize: 11,
    color: '#000',
    flexShrink: 0,
    paddingRight: 2,
    minWidth: 130,
    textAlign: 'right', 
  },
  subtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginLeft: 78,
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
  // Profile Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '85%',
    maxWidth: 400,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 15,
    zIndex: 1,
  },
  closeButtonText: {
    fontSize: 30,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 10,
  },
  profileAvatarContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profileStatusDot: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileUsername: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 5,
  },
  profileStatus: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  profileDetails: {
    width: '100%',
  },
  detailRow: {
    marginBottom: 15,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#1f2937',
    lineHeight: 22,
  },
  // Image Zoom Modal Styles
  zoomModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomCloseButtonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  zoomedImage: {
    width: '90%',
    height: '70%',
    borderRadius: 10,
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});