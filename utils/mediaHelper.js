import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Video, Audio as AudioCompressor } from 'react-native-compressor';
import { Alert } from 'react-native';

/**
 * Global Limits for Marketplace Uploads
 * Gate 1: maxOriginal (Prevents app crashes from huge files)
 * Gate 2: maxFinal (Ensures Supabase storage stays lean)
 */
const LIMITS = {
  IMAGE: { maxOriginal: 12 * 1024 * 1024, maxFinal: 2 * 1024 * 1024 },
  AUDIO: { maxOriginal: 10 * 1024 * 1024, maxFinal: 5 * 1024 * 1024 },
  VIDEO: { maxOriginal: 100 * 1024 * 1024, maxFinal: 25 * 1024 * 1024 },
};

/**
 * Standard Audio Recording Settings for react-native-nitro-sound
 * These settings provide optimal quality/size balance for voice messages
 */
export const AUDIO_RECORDING_CONFIG = {
  sampleRate: 44100,
  channels: 1,        // Mono saves 50% space
  bitRate: 64000,     // 64kbps is perfect for clear voice notes
  format: 'm4a',      // Compatible format
  quality: 'medium',  // Balance between quality and file size
};

/**
 * Main Utility Function to Validate & Compress Media
 * @param {string} uri - The local file URI
 * @param {'image' | 'video' | 'audio'} type - The media type
 * @param {Function} onProgress - Optional progress callback for video compression
 * @returns {Promise<string|null>} - Returns processed URI or null if failed
 */
export async function validateAndProcessMedia(uri, type, onProgress = null) {
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
    
    // VIDEO: Smart compression - skip if already small enough
    else if (type === 'video') {
      console.log('Checking video size for compression...');
      
      // If video is already under 10MB, skip compression for speed
      if (fileInfo.size <= 10 * 1024 * 1024) {
        console.log('Video is small enough, skipping compression');
        processedUri = uri;
      } else {
        console.log('Starting video compression...');
        const startTime = Date.now();
        
        processedUri = await Video.compress(uri, { 
          compressionMethod: 'manual',
          quality: 'medium',
          bitrate: 1500000, // 1.5Mbps - faster compression
          maxSize: 1280, // Smaller max size for faster processing
          getCancellationId: (cancellationId) => {
            console.log('Video compression started with ID:', cancellationId);
          },
          onProgress: (progress) => {
            console.log('Compression progress:', progress);
            if (onProgress) onProgress(progress);
          },
        });
        
        const endTime = Date.now();
        console.log(`Video compression completed in ${(endTime - startTime) / 1000}s`);
      }
    }

    // AUDIO: Use original file without compression to prevent corruption
    else if (type === 'audio') {
      console.log('Using original audio file without compression');
      const originalInfo = await FileSystem.getInfoAsync(uri);
      console.log('Original audio file size:', originalInfo.size, 'bytes');
      processedUri = uri; // Use original file without any compression
    }

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