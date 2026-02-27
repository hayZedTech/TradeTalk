import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";

export default function Settings() {
  const [notifications, setNotifications] = useState(true);
  const { isDark, toggleTheme } = useTheme();

  const toggleNotifications = () =>
    setNotifications((previousState) => !previousState);

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text
            style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}
          >
            Preferences
          </Text>

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View
                style={[styles.iconContainer, { backgroundColor: "#e0e7ff" }]}
              >
                <Ionicons
                  name="notifications-outline"
                  size={20}
                  color="#6366f1"
                />
              </View>
              <Text style={[styles.rowLabel, isDark && styles.textDark]}>
                Push Notifications
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#767577", true: "#2255ee" }}
              thumbColor={notifications ? "#fff" : "#f4f3f4"}
              ios_backgroundColor="#3e3e3e"
              onValueChange={toggleNotifications}
              value={notifications}
            />
          </View>

          <View style={[styles.divider, isDark && styles.dividerDark]} />

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: isDark ? "#374151" : "#f3f4f6" },
                ]}
              >
                <Ionicons
                  name="moon-outline"
                  size={20}
                  color={isDark ? "#fff" : "#1f2937"}
                />
              </View>
              <Text style={[styles.rowLabel, isDark && styles.textDark]}>
                Dark Mode
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#767577", true: "#2255ee" }}
              thumbColor={isDark ? "#fff" : "#f4f3f4"}
              ios_backgroundColor="#3e3e3e"
              onValueChange={toggleTheme}
              value={isDark}
            />
          </View>
        </View>

        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text
            style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}
          >
            Account
          </Text>
          <TouchableOpacity
            style={styles.row}
            onPress={() =>
              Alert.alert(
                "Change Password",
                "This feature will be available soon.",
              )
            }
          >
            <View style={styles.rowLeft}>
              <View
                style={[styles.iconContainer, { backgroundColor: "#fee2e2" }]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#ef4444"
                />
              </View>
              <Text style={[styles.rowLabel, isDark && styles.textDark]}>
                Change Password
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text
            style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}
          >
            About
          </Text>
          <TouchableOpacity
            style={styles.row}
            onPress={() => Alert.alert("About", "TradeTalk v1.0.0")}
          >
            <View style={styles.rowLeft}>
              <View
                style={[styles.iconContainer, { backgroundColor: "#ecfdf5" }]}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color="#10b981"
                />
              </View>
              <Text style={[styles.rowLabel, isDark && styles.textDark]}>
                Version
              </Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>1.0.0</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  containerDark: { backgroundColor: "#111827" },
  scrollContent: { padding: 20 },
  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionDark: {
    backgroundColor: "#1f2937",
    shadowColor: "#000",
    shadowOpacity: 0.2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 8,
    marginTop: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionTitleDark: { color: "#9ca3af" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    
  },
  rowLeft: { flexDirection: "row", alignItems: "center" },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rowLabel: { fontSize: 16, color: "#1f2937", fontWeight: "500", width:200 },
  textDark: { color: "#f9fafb" },
  rowRight: { flexDirection: "row", alignItems: "center" },
  rowValue: { fontSize: 14, color: "#6b7280", marginRight: 8 },
  divider: { height: 1, backgroundColor: "#f3f4f6", marginLeft: 44 },
  dividerDark: { backgroundColor: "#374151" },
});
