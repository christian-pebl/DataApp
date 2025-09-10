import { useState, useEffect } from 'react';
import { simplifiedSharingService, type SharedPin } from '@/lib/supabase/sharing-service-simplified';
import { createClient } from '@/lib/supabase/client';

export function useSharedPins() {
  const [sharedPins, setSharedPins] = useState<SharedPin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supabase] = useState(() => createClient());

  const loadSharedPins = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const pins = await simplifiedSharingService.getSharedPins();
      setSharedPins(pins);
    } catch (err) {
      console.error('Error loading shared pins:', err);
      setError('Failed to load shared pins');
    } finally {
      setLoading(false);
    }
  };

  const refreshSharedPins = () => {
    loadSharedPins();
  };

  // Load shared pins on mount and when auth state changes
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        loadSharedPins();
      } else {
        setSharedPins([]);
      }
    });

    // Load immediately if already authenticated
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        loadSharedPins();
      }
    };
    checkAuth();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Set up real-time subscription for shared pins updates
  useEffect(() => {
    let channel: any = null;

    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel(`shared-pins:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pin_shares',
            filter: `shared_with_user_id=eq.${user.id}`,
          },
          () => {
            // Refresh shared pins when changes occur
            loadSharedPins();
          }
        )
        .subscribe();
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  return {
    sharedPins,
    loading,
    error,
    refreshSharedPins,
  };
}