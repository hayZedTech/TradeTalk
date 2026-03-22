// Test Push Notification Script
// Run this in your browser console or Node.js

const testPushNotification = async () => {
  // Replace with your actual push token from the console logs
  const pushToken = "YOUR_PUSH_TOKEN_HERE";
  
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: pushToken,
      title: "Test Notification",
      body: "This is a test message",
      data: { chatId: "test-chat-id" },
      sound: "default",
      priority: "high",
      channelId: "default",
      _fed_experienceId: "@hayzed001/tradetalk",
    }),
  });

  const result = await response.json();
  console.log("Test Result:", result);
};

// Call the function
testPushNotification();