import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from '@react-navigation/native';
import {
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

interface BlockedUser {
  id: string;
  username: string;
  avatar_url?: string;
}

export default function Settings() {
  const [notifications, setNotifications] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(true);
  const [unblockingUsers, setUnblockingUsers] = useState<Set<string>>(new Set());
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  
  const { theme, toggleTheme } = useTheme();
  const { setIsVerified } = useAuth();
  const isDark = theme === 'dark';

  const toggleNotifications = () =>
    setNotifications((previousState) => !previousState);

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  // Refresh blocked users when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchBlockedUsers();
    }, [])
  );

  async function fetchBlockedUsers() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get blocked user IDs using the correct column name: blocked_id
      const { data: blockedData, error: blockedError } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', user.id);

      if (blockedError) {
        console.error('Blocked users query error:', blockedError);
        throw blockedError;
      }

      if (!blockedData || blockedData.length === 0) {
        setBlockedUsers([]);
        return;
      }

      // Then get user details for each blocked user
      const blockedUserIds = blockedData.map(item => item.blocked_id);
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, username, avatar_url')
        .in('id', blockedUserIds);

      if (usersError) throw usersError;

      setBlockedUsers(usersData || []);
    } catch (error) {
      console.error('Error fetching blocked users:', error);
    } finally {
      setLoadingBlocked(false);
    }
  }

  async function handleUnblockUser(userId: string, username: string) {
    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock @${username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setUnblockingUsers(prev => new Set(prev).add(userId));
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('Not authenticated');

              const { error } = await supabase
                .from('blocked_users')
                .delete()
                .eq('blocker_id', user.id)
                .eq('blocked_id', userId);

              if (error) throw error;

              setBlockedUsers(prev => prev.filter(u => u.id !== userId));
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to unblock user');
            } finally {
              setUnblockingUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(userId);
                return newSet;
              });
            }
          }
        }
      ]
    );
  }

  async function handleDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "This will permanently delete all your data including listings, chats, and favorites. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            Alert.alert(
              "Are you absolutely sure?",
              "Type confirm to proceed — your account will be gone forever.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, Delete",
                  style: "destructive",
                  onPress: async () => {
                    setDeleting(true);
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) throw new Error("Not authenticated");

                      const uid = user.id;
                      // Delete user data in order (messages → chats → products → favorites → profile)
                      await supabase.from("messages").delete().eq("sender_id", uid);
                      await supabase.from("chats").delete().or(`buyer_id.eq.${uid},seller_id.eq.${uid}`);
                      await supabase.from("products").delete().eq("user_id", uid);
                      await supabase.from("favorites").delete().eq("user_id", uid);
                      await supabase.from("users").delete().eq("id", uid);
                      // Note: deleting the auth user itself requires a Supabase Edge Function with service role key
                      await supabase.auth.signOut();
                      setIsVerified(false);
                      router.replace("/(auth)/login");
                    } catch (e: any) {
                      Alert.alert("Error", e.message || "Failed to delete account.");
                    } finally {
                      setDeleting(false);
                    }
                  },
                },
              ]
            ),
        },
      ]
    );
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text
            style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}
          >
            Privacy
          </Text>
          <TouchableOpacity 
            style={styles.row}
            onPress={() => blockedUsers.length > 0 && setShowBlockedUsers(!showBlockedUsers)}
            disabled={blockedUsers.length === 0}
          >
            <View style={styles.rowLeft}>
              <View
                style={[styles.iconContainer, { backgroundColor: "#fef3c7" }]}
              >
                <Ionicons
                  name="person-remove-outline"
                  size={20}
                  color="#f59e0b"
                />
              </View>
              <Text style={[styles.rowLabel, isDark && styles.textDark]}>
                Blocked Users
              </Text>
            </View>
            <View style={styles.rowRight}>
              {loadingBlocked ? (
                <ActivityIndicator size={16} color="#9ca3af" style={{ marginRight: 8 }} />
              ) : (
                <>
                  <Text style={styles.rowValue}>{blockedUsers.length}</Text>
                  {blockedUsers.length > 0 && (
                    <Ionicons 
                      name={showBlockedUsers ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color="#9ca3af" 
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </>
              )}
            </View>
          </TouchableOpacity>

          {blockedUsers.length > 0 && showBlockedUsers && (
            <>
              <View style={[styles.divider, isDark && styles.dividerDark]} />
              <View style={styles.blockedUsersContainer}>
                {blockedUsers.map((user, index) => (
                  <View key={user.id} style={styles.blockedUserItem}>
                    <View style={styles.row}>
                      <View style={styles.rowLeft}>
                        <View
                          style={[styles.iconContainer, { backgroundColor: "#fee2e2" }]}
                        >
                          <Ionicons
                            name="person-outline"
                            size={20}
                            color="#ef4444"
                          />
                        </View>
                        <Text style={[styles.rowLabel, isDark && styles.textDark]}>
                          @{user.username}
                        </Text>
                      </View>
                      <View style={styles.rowRight}>
                        <TouchableOpacity
                          onPress={() => handleUnblockUser(user.id, user.username)}
                          disabled={unblockingUsers.has(user.id)}
                          style={styles.unblockButton}
                        >
                          {unblockingUsers.has(user.id) ? (
                            <ActivityIndicator size={16} color="#2563eb" />
                          ) : (
                            <Text style={styles.unblockText}>Unblock</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                    {index < blockedUsers.length - 1 && (
                      <View style={[styles.subDivider, isDark && styles.dividerDark]} />
                    )}
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text
            style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}
          >
            Account
          </Text>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push("/change-password")}
          >
            <View style={styles.rowLeft}>
              <View
                style={[styles.iconContainer, { backgroundColor: "#fee2e2" }]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#ef4444"
                />
              </View>
              <Text style={[styles.rowLabel, isDark && styles.textDark]}>
                Change Password
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <View style={[styles.divider, isDark && styles.dividerDark]} />

          <TouchableOpacity
            style={styles.row}
            onPress={handleDeleteAccount}
            disabled={deleting}
          >
            <View style={styles.rowLeft}>
              <View
                style={[styles.iconContainer, { backgroundColor: "#fee2e2" }]}
              >
                {deleting ? (
                  <ActivityIndicator size={16} color="#ef4444" />
                ) : (
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                )}
              </View>
              <Text style={[styles.rowLabel, { color: "#ef4444" }]}>
                Delete Account
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text
            style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}
          >
            About
          </Text>
          <TouchableOpacity
            style={styles.row}
            onPress={() => Alert.alert("About", "TradeTalk v1.0.0")}
          >
            <View style={styles.rowLeft}>
              <View
                style={[styles.iconContainer, { backgroundColor: "#ecfdf5" }]}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color="#10b981"
                />
              </View>
              <Text style={[styles.rowLabel, isDark && styles.textDark]}>
                Version
              </Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>1.0.0</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  containerDark: { backgroundColor: "#111827" },
  scrollContent: { padding: 20 },
  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionDark: {
    backgroundColor: "#1f2937",
    shadowColor: "#000",
    shadowOpacity: 0.2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 8,
    marginTop: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionTitleDark: { color: "#9ca3af" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    minHeight: 48,
  },
  rowLeft: { 
    flexDirection: "row", 
    alignItems: "center", 
    flex: 1,
    marginRight: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  rowLabel: { 
    fontSize: 16, 
    color: "#1f2937", 
    fontWeight: "500", 
    flex: 1,
    marginRight: 8,
  },
  textDark: { color: "#f9fafb" },
  rowRight: { 
    flexDirection: "row", 
    alignItems: "center",
    flexShrink: 0,
  },
  rowValue: { 
    fontSize: 14, 
    color: "#6b7280", 
    marginRight: 8,
    minWidth: 24,
    textAlign: "right",
  },
  divider: { height: 1, backgroundColor: "#f3f4f6", marginLeft: 44 },
  dividerDark: { backgroundColor: "#374151" },
  subDivider: { height: 1, backgroundColor: "#f3f4f6", marginLeft: 44, marginTop: 8 },
  blockedUsersContainer: {
    paddingTop: 8,
  },
  blockedUserItem: {
    marginBottom: 4,
  },
  unblockButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#2563eb",
    minWidth: 70,
    alignItems: "center",
  },
  unblockText: {
    fontSize: 14,
    color: "#2563eb",
    fontWeight: "600",
  },
});