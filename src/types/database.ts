
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "buildings": {
                  Row: {
                    "address": string,"bin": string | null,"block": number | null,"borough": Database["public"]['Enums']["borough"],"co_number": string | null,"created_at": string,"cross_street": string | null,"firm_id": string,"height_ft": number | null,"id": string,"is_cavity_wall": boolean | null,"is_landmark": boolean | null,"lot": number | null,"materials": (string)[],"materials_notes": string | null,"owner_address": string | null,"owner_name": string | null,"owner_phone": string | null,"owner_principal_name": string | null,"owner_principal_title": string | null,"stories": number | null,"updated_at": string,"use": string | null,"year_built": number | null
                  }
                  Insert: {
                    "address": string,"bin"?: string | null,"block"?: number | null,"borough": Database["public"]['Enums']["borough"],"co_number"?: string | null,"created_at"?: string,"cross_street"?: string | null,"firm_id": string,"height_ft"?: number | null,"id"?: string,"is_cavity_wall"?: boolean | null,"is_landmark"?: boolean | null,"lot"?: number | null,"materials"?: (string)[],"materials_notes"?: string | null,"owner_address"?: string | null,"owner_name"?: string | null,"owner_phone"?: string | null,"owner_principal_name"?: string | null,"owner_principal_title"?: string | null,"stories"?: number | null,"updated_at"?: string,"use"?: string | null,"year_built"?: number | null
                  }
                  Update: {
                    "address"?: string,"bin"?: string | null,"block"?: number | null,"borough"?: Database["public"]['Enums']["borough"],"co_number"?: string | null,"created_at"?: string,"cross_street"?: string | null,"firm_id"?: string,"height_ft"?: number | null,"id"?: string,"is_cavity_wall"?: boolean | null,"is_landmark"?: boolean | null,"lot"?: number | null,"materials"?: (string)[],"materials_notes"?: string | null,"owner_address"?: string | null,"owner_name"?: string | null,"owner_phone"?: string | null,"owner_principal_name"?: string | null,"owner_principal_title"?: string | null,"stories"?: number | null,"updated_at"?: string,"use"?: string | null,"year_built"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "buildings_firm_id_fkey"
      columns: ["firm_id"]
isOneToOne: false
      referencedRelation: "firms"
      referencedColumns: ["id"]
    }
                  ]
                },"closeups": {
                  Row: {
                    "created_at": string,"elevation_id": string,"firm_id": string,"id": string,"inspected_on": string,"location_note": string,"method": Database["public"]['Enums']["closeup_method"],"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"elevation_id": string,"firm_id": string,"id"?: string,"inspected_on": string,"location_note": string,"method": Database["public"]['Enums']["closeup_method"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"elevation_id"?: string,"firm_id"?: string,"id"?: string,"inspected_on"?: string,"location_note"?: string,"method"?: Database["public"]['Enums']["closeup_method"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "closeups_elevation_id_firm_id_fkey"
      columns: ["elevation_id","firm_id"]
isOneToOne: false
      referencedRelation: "elevations"
      referencedColumns: ["id","firm_id"]
    },{
      foreignKeyName: "closeups_firm_id_fkey"
      columns: ["firm_id"]
isOneToOne: false
      referencedRelation: "firms"
      referencedColumns: ["id"]
    }
                  ]
                },"elevations": {
                  Row: {
                    "created_at": string,"faces_street": boolean,"firm_id": string,"frontage_ft": number,"id": string,"name": string,"project_id": string,"setbacks_note": string | null,"sort_order": number,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"faces_street": boolean,"firm_id": string,"frontage_ft"?: number,"id"?: string,"name": string,"project_id": string,"setbacks_note"?: string | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"faces_street"?: boolean,"firm_id"?: string,"frontage_ft"?: number,"id"?: string,"name"?: string,"project_id"?: string,"setbacks_note"?: string | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "elevations_firm_id_fkey"
      columns: ["firm_id"]
isOneToOne: false
      referencedRelation: "firms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "elevations_project_id_firm_id_fkey"
      columns: ["project_id","firm_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","firm_id"]
    }
                  ]
                },"firms": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"inspectors": {
                  Row: {
                    "created_at": string,"firm_id": string,"id": string,"license_number": string,"license_type": Database["public"]['Enums']["license_type"],"name": string,"updated_at": string,"user_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"firm_id": string,"id"?: string,"license_number": string,"license_type": Database["public"]['Enums']["license_type"],"name": string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"firm_id"?: string,"id"?: string,"license_number"?: string,"license_type"?: Database["public"]['Enums']["license_type"],"name"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inspectors_firm_id_fkey"
      columns: ["firm_id"]
isOneToOne: false
      referencedRelation: "firms"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"email": string,"expires_at": string,"firm_id": string,"id": string,"invited_by": string | null,"role": Database["public"]['Enums']["member_role"],"token": string,"updated_at": string
                  }
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email": string,"expires_at"?: string,"firm_id": string,"id"?: string,"invited_by"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"token"?: string,"updated_at"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"firm_id"?: string,"id"?: string,"invited_by"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"token"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_firm_id_fkey"
      columns: ["firm_id"]
isOneToOne: false
      referencedRelation: "firms"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"firm_id": string,"id": string,"role": Database["public"]['Enums']["member_role"],"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"firm_id": string,"id"?: string,"role": Database["public"]['Enums']["member_role"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"firm_id"?: string,"id"?: string,"role"?: Database["public"]['Enums']["member_role"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_firm_id_fkey"
      columns: ["firm_id"]
isOneToOne: false
      referencedRelation: "firms"
      referencedColumns: ["id"]
    }
                  ]
                },"probes": {
                  Row: {
                    "closeup_id": string,"created_at": string,"firm_id": string,"id": string,"location_note": string,"probed_on": string,"tie_condition": string | null,"tie_spacing": string | null,"tie_type": string | null,"updated_at": string
                  }
                  Insert: {
                    "closeup_id": string,"created_at"?: string,"firm_id": string,"id"?: string,"location_note": string,"probed_on": string,"tie_condition"?: string | null,"tie_spacing"?: string | null,"tie_type"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "closeup_id"?: string,"created_at"?: string,"firm_id"?: string,"id"?: string,"location_note"?: string,"probed_on"?: string,"tie_condition"?: string | null,"tie_spacing"?: string | null,"tie_type"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "probes_closeup_id_firm_id_fkey"
      columns: ["closeup_id","firm_id"]
isOneToOne: false
      referencedRelation: "closeups"
      referencedColumns: ["id","firm_id"]
    },{
      foreignKeyName: "probes_firm_id_fkey"
      columns: ["firm_id"]
isOneToOne: false
      referencedRelation: "firms"
      referencedColumns: ["id"]
    }
                  ]
                },"projects": {
                  Row: {
                    "building_id": string,"closeup_complete_date": string | null,"created_at": string,"cycle": number,"exam_end": string | null,"exam_start": string | null,"final_visual_date": string | null,"firm_id": string,"id": string,"qewi_id": string | null,"report_type": Database["public"]['Enums']["report_type"],"status": Database["public"]['Enums']["project_status"],"unsafe_notified_on": string | null,"updated_at": string
                  }
                  Insert: {
                    "building_id": string,"closeup_complete_date"?: string | null,"created_at"?: string,"cycle"?: number,"exam_end"?: string | null,"exam_start"?: string | null,"final_visual_date"?: string | null,"firm_id": string,"id"?: string,"qewi_id"?: string | null,"report_type"?: Database["public"]['Enums']["report_type"],"status"?: Database["public"]['Enums']["project_status"],"unsafe_notified_on"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "building_id"?: string,"closeup_complete_date"?: string | null,"created_at"?: string,"cycle"?: number,"exam_end"?: string | null,"exam_start"?: string | null,"final_visual_date"?: string | null,"firm_id"?: string,"id"?: string,"qewi_id"?: string | null,"report_type"?: Database["public"]['Enums']["report_type"],"status"?: Database["public"]['Enums']["project_status"],"unsafe_notified_on"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_building_id_firm_id_fkey"
      columns: ["building_id","firm_id"]
isOneToOne: false
      referencedRelation: "buildings"
      referencedColumns: ["id","firm_id"]
    },{
      foreignKeyName: "projects_firm_id_fkey"
      columns: ["firm_id"]
isOneToOne: false
      referencedRelation: "firms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_qewi_id_firm_id_fkey"
      columns: ["qewi_id","firm_id"]
isOneToOne: false
      referencedRelation: "inspectors"
      referencedColumns: ["id","firm_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_token": string }; Returns: string
                           },
"create_firm":
{ Args: { "p_name": string }; Returns: string
                           },
"create_project":
{ Args: { "p_address"?: string,"p_bin"?: string,"p_block"?: number,"p_borough"?: Database["public"]['Enums']["borough"],"p_building_id"?: string,"p_cycle": number,"p_lot"?: number,"p_report_type": Database["public"]['Enums']["report_type"] }; Returns: string
                           },
"firm_members":
{ Args: Record<PropertyKey, never>; Returns: {
              "email": string,"joined_at": string,"role": Database["public"]['Enums']["member_role"],"user_id": string
            }[]
                           },
"invitation_preview":
{ Args: { "p_token": string }; Returns: {
              "email": string,"firm_name": string,"status": string
            }[]
                           }
          }
          Enums: {
            "borough": "manhattan"|"bronx"|"brooklyn"|"queens"|"staten_island","closeup_method": "scaffold"|"swing_stage"|"boom_lift"|"rope","license_type": "PE"|"RA","member_role": "qewi"|"staff","project_status": "draft"|"ready"|"filed","report_type": "initial"|"subsequent"|"amended"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "borough": ["manhattan", "bronx", "brooklyn", "queens", "staten_island"],"closeup_method": ["scaffold", "swing_stage", "boom_lift", "rope"],"license_type": ["PE", "RA"],"member_role": ["qewi", "staff"],"project_status": ["draft", "ready", "filed"],"report_type": ["initial", "subsequent", "amended"]
          }
        }
} as const
