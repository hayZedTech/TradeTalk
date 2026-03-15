import {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { Audio, AVPlaybackStatus } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// Type alias to prevent flickering TS errors
const FS: any = FileSystem;

import * as DocumentPicker from "expo-document-picker";
import { Chat, Message, Reaction, supabase } from "../../../lib/supabase";
import { validateAndProcessMedia } from "../../../utils/mediaHelper";
import ChatHeader from "./ChatHeader";
import ChatInputBar from "./ChatInputBar";
import ImageZoomModal from "./ImageZoomModal";
import MessageItem from "./MessageItem";
import PreparingFileOverlay from "./PreparingFileOverlay";
import ChatOptionsModal from "../../../components/chat/ChatOptionsModal";
import { useTheme } from "../../../contexts/ThemeContext";

// ✅ Fix for inverted list stacking:
// Ensures newer messages (lower index, visually at bottom) are rendered "on top" of older messages
// so that menus opening upwards don't get covered by the message row above them.
const CellRenderer = memo(({ index, style, children, ...props }: any) => {
  const zIndex = 10000 - index;
  return (
    <View style={[style, { zIndex, elevation: zIndex }]} {...props}>
      {children}
    </View>
  );
});

export default function ChatRoom() {
  const params = useLocalSearchParams();
  const chatId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [messages, setMessages] = useState<any[]>([]);
  const [chatDetails, setChatDetails] = useState<Chat | null>(null);
  const [newMessage, setNewMessage] = useState("");
  // sending = used by media upload flows (kept as-is)
  const [sending, setSending] = useState(false);
  // sendingText = used for text message send/edit flows (separate so media UI is unchanged)
  const [sendingText, setSendingText] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<any | null>(null);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [referencingTo, setReferencingTo] = useState<any | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [swipeHighlightedId, setSwipeHighlightedId] = useState<string | null>(null);

  // Multiple selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [isTogglingSelection, setIsTogglingSelection] = useState(false);

  // Add state to track if current user is blocked by the other user
  const [isBlockedByThem, setIsBlockedByThem] = useState(false);
  // Chat Options Modal State
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [isUserBlocked, setIsUserBlocked] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Theme
  const { colors } = useTheme();

  // New: chat-level preparing indicator (shows immediately after capture/selection/recording)
  const [isPreparingFile, setIsPreparingFile] = useState(false);

  // Presence State
  const [isPeerOnline, setIsPeerOnline] = useState(false);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [peerLastSeen, setPeerLastSeen] = useState<string | null>(null);

  // Zoom State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Media and Hardware States
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);

  // Playback States
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState({
    position: 0,
    duration: 0,
    isPlaying: false,
  });

  // Upload progress state: map message id -> percent (0..100)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {},
  );
  // timers for simulated progress
  const uploadTimersRef = useRef<Record<string, number>>({});

  // Video refs for controlling playback (per message id)
  const videoRefs = useRef<Record<string, any>>({});

  const flatListRef = useRef<FlatList<any>>(null);
  const inputRef = useRef<TextInput>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesRef = useRef(messages);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const reactionsChannelRef = useRef<RealtimeChannel | null>(null);

  // Refs for stable audio callbacks
  const soundRef = useRef<Audio.Sound | null>(null);
  const playbackStatusRef = useRef(playbackStatus);
  const playingIdRef = useRef(playingId);

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  // Keep refs synced with state
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);
  useEffect(() => {
    playbackStatusRef.current = playbackStatus;
  }, [playbackStatus]);
  useEffect(() => {
    playingIdRef.current = playingId;
  }, [playingId]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Check if user is blocked on component mount and when sending messages
  useEffect(() => {
    checkBlockStatus();
  }, [chatDetails]);

  const checkBlockStatus = async () => {
    if (!currentUserId || !chatDetails) return;
    
    const otherUserId = chatDetails.buyer_id === currentUserId 
      ? chatDetails.seller_id 
      : chatDetails.buyer_id;

    try {
      // Check if current user blocked the other user
      const { data: blockedByMe } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('blocker_id', currentUserId)
        .eq('blocked_id', otherUserId)
        .single();
      
      // Check if other user blocked current user
      const { data: blockedByThem } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('blocker_id', otherUserId)
        .eq('blocked_id', currentUserId)
        .single();
      
      setIsUserBlocked(!!blockedByMe);
      setIsBlockedByThem(!!blockedByThem);
    } catch (error) {
      setIsUserBlocked(false);
    }
  };

  // Memoize messages map for fast lookups
  const messageMap = useMemo(() => {
    const map = new Map<string, any>();
    messages.forEach((m) => {
      if (m.id) map.set(m.id, m);
    });
    return map;
  }, [messages]);

  // --- Helper Functions ---

  const checkFileSize = (sizeInBytes: number, type: string) => {
    const sizeInMB = sizeInBytes / (1024 * 1024);
    const limits: Record<string, number> = {
      image: 2,
      video: 25,
      audio: 5,
    };

    if (sizeInMB > limits[type]) {
      Alert.alert(
        "File too large",
        `Maximum size for ${type} is ${limits[type]}MB. Your file is ${sizeInMB.toFixed(1)}MB.`,
      );
      return false;
    }
    return true;
  };

  const uploadFile = async (uri: string, type: "image" | "video" | "audio") => {
    if (!uri) throw new Error("Missing file URI");

    const getExt = (u: string) =>
      u.split("?")[0].split(".").pop()?.toLowerCase() ||
      (type === "audio" ? "m4a" : "bin");

    const ext = getExt(uri);
    const fileName = `${Date.now()}.${ext}`;
    const filePath = `${chatId}/${fileName}`;

    let contentType = "application/octet-stream";
    if (type === "image") contentType = `image/${ext === "jpg" ? "jpeg" : ext}`;
    if (type === "video") contentType = `video/${ext}`;
    if (type === "audio")
      contentType = `audio/${ext === "m4a" ? "x-m4a" : ext}`;

    // 🔑 SUPABASE STORAGE UPLOAD ENDPOINT
    const supabaseUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/chat-attachments/${filePath}`;

    const { data: session } = await supabase.auth.getSession();
    const accessToken = session?.session?.access_token;

    if (!accessToken) {
      throw new Error("Not authenticated");
    }

    const result = await FileSystem.uploadAsync(supabaseUrl, uri, {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
    });

    if (result.status !== 200 && result.status !== 201) {
      console.error("Native upload failed", result);
      throw new Error("Upload failed");
    }

    const { data } = supabase.storage
      .from("chat-attachments")
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const downloadFile = async (url: string, fileName: string) => {
    try {
      const fileUri = FS.documentDirectory + fileName;
      const downloadResumable = FS.createDownloadResumable(url, fileUri);
      const result = await downloadResumable.downloadAsync();

      if (result) {
        if (Platform.OS === "android") {
          const permissions =
            await FS.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            const base64 = await FS.readAsStringAsync(result.uri, {
              encoding: "base64",
            });
            const createdFile = await FS.StorageAccessFramework.createFileAsync(
              permissions.directoryUri,
              fileName,
              "application/octet-stream",
            );
            await FS.writeAsStringAsync(createdFile, base64, {
              encoding: "base64",
            });
            Alert.alert("Success", "File saved!");
          } else {
            await Share.share({ url: result.uri });
          }
        } else {
          await Share.share({ url: result.uri, title: fileName });
        }
      }
    } catch (e) {
      Alert.alert("Error", "Failed to download file.");
    }
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setLoadingAudioId(null); // Clear loading indicator once loaded
      setPlaybackStatus({
        position: status.positionMillis,
        duration: status.durationMillis || 0,
        isPlaying: status.isPlaying,
      });

      if (status.didJustFinish) {
        setPlayingId(null);
        setPlaybackStatus({ position: 0, duration: 0, isPlaying: false });
      }
    }
  };

  const playSound = useCallback(
    async (messageId: string, uri: string) => {
      setLoadingAudioId(messageId);
      try {
        const currentSound = soundRef.current;
        const currentPlayingId = playingIdRef.current;
        const currentStatus = playbackStatusRef.current;

        if (currentPlayingId === messageId && currentSound) {
          if (currentStatus.isPlaying) {
            await currentSound.pauseAsync();
            setLoadingAudioId(null); // Clear loading indicator on pause
          } else {
            await currentSound.playAsync();
            setLoadingAudioId(null); // Clear loading indicator on play
          }
          return;
        }
        if (currentSound) await currentSound.unloadAsync();

        setPlayingId(messageId);
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
          onPlaybackStatusUpdate,
        );
        setSound(newSound);
      } catch (error) {
        Alert.alert("Error", "Could not play audio");
        setLoadingAudioId(null);
        setPlayingId(null);
      } // Add soundRef, playingIdRef, playbackStatusRef to dependencies
    },
    [soundRef, playingIdRef, playbackStatusRef],
  );

  const audioSkip = useCallback(async (deltaSeconds: number) => {
    try {
      const currentSound = soundRef.current;
      if (!currentSound) return;
      const status: any = await currentSound.getStatusAsync();
      if (!status.isLoaded) return;
      const newPos = Math.max(
        0,
        Math.min(
          status.durationMillis || 0,
          (status.positionMillis || 0) + deltaSeconds * 1000,
        ),
      );
      await currentSound.setPositionAsync(newPos);
      setPlaybackStatus((prev) => ({ ...prev, position: newPos }));
    } catch (e) {
      // ignore
    }
  }, []); // Stable callback

  // start a simulated progress for a temp id
  const startSimulatedProgress = (tempId: string) => {
    // ensure no existing timer
    if (uploadTimersRef.current[tempId]) return;
    setUploadProgress((prev) => ({ ...prev, [tempId]: 2 }));
    const id = setInterval(() => {
      setUploadProgress((prev) => {
        const curr = prev[tempId] ?? 0;
        if (curr >= 95) return prev; // stop simulated growth near completion
        const inc = Math.random() * 6 + 1; // 1-7%
        return { ...prev, [tempId]: Math.min(95, curr + inc) };
      });
    }, 800) as unknown as number;
    uploadTimersRef.current[tempId] = id;
  };

  const stopSimulatedProgress = (tempId: string) => {
    const t = uploadTimersRef.current[tempId];
    if (t) {
      clearInterval(t);
      delete uploadTimersRef.current[tempId];
    }
    setUploadProgress((prev) => ({ ...prev, [tempId]: 100 }));
    // remove progress after a short delay
    setTimeout(() => {
      setUploadProgress((prev) => {
        const copy = { ...prev };
        delete copy[tempId];
        return copy;
      });
    }, 1200);
  };

  const handleVideoStatus = (status: any, id: string) => {
    if (status.didJustFinish) {
      setPlayingVideoId(null);

      const video = videoRefs.current[id];
      if (video) {
        video.setPositionAsync(0); // rewind to start
      }
    }
  };

  const handlePickerResult = async (result: ImagePicker.ImagePickerResult) => {
    if (!result.canceled) {
      const asset = result.assets[0];
      const type = asset.type === "video" ? "video" : "image";

      // show chat-level preparing indicator immediately
      setIsPreparingFile(true);

      setSending(true);
      const processedUri = await validateAndProcessMedia(asset.uri, type);
      setSending(false);

      if (processedUri) {
        const info = await FS.getInfoAsync(processedUri);
        if (info.exists && checkFileSize(info.size, type)) {
          // handleMediaSend will clear the preparing indicator when upload actually starts
          handleMediaSend(processedUri, type);
        } else {
          // file invalid -> hide preparing
          setIsPreparingFile(false);
        }
      } else {
        // processing failed -> hide preparing
        setIsPreparingFile(false);
      }
    }
  };

  const pickMedia = async () => {
    Alert.alert(
      "Select Attachment",
      "Choose the type of file you want to send",
      [
        {
          text: "Image or Video",
          onPress: () => {
            Alert.alert("Select Source", "Choose source", [
              {
                text: "Camera",
                onPress: async () => {
                  const { status } =
                    await ImagePicker.requestCameraPermissionsAsync();
                  if (status !== "granted") {
                    Alert.alert(
                      "Permission Denied",
                      "Camera access is required.",
                    );
                    return;
                  }
                  Alert.alert("Camera Mode", "Photo or Video?", [
                    {
                      text: "Photo",
                      onPress: async () => {
                        const result = await ImagePicker.launchCameraAsync({
                          mediaTypes: ImagePicker.MediaTypeOptions.Images,
                          quality: 0.7,
                        });
                        handlePickerResult(result);
                      },
                    },
                    {
                      text: "Video",
                      onPress: async () => {
                        const result = await ImagePicker.launchCameraAsync({
                          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                          quality: 0.7,
                        });
                        handlePickerResult(result);
                      },
                    },
                    { text: "Cancel", style: "cancel" },
                  ]);
                },
              },
              {
                text: "Gallery",
                onPress: async () => {
                  const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.All,
                    quality: 0.7,
                  });
                  handlePickerResult(result);
                },
              },
              { text: "Cancel", style: "cancel" },
            ]);
          },
        },
        {
          text: "Audio File",
          onPress: async () => {
            const result = await DocumentPicker.getDocumentAsync({
              type: "audio/*",
              copyToCacheDirectory: true,
            });
            if (!result.canceled) {
              // support both legacy shape and new { assets: [...] } shape
              const r: any = result;
              const asset = r.assets && r.assets.length ? r.assets[0] : r;
              const uri = asset?.uri;
              const size = asset?.size ?? 0;
              const name = asset?.name ?? asset?.displayName ?? "Audio";
              if (!uri) {
                Alert.alert("Error", "Selected audio has no URI");
                return;
              }

              // show chat-level preparing indicator immediately
              setIsPreparingFile(true);

              setSending(true);
              const processedUri = await validateAndProcessMedia(uri, "audio");
              setSending(false);

              if (processedUri) {
                const info = await FS.getInfoAsync(processedUri);
                if (info.exists && checkFileSize(info.size, "audio")) {
                  handleMediaSend(processedUri, "audio", name);
                } else {
                  setIsPreparingFile(false);
                }
              } else {
                setIsPreparingFile(false);
              }
            }
          },
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      Alert.alert("Error", "Could not start recording");
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) {
        // handle missing URI gracefully
        Alert.alert("Recording failed", "No audio file was created");
        setRecording(null);
        return;
      }

      // show chat-level preparing indicator immediately
      setIsPreparingFile(true);

      setSending(true);
      const processedUri = await validateAndProcessMedia(uri, "audio");
      setSending(false);

      if (processedUri) {
        const info = await FS.getInfoAsync(processedUri);
        if (!info.exists) {
          Alert.alert(
            "Recording error",
            "Audio file not found after processing",
          );
          setRecording(null);
          setIsPreparingFile(false);
          return;
        }
        if (checkFileSize(info.size, "audio")) {
          handleMediaSend(processedUri, "audio", "Voice Note");
        } else {
          setIsPreparingFile(false);
        }
      } else {
        setIsPreparingFile(false);
      }
      setRecording(null);
    } catch (err) {
      console.error(err);
      setRecording(null);
      setIsPreparingFile(false);
    }
  };

  const handleMediaSend = async (
    uri: string,
    type: "image" | "video" | "audio",
    displayName?: string,
  ) => {
    if (!uri) {
      Alert.alert("Upload Error", "Missing file URI");
      setIsPreparingFile(false);
      return;
    }

    // Check if blocked before sending media
    if (isBlockedByThem) {
      Alert.alert('Cannot Send Media', 'You have been blocked by this user.');
      setIsPreparingFile(false);
      return;
    }

    // hide chat-level preparing indicator because actual upload (simulated progress) starts now
    setIsPreparingFile(false);

    setSending(true);

    const tempId = `temp-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const tempMsg = {
      id: tempId,
      chat_id: chatId,
      sender_id: currentUserId,
      content: displayName || `Sent a${type === 'image' ? 'n' : ''} ${type}`,
      file_url: uri,
      file_type: type,
      created_at: new Date().toISOString(),
      is_sending: true,
    };

    setMessages((prev) => [tempMsg, ...prev]);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });

    startSimulatedProgress(tempId);

    try {
      const fileUrl = await uploadFile(uri, type);

      stopSimulatedProgress(tempId);

      const payload: any = {
        chat_id: chatId,
        sender_id: currentUserId,
        content: displayName || `Sent a${type === 'image' ? 'n' : ''} ${type}`,
        file_url: fileUrl,
        file_type: type,
      };

      if (replyingTo) payload.parent_id = replyingTo.id;

      const { data, error } = await supabase
        .from("messages")
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      setMessages((prev) => {
        const exists = prev.some((m) => m.id === data.id);

        if (exists) {
          return prev.filter((m) => m.id !== tempId);
        }

        return prev.map((m) => (m.id === tempId ? data : m));
      });
    } catch (err) {
      stopSimulatedProgress(tempId);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));

      let message = "Upload failed";

      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === "string") {
        message = err;
      }

      console.error("handleMediaSend error", err);
      Alert.alert("Upload Error", message);
    } finally {
      setSending(false);
      setReplyingTo(null);
    }
  };

  const markMessagesAsRead = async (userId?: string) => {
    const uid = userId || currentUserId;
    if (!chatId || !uid) return;
    await supabase
      .from("messages")
      .update({ is_read: true, is_delivered: true })
      .eq("chat_id", chatId)
      .neq("sender_id", uid)
      .eq("is_read", false);
  };

  // Stable wrapper for download
  const handleDownloadFile = useCallback(
    (url: string, filename: string) => downloadFile(url, filename),
    [],
  );

  // NOTE: changed here so messages include reactions on initial fetch
  const fetchData = useCallback(
    async (showLoadingSpinner = false) => {
      if (showLoadingSpinner) setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
      if (!chatId) {
        setLoading(false);
        return;
      }

      try {
        // fetch messages with sender and reactions included, excluding deleted for current user
        const { data: msgs, error: msgsErr } = await supabase
          .from("messages")
          .select(
            `
          *,
          sender:users (*),
          reactions:reactions(*)
        `,
          )
          .eq("chat_id", chatId)
          .or(`deleted_for_self.is.null,deleted_for_self.eq.false,sender_id.neq.${user?.id || 'null'}`)
          .order("created_at", { ascending: false });

        if (msgsErr) throw msgsErr;
        setMessages(msgs || []);

        // fetch chat details
        const { data, error } = await supabase
          .from("chats")
          .select(
            `*, buyer:users!buyer_id(username, id), seller:users!seller_id(username, id), product:products(*)`,
          )
          .eq("id", chatId)
          .single();
        if (error) throw error;
        if (data) setChatDetails(data);

        if (user?.id) {
          markMessagesAsRead(user.id);
        } else {
          markMessagesAsRead();
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [chatId, currentUserId],
  );

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    if (!chatId || !currentUserId) return;

    // --- Realtime subscription for messages ---
    const messageChannel = supabase
      .channel(`chat_room_${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload) => {
          setMessages((prev) => {
            if (prev.find((m) => m.id === payload.new.id)) return prev;

            const tempIndex = prev.findIndex(
              (m) =>
                typeof m.id === "string" &&
                m.id.startsWith("temp-") &&
                m.sender_id === payload.new.sender_id &&
                m.content === payload.new.content,
            );

            if (tempIndex !== -1) {
              const copy = [...prev];
              copy[tempIndex] = payload.new;
              return copy;
            }

            return [payload.new, ...prev];
          });

          // If a new message arrives from the other user, mark it as read
          // since we are currently in the chat room.
          if (payload.new.sender_id !== currentUserId) {
            try {
              await markMessagesAsRead();
            } catch (e) {
              console.error("markMessagesAsRead error", e);
            }
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === payload.new.id ? payload.new : m)),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [chatId, currentUserId]);

  // --- Realtime subscription for presence (typing indicator) ---

  useEffect(() => {
    if (!chatId || !currentUserId || !chatDetails) return;

    const peerId =
      chatDetails.buyer_id === currentUserId
        ? chatDetails.seller_id
        : chatDetails.buyer_id;

    // 1. Fetch initial Last Seen from the database
    const fetchInitialLastSeen = async () => {
      const { data } = await supabase
        .from("users")
        .select("last_seen")
        .eq("id", peerId)
        .single();
      if (data?.last_seen) setPeerLastSeen(data.last_seen);
    };
    fetchInitialLastSeen();

    // 2. Set up Presence for real-time updates
    const presenceChannel = supabase.channel(`presence_${chatId}`);
    presenceChannelRef.current = presenceChannel;

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const peerSessions = state[peerId as string] as any[];

        if (peerSessions && peerSessions.length > 0) {
          setIsPeerOnline(true);
          setIsPeerTyping(peerSessions.some((p) => p.typing === true));

          // Update local lastSeen with the most recent session timestamp
          const latestSeen = peerSessions.reduce(
            (max, p) => (p.online_at > max ? p.online_at : max),
            peerSessions[0].online_at,
          );
          setPeerLastSeen(latestSeen);
        } else {
          setIsPeerOnline(false);
          setIsPeerTyping(false);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          try {
            await presenceChannel.track({
              online_at: new Date().toISOString(),
              typing: false,
            });
          } catch (e) {
            console.error("Presence track error:", e);
          }
        }
      });

    return () => {
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
      }
      presenceChannelRef.current = null;
    };
  }, [chatId, currentUserId, chatDetails]);

  const formatLastSeen = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.abs(now.getTime() - date.getTime()) / 36e5;

    if (diffInHours < 24 && date.getDate() === now.getDate()) {
      // Added hour12: true to force 12-hour format with AM/PM
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

  // --- Realtime subscription for reactions ---
  useEffect(() => {
    if (!chatId) return;

    // subscribe to reactions table changes (we keep no filter because reactions don't have chat_id),
    // but our handler will ignore reactions that don't belong to messages present in the current message list.

    const reactionChannel = supabase
      .channel(`reactions_for_chat_${chatId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reactions" },
        (payload: RealtimePostgresChangesPayload<Reaction>) => {
          setMessages((currentMessages) => {
            const newReaction =
              payload.new && "message_id" in payload.new
                ? (payload.new as Reaction)
                : null;

            const oldReaction =
              payload.old && "message_id" in payload.old
                ? (payload.old as Reaction)
                : null;

            const messageId =
              newReaction?.message_id || oldReaction?.message_id;

            if (
              !messageId ||
              !currentMessages.some((m) => m.id === messageId)
            ) {
              return currentMessages;
            }

            if (payload.eventType === "INSERT" && newReaction) {
              return currentMessages.map((m: Message) => {
                if (m.id === newReaction.message_id) {
                  if (
                    m.reactions?.some((r: Reaction) => r.id === newReaction.id)
                  )
                    return m;

                  return {
                    ...m,
                    reactions: [...(m.reactions || []), newReaction],
                  };
                }
                return m;
              });
            }

            if (payload.eventType === "DELETE" && oldReaction) {
              return currentMessages.map((m: Message) => {
                if (m.id === oldReaction.message_id) {
                  return {
                    ...m,
                    reactions:
                      m.reactions?.filter(
                        (r: Reaction) => r.id !== oldReaction.id,
                      ) || [],
                  };
                }
                return m;
              });
            }

            if (payload.eventType === "UPDATE" && newReaction) {
              return currentMessages.map((m: Message) => {
                if (m.id === newReaction.message_id) {
                  return {
                    ...m,
                    reactions: (m.reactions || []).map((r: Reaction) =>
                      r.id === newReaction.id ? newReaction : r,
                    ),
                  };
                }
                return m;
              });
            }

            return currentMessages;
          });
        },
      )
      .subscribe();

    reactionsChannelRef.current = reactionChannel;

    return () => {
      if (reactionsChannelRef.current)
        supabase.removeChannel(reactionsChannelRef.current);
      reactionsChannelRef.current = null;
    };
  }, [chatId]);

  const handleTyping = useCallback((text: string) => {
    setNewMessage(text);
    if (!presenceChannelRef.current) return;
    presenceChannelRef.current.track({
      online_at: new Date().toISOString(),
      typing: true,
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      presenceChannelRef.current?.track({
        online_at: new Date().toISOString(),
        typing: false,
      });
    }, 2000);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(false);
  }, [fetchData]);

  const handleActionMenu = useCallback((id: string | null) => {
    setActiveMenuId((prev) => (prev === id ? null : id));
    // Highlight message when menu opens
    if (id) {
      setHighlightedId(id);
    } else {
      setHighlightedId(null);
    }
  }, []);

  const startReply = useCallback((item: any) => {
    setSwipeHighlightedId(item.id); // Set swipe highlight for this message
    setReplyingTo(item);
    setReferencingTo(null);
    setEditingMessage(null);
    setActiveMenuId(null);
    setHighlightedId(null);
    inputRef.current?.focus();
  }, []);

  const startReference = useCallback((item: any) => {
    setSwipeHighlightedId(item.id); // Set swipe highlight for this message
    setReferencingTo(item);
    setReplyingTo(null);
    setEditingMessage(null);
    setActiveMenuId(null);
    setHighlightedId(null);
    inputRef.current?.focus();
  }, []);

  const startEdit = useCallback((item: any) => {
    setEditingMessage(item);
    setReplyingTo(null);
    setNewMessage(item.content);
    setActiveMenuId(null);
    inputRef.current?.focus();
  }, []);

  const handleReactionToggle = useCallback(
    async (message: Message, emoji: string) => {
      if (!currentUserId) return;

      const existingReaction: Reaction | undefined = message.reactions?.find(
        (r: Reaction) => r.user_id === currentUserId,
      );

      setActiveMenuId(null);

      if (existingReaction && existingReaction.emoji === emoji) {
        // 🗑️ TOGGLE OFF: Just delete
        setMessages((prev) =>
          prev.map((m) =>
            m.id === message.id
              ? {
                  ...m,
                  reactions: m.reactions?.filter(
                    (r: Reaction) => r.id !== existingReaction.id,
                  ),
                }
              : m,
          ),
        );

        const { error } = await supabase
          .from("reactions")
          .delete()
          .eq("id", existingReaction.id);
        if (error) {
          Alert.alert("Error", "Failed to remove reaction");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === message.id
                ? {
                    ...m,
                    reactions: [...(m.reactions || []), existingReaction],
                  }
                : m,
            ),
          );
        }
      } else {
        // ✨ REPLACE / INSERT: Do it in one smooth UI update
        const tempId = `temp-${Date.now()}`;
        const tempReaction: Reaction = {
          id: tempId,
          message_id: message.id,
          user_id: currentUserId,
          emoji,
          created_at: new Date().toISOString(),
        };

        // 1. Update UI immediately: Remove any old reaction by user AND add the new one
        setMessages((prev) =>
          prev.map((m) =>
            m.id === message.id
              ? {
                  ...m,
                  reactions: [
                    ...(m.reactions || []).filter(
                      (r: Reaction) => r.user_id !== currentUserId,
                    ),
                    tempReaction,
                  ],
                }
              : m,
          ),
        );

        // 2. Fire the database changes.
        // If replacing, delete the old one, but don't 'await' it before starting the insert.
        if (existingReaction) {
          supabase
            .from("reactions")
            .delete()
            .eq("id", existingReaction.id)
            .then();
        }

        const { data, error } = await supabase
          .from("reactions")
          .insert({
            message_id: message.id,
            user_id: currentUserId,
            emoji: emoji,
          })
          .select()
          .single();

        if (error) {
          Alert.alert("Error", "Failed to add reaction.");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === message.id
                ? {
                    ...m,
                    reactions: (m.reactions || []).filter(
                      (r: Reaction) => r.id !== tempId,
                    ),
                  }
                : m,
            ),
          );
        } else if (data) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === message.id
                ? {
                    ...m,
                    reactions: (m.reactions || []).map((r: Reaction) =>
                      r.id === tempId ? data : r,
                    ),
                  }
                : m,
            ),
          );
        }
      }
    },
    [currentUserId],
  );

  const confirmDelete = useCallback(
    (msgId: string) => {
      const message = messages.find(m => m.id === msgId);
      if (!message) return;
      
      const messageAge = new Date().getTime() - new Date(message.created_at).getTime();
      const oneHourInMs = 60 * 60 * 1000; // 1 hour in milliseconds
      const canDeleteForEveryone = messageAge < oneHourInMs;
      
      if (canDeleteForEveryone) {
        Alert.alert("Delete Message", "Choose delete option:", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete for Everyone",
            style: "destructive",
            onPress: () => deleteMessage(msgId, true),
          },
          {
            text: "Delete for Me",
            onPress: () => deleteMessage(msgId, false),
          },
        ]);
      } else {
        Alert.alert("Delete Message", "You can only delete this message for yourself (sent more than 1 hour ago).", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete for Me",
            style: "destructive",
            onPress: () => deleteMessage(msgId, false),
          },
        ]);
      }
    },
    [messages],
  );

  // Multiple selection functions
  const startSelectionMode = useCallback(async () => {
    setIsSelectionMode(true);
    setSelectedMessages(new Set());
    setOptionsModalVisible(false);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedMessages(new Set());
    setIsTogglingSelection(false); // Clear any ongoing toggle state
  }, []);

  const toggleMessageSelection = useCallback((messageId: string) => {
    // Handle special case for starting selection mode
    if (messageId.startsWith('START_SELECTION:')) {
      const actualId = messageId.replace('START_SELECTION:', '');
      setIsSelectionMode(true);
      setSelectedMessages(new Set([actualId]));
      return;
    }
    
    // Normal selection toggle
    if (!isSelectionMode) return;
    
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  }, [isSelectionMode]);

  const selectAllMessages = useCallback(() => {
    const allMessageIds = messages.map(msg => msg.id);
    
    setIsTogglingSelection(true);
    
    // Use requestAnimationFrame to ensure the spinner shows
    requestAnimationFrame(() => {
      if (selectedMessages.size === messages.length) {
        // If all are selected, unselect all
        setSelectedMessages(new Set());
      } else {
        // If not all are selected, select all
        setSelectedMessages(new Set(allMessageIds));
      }
      
      setTimeout(() => setIsTogglingSelection(false), 300);
    });
  }, [messages, selectedMessages]);

  const deleteSelectedMessages = useCallback(() => {
    if (selectedMessages.size === 0) return;
    
    Alert.alert(
      "Delete Messages", 
      `Delete ${selectedMessages.size} message${selectedMessages.size > 1 ? 's' : ''}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete for Everyone",
          style: "destructive",
          onPress: async () => {
            const messagesToDelete = Array.from(selectedMessages);
            
            // Mark messages as deleted for everyone in UI
            setMessages(prev => prev.map(msg => 
              selectedMessages.has(msg.id) 
                ? { ...msg, content: 'Message deleted', deleted_for_everyone: true, deleted_at: new Date().toISOString() }
                : msg
            ));
            
            exitSelectionMode();
            
            try {
              // Update database to mark as deleted for everyone
              for (const messageId of messagesToDelete) {
                await supabase
                  .from('messages')
                  .update({ 
                    content: 'Message deleted', 
                    deleted_for_everyone: true,
                    deleted_at: new Date().toISOString()
                  })
                  .eq('id', messageId);
              }
            } catch (err) {
              console.error('Error deleting messages:', err);
              fetchData(false); // Refresh on error
            }
          },
        },
        {
          text: "Delete for Me",
          onPress: async () => {
            const messagesToDelete = Array.from(selectedMessages);
            
            // Hide messages for current user only
            setMessages(prev => prev.filter(msg => !selectedMessages.has(msg.id)));
            
            exitSelectionMode();
            
            try {
              // Update database to mark as deleted for current user
              for (const messageId of messagesToDelete) {
                await supabase
                  .from('messages')
                  .update({ 
                    deleted_for_self: true,
                    deleted_at: new Date().toISOString()
                  })
                  .eq('id', messageId)
                  .eq('sender_id', currentUserId);
              }
            } catch (err) {
              console.error('Error deleting messages:', err);
              fetchData(false); // Refresh on error
            }
          },
        },
      ]
    );
  }, [selectedMessages, exitSelectionMode, fetchData, currentUserId]);

  const deleteMessage = async (msgId: string, forEveryone: boolean = false) => {
    const originalMessages = [...messages];
    
    if (forEveryone) {
      // Check if message is already marked as deleted for everyone
      const message = messages.find(m => m.id === msgId);
      if (message?.deleted_for_everyone) {
        // If already deleted for everyone, remove it completely
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
      } else {
        // Mark as deleted for everyone
        setMessages((prev) => prev.map(m => 
          m.id === msgId 
            ? { ...m, content: 'Message deleted', deleted_for_everyone: true, deleted_at: new Date().toISOString() }
            : m
        ));
      }
    } else {
      // Hide for current user only
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    }
    
    setActiveMenuId(null);

    try {
      const message = originalMessages.find(m => m.id === msgId);
      
      if (forEveryone) {
        if (message?.deleted_for_everyone) {
          // Actually delete the message from database if it was already marked as deleted
          const { error } = await supabase
            .from("messages")
            .delete()
            .eq("id", msgId);
          if (error) throw error;
        } else {
          // Mark as deleted for everyone
          const { error } = await supabase
            .from("messages")
            .update({ 
              content: 'Message deleted', 
              deleted_for_everyone: true,
              deleted_at: new Date().toISOString()
            })
            .eq("id", msgId);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase
          .from("messages")
          .update({ 
            deleted_for_self: true,
            deleted_at: new Date().toISOString()
          })
          .eq("id", msgId)
          .eq("sender_id", currentUserId);
        if (error) throw error;
      }
    } catch (err) {
      setMessages(originalMessages);
      Alert.alert("Error", "Could not delete message");
    }
  };

  const handleReplyPress = useCallback((parentId: string) => {
    const index = messagesRef.current.findIndex((m) => m.id === parentId);
    if (index !== -1) {
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      setHighlightedId(parentId);
    }
  }, []);

  async function handleSend() {
    if (!newMessage.trim() || sendingText || !currentUserId) return;
    
    // Check if blocked before sending
    if (isBlockedByThem) {
      Alert.alert('Cannot Send Message', 'You have been blocked by this user.');
      return;
    }
    
    const text = newMessage.trim();
    setSendingText(true);

    if (editingMessage) {
      const originalMsg = editingMessage.content;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === editingMessage.id
            ? { ...m, content: text, is_edited: true }
            : m,
        ),
      );

      try {
        const { error } = await supabase
          .from("messages")
          .update({ content: text, is_edited: true })
          .eq("id", editingMessage.id);
        if (error) throw error;
        setEditingMessage(null);
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === editingMessage.id
              ? {
                  ...m,
                  content: originalMsg,
                  is_edited: editingMessage.is_edited,
                }
              : m,
          ),
        );
        Alert.alert("Error", "Failed to update message");
      } finally {
        setSendingText(false);
        setNewMessage("");
        setShowEmojiPicker(false);
      }
    } else {
      // 1. Create temporary message (text): do NOT mark is_sending nor startSimulatedProgress
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const tempMsg = {
        id: tempId,
        chat_id: chatId,
        sender_id: currentUserId,
        content: text,
        created_at: new Date().toISOString(),
        parent_id: replyingTo?.id || referencingTo?.id,
      };

      setMessages((prev) => [tempMsg, ...prev]);
      setNewMessage("");
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      setShowEmojiPicker(false);

      const replyRef = replyingTo;
      const referenceRef = referencingTo;
      setReplyingTo(null);
      setReferencingTo(null);

      try {
        const payload: any = {
          chat_id: chatId,
          sender_id: currentUserId,
          content: text,
        };
        if (replyRef) payload.parent_id = replyRef.id;
        if (referenceRef) payload.parent_id = referenceRef.id;

        const { data, error } = await supabase
          .from("messages")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;

        // Replace temp message with real one, avoiding duplication if realtime already added it
        setMessages((prev) => {
          // If realtime already added the real message (by ID), remove the temp and keep realtime message
          const exists = prev.some((m) => m.id === data.id);
          if (exists) {
            return prev.filter((m) => m.id !== tempId);
          }
          // otherwise replace temp with server data
          return prev.map((m) => (m.id === tempId ? data : m));
        });

        // Clear typing status
        if (presenceChannelRef.current) {
          presenceChannelRef.current.track({
            online_at: new Date().toISOString(),
            typing: false,
          });
        }
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        Alert.alert("Error", "Failed to send message");
      } finally {
        setSendingText(false);
        setShowEmojiPicker(false);
      }
    }
  }

  // Search Messages Function
  const handleSearchMessages = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchQuery('');
      return;
    }

    setIsSearching(true);
    setSearchQuery(query);

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
      // Fallback to simple text search
      const filtered = messages.filter(msg => 
        msg.content && msg.content.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(filtered);
    } finally {
      setIsSearching(false);
    }
  };

  // Block User Function
  const handleBlockUser = async () => {
    if (!currentUserId || !chatDetails) return;
    
    const otherUserId = chatDetails.buyer_id === currentUserId 
      ? chatDetails.seller_id 
      : chatDetails.buyer_id;

    try {
      await supabase
        .from('blocked_users')
        .insert({
          blocker_id: currentUserId,
          blocked_id: otherUserId,
        });
      
      setIsUserBlocked(true);
      setOptionsModalVisible(false);
      Alert.alert('Success', 'User blocked successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to block user');
      throw error; // Re-throw to show loading state properly
    }
  };

  // Unblock User Function
  const handleUnblockUser = async () => {
    if (!currentUserId || !chatDetails) return;
    
    const otherUserId = chatDetails.buyer_id === currentUserId 
      ? chatDetails.seller_id 
      : chatDetails.buyer_id;

    try {
      await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', currentUserId)
        .eq('blocked_id', otherUserId);
      
      setIsUserBlocked(false);
      setOptionsModalVisible(false);
      Alert.alert('Success', 'User unblocked successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to unblock user');
      throw error; // Re-throw to show loading state properly
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  // --- UPDATED: choose header title based on chat type ---
  const isDirectChat = chatDetails?.type === "direct";
  const peerName = isDirectChat
    ? ((currentUserId === chatDetails?.buyer_id
        ? chatDetails?.seller?.username
        : chatDetails?.buyer?.username) ?? "Chat")
    : `${chatDetails?.product?.title ?? "Product"} • @${((currentUserId === chatDetails?.buyer_id
        ? chatDetails?.seller?.username
        : chatDetails?.buyer?.username) ?? "User")}`;
  // --- end addition ---

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ImageZoomModal
        imageUri={selectedImage}
        onClose={() => setSelectedImage(null)}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 80}
      >
        <Pressable
          style={styles.flex}
          onPress={() => { setActiveMenuId(null); setHighlightedId(null); }}
          disabled={!activeMenuId && !highlightedId}
        >
          <ChatHeader
            onBack={() => {
              const source = params.source;

              if (source === "trading") {
                router.navigate("/chat-list");
              } else if (source === "personal") {
                router.navigate("/chatroom");
              } else {
                router.canGoBack()
                  ? router.back()
                  : router.navigate("/chat-list");
              }
            }}
            peerName={peerName}
            isPeerOnline={isPeerOnline}
            isPeerTyping={isPeerTyping}
            peerLastSeen={peerLastSeen}
            onOptionsPress={() => setOptionsModalVisible(true)}
          />

          {/* Chat-level preparing indicator (shows immediately after capture/selection/recording) */}
          <PreparingFileOverlay visible={isPreparingFile} />

          {/* Search Results Header */}
          {searchResults.length > 0 && (
            <View style={[styles.searchHeader, { backgroundColor: colors.surface }]}>
              <Text style={[styles.searchHeaderText, { color: colors.text }]}>
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
              </Text>
              <TouchableOpacity 
                onPress={() => {
                  setSearchResults([]);
                  setSearchQuery('');
                }}
                style={styles.clearSearchButton}
              >
                <Ionicons name="close" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          <FlatList
            ref={flatListRef}
            data={isSearching ? [] : searchResults.length > 0 ? searchResults : messages}
            renderItem={({ item, index }) => {
              const currentMsgDate = new Date(item.created_at).toDateString();
              const dataSource = searchResults.length > 0 ? searchResults : messages;
              const nextMsg = dataSource[index + 1];
              const nextMsgDate = nextMsg
                ? new Date(nextMsg.created_at).toDateString()
                : null;
              const showDateHeader = currentMsgDate !== nextMsgDate;

              const repliedMessage = item.parent_id
                ? messageMap.get(item.parent_id)
                : null;

              return (
                <MessageItem
                  item={item}
                  currentUserId={currentUserId}
                  replyContent={repliedMessage?.content || null}
                  showDateHeader={showDateHeader}
                  activeMenuId={activeMenuId}
                  playingId={playingId}
                  playbackPosition={playbackStatus.position}
                  playbackDuration={playbackStatus.duration}
                  isPlaybackPlaying={playbackStatus.isPlaying}
                  uploadProgress={uploadProgress}
                  playingVideoId={playingVideoId}
                  videoRefs={videoRefs}
                  loadingAudioId={loadingAudioId}
                  onActionMenu={handleActionMenu}
                  onSetSelectedImage={setSelectedImage}
                  onSetPlayingVideoId={setPlayingVideoId}
                  onPlaySound={playSound}
                  onAudioSkip={audioSkip}
                  onReactionToggle={handleReactionToggle}
                  onStartReply={startReply}
                  onStartReference={startReference}
                  onStartEdit={startEdit}
                  onDownloadFile={handleDownloadFile}
                  onConfirmDelete={confirmDelete}
                  highlightedId={highlightedId}
                  onReplyPress={handleReplyPress}
                  searchQuery={searchResults.length > 0 ? searchQuery : ''}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedMessages.has(item.id)}
                  onToggleSelection={toggleMessageSelection}
                  setIsSelectionMode={setIsSelectionMode}
                  setSelectedMessages={setSelectedMessages}
                  replyingTo={replyingTo}
                  referencingTo={referencingTo}
                  swipeHighlightedId={swipeHighlightedId}
                />
              );
            }}
            keyExtractor={(i) => String(i.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            extraData={{
              activeMenuId,
              highlightedId,
              swipeHighlightedId,
              isSelectionMode,
              selectedCount: selectedMessages.size
            }}
            inverted
            CellRendererComponent={CellRenderer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#2255ee"]}
                tintColor="#2255ee"
              />
            }
            onScrollToIndexFailed={(info) => {
              flatListRef.current?.scrollToOffset({
                offset: info.averageItemLength * info.index,
                animated: true,
              });
            }}
          />

          {/* Selection Action Bar */}
          {isSelectionMode && (
            <View style={[styles.selectionBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
              <View style={styles.selectionInfo}>
                <Text style={[styles.selectionText, { color: colors.text }]}>
                  {selectedMessages.size} selected
                </Text>
              </View>
              <View style={styles.selectionActions}>
                <TouchableOpacity onPress={selectAllMessages} style={styles.actionButton} disabled={isTogglingSelection}>
                  {isTogglingSelection ? (
                    <View style={styles.spinnerContainer}>
                      <ActivityIndicator size={12} color={colors.primary} />
                      <Text style={[styles.actionButtonText, { color: colors.primary, marginLeft: 6 }]}>
                        {selectedMessages.size === messages.length ? 'Unselecting...' : 'Selecting...'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.actionButtonText, { color: colors.primary }]}>
                      {selectedMessages.size === messages.length ? 'Unselect All' : 'Select All'}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={deleteSelectedMessages} 
                  style={[styles.actionButton, { opacity: selectedMessages.size > 0 ? 1 : 0.5 }]}
                  disabled={selectedMessages.size === 0}
                >
                  <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={exitSelectionMode} style={styles.actionButton}>
                  <Text style={[styles.actionButtonText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <ChatInputBar
            inputRef={inputRef as React.RefObject<TextInput>}
            newMessage={newMessage}
            isRecording={isRecording}
            sendingText={sendingText}
            showEmojiPicker={showEmojiPicker}
            editingMessage={editingMessage}
            replyingTo={replyingTo}
            referencingTo={referencingTo}
            onTyping={handleTyping}
            onSend={handleSend}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onPickMedia={pickMedia}
            onToggleEmojiPicker={() => setShowEmojiPicker(!showEmojiPicker)}
            onCancelReplyEdit={() => {
              setEditingMessage(null);
              setReplyingTo(null);
              setReferencingTo(null);
              setNewMessage("");
              // Clear both regular and swipe highlights when cancelling
              setHighlightedId(null);
              setSwipeHighlightedId(null);
            }}
          />
        </Pressable>
      </KeyboardAvoidingView>

      {/* Chat Options Modal */}
      <ChatOptionsModal
        visible={optionsModalVisible}
        onClose={() => setOptionsModalVisible(false)}
        chatId={chatId}
        otherUserId={chatDetails?.buyer_id === currentUserId ? chatDetails?.seller_id || null : chatDetails?.buyer_id || null}
        otherUserName={peerName}
        currentUserId={currentUserId}
        onSearchMessages={handleSearchMessages}
        onBlockUser={handleBlockUser}
        onUnblockUser={handleUnblockUser}
        onSelectMessages={startSelectionMode}
        isUserBlocked={isUserBlocked}
        onChatDeleted={() => {
          // Stay in chat and refresh to show empty state
          fetchData(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { padding: 16, paddingBottom: 20 },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchHeaderText: {
    fontSize: 14,
    fontWeight: '500',
  },
  clearSearchButton: {
    padding: 4,
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  selectionInfo: {
    flex: 1,
  },
  selectionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 8,
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loadingMoreText: {
    fontSize: 14,
    marginLeft: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  spinnerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
