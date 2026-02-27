import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Product, supabase } from "../../../lib/supabase";
import { chatService } from "../../../services/chatService";
import { productService } from "../../../services/productService";

export default function ProductDetails() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const loadInitialData = useCallback(async () => {
    // Reset state immediately to prevent "flashing" old data
    setLoading(true);
    setProduct(null); 

    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);

      if (id) {
        const data = await productService.getProductById(id);
        setProduct(data);
      }
    } catch (error) {
      console.error("Error loading product:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // UseFocusEffect handles the re-fetch when coming back to the screen
  useFocusEffect(
    useCallback(() => {
      loadInitialData();
    }, [loadInitialData])
  );

  const isOwner = product?.user_id === userId;

  async function handleAction() {
    if (!product) return;

    if (isOwner) {
      router.push(`/product/edit/${product.id}`);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "Please login first");
        router.push("/(auth)/login");
        return;
      }

      const chat = await chatService.startChat(product.id, product.user_id);
      router.push(`/chat/${chat.id}`);
    } catch (error) {
      console.error("Error starting chat:", error);
      Alert.alert("Error", "Failed to start chat");
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2255ee" />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Product not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Image
          source={{ uri: productService.getImageUrl(product.image_url) }}
          style={styles.productImage}
          resizeMode="cover"
        />

        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{product.title}</Text>
              <Text style={styles.priceText}>₦{product.price}</Text>
            </View>
            <View style={styles.conditionBadge}>
              <Text style={styles.conditionText}>{product.condition}</Text>
            </View>
          </View>

          <Text style={styles.category}>{product.category}</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{product.description}</Text>

          <View style={styles.divider} />

          <View style={styles.sellerInfo}>
            <Text style={styles.sectionTitle}>Seller</Text>
            <View style={styles.sellerRow}>
              <View style={styles.sellerAvatar}>
                <Text style={styles.sellerAvatarText}>
                  {product.owner?.username?.charAt(0).toUpperCase() || "U"}
                </Text>
              </View>
              <View style={styles.sellerDetails}>
                <Text style={styles.sellerName}>
                  {product.owner?.username || "Unknown User"}
                </Text>
                <Text style={styles.sellerDate}>
                  Listed {new Date(product.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.messageButton}
          onPress={handleAction}
        >
          <Text style={styles.messageButtonText}>
            {isOwner ? "Edit Product" : "Message Seller"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 18,
    color: "#6b7280",
  },
  productImage: {
    width: "100%",
    height: 350,
    backgroundColor: "#f3f4f6",
  },
  content: {
    padding: 24,
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -30,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1f2937",
  },
  priceText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#2255ee",
    marginTop: 6,
  },
  conditionBadge: {
    backgroundColor: "#eef2ff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2255ee20",
  },
  conditionText: {
    color: "#2255ee",
    fontWeight: "700",
    fontSize: 13,
    textTransform: "uppercase",
  },
  category: {
    fontSize: 15,
    fontWeight: "600",
    color: "#9ca3af",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginVertical: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: "#4b5563",
    lineHeight: 26,
  },
  sellerInfo: {
    marginTop: 4,
  },
  sellerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 20,
  },
  sellerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#2255ee",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2255ee",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  sellerAvatarText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
  },
  sellerDetails: {
    marginLeft: 16,
  },
  sellerName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1f2937",
  },
  sellerDate: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 2,
  },
  bottomBar: {
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    backgroundColor: "#fff",
  },
  messageButton: {
    backgroundColor: "#2255ee",
    padding: 18,
    borderRadius: 20,
    alignItems: "center",
    shadowColor: "#2255ee",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
  },
  messageButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
});