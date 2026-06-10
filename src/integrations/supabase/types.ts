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
      equipment: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
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
          line_stopped: boolean | null
          line_stopped_hours: number | null
          materiales_utilizados: Json
          nombre_equipo: string | null
          nro_orden: number
          observaciones: string | null
          preventivo_schedule_id: string | null
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
          line_stopped?: boolean | null
          line_stopped_hours?: number | null
          materiales_utilizados?: Json
          nombre_equipo?: string | null
          nro_orden: number
          observaciones?: string | null
          preventivo_schedule_id?: string | null
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
          line_stopped?: boolean | null
          line_stopped_hours?: number | null
          materiales_utilizados?: Json
          nombre_equipo?: string | null
          nro_orden?: number
          observaciones?: string | null
          preventivo_schedule_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "ordenes_preventivo_schedule_id_fkey"
            columns: ["preventivo_schedule_id"]
            isOneToOne: false
            referencedRelation: "preventivos_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          active: boolean
          can_be_approver: boolean
          can_be_created_by: boolean
          can_be_quality_responsible: boolean
          can_be_requester: boolean
          can_be_reviewed_by: boolean
          can_be_technician: boolean
          created_at: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          can_be_approver?: boolean
          can_be_created_by?: boolean
          can_be_quality_responsible?: boolean
          can_be_requester?: boolean
          can_be_reviewed_by?: boolean
          can_be_technician?: boolean
          created_at?: string
          full_name: string
          id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          can_be_approver?: boolean
          can_be_created_by?: boolean
          can_be_quality_responsible?: boolean
          can_be_requester?: boolean
          can_be_reviewed_by?: boolean
          can_be_technician?: boolean
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      preventive_manual_items: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          equipment_code_snapshot: string
          equipment_id: string | null
          equipment_name_snapshot: string
          estimated_hours: number | null
          frequency_label: string | null
          id: string
          notes: string | null
          preventive_type: string
          responsible_id: string | null
          scheduled_date: string
          scheduled_day: number
          scheduled_month: number
          scheduled_year: number
          source: string
          status: string
          task_name: string
          updated_at: string
          updated_by: string | null
          work_order_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          equipment_code_snapshot: string
          equipment_id?: string | null
          equipment_name_snapshot: string
          estimated_hours?: number | null
          frequency_label?: string | null
          id?: string
          notes?: string | null
          preventive_type?: string
          responsible_id?: string | null
          scheduled_date: string
          scheduled_day: number
          scheduled_month: number
          scheduled_year: number
          source?: string
          status?: string
          task_name: string
          updated_at?: string
          updated_by?: string | null
          work_order_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          equipment_code_snapshot?: string
          equipment_id?: string | null
          equipment_name_snapshot?: string
          estimated_hours?: number | null
          frequency_label?: string | null
          id?: string
          notes?: string | null
          preventive_type?: string
          responsible_id?: string | null
          scheduled_date?: string
          scheduled_day?: number
          scheduled_month?: number
          scheduled_year?: number
          source?: string
          status?: string
          task_name?: string
          updated_at?: string
          updated_by?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preventive_manual_items_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_manual_items_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_manual_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "ordenes"
            referencedColumns: ["id"]
          },
        ]
      }
      preventivos_alertas: {
        Row: {
          alert_date: string
          alert_type: string
          created_at: string
          dismissed_at: string | null
          estado: string
          id: string
          schedule_id: string
          sent_at: string | null
        }
        Insert: {
          alert_date: string
          alert_type: string
          created_at?: string
          dismissed_at?: string | null
          estado?: string
          id?: string
          schedule_id: string
          sent_at?: string | null
        }
        Update: {
          alert_date?: string
          alert_type?: string
          created_at?: string
          dismissed_at?: string | null
          estado?: string
          id?: string
          schedule_id?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preventivos_alertas_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "preventivos_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      preventivos_imports: {
        Row: {
          anios_detectados: number[] | null
          errores: Json | null
          estado: string
          file_hash: string | null
          file_name: string
          hojas_procesadas: string[] | null
          id: string
          imported_at: string
          imported_by: string | null
          planes_actualizados: number | null
          planes_creados: number | null
          schedule_actualizados: number | null
          schedule_creados: number | null
          schedule_omitidos: number | null
        }
        Insert: {
          anios_detectados?: number[] | null
          errores?: Json | null
          estado?: string
          file_hash?: string | null
          file_name: string
          hojas_procesadas?: string[] | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          planes_actualizados?: number | null
          planes_creados?: number | null
          schedule_actualizados?: number | null
          schedule_creados?: number | null
          schedule_omitidos?: number | null
        }
        Update: {
          anios_detectados?: number[] | null
          errores?: Json | null
          estado?: string
          file_hash?: string | null
          file_name?: string
          hojas_procesadas?: string[] | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          planes_actualizados?: number | null
          planes_creados?: number | null
          schedule_actualizados?: number | null
          schedule_creados?: number | null
          schedule_omitidos?: number | null
        }
        Relationships: []
      }
      preventivos_planes: {
        Row: {
          activo: boolean
          created_at: string
          created_by: string | null
          dia_preferido: number
          equipo: string
          equipo_codigo: string | null
          frecuencia_texto: string | null
          frecuencia_unidad: string | null
          frecuencia_valor: number | null
          id: string
          mes_inicio: number
          source_file: string | null
          source_row: number | null
          source_sheet: string | null
          tarea: string
          tipo_tarea: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          dia_preferido?: number
          equipo: string
          equipo_codigo?: string | null
          frecuencia_texto?: string | null
          frecuencia_unidad?: string | null
          frecuencia_valor?: number | null
          id?: string
          mes_inicio?: number
          source_file?: string | null
          source_row?: number | null
          source_sheet?: string | null
          tarea: string
          tipo_tarea?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          dia_preferido?: number
          equipo?: string
          equipo_codigo?: string | null
          frecuencia_texto?: string | null
          frecuencia_unidad?: string | null
          frecuencia_valor?: number | null
          id?: string
          mes_inicio?: number
          source_file?: string | null
          source_row?: number | null
          source_sheet?: string | null
          tarea?: string
          tipo_tarea?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      preventivos_schedule: {
        Row: {
          anio: number
          created_at: string
          created_by: string | null
          dia: number | null
          estado: string
          fecha_real: string | null
          id: string
          import_notes: string | null
          mes: number
          observaciones: string | null
          orden_id: string | null
          plan_id: string
          scheduled_date: string | null
          source_cell: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          anio: number
          created_at?: string
          created_by?: string | null
          dia?: number | null
          estado?: string
          fecha_real?: string | null
          id?: string
          import_notes?: string | null
          mes: number
          observaciones?: string | null
          orden_id?: string | null
          plan_id: string
          scheduled_date?: string | null
          source_cell?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          anio?: number
          created_at?: string
          created_by?: string | null
          dia?: number | null
          estado?: string
          fecha_real?: string | null
          id?: string
          import_notes?: string | null
          mes?: number
          observaciones?: string | null
          orden_id?: string | null
          plan_id?: string
          scheduled_date?: string | null
          source_cell?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preventivos_schedule_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "ordenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventivos_schedule_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "preventivos_planes"
            referencedColumns: ["id"]
          },
        ]
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
      sectors: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
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
