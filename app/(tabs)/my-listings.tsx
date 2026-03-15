import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Product, supabase } from "../../lib/supabase";
import { productService } from "../../services/productService";

export default function MyListings() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Instant refresh when returning to this screen
  useFocusEffect(
    useCallback(() => {
      loadMyListings();
    }, [])
  );

  async function loadMyListings() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fix: Removed the join "owner:users(username)" which was causing the relationship error
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error loading listings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    Alert.alert(
      "Delete Listing",
      "Are you sure you want to remove this item? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("products")
                .delete()
                .eq("id", id);
              if (error) throw error;
              setProducts((prev) => prev.filter((p) => p.id !== id));
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          },
        },
      ],
    );
  }

  const renderItem = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/product/${item.id}`)}
      activeOpacity={0.9}
    >
      <Image
        source={{ uri: productService.getImageUrl(item.image_url) }}
        style={styles.image}
      />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <TouchableOpacity
            onPress={() => handleDelete(item.id)}
            style={styles.deleteBtn}
          >
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
        <Text style={styles.price}>₦{item.price}</Text>
        <View style={styles.footer}>
          <Text style={styles.date}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>Active</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{ title: "My Listings", headerBackTitle: "Profile" }}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2255ee" />
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="basket-outline" size={64} color="#e5e7eb" />
              <Text style={styles.emptyText}>No listings yet.</Text>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => router.push("/product/add-product")}
              >
                <Text style={styles.addBtnText}>Create Listing</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16 },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  content: { flex: 1, marginLeft: 12, justifyContent: "space-between" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    flex: 1,
    marginRight: 8,
  },
  deleteBtn: { padding: 4 },
  price: { fontSize: 14, color: "#2255ee", fontWeight: "700" },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  date: { fontSize: 12, color: "#9ca3af" },
  statusBadge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: { fontSize: 10, color: "#166534", fontWeight: "700" },
  empty: { alignItems: "center", marginTop: 100 },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 24,
    width: 150, 
    textAlign: "center"
  },
  addBtn: {
    backgroundColor: "#2255ee",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  addBtnText: {
    color: "#fff",
    fontWeight: "600",
  },
});