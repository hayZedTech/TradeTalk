# Media Players Setup

## React Native Video Setup

For Android, add to `android/app/build.gradle`:
```gradle
dependencies {
    implementation project(':react-native-video')
}
```

For iOS, run:
```bash
cd ios && pod install
```

## React Native Sound Setup

For Android, the library should work automatically.

For iOS, run:
```bash
cd ios && pod install
```

## Usage Notes

### Video Player
- Now uses `react-native-video` which provides:
  - Better performance
  - Native controls that actually work
  - Proper pause/play functionality
  - Better error handling

### Audio Player
- Now uses `react-native-sound` which provides:
  - More reliable playback
  - Better control over audio state
  - Faster loading times
  - Proper pause/resume functionality

### Key Improvements
1. **Video**: Tap to play/pause works properly with native controls
2. **Audio**: Instant pause/play response
3. **Performance**: Much faster loading and smoother playback
4. **Controls**: Native controls that users are familiar with
5. **Error Handling**: Better error recovery and user feedback

## Build Commands

After setup, rebuild your app:
```bash
# For Android
npx react-native run-android

# For iOS  
npx react-native run-ios
```