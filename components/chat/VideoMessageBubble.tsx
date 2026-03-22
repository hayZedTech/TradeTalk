import React, { memo } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";

interface VideoMessageBubbleProps {
  sourceUri: string;
  isCurrentUser?: boolean;
  isUploading?: boolean;
}

function VideoMessageBubbleComponent({
  sourceUri,
  isCurrentUser = false,
  isUploading = false,
}: VideoMessageBubbleProps) {
  
  const player = useVideoPlayer(sourceUri);

  return (
    <View
      style={{
        maxWidth: 250,
        borderRadius: 14,
        overflow: "hidden",
        backgroundColor: "#000",
      }}
    >
      {/* Uploading overlay */}
      {isUploading && (
        <View
          style={{
            position: "absolute",
            zIndex: 2,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{ color: "#fff", marginTop: 6, width:200, textAlign:"center" }}>
            Uploading video...
          </Text>
        </View>
      )}

      <VideoView
        player={player}
        style={{ width: 250, height: 180 }}
        fullscreenOptions={{ enable: true }}
        allowsPictureInPicture
      />
    </View>
  );
}

export const VideoMessageBubble = memo(VideoMessageBubbleComponent);