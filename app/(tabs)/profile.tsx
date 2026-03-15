import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Modal,
  Pressable,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

interface UserProfile {
  id: string;
  email: string;
  username: string;
  avatar_url?: string;
}

export default function Profile() {
  const { setIsVerified } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ listings: 0, trades: 0, rating: 4.9 });
  const [refreshing, setRefreshing] = useState(false);
  const [isImageZoomed, setIsImageZoomed] = useState(false); // State for zooming

  async function loadProfile() {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        const { data } = await supabase
          .from("users")
          .select("*")
          .eq("id", authUser.id)
          .single();

        setUser(data);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (authUser) {
        // Count listings
        const { count: listingsCount } = await supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("user_id", authUser.id);

        // Count trades (chats as proxy for now)
        const { count: tradesCount } = await supabase
          .from("chats")
          .select("*", { count: "exact", head: true })
          .or(`buyer_id.eq.${authUser.id},seller_id.eq.${authUser.id}`);

        setStats((prev) => ({
          ...prev,
          listings: listingsCount || 0,
          trades: tradesCount || 0,
        }));
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  }

  async function handleLogout() {
    Alert.alert(
      "Logout",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              // 1. Lock the app UI
              setIsVerified(false);

              // 2. WE REMOVED supabase.auth.signOut() 
              // This keeps the session token in SecureStore so Biometrics can find it later.

              // 3. Redirect to login screen
              router.replace("/(auth)/login");
            } catch (error) {
              Alert.alert("Error", "Failed to log out properly.");
            }
          },
        },
      ],
    );
  }

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([loadProfile(), loadStats()]);
    setRefreshing(false);
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true); // Reset loading state to show spinner on focus
      loadProfile();
      loadStats();
    }, []),
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ZOOM MODAL */}
      <Modal
        visible={isImageZoomed}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsImageZoomed(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setIsImageZoomed(false)}
        >
          <View style={styles.modalContent}>
             {user?.avatar_url && (
                <Image 
                  source={{ uri: user.avatar_url }} 
                  style={styles.zoomedImage} 
                  resizeMode="contain" 
                />
             )}
          </View>
        </Pressable>
      </Modal>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366f1"
          />
        }
      >
        {/* Profile Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.avatarContainer}>
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => {
                if (user?.avatar_url) setIsImageZoomed(true);
              }}
              style={styles.avatar}
            >
              {user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {user?.username?.charAt(0).toUpperCase() || "U"}
                </Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.editAvatarBadge}
              onPress={() =>
                router.push("/edit-profile")
              }
            >
              <Ionicons name="camera" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Text wrapping added here */}
          <Text style={styles.username} numberOfLines={2}>
            {user?.username || "User"}
          </Text>
          <Text style={styles.email} numberOfLines={1} ellipsizeMode="middle">
            {user?.email}
          </Text>

          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={() => router.push("/edit-profile")}
          >
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.listings}</Text>
            <Text style={styles.statLabel}>Listings</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.trades}</Text>
            <Text style={styles.statLabel}>Trades</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.statNumber}>{stats.rating}</Text>
              <Ionicons
                name="star"
                size={14}
                color="#6366f1"
                style={{ marginLeft: 2 }}
              />
            </View>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        {/* Menu Section */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Account Settings</Text>

          <MenuLink
            icon="briefcase-outline"
            label="My Listings"
            onPress={() => router.push("/my-listings")}
          />
          <MenuLink
            icon="heart-outline"
            label="Favorites"
            onPress={() => router.push("/favorites")}
          />
          <MenuLink
            icon="settings-outline"
            label="Settings"
            onPress={() => router.push("/settings")}
          />
          <MenuLink
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() => {
              Alert.alert(
                "Support",
                "How would you like to contact us?",
                [
                  {
                    text: "Email Support",
                    onPress: () => Linking.openURL('mailto:ololadeazeez.m@gmail.com'),
                  },
                  {
                    text: "Call Us",
                    onPress: () => Linking.openURL('tel:08072178062'),
                  },
                  {
                    text: "WhatsApp",
                    onPress: () => Linking.openURL('https://wa.me/2348072178062'), 
                  },
                  {
                    text: "Cancel",
                    style: "cancel",
                  },
                ],
                { cancelable: true }
              );
            }}
          />
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#dc2626" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>TradeTalk Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuLink({
  icon,
  label,
  onPress,
}: {
  icon: any;
  label: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View style={styles.menuItemLeft}>
        <Ionicons name={icon} size={22} color="#4b5563" />
        <Text style={styles.menuText} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  headerCard: {
    alignItems: "center",
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingTop: Platform.OS === "android" ? 40 : 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 15,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden"
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    resizeMode: "cover",
  },
  avatarText: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "bold",
  },
  editAvatarBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    backgroundColor: "#1f2937",
    padding: 6,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: "#fff",
    zIndex: 10,
  },
  username: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  email: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
    textAlign: "center",
    width: "100%",
  },
  editProfileButton: {
    marginTop: 18,
    marginBottom:15,
    paddingHorizontal: 24,
    paddingVertical: 9,
    borderRadius: 15,
    backgroundColor: "#2255ee",
  },
  editProfileText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: -30,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    justifyContent: "space-around",
    alignItems: "center",
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
    width:50,
    textAlign:"center"
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#f3f4f6",
  },
  menuSection: {
    marginTop: 30,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 15,
    marginLeft: 5,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  menuText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#374151",
    marginLeft: 12,
    flexShrink: 1,
    minWidth:200
  },
  logoutButton: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
    padding: 16,
    backgroundColor:"#dc2626",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#fee2e2",
  },
  logoutText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  versionText: {
    textAlign: "center",
    fontSize: 11,
    marginBottom: 30,
    marginTop: 10,
  },
  // ZOOM STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  zoomedImage: {
    width: "90%",
    height: "70%",
  },
});