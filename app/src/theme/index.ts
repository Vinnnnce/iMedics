/**
 * iMedics Theme — Beeline-inspired design system
 * Bold, card-based, large rounded tiles, strong accent colors, soft shadows.
 */

export const Colors = {
  // Backgrounds
  background: '#F5F6FA',
  surface: '#FFFFFF',
  surfaceTint: '#F3F0FF',

  // Text
  textPrimary: '#2D3436',
  textSecondary: '#636E72',
  textMuted: '#B2BEC3',
  textInverse: '#FFFFFF',

  // Accent colors (Beeline-style strong accents)
  primary: '#6C5CE7',       // Purple — primary brand
  primaryLight: '#A29BFE',
  primaryDark: '#5649C0',

  // Tile accent colors
  accentBlue: '#0984E3',
  accentTeal: '#00B894',
  accentAmber: '#FDCB6E',
  accentRed: '#E74C3C',
  accentOrange: '#E67E22',
  accentGreen: '#00B894',

  // Status colors
  normal: '#00B894',
  low: '#E74C3C',
  high: '#E67E22',
  critical: '#E74C3C',
  warning: '#FDCB6E',

  // Status backgrounds (tinted)
  normalBg: '#E8F8F0',
  lowBg: '#FFEAEA',
  highBg: '#FFF5E6',
  criticalBg: '#FFEAEA',
  warningBg: '#FFF8E1',
  aiBg: '#F3F0FF',

  // Borders
  border: '#DFE4EA',
  borderLight: '#F0F0F5',

  // Shadows
  shadow: '#000000',
};

export const Typography = {
  // Font families
  fontFamily: 'System',
  fontFamilyBold: 'System',

  // Sizes
  titleLarge: 28,
  title: 24,
  heading: 20,
  subheading: 18,
  body: 16,
  bodySmall: 14,
  caption: 12,
  micro: 10,

  // Weights
  bold: '700',
  semibold: '600',
  medium: '500',
  regular: '400',

  // Line heights
  lineHeightBody: 22,
  lineHeightCaption: 18,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
};

export const Shadows = {
  small: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  large: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
};

export const Theme = {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
};

export default Theme;
