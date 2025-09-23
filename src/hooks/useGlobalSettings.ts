import { useState, useEffect } from 'react';

interface GlobalSettings {
  wrapText: boolean;
  compact: boolean;
}

const SETTINGS_KEY = 'log-trawler-global-settings';

const DEFAULT_SETTINGS: GlobalSettings = {
  wrapText: true,
  compact: false,
};

export const useGlobalSettings = () => {
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error('Error loading global settings:', error);
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving global settings:', error);
    }
  }, [settings]);

  const updateSettings = (updates: Partial<GlobalSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  return {
    settings,
    updateSettings,
  };
};