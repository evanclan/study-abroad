import type { CourseSlug, SupportedCountryCode } from '@/types/quote';

// Centralised display labels so columns and the recent-quotes rail all show
// identical strings.

export const COUNTRY_LABELS_JA: Record<SupportedCountryCode, string> = {
  AU: 'オーストラリア',
  US: 'アメリカ',
  GB: 'イギリス',
  CA: 'カナダ',
  NZ: 'ニュージーランド',
  IE: 'アイルランド',
  MT: 'マルタ',
  PH: 'フィリピン',
  JP: '日本',
};

export const COUNTRY_LABELS_EN: Record<SupportedCountryCode, string> = {
  AU: 'Australia',
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  NZ: 'New Zealand',
  IE: 'Ireland',
  MT: 'Malta',
  PH: 'Philippines',
  JP: 'Japan',
};

export const COUNTRY_FLAGS: Record<SupportedCountryCode, string> = {
  AU: '🇦🇺',
  US: '🇺🇸',
  GB: '🇬🇧',
  CA: '🇨🇦',
  NZ: '🇳🇿',
  IE: '🇮🇪',
  MT: '🇲🇹',
  PH: '🇵🇭',
  JP: '🇯🇵',
};

export const COUNTRY_CURRENCY: Record<SupportedCountryCode, string> = {
  AU: 'AUD',
  US: 'USD',
  GB: 'GBP',
  CA: 'CAD',
  NZ: 'NZD',
  IE: 'EUR',
  MT: 'EUR',
  PH: 'PHP',
  JP: 'JPY',
};

export const COURSE_LABELS_JA: Record<CourseSlug, string> = {
  summer_camp: 'サマーキャンプ',
  highschool: '高校留学',
  language_school: '語学学校',
  university: '大学・大学院',
  vocational: '専門学校',
};

export const COURSE_LABELS_EN: Record<CourseSlug, string> = {
  summer_camp: 'Summer Camp',
  highschool: 'High School',
  language_school: 'Language School',
  university: 'University',
  vocational: 'Vocational',
};
