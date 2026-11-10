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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      blackout_dates: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          id: number
          legacy_created_by: number | null
          reason: string
          start_date: string
          venue_id: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: number
          legacy_created_by?: number | null
          reason?: string
          start_date: string
          venue_id: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: number
          legacy_created_by?: number | null
          reason?: string
          start_date?: string
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "blackout_dates_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          code: string
          created_at: string
          description: string
          has_accommodation: boolean
          has_venue: boolean
          id: number
          name: string
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string
          has_accommodation?: boolean
          has_venue?: boolean
          id: number
          name: string
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          has_accommodation?: boolean
          has_venue?: boolean
          id?: number
          name?: string
          status?: string
        }
        Relationships: []
      }
      legacy_users: {
        Row: {
          assigned_facility_id: number | null
          claimed_by: string | null
          created_at: string
          email: string | null
          full_name: string
          id: number
          role: string
          username: string | null
        }
        Insert: {
          assigned_facility_id?: number | null
          claimed_by?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: number
          role?: string
          username?: string | null
        }
        Update: {
          assigned_facility_id?: number | null
          claimed_by?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: number
          role?: string
          username?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          username?: string | null
        }
        Relationships: []
      }
      room_bookings: {
        Row: {
          amount_due: number
          amount_paid: number
          check_in: string
          check_out: string
          created_at: string
          guests: number
          id: number
          legacy_user_id: number | null
          paid_at: string | null
          payment_method: string
          payment_reference: string | null
          payment_status: string
          room_id: number
          special_orders: string
          status: string
          user_id: string | null
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          check_in: string
          check_out: string
          created_at?: string
          guests: number
          id?: number
          legacy_user_id?: number | null
          paid_at?: string | null
          payment_method?: string
          payment_reference?: string | null
          payment_status?: string
          room_id: number
          special_orders?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          check_in?: string
          check_out?: string
          created_at?: string
          guests?: number
          id?: number
          legacy_user_id?: number | null
          paid_at?: string | null
          payment_method?: string
          payment_reference?: string | null
          payment_status?: string
          room_id?: number
          special_orders?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_bookings_legacy_user_id_fkey"
            columns: ["legacy_user_id"]
            isOneToOne: false
            referencedRelation: "legacy_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_types: {
        Row: {
          capacity: number
          description: string
          id: number
          name: string
        }
        Insert: {
          capacity?: number
          description?: string
          id: number
          name: string
        }
        Update: {
          capacity?: number
          description?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          capacity: number
          created_at: string
          facility_id: number
          id: number
          image_url: string
          price_per_night: number
          room_number: string
          room_type_id: number | null
          status: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          facility_id: number
          id: number
          image_url?: string
          price_per_night?: number
          room_number: string
          room_type_id?: number | null
          status?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          facility_id?: number
          id?: number
          image_url?: string
          price_per_night?: number
          room_number?: string
          room_type_id?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          facility_id: number | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          facility_id?: number | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          facility_id?: number | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_bookings: {
        Row: {
          attendees: number
          booking_date: string
          created_at: string
          end_date: string
          end_time: string
          event_name: string
          id: number
          layout_data: Json | null
          layout_type: string
          legacy_user_id: number | null
          start_time: string
          status: string
          user_id: string | null
          venue_id: number
        }
        Insert: {
          attendees: number
          booking_date: string
          created_at?: string
          end_date: string
          end_time: string
          event_name: string
          id?: number
          layout_data?: Json | null
          layout_type?: string
          legacy_user_id?: number | null
          start_time: string
          status?: string
          user_id?: string | null
          venue_id: number
        }
        Update: {
          attendees?: number
          booking_date?: string
          created_at?: string
          end_date?: string
          end_time?: string
          event_name?: string
          id?: number
          layout_data?: Json | null
          layout_type?: string
          legacy_user_id?: number | null
          start_time?: string
          status?: string
          user_id?: string | null
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "venue_bookings_legacy_user_id_fkey"
            columns: ["legacy_user_id"]
            isOneToOne: false
            referencedRelation: "legacy_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_bookings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_document_requirements: {
        Row: {
          active: boolean
          created_at: string
          description: string
          id: number
          sort_order: number
          template_name: string | null
          template_path: string | null
          title: string
          updated_at: string
          venue_id: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          id?: number
          sort_order?: number
          template_name?: string | null
          template_path?: string | null
          title: string
          updated_at?: string
          venue_id: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          id?: number
          sort_order?: number
          template_name?: string | null
          template_path?: string | null
          title?: string
          updated_at?: string
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "venue_document_requirements_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_document_submissions: {
        Row: {
          admin_note: string
          booking_id: number
          file_paths: string[]
          id: number
          requirement_id: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          submitted_by: string | null
        }
        Insert: {
          admin_note?: string
          booking_id: number
          file_paths?: string[]
          id?: number
          requirement_id: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
        }
        Update: {
          admin_note?: string
          booking_id?: number
          file_paths?: string[]
          id?: number
          requirement_id?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_document_submissions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "venue_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_document_submissions_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "venue_document_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          capacity: number
          capacity_tables: number
          created_at: string
          description: string
          facility_id: number
          id: number
          image_url: string
          name: string
          price: number
          status: string
        }
        Insert: {
          capacity?: number
          capacity_tables?: number
          created_at?: string
          description?: string
          facility_id: number
          id: number
          image_url?: string
          name: string
          price?: number
          status?: string
        }
        Update: {
          capacity?: number
          capacity_tables?: number
          created_at?: string
          description?: string
          facility_id?: number
          id?: number
          image_url?: string
          name?: string
          price?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      manages_facility: {
        Args: { _facility_id: number; _user_id: string }
        Returns: boolean
      }
      room_busy_ranges: {
        Args: { _room_id: number }
        Returns: {
          check_in: string
          check_out: string
        }[]
      }
      venue_busy_ranges: {
        Args: { _venue_id: number }
        Returns: {
          end_date: string
          end_time: string
          start_date: string
          start_time: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "venue_admin" | "guest"
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
      app_role: ["admin", "venue_admin", "guest"],
    },
  },
} as const
