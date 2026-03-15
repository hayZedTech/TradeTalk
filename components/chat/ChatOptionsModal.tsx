import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Alert,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';

interface ChatOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  chatId: string;
  otherUserId: string | null;
  otherUserName: string;
  currentUserId: string | null;
  onSearchMessages: (query: string) => Promise<void>;
  onBlockUser: () => Promise<void>;
  onUnblockUser: () => Promise<void>;
  onSelectMessages: () => Promise<void>;
  isUserBlocked: boolean;
  onChatDeleted?: () => void;
}

const ChatOptionsModal: React.FC<ChatOptionsModalProps> = ({
  visible,
  onClose,
  chatId,
  otherUserId,
  otherUserName,
  currentUserId,
  onSearchMessages,
  onBlockUser,
  onUnblockUser,
  onSelectMessages,
  isUserBlocked,
  onChatDeleted,
}) => {
  const { theme, toggleTheme, colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isBlockLoading, setIsBlockLoading] = useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [isThemeLoading, setIsThemeLoading] = useState(false);
  const [isSelectLoading, setIsSelectLoading] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  const reportReasons = [
    'Spam',
    'Harassment',
    'Inappropriate Content',
    'Scam/Fraud',
    'Fake Profile',
    'Other',
  ];

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setIsSearchLoading(true);
      // Don't dismiss keyboard, just blur the input temporarily
      onSearchMessages(searchQuery.trim())
        .then(() => {
          onClose();
        })
        .finally(() => {
          setIsSearchLoading(false);
        });
    }
  };

  const handleDeleteChat = () => {
    setDeleteConfirmVisible(true);
  };

  const confirmDeleteChat = async () => {
    setIsDeleteLoading(true);
    try {
      await supabase
        .from('messages')
        .delete()
        .eq('chat_id', chatId);
      
      await supabase
        .from('chats')
        .delete()
        .eq('id', chatId);
      
      setDeleteConfirmVisible(false);
      onClose();
      
      // Navigate away and refresh chat list
      if (onChatDeleted) {
        onChatDeleted();
      }
      
      Alert.alert('Success', 'Chat deleted successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to delete chat');
    } finally {
      setIsDeleteLoading(false);
    }
  };

  const handleBlockUser = () => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block @${otherUserName}? You won't receive messages from them.`,
      [
        { 
          text: 'Cancel', 
          style: 'cancel'
        },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setIsBlockLoading(true);
            try {
              await onBlockUser();
              onClose();
            } catch (error) {
              console.error('Block user error:', error);
            } finally {
              setIsBlockLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleUnblockUser = () => {
    Alert.alert(
      'Unblock User',
      `Unblock @${otherUserName}? You'll be able to receive messages from them again.`,
      [
        { 
          text: 'Cancel', 
          style: 'cancel'
        },
        {
          text: 'Unblock',
          onPress: async () => {
            setIsBlockLoading(true);
            try {
              await onUnblockUser();
              onClose();
            } catch (error) {
              console.error('Unblock user error:', error);
            } finally {
              setIsBlockLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleReportUser = async () => {
    if (!reportReason) {
      Alert.alert('Error', 'Please select a reason for reporting');
      return;
    }

    if (!currentUserId || !otherUserId) {
      Alert.alert('Error', 'Unable to report user at this time');
      return;
    }

    setIsReportLoading(true);
    try {
      await supabase
        .from('user_reports')
        .insert({
          reporter_id: currentUserId,
          reported_id: otherUserId,
          chat_id: chatId,
          reason: reportReason,
          description: reportDescription,
        });

      Alert.alert('Success', 'User reported successfully. We will review this report.');
      setReportModalVisible(false);
      setReportReason('');
      setReportDescription('');
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to report user');
    } finally {
      setIsReportLoading(false);
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>Chat Options</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.optionsList} keyboardShouldPersistTaps="handled">
              {/* Search Messages */}
              <View style={styles.searchSection}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Search Messages</Text>
                <View style={[styles.searchContainer, { borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search in this chat..."
                    placeholderTextColor={colors.textSecondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                    blurOnSubmit={false}
                  />
                  <Pressable 
                    onPress={handleSearch} 
                    style={({ pressed }) => [
                      styles.searchButton, 
                      { 
                        minHeight: 44, 
                        minWidth: 44,
                        opacity: pressed ? 0.7 : 1
                      }
                    ]} 
                    disabled={isSearchLoading}
                  >
                    {isSearchLoading ? (
                      <ActivityIndicator size={16} color={colors.primary} />
                    ) : (
                      <Ionicons name="search" size={20} color={colors.primary} />
                    )}
                  </Pressable>
                </View>
              </View>

              {/* Select Messages */}
              <TouchableOpacity
                style={[styles.option, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setIsSelectLoading(true);
                  requestAnimationFrame(() => {
                    onSelectMessages()
                      .then(() => {
                        onClose();
                      })
                      .catch((error) => {
                        console.error('Select messages error:', error);
                      })
                      .finally(() => {
                        setIsSelectLoading(false);
                      });
                  });
                }}
                disabled={isSelectLoading}
              >
                {isSelectLoading ? (
                  <ActivityIndicator size={20} color={colors.primary} />
                ) : (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                )}
                <Text style={[styles.optionText, { color: colors.primary }]}>
                  {isSelectLoading ? 'Activating Selection...' : 'Select Messages'}
                </Text>
              </TouchableOpacity>

              {/* Theme Toggle */}
              <TouchableOpacity
                style={[styles.option, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setIsThemeLoading(true);
                  requestAnimationFrame(() => {
                    toggleTheme()
                      .then(() => {
                        onClose();
                      })
                      .catch((error) => {
                        console.error('Theme toggle error:', error);
                      })
                      .finally(() => {
                        setIsThemeLoading(false);
                      });
                  });
                }}
                disabled={isThemeLoading}
              >
                {isThemeLoading ? (
                  <ActivityIndicator size={20} color={colors.text} />
                ) : (
                  <Ionicons 
                    name={theme === 'light' ? 'moon' : 'sunny'} 
                    size={20} 
                    color={colors.text} 
                  />
                )}
                <Text style={[styles.optionText, { color: colors.text }]}>
                  {isThemeLoading ? 'Switching Theme...' : `Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
                </Text>
              </TouchableOpacity>

              {/* Block/Unblock User */}
              <TouchableOpacity
                style={[styles.option, { borderBottomColor: colors.border }]}
                onPress={isUserBlocked ? handleUnblockUser : handleBlockUser}
                disabled={isBlockLoading}
              >
                {isBlockLoading ? (
                  <ActivityIndicator size={20} color={isUserBlocked ? colors.primary : '#ef4444'} />
                ) : (
                  <Ionicons 
                    name={isUserBlocked ? 'person-add' : 'person-remove'} 
                    size={20} 
                    color={isUserBlocked ? colors.primary : '#ef4444'} 
                  />
                )}
                <Text style={[
                  styles.optionText, 
                  { color: isUserBlocked ? colors.primary : '#ef4444' }
                ]}>
                  {isUserBlocked ? 'Unblock' : 'Block'} @{otherUserName}
                </Text>
              </TouchableOpacity>

              {/* Report User */}
              <TouchableOpacity
                style={[styles.option, { borderBottomColor: colors.border }]}
                onPress={() => setReportModalVisible(true)}
              >
                <Ionicons name="flag" size={20} color="#f59e0b" />
                <Text style={[styles.optionText, { color: '#f59e0b' }]}>
                  Report @{otherUserName}
                </Text>
              </TouchableOpacity>

              {/* Delete Chat */}
              <TouchableOpacity
                style={[
                  styles.option, 
                  { 
                    borderBottomColor: 'transparent', 
                    backgroundColor: '#ef4444',
                    borderRadius: 12,
                    marginTop: 8,
                    shadowColor: '#ef4444',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 4,
                    elevation: 4,
                    paddingLeft:10
                  }
                ]}
                onPress={handleDeleteChat}
                disabled={isDeleteLoading}
              >
                {isDeleteLoading ? (
                  <ActivityIndicator size={20} color="#ffffff" />
                ) : (
                  <Ionicons name="trash" size={20} color="#ffffff" />
                )}
                <Text style={[
                  styles.optionText, 
                  { 
                    color: '#ffffff',
                    fontWeight: '700',
                    fontSize: 17,
                    textShadowColor: 'rgba(0,0,0,0.5)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 3,
                  }
                ]}>
                  Delete Chat
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Report Modal */}
      <Modal
        visible={reportModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.reportModal, { backgroundColor: colors.background }]}>
            <Text style={[styles.reportTitle, { color: colors.text }]}>
              Report @{otherUserName}
            </Text>
            
            <Text style={[styles.reportSubtitle, { color: colors.textSecondary }]}>
              Why are you reporting this user?
            </Text>

            <ScrollView style={styles.reasonsList}>
              {reportReasons.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.reasonOption,
                    { borderColor: colors.border },
                    reportReason === reason && { 
                      backgroundColor: colors.primary + '20',
                      borderColor: colors.primary 
                    }
                  ]}
                  onPress={() => setReportReason(reason)}
                >
                  <Text style={[
                    styles.reasonText,
                    { color: colors.text },
                    reportReason === reason && { color: colors.primary }
                  ]}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={[
                styles.descriptionInput,
                { 
                  borderColor: colors.border,
                  color: colors.text,
                  backgroundColor: colors.surface
                }
              ]}
              placeholder="Additional details (optional)"
              placeholderTextColor={colors.textSecondary}
              value={reportDescription}
              onChangeText={setReportDescription}
              multiline
              numberOfLines={3}
            />

            <View style={styles.reportButtons}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => {
                  setReportModalVisible(false);
                  setReportReason('');
                  setReportDescription('');
                }}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.reportButton, { backgroundColor: '#ef4444' }]}
                onPress={handleReportUser}
                disabled={isReportLoading}
              >
                {isReportLoading ? (
                  <ActivityIndicator size={16} color="#fff" />
                ) : (
                  <Text style={styles.reportButtonText}>Report</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteConfirmVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteConfirmVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
          <View style={[styles.deleteModal, { backgroundColor: colors.background }]}>
            <Text style={[styles.deleteTitle, { color: colors.text }]}>
              Delete Chat
            </Text>
            
            <Text style={[styles.deleteMessage, { color: colors.textSecondary }]}>
              Are you sure you want to delete this entire conversation with @{otherUserName}?
              {"\n\n"}This action cannot be undone and all messages will be permanently removed.
            </Text>

            <View style={styles.deleteButtons}>
              <TouchableOpacity
                style={[styles.deleteCancelButton, { borderColor: colors.border }]}
                onPress={() => setDeleteConfirmVisible(false)}
              >
                <Text style={[styles.deleteCancelText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.deleteConfirmButton}
                onPress={confirmDeleteChat}
                disabled={isDeleteLoading}
              >
                {isDeleteLoading ? (
                  <ActivityIndicator size={16} color="#ffffff" />
                ) : (
                  <Text style={styles.deleteConfirmText}>Delete Forever</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 60,
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingTop: 20,
    maxHeight: '75%',
    marginHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  optionsList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  searchSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  searchButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  reportModal: {
    margin: 20,
    borderRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  reportTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  reportSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  reasonsList: {
    maxHeight: 200,
    marginBottom: 20,
  },
  reasonOption: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  reasonText: {
    fontSize: 16,
  },
  descriptionInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    textAlignVertical: 'top',
  },
  reportButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  reportButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    marginLeft: 10,
    alignItems: 'center',
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  reportButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  deleteModal: {
    margin: 20,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  deleteTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  deleteMessage: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  deleteButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  deleteCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteConfirmButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  deleteConfirmText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

export default ChatOptionsModal;