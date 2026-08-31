/**
 * LOCUS Office Kit — Avionics / Defense Console Theme
 * Matches the LOCUS mobile design system tokens exactly:
 * Hard edges, hairline dividers, monospace tabular numerals, high contrast.
 */

export const colors = {
  // Surfaces
  panelBg: '#0C1116',
  panelSurface: '#151B21',
  panelElevated: '#1C242C',
  panelActive: '#242F3A',
  chrome: '#3A434D',
  hairline: 'rgba(58, 67, 77, 0.4)',

  // Integrity States
  trusted: '#00D9A3',
  caution: '#FFB300',
  recovering: '#FFB300',
  denied: '#FF3B30',
  network: '#38BDF8',
  offline: '#64748B',

  // Typography
  textPrimary: '#F1F5F9',
  textMuted: '#94A3B8',
  textDim: '#64748B',
  textBright: '#FFFFFF',

  // Accent
  accent: '#00D9A3',
  accentGlow: 'rgba(0, 217, 163, 0.15)',
  deniedGlow: 'rgba(255, 59, 48, 0.15)',
  cautionGlow: 'rgba(255, 179, 0, 0.15)',
} as const;

export function colorForState(state: string): string {
  switch (state.toUpperCase()) {
    case 'TRUSTED':
      return colors.trusted;
    case 'DEGRADED':
      return colors.caution;
    case 'RECOVERING':
      return colors.recovering;
    case 'DENIED':
      return colors.denied;
    case 'NETWORK':
      return colors.network;
    default:
      return colors.offline;
  }
}
