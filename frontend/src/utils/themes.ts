export interface Theme {
  primary: string[];
  secondary: string[];
  textColor: string;
  accentColor: string;
  bannerText: string;
  saleText: string;
  headerTextColor: string;
}

export const themes: Record<string, Theme> = {
  all: {
    primary: [
      'var(--customer-primary)', 
      'var(--customer-primary-light)', 
      'var(--customer-primary-lighter)', 
      'var(--customer-primary-alpha-10)'
    ],
    secondary: [
      'var(--customer-primary-alpha-10)', 
      'var(--customer-primary-alpha-20)', 
      'var(--customer-primary-alpha-30)'
    ],
    textColor: 'var(--customer-text)',
    accentColor: 'var(--customer-primary)',
    bannerText: 'HOUSEFULL',
    saleText: 'SALE',
    headerTextColor: 'var(--customer-primary-text)',
  },
  wedding: {
    primary: ['rgb(252, 165, 165)', 'rgb(253, 182, 182)', 'rgb(254, 202, 202)', 'rgb(255, 228, 228)'],
    secondary: ['rgb(255, 228, 228)', 'rgb(254, 202, 202)', 'rgb(253, 182, 182)'],
    textColor: '#7f1d1d',
    accentColor: '#991b1b',
    bannerText: 'WEDDING',
    saleText: 'SALE',
    headerTextColor: '#7f1d1d',
  },
  winter: {
    primary: ['rgb(186, 230, 253)', 'rgb(191, 234, 255)', 'rgb(207, 250, 254)', 'rgb(224, 242, 254)'],
    secondary: ['rgb(224, 242, 254)', 'rgb(207, 250, 254)', 'rgb(191, 234, 255)'],
    textColor: '#0c4a6e',
    accentColor: '#075985',
    bannerText: 'WINTER',
    saleText: 'SALE',
    headerTextColor: '#0c4a6e',
  },
  electronics: {
    primary: ['rgb(253, 224, 71)', 'rgb(253, 230, 138)', 'rgb(254, 240, 138)', 'rgb(254, 249, 195)'],
    secondary: ['rgb(254, 249, 195)', 'rgb(254, 240, 138)', 'rgb(253, 230, 138)'],
    textColor: '#713f12',
    accentColor: '#854d0e',
    bannerText: 'ELECTRONICS',
    saleText: 'SALE',
    headerTextColor: '#713f12',
  },
  beauty: {
    primary: ['rgb(251, 207, 232)', 'rgb(252, 218, 238)', 'rgb(253, 224, 239)', 'rgb(254, 240, 246)'],
    secondary: ['rgb(254, 240, 246)', 'rgb(253, 224, 239)', 'rgb(252, 218, 238)'],
    textColor: '#831843',
    accentColor: '#9f1239',
    bannerText: 'BEAUTY',
    saleText: 'SALE',
    headerTextColor: '#831843',
  },
  grocery: {
    primary: ['rgb(187, 247, 208)', 'rgb(209, 250, 229)', 'rgb(220, 252, 231)', 'rgb(236, 253, 245)'],
    secondary: ['rgb(236, 253, 245)', 'rgb(220, 252, 231)', 'rgb(209, 250, 229)'],
    textColor: '#14532d',
    accentColor: '#166534',
    bannerText: 'GROCERY',
    saleText: 'SALE',
    headerTextColor: '#14532d',
  },
  fashion: {
    primary: ['rgb(196, 181, 253)', 'rgb(205, 192, 255)', 'rgb(221, 214, 254)', 'rgb(237, 233, 254)'],
    secondary: ['rgb(237, 233, 254)', 'rgb(221, 214, 254)', 'rgb(205, 192, 255)'],
    textColor: '#4c1d95',
    accentColor: '#5b21b6',
    bannerText: 'FASHION',
    saleText: 'SALE',
    headerTextColor: '#4c1d95',
  },
  sports: {
    primary: ['rgb(147, 197, 253)', 'rgb(165, 208, 255)', 'rgb(191, 219, 254)', 'rgb(219, 234, 254)'],
    secondary: ['rgb(219, 234, 254)', 'rgb(191, 219, 254)', 'rgb(165, 208, 255)'],
    textColor: '#1e3a8a',
    accentColor: '#1e40af',
    bannerText: 'SPORTS',
    saleText: 'SALE',
    headerTextColor: '#1e3a8a',
  },
  orange: {
    primary: ['rgb(251, 146, 60)', 'rgb(253, 186, 116)', 'rgb(254, 215, 170)', 'rgb(255, 237, 213)'],
    secondary: ['rgb(255, 237, 213)', 'rgb(254, 215, 170)', 'rgb(253, 186, 116)'],
    textColor: '#9a3412',
    accentColor: '#c2410c',
    bannerText: 'AUTUMN',
    saleText: 'SALE',
    headerTextColor: '#7c2d12',
  },
  violet: {
    primary: ['rgb(167, 139, 250)', 'rgb(196, 181, 253)', 'rgb(221, 214, 254)', 'rgb(237, 233, 254)'],
    secondary: ['rgb(237, 233, 254)', 'rgb(221, 214, 254)', 'rgb(196, 181, 253)'],
    textColor: '#4c1d95',
    accentColor: '#5b21b6',
    bannerText: 'VIOLET',
    saleText: 'SALE',
    headerTextColor: '#2e1065',
  },
  teal: {
    primary: ['rgb(45, 212, 191)', 'rgb(94, 234, 212)', 'rgb(153, 246, 228)', 'rgb(204, 251, 241)'],
    secondary: ['rgb(204, 251, 241)', 'rgb(153, 246, 228)', 'rgb(94, 234, 212)'],
    textColor: '#115e59',
    accentColor: '#0f766e',
    bannerText: 'TEAL',
    saleText: 'SALE',
    headerTextColor: '#134e4a',
  },
  dark: {
    primary: ['rgb(75, 85, 99)', 'rgb(107, 114, 128)', 'rgb(156, 163, 175)', 'rgb(209, 213, 219)'],
    secondary: ['rgb(209, 213, 219)', 'rgb(156, 163, 175)', 'rgb(107, 114, 128)'],
    textColor: '#ffffff',
    accentColor: '#1f2937',
    bannerText: 'DARK',
    saleText: 'SALE',
    headerTextColor: '#000000',
  },
  hotpink: {
    primary: ['rgb(244, 114, 182)', 'rgb(249, 168, 212)', 'rgb(251, 207, 232)', 'rgb(253, 224, 239)'],
    secondary: ['rgb(253, 224, 239)', 'rgb(251, 207, 232)', 'rgb(249, 168, 212)'],
    textColor: '#831843',
    accentColor: '#9d174d',
    bannerText: 'PINK',
    saleText: 'SALE',
    headerTextColor: '#831843',
  },
  gold: {
    primary: ['rgb(250, 204, 21)', 'rgb(253, 224, 71)', 'rgb(254, 240, 138)', 'rgb(254, 249, 195)'],
    secondary: ['rgb(254, 249, 195)', 'rgb(254, 240, 138)', 'rgb(253, 224, 71)'],
    textColor: '#854d0e',
    accentColor: '#a16207',
    bannerText: 'GOLD',
    saleText: 'SALE',
    headerTextColor: '#713f12',
  },
};

const isHexColor = (value: string): boolean => {
  const s = value.trim();
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(s);
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const s = hex.trim().replace("#", "");
  if (s.length === 3) {
    const r = parseInt(s[0] + s[0], 16);
    const g = parseInt(s[1] + s[1], 16);
    const b = parseInt(s[2] + s[2], 16);
    return { r, g, b };
  }
  if (s.length === 6) {
    const r = parseInt(s.slice(0, 2), 16);
    const g = parseInt(s.slice(2, 4), 16);
    const b = parseInt(s.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
};

const pickReadableTextColor = (bgHex: string): string => {
  const rgb = hexToRgb(bgHex);
  if (!rgb) return "#1a1a1a";
  // Relative luminance (simple)
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.6 ? "#1a1a1a" : "#ffffff";
};

export const getTheme = (tabId: string): Theme => {
  if (tabId && isHexColor(tabId)) {
    const headerTextColor = pickReadableTextColor(tabId);
    const textColor = headerTextColor === "#ffffff" ? "#ffffff" : "#1a1a1a";
    return {
      primary: [tabId, tabId, tabId, tabId],
      secondary: [tabId, tabId, tabId],
      textColor,
      accentColor: tabId,
      bannerText: "CUSTOM",
      saleText: "SALE",
      headerTextColor,
    };
  }
  return themes[tabId] || themes.all;
};
