import { Ionicons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../../contexts/ThemeContext";

interface ChatHeaderProps {
  onBack: () => void;
  peerName: string;
  isPeerOnline: boolean;
  isPeerTyping: boolean;
  peerLastSeen: string | null;
  onOptionsPress: () => void;
}

const ChatHeader = ({
  onBack,
  peerName,
  isPeerOnline,
  isPeerTyping,
  peerLastSeen,
  onOptionsPress,
}: ChatHeaderProps) => {
  const { colors } = useTheme();
  const formatLastSeen = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.abs(now.getTime() - date.getTime()) / 36e5;

    if (diffInHours < 24 && date.getDate() === now.getDate()) {
      return `at ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })}`;
    } else if (diffInHours < 48 && date.getDate() === now.getDate() - 1) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <TouchableOpacity onPress={onBack} style={{ flexShrink: 0 }}>
        <Ionicons name="chevron-back" size={28} color={colors.text} />
      </TouchableOpacity>
      <View style={styles.headerInfo}>
        <View style={styles.titleContainer}>
          {peerName.includes(' • @') ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={[styles.productBadge, { backgroundColor: colors.primary + '20' }]}>
                <Text 
                  style={[styles.productText, { color: colors.primary }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {(() => {
                    const productName = peerName.split(' • @')[0];
                    return productName;
                  })()}
                </Text>
              </View>
              <Text style={[styles.separator, { color: colors.text }]}> • </Text>
              <Text 
                style={[styles.usernameText, { color: colors.text }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                @{peerName.split(' • @')[1]}
              </Text>
            </View>
          ) : (
            <Text 
              style={[styles.title, { color: colors.text }]} 
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {peerName || "Chat"}
            </Text>
          )}
        </View>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isPeerOnline ? "#10b981" : "#9ca3af" },
            ]}
          />
          <Text style={[styles.statusText, { color: colors.textSecondary }]} numberOfLines={1}>
            {isPeerTyping
              ? "Typing..."
              : isPeerOnline
              ? "Online"
              : peerLastSeen
              ? `Last seen ${formatLastSeen(peerLastSeen)}`
              : "Offline"}
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={onOptionsPress} style={styles.optionsButton}>
        <Ionicons name="menu" size={24} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    width: "100%",
  },
  headerInfo: { marginLeft: 12, flex: 1, minHeight: 50 },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  productBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    minWidth: 80,
    maxWidth: 140,
  },
  productText: {
    fontSize: 14,
    fontWeight: "500",
  },
  separator: {
    fontSize: 16,
    fontWeight: "400",
  },
  usernameText: {
    fontSize: 17,
    fontWeight: "700",
    flex: 1,
  },
  title: { fontWeight: "700", fontSize: 17, lineHeight: 22 },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 2, flex: 1, overflow: "hidden" },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6, flexShrink: 0 },
  statusText: { fontSize: 12, flex: 1 },
  optionsButton: {
    padding: 8,
    marginLeft: 8,
  },
});

export default memo(ChatHeader);