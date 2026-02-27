import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
} from "react-native";
import { supabase } from "../../../../lib/supabase";

export default function EditProduct() {
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    price: "",
    description: "",
    category: "",
    condition: "",
  });

  useEffect(() => {
    async function loadProduct() {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (data) {
        setForm({
          title: data.title,
          price: data.price.toString(),
          description: data.description,
          category: data.category,
          condition: data.condition,
        });
      }
      setLoading(false);
    }
    loadProduct();
  }, [id]);

  async function handleSave() {
    if (!form.title || !form.price) {
      Alert.alert("Error", "Title and Price are required");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({
          title: form.title,
          price: parseFloat(form.price),
          description: form.description,
          category: form.category,
          condition: form.condition,
        })
        .eq("id", id);

      if (error) throw error;
      
      Alert.alert("Success", "Product updated!", [
        { 
          text: "OK", 
          onPress: () => {
            // We use replace or push to force a re-render of the previous screen 
            // if it uses a listener, or just back() if the previous screen has an onFocus listener.
            router.back(); 
          } 
        }
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to update product");
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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Listing</Text>
          <TouchableOpacity 
            onPress={handleSave} 
            disabled={saving} 
            style={[styles.headerBtn, styles.saveBtnActive]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
          <View style={styles.inputCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                value={form.title}
                onChangeText={(t) => setForm({ ...form, title: t })}
                placeholder="What are you selling?"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Price ($)</Text>
              <TextInput
                style={styles.input}
                value={form.price}
                keyboardType="numeric"
                onChangeText={(t) => setForm({ ...form, price: t })}
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Category</Text>
              <TextInput
                style={styles.input}
                value={form.category}
                onChangeText={(t) => setForm({ ...form, category: t })}
                placeholder="e.g. Electronics"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Condition</Text>
              <TextInput
                style={styles.input}
                value={form.condition}
                onChangeText={(t) => setForm({ ...form, condition: t })}
                placeholder="e.g. New, Like New"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.description}
                onChangeText={(t) => setForm({ ...form, description: t })}
                placeholder="Describe your item in detail..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={6}
              />
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.footerSaveBtn} 
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.footerSaveBtnText}>Update Listing</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#f4f7fe" 
  },
  center: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center" 
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#2255ee",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#2255ee",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  headerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  saveBtnActive: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: "800", 
    color: "#fff" 
  },
  cancelText: { 
    color: "#fff", 
    fontSize: 15, 
    fontWeight: "600",
    opacity: 0.9
  },
  saveText: { 
    color: "#fff", 
    fontSize: 15, 
    fontWeight: "700" 
  },
  form: { 
    padding: 20 
  },
  inputCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  inputGroup: { 
    marginBottom: 18 
  },
  label: { 
    fontSize: 13, 
    fontWeight: "700", 
    color: "#2255ee", 
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  input: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#eef2ff",
    color: "#1f2937",
  },
  textArea: { 
    height: 120, 
    textAlignVertical: "top" 
  },
  footerSaveBtn: {
    backgroundColor: "#2255ee",
    marginTop: 25,
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#2255ee",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  footerSaveBtnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  }
});