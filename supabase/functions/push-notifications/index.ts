import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const payload = await req.json();
    const record = payload.record;

    console.log("Function triggered for message ID:", record?.id);

    if (!record || !record.chat_id) {
      return new Response("Missing record or chat_id", { status: 400 });
    }

    // 1. Fetch Chat to find the recipient
    const { data: chat, error: chatErr } = await supabaseAdmin
      .from("chats")
      .select("buyer_id, seller_id")
      .eq("id", record.chat_id)
      .single();

    if (chatErr || !chat) {
      console.error("Chat lookup failed:", chatErr);
      return new Response("Chat not found", { status: 404 });
    }

    // 2. Identify the recipient (the person who didn't send the message)
    const recipientId = record.sender_id === chat.buyer_id
      ? chat.seller_id
      : chat.buyer_id;

    // 3. Get recipient token and sender name
    const [recipientResult, senderResult] = await Promise.all([
      supabaseAdmin
        .from("users")
        .select("push_token, username")
        .eq("id", recipientId)
        .single(),
      supabaseAdmin
        .from("users")
        .select("username")
        .eq("id", record.sender_id)
        .single(),
    ]);

    const pushToken = recipientResult.data?.push_token;
    const senderName = senderResult.data?.username || "Someone";

    if (recipientResult.error || !pushToken) {
      console.log(`No push token for user: ${recipientId}`);
      return new Response("No token found", { status: 200 });
    }

    // 4. Send to Expo with settings that match your successful manual test
    const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: pushToken,
        // title: `New message from ${senderName}`,
        title: `${senderName}`,
        body: record.content,
        data: { chatId: record.chat_id },
        sound: "default",
        priority: "high",           // Ensures immediate delivery
        channelId: "default",       // Matches your Android channel
        _fed_experienceId: "@hayzed001/tradetalk", 
      }),
    });

    const result = await expoResponse.json();
    console.log("Expo API Response:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    const error = err as Error;
    console.error("Function Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});