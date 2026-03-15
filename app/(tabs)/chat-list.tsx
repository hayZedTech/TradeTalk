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
  TextInput,
  Modal,
  Image,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { chatService } from '../../services/chatService';
import { Chat, Message } from '../../lib/supabase';
import { supabase } from '../../lib/supabase';

export default function ChatList() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [imageZoomVisible, setImageZoomVisible] = useState(false);

  // 🔥 Strictly Date-focused Helper
  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const now = new Date();
    const past = new Date(dateString);
    
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const pastDate = new Date(past.getFullYear(), past.getMonth(), past.getDate());

    if (pastDate.getTime() === today.getTime()) {
      return past.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    if (pastDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    }
    
    return past.toLocaleDateString();
  };

  async function loadChats() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      const data = await chatService.getUserChats();
      const productChats = data.filter(chat => chat.type === 'product' || chat.product_id !== null);
      
      setChats(productChats);
      applySearch(search, productChats);
    } catch (error) {
      console.error('Error loading chats:', error);
      if (loading) Alert.alert('Error', 'Failed to load chats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const applySearch = (query: string, allChats: Chat[]) => {
    if (!query.trim()) {
      setFilteredChats(allChats);
      return;
    }

    const q = query.toLowerCase();
    const filtered = allChats.filter(chat => {
      const productMatch = chat.product?.title?.toLowerCase().includes(q);
      const sellerMatch = chat.seller?.username?.toLowerCase().includes(q);
      const buyerMatch = chat.buyer?.username?.toLowerCase().includes(q);
      return productMatch || sellerMatch || buyerMatch;
    });
    setFilteredChats(filtered);
  };

  useEffect(() => {
    applySearch(search, chats);
  }, [search, chats]);

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
        pathname: '/chat/[id]', // Use the template name here
        params: { 
          id: chat.id,        // The actual ID goes here
          source: 'trading'    // Your back-button logic
        },
      });
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

  const renderChat = ({ item }: { item: Chat }) => {
    const productTitle = item.product?.title || 'Unknown Item';
    const lastMsg: Message | null = item.last_message || null;
    const otherUser = item.buyer_id === currentUserId ? item.seller : item.buyer;
    const displayName = otherUser?.username || 'User';

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => handleChatPress(item)}
      >
        <TouchableOpacity 
          style={styles.avatarContainer}
          onPress={() => handleProfilePress(otherUser)}
        >
          <View style={styles.avatar}>
            {otherUser?.avatar_url ? (
              <Image source={{ uri: otherUser.avatar_url }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={[styles.statusDot, { 
            backgroundColor: (otherUser as any)?.is_online ? '#10b981' : '#6b7280' 
          }]} />
        </TouchableOpacity>

        <View style={styles.chatInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.chatTitle} numberOfLines={1}>
              {productTitle} • @{displayName}
            </Text>
          </View>
          
          <View style={styles.messageRow}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {lastMsg ? lastMsg.content : 'No messages yet'}
            </Text>
            {lastMsg && (
              <View style={styles.timeBadge}>
                <Text style={styles.timeText}>
                  {formatTime(lastMsg.created_at)}
                </Text>
              </View>
            )}
          </View>
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
      <Text style={styles.headerTitle}>Trade Messages</Text>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by product or username..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#9ca3af"
        />
      </View>

      {filteredChats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {search ? 'No matches found' : 'No product inquiries yet'}
          </Text>
          <Text style={styles.emptySubtext}>
            {search ? 'Try a different search term' : 'Items you are buying or selling will appear here.'}
          </Text>
          {!search && (
            <TouchableOpacity onPress={onRefresh} style={{marginTop: 20}}>
               <Text style={{color: '#6366f1', fontWeight: 'bold'}}>Tap to Refresh</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredChats}
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
                    {selectedProfile.avatar_url ? (
                      <Image source={{ uri: selectedProfile.avatar_url }} style={styles.profileAvatar} />
                    ) : (
                      <View style={styles.profileAvatarPlaceholder}>
                        <Text style={styles.profileAvatarText}>
                          {selectedProfile.username?.charAt(0).toUpperCase() || 'U'}
                        </Text>
                      </View>
                    )}
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
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', padding: 16, color: '#1f2937' },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#2255ee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 12,
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
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
  chatInfo: { flex: 1, marginLeft: 12 },
  titleRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'flex-start',
    marginBottom: 4 
  },
  chatTitle: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#1f2937', 
    flex: 1
  },
  userBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
    flexShrink: 1
  },
  sellerName: { 
    fontSize: 12, 
    color: '#475569', 
    fontWeight: '600' 
  },
  messageRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  lastMessage: { 
    fontSize: 14, 
    color: '#6b7280',
    width: '100%',
  },
  timeBadge: {
    paddingHorizontal: 4,
    borderRadius: 4,
    alignSelf: 'flex-end',
    marginTop: 2,
    width: '100%',
  },
  timeText: { 
    fontSize: 11, 
    color: '#000',
    textAlign: 'right',
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
  profileAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2255ee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
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
});