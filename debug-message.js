// Debug script to test message insertion
import { supabase } from './lib/supabase.js';

async function testMessageInsert() {
  try {
    console.log('Testing message insertion...');
    
    const testPayload = {
      chat_id: 'cc9be3d2-e350-4f72-8382-6fce8b15758e',
      sender_id: 'fbdb8248-1767-454a-92a3-20a4ff9e6910',
      content: 'Test message'
    };
    
    console.log('Payload:', testPayload);
    
    const { data, error } = await supabase
      .from('messages')
      .insert([testPayload])
      .select()
      .single();
    
    if (error) {
      console.error('Database error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    } else {
      console.log('Success:', data);
    }
  } catch (err) {
    console.error('Caught error:', err);
    console.error('Error type:', typeof err);
    console.error('Error constructor:', err.constructor.name);
    if (err.message) console.error('Error message:', err.message);
    if (err.details) console.error('Error details:', err.details);
    if (err.hint) console.error('Error hint:', err.hint);
    if (err.code) console.error('Error code:', err.code);
  }
}

testMessageInsert();