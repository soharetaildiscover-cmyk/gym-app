/**
 * Design tokens, carried over from the PIVOT prototype (prototype/PIVOT_Design.html).
 * Dark, high-contrast, with one acid accent for the thing that matters on a screen.
 */
export const colors = {
  black: '#0B0D0C', // app background
  carbon: '#151816', // cards
  graphite: '#202421', // raised controls
  acid: '#D6FF3F', // primary accent: the one action / the live number
  gold: '#E8C760', // the coach (names, coach-owned items)
  bone: '#F4F5EF', // primary text
  bone2: 'rgba(244,245,239,0.72)', // secondary text
  steel: '#929893', // quiet text, labels
  red: '#FF5A4F', // pain, errors
  line: 'rgba(244,245,239,0.08)',
  line2: 'rgba(244,245,239,0.14)',
} as const;

export const fonts = {
  display: 'SpaceGrotesk_600SemiBold',
  displayMedium: 'SpaceGrotesk_500Medium',
  body: 'Manrope_500Medium',
  bodyBold: 'Manrope_700Bold',
  bodyHeavy: 'Manrope_800ExtraBold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;
export const gutter = 20;
