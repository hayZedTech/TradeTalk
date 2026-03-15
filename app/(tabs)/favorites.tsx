import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect } from "expo-router";
import { useEffect, useState, useCallback } from "react";
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
  RefreshControl,
} from "react-native";
import { Product, supabase } from "../../lib/supabase";
import { productService } from "../../services/productService";

export default function Favorites() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Re-fetch favorites every time the user navigates to this tab/screen
  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [])
  );

  async function loadFavorites() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Join favorites with products
      const { data, error } = await supabase
        .from("favorites")
        .select("product:products(*, owner:users(username))")
        .eq("user_id", user.id);

      if (error) throw error;

      // Flatten the structure
      const favs = data?.map((f: any) => f.product).filter(Boolean) || [];
      setProducts(favs);
    } catch (error) {
      console.error("Error loading favorites:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFavorites();
  }, []);

  async function handleRemoveFavorite(productId: string) {
    Alert.alert("Remove", "Remove from favorites?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) return;

          const { error } = await supabase
            .from("favorites")
            .delete()
            .eq("user_id", user.id)
            .eq("product_id", productId);

          if (!error) {
            setProducts((prev) => prev.filter((p) => p.id !== productId));
          }
        },
      },
    ]);
  }

  const renderItem = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/product/${item.id}`)}
      activeOpacity={0.9}
    >
      <View style={styles.imageWrapper}>
        <Image
          source={{ uri: productService.getImageUrl(item.image_url) }}
          style={styles.image}
        />
        <View style={styles.priceBadge}>
          <Text style={styles.priceText}>₦{item.price}</Text>
        </View>
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.category}>{item.category}</Text>
        <View style={styles.footer}>
          <View style={styles.owner}>
            <Ionicons name="person-circle-outline" size={16} color="#6b7280" />
            <Text style={styles.ownerText} numberOfLines={1}>
              {item.owner?.username || "User"}
            </Text>
          </View>
          <TouchableOpacity onPress={() => handleRemoveFavorite(item.id)} style={[
                styles.heartBtn,{ backgroundColor: "#2255ee" }]}>
            <Ionicons name="heart" size={15} color="#000" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: "Favorites",
          headerBackTitle: "Profile",
          headerRight: () => (
            <TouchableOpacity onPress={onRefresh} style={{ marginRight: 8 }}>
              <Ionicons name="refresh" size={22} color="#2255ee" />
            </TouchableOpacity>
          ),
        }}
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
          numColumns={2}
          columnWrapperStyle={styles.row}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#2255ee"
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="heart-dislike-outline"
                size={64}
                color="#e5e7eb"
              />
              <Text style={styles.emptyText}>No favorites yet.</Text>
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
  row: { justifyContent: "space-between" },
  card: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  imageWrapper: { position: "relative" },
  image: { width: "100%", height: 140, backgroundColor: "#f3f4f6" },
  priceBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "#2255ee",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priceText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  content: { padding: 10 },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
    height: 36,
  },
  category: {
    fontSize: 11,
    color: "#2255ee",
    marginBottom: 8,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  owner: { flexDirection: "row", alignItems: "center", flex: 1 },
  ownerText: { fontSize: 12, color: "#6b7280", marginLeft: 4, flex: 1 },
  empty: { alignItems: "center", marginTop: 100 },
  emptyText: { marginTop: 16, fontSize: 16, color: "#6b7280" },
  heartBtn: {
    width: 20,
    height: 20,
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
  },
});