import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { memo, useRef, useState, useEffect, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
} from "react-native";

import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Message } from "../../../lib/supabase";
import { formatDate, formatDuration, formatTime } from "../../../utils/utils";
import { useTheme } from "../../../contexts/ThemeContext";

const EMOJI_TABS = [
  {
    label: "😀",
    title: "Smileys",
    emojis: [
      "😀","😂","🥰","😎","😢","😡","🤔","😮","🤣","😅","😇","🥳",
      "😏","😬","🤯","😴","🥺","😤","🤗","😑","😜","🤪","😒","😳",
      "🫠","🤭","😶","🫡","😈","🤫","🫢","😲", 
    ],
  },
  {
    label: "👍",
    title: "Gestures",
    emojis: [
      "👍","👎","👏","🙏","🤝","✌️","🤞","👀","💪","🤙","👋","🫶",
      "🤲","🫱","🫳","☝️","👆","👇","👈","👉","🤘","🤟","🖖","✋",
      "🖐️","👌","🤌","🤏","🫰","💅","🫵","🙌"
    ],
  },
  {
    label: "❤️",
    title: "Hearts",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","❤️‍🔥","💕","💞",
      "💓","💗","💖","💝","💘","💟","♥️","❣️","🫀","💌","💋","😍",
      "🥰","😘","💑","👫","💏","🌹","💐","🫦"
    ],
  },
  {
    label: "🎉",
    title: "Celebration",
    emojis: [
      "🎉","🔥","💯","🎊","🏆","⚡","🌟","💥","🎯","🚀","👑","💎",
      "🏅","🥇","🎖️","🎀","🎁","🪄","✨","🎆","🎇","🧨","🪅",
      "🎠","🎡","🎢","🎪","🎭","🎬","🎤","🎸"
    ],
  },
];

const EMOJIS = EMOJI_TABS[0].emojis.slice(0, 7);


interface MessageItemProps {
  item: any;
  currentUserId: string | null;
  replyContent: string | null;
  showDateHeader: boolean;
  activeMenuId: string | null;
  uploadProgress: Record<string, number>;
  playingVideoId: string | null;
  videoRefs: React.MutableRefObject<Record<string, any>>; 
  onActionMenu: (id: string | null) => void;
  onSetSelectedImage: (uri: string) => void;
  onSetPlayingVideoId: (id: string | null) => void;
  onReactionToggle: (message: Message, emoji: string) => void;
  onStartReply: (message: Message) => void;
  onStartReference: (message: Message) => void;
  onStartEdit: (message: Message) => void;
  onDownloadFile: (url: string, filename: string) => void;  
  onConfirmDelete: (id: string) => void;
  onReplyPress: (id: string) => void;
  highlightedId: string | null;
  searchQuery?: string;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
  setIsSelectionMode?: (value: boolean) => void;
  setSelectedMessages?: (value: Set<string>) => void;
  replyingTo?: any | null;
  referencingTo?: any | null;
  swipeHighlightedId?: string | null;
  index: number;
}

const MessageItem = memo((props: MessageItemProps) => {
  const {
    item,
    currentUserId,
    replyContent,
    showDateHeader,
    activeMenuId,
    uploadProgress,
    playingVideoId,
    videoRefs,
    onActionMenu,
    onSetSelectedImage,
    onSetPlayingVideoId,
    onReactionToggle,
    onStartReply,
    onStartReference,
    onStartEdit,
    onDownloadFile,
    onConfirmDelete,
    onReplyPress,
    highlightedId,
    searchQuery = '',
    isSelectionMode = false,
    isSelected = false,
    onToggleSelection,
    setIsSelectionMode,
    setSelectedMessages,
    swipeHighlightedId,
    index,
  } = props;
  
  // Minimize state variables
  const [localState, setLocalState] = useState({
    isSelectingMessage: false,
    isVideoLoading: true,
    showAllEmojis: false,
    activeTab: 0,
    isSwipeActive: false,
  });
  
  const [swipeAnimation] = useState(() => new Animated.Value(0));
  const bubbleRef = useRef<any>(null);
  const { colors } = useTheme();
  const mine = item.sender_id === currentUserId;
  const isMenuOpen = activeMenuId === item.id;

  // Create video player only when needed
  const isVideoItem = item.file_type === "video";
  const isActiveVideo = playingVideoId === item.id;

  const videoPlayer = useMemo(() => {
    if (!isVideoItem || !isActiveVideo) return null;
    return useVideoPlayer(item.file_url!, (player) => {
      player.loop = false;
    });
  }, [isVideoItem, isActiveVideo, item.file_url]);

  useEffect(() => {
    if (videoPlayer && !isActiveVideo) { 
      videoPlayer.pause();
    }
  }, [videoPlayer, isActiveVideo]);

  // Handle video player events
  useEffect(() => {
    if (videoPlayer) {
      const statusSubscription = videoPlayer.addListener('statusChange', (status) => {
        if (status.status === 'readyToPlay') {
          setLocalState(prev => ({ ...prev, isVideoLoading: false }));
        }
      });
      const playToEndSubscription = videoPlayer.addListener('playToEnd', () => {
        onSetPlayingVideoId(null);
      });
      return () => {
        statusSubscription?.remove();
        playToEndSubscription?.remove();
      };
    }
  }, [videoPlayer, onSetPlayingVideoId]);

  // Reset video loading state when video changes
  useEffect(() => {
    if (playingVideoId !== item.id) {
      setLocalState(prev => ({ ...prev, isVideoLoading: true }));
    }
  }, [playingVideoId, item.id]);

  // Use global swipe highlight state
  // const isSwipeHighlighted = swipeHighlightedId === item.id;

  const isHighlighted = highlightedId === item.id;

  // Debug audio state for this message (throttled)
  const debugTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    return () => {
      if (debugTimeoutRef.current) {
        clearTimeout(debugTimeoutRef.current);
      }
    };
  }, []);

  const progress = uploadProgress[item.id] ?? null;

  // const isSending = !!item.is_sending;
  const delivered = !!item.is_delivered;
  const read = !!item.is_read;

  // Helper function to highlight search terms
  const highlightText = (text: string, query: string) => {
    if (!query || !text) return <Text style={[styles.text, { color: colors.text }]}>{text}{"  "}</Text>;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <Text style={[styles.text, { color: colors.text }]}>
        {parts.map((part, index) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <Text key={index} style={{ backgroundColor: '#fef08a', color: '#000' }}>
              {part}
            </Text>
          ) : (
            part
          )
        )}
        {"  "}
      </Text>
    );
  };

  const handleSwipeGesture = useCallback((event: any) => {
    const { state, translationX } = event.nativeEvent;
    
    if (state === State.BEGAN) {
      setLocalState(prev => ({ ...prev, isSwipeActive: true }));
    } else if (state === State.ACTIVE) {
      const clampedTranslation = Math.max(0, Math.min(80, translationX));
      swipeAnimation.setValue(clampedTranslation);
    } else if (state === State.END || state === State.CANCELLED) {
      setLocalState(prev => ({ ...prev, isSwipeActive: false }));
      
      if (translationX > 25) {
        if (mine) {
          onStartReference(item);
        } else {
          onStartReply(item);
        }
      }
      
      Animated.timing(swipeAnimation, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }).start();
    }
  }, [mine, item, onStartReference, onStartReply, swipeAnimation]);

  return (
    <View>
      {showDateHeader && (
        <View style={styles.dateHeader}>
          <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dateHeaderText, { color: colors.text }]}>
            {formatDate(item.created_at)}
          </Text>
          <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
        </View>
      )}
      <View style={[styles.row, mine ? styles.right : styles.left, isMenuOpen && { zIndex: 99999, elevation: 99999 }]}>
        {/* Selection checkbox - show for all messages in selection mode */}
        {isSelectionMode && (
          <TouchableOpacity 
            onPress={() => onToggleSelection?.(item.id)}
            style={styles.selectionCheckbox}
          >
            <View style={[
              styles.checkbox,
              { borderColor: colors.border },
              isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}>
              {isSelected && (
                <Ionicons name="checkmark" size={16} color="white" />
              )}
            </View>
          </TouchableOpacity>
        )}
        
       <PanGestureHandler 
        onHandlerStateChange={handleSwipeGesture}
        activeOffsetX={[-3, 30]} 
        failOffsetY={[-30, 30]}
        shouldCancelWhenOutside={false}
      >
          <Animated.View
            ref={bubbleRef}
            style={[
              styles.bubble,
              mine ? [styles.myBubble, { backgroundColor: colors.bubble.mine }] : [styles.theirBubble, { backgroundColor: colors.bubble.theirs }],
              item.is_sending && { opacity: 0.9 },
              (isHighlighted || (swipeHighlightedId === item.id)) && { backgroundColor: "#fef08a" },
              isSelected && { backgroundColor: colors.primary + '80' },
              item.is_deleted && { opacity: 0.6 },
              { transform: [{ translateX: swipeAnimation }] },

            ]}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onLongPress={() => {
                if (!isSelectionMode) {
                  onActionMenu(item.id);
                }
              }}
              onPress={() => {
                if (isSelectionMode) {
                  onToggleSelection?.(item.id);
                }
              }}
              style={{ flex: 1 }}
            >
          {replyContent && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => item.parent_id && onReplyPress(item.parent_id)}
              style={[
                styles.replyInBubble,
                {
                  backgroundColor: mine
                    ? "rgba(100,100,255,0.5)"
                    : "rgba(0,0,0,0.1)",
                },
              ]}
            >
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[
                  styles.replyTextSmall,
                  { color: mine ? colors.background : colors.textSecondary },
                ]}
              >
                {replyContent}
              </Text>
            </TouchableOpacity>
          )}

          {item.file_type !== "image" && item.file_type !== "video" && item.file_type !== "audio" && (
            <View style={styles.textWithTime}>
              {item.deleted_for_everyone ? (
                <Text style={[styles.text, { color: colors.textSecondary, fontStyle: 'italic' }]}>Message deleted{"  "}</Text>
              ) : (
                highlightText(item.content, searchQuery)
              )}
            </View>
          )}
          {item.file_type === "image" ? (
            <Pressable
              onPress={() => onSetSelectedImage(item.file_url!)}
              onLongPress={() => onActionMenu(item.id)}
              delayLongPress={200}
            >
              <Image
                source={{ uri: item.file_url! }}
                style={styles.messageImage}
              />
            </Pressable>
          ) : item.file_type === "video" ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                if (playingVideoId === item.id) {
                  onSetPlayingVideoId(null);
                } else {
                  onSetPlayingVideoId(item.id);
                }
              }}
              onLongPress={() => onActionMenu(item.id)}
              style={styles.videoContainer}
            >
              {isActiveVideo && videoPlayer ? (
                <VideoView
                  ref={(ref) => {
                    if (ref) {
                      videoRefs.current[item.id] = ref;
                    }
                  }}
                  style={styles.messageVideo}
                  player={videoPlayer}
                  nativeControls={false}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.messageVideo, styles.videoPlaceholder]}>
                  <Ionicons name="play-circle" size={42} color="#fff" />
                </View>
              )}

              {localState.isVideoLoading && isActiveVideo && (
                <View style={[styles.messageVideo, styles.mediaLoader]}>
                  <ActivityIndicator size="large" color="#fff" />
                </View>
              )}

              <View style={styles.videoBadge} pointerEvents="none">
                <Ionicons name="videocam" size={14} color="#fff" />
                <Text style={styles.videoBadgeText}>Video</Text>
              </View>

              {!isActiveVideo && (
                <View style={styles.videoPlayOverlay} pointerEvents="none">
                  <Ionicons name="play-circle" size={42} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

          ) : null}

          {item.is_sending && progress != null && (
            <View style={{ marginTop: 8 }}>
              <View
                style={{
                  height: 6,
                  backgroundColor: "rgba(0,0,0,0.06)",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${progress}%`,
                    backgroundColor: "#2255ee",
                  }}
                />
              </View>
              <Text style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                {Math.round(progress)}%
              </Text>
            </View>
          )}

          {item.reactions && item.reactions.length > 0 && (
            <View
              style={[
                styles.reactionsDisplay,
                {
                  position: "absolute",
                  bottom: -25,
                  zIndex: 10,
                },
                mine
                  ? { justifyContent: "flex-end" }
                  : { justifyContent: "flex-start" },
              ]}
            >
              {Object.entries(
                (item.reactions as any[]).reduce(
                  (acc: Record<string, number>, reaction: any) => {
                    acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
                    return acc;
                  },
                  {} as Record<string, number>,
                ),
              ).map(([emoji, count]) => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.reactionBadge,
                    {
                      backgroundColor: item.reactions.some(
                        (r: any) =>
                          r.user_id === currentUserId && r.emoji === emoji,
                      )
                        ? mine
                          ? "#dbeafe"
                          : "#ffedd5"
                        : "#f3f4f6",
                      borderColor: item.reactions.some(
                        (r: any) =>
                          r.user_id === currentUserId && r.emoji === emoji,
                      )
                        ? "#60a5fa"
                        : "transparent",
                    },
                  ]}
                  onPress={() => onReactionToggle(item, emoji)}
                >
                  <Text style={styles.reactionEmojiText}>{emoji}</Text>
                  {count > 1 && (
                    <Text style={styles.reactionCountText}>{count}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View
            style={[
              styles.timeContainer,
              {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "flex-end",
              },
            ]}
          >
            {item.is_edited && (
              <Text style={[styles.time, { color: colors.textSecondary }]}>Edited â€¢ </Text>
            )}
            <Text style={[styles.time, { color: colors.textSecondary }]}>
              {formatTime(item.created_at)}{" "}
            </Text>
            {mine && !item.is_sending && (
              <View style={{ marginLeft: 4 }}>
                {read ? (
                  <View
                    style={{
                      backgroundColor: "#2255ee",
                      borderRadius: 10,
                      padding: 1,
                    }}
                  >
                    <Ionicons name="checkmark-done" size={12} color="#fff" />
                  </View>
                ) : delivered ? (
                  <Ionicons name="checkmark-done" size={16} color="#9ca3af" />
                ) : (
                  <Ionicons name="checkmark" size={14} color="#9ca3af" />
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>
        </Animated.View>
        </PanGestureHandler>
        {isMenuOpen && !isSelectionMode && (
          <View
            style={[
              styles.menuDropdown, 
              mine ? { right: 30 } : { left: 30 },
              index > 3 ? { top: 10 } : { bottom: 10 },
              { backgroundColor: colors.background, shadowColor: colors.text }
            ]}
          >
            <View style={styles.reactionPicker}>
              {EMOJIS.slice(0, 7).map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  activeOpacity={0.6}
                  onPress={() => onReactionToggle(item, emoji)}
                  style={styles.reactionButton}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                activeOpacity={0.6}
                onPress={() => setLocalState(prev => ({ ...prev, showAllEmojis: true }))}
                style={styles.reactionButton}
              >
                <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Modal transparent animationType="fade" visible={localState.showAllEmojis} onRequestClose={() => setLocalState(prev => ({ ...prev, showAllEmojis: false }))}>
              <Pressable style={styles.emojiModalOverlay} onPress={() => setLocalState(prev => ({ ...prev, showAllEmojis: false }))}>
                <View style={[styles.emojiModalBox, { backgroundColor: colors.background }]}>
                  <View style={styles.emojiTabBar}>
                    {EMOJI_TABS.map((tab, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => setLocalState(prev => ({ ...prev, activeTab: i }))}
                        style={[styles.emojiTab, localState.activeTab === i && { borderBottomWidth: 2, borderBottomColor: colors.primary }]}
                      >
                        <Text style={styles.emojiTabLabel}>{tab.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.emojiModalGrid}>
                    {EMOJI_TABS[localState.activeTab].emojis.map((emoji) => (
                      <TouchableOpacity
                        key={emoji}
                        activeOpacity={0.6}
                        onPress={() => { 
                          onReactionToggle(item, emoji); 
                          setLocalState(prev => ({ ...prev, showAllEmojis: false, activeTab: 0 })); 
                          onActionMenu(null); 
                        }}
                        style={styles.emojiModalButton}
                      >
                        <Text style={styles.emojiModalEmoji}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </Pressable>
            </Modal>

            <View
              style={{
                height: 1,
                backgroundColor: "#f3f4f6",
                marginVertical: 4,
                marginHorizontal: 8,
              }}
            />
            {!mine && (
              <TouchableOpacity
                style={styles.menuBtn}
                onPress={() => onStartReply(item)}
              >
                <Ionicons name="arrow-undo-outline" size={14} color={colors.text} />
                <Text style={[styles.menuBtnText, { color: colors.text }]}>Reply</Text>
              </TouchableOpacity>
            )}
            {mine && (
              <TouchableOpacity
                style={styles.menuBtn}
                onPress={() => onStartEdit(item)}
              >
                <Ionicons name="pencil-outline" size={14} color={colors.text} />
                <Text style={[styles.menuBtnText, { color: colors.text }]}>Edit</Text>
              </TouchableOpacity>
            )}
            {item.file_url && (
              <TouchableOpacity
                style={styles.menuBtn}
                onPress={() => {
                  const ext = item.file_url!.split(".").pop() || "file";
                  onDownloadFile(item.file_url!, `file_${item.id}.${ext}`);
                  onActionMenu(null);
                }}
              >
                <Ionicons name="download-outline" size={14} color={colors.text} />
                <Text style={[styles.menuBtnText, { color: colors.text }]}>Download</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.menuBtn}
              onPress={() => onConfirmDelete(item.id)}
            >
              <Ionicons name="trash-outline" size={14} color="#ef4444" />
              <Text style={[styles.menuBtnText, { color: "#ef4444" }]}>
                Delete
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.menuBtn}
              onPress={async () => {
                setLocalState(prev => ({ ...prev, isSelectingMessage: true }));
                onActionMenu(null);
                setIsSelectionMode?.(true);
                setSelectedMessages?.(new Set([item.id]));
                setLocalState(prev => ({ ...prev, isSelectingMessage: false }));
              }}
            >
              {localState.isSelectingMessage ? (
                <ActivityIndicator size={14} color={colors.primary} />
              ) : (
                <Ionicons name="checkmark-circle-outline" size={14} color={colors.primary} />
              )}
              <Text style={[styles.menuBtnText, { color: colors.primary }]}>
                Select
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", marginBottom: 15, width: "100%" },
  left: { justifyContent: "flex-start" },
  right: { justifyContent: "flex-end" },
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 25,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  dateHeaderText: {
    fontSize: 12,
    fontWeight: "600",
    marginHorizontal: 10,
    textTransform: "uppercase",
  },
  dateLine: {
    flex: 1,
    height: 1,
  },
  bubble: {
    maxWidth: "75%",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
    marginVertical: 10,
    alignSelf: "flex-start",
  },
  textBubble: {},
  highlightedBubble: { backgroundColor: "#fef08a" },
  myBubble: { borderBottomRightRadius: 4 },
  theirBubble: { borderBottomLeftRadius: 4 },
  text: {
    fontSize: 16,
    lineHeight: 22,
    flexShrink: 1,
  },
menuDropdown: {
  position: "absolute",
  borderRadius: 16,
  paddingVertical: 10,
  paddingHorizontal: 8,
  width: 220,
  zIndex: 999999,
  ...Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
    },
    android: { 
      elevation: 24,
      shadowColor: '#000',
    },
  }),
},
  menuBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  menuBtnText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  replyInBubble: {
    padding: 6,
    borderRadius: 8,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: "#2255ee",
    width: 140,
  },
  replyTextSmall: { fontSize: 12, fontStyle: "italic" },
  timeContainer: {
    marginTop: 2,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    flexShrink: 0,
  },
  time: { fontSize: 10, paddingRight: 8, flexShrink: 0 },
  myTime: {},
  textWithTime: {
    flexDirection: "column",
  },
  messageImage: { width: 200, height: 200, borderRadius: 12, marginBottom: 4 },
  messageVideo: { width: 200, height: 150, borderRadius: 12, marginBottom: 4 },
  audioBubble: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    minWidth: 160,
  },
  playBtn: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  audioInfo: { flex: 1, justifyContent: "center" },
  audioProgressRow: { flexDirection: "row", alignItems: "center" },
  audioControlRow: { flexDirection: "row", marginTop: 8, justifyContent: "center" },
  ctrlBtn: { marginHorizontal: 8 },
  progressBarContainer: { flex: 1, paddingVertical: 8 },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: { height: "100%", backgroundColor: "#2255ee" },
  audioTitle: {
    fontSize: 14,
    marginBottom: 6,
    maxWidth: "100%",
    flexShrink: 1,
  },
  durationTextSmall: { fontSize: 11, color: "#666", marginLeft: 8 },
  videoContainer: {
    position: "relative",
  },
  videoBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  videoBadgeText: {
    color: "#fff",
    fontSize: 10,
    marginLeft: 4,
    fontWeight: "600",
  },
  videoPlayOverlay: {
    position: "absolute",
    top: "40%",
    left: "40%",
    opacity: 0.9,
    zIndex: 10,
  },
  reactionPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 6,
  },
  reactionButton: {
    width: "25%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
  },
  reactionEmoji: {
    fontSize: 20,
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
    borderBottomColor: "#e5e7eb",
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
  reactionsDisplay: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  reactionBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    borderWidth: 1,
  },
  reactionEmojiText: { fontSize: 12 },
  reactionCountText: { fontSize: 11, marginLeft: 3, color: "#4b5563" },
  videoPlaceholder: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaLoader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    zIndex: 10,
  },
  selectionCheckbox: {
    paddingRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

const areEqual = (prevProps: MessageItemProps, nextProps: MessageItemProps) => {
  const id = nextProps.item.id;

  // Check video state changes
  if ((prevProps.playingVideoId === id) !== (nextProps.playingVideoId === id)) return false;

  // Check other dynamic props
  if (prevProps.uploadProgress?.[id] !== nextProps.uploadProgress?.[id]) return false;
  if (prevProps.searchQuery !== nextProps.searchQuery) return false;

  return (
    prevProps.item === nextProps.item &&
    prevProps.isSelectionMode === nextProps.isSelectionMode &&
    prevProps.isSelected === nextProps.isSelected &&
    (prevProps.activeMenuId === id) === (nextProps.activeMenuId === id) &&
    (prevProps.highlightedId === id) === (nextProps.highlightedId === id) &&
    (prevProps.swipeHighlightedId === id) === (nextProps.swipeHighlightedId === id)
  );
};

MessageItem.displayName = 'MessageItem';

export default memo(MessageItem, areEqual);

   