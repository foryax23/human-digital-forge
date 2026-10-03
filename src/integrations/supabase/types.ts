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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_leads: {
        Row: {
          answers: Json
          company: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          language: string
          recommendation: string | null
          recommended_tier: string | null
          score: number
        }
        Insert: {
          answers?: Json
          company?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          language?: string
          recommendation?: string | null
          recommended_tier?: string | null
          score?: number
        }
        Update: {
          answers?: Json
          company?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          language?: string
          recommendation?: string | null
          recommended_tier?: string | null
          score?: number
        }
        Relationships: []
      }
      consultations: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          scheduled_at: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          scheduled_at?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          scheduled_at?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_enquiries: {
        Row: {
          budget: string | null
          client_type: string | null
          created_at: string
          description: string
          email: string
          full_name: string
          id: string
          service: string | null
          timeline: string | null
        }
        Insert: {
          budget?: string | null
          client_type?: string | null
          created_at?: string
          description: string
          email: string
          full_name: string
          id?: string
          service?: string | null
          timeline?: string | null
        }
        Update: {
          budget?: string | null
          client_type?: string | null
          created_at?: string
          description?: string
          email?: string
          full_name?: string
          id?: string
          service?: string | null
          timeline?: string | null
        }
        Relationships: []
      }
      deep_breaker: {
        Row: {
          id: number
          reason: string | null
          until: string
        }
        Insert: {
          id?: number
          reason?: string | null
          until?: string
        }
        Update: {
          id?: number
          reason?: string | null
          until?: string
        }
        Relationships: []
      }
      deep_call_requests: {
        Row: {
          call_when: string
          created_at: string
          cui: string | null
          email: string | null
          id: string
          lang: string | null
          phone: string
          run_id: string
          user_id: string
        }
        Insert: {
          call_when: string
          created_at?: string
          cui?: string | null
          email?: string | null
          id?: string
          lang?: string | null
          phone: string
          run_id: string
          user_id: string
        }
        Update: {
          call_when?: string
          created_at?: string
          cui?: string | null
          email?: string | null
          id?: string
          lang?: string | null
          phone?: string
          run_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deep_call_requests_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "deep_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      deep_calls: {
        Row: {
          attempt: number
          created_at: string
          id: string
          idem_key: string
          kind: string | null
          model: string | null
          reserved_usd: number
          result: Json | null
          run_id: string
          status: string
          step: string | null
          usage: Json | null
          usd: number
        }
        Insert: {
          attempt: number
          created_at?: string
          id?: string
          idem_key: string
          kind?: string | null
          model?: string | null
          reserved_usd?: number
          result?: Json | null
          run_id: string
          status?: string
          step?: string | null
          usage?: Json | null
          usd?: number
        }
        Update: {
          attempt?: number
          created_at?: string
          id?: string
          idem_key?: string
          kind?: string | null
          model?: string | null
          reserved_usd?: number
          result?: Json | null
          run_id?: string
          status?: string
          step?: string | null
          usage?: Json | null
          usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "deep_calls_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "deep_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      deep_claims: {
        Row: {
          exclusive: boolean
          id: string
          key: string
          run_id: string
          units: number
        }
        Insert: {
          exclusive?: boolean
          id?: string
          key: string
          run_id: string
          units: number
        }
        Update: {
          exclusive?: boolean
          id?: string
          key?: string
          run_id?: string
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "deep_claims_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "deep_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      deep_feedback: {
        Row: {
          created_at: string
          fact_id: string | null
          id: string
          kind: string
          message: string | null
          run_id: string
          user_id: string
          value: Json | null
        }
        Insert: {
          created_at?: string
          fact_id?: string | null
          id?: string
          kind: string
          message?: string | null
          run_id: string
          user_id: string
          value?: Json | null
        }
        Update: {
          created_at?: string
          fact_id?: string | null
          id?: string
          kind?: string
          message?: string | null
          run_id?: string
          user_id?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "deep_feedback_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "deep_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      deep_runs: {
        Row: {
          ai_mode: string
          budget_usd: number
          company_name: string | null
          consent: Json | null
          created_at: string
          cui: string
          error: string | null
          id: string
          lang: string
          last_activity_at: string
          metrics: Json | null
          relationship: string | null
          report: Json | null
          report_att: string | null
          reserved_usd: number
          spent_usd: number
          status: string
          user_id: string
          verify_code: string | null
          via: string
        }
        Insert: {
          ai_mode?: string
          budget_usd?: number
          company_name?: string | null
          consent?: Json | null
          created_at?: string
          cui: string
          error?: string | null
          id?: string
          lang?: string
          last_activity_at?: string
          metrics?: Json | null
          relationship?: string | null
          report?: Json | null
          report_att?: string | null
          reserved_usd?: number
          spent_usd?: number
          status?: string
          user_id: string
          verify_code?: string | null
          via: string
        }
        Update: {
          ai_mode?: string
          budget_usd?: number
          company_name?: string | null
          consent?: Json | null
          created_at?: string
          cui?: string
          error?: string | null
          id?: string
          lang?: string
          last_activity_at?: string
          metrics?: Json | null
          relationship?: string | null
          report?: Json | null
          report_att?: string | null
          reserved_usd?: number
          spent_usd?: number
          status?: string
          user_id?: string
          verify_code?: string | null
          via?: string
        }
        Relationships: []
      }
      deep_slots: {
        Row: {
          in_flight_at: string | null
          key: string
          result: Json | null
          run_id: string
          used: number
        }
        Insert: {
          in_flight_at?: string | null
          key: string
          result?: Json | null
          run_id: string
          used?: number
        }
        Update: {
          in_flight_at?: string | null
          key?: string
          result?: Json | null
          run_id?: string
          used?: number
        }
        Relationships: [
          {
            foreignKeyName: "deep_slots_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "deep_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          description: string | null
          due_at: string | null
          id: string
          invoice_number: string
          issued_at: string
          paid_at: string | null
          project_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          currency?: string
          description?: string | null
          due_at?: string | null
          id?: string
          invoice_number: string
          issued_at?: string
          paid_at?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          description?: string | null
          due_at?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string
          paid_at?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          project_id: string | null
          read: boolean
          sender: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          project_id?: string | null
          read?: boolean
          sender?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          project_id?: string | null
          read?: boolean
          sender?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          client_type: string | null
          company: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          client_type?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          client_type?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_files: {
        Row: {
          created_at: string
          description: string | null
          file_path: string | null
          id: string
          name: string
          project_id: string | null
          size_bytes: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          name: string
          project_id?: string | null
          size_bytes?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          name?: string
          project_id?: string | null
          size_bytes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget: string | null
          created_at: string
          current_step: number
          description: string | null
          id: string
          next_action: string | null
          service_type: string | null
          status: string
          timeline: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          budget?: string | null
          created_at?: string
          current_step?: number
          description?: string | null
          id?: string
          next_action?: string | null
          service_type?: string | null
          status?: string
          timeline?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          budget?: string | null
          created_at?: string
          current_step?: number
          description?: string | null
          id?: string
          next_action?: string | null
          service_type?: string | null
          status?: string
          timeline?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          created_at: string
          current_period_end: string | null
          email: string
          id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          email: string
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          email?: string
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_admin_role: { Args: never; Returns: boolean }
      deep_claim_step: {
        Args: {
          p_exclusive: boolean
          p_key: string
          p_max: number
          p_run: string
          p_units: number
          p_user: string
        }
        Returns: Json
      }
      deep_finish: {
        Args: {
          p_att: string
          p_code: string
          p_error: string
          p_metrics: Json
          p_report: Json
          p_run: string
          p_status: string
        }
        Returns: undefined
      }
      deep_reserve: {
        Args: {
          p_day_cap: number
          p_day_start: string
          p_key: string
          p_kind: string
          p_model: string
          p_run: string
          p_step: string
          p_usd: number
        }
        Returns: Json
      }
      deep_settle: {
        Args: { p_call: string; p_result: Json; p_usage: Json; p_usd: number }
        Returns: undefined
      }
      deep_settle_step: {
        Args: { p_claim: string; p_result: Json; p_run: string; p_used: number }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
