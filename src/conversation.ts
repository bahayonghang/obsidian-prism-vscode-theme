/**
 * Independent color-only model of the inspected Google Antigravity theme bridge.
 * Facts/formulas: CLI 1.5.14, default internal contrast; see docs/ANTIGRAVITY.md.
 * This does not access or modify another extension's DOM, settings or messages.
 */
import { mix, type ColorTheme } from './theme';

export interface ConversationPreview {
  model: 'google-bridge-default-contrast';
  background: string;
  foreground: string;
  card: string;
  cardBorder: string;
  placeholder: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  link: string;
}

/**
 * Google's main chat sets agy.* from sideBar.*, then relays those as editor.*
 * and foreground. Its client derives cards from that canvas; input.* is relayed
 * but is not used by the inspected composer. Internal contrast or a future
 * client can change these derivations, so this remains a labeled schematic.
 */
export function createAntigravityPreview(theme: ColorTheme): ConversationPreview {
  const c = theme.colors;
  const background = c['sideBar.background'];
  const foreground = c['sideBar.foreground'];
  const dark = theme.type === 'dark';
  const card = dark ? mix(background, foreground, 0.05) : mix(background, '#FFFFFF', 0.30);
  return {
    model: 'google-bridge-default-contrast',
    background,
    foreground,
    card,
    cardBorder: mix(card, foreground, dark ? 0.05 : 0.075),
    // The actual composer placeholder is text-foreground at opacity 0.60 on
    // the card. The client's separate --placeholder color uses a different mix.
    placeholder: mix(card, foreground, 0.60),
    secondary: mix(background, foreground, dark ? 0.12 : 0.06),
    secondaryForeground: mix(background, foreground, 0.75),
    muted: mix(background, foreground, 0.025),
    mutedForeground: mix(background, foreground, 0.50),
    primary: c['button.background'],
    primaryForeground: c['button.foreground'],
    link: c['textLink.foreground'],
  };
}
