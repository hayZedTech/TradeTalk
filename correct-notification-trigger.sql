-- First, make sure the old broken trigger is completely removed
DROP TRIGGER IF EXISTS on_message_created ON messages;
DROP FUNCTION IF EXISTS notify_message_recipients();

-- Create the correct function that calls your push notification edge function
CREATE OR REPLACE FUNCTION notify_message_recipients()
RETURNS TRIGGER AS $$
DECLARE
  request_id bigint;
  function_url text;
  auth_header text;
BEGIN
  -- Get your Supabase project URL and construct the function URL
  function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/push-notifications';
  
  -- If the setting doesn't exist, use a fallback (replace with your actual project URL)
  IF function_url IS NULL OR function_url = '/functions/v1/push-notifications' THEN
    function_url := 'https://your-project-ref.supabase.co/functions/v1/push-notifications';
  END IF;
  
  -- Construct the authorization header with service role key
  auth_header := 'Bearer ' || current_setting('app.settings.service_role_key', true);
  
  -- If the setting doesn't exist, use environment variable or fallback
  IF auth_header = 'Bearer ' OR auth_header IS NULL THEN
    auth_header := 'Bearer YOUR_SERVICE_ROLE_KEY_HERE';
  END IF;

  -- Make the HTTP request to your edge function
  SELECT INTO request_id
    net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', auth_header
      ),
      body := jsonb_build_object(
        'record', to_jsonb(NEW)
      )
    );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the insert
    RAISE WARNING 'Push notification failed: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER on_message_created
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_message_recipients();

-- Alternative simpler version if the above doesn't work:
-- Replace the function with this simpler version and update the URLs/keys

/*
CREATE OR REPLACE FUNCTION notify_message_recipients()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM
    net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/push-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY_HERE'
      ),
      body := jsonb_build_object('record', to_jsonb(NEW))
    );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/