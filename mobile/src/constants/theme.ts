import { useColorScheme } from 'react-native';

/** RepCount brand colours, matching the website (app/brand.css). */
export const Colors = {
  light: {
    text: '#242623',
    muted: '#6a6c73',
    background: '#fbf7f0',
    card: '#ffffff',
    line: '#e4e5e8',
    brand: '#e51937',
    onBrand: '#ffffff',
    success: '#365c43',
    soft: '#f2e5d8',
  },
  dark: {
    text: '#fbf7f0',
    muted: '#a9aba4',
    background: '#161715',
    card: '#242623',
    line: '#3a3c38',
    brand: '#ff4058',
    onBrand: '#ffffff',
    success: '#7fb08e',
    soft: '#33302b',
  },
} as const;

export type Theme = { [K in keyof typeof Colors.light]: string };

export function useTheme(): Theme {
  return Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const Radius = { md: 14, lg: 20 } as const;
