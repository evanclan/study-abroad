'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import type {
  AccommodationOption,
  ActivityItem,
  BudgetFit,
  KnowledgeLookup,
  LocationIntel,
  QuoteCosts,
  QuoteParams,
  QuoteResult,
  ReferenceSource,
  SchoolCard,
  StreamEvent,
  StreamPhase,
} from '@/types/quote';

// =============================================================================
// State machine: every SSE event is folded into this immutable QuoteState.
// =============================================================================

export interface QuoteState {
  status: 'idle' | 'streaming' | 'done' | 'error';
  prompt: string | null;
  phase: StreamPhase | null;
  phaseMessage: string | null;
  params: QuoteParams | null;
  source: 'local' | 'live_search' | null;
  sourceUrl: string | null;
  schoolName: string | null;
  cachedAt: string | null;
  costs: QuoteCosts | null;
  insightSummary: string;
  insightSuggestions: string[];
  schools: SchoolCard[];
  accommodations: AccommodationOption[];
  activities: ActivityItem[];
  location: LocationIntel | null;
  budget: BudgetFit | null;
  references: ReferenceSource[];
  knowledge: KnowledgeLookup | null;
  result: QuoteResult | null;
  error: { message: string; phase: StreamPhase } | null;
}

const INITIAL_STATE: QuoteState = {
  status: 'idle',
  prompt: null,
  phase: null,
  phaseMessage: null,
  params: null,
  source: null,
  sourceUrl: null,
  schoolName: null,
  cachedAt: null,
  costs: null,
  insightSummary: '',
  insightSuggestions: [],
  schools: [],
  accommodations: [],
  activities: [],
  location: null,
  budget: null,
  references: [],
  knowledge: null,
  result: null,
  error: null,
};

type Action =
  | { type: 'start'; prompt: string }
  | { type: 'event'; event: StreamEvent }
  | { type: 'finish' }
  | { type: 'reset' }
  | { type: 'fail'; message: string };

function reducer(state: QuoteState, action: Action): QuoteState {
  switch (action.type) {
    case 'start':
      return {
        ...INITIAL_STATE,
        status: 'streaming',
        prompt: action.prompt,
      };
    case 'reset':
      return INITIAL_STATE;
    case 'finish':
      if (state.status === 'streaming') return { ...state, status: 'done' };
      return state;
    case 'fail':
      return {
        ...state,
        status: 'error',
        error: { message: action.message, phase: state.phase ?? 'done' },
      };
    case 'event':
      return applyEvent(state, action.event);
    default:
      return state;
  }
}

function applyEvent(state: QuoteState, event: StreamEvent): QuoteState {
  switch (event.type) {
    case 'phase':
      return { ...state, phase: event.phase, phaseMessage: event.message ?? null };
    case 'params':
      return { ...state, params: event.params };
    case 'source':
      return {
        ...state,
        source: event.source,
        sourceUrl: event.sourceUrl,
        schoolName: event.schoolName,
        cachedAt: event.cachedAt ?? state.cachedAt,
      };
    case 'costs':
      return { ...state, costs: event.costs };
    case 'schools':
      return { ...state, schools: event.schools };
    case 'accommodations':
      return { ...state, accommodations: event.accommodations };
    case 'activities':
      return { ...state, activities: event.activities };
    case 'location':
      return { ...state, location: event.location };
    case 'budget':
      return { ...state, budget: event.budget };
    case 'references':
      return { ...state, references: event.references };
    case 'knowledge':
      return { ...state, knowledge: event.knowledge };
    case 'insightDelta':
      return { ...state, insightSummary: state.insightSummary + event.text };
    case 'insightSuggestion':
      return {
        ...state,
        insightSuggestions: [...state.insightSuggestions, event.suggestion],
      };
    case 'done':
      return {
        ...state,
        status: 'done',
        result: event.result,
        params: event.result.params,
        costs: event.result.costs,
        insightSummary: event.result.aiInsights.summary || state.insightSummary,
        insightSuggestions:
          event.result.aiInsights.suggestions.length > 0
            ? event.result.aiInsights.suggestions
            : state.insightSuggestions,
        source: event.result.source,
        sourceUrl: event.result.sourceUrl,
        schoolName: event.result.schoolName,
        schools: event.result.schools.length ? event.result.schools : state.schools,
        accommodations: event.result.accommodations.length
          ? event.result.accommodations
          : state.accommodations,
        activities: event.result.activities.length ? event.result.activities : state.activities,
        location: event.result.location ?? state.location,
        budget: event.result.budgetFit ?? state.budget,
        references: event.result.references.length ? event.result.references : state.references,
        knowledge: event.result.knowledge ?? state.knowledge,
      };
    case 'error':
      return {
        ...state,
        status: 'error',
        error: { message: event.message, phase: event.phase },
      };
    default:
      return state;
  }
}

// =============================================================================
// Hook
// =============================================================================

export function useQuoteStream() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const controllerRef = useRef<AbortController | null>(null);

  const submit = useCallback(async (prompt: string) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    dispatch({ type: 'start', prompt });

    try {
      const response = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `Quote request failed (${response.status}).`);
      }

      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();

      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          const event = parseFrame(frame);
          if (event) dispatch({ type: 'event', event });
        }
      }
      if (buffer.trim().length > 0) {
        const event = parseFrame(buffer);
        if (event) dispatch({ type: 'event', event });
      }
      dispatch({ type: 'finish' });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      dispatch({
        type: 'fail',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    dispatch({ type: 'reset' });
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { state, submit, reset };
}

function parseFrame(frame: string): StreamEvent | null {
  const dataLine = frame.split('\n').find((line) => line.startsWith('data:'));
  if (!dataLine) return null;
  const payload = dataLine.slice('data:'.length).trim();
  if (!payload) return null;
  try {
    return JSON.parse(payload) as StreamEvent;
  } catch {
    return null;
  }
}
