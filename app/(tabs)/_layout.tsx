import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import {StatusBar} from "expo-status-bar"


export default function TabsLayout() {
  return (
    <>
    <StatusBar style="light"  />
    <Tabs
      screenOptions={{ 
      headerStyle: { backgroundColor: '#2255ee' },
      headerTintColor: '#fff',
      headerTitleStyle: { fontWeight: 'bold' },
    }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Feed",
          headerTitle: "TradeTalk",
          tabBarIcon: ({ size, color }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat-list"
        options={{
          title: "Deals",
          tabBarIcon: ({ size, color }) => (
            <Ionicons name="paper-plane" size={size} color={color} />
          ),
        }}
      />
     

      <Tabs.Screen
        name="chatroom/index"
        options={{
          title: "Chats",
          tabBarIcon: ({ size, color }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
        }}
      />

       <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          headerShown: false,
          tabBarIcon: ({ size, color }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="edit-profile"
        options={{ href: null, title: "Edit Profile" }}
      />
     
      <Tabs.Screen
        name="product/[id]"
        options={{ href: null, title: "Products" }}
      />
      <Tabs.Screen
        name="product/add-product"
        options={{ href: null, title: "Add Products" }}
      />
      <Tabs.Screen
        name="settings"
        options={{ href: null, title: "Settings" }}
      />

       <Tabs.Screen
        name="favorites"
        options={{ href: null, title: "Settings" }}
      />

       <Tabs.Screen
        name="my-listings"
        options={{ href: null, title: "Settings" }}
      />

      <Tabs.Screen
        name="product/edit/[id]"
        options={{ href: null, title: "Edit Products" }}
      />

      <Tabs.Screen
        name="change-password"
        options={{ href: null, title: "Change Password" }}
      />


       <Tabs.Screen name="chat/[id]" options={{ href: null, title: "Chats" }} />

      <Tabs.Screen
        name="chat/MessageItem"  options={{ href: null, title: "" }} 
      />

       <Tabs.Screen
        name="chat/ChatHeader"  options={{ href: null, title: "" }} 
      />

      <Tabs.Screen
        name="chat/ChatInputBar"  options={{ href: null, title: "" }} 
      />

      <Tabs.Screen
        name="chat/ImageZoomModal"  options={{ href: null, title: "" }} 
      />

       <Tabs.Screen
        name="chat/PreparingFileOverlay"  options={{ href: null, title: "" }} 
      />

      

      
    </Tabs>
    
    </>
  );
}
