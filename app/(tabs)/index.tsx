import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import { Product, supabase } from "../../lib/supabase";
import { productService } from "../../services/productService";

const CATEGORIES = ["All", "Electronics", "Fashion", "Home", "Sports", "Books", "Other"];

export default function Feed() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [likedProducts, setLikedProducts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filter & Sort States
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "priceLow">("newest");
  const [selectedCategory, setSelectedCategory] = useState("All");

  useFocusEffect(
    useCallback(() => {
      loadProducts();
      loadLikes();
    }, []),
  );

  async function loadProducts() {
    try {
      const data = await productService.getProducts();
      setProducts(data);
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadLikes() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("favorites")
      .select("product_id")
      .eq("user_id", user.id);

    if (data) {
      setLikedProducts(data.map((item) => item.product_id));
    }
  }

  const toggleLike = async (productId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert("Sign in required", "Please sign in to save favorites.");
      return;
    }

    if (likedProducts.includes(productId)) {
      setLikedProducts((prev) => prev.filter((id) => id !== productId));
      await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", productId);
    } else {
      setLikedProducts((prev) => [...prev, productId]);
      await supabase
        .from("favorites")
        .insert({ user_id: user.id, product_id: productId });
    }
  };

  async function onRefresh() {
    setRefreshing(true);
    await loadProducts();
    await loadLikes();
    setRefreshing(false);
  }

  useEffect(() => {
    loadProducts();
    loadLikes();
  }, []);

  const processedProducts = products
    .filter((p) => {
      const matchesSearch = 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = 
        selectedCategory === "All" || 
        p.category.toLowerCase() === selectedCategory.toLowerCase();

      const price = p.price || 0; 
      const matchesMinPrice = minPrice === "" || price >= parseFloat(minPrice);
      const matchesMaxPrice = maxPrice === "" || price <= parseFloat(maxPrice);

      return matchesSearch && matchesCategory && matchesMinPrice && matchesMaxPrice;
    })
    .sort((a, b) => {
      if (sortBy === "priceLow") {
        return (a.price || 0) - (b.price || 0);
      }
      // If "newest", we rely on the default order (usually ID or created_at from service)
      return 0; 
    });

  const renderProduct = ({ item }: { item: Product }) => {
    const isLiked = likedProducts.includes(item.id);

    return (
      <TouchableOpacity
        style={styles.productCard}
        activeOpacity={0.9}
        onPress={() => router.push(`/product/${item.id}`)}
      >
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: productService.getImageUrl(item.image_url) }}
            style={styles.productImage}
            resizeMode="cover"
          />
          <View style={styles.conditionBadge}>
            <Text style={styles.conditionText}>{item.condition}</Text>
          </View>
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>₦{item.price}</Text>
          </View>
        </View>

        <View style={styles.productInfo}>
          <Text style={styles.productCategory}>{item.category}</Text>
          <Text style={styles.productTitle} numberOfLines={1}>
            {item.title}
          </Text>

          <View style={styles.cardFooter}>
            <View style={styles.ownerInfo}>
              <Ionicons
                name="person-circle-outline"
                size={16}
                color="#2255ee"
              />
              <Text style={styles.ownerText} numberOfLines={1}>
                {item.owner?.username || "Trader"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => toggleLike(item.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={isLiked ? "heart" : "heart-outline"}
                size={20}
                color={isLiked ? "#ef4444" : "#6b7280"}
              />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>Discover</Text>
            <Text style={styles.headerTitle}>Local Trades</Text>
          </View>
          <View style={styles.headerActions}>
             <TouchableOpacity
              style={[styles.filterButton, showFilters && styles.activeFilterButton]}
              onPress={() => setShowFilters(!showFilters)}
            >
              <Ionicons name="options-outline" size={22} color={showFilters ? "#fff" : "#2255ee"} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push("/product/add-product")}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={20} color="#9ca3af" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by title..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9ca3af"
            />
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.categoryList}
          >
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryTab, selectedCategory === cat && styles.activeCategoryTab]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.categoryTabText, selectedCategory === cat && styles.activeCategoryTabText]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {showFilters && (
            <View style={styles.filterBar}>
              <View style={styles.priceInputsRow}>
                <View style={styles.priceInputWrap}>
                  <Text style={styles.filterLabel}>Min ₦</Text>
                  <TextInput
                    style={styles.filterInput}
                    placeholder="0"
                    keyboardType="numeric"
                    value={minPrice}
                    onChangeText={setMinPrice}
                  />
                </View>
                <View style={styles.priceInputWrap}>
                  <Text style={styles.filterLabel}>Max ₦</Text>
                  <TextInput
                    style={styles.filterInput}
                    placeholder="Any"
                    keyboardType="numeric"
                    value={maxPrice}
                    onChangeText={setMaxPrice}
                  />
                </View>
              </View>

              <View style={styles.sortRow}>
                <TouchableOpacity 
                  style={[styles.sortTab, sortBy === 'newest' && styles.activeSortTab]}
                  onPress={() => setSortBy('newest')}
                >
                  <Text style={[styles.sortTabText, sortBy === 'newest' && styles.activeSortTabText]}>Newest</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.sortTab, sortBy === 'priceLow' && styles.activeSortTab]}
                  onPress={() => setSortBy('priceLow')}
                >
                  <Text style={[styles.sortTabText, sortBy === 'priceLow' && styles.activeSortTabText]}>Price: Low</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.clearBtn}
                  onPress={() => { 
                    setMinPrice(""); 
                    setMaxPrice(""); 
                    setSortBy('newest'); 
                    setSelectedCategory("All");
                  }}
                >
                  <Ionicons name="refresh-circle" size={26} color="#2255ee" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2255ee" />
            <Text style={styles.loadingText}>Finding fresh trades...</Text>
          </View>
        ) : (
          <FlatList
            data={processedProducts}
            renderItem={renderProduct}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#2255ee"
              />
            }
            columnWrapperStyle={styles.columnWrapper}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={64} color="#e5e7eb" />
                <Text style={styles.emptyText}>No items match your criteria.</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
  },
  addButton: {
    backgroundColor: "#2255ee",
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2255ee",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  filterButton: {
    backgroundColor: "#eef2ff",
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  activeFilterButton: {
    backgroundColor: "#2255ee",
  },
  searchSection: {
    backgroundColor: "#fff",
    paddingBottom: 10,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 15,
    height: 50,
    borderRadius: 14,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: "#1f2937",
  },
  categoryList: {
    paddingHorizontal: 20,
    paddingVertical: 5,
    gap: 8,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  activeCategoryTab: {
    backgroundColor: "#2255ee22",
    borderColor: "#2255ee",
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
  activeCategoryTabText: {
    color: "#2255ee",
  },
  filterBar: {
    marginHorizontal: 20,
    marginTop: 15,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    gap: 12,
  },
  priceInputsRow: {
    flexDirection: "row",
    gap: 10,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  priceInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    flex: 1,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    marginRight: 4,
  },
  filterInput: {
    height: 38,
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    flex: 1,
  },
  sortTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
  },
  activeSortTab: {
    backgroundColor: "#2255ee",
  },
  sortTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  activeSortTabText: {
    color: "#fff",
  },
  clearBtn: {
    marginLeft: "auto",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
    width: 200,
    textAlign: "center",
  },
  listContent: {
    padding: 12,
  },
  columnWrapper: {
    justifyContent: "space-between",
  },
  productCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 16,
    width: "48%",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    width: "100%",
    height: 130,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
    backgroundColor: "#f3f4f6",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  conditionBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  conditionText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#2255ee",
    textTransform: "uppercase",
  },
  priceBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "#2255ee",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  priceText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  productInfo: {
    padding: 12,
  },
  productCategory: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2255ee",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  productTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f2937",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  ownerInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 4,
  },
  ownerText: {
    fontSize: 13,
    color: "#4b5563",
    marginLeft: 6,
    flexShrink: 1,
    fontWeight: "600",
  },
  emptyContainer: {
    marginTop: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: "#9ca3af",
    fontWeight: "500",
  },
});