import type { QuoteParams, SupportedCountryCode } from '@/types/quote';

// All in JPY. Coarse estimates derived from かえる留学's published guides.

const FLIGHT_ROUND_TRIP_JPY: Record<SupportedCountryCode, number> = {
  AU: 130_000,
  US: 150_000,
  GB: 180_000,
  CA: 160_000,
  NZ: 140_000,
  IE: 180_000,
  MT: 200_000,
  PH: 50_000,
  JP: 30_000,
};

const DAILY_LIVING_JPY: Record<SupportedCountryCode, number> = {
  AU: 8_000,
  US: 9_000,
  GB: 10_000,
  CA: 8_000,
  NZ: 7_500,
  IE: 9_000,
  MT: 7_000,
  PH: 3_500,
  JP: 6_000,
};

const VISA_JPY: Record<SupportedCountryCode, number> = {
  AU: 60_000, // student visa
  US: 30_000, // ESTA + I-901 for short stays
  GB: 50_000,
  CA: 40_000,
  NZ: 50_000,
  IE: 40_000,
  MT: 30_000,
  PH: 0, // visa-free up to 30 days
  JP: 0, // visa-free for short stays for many nationals
};

const INSURANCE_PER_WEEK_JPY = 8_000;

export interface ExtrasEstimate {
  flights: number;
  insurance: number;
  visa: number;
  livingExpenses: number;
}

/**
 * Add rolled-up extras the school page never lists: flights, insurance, visa,
 * and a daily-living envelope based on the destination's cost of living.
 *
 * If the student is going to Japan from Japan (domestic) we keep flights low.
 * Visa is automatically waived for short stays under 30 days in JP/PH.
 */
export function estimateExtras(params: QuoteParams): ExtrasEstimate {
  const country = params.countryCode;
  const days = Math.max(1, params.durationWeeks * 7);

  const flights = params.durationWeeks <= 1
    ? Math.round(FLIGHT_ROUND_TRIP_JPY[country] * 0.85) // last-minute, short trip
    : FLIGHT_ROUND_TRIP_JPY[country];

  const insurance = Math.round(params.durationWeeks * INSURANCE_PER_WEEK_JPY);

  const visa = params.durationWeeks <= 4 && (country === 'JP' || country === 'PH')
    ? 0
    : VISA_JPY[country];

  const livingExpenses = days * DAILY_LIVING_JPY[country];

  return { flights, insurance, visa, livingExpenses };
}
