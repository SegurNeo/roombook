import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Settings } from '@/lib/format';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({
    language: 'en',
    region: 'eu',
    currency: 'eur',
    dateFormat: 'dd/mm/yyyy',
    numberFormat: '1,234.56',
    measurementUnit: 'metric'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .single();

        if (!profile?.organization_id) return;

        const { data: org } = await supabase
          .from('organizations')
          .select('settings')
          .eq('id', profile.organization_id)
          .single();

        if (org?.settings) {
          setSettings(org.settings);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();

    // Subscribe to settings changes
    const channel = supabase
      .channel('org_settings')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'organizations',
          filter: 'settings IS NOT NULL'
        },
        (payload) => {
          if (payload.new && 'settings' in payload.new) {
            setLoading(true);
            setSettings(payload.new.settings as Settings);
            // Show loading animation for at least 500ms
            setTimeout(() => setLoading(false), 500);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { settings, loading };
}