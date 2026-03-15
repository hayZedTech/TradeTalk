import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const usePresence = (userId: string | undefined) => {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!userId) return;

    // 1. Initialize the channel
    const channel = supabase.channel('online-users', {
      config: { presence: { key: userId } },
    });

    // 2. Listen for "join" and "leave" events
    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        setOnlineUsers(newState);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // 3. Track the current user's status
          await channel.track({
            online_at: new Date().toISOString(),
            status: 'Online', // You can change this to 'Busy' or 'In a Trade'
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [userId]);

  return onlineUsers;
};