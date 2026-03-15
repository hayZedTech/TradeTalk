import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
  RefreshControl,
} from "react-native";
import { supabase } from "../../../../lib/supabase";
import { validateAndProcessMedia } from "../../../../utils/mediaHelper";
import { productService } from "../../../../services/productService";

const CATEGORIES = ["All", "Electronics", "Fashion", "Automobile", "Home", "Sports", "Books", "Health & Beauty",
  "Groceries", "Toys & Games", "Pet Supplies", "Office & Industrial", "Art & Collectibles", "Other"];
const CONDITIONS = ["New", "Open Box", "Excellent", "Gently Used", "Fair", "Poor"];

export default function EditProduct() {
  const { id } = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form States
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [condition, setCondition] = useState(CONDITIONS[0]);
  const [imageUri, setImageUri] = useState<string | null>(null);

  const loadProduct = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (data) {
        setTitle(data.title);
        setPrice(data.price.toString());
        setDescription(data.description);
        setCategory(data.category || CATEGORIES[0]);
        setCondition(data.condition || CONDITIONS[0]);
        setImageUri(data.image_url);
      }
    } catch (error) {
      console.error("Error loading product:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  const onRefresh = () => {
    setRefreshing(true);
    loadProduct();
  };

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setProcessingImage(true);
      const processedUri = await validateAndProcessMedia(result.assets[0].uri, 'image');
      if (processedUri) {
        setImageUri(processedUri);
      }
      setProcessingImage(false);
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Camera access is needed.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled) {
      setProcessingImage(true);
      const processedUri = await validateAndProcessMedia(result.assets[0].uri, 'image');
      if (processedUri) {
        setImageUri(processedUri);
      }
      setProcessingImage(false);
    }
  }

  function handleImagePress() {
    Alert.alert("Update Product Photo", "Select an option", [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Gallery", onPress: pickImage },
      { text: "Cancel", style: "cancel" },
    ]);
  }

 async function handleSave() {
  if (!title.trim() || !price.trim() || !imageUri) {
    Alert.alert("Error", "Please fill in all fields and add an image");
    return;
  }

  setSaving(true);
  try {
    // We pass the data to the service. 
    // The service handles checking if imageUri is a new local file (needs upload) 
    // or an existing Cloudinary URL (no upload needed).
    await productService.updateProduct(id as string, {
      title,
      price: parseFloat(price),
      description,
      category,
      condition,
      imageUri, // The service will handle the Cloudinary upload logic
    });

    Alert.alert("Success", "Listing updated!", [
      { text: "OK", onPress: () => router.back() }
    ]);
  } catch (error: any) {
    console.error("Update Error:", error);
    Alert.alert("Error", error.message || "Failed to update product");
  } finally {
    setSaving(false);
  }
}


  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2255ee" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#f9fafb" }}
    >
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2255ee" />}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close-outline" size={28} color="#000" />
          </TouchableOpacity>
          <Text style={styles.title}>Edit Item</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Image Picker Box - Shows Image Preview */}
        <TouchableOpacity
          style={[styles.imagePicker, !imageUri && styles.dashedBorder]}
          onPress={handleImagePress}
          activeOpacity={0.7}
          disabled={processingImage}
        >
          {processingImage ? (
            <View style={styles.innerContainer}>
              <ActivityIndicator color="#2255ee" />
              <Text style={styles.placeholderText}>Optimizing...</Text>
            </View>
          ) : imageUri ? (
            <View style={styles.imageWrapper}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
              <View style={styles.editBadge}>
                <Ionicons name="pencil" size={12} color="#fff" />
              </View>
            </View>
          ) : (
            <View style={styles.innerContainer}>
              <View style={styles.iconCircle}>
                <Ionicons name="camera" size={30} color="#2255ee" />
              </View>
              <Text style={styles.placeholderText}>Add Product Photo</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Ionicons name="pricetag-outline" size={18} color="#000" />
            <Text style={styles.label}>Title</Text>
          </View>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} maxLength={50} />
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Ionicons name="cash-outline" size={18} color="#000" />
            <Text style={styles.label}>Price</Text>
          </View>
          <View style={styles.priceInputContainer}>
            <View style={styles.currencyPrefix}><Text style={styles.currencyText}>₦</Text></View>
            <TextInput style={styles.priceInput} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Ionicons name="document-text-outline" size={18} color="#000" />
            <Text style={styles.label}>Description</Text>
          </View>
          <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} multiline numberOfLines={4} />
        </View>

        <Text style={styles.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipContent}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity key={cat} style={[styles.chip, category === cat && styles.chipSelected]} onPress={() => setCategory(cat)}>
              <Text style={[styles.chipText, category === cat && styles.chipTextSelected]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>Condition</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipContent}>
          {CONDITIONS.map((cond) => (
            <TouchableOpacity key={cond} style={[styles.chip, condition === cond && styles.chipSelected]} onPress={() => setCondition(cond)}>
              <Text style={[styles.chipText, condition === cond && styles.chipTextSelected]}>{cond}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={[styles.submitButton, (saving || processingImage) && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving || processingImage}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.buttonInner}>
              <Text style={styles.submitButtonText}>Update Listing</Text>
              <Ionicons name="checkmark-done" size={20} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: 20, paddingBottom: 60 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: Platform.OS === "ios" ? 20 : 10 },
  title: { fontSize: 28, fontWeight: "900", color: "#000" },
  imagePicker: { width: "100%", height: 160, backgroundColor: "#fff", borderRadius: 20, marginBottom: 24, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  dashedBorder: { borderWidth: 2, borderColor: "#cbd5e1", borderStyle: "dashed" },
  imageWrapper: { width: '100%', height: '100%' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  innerContainer: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 8 },
  editBadge: { position: "absolute", bottom: 12, right: 12, backgroundColor: "#2255ee", padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#fff' },
  iconCircle: { backgroundColor: "#eef2ff", padding: 15, borderRadius: 40 },
  placeholderText: { fontSize: 16, fontWeight: "700", color: "#64748b" },
  inputGroup: { marginBottom: 20 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  label: { fontSize: 16, fontWeight: "800", color: "#000" },
  input: { backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, fontSize: 16, borderWidth: 1.5, borderColor: "#e2e8f0", color: "#000" },
  priceInputContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, borderWidth: 1.5, borderColor: "#e2e8f0", overflow: "hidden" },
  currencyPrefix: { backgroundColor: "#f1f5f9", paddingHorizontal: 16, height: 56, justifyContent: "center", borderRightWidth: 1.5, borderRightColor: "#e2e8f0" },
  currencyText: { fontSize: 18, fontWeight: "800", color: "#000" },
  priceInput: { flex: 1, paddingHorizontal: 16, fontSize: 18, fontWeight: "600", color: "#000", height: 56 },
  textArea: { minHeight: 120, textAlignVertical: "top" },
  chipScroll: { marginBottom: 24, marginHorizontal: -20 },
  chipContent: { paddingHorizontal: 20, gap: 10 },
  chip: { paddingHorizontal: 20, paddingVertical: 10, marginVertical: 10, backgroundColor: "#fff", borderRadius: 30, borderWidth: 1.5, borderColor: "#e2e8f0" },
  chipSelected: { backgroundColor: "#2255ee", borderColor: "#2255ee" },
  chipText: { color: "#64748b", fontWeight: "700", fontSize: 14 },
  chipTextSelected: { color: "#fff" },
  submitButton: { backgroundColor: "#2255ee", paddingVertical: 15, borderRadius: 20, alignItems: "center", marginTop: 10, shadowColor: "#2255ee", shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  buttonInner: { flexDirection: "row", alignItems: "center", gap: 10 },
  buttonDisabled: { backgroundColor: "#94a3b8" },
  submitButtonText: { color: "#fff", fontSize: 18, fontWeight: "800" },
});