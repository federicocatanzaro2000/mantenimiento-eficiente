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
      materiales: {
        Row: {
          cantidad: number | null
          codigo: string | null
          created_at: string
          descripcion: string | null
          id: string
          orden_id: string
        }
        Insert: {
          cantidad?: number | null
          codigo?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          orden_id: string
        }
        Update: {
          cantidad?: number | null
          codigo?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          orden_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "materiales_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "ordenes"
            referencedColumns: ["id"]
          },
        ]
      }
      ordenes: {
        Row: {
          aprobado: boolean
          aprobo: string | null
          codigo_documento: string | null
          codigo_equipo: string | null
          control_liberacion_calidad: boolean
          created_at: string
          created_by: string | null
          descripcion_problema: string | null
          elaboro: string | null
          estado: string | null
          estado_recepcion_equipo: string | null
          fecha_creacion: string | null
          fecha_finalizacion: string | null
          fecha_inicio: string | null
          fecha_limite_realizacion: string | null
          herramientas_limpias_ordenadas: boolean
          horas_presupuestadas: number | null
          horas_reales: number | null
          id: string
          nombre_equipo: string | null
          nro_orden: number
          observaciones: string | null
          prioridad: string | null
          responsable_control_calidad: string | null
          reviso: string | null
          sector: string | null
          sector_limpio_ordenado: boolean
          solicitante: string | null
          tecnico_responsable: string | null
          tipo_orden: string | null
          trabajo_solicitado: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          aprobado?: boolean
          aprobo?: string | null
          codigo_documento?: string | null
          codigo_equipo?: string | null
          control_liberacion_calidad?: boolean
          created_at?: string
          created_by?: string | null
          descripcion_problema?: string | null
          elaboro?: string | null
          estado?: string | null
          estado_recepcion_equipo?: string | null
          fecha_creacion?: string | null
          fecha_finalizacion?: string | null
          fecha_inicio?: string | null
          fecha_limite_realizacion?: string | null
          herramientas_limpias_ordenadas?: boolean
          horas_presupuestadas?: number | null
          horas_reales?: number | null
          id?: string
          nombre_equipo?: string | null
          nro_orden: number
          observaciones?: string | null
          prioridad?: string | null
          responsable_control_calidad?: string | null
          reviso?: string | null
          sector?: string | null
          sector_limpio_ordenado?: boolean
          solicitante?: string | null
          tecnico_responsable?: string | null
          tipo_orden?: string | null
          trabajo_solicitado?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          aprobado?: boolean
          aprobo?: string | null
          codigo_documento?: string | null
          codigo_equipo?: string | null
          control_liberacion_calidad?: boolean
          created_at?: string
          created_by?: string | null
          descripcion_problema?: string | null
          elaboro?: string | null
          estado?: string | null
          estado_recepcion_equipo?: string | null
          fecha_creacion?: string | null
          fecha_finalizacion?: string | null
          fecha_inicio?: string | null
          fecha_limite_realizacion?: string | null
          herramientas_limpias_ordenadas?: boolean
          horas_presupuestadas?: number | null
          horas_reales?: number | null
          id?: string
          nombre_equipo?: string | null
          nro_orden?: number
          observaciones?: string | null
          prioridad?: string | null
          responsable_control_calidad?: string | null
          reviso?: string | null
          sector?: string | null
          sector_limpio_ordenado?: boolean
          solicitante?: string | null
          tecnico_responsable?: string | null
          tipo_orden?: string | null
          trabajo_solicitado?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activo: boolean
          created_at: string
          email: string | null
          id: string
          nombre: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nombre?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nombre?: string
          updated_at?: string
          user_id?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "supervisor"
        | "calidad"
        | "operario"
        | "panol"
        | "admin_usuarios"
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
    Enums: {
      app_role: [
        "supervisor",
        "calidad",
        "operario",
        "panol",
        "admin_usuarios",
      ],
    },
  },
} as const
