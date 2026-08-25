// Generated from Supabase project uexhvfkfcoyiuabkinfx after WU-10.
// Regenerate after every database migration; do not edit schema types by hand.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      creator_channels: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_allowlisted: boolean
          metadata_fetched_at: string
          subscriber_count: number | null
          subscriber_count_fetched_at: string | null
          subscriber_count_hidden: boolean
          thumbnail_url: string | null
          title: string
          updated_at: string
          uploads_playlist_id: string | null
          youtube_channel_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_allowlisted?: boolean
          metadata_fetched_at: string
          subscriber_count?: number | null
          subscriber_count_fetched_at?: string | null
          subscriber_count_hidden?: boolean
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          uploads_playlist_id?: string | null
          youtube_channel_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_allowlisted?: boolean
          metadata_fetched_at?: string
          subscriber_count?: number | null
          subscriber_count_fetched_at?: string | null
          subscriber_count_hidden?: boolean
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          uploads_playlist_id?: string | null
          youtube_channel_id?: string
        }
        Relationships: []
      }
      creator_videos: {
        Row: {
          created_at: string
          creator_channel_id: string
          description_excerpt: string | null
          id: string
          is_active: boolean
          metadata_fetched_at: string
          privacy_status: string
          published_at: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          youtube_video_id: string
        }
        Insert: {
          created_at?: string
          creator_channel_id: string
          description_excerpt?: string | null
          id?: string
          is_active?: boolean
          metadata_fetched_at: string
          privacy_status: string
          published_at: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          youtube_video_id: string
        }
        Update: {
          created_at?: string
          creator_channel_id?: string
          description_excerpt?: string | null
          id?: string
          is_active?: boolean
          metadata_fetched_at?: string
          privacy_status?: string
          published_at?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          youtube_video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_videos_creator_channel_id_fkey"
            columns: ["creator_channel_id"]
            isOneToOne: false
            referencedRelation: "creator_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_visit_evidence: {
        Row: {
          confirmation_note: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          creator_video_id: string
          id: string
          last_verified_at: string | null
          restaurant_id: string
          status: string
          updated_at: string
          video_timestamp_seconds: number | null
        }
        Insert: {
          confirmation_note?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          creator_video_id: string
          id?: string
          last_verified_at?: string | null
          restaurant_id: string
          status?: string
          updated_at?: string
          video_timestamp_seconds?: number | null
        }
        Update: {
          confirmation_note?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          creator_video_id?: string
          id?: string
          last_verified_at?: string | null
          restaurant_id?: string
          status?: string
          updated_at?: string
          video_timestamp_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_visit_evidence_creator_video_id_fkey"
            columns: ["creator_video_id"]
            isOneToOne: false
            referencedRelation: "creator_videos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_visit_evidence_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      reaction_events: {
        Row: {
          actor_user_id: string | null
          after_kind: string | null
          before_kind: string | null
          created_at: string
          event_name: string
          id: number
          reaction_id: string
          reason_codes: string[]
        }
        Insert: {
          actor_user_id?: string | null
          after_kind?: string | null
          before_kind?: string | null
          created_at?: string
          event_name: string
          id?: never
          reaction_id: string
          reason_codes?: string[]
        }
        Update: {
          actor_user_id?: string | null
          after_kind?: string | null
          before_kind?: string | null
          created_at?: string
          event_name?: string
          id?: never
          reaction_id?: string
          reason_codes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "reaction_events_reaction_id_fkey"
            columns: ["reaction_id"]
            isOneToOne: false
            referencedRelation: "restaurant_reactions"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_reaction_summaries: {
        Row: {
          counted_total: number
          dislike_count: number
          like_count: number
          okay_count: number
          restaurant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          counted_total?: number
          dislike_count?: number
          like_count?: number
          okay_count?: number
          restaurant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          counted_total?: number
          dislike_count?: number
          like_count?: number
          okay_count?: number
          restaurant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_reaction_summaries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_reactions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          kind: string
          moderation_status: string
          restaurant_id: string
          risk_codes: string[]
          updated_at: string
          user_id: string
          visit_proof_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind: string
          moderation_status?: string
          restaurant_id: string
          risk_codes?: string[]
          updated_at?: string
          user_id: string
          visit_proof_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          moderation_status?: string
          restaurant_id?: string
          risk_codes?: string[]
          updated_at?: string
          user_id?: string
          visit_proof_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_reactions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_reactions_visit_proof_owner_fk"
            columns: ["visit_proof_id", "user_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "visit_proofs"
            referencedColumns: ["id", "user_id", "restaurant_id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address_name: string
          category_name: string
          created_at: string
          food_tags: string[]
          id: string
          is_active: boolean
          kakao_place_id: string
          latitude: number
          longitude: number
          name: string
          preference_profile: Json
          road_address_name: string | null
          updated_at: string
        }
        Insert: {
          address_name: string
          category_name: string
          created_at?: string
          food_tags?: string[]
          id?: string
          is_active?: boolean
          kakao_place_id: string
          latitude: number
          longitude: number
          name: string
          preference_profile?: Json
          road_address_name?: string | null
          updated_at?: string
        }
        Update: {
          address_name?: string
          category_name?: string
          created_at?: string
          food_tags?: string[]
          id?: string
          is_active?: boolean
          kakao_place_id?: string
          latitude?: number
          longitude?: number
          name?: string
          preference_profile?: Json
          road_address_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      visit_proofs: {
        Row: {
          created_at: string
          evidence_digest: string
          expires_at: string
          id: string
          method: string
          restaurant_id: string
          status: string
          used_at: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          evidence_digest: string
          expires_at: string
          id?: string
          method: string
          restaurant_id: string
          status: string
          used_at?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          evidence_digest?: string
          expires_at?: string
          id?: string
          method?: string
          restaurant_id?: string
          status?: string
          used_at?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visit_proofs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_sync_runs: {
        Row: {
          api_request_count: number
          candidate_count: number
          error_summary: string | null
          finished_at: string | null
          id: string
          processed_video_count: number
          started_at: string
          status: string
          trigger_kind: string
        }
        Insert: {
          api_request_count?: number
          candidate_count?: number
          error_summary?: string | null
          finished_at?: string | null
          id?: string
          processed_video_count?: number
          started_at?: string
          status?: string
          trigger_kind: string
        }
        Update: {
          api_request_count?: number
          candidate_count?: number
          error_summary?: string | null
          finished_at?: string | null
          id?: string
          processed_video_count?: number
          started_at?: string
          status?: string
          trigger_kind?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_youtube_sync_run: {
        Args: { p_started_at: string; p_trigger_kind: string }
        Returns: string
      }
      enforce_reaction_abuse_guard: {
        Args: {
          p_action: string
          p_network_hash: string
          p_observed_at?: string
          p_restaurant_id: string
          p_user_id: string
        }
        Returns: {
          config_version: string
          is_allowed: boolean
          retry_after_seconds: number
          risk_codes: string[]
        }[]
      }
      issue_location_visit_proof: {
        Args: {
          p_accuracy_meters: number
          p_checked_at?: string
          p_evidence_digest: string
          p_restaurant_id: string
          p_user_id: string
          p_user_latitude: number
          p_user_longitude: number
        }
        Returns: {
          config_version: string
          expires_at: string
          is_valid: boolean
          reason_code: string
          verified_at: string
          visit_proof_id: string
        }[]
      }
      save_reaction_selection: {
        Args: { p_kind: string; p_restaurant_id: string; p_user_id: string }
        Returns: {
          moderation_status: string
          reaction_id: string
          reaction_kind: string
          saved_at: string
          was_changed: boolean
          was_created: boolean
        }[]
      }
      save_reaction_with_visit_proof: {
        Args: {
          p_checked_at?: string
          p_evidence_digest: string
          p_kind: string
          p_restaurant_id: string
          p_user_id: string
        }
        Returns: {
          moderation_status: string
          reaction_id: string
          reaction_kind: string
          saved_at: string
          was_changed: boolean
          was_created: boolean
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
