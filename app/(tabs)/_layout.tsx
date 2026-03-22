import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { supabase } from "../../lib/supabase";


function BadgeIcon({ name, size, color, count }: { name: any; size: number; color: string; count: number }) {
  return (
    <View>
      <Ionicons name={name} size={size} color={color} />
      {count > 0 && (
        <View style={badge.dot}>
          <Text style={badge.text}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </View>
  );
}

const badge = StyleSheet.create({
  dot: {
    position: 'absolute', top: -4, right: -8,
    backgroundColor: '#ef4444', borderRadius: 10,
    minWidth: 18, height: 18, justifyContent: 'center',
    alignItems: 'center', paddingHorizontal: 3,
  },
  text: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
});

export default function TabsLayout() {
  const [dealsBadge, setDealsBadge] = useState(0);
  const [chatsBadge, setChatsBadge] = useState(0);
  const [friendsBadge, setFriendsBadge] = useState(0);

  useEffect(() => {
    let userId: string | null = null;

    const loadBadges = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;

      // Unread product chat messages (Deals tab)
      const { count: dealsCount } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false)
        .neq('sender_id', user.id)
        .in('chat_id',
          (await supabase.from('chats').select('id').or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`).eq('type', 'product')).data?.map((c: any) => c.id) || []
        );
      setDealsBadge(dealsCount || 0);

      // Unread direct chat messages (Chats tab)
      const { count: chatsCount } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false)
        .neq('sender_id', user.id)
        .in('chat_id',
          (await supabase.from('chats').select('id').or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`).eq('type', 'direct')).data?.map((c: any) => c.id) || []
        );
      setChatsBadge(chatsCount || 0);

      // Pending friend requests (Friends tab)
      const { count: friendsCount } = await supabase
        .from('friend_requests')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('status', 'pending');
      setFriendsBadge(friendsCount || 0);
    };

    loadBadges();

    // Realtime: refresh badges on new messages and friend requests
    const channel = supabase
      .channel('tab_badges')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, loadBadges)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, loadBadges)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friend_requests' }, loadBadges)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'friend_requests' }, loadBadges)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

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
            <BadgeIcon name="paper-plane" size={size} color={color} count={dealsBadge} />
          ),
        }}
      />

      <Tabs.Screen
        name="chatroom/index"
        options={{
          title: "Chats",
          tabBarIcon: ({ size, color }) => (
            <BadgeIcon name="chatbubbles" size={size} color={color} count={chatsBadge} />
          ),
        }}
      />

      <Tabs.Screen
        name="friends"
        options={{
          title: "Friends",
          tabBarIcon: ({ size, color }) => (
            <BadgeIcon name="people" size={size} color={color} count={friendsBadge} />
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
