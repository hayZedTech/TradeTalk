import React, { memo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

interface PreparingFileOverlayProps {
  visible: boolean;
}

const PreparingFileOverlay = ({ visible }: PreparingFileOverlayProps) => {
  if (!visible) return null;
  return (
    <View style={styles.overlayLoader}>
      <View style={styles.overlayCard}>
        <ActivityIndicator size="large" color="#2255ee" />
        <Text style={styles.overlayText}>Preparing file...</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayLoader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 99999,
  },
  overlayCard: {
    backgroundColor: "#fff",
    paddingVertical: 30,
    paddingHorizontal: 35,
    borderRadius: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  overlayText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
});

export default memo(PreparingFileOverlay);