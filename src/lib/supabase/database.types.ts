// Typed schema for the kaeru-support-ai local Supabase instance.
//
// This file mirrors `supabase/migrations/20260519000001_init.sql`. After the
// developer runs `supabase start`, it can be regenerated with:
//
//   supabase gen types typescript --local > src/lib/supabase/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      countries: {
        Row: {
          code: string;
          name_ja: string;
          name_en: string;
          currency_code: string;
        };
        Insert: {
          code: string;
          name_ja: string;
          name_en: string;
          currency_code: string;
        };
        Update: Partial<Database['public']['Tables']['countries']['Insert']>;
        Relationships: [];
      };
      course_types: {
        Row: {
          slug: string;
          name_ja: string;
          name_en: string;
        };
        Insert: {
          slug: string;
          name_ja: string;
          name_en: string;
        };
        Update: Partial<Database['public']['Tables']['course_types']['Insert']>;
        Relationships: [];
      };
      schools: {
        Row: {
          id: string;
          country_code: string;
          name: string;
          source_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          country_code: string;
          name: string;
          source_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['schools']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'schools_country_code_fkey';
            columns: ['country_code'];
            isOneToOne: false;
            referencedRelation: 'countries';
            referencedColumns: ['code'];
          },
        ];
      };
      quote_cache: {
        Row: {
          id: string;
          country_code: string;
          course_slug: string;
          age_bracket: string;
          duration_months: number;
          school_id: string | null;
          school_name: string | null;
          source_url: string | null;
          currency_code: string;
          tuition: number;
          accommodation: number;
          registration: number;
          other_fees: number;
          total: number;
          ai_summary_ja: string | null;
          ai_suggestions_ja: Json | null;
          raw_extraction: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          country_code: string;
          course_slug: string;
          age_bracket: string;
          duration_months: number;
          school_id?: string | null;
          school_name?: string | null;
          source_url?: string | null;
          currency_code: string;
          tuition?: number;
          accommodation?: number;
          registration?: number;
          other_fees?: number;
          ai_summary_ja?: string | null;
          ai_suggestions_ja?: Json | null;
          raw_extraction?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['quote_cache']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'quote_cache_country_code_fkey';
            columns: ['country_code'];
            isOneToOne: false;
            referencedRelation: 'countries';
            referencedColumns: ['code'];
          },
          {
            foreignKeyName: 'quote_cache_course_slug_fkey';
            columns: ['course_slug'];
            isOneToOne: false;
            referencedRelation: 'course_types';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'quote_cache_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
        ];
      };
      fx_rates: {
        Row: {
          base: string;
          quote: string;
          rate: number;
          fetched_at: string;
        };
        Insert: {
          base: string;
          quote: string;
          rate: number;
          fetched_at?: string;
        };
        Update: Partial<Database['public']['Tables']['fx_rates']['Insert']>;
        Relationships: [];
      };
      quote_history: {
        Row: {
          id: string;
          prompt_text: string;
          parsed_params: Json;
          result_quote_id: string | null;
          source: 'local' | 'live_search';
          duration_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          prompt_text: string;
          parsed_params: Json;
          result_quote_id?: string | null;
          source: 'local' | 'live_search';
          duration_ms?: number | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['quote_history']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'quote_history_result_quote_id_fkey';
            columns: ['result_quote_id'];
            isOneToOne: false;
            referencedRelation: 'quote_cache';
            referencedColumns: ['id'];
          },
        ];
      };
      document_uploads: {
        Row: {
          id: string;
          filename: string;
          content_hash: string;
          mime_type: string;
          file_size_bytes: number;
          storage_bucket: string;
          storage_path: string;
          storage_signed_url: string | null;
          title: string | null;
          description: string | null;
          source_label: string | null;
          tags: string[];
          country_codes: string[];
          course_slugs: string[];
          school_name: string | null;
          city_or_region: string | null;
          currency_code: string | null;
          valid_from: string | null;
          valid_to: string | null;
          extracted_text: string | null;
          extracted_summary_ja: string | null;
          ai_keywords: string[];
          ai_confidence: number | null;
          status:
            | 'uploaded'
            | 'processing'
            | 'extracted'
            | 'analyzed'
            | 'failed'
            | 'archived';
          error_message: string | null;
          uploaded_by: string | null;
          uploaded_at: string;
          processed_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          filename: string;
          content_hash: string;
          mime_type: string;
          file_size_bytes?: number;
          storage_bucket?: string;
          storage_path: string;
          storage_signed_url?: string | null;
          title?: string | null;
          description?: string | null;
          source_label?: string | null;
          tags?: string[];
          country_codes?: string[];
          course_slugs?: string[];
          school_name?: string | null;
          city_or_region?: string | null;
          currency_code?: string | null;
          valid_from?: string | null;
          valid_to?: string | null;
          extracted_text?: string | null;
          extracted_summary_ja?: string | null;
          ai_keywords?: string[];
          ai_confidence?: number | null;
          status?:
            | 'uploaded'
            | 'processing'
            | 'extracted'
            | 'analyzed'
            | 'failed'
            | 'archived';
          error_message?: string | null;
          uploaded_by?: string | null;
          uploaded_at?: string;
          processed_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['document_uploads']['Insert']>;
        Relationships: [];
      };
      document_chunks: {
        Row: {
          id: string;
          document_id: string;
          chunk_index: number;
          content: string;
          token_estimate: number | null;
          page_number: number | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          chunk_index: number;
          content: string;
          token_estimate?: number | null;
          page_number?: number | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['document_chunks']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'document_chunks_document_id_fkey';
            columns: ['document_id'];
            isOneToOne: false;
            referencedRelation: 'document_uploads';
            referencedColumns: ['id'];
          },
        ];
      };
      extracted_entities: {
        Row: {
          id: string;
          document_id: string;
          entity_type:
            | 'school'
            | 'price'
            | 'campaign'
            | 'accommodation'
            | 'activity'
            | 'location'
            | 'rule'
            | 'contact'
            | 'program'
            | 'visa'
            | 'insurance'
            | 'flight'
            | 'note'
            | 'other';
          title: string;
          summary: string | null;
          body: string | null;
          country_code: string | null;
          course_slug: string | null;
          school_name: string | null;
          city_or_region: string | null;
          currency_code: string | null;
          amount: number | null;
          amount_unit: string | null;
          duration_weeks: number | null;
          age_bracket: string | null;
          valid_from: string | null;
          valid_to: string | null;
          data: Json;
          ai_confidence: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          entity_type:
            | 'school'
            | 'price'
            | 'campaign'
            | 'accommodation'
            | 'activity'
            | 'location'
            | 'rule'
            | 'contact'
            | 'program'
            | 'visa'
            | 'insurance'
            | 'flight'
            | 'note'
            | 'other';
          title: string;
          summary?: string | null;
          body?: string | null;
          country_code?: string | null;
          course_slug?: string | null;
          school_name?: string | null;
          city_or_region?: string | null;
          currency_code?: string | null;
          amount?: number | null;
          amount_unit?: string | null;
          duration_weeks?: number | null;
          age_bracket?: string | null;
          valid_from?: string | null;
          valid_to?: string | null;
          data?: Json;
          ai_confidence?: number | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['extracted_entities']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'extracted_entities_document_id_fkey';
            columns: ['document_id'];
            isOneToOne: false;
            referencedRelation: 'document_uploads';
            referencedColumns: ['id'];
          },
        ];
      };
      knowledge_search_log: {
        Row: {
          id: string;
          prompt_text: string;
          parsed_params: Json | null;
          match_count: number;
          top_match_id: string | null;
          used_in_response: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          prompt_text: string;
          parsed_params?: Json | null;
          match_count?: number;
          top_match_id?: string | null;
          used_in_response?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['knowledge_search_log']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      search_knowledge: {
        Args: {
          q: string;
          p_country_code?: string | null;
          p_course_slug?: string | null;
          p_age_bracket?: string | null;
          p_school_name?: string | null;
          p_city?: string | null;
          p_limit?: number;
        };
        Returns: {
          entity_id: string;
          document_id: string;
          entity_type: string;
          title: string;
          summary: string | null;
          body: string | null;
          country_code: string | null;
          course_slug: string | null;
          school_name: string | null;
          city_or_region: string | null;
          currency_code: string | null;
          amount: number | null;
          amount_unit: string | null;
          valid_from: string | null;
          valid_to: string | null;
          ai_confidence: number | null;
          data: Json;
          doc_filename: string;
          doc_mime_type: string;
          doc_storage_path: string;
          doc_title: string | null;
          doc_source_label: string | null;
          doc_tags: string[];
          score: number;
        }[];
      };
    };
  };
}
