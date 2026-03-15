import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => Promise<void>;
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    primary: string;
    secondary: string;
    border: string;
    bubble: {
      mine: string;
      theirs: string;
    };
  };
}

const lightColors = {
  background: '#ffffff',
  surface: '#f5f5f5',
  text: '#1f2937',
  textSecondary: '#6b7280',
  primary: '#2255ee',
  secondary: '#dd8811',
  border: '#e5e7eb',
  bubble: {
    mine: '#2255ee20',
    theirs: '#dd881120',
  },
};

const darkColors = {
  background: '#1f2937',
  surface: '#374151',
  text: '#f9fafb',
  textSecondary: '#d1d5db',
  primary: '#60a5fa',
  secondary: '#f59e0b',
  border: '#4b5563',
  bubble: {
    mine: '#60a5fa30',
    theirs: '#f59e0b30',
  },
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    
    try {
      // Save to AsyncStorage
      await AsyncStorage.setItem('theme', newTheme);
      
      // Update database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('users')
          .update({ theme: newTheme })
          .eq('id', user.id);
        console.log('Theme updated in database');
      }
    } catch (error) {
      console.error('Error updating theme:', error);
      // Revert theme on error
      setTheme(theme);
      throw error;
    }
  };

  const colors = theme === 'light' ? lightColors : darkColors;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};