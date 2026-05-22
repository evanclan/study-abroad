// Centralised currency formatters. Two locales matter for the agency:
//   - ja-JP for JPY (always whole units, with comma grouping)
//   - the source country's locale for the secondary amount (AUD, USD, ...)
//
// We keep these helpers DRY so every column / atom shows numbers identically.

const jpyFormatter = new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
  maximumFractionDigits: 0,
});

const numericFormatters = new Map<string, Intl.NumberFormat>();

function getSourceFormatter(currencyCode: string): Intl.NumberFormat {
  const cached = numericFormatters.get(currencyCode);
  if (cached) return cached;
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  });
  numericFormatters.set(currencyCode, formatter);
  return formatter;
}

export function formatJpy(amount: number): string {
  return jpyFormatter.format(Math.round(amount));
}

export function formatSourceCurrency(amount: number, currencyCode: string): string {
  try {
    return getSourceFormatter(currencyCode).format(Math.round(amount));
  } catch {
    // Fallback when an unknown ISO currency code shows up.
    return `${currencyCode} ${Math.round(amount).toLocaleString('en-US')}`;
  }
}

export function formatRelativeJa(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}日前`;
  const months = Math.round(days / 30);
  return `${months}ヶ月前`;
}
