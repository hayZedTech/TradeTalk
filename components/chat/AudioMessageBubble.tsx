import React, { memo, useEffect, useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator } from "react-native";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Ionicons } from "@expo/vector-icons";

interface AudioMessageBubbleProps {
  sourceUri: string;
  isCurrentUser?: boolean;
  isUploading?: boolean;
  fileName?: string;
}

function AudioMessageBubbleComponent({
  sourceUri,
  isCurrentUser = false,
  isUploading = false,
  fileName,
}: AudioMessageBubbleProps) {
  const player = useAudioPlayer(sourceUri);
  const status = useAudioPlayerStatus(player);
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
    });
  }, []);

  useEffect(() => {
    if (!status?.isLoaded) return;

    const finished =
      status.duration &&
      status.currentTime >= status.duration - 0.25 &&
      !status.playing;

    if (finished) {
      player.pause();     // make sure it stops
      player.seekTo(0);   // reset to beginning
    }
  }, [status]);

  const isPlaying = !!status?.playing;
  const currentTime = status?.currentTime ?? 0;
  const duration = status?.duration ?? 0;
  const isReady = status?.isLoaded === true;
  const canSeek = isReady && duration > 0;
  const isBuffering = status?.isBuffering;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePlayPause = async () => {
    try {
      if (isPlaying) {
        await player.pause();
      } else {
        await player.play();
      }
    } catch (error) {
      console.error("AudioMessageBubble - Play/Pause error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert("Audio Error", `Failed to play audio: ${errorMessage}`);
    }
  };

  const seekBackward = async () => {
    if (!status?.isLoaded) return;
    await player.seekTo(Math.max(0, currentTime - 10));
  };

  const seekForward = async () => {
    if (!status?.isLoaded) return;
    await player.seekTo(Math.min(duration, currentTime + 10));
  };

  const handleSeek = async (event: any) => {
    if (!duration || !status?.isLoaded || barWidth === 0) return;

    const touchX = event.nativeEvent.locationX;
    const percentage = touchX / barWidth;
    const newTime = percentage * duration;

    await player.seekTo(newTime);
  };

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  const extractedName = sourceUri?.split("/").pop();

  const displayTitle =
    fileName && fileName.trim().length > 0
      ? fileName
      : extractedName || "Voice Message";

  return (
    <View
      style={{
        width: "100%",
        maxWidth: 250,
        padding: 12,
        borderRadius: 14,
        backgroundColor: isCurrentUser ? "#007AFF" : "#f2f2f2",
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        alignSelf: "flex-start",
      }}
    >
      <Pressable
        onPress={handlePlayPause}
        disabled={isUploading || isBuffering}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isCurrentUser ? "rgba(255,255,255,0.2)" : "#ddd",
          opacity: isUploading ? 0.7 : 1,
          flexShrink: 0,
        }}
      >
        {isUploading || isBuffering ? (
          <ActivityIndicator size={20} color={isCurrentUser ? "#fff" : "#111"} />
        ) : (
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={20}
            color={isCurrentUser ? "#fff" : "#111"}
          />
        )}
      </Pressable>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: isCurrentUser ? "#fff" : "#111",
              flexShrink: 1,
              marginRight: 8,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {displayTitle}
          </Text>

          <Text
            style={{
              fontSize: 12,
              color: isCurrentUser ? "rgba(255,255,255,0.8)" : "#666",
              flexShrink: 0,
            }}
          >
            {isUploading
              ? "Uploading..."
              : duration > 0
                ? `${formatTime(currentTime)} / ${formatTime(duration)}`
                : "Voice Message"}
          </Text>
        </View>

        <Pressable
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
          onPressIn={handleSeek}
          onPressOut={handleSeek}
          style={{
            height: 6,
            backgroundColor: isCurrentUser ? "rgba(255,255,255,0.3)" : "#ddd",
            borderRadius: 6,
            overflow: "hidden",
            marginBottom: 8,
          }}
        >
          <View
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              backgroundColor: isCurrentUser ? "#fff" : "#111",
            }}
          />
        </Pressable>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={seekBackward} disabled={!canSeek}>
            <Ionicons
              name="play-back"
              size={18}
              color={canSeek ? (isCurrentUser ? "#fff" : "#111") : "rgba(0,0,0,0.3)"}
            />
          </Pressable>

          <Pressable onPress={seekForward} disabled={!canSeek}>
            <Ionicons
              name="play-forward"
              size={18}
              color={canSeek ? (isCurrentUser ? "#fff" : "#111") : "rgba(0,0,0,0.3)"}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export const AudioMessageBubble = memo(AudioMessageBubbleComponent);