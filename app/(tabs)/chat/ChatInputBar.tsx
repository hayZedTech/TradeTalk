import { Ionicons } from "@expo/vector-icons";
import React, { memo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Message } from "../../../lib/supabase";
import { useTheme } from "../../../contexts/ThemeContext";

const EMOJI_TABS = [
  { label: "😀", title: "Smileys", emojis: ["😀","😂","🥰","😎","😢","😡","🤔","😮","🤣","😅","😇","🥳","😏","😬","🤯","😴","🥺","😤","🤗","😑","😜","🤪","😒","😳","🫠","🤭","😶","🫡","😈","🤫","🫢","😲"] },
  { label: "👍", title: "Gestures", emojis: ["👍","👎","👏","🙏","🤝","✌️","🤞","👀","💪","🤙","👋","🫶","🤲","🫱","🫳","☝️","👆","👇","👈","👉","🤘","🤟","🖖","✋","🖐️","👌","🤌","🤏","🫰","💅","🫵","🙌"] },
  { label: "❤️", title: "Hearts", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","❤️🔥","💕","💞","💓","💗","💖","💝","💘","💟","♥️","❣️","🫀","💌","💋","😍","🥰","😘","💑","👫","💏","🌹","💐","🫦"] },
  { label: "🎉", title: "Celebration", emojis: ["🎉","🔥","💯","🎊","🏆","⚡","🌟","💥","🎯","🚀","👑","💎","🏅","🥇","🎖️","🎀","🎁","🪄","✨","🌈","🎆","🎇","🧨","🪅","🎠","🎡","🎢","🎪","🎭","🎬","🎤","🎸"] },
];

const QUICK_EMOJIS = EMOJI_TABS[0].emojis.slice(0, 15);

interface ChatInputBarProps {
  inputRef: React.RefObject<TextInput>;
  newMessage: string;
  isRecording: boolean;
  sendingText: boolean;
  showEmojiPicker: boolean;
  editingMessage: Message | null;
  replyingTo: Message | null;
  referencingTo: Message | null;
  onTyping: (text: string) => void;
  onSend: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPickMedia: () => void;
  onToggleEmojiPicker: () => void;
  onCancelReplyEdit: () => void;
}

const ChatInputBar = ({
  inputRef,
  newMessage,
  isRecording,
  sendingText,
  showEmojiPicker,
  editingMessage,
  replyingTo,
  referencingTo,
  onTyping,
  onSend,
  onStartRecording,
  onStopRecording,
  onPickMedia,
  onToggleEmojiPicker,
  onCancelReplyEdit,
}: ChatInputBarProps) => {
  const { colors } = useTheme();
  const [showAllEmojis, setShowAllEmojis] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  return (
    <>
      {(editingMessage || replyingTo || referencingTo) && (
        <View style={styles.preInputBar}>
          <View style={styles.preInputContent}>
            <Ionicons
              name={editingMessage ? "pencil" : referencingTo ? "link" : "arrow-undo"}
              size={16}
              color="#2255ee"
            />
            <Text style={styles.preInputText} numberOfLines={1} ellipsizeMode="tail">
              {editingMessage
                ? `Editing: ${editingMessage.content}`
                : referencingTo
                ? `Referencing: ${referencingTo.content}`
                : `Replying to: ${replyingTo!.content}`}
            </Text>
          </View>
          <TouchableOpacity onPress={onCancelReplyEdit}>
            <Ionicons name="close-circle" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      )}

      {showEmojiPicker && (
        <View style={[styles.emojiPickerContainer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          {QUICK_EMOJIS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              onPress={() => onTyping(newMessage + emoji)}
              style={styles.emojiPickerButton}
            >
              <Text style={styles.emojiPickerText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => setShowAllEmojis(true)}
            style={styles.emojiPickerButton}
          >
            <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      )}

      <Modal transparent animationType="fade" visible={showAllEmojis} onRequestClose={() => setShowAllEmojis(false)}>
        <Pressable style={styles.emojiModalOverlay} onPress={() => setShowAllEmojis(false)}>
          <View style={[styles.emojiModalBox, { backgroundColor: colors.background }]}>
            <View style={[styles.emojiTabBar, { borderBottomColor: colors.border }]}>
              {EMOJI_TABS.map((tab, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setActiveTab(i)}
                  style={[styles.emojiTab, activeTab === i && { borderBottomWidth: 2, borderBottomColor: colors.primary }]}
                >
                  <Text style={styles.emojiTabLabel}>{tab.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.emojiModalGrid}>
              {EMOJI_TABS[activeTab].emojis.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  activeOpacity={0.6}
                  onPress={() => { onTyping(newMessage + emoji); setShowAllEmojis(false); setActiveTab(0); }}
                  style={styles.emojiModalButton}
                >
                  <Text style={styles.emojiModalEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      <View style={styles.inputBar}>
        <TouchableOpacity onPress={onPickMedia} style={styles.attachBtn}>
          <Ionicons name="add" size={28} color="#2255ee" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onToggleEmojiPicker}
          style={styles.attachBtn}
        >
          <Ionicons name="happy-outline" size={28} color="#2255ee" />
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={isRecording ? "Recording..." : "Type a message…"}
          value={newMessage}
          onChangeText={onTyping}
          multiline
          autoCorrect={false}
          spellCheck={false}
          placeholderTextColor="#9caaf"
          editable={!isRecording}
        />

        {newMessage.trim() || isRecording ? (
          <TouchableOpacity
            onPress={isRecording ? onStopRecording : onSend}
            style={[
              styles.send,
              isRecording && { backgroundColor: "#ef4444" },
            ]}
            disabled={sendingText && !newMessage.trim()}
          >
            {sendingText && !isRecording ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons
                name={isRecording ? "stop" : "send"}
                size={18}
                color="#fff"
              />
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={onStartRecording} style={styles.send}>
            <Ionicons name="mic" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  preInputBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#f3f4f6",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  preInputContent: { flex: 1, flexDirection: "row", alignItems: "center" },
  preInputText: {
    marginLeft: 8,
    fontSize: 13,
    color: "#4b5563",
    fontStyle: "italic",
    flex: 1,
  },
  emojiPickerContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 10,
    borderTopWidth: 1,
    justifyContent: "space-around",
  },
  emojiPickerButton: {
    padding: 8,
  },
  emojiPickerText: {
    fontSize: 24,
  },
  emojiModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  emojiModalBox: {
    width: 300,
    borderRadius: 20,
    padding: 16,
  },
  emojiTabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
    borderBottomWidth: 1,
  },
  emojiTab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  emojiTabLabel: {
    fontSize: 22,
  },
  emojiModalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  emojiModalButton: {
    width: "20%",
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  emojiModalEmoji: {
    fontSize: 26,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    backgroundColor: "#fff",
  },
  attachBtn: { marginRight: 8, marginBottom: 8 },
  input: {
    flex: 1,
    backgroundColor: "#f9f9f9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingRight: 25,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    minHeight: 40,
    maxHeight: 120,
    textAlignVertical: "center",
  },
  send: {
    marginLeft: 10,
    backgroundColor: "#2255ee",
    borderRadius: 25,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default memo(ChatInputBar);
