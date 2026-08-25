/**
 * Conjunto de ícones inline (traço, estilo Lucide — 24×24, stroke 1.75).
 * Inline por decisão de performance: zero requisição, zero JS.
 * A copy original usa emoji; o design system da Hive proíbe emoji como ícone.
 */
export const ICON_PATHS = {
  store: `<path d="M3 9.5 4.6 4.7A1.5 1.5 0 0 1 6 3.7h12a1.5 1.5 0 0 1 1.4 1L21 9.5"/><path d="M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7.5"/><path d="M9.5 21v-5h5v5"/>`,
  restaurant: `<path d="M6 3v8a2.5 2.5 0 0 0 5 0V3"/><path d="M8.5 11v10"/><path d="M17.5 3c-1.4 1.4-2 3.2-2 5.5s.6 3.5 2 3.5"/><path d="M17.5 12v9"/>`,
  gym: `<path d="M2.5 10v4"/><path d="M6 7v10"/><path d="M18 7v10"/><path d="M21.5 10v4"/><path d="M6 12h12"/>`,
  market: `<path d="M3 4h2.2l2 11.2a1.5 1.5 0 0 0 1.5 1.3h8.6a1.5 1.5 0 0 0 1.5-1.2L20.5 8H6"/><circle cx="9.5" cy="20" r="1.2"/><circle cx="17.5" cy="20" r="1.2"/>`,
  company: `<path d="M3 21h18"/><path d="M5 21V5.5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 15 5.5V21"/><path d="M15 21V10h3.5A1.5 1.5 0 0 1 20 11.5V21"/><path d="M8 8h4M8 12h4M8 16h4"/>`,
  workshop: `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>`,
  clinic: `<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6"/><path d="M12 10v6M9 13h6"/>`,
  hotel: `<path d="M3 20V6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5V20"/><path d="M2 20h20"/><path d="M8 9h.01M12 9h.01M16 9h.01M8 13h.01M12 13h.01M16 13h.01"/><path d="M10 20v-3.5h4V20"/>`,
  home: `<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9.8V20h13V9.8"/><path d="M10 20v-6h4v6"/>`,
  check: `<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>`,
  "arrow-right": `<path d="M4.5 12h15"/><path d="M13.5 6l6 6-6 6"/>`,
  "arrow-down": `<path d="M12 4.5v15"/><path d="M6 13.5l6 6 6-6"/>`,
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M22 12h-2.5M4.5 12H2M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8M19.1 19.1l-1.8-1.8M6.7 6.7 4.9 4.9"/>`,
  grid: `<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>`,
  plug: `<path d="M9 2.5v6M15 2.5v6"/><path d="M6 8.5h12v3a6 6 0 0 1-6 6 6 6 0 0 1-6-6z"/><path d="M12 17.5V22"/>`,
  wallet: `<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a1 1 0 0 1 1 1v2"/><rect x="3" y="7.5" width="18" height="12.5" rx="2.5"/><path d="M16.5 14h.01"/>`,
  repeat: `<path d="M3.5 9.5A5 5 0 0 1 8.5 5H20"/><path d="M16.5 1.5 20 5l-3.5 3.5"/><path d="M20.5 14.5a5 5 0 0 1-5 4.5H4"/><path d="M7.5 22.5 4 19l3.5-3.5"/>`,
  users: `<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16.5 5.2a3.5 3.5 0 0 1 0 6.6"/><path d="M18 14.6a6.5 6.5 0 0 1 3.5 5.4"/>`,
  message: `<path d="M20.5 12a8 8 0 0 1-11.7 7.1L3.5 20.5l1.4-5.3A8 8 0 1 1 20.5 12z"/>`,
  calendar: `<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4M16 3v4"/>`,
  trending: `<path d="M3 17.5 9.5 11l4 4L21 7.5"/><path d="M15.5 7.5H21V13"/>`,
  clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.4 2"/>`,
  play: `<path d="M8 5.5v13l11-6.5z"/>`,
} as const;

export type IconName = keyof typeof ICON_PATHS;
