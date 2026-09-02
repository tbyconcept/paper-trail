/**
 * Paper Trail design tokens. Single postal/paper palette — the brief does not
 * define a distinct dark-mode variant, so both schemes render the same tokens.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const PaperColors = {
  paper: '#EFE6D3',
  paperDark: '#E2D5B8',
  ink: '#2C3A4A',
  postalRed: '#B5432E',
  sky: '#7FA6C4',
  rain: '#56707D',
  pencil: '#9C9280',
} as const;

export const Colors = {
  light: {
    text: PaperColors.ink,
    background: PaperColors.paper,
    backgroundElement: PaperColors.paperDark,
    backgroundSelected: PaperColors.sky,
    textSecondary: PaperColors.pencil,
    accent: PaperColors.postalRed,
  },
  dark: {
    text: PaperColors.ink,
    background: PaperColors.paper,
    backgroundElement: PaperColors.paperDark,
    backgroundSelected: PaperColors.sky,
    textSecondary: PaperColors.pencil,
    accent: PaperColors.postalRed,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// Family names as registered by @expo-google-fonts/* via useFonts() in the
// root layout — same name works across iOS, Android, and web.
export const Fonts = {
  display: 'SpecialElite_400Regular',
  body: 'CourierPrime_400Regular',
  bodyBold: 'CourierPrime_700Bold',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
// The web tab bar (app-tabs.web.tsx) is a floating pill overlaid on top of the
// screen rather than a native bottom bar, so tab screens need top clearance
// on web only.
export const WebTopTabInset = Platform.select({ web: 88 }) ?? 0;
export const MaxContentWidth = 800;
