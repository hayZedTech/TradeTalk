// Background task handler to suppress Firebase warnings
// This file handles the Firebase messaging background tasks

import { AppRegistry } from 'react-native';

// Register a dummy handler for Firebase messaging background tasks
const FirebaseMessagingHeadlessTask = async (remoteMessage) => {
  // Since we're using Expo notifications, we don't need to handle Firebase messages
  // This is just to suppress the warning
  console.log('Firebase background message received (ignored):', remoteMessage);
};

// Register the background handler
AppRegistry.registerHeadlessTask(
  'ReactNativeFirebaseMessagingHeadlessTask',
  () => FirebaseMessagingHeadlessTask
);