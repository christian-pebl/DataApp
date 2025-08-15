import { useState, useEffect } from 'react';

export interface Settings {
  units: 'metric' | 'imperial';
  coordFormat: 'dd' | 'dms'; // decimal degrees or degrees-minutes-seconds
}

export const useSettings = () => {
  const [settings, setSettingsState] = useState<Settings | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('map-settings');
        if (stored) {
          setSettingsState(JSON.parse(stored));
        } else {
          // Default settings
          const defaultSettings: Settings = {
            units: 'metric',
            coordFormat: 'dd'
          };
          setSettingsState(defaultSettings);
          localStorage.setItem('map-settings', JSON.stringify(defaultSettings));
        }
      } catch (e) {
        console.error('Error loading settings:', e);
        setSettingsState({
          units: 'metric',
          coordFormat: 'dd'
        });
      }
    }
  }, []);

  const setSettings = (newSettings: Settings) => {
    setSettingsState(newSettings);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('map-settings', JSON.stringify(newSettings));
      } catch (e) {
        console.error('Error saving settings:', e);
      }
    }
  };

  return { settings, setSettings };
};