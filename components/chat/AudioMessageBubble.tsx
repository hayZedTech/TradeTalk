import React, { memo, useEffect } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator } from "react-native";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Ionicons } from "@expo/vector-icons";

interface AudioMessageBubbleProps {
  sourceUri: string;
  isCurrentUser?: boolean;
  isUploading?: boolean;
}

function AudioMessageBubbleComponent({ sourceUri, isCurrentUser = false, isUploading = false }: AudioMessageBubbleProps) {
  const player = useAudioPlayer(sourceUri);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
    });
  }, []);

  const isPlaying = !!status?.playing;
  const currentTime = Math.floor(status?.currentTime ?? 0);
  const duration = Math.floor(status?.duration ?? 0);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = async () => {
    try {
      if (isPlaying) {
        await player.pause();
      } else {
        await player.play();
      }
    } catch (error) {
      console.error('AudioMessageBubble - Play/Pause error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Audio Error', `Failed to play audio: ${errorMessage}`);
    }
  };

  const getStatusText = () => {
    if (isUploading) return 'Uploading...';
    if (duration > 0) return `${formatTime(currentTime)} / ${formatTime(duration)}`;
    return 'Voice Message';
  };

  const getPlayButtonContent = () => {
    if (isUploading) {
      return (
        <ActivityIndicator 
          size={20} 
          color={isCurrentUser ? "#fff" : "#111"} 
        />
      );
    }
    
    return (
      <Ionicons 
        name={isPlaying ? "pause" : "play"} 
        size={20} 
        color={isCurrentUser ? "#fff" : "#111"} 
      />
    );
  };

  return (
    <View 
      style={{ 
        padding: 12, 
        borderRadius: 14, 
        backgroundColor: isCurrentUser ? "#007AFF" : "#f2f2f2", 
        flexDirection: "row", 
        alignItems: "center", 
        gap: 12,
        maxWidth: 250,
      }}
    >
      <Pressable
        onPress={handlePlayPause}
        disabled={isUploading}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isCurrentUser ? "rgba(255,255,255,0.2)" : "#ddd",
          opacity: isUploading ? 0.7 : 1,
        }}
      >
        {getPlayButtonContent()}
      </Pressable>

      <View style={{ flex: 1 }}>
        <Text 
          style={{ 
            fontSize: 14, 
            fontWeight: "600",
            color: isCurrentUser ? "#fff" : "#111"
          }}
        >
          Voice Message
        </Text>
        <Text 
          style={{ 
            fontSize: 12, 
            color: isCurrentUser ? "rgba(255,255,255,0.8)" : "#666"
          }}
        >
          {getStatusText()}
        </Text>
      </View>
    </View>
  );
}

export const AudioMessageBubble = memo(AudioMessageBubbleComponent);