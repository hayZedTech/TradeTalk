import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
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
} from "react-native";
import { productService } from "../../../services/productService";
import { supabase } from "@/lib/supabase";

const CATEGORIES = [
  "Electronics",
  "Clothing",
  "Books",
  "Furniture",
  "Sports",
  "Other",
];
const CONDITIONS = ["New", "Like New", "Good", "Fair", "Poor"];

export default function AddProduct() {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [condition, setCondition] = useState(CONDITIONS[0]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  }

  async function handleSubmit() {
    if (!title.trim() || !description.trim() || !price.trim() || !imageUri) {
      Alert.alert("Error", "Please fill in all fields and add an image");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in to list an item.");
        setLoading(false);
        return;
      }

      await productService.addProduct({
        title,
        price: parseFloat(price),
        description,
        category,
        condition,
        imageUri,
      });

      router.replace("/(tabs)");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to add product");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>List an Item</Text>

        {/* Image Picker */}
        <TouchableOpacity
          style={[styles.imagePicker, !imageUri && styles.dashedBorder]}
          onPress={pickImage}
          activeOpacity={0.7}
        >
          {imageUri ? (
            <View style={styles.imageWrapper}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
              <View style={styles.editBadge}>
                <Ionicons name="pencil" size={16} color="#fff" />
              </View>
            </View>
          ) : (
            <View style={styles.placeholder}>
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
          <TextInput
            style={styles.input}
            placeholder="What are you trading?"
            value={title}
            onChangeText={setTitle}
            maxLength={50}
          />
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Ionicons name="cash-outline" size={18} color="#000" />
            <Text style={styles.label}>Price</Text>
          </View>
          <View style={styles.priceInputContainer}>
            <View style={styles.currencyPrefix}>
              <Text style={styles.currencyText}>$</Text>
            </View>
            <TextInput
              style={styles.priceInput}
              placeholder="0.00"
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Ionicons name="document-text-outline" size={18} color="#000" />
            <Text style={styles.label}>Description</Text>
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your item's history, features, or defects..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
        </View>

        <Text style={styles.label}>Category</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipContent}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, category === cat && styles.chipSelected]}
              onPress={() => setCategory(cat)}
            >
              <Text
                style={[
                  styles.chipText,
                  category === cat && styles.chipTextSelected,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>Condition</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipContent}
        >
          {CONDITIONS.map((cond) => (
            <TouchableOpacity
              key={cond}
              style={[styles.chip, condition === cond && styles.chipSelected]}
              onPress={() => setCondition(cond)}
            >
              <Text
                style={[
                  styles.chipText,
                  condition === cond && styles.chipTextSelected,
                ]}
              >
                {cond}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.buttonInner}>
              <Text style={styles.submitButtonText}>List Item Now</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#000",
    marginBottom: 24,
    marginTop: Platform.OS === "ios" ? 40 : 20,
  },
  imagePicker: {
    width: "100%",
    height: 160,
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  dashedBorder: {
    borderWidth: 2,
    borderColor: "#cbd5e1",
    borderStyle: "dashed",
  },
  imageWrapper: {
    flex: 1,
  },
  previewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  editBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "#2255ee",
    padding: 8,
    borderRadius: 20,
  },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    backgroundColor: "#eef2ff",
    padding: 15,
    borderRadius: 40,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#64748b",
  },
  inputGroup: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: "800",
    color: "#000",
  },
  input: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    color: "#000",
    minHeight: 56,
  },
  priceInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  currencyPrefix: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 16,
    height: 56,
    justifyContent: "center",
    borderRightWidth: 1.5,
    borderRightColor: "#e2e8f0",
  },
  currencyText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#000",
  },
  priceInput: {
    flex: 1,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    height: 56,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
    paddingTop: 14,
  },
  chipScroll: {
    marginBottom: 24,
    marginHorizontal: -20,
  },
  chipContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
  },
  chipSelected: {
    backgroundColor: "#2255ee",
    borderColor: "#2255ee",
  },
  chipText: {
    color: "#64748b",
    fontWeight: "700",
    fontSize: 14,
  },
  chipTextSelected: {
    color: "#fff",
  },
  submitButton: {
    backgroundColor: "#2255ee",
    paddingVertical: 20,
    borderRadius: 20,
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#2255ee",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  buttonDisabled: {
    backgroundColor: "#94a3b8",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
});