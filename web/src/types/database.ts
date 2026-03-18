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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          changed_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          operation: string
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          changed_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          changed_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      cartoes_credito: {
        Row: {
          cor: string | null
          created_at: string | null
          dia_fechamento: number
          dia_vencimento: number
          id: string
          limite: number
          nome: string
          responsavel: string
          user_id: string
        }
        Insert: {
          cor?: string | null
          created_at?: string | null
          dia_fechamento: number
          dia_vencimento: number
          id?: string
          limite?: number
          nome: string
          responsavel: string
          user_id: string
        }
        Update: {
          cor?: string | null
          created_at?: string | null
          dia_fechamento?: number
          dia_vencimento?: number
          id?: string
          limite?: number
          nome?: string
          responsavel?: string
          user_id?: string
        }
        Relationships: []
      }
      categorias: {
        Row: {
          cor: string | null
          created_at: string | null
          icone: string | null
          id: string
          nome: string
          tipo: string | null
          user_id: string | null
        }
        Insert: {
          cor?: string | null
          created_at?: string | null
          icone?: string | null
          id?: string
          nome: string
          tipo?: string | null
          user_id?: string | null
        }
        Update: {
          cor?: string | null
          created_at?: string | null
          icone?: string | null
          id?: string
          nome?: string
          tipo?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      contas_bancarias: {
        Row: {
          cor: string | null
          created_at: string
          id: string
          instituicao: string | null
          nome: string
          responsavel: string
          saldo_atual: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          id?: string
          instituicao?: string | null
          nome: string
          responsavel?: string
          saldo_atual?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          id?: string
          instituicao?: string | null
          nome?: string
          responsavel?: string
          saldo_atual?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      families: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      investimentos: {
        Row: {
          ativo: boolean | null
          created_at: string
          data_aplicacao: string
          data_vencimento: string | null
          id: string
          instituicao: string | null
          liquidez: string | null
          nome: string
          quantidade: number | null
          responsavel: string
          tipo: string
          updated_at: string
          user_id: string
          valor_aplicado: number
          valor_atual: number
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          data_aplicacao?: string
          data_vencimento?: string | null
          id?: string
          instituicao?: string | null
          liquidez?: string | null
          nome: string
          quantidade?: number | null
          responsavel?: string
          tipo: string
          updated_at?: string
          user_id: string
          valor_aplicado: number
          valor_atual: number
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          data_aplicacao?: string
          data_vencimento?: string | null
          id?: string
          instituicao?: string | null
          liquidez?: string | null
          nome?: string
          quantidade?: number | null
          responsavel?: string
          tipo?: string
          updated_at?: string
          user_id?: string
          valor_aplicado?: number
          valor_atual?: number
        }
        Relationships: []
      }
      metas: {
        Row: {
          cor: string | null
          created_at: string
          data_limite: string | null
          id: string
          nome: string
          updated_at: string
          user_id: string
          valor_alvo: number
          valor_atual: number | null
        }
        Insert: {
          cor?: string | null
          created_at?: string
          data_limite?: string | null
          id?: string
          nome: string
          updated_at?: string
          user_id: string
          valor_alvo: number
          valor_atual?: number | null
        }
        Update: {
          cor?: string | null
          created_at?: string
          data_limite?: string | null
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
          valor_alvo?: number
          valor_atual?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          title: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          title: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      orcamentos: {
        Row: {
          categoria: string
          id: string
          responsavel: string
          user_id: string
          valor_limite: number
        }
        Insert: {
          categoria: string
          id?: string
          responsavel: string
          user_id: string
          valor_limite?: number
        }
        Update: {
          categoria?: string
          id?: string
          responsavel?: string
          user_id?: string
          valor_limite?: number
        }
        Relationships: []
      }
      patrimonio: {
        Row: {
          id: string
          item: string
          responsavel: string
          updated_at: string | null
          user_id: string
          valor: number
        }
        Insert: {
          id?: string
          item: string
          responsavel: string
          updated_at?: string | null
          user_id: string
          valor?: number
        }
        Update: {
          id?: string
          item?: string
          responsavel?: string
          updated_at?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      pluggy_connections: {
        Row: {
          connector_name: string | null
          conta_bancaria_id: string | null
          created_at: string | null
          id: string
          last_sync_at: string | null
          pluggy_account_id: string | null
          pluggy_item_id: string
          status: string
          user_id: string
        }
        Insert: {
          connector_name?: string | null
          conta_bancaria_id?: string | null
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          pluggy_account_id?: string | null
          pluggy_item_id: string
          status?: string
          user_id: string
        }
        Update: {
          connector_name?: string | null
          conta_bancaria_id?: string | null
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          pluggy_account_id?: string | null
          pluggy_item_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pluggy_connections_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          family_id: string | null
          id: string
          role: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          family_id?: string | null
          id: string
          role?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          family_id?: string | null
          id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      recorrentes: {
        Row: {
          ativo: boolean
          categoria: string
          data_fim: string | null
          descricao: string
          dia_vencimento: number
          frequencia: string
          id: string
          responsavel: string
          tipo: string
          ultima_geracao: string | null
          user_id: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          categoria: string
          data_fim?: string | null
          descricao: string
          dia_vencimento: number
          frequencia?: string
          id?: string
          responsavel: string
          tipo: string
          ultima_geracao?: string | null
          user_id: string
          valor?: number
        }
        Update: {
          ativo?: boolean
          categoria?: string
          data_fim?: string | null
          descricao?: string
          dia_vencimento?: number
          frequencia?: string
          id?: string
          responsavel?: string
          tipo?: string
          ultima_geracao?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      regras_categorizacao: {
        Row: {
          categoria_destino: string
          created_at: string
          id: string
          texto_contem: string
          user_id: string
        }
        Insert: {
          categoria_destino: string
          created_at?: string
          id?: string
          texto_contem: string
          user_id: string
        }
        Update: {
          categoria_destino?: string
          created_at?: string
          id?: string
          texto_contem?: string
          user_id?: string
        }
        Relationships: []
      }
      transacoes: {
        Row: {
          cartao_id: string | null
          categoria: string
          conta_destino_id: string | null
          conta_id: string | null
          created_at: string | null
          data: string
          descricao: string
          id: string
          origem: string
          pluggy_transaction_id: string | null
          responsavel: string
          split_group_id: string | null
          status: string | null
          tag: string | null
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          cartao_id?: string | null
          categoria: string
          conta_destino_id?: string | null
          conta_id?: string | null
          created_at?: string | null
          data?: string
          descricao: string
          id?: string
          origem?: string
          pluggy_transaction_id?: string | null
          responsavel: string
          split_group_id?: string | null
          status?: string | null
          tag?: string | null
          tipo: string
          user_id: string
          valor?: number
        }
        Update: {
          cartao_id?: string | null
          categoria?: string
          conta_destino_id?: string | null
          conta_id?: string | null
          created_at?: string | null
          data?: string
          descricao?: string
          id?: string
          origem?: string
          pluggy_transaction_id?: string | null
          responsavel?: string
          split_group_id?: string | null
          status?: string | null
          tag?: string | null
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "cartoes_credito"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_conta_destino_id_fkey"
            columns: ["conta_destino_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          created_at: string | null
          event_type: string | null
          id: string
          payload: Json | null
          provider: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          provider: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          provider?: string
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      vw_503020_analysis: {
        Row: {
          bucket: string | null
          total: number | null
          user_id: string | null
        }
        Relationships: []
      }
      vw_categoria_breakdown: {
        Row: {
          categoria: string | null
          mes_ref: string | null
          total: number | null
          user_id: string | null
        }
        Relationships: []
      }
      vw_mes_atual_metricas: {
        Row: {
          despesas: number | null
          investido: number | null
          mes_ref: string | null
          renda: number | null
          user_id: string | null
        }
        Relationships: []
      }
      vw_orcamento_status: {
        Row: {
          categoria: string | null
          gasto_atual: number | null
          limite: number | null
          orcamento_id: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_financial_evolution: {
        Args: { p_months?: number }
        Returns: {
          month_key: string
          total: number
        }[]
      }
      get_my_family_id: { Args: never; Returns: string }
      is_same_family: { Args: { record_user_id: string }; Returns: boolean }
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
