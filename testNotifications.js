// Test notification functionality
// Add this temporarily to your app to test notifications

import * as Notifications from 'expo-notifications';

export const testNotifications = async () => {
  console.log('=== NOTIFICATION TEST START ===');
  
  // 1. Check permissions
  const { status } = await Notifications.getPermissionsAsync();
  console.log('Permission status:', status);
  
  if (status !== 'granted') {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    console.log('New permission status:', newStatus);
  }
  
  // 2. Check if device supports notifications
  const canSchedule = await Notifications.canScheduleNotificationsAsync();
  console.log('Can schedule notifications:', canSchedule);
  
  // 3. Send a test local notification
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Test Notification",
        body: "This is a test notification while app is open",
        data: { chatId: "test-chat-id" },
      },
      trigger: { seconds: 2 },
    });
    console.log('Test notification scheduled');
  } catch (error) {
    console.error('Error scheduling notification:', error);
  }
  
  console.log('=== NOTIFICATION TEST END ===');
};

// Call this function from your homepage or chat screen to test
// testNotifications();