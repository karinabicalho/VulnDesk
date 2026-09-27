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
      companies: {
        Row: {
          created_at: string
          description: string
          id: string
          identifier: string
          name: string
          status: Database["public"]["Enums"]["company_status"]
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          identifier?: string
          name: string
          status?: Database["public"]["Enums"]["company_status"]
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          identifier?: string
          name?: string
          status?: Database["public"]["Enums"]["company_status"]
        }
        Relationships: []
      }
      demo_accounts: {
        Row: {
          company_id: string | null
          email: string
          full_name: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          company_id?: string | null
          email: string
          full_name: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          company_id?: string | null
          email?: string
          full_name?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "demo_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      finding_evidences: {
        Row: {
          caption: string
          content: string
          created_at: string
          finding_id: string
          id: string
          storage_path: string | null
          type: Database["public"]["Enums"]["evidence_type"]
        }
        Insert: {
          caption?: string
          content?: string
          created_at?: string
          finding_id: string
          id?: string
          storage_path?: string | null
          type?: Database["public"]["Enums"]["evidence_type"]
        }
        Update: {
          caption?: string
          content?: string
          created_at?: string
          finding_id?: string
          id?: string
          storage_path?: string | null
          type?: Database["public"]["Enums"]["evidence_type"]
        }
        Relationships: [
          {
            foreignKeyName: "finding_evidences_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "findings"
            referencedColumns: ["id"]
          },
        ]
      }
      findings: {
        Row: {
          code: string
          created_at: string
          cvss: number
          description: string
          discovered_at: string
          id: string
          impact: string
          mitigation: string
          pentester_id: string | null
          project_id: string
          resolved_at: string | null
          severity: Database["public"]["Enums"]["severity"]
          status: Database["public"]["Enums"]["finding_status"]
          title: string
          updated_at: string
        }
        Insert: {
          code?: string
          created_at?: string
          cvss?: number
          description?: string
          discovered_at?: string
          id?: string
          impact?: string
          mitigation?: string
          pentester_id?: string | null
          project_id: string
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["severity"]
          status?: Database["public"]["Enums"]["finding_status"]
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          cvss?: number
          description?: string
          discovered_at?: string
          id?: string
          impact?: string
          mitigation?: string
          pentester_id?: string | null
          project_id?: string
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["severity"]
          status?: Database["public"]["Enums"]["finding_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "findings_pentester_id_fkey"
            columns: ["pentester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email: string
          full_name?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_pentesters: {
        Row: {
          id: string
          profile_id: string
          project_id: string
        }
        Insert: {
          id?: string
          profile_id: string
          project_id: string
        }
        Update: {
          id?: string
          profile_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_pentesters_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_pentesters_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          company_id: string
          contracted_hours: number
          created_at: string
          description: string
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          type: Database["public"]["Enums"]["project_type"]
          used_hours: number
        }
        Insert: {
          company_id: string
          contracted_hours?: number
          created_at?: string
          description?: string
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          type?: Database["public"]["Enums"]["project_type"]
          used_hours?: number
        }
        Update: {
          company_id?: string
          contracted_hours?: number
          created_at?: string
          description?: string
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          type?: Database["public"]["Enums"]["project_type"]
          used_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      bootstrap_current_user: { Args: never; Returns: undefined }
      current_company_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_pentester: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "pentester" | "client"
      company_status: "active" | "inactive"
      evidence_type: "image" | "file" | "text"
      finding_status:
        | "open"
        | "in_progress"
        | "resolved"
        | "accepted_risk"
        | "false_positive"
        | "closed"
      project_status: "planned" | "in_progress" | "finished" | "archived"
      project_type:
        | "web"
        | "api"
        | "mobile"
        | "infra"
        | "redteam"
        | "va"
        | "other"
      severity: "critical" | "high" | "medium" | "low" | "informational"
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
      app_role: ["pentester", "client"],
      company_status: ["active", "inactive"],
      evidence_type: ["image", "file", "text"],
      finding_status: [
        "open",
        "in_progress",
        "resolved",
        "accepted_risk",
        "false_positive",
        "closed",
      ],
      project_status: ["planned", "in_progress", "finished", "archived"],
      project_type: ["web", "api", "mobile", "infra", "redteam", "va", "other"],
      severity: ["critical", "high", "medium", "low", "informational"],
    },
  },
} as const
