-- Better test that simulates real app behavior
-- Replace with your actual values
DO $$
DECLARE
    v_chat_id UUID := '77c31f54-0337-41c6-9324-b5bacfb81f9a';
    v_sender_id UUID := 'fbdb8248-1767-454a-92a3-20a4ff9e6910'; 
    v_recipient_id UUID;
    v_token TEXT;
    v_message_id UUID;
BEGIN
    -- 1. Find recipient
    SELECT CASE 
        WHEN buyer_id = v_sender_id THEN seller_id 
        ELSE buyer_id 
    END INTO v_recipient_id
    FROM chats WHERE id = v_chat_id;

    -- 2. Get recipient token
    SELECT push_token INTO v_token FROM users WHERE id = v_recipient_id;

    IF v_token IS NULL THEN
        RAISE NOTICE 'STOP: Recipient % has NO push token!', v_recipient_id;
    ELSE
        RAISE NOTICE 'SUCCESS: Will send to token %', v_token;
        
        -- 3. Insert message (this will trigger the notification)
        INSERT INTO messages (chat_id, sender_id, content)
        VALUES (v_chat_id, v_sender_id, 'SQL Test: ' || now())
        RETURNING id INTO v_message_id;
        
        RAISE NOTICE 'Message inserted with ID: %', v_message_id;
        
        -- 4. Wait a moment for the trigger to fire
        PERFORM pg_sleep(2);
        
        RAISE NOTICE 'Test complete - check your device for notification!';
    END IF;
END $$;