import { AGE_BRACKETS, type AgeBracket } from '@/types/quote';

interface BracketRange {
  bracket: AgeBracket;
  min: number;
  max: number;
}

const RANGES: BracketRange[] = [
  { bracket: '0-12', min: 0, max: 12 },
  { bracket: '13-15', min: 13, max: 15 },
  { bracket: '16-18', min: 16, max: 18 },
  { bracket: '19-25', min: 19, max: 25 },
  { bracket: '26+', min: 26, max: 200 },
];

export function ageToBracket(age: number): AgeBracket {
  const safeAge = Math.max(0, Math.floor(age));
  const found = RANGES.find((r) => safeAge >= r.min && safeAge <= r.max);
  return found?.bracket ?? '26+';
}

export function isAgeBracket(value: string): value is AgeBracket {
  return (AGE_BRACKETS as readonly string[]).includes(value);
}
