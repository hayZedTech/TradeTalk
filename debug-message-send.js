// Debug Message Sending
// Run this in your browser console or create a test function

const testMessageSend = async () => {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('Not authenticated');
    
    console.log('Current user:', user.id);
    
    // Test payload (replace with your actual chat ID)
    const testPayload = {
      chat_id: 'YOUR_CHAT_ID_HERE', // Replace with actual chat ID
      sender_id: user.id,
      content: 'Test message from debug script',
    };
    
    console.log('Test payload:', testPayload);
    
    // Try to insert message
    const { data, error } = await supabase
      .from('messages')
      .insert([testPayload])
      .select()
      .single();
    
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    
    console.log('Message sent successfully:', data);
    return data;
    
  } catch (error) {
    console.error('Test failed:', error);
    return null;
  }
};

// Call the test function
// testMessageSend();