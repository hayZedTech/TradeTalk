import {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { useAudioRecorder, useAudioRecorderState, AudioModule, RecordingPresets, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from '@react-navigation/native';
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
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
import { AudioMessageBubble } from "../../../components/chat/AudioMessageBubble";
import { VideoMessageBubble } from "../../../components/chat/VideoMessageBubble";
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

  // Consolidated UI state
  const [uiState, setUiState] = useState({
    isSelectionMode: false,
    selectedMessages: new Set<string>(),
    isTogglingSelection: false,
    isBlockedByThem: false,
    optionsModalVisible: false,
    isUserBlocked: false,
    searchResults: [] as any[],
    isSearching: false,
    searchQuery: '',
    isPreparingFile: false,
    selectedImage: null as string | null,
    isRecording: false,
    audioReady: false,
  });

  // Presence State (separate for performance)
  const [presenceState, setPresenceState] = useState({
    isPeerOnline: false,
    isPeerTyping: false,
    peerLastSeen: null as string | null,
  });

  // Theme
  const { colors } = useTheme();

  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [setIsPeerOnline] = useState(() => (value: boolean) => setPresenceState(prev => ({ ...prev, isPeerOnline: value })));
  const [setIsPeerTyping] = useState(() => (value: boolean) => setPresenceState(prev => ({ ...prev, isPeerTyping: value })));
  const [setPeerLastSeen] = useState(() => (value: string | null) => setPresenceState(prev => ({ ...prev, peerLastSeen: value })));
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  // Setup audio recording permissions and mode (optimized)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const permission = await AudioModule.requestRecordingPermissionsAsync();

        if (!permission.granted || !mounted) {
          if (mounted) Alert.alert("Microphone permission is required.");
          return;
        }

        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        });

        if (mounted) {
          setUiState(prev => ({ ...prev, audioReady: true }));
        }
      } catch (error) {
        console.log(error);
        if (mounted) Alert.alert("Audio setup failed");
      }
    })();
    return () => { mounted = false; };
  }, []);



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

  useEffect(() => {
    return () => {
      Object.values(videoRefs.current).forEach(video => {
        if (video && video.pauseAsync) {
          video.pauseAsync().catch(() => {});
        }
      });
    };
  }, []);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Check if user is blocked on component mount and when sending messages
  useEffect(() => {
    checkBlockStatus();
  }, [chatDetails]);

  // Refresh block status when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      checkBlockStatus();
    }, [chatDetails, currentUserId])
  );

  // Optimized block status check
  const checkBlockStatus = useCallback(async () => {
    if (!currentUserId || !chatDetails) return;
    
    const otherUserId = chatDetails.buyer_id === currentUserId 
      ? chatDetails.seller_id 
      : chatDetails.buyer_id;

    try {
      const [blockedByMe, blockedByThem] = await Promise.all([
        supabase
          .from('blocked_users')
          .select('id')
          .eq('blocker_id', currentUserId)
          .eq('blocked_id', otherUserId)
          .single(),
        supabase
          .from('blocked_users')
          .select('id')
          .eq('blocker_id', otherUserId)
          .eq('blocked_id', currentUserId)
          .single()
      ]);
      
      setUiState(prev => ({
        ...prev,
        isUserBlocked: !!blockedByMe.data,
        isBlockedByThem: !!blockedByThem.data
      }));
    } catch (error) {
      setUiState(prev => ({ ...prev, isUserBlocked: false, isBlockedByThem: false }));
    }
  }, [currentUserId, chatDetails]);

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

  const handleVideoStatus = useCallback((status: any, id: string) => {
    if (status.didJustFinish) {
      setPlayingVideoId(null);
      const video = videoRefs.current[id];
      if (video) {
        video.setPositionAsync(0);
      }
    }
  }, []);

  const handlePickerResult = async (result: ImagePicker.ImagePickerResult) => {
    if (!result.canceled) {
      const asset = result.assets[0];
      const type = asset.type === "video" ? "video" : "image";

      if (type === "video") {
        // Use dedicated video upload logic
        const videoUri = asset.uri;
        
        setUiState(prev => ({ ...prev, isPreparingFile: true }));
        setSending(true);
        
        // Add progress tracking for video compression
        const processedUri = await validateAndProcessMedia(videoUri, "video", (progress: number) => {
          console.log('Video compression progress:', Math.round(progress * 100) + '%');
        });
        setSending(false);
        
        if (!processedUri) {
          setUiState(prev => ({ ...prev, isPreparingFile: false }));
          return;
        }

        const info = await FS.getInfoAsync(processedUri);
        if (!info.exists || !checkFileSize(info.size, "video")) {
          setUiState(prev => ({ ...prev, isPreparingFile: false }));
          return;
        }

        setUiState(prev => ({ ...prev, isPreparingFile: false }));

        // Create temporary video message
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const tempMessage = {
          id: tempId,
          chat_id: chatId,
          sender_id: currentUserId,
          content: "Sent a video",
          file_url: processedUri,
          file_type: "video",
          created_at: new Date().toISOString(),
          is_sending: true,
        };

        setMessages(prev => [tempMessage, ...prev]);
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        startSimulatedProgress(tempId);

        try {
          const fileUrl = await uploadFile(processedUri, "video");
          stopSimulatedProgress(tempId);

          const payload: any = {
            chat_id: chatId,
            sender_id: currentUserId,
            content: "Sent a video",
            file_url: fileUrl,
            file_type: "video",
          };

          if (replyingTo) payload.parent_id = replyingTo.id;

          const { data, error } = await supabase
            .from("messages")
            .insert([payload])
            .select()
            .single();

          if (error) throw error;

          setMessages(prev => {
            const exists = prev.some(m => m.id === data.id);
            if (exists) {
              return prev.filter(m => m.id !== tempId);
            }
            return prev.map(m => m.id === tempId ? data : m);
          });

        } catch (err) {
          stopSimulatedProgress(tempId);
          setMessages(prev => prev.filter(m => m.id !== tempId));
          
          let message = "Video upload failed";
          if (err instanceof Error) {
            message = err.message;
          }
          
          console.error("Video upload error:", err);
          Alert.alert("Upload Error", message);
        } finally {
          setReplyingTo(null);
        }
      } else {
        // Handle image upload (existing logic)
        setUiState(prev => ({ ...prev, isPreparingFile: true }));
        setSending(true);
        
        const startTime = Date.now();
        const processedUri = await validateAndProcessMedia(asset.uri, type);
        const processingTime = Date.now() - startTime;
        
        if (processingTime < 1000) {
          await new Promise(resolve => setTimeout(resolve, 1000 - processingTime));
        }
        
        setSending(false);

        if (processedUri) {
          const info = await FS.getInfoAsync(processedUri);
          if (info.exists && checkFileSize(info.size, type)) {
            handleMediaSend(processedUri, type);
          } else {
            setUiState(prev => ({ ...prev, isPreparingFile: false }));
          }
        } else {
          setUiState(prev => ({ ...prev, isPreparingFile: false }));
        }
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
              setUiState(prev => ({ ...prev, isPreparingFile: true }));

              setSending(true);
              const processedUri = await validateAndProcessMedia(uri, "audio");
              setSending(false);

              if (processedUri) {
                const info = await FS.getInfoAsync(processedUri);
                if (info.exists && checkFileSize(info.size, "audio")) {
                  handleMediaSend(processedUri, "audio", name);
                } else {
                  setUiState(prev => ({ ...prev, isPreparingFile: false }));
                }
              } else {
                setUiState(prev => ({ ...prev, isPreparingFile: false }));
              }
            }
          },
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  const startRecording = useCallback(async () => {
    if (!uiState.audioReady) {
      Alert.alert('Audio not ready', 'Please wait for audio setup to complete.');
      return;
    }

    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      setUiState(prev => ({ ...prev, isRecording: true }));
    } catch (error) {
      console.log(error);
      Alert.alert("Could not start recording");
    }
  }, [uiState.audioReady, recorder]);

  const stopRecording = useCallback(async () => {
    try {
      await recorder.stop();
      setUiState(prev => ({ ...prev, isRecording: false }));
      
      const uri = recorder.uri;
      if (uri) {
        setRecordingUri(uri);
        console.log("Saved file URI:", uri);
        
        // Check if file exists and send it
        const info = await FS.getInfoAsync(uri);
        if (info.exists && info.size > 0) {
          if (checkFileSize(info.size, 'audio')) {
            setUiState(prev => ({ ...prev, isPreparingFile: true }));
            handleMediaSend(uri, 'audio', 'Voice message');
          } else {
            setUiState(prev => ({ ...prev, isPreparingFile: false }));
          }
        } else {
          Alert.alert('Recording Error', 'Recording file is empty or not found.');
        }
      } else {
        Alert.alert('Recording Error', 'No recording file was created.');
      }
    } catch (error) {
      console.log(error);
      Alert.alert("Could not stop recording");
      setUiState(prev => ({ ...prev, isRecording: false }));
    }
  }, [recorder]);

  const handleMediaSend = async (
    uri: string,
    type: "image" | "video" | "audio",
    displayName?: string,
  ) => {
    if (!uri) {
      Alert.alert("Upload Error", "Missing file URI");
      setUiState(prev => ({ ...prev, isPreparingFile: false }));
      return;
    }

    if (!currentUserId) {
      Alert.alert("Authentication Error", "User not authenticated");
      setUiState(prev => ({ ...prev, isPreparingFile: false }));
      return;
    }

    // Check if blocked before sending media
    if (uiState.isBlockedByThem) {
      Alert.alert('Cannot Send Media', 'You have been blocked by this user.');
      setUiState(prev => ({ ...prev, isPreparingFile: false }));
      return;
    }

    // hide chat-level preparing indicator because actual upload (simulated progress) starts now
    setUiState(prev => ({ ...prev, isPreparingFile: false }));

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
            prev.map((m) => (m.id === payload.new.id ? { ...payload.new, reactions: m.reactions } : m)),
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

    // 1. Fetch initial online status and Last Seen from the database
    const fetchInitialStatus = async () => {
      const { data } = await supabase
        .from("users")
        .select("last_seen, is_online")
        .eq("id", peerId)
        .single();
      if (data) {
        setPresenceState(prev => ({ ...prev, isPeerOnline: data.is_online || false }));
        if (data.last_seen) setPresenceState(prev => ({ ...prev, peerLastSeen: data.last_seen }));
      }
    };
    fetchInitialStatus();

    // 2. Set up Presence for typing indicators only
    const presenceChannel = supabase.channel(`presence_${chatId}`, {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });
    presenceChannelRef.current = presenceChannel;

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        
        const peerSessions = state[peerId as string] as any[];

        // Only update typing status, not online status
        const isTyping = peerSessions && peerSessions.length > 0 && peerSessions.some((p) => p.typing === true);
        setPresenceState(prev => ({ ...prev, isPeerTyping: isTyping }));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          try {
            await presenceChannel.track({
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
    
    // Get start of today and yesterday for accurate date comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    // If it's today, show time
    if (messageDate.getTime() === today.getTime()) {
      return `at ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })}`;
    }
    // If it's yesterday, show "Yesterday"
    else if (messageDate.getTime() === yesterday.getTime()) {
      return "Yesterday";
    }
    // Otherwise show the date
    else {
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

  // Optimized typing handler
  const handleTyping = useCallback((text: string) => {
    setNewMessage(text);
    if (!presenceChannelRef.current) return;
    
    const isTyping = text.trim().length > 0;
    
    // Debounce presence updates
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    presenceChannelRef.current.track({ typing: isTyping });

    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        if (presenceChannelRef.current) {
          presenceChannelRef.current.track({ typing: false });
        }
      }, 2000);
    }
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
    setUiState(prev => ({ ...prev, isSelectionMode: true, selectedMessages: new Set(), optionsModalVisible: false }));
  }, []);

  const exitSelectionMode = useCallback(() => {
    setUiState(prev => ({ ...prev, isSelectionMode: false, selectedMessages: new Set(), isTogglingSelection: false }));
  }, []);

  const toggleMessageSelection = useCallback((messageId: string) => {
    if (messageId.startsWith('START_SELECTION:')) {
      const actualId = messageId.replace('START_SELECTION:', '');
      setUiState(prev => ({ ...prev, isSelectionMode: true, selectedMessages: new Set([actualId]) }));
      return;
    }
    
    if (!uiState.isSelectionMode) return;
    
    setUiState(prev => {
      const newSet = new Set(prev.selectedMessages);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return { ...prev, selectedMessages: newSet };
    });
  }, [uiState.isSelectionMode]);

  const selectAllMessages = useCallback(() => {
    const allMessageIds = messages.map(msg => msg.id);
    
    setUiState(prev => ({ ...prev, isTogglingSelection: true }));
    
    requestAnimationFrame(() => {
      setUiState(prev => {
        const newSelectedMessages = prev.selectedMessages.size === messages.length 
          ? new Set<string>() 
          : new Set(allMessageIds);
        return { ...prev, selectedMessages: newSelectedMessages };
      });
      
      setTimeout(() => setUiState(prev => ({ ...prev, isTogglingSelection: false })), 300);
    });
  }, [messages]);

  const deleteSelectedMessages = useCallback(() => {
    if (uiState.selectedMessages.size === 0) return;
    
    Alert.alert(
      "Delete Messages", 
      `Delete ${uiState.selectedMessages.size} message${uiState.selectedMessages.size > 1 ? 's' : ''}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete for Everyone",
          style: "destructive",
          onPress: async () => {
            const messagesToDelete = Array.from(uiState.selectedMessages);
            
            setMessages(prev => prev.map(msg => 
              uiState.selectedMessages.has(msg.id) 
                ? { ...msg, content: 'Message deleted', deleted_for_everyone: true, deleted_at: new Date().toISOString() }
                : msg
            ));
            
            exitSelectionMode();
            
            try {
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
              fetchData(false);
            }
          },
        },
        {
          text: "Delete for Me",
          onPress: async () => {
            const messagesToDelete = Array.from(uiState.selectedMessages);
            
            setMessages(prev => prev.filter(msg => !uiState.selectedMessages.has(msg.id)));
            
            exitSelectionMode();
            
            try {
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
              fetchData(false);
            }
          },
        },
      ]
    );
  }, [uiState.selectedMessages, exitSelectionMode, fetchData, currentUserId]);

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
  if (uiState.isBlockedByThem) {
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
    } catch (err: any) {
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
    // 1. Create temporary message (text)
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

      // Replace temp message with real one
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === data.id);

        if (exists) {
          return prev.filter((m) => m.id !== tempId);
        }

        return prev.map((m) => (m.id === tempId ? data : m));
      });

      // Clear typing status
      if (presenceChannelRef.current) {
        presenceChannelRef.current.track({
          typing: false,
        });
      }
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));

      let errorMessage = "Failed to send message";

      if (err?.message) {
        errorMessage = err.message;
      } else if (err?.details) {
        errorMessage = err.details;
      }

      Alert.alert("Error", errorMessage);
    } finally {
      setSendingText(false);
      setShowEmojiPicker(false);
    }
  }
}


  // Search Messages Function
  const handleSearchMessages = useCallback(async (query: string) => {
    if (!query.trim()) {
      setUiState(prev => ({ ...prev, searchResults: [], isSearching: false, searchQuery: '' }));
      return;
    }

    setUiState(prev => ({ ...prev, isSearching: true, searchQuery: query }));

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUiState(prev => ({ ...prev, searchResults: data || [] }));
    } catch (error) {
      console.error('Search error:', error);
      const filtered = messages.filter(msg => 
        msg.content && msg.content.toLowerCase().includes(query.toLowerCase())
      );
      setUiState(prev => ({ ...prev, searchResults: filtered }));
    } finally {
      setUiState(prev => ({ ...prev, isSearching: false }));
    }
  }, [chatId, messages]);

  // Block User Function
  const handleBlockUser = useCallback(async () => {
    if (!currentUserId || !chatDetails) return;
    
    const otherUserId = chatDetails.buyer_id === currentUserId 
      ? chatDetails.seller_id 
      : chatDetails.buyer_id;

    try {
      const { data, error } = await supabase
        .from('blocked_users')
        .insert({
          blocker_id: currentUserId,
          blocked_id: otherUserId,
        })
        .select();
      
      if (error) throw error;
      
      setUiState(prev => ({ ...prev, isUserBlocked: true, optionsModalVisible: false }));
      Alert.alert('Success', 'User blocked successfully');
    } catch (error) {
      console.error('Block user error:', error);
      Alert.alert('Error', 'Failed to block user');
      throw error;
    }
  }, [currentUserId, chatDetails]);

  // Unblock User Function
  const handleUnblockUser = useCallback(async () => {
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
      
      setUiState(prev => ({ ...prev, isUserBlocked: false, optionsModalVisible: false }));
      Alert.alert('Success', 'User unblocked successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to unblock user');
      throw error;
    }
  }, [currentUserId, chatDetails]);

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
        imageUri={uiState.selectedImage}
        onClose={() => setUiState(prev => ({ ...prev, selectedImage: null }))}
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
            isPeerOnline={presenceState.isPeerOnline}
            isPeerTyping={presenceState.isPeerTyping}
            peerLastSeen={presenceState.peerLastSeen}
            onOptionsPress={() => setUiState(prev => ({ ...prev, optionsModalVisible: true }))}
          />

          {/* Chat-level preparing indicator (shows immediately after capture/selection/recording) */}
          <PreparingFileOverlay visible={uiState.isPreparingFile} />

          {/* Search Results Header */}
          {uiState.searchResults.length > 0 && (
            <View style={[styles.searchHeader, { backgroundColor: colors.surface }]}>
              <Text style={[styles.searchHeaderText, { color: colors.text }]}>
                {uiState.searchResults.length} result{uiState.searchResults.length !== 1 ? 's' : ''} for "{uiState.searchQuery}"
              </Text>
              <TouchableOpacity 
                onPress={() => {
                  setUiState(prev => ({ ...prev, searchResults: [], searchQuery: '' }));
                }}
                style={styles.clearSearchButton}
              >
                <Ionicons name="close" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          <FlatList
            ref={flatListRef}
            data={uiState.isSearching ? [] : uiState.searchResults.length > 0 ? uiState.searchResults : messages}
            renderItem={({ item, index }) => {
              const currentMsgDate = new Date(item.created_at).toDateString();
              const dataSource = uiState.searchResults.length > 0 ? uiState.searchResults : messages;
              const nextMsg = dataSource[index + 1];
              const nextMsgDate = nextMsg
                ? new Date(nextMsg.created_at).toDateString()
                : null;
              const showDateHeader = currentMsgDate !== nextMsgDate;

              const repliedMessage = item.parent_id
                ? messageMap.get(item.parent_id)
                : null;

              // Render video messages with dedicated VideoMessageBubble
              if (item.file_type === 'video') {
                return (
                  <View key={item.id} style={{ marginVertical: 4, paddingHorizontal: 16 }}>
                    {showDateHeader && (
                      <Text style={[{ textAlign: 'center', fontSize: 12, marginVertical: 8 }, { color: colors.textSecondary }]}>
                        {currentMsgDate}
                      </Text>
                    )}
                    <View style={{
                      alignSelf: item.sender_id === currentUserId ? 'flex-end' : 'flex-start',
                      marginLeft: item.sender_id === currentUserId ? 50 : 0,
                      marginRight: item.sender_id === currentUserId ? 0 : 50,
                    }}>
                      <VideoMessageBubble 
                        sourceUri={item.file_url} 
                        isCurrentUser={item.sender_id === currentUserId}
                        isUploading={item.is_sending || false}
                      />
                    </View>
                  </View>
                );
              }

              // Render audio messages with dedicated AudioMessageBubble
              if (item.file_type === 'audio') {
                return (
                  <View key={item.id} style={{ marginVertical: 4, paddingHorizontal: 16 }}>
                    {showDateHeader && (
                      <Text style={[{ textAlign: 'center', fontSize: 12, marginVertical: 8 }, { color: colors.textSecondary }]}>
                        {currentMsgDate}
                      </Text>
                    )}
                    <View style={{
                      alignSelf: item.sender_id === currentUserId ? 'flex-end' : 'flex-start',
                      marginLeft: item.sender_id === currentUserId ? 50 : 0,
                      marginRight: item.sender_id === currentUserId ? 0 : 50,
                    }}>
                      <AudioMessageBubble 
                        sourceUri={item.file_url} 
                        isCurrentUser={item.sender_id === currentUserId}
                        isUploading={item.is_sending || false}
                        fileName={item.content !== 'Voice message' ? item.content : undefined}
                      />
                    </View>
                  </View>
                );
              }

              return (
                <MessageItem
                  item={item}
                  index={index}
                  currentUserId={currentUserId}
                  replyContent={repliedMessage?.content || null}
                  showDateHeader={showDateHeader}
                  activeMenuId={activeMenuId}
                  uploadProgress={uploadProgress}
                  playingVideoId={playingVideoId}
                  videoRefs={videoRefs}
                  onActionMenu={handleActionMenu}
                  onSetSelectedImage={(uri) => setUiState(prev => ({ ...prev, selectedImage: uri }))}
                  onSetPlayingVideoId={setPlayingVideoId}
                  onReactionToggle={handleReactionToggle}
                  onStartReply={startReply}
                  onStartReference={startReference}
                  onStartEdit={startEdit}
                  onDownloadFile={handleDownloadFile}
                  onConfirmDelete={confirmDelete}
                  highlightedId={highlightedId}
                  onReplyPress={handleReplyPress}
                  searchQuery={uiState.searchResults.length > 0 ? uiState.searchQuery : ''}
                  isSelectionMode={uiState.isSelectionMode}
                  isSelected={uiState.selectedMessages.has(item.id)}
                  onToggleSelection={toggleMessageSelection}
                  setIsSelectionMode={(value) => setUiState(prev => ({ ...prev, isSelectionMode: value }))}
                  setSelectedMessages={(value) => setUiState(prev => ({ ...prev, selectedMessages: value }))}
                  replyingTo={replyingTo}
                  referencingTo={referencingTo}
                  swipeHighlightedId={swipeHighlightedId}
                />
              );
            }}
            keyExtractor={(i) => i.id.toString()}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            extraData={activeMenuId}
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
          {uiState.isSelectionMode && (
            <View style={[styles.selectionBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
              <View style={styles.selectionInfo}>
                <Text style={[styles.selectionText, { color: colors.text }]}>
                  {uiState.selectedMessages.size} selected
                </Text>
              </View>
              <View style={styles.selectionActions}>
                <TouchableOpacity onPress={selectAllMessages} style={styles.actionButton} disabled={uiState.isTogglingSelection}>
                  {uiState.isTogglingSelection ? (
                    <View style={styles.spinnerContainer}>
                      <ActivityIndicator size={12} color={colors.primary} />
                      <Text style={[styles.actionButtonText, { color: colors.primary, marginLeft: 6 }]}>
                        {uiState.selectedMessages.size === messages.length ? 'Unselecting...' : 'Selecting...'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.actionButtonText, { color: colors.primary }]}>
                      {uiState.selectedMessages.size === messages.length ? 'Unselect All' : 'Select All'}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={deleteSelectedMessages} 
                  style={[styles.actionButton, { opacity: uiState.selectedMessages.size > 0 ? 1 : 0.5 }]}
                  disabled={uiState.selectedMessages.size === 0}
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
            isRecording={uiState.isRecording}
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
              // Clear typing status when input is cleared
              if (presenceChannelRef.current) {
                presenceChannelRef.current.track({
                  typing: false,
                });
              }
            }}
          />
        </Pressable>
      </KeyboardAvoidingView>

      {/* Chat Options Modal */}
      <ChatOptionsModal
        visible={uiState.optionsModalVisible}
        onClose={() => setUiState(prev => ({ ...prev, optionsModalVisible: false }))}
        chatId={chatId}
        otherUserId={chatDetails?.buyer_id === currentUserId ? chatDetails?.seller_id || null : chatDetails?.buyer_id || null}
        otherUserName={peerName}
        currentUserId={currentUserId}
        onSearchMessages={handleSearchMessages}
        onBlockUser={handleBlockUser}
        onUnblockUser={handleUnblockUser}
        onSelectMessages={startSelectionMode}
        isUserBlocked={uiState.isUserBlocked}
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
