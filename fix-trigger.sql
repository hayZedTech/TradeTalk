-- Drop the problematic trigger and function
DROP TRIGGER IF EXISTS on_message_created ON messages;
DROP FUNCTION IF EXISTS notify_message_recipients();

-- If you want to recreate it later with proper JSON formatting, use this instead:
/*
CREATE OR REPLACE FUNCTION notify_message_recipients()
RETURNS TRIGGER AS $$
DECLARE
  auth_header text;
BEGIN
  -- Properly construct the authorization header
  auth_header := 'Bearer ' || 'YOUR_ACTUAL_ANON_KEY_HERE';
  
  -- Call the push notification function with properly formatted JSON
  PERFORM
    net.http_post(
      url := 'https://your-project-ref.supabase.co/functions/v1/push-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', auth_header
      ),
      body := jsonb_build_object('record', to_jsonb(NEW))
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_message_created
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_message_recipients();
*/