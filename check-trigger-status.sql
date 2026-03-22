-- Check if the trigger exists and is active
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement,
    action_condition
FROM information_schema.triggers 
WHERE trigger_name = 'on_message_created' AND event_object_table = 'messages';

-- Check if the function exists
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'notify_message_recipients';

-- If the trigger doesn't exist, create it with your actual values:
-- (Replace YOUR_SERVICE_ROLE_KEY with your actual service role key)

/*
CREATE OR REPLACE FUNCTION notify_message_recipients()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM
    net.http_post(
      url := 'https://olrqqbwxomfcqeppqnut.supabase.co/functions/v1/push-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
      ),
      body := jsonb_build_object('record', to_jsonb(NEW))
    );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Push notification failed: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_message_created
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_message_recipients();
*/