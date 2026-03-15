import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { validateAndProcessMedia } from "../../utils/mediaHelper";
import { router } from "expo-router";
import { useEffect, useState } from "react";
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
  Modal,
  Pressable,
} from "react-native";
import { supabase } from "../../lib/supabase";

export default function EditProfile() {
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingImage, setProcessingImage] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [isImageZoomed, setIsImageZoomed] = useState(false); // New state for zoom

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from("users")
          .select("username, avatar_url")
          .eq("id", user.id)
          .single();

        if (data) {
          setUsername(data.username || "");
          setAvatarUrl(data.avatar_url || null);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setProcessingImage(true);
      const processedUri = await validateAndProcessMedia(result.assets[0].uri, 'image');
      if (processedUri) {
        setImage(processedUri);
      } else {
        setImage(result.assets[0].uri);
      }
      setProcessingImage(false);
    }
  }

  async function uploadAvatar() {
    if (!image) return null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      const response = await fetch(image);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();

      const fileExt = image.split(".").pop()?.toLowerCase() ?? "jpeg";
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      return data.publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      throw error;
    }
  }

  async function handleUpdate() {
    if (!username.trim()) {
      Alert.alert("Error", "Username cannot be empty");
      return;
    }

    setUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      let publicUrl = avatarUrl;
      if (image) {
        publicUrl = await uploadAvatar();
      }

      const updates = {
        username: username.trim(),
        avatar_url: publicUrl,
        updated_at: new Date(),
      };

      const { error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;

      Alert.alert("Success", "Profile updated!", [
        { text: "OK", onPress: () => router.push("/profile") },
      ]);
    } catch (error: any) {
      Alert.alert("Update Failed", error.message);
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
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
            {(image || avatarUrl) && (
              <Image 
                source={{ uri: image || avatarUrl || "" }} 
                style={styles.zoomedImage} 
                resizeMode="contain" 
              />
            )}
          </View>
        </Pressable>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.navigate("/profile")} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.avatarSection}>
          <TouchableOpacity 
            activeOpacity={0.8} 
            onPress={() => {
              if (image || avatarUrl) setIsImageZoomed(true);
            }}
          >
            <View style={styles.avatar}>
              {image || avatarUrl ? (
                <Image
                  source={{ uri: image || avatarUrl || "" }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarText}>
                  {username ? username.charAt(0).toUpperCase() : "U"}
                </Text>
              )}
              {processingImage && (
                <View style={styles.processingOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={pickImage} activeOpacity={0.7}>
            <Text style={styles.changePhotoText}>Change Profile Photo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Username</Text>
          <View style={styles.inputContainer}>
            <Ionicons
              name="person-outline"
              size={20}
              color="#6b7280"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Enter username"
              autoCapitalize="none"
              placeholderTextColor="#9ca3af"
            />
          </View>
          <Text style={styles.helperText}>
            This is your public display name. 
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, updating && styles.buttonDisabled]}
          onPress={handleUpdate}
          disabled={updating}
        >
          {updating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  backButton: { padding: 8 },
  scrollContent: { padding: 24 },
  avatarSection: { alignItems: "center", marginBottom: 32 },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    overflow: "hidden", 
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarText: { color: "#fff", fontSize: 36, fontWeight: "bold" },
  changePhotoText: {  fontWeight: "600", fontSize: 14, color: "#000", backgroundColor:"#2255ee88", padding:10, borderRadius:10 },
  form: { marginBottom: 32 },
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 12,
    height: 56,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: "#111827" },
  helperText: { fontSize: 12,  marginTop: 8 },
  saveButton: {
    backgroundColor: "#2255ee",
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.7 },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
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