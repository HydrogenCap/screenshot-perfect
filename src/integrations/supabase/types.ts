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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_name: string
          account_reference: string | null
          account_type: Database["public"]["Enums"]["account_type"]
          contribution_limit: number | null
          created_at: string
          currency: string
          id: string
          is_active: boolean
          notes: string | null
          opened_date: string | null
          provider_id: string
          tax_year_contribution: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name: string
          account_reference?: string | null
          account_type: Database["public"]["Enums"]["account_type"]
          contribution_limit?: number | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          opened_date?: string | null
          provider_id: string
          tax_year_contribution?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_reference?: string | null
          account_type?: Database["public"]["Enums"]["account_type"]
          contribution_limit?: number | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          opened_date?: string | null
          provider_id?: string
          tax_year_contribution?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      csv_mappings: {
        Row: {
          column_map: Json
          created_at: string
          date_format: string
          decimal_separator: string
          id: string
          is_default: boolean
          mapping_name: string
          notes: string | null
          provider_id: string | null
          skip_header_rows: number
          user_id: string
        }
        Insert: {
          column_map?: Json
          created_at?: string
          date_format?: string
          decimal_separator?: string
          id?: string
          is_default?: boolean
          mapping_name: string
          notes?: string | null
          provider_id?: string | null
          skip_header_rows?: number
          user_id: string
        }
        Update: {
          column_map?: Json
          created_at?: string
          date_format?: string
          decimal_separator?: string
          id?: string
          is_default?: boolean
          mapping_name?: string
          notes?: string | null
          provider_id?: string | null
          skip_header_rows?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "csv_mappings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          created_at: string
          from_currency: string
          id: string
          rate: number
          rate_date: string
          source: string
          to_currency: string
        }
        Insert: {
          created_at?: string
          from_currency: string
          id?: string
          rate: number
          rate_date: string
          source?: string
          to_currency: string
        }
        Update: {
          created_at?: string
          from_currency?: string
          id?: string
          rate?: number
          rate_date?: string
          source?: string
          to_currency?: string
        }
        Relationships: []
      }
      holdings: {
        Row: {
          account_id: string
          average_cost_per_unit: number
          cost_basis: number
          currency: string
          current_price: number
          current_value: number
          id: string
          instrument_id: string | null
          last_updated: string
          notes: string | null
          quantity: number
        }
        Insert: {
          account_id: string
          average_cost_per_unit?: number
          cost_basis?: number
          currency?: string
          current_price?: number
          current_value?: number
          id?: string
          instrument_id?: string | null
          last_updated?: string
          notes?: string | null
          quantity?: number
        }
        Update: {
          account_id?: string
          average_cost_per_unit?: number
          cost_basis?: number
          currency?: string
          current_price?: number
          current_value?: number
          id?: string
          instrument_id?: string | null
          last_updated?: string
          notes?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "holdings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holdings_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      imports: {
        Row: {
          account_id: string
          confirmed_at: string | null
          created_at: string
          error_count: number
          error_log: Json | null
          file_path: string | null
          file_size: number | null
          filename: string
          id: string
          imported_count: number
          mapping_used: string | null
          row_count: number
          skipped_count: number
          status: Database["public"]["Enums"]["import_status"]
        }
        Insert: {
          account_id: string
          confirmed_at?: string | null
          created_at?: string
          error_count?: number
          error_log?: Json | null
          file_path?: string | null
          file_size?: number | null
          filename: string
          id?: string
          imported_count?: number
          mapping_used?: string | null
          row_count?: number
          skipped_count?: number
          status?: Database["public"]["Enums"]["import_status"]
        }
        Update: {
          account_id?: string
          confirmed_at?: string | null
          created_at?: string
          error_count?: number
          error_log?: Json | null
          file_path?: string | null
          file_size?: number | null
          filename?: string
          id?: string
          imported_count?: number
          mapping_used?: string | null
          row_count?: number
          skipped_count?: number
          status?: Database["public"]["Enums"]["import_status"]
        }
        Relationships: [
          {
            foreignKeyName: "imports_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imports_mapping_used_fkey"
            columns: ["mapping_used"]
            isOneToOne: false
            referencedRelation: "csv_mappings"
            referencedColumns: ["id"]
          },
        ]
      }
      instruments: {
        Row: {
          asset_class: Database["public"]["Enums"]["asset_class"]
          asset_sub_class: string | null
          created_at: string
          currency: string
          exchange: string | null
          id: string
          isin: string | null
          name: string
          notes: string | null
          sedol: string | null
          ticker: string | null
          user_id: string
        }
        Insert: {
          asset_class?: Database["public"]["Enums"]["asset_class"]
          asset_sub_class?: string | null
          created_at?: string
          currency?: string
          exchange?: string | null
          id?: string
          isin?: string | null
          name: string
          notes?: string | null
          sedol?: string | null
          ticker?: string | null
          user_id: string
        }
        Update: {
          asset_class?: Database["public"]["Enums"]["asset_class"]
          asset_sub_class?: string | null
          created_at?: string
          currency?: string
          exchange?: string | null
          id?: string
          isin?: string | null
          name?: string
          notes?: string | null
          sedol?: string | null
          ticker?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          base_currency: string
          created_at: string
          display_name: string | null
          id: string
          isa_limit: number
          tax_year_start_day: number
          tax_year_start_month: number
          updated_at: string
          user_id: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          display_name?: string | null
          id?: string
          isa_limit?: number
          tax_year_start_day?: number
          tax_year_start_month?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          display_name?: string | null
          id?: string
          isa_limit?: number
          tax_year_start_day?: number
          tax_year_start_month?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      providers: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          notes: string | null
          provider_type: Database["public"]["Enums"]["provider_type"]
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          notes?: string | null
          provider_type?: Database["public"]["Enums"]["provider_type"]
          updated_at?: string
          user_id: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          notes?: string | null
          provider_type?: Database["public"]["Enums"]["provider_type"]
          updated_at?: string
          user_id?: string
          website_url?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string
          created_at: string
          currency: string
          dedup_hash: string | null
          fees: number
          fx_rate: number | null
          id: string
          import_id: string | null
          instrument_id: string | null
          notes: string | null
          price_per_unit: number | null
          quantity: number | null
          reference: string | null
          settlement_date: string | null
          stamp_duty: number
          total_amount: number
          transaction_date: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          account_id: string
          created_at?: string
          currency?: string
          dedup_hash?: string | null
          fees?: number
          fx_rate?: number | null
          id?: string
          import_id?: string | null
          instrument_id?: string | null
          notes?: string | null
          price_per_unit?: number | null
          quantity?: number | null
          reference?: string | null
          settlement_date?: string | null
          stamp_duty?: number
          total_amount: number
          transaction_date: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          account_id?: string
          created_at?: string
          currency?: string
          dedup_hash?: string | null
          fees?: number
          fx_rate?: number | null
          id?: string
          import_id?: string | null
          instrument_id?: string | null
          notes?: string | null
          price_per_unit?: number | null
          quantity?: number | null
          reference?: string | null
          settlement_date?: string | null
          stamp_duty?: number
          total_amount?: number
          transaction_date?: string
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      valuations: {
        Row: {
          account_id: string
          cash_balance: number
          created_at: string
          currency: string
          id: string
          invested_value: number
          notes: string | null
          source: Database["public"]["Enums"]["valuation_source"]
          total_value: number
          valuation_date: string
        }
        Insert: {
          account_id: string
          cash_balance?: number
          created_at?: string
          currency?: string
          id?: string
          invested_value?: number
          notes?: string | null
          source?: Database["public"]["Enums"]["valuation_source"]
          total_value?: number
          valuation_date: string
        }
        Update: {
          account_id?: string
          cash_balance?: number
          created_at?: string
          currency?: string
          id?: string
          invested_value?: number
          notes?: string | null
          source?: Database["public"]["Enums"]["valuation_source"]
          total_value?: number
          valuation_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "valuations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      account_type:
        | "stocks_and_shares_isa"
        | "cash_isa"
        | "lifetime_isa"
        | "junior_isa"
        | "sipp"
        | "workplace_pension"
        | "gia"
        | "trading_account"
        | "savings_account"
        | "current_account"
        | "cash_savings"
        | "crypto"
        | "other"
      asset_class:
        | "equity"
        | "etf"
        | "fund"
        | "investment_trust"
        | "bond"
        | "gilt"
        | "cash"
        | "commodity"
        | "crypto"
        | "property"
        | "alternative"
        | "other"
      import_status:
        | "pending"
        | "previewing"
        | "confirmed"
        | "failed"
        | "rolled_back"
      provider_type:
        | "bank"
        | "investment_platform"
        | "pension_provider"
        | "crypto_exchange"
        | "savings_platform"
      transaction_type:
        | "buy"
        | "sell"
        | "deposit"
        | "withdrawal"
        | "dividend"
        | "interest"
        | "fee"
        | "transfer_in"
        | "transfer_out"
        | "corporate_action"
        | "stock_split"
        | "fx_conversion"
        | "contribution"
        | "tax_relief"
        | "other"
      valuation_source: "import" | "manual" | "calculated"
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
      account_type: [
        "stocks_and_shares_isa",
        "cash_isa",
        "lifetime_isa",
        "junior_isa",
        "sipp",
        "workplace_pension",
        "gia",
        "trading_account",
        "savings_account",
        "current_account",
        "cash_savings",
        "crypto",
        "other",
      ],
      asset_class: [
        "equity",
        "etf",
        "fund",
        "investment_trust",
        "bond",
        "gilt",
        "cash",
        "commodity",
        "crypto",
        "property",
        "alternative",
        "other",
      ],
      import_status: [
        "pending",
        "previewing",
        "confirmed",
        "failed",
        "rolled_back",
      ],
      provider_type: [
        "bank",
        "investment_platform",
        "pension_provider",
        "crypto_exchange",
        "savings_platform",
      ],
      transaction_type: [
        "buy",
        "sell",
        "deposit",
        "withdrawal",
        "dividend",
        "interest",
        "fee",
        "transfer_in",
        "transfer_out",
        "corporate_action",
        "stock_split",
        "fx_conversion",
        "contribution",
        "tax_relief",
        "other",
      ],
      valuation_source: ["import", "manual", "calculated"],
    },
  },
} as const
