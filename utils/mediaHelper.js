import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Video } from 'react-native-compressor';
import { Audio } from 'expo-av';
import { Alert } from 'react-native';

/**
 * Global Limits for Marketplace Uploads
 * Gate 1: maxOriginal (Prevents app crashes from huge files)
 * Gate 2: maxFinal (Ensures Supabase storage stays lean)
 */
const LIMITS = {
  IMAGE: { maxOriginal: 12 * 1024 * 1024, maxFinal: 2 * 1024 * 1024 },
  AUDIO: { maxOriginal: 10 * 1024 * 1024, maxFinal: 5 * 1024 * 1024 },
  VIDEO: { maxOriginal: 50 * 1024 * 1024, maxFinal: 15 * 1024 * 1024 },
};

/**
 * Standard Audio Recording Settings
 * Use these with: Audio.Recording.createAsync(AUDIO_RECORDING_CONFIG)
 * Updated with 'web' property to satisfy TypeScript RecordingOptions requirement.
 */
export const AUDIO_RECORDING_CONFIG = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1, // Mono saves 50% space
    bitRate: 64000,      // 64kbps is perfect for clear voice notes
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

/**
 * Main Utility Function to Validate & Compress Media
 * @param {string} uri - The local file URI
 * @param {'image' | 'video' | 'audio'} type - The media type
 * @returns {Promise<string|null>} - Returns processed URI or null if failed
 */
export async function validateAndProcessMedia(uri, type) {
  try {
    // 1. Check if file exists and get info
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      console.error("File does not exist at URI:", uri);
      return null;
    }

    const typeKey = type.toUpperCase();
    const config = LIMITS[typeKey];

    if (!config) {
      console.error("Invalid media type provided to helper:", type);
      return null;
    }

    // GATE 1: Pre-check the original file size (Anti-Crash)
    if (fileInfo.size > config.maxOriginal) {
      const originalMb = (fileInfo.size / (1024 * 1024)).toFixed(1);
      Alert.alert(
        "File Too Large", 
        `The original file is ${originalMb}MB. Please select a ${type} smaller than ${config.maxOriginal / (1024 * 1024)}MB.`
      );
      return null;
    }

    let processedUri = uri;

    // --- PROCESSING STAGE ---
    
    // IMAGE: Resize and Reduce Quality
    if (type === 'image') {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1000 } }], // Jumia/Standard Marketplace width
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      processedUri = result.uri;
    } 
    
    // VIDEO: Use Hardware-accelerated compression
    else if (type === 'video') {
      processedUri = await Video.compress(uri, { 
        compressionMethod: 'auto',
      });
    }

    // AUDIO: No post-processing needed if using AUDIO_RECORDING_CONFIG.
    // If it's a gallery upload, Gate 2 will catch it if it's too big.

    // GATE 2: Final Size Check (The Supabase Guard)
    const finalInfo = await FileSystem.getInfoAsync(processedUri);
    if (finalInfo.size > config.maxFinal) {
      const finalMb = (finalInfo.size / (1024 * 1024)).toFixed(1);
      Alert.alert(
        "Optimization Failed", 
        `Even after shrinking, the file is ${finalMb}MB. Please use a smaller/shorter ${type}.`
      );
      return null;
    }

    return processedUri;

  } catch (error) {
    console.error(`Media processing error for ${type}:`, error);
    Alert.alert("Processing Error", `We couldn't prepare your ${type} for upload. Please try again.`);
    return null;
  }
}