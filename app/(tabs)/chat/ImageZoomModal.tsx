import { Ionicons } from "@expo/vector-icons";
import React, { memo } from "react";
import {
  Dimensions,
  Image,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

interface ImageZoomModalProps {
  imageUri: string | null;
  onClose: () => void;
}

const ImageZoomModal = ({ imageUri, onClose }: ImageZoomModalProps) => (
  <Modal visible={!!imageUri} transparent={true} animationType="fade">
    <View style={styles.modalBackground}>
      <TouchableOpacity style={styles.closeZoom} onPress={onClose}>
        <Ionicons name="close" size={30} color="white" />
      </TouchableOpacity>
      {imageUri && (
        <Image
          source={{ uri: imageUri }}
          style={styles.fullImage}
          resizeMode="contain"
        />
      )}
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: { width: width, height: height * 0.8 },
  closeZoom: { position: "absolute", top: 50, right: 20, zIndex: 10 },
});

export default memo(ImageZoomModal);