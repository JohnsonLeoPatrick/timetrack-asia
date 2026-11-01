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
      addon_options: {
        Row: {
          addon_id: string
          created_at: string | null
          deleted_at: string | null
          id: string
          name: string
          price: number
          updated_at: string | null
        }
        Insert: {
          addon_id: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          price?: number
          updated_at?: string | null
        }
        Update: {
          addon_id?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addon_options_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "category_addons"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          metadata: Json | null
          module: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          module: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          module?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_details: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          deleted_at: string | null
          email: string
          first_name: string
          id: string
          phone: string
          postcode: string | null
          registration_id: string
          updated_at: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email: string
          first_name: string
          id?: string
          phone: string
          postcode?: string | null
          registration_id: string
          updated_at?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string
          first_name?: string
          id?: string
          phone?: string
          postcode?: string | null
          registration_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_details_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: true
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      category_addons: {
        Row: {
          category_id: string
          created_at: string | null
          deleted_at: string | null
          id: string
          name: string
          price: number
          required: boolean
          type: string
          updated_at: string | null
        }
        Insert: {
          category_id: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          price?: number
          required?: boolean
          type: string
          updated_at?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          price?: number
          required?: boolean
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_addons_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "event_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string | null
          discount_amount: number
          id: string
          registration_id: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string | null
          discount_amount: number
          id?: string
          registration_id: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string | null
          discount_amount?: number
          id?: string
          registration_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string | null
          current_uses: number
          deleted_at: string | null
          event_id: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          max_uses_per_user: number
          min_order_amount: number
          organizer_id: string | null
          starts_at: string | null
          type: string
          updated_at: string | null
          value: number
        }
        Insert: {
          code: string
          created_at?: string | null
          current_uses?: number
          deleted_at?: string | null
          event_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          max_uses_per_user?: number
          min_order_amount?: number
          organizer_id?: string | null
          starts_at?: string | null
          type?: string
          updated_at?: string | null
          value: number
        }
        Update: {
          code?: string
          created_at?: string | null
          current_uses?: number
          deleted_at?: string | null
          event_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          max_uses_per_user?: number
          min_order_amount?: number
          organizer_id?: string | null
          starts_at?: string | null
          type?: string
          updated_at?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          attachments: Json | null
          created_at: string | null
          error_message: string | null
          html_body: string
          id: string
          max_retries: number
          retry_count: number
          scheduled_at: string | null
          sent_at: string | null
          status: string
          subject: string
          to_address: string
        }
        Insert: {
          attachments?: Json | null
          created_at?: string | null
          error_message?: string | null
          html_body: string
          id?: string
          max_retries?: number
          retry_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          to_address: string
        }
        Update: {
          attachments?: Json | null
          created_at?: string | null
          error_message?: string | null
          html_body?: string
          id?: string
          max_retries?: number
          retry_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          to_address?: string
        }
        Relationships: []
      }
      event_categories: {
        Row: {
          base_price: number
          created_at: string | null
          deleted_at: string | null
          description: string | null
          event_id: string
          id: string
          max_age: number | null
          max_slots: number | null
          min_age: number | null
          name: string
          updated_at: string | null
        }
        Insert: {
          base_price?: number
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          event_id: string
          id?: string
          max_age?: number | null
          max_slots?: number | null
          min_age?: number | null
          name: string
          updated_at?: string | null
        }
        Update: {
          base_price?: number
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          event_id?: string
          id?: string
          max_age?: number | null
          max_slots?: number | null
          min_age?: number | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_categories_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_gallery: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          event_id: string
          id: string
          image_url: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          event_id: string
          id?: string
          image_url: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          event_id?: string
          id?: string
          image_url?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_gallery_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          banner_image: string | null
          bib_format: string | null
          city: string | null
          country: string | null
          coupons_allowed: boolean | null
          cover_image: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          event_date: string
          form_template_id: string | null
          id: string
          max_participants: number | null
          organizer_id: string
          postcode: string | null
          registration_close: string
          registration_open: string
          results_finalized: boolean | null
          slug: string
          status: string
          terms_and_conditions: string | null
          title: string
          updated_at: string | null
          venue_name: string | null
        }
        Insert: {
          address?: string | null
          banner_image?: string | null
          bib_format?: string | null
          city?: string | null
          country?: string | null
          coupons_allowed?: boolean | null
          cover_image?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          event_date: string
          form_template_id?: string | null
          id?: string
          max_participants?: number | null
          organizer_id: string
          postcode?: string | null
          registration_close: string
          registration_open: string
          results_finalized?: boolean | null
          slug: string
          status?: string
          terms_and_conditions?: string | null
          title: string
          updated_at?: string | null
          venue_name?: string | null
        }
        Update: {
          address?: string | null
          banner_image?: string | null
          bib_format?: string | null
          city?: string | null
          country?: string | null
          coupons_allowed?: boolean | null
          cover_image?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          event_date?: string
          form_template_id?: string | null
          id?: string
          max_participants?: number | null
          organizer_id?: string
          postcode?: string | null
          registration_close?: string
          registration_open?: string
          results_finalized?: boolean | null
          slug?: string
          status?: string
          terms_and_conditions?: string | null
          title?: string
          updated_at?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      form_templates: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string | null
          fields: Json
          id: string
          is_system: boolean | null
          name: string
          organizer_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          fields?: Json
          id?: string
          is_system?: boolean | null
          name: string
          organizer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          fields?: Json
          id?: string
          is_system?: boolean | null
          name?: string
          organizer_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_templates_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          invoice_number: string
          pdf_url: string | null
          registration_id: string
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          invoice_number: string
          pdf_url?: string | null
          registration_id: string
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          invoice_number?: string
          pdf_url?: string | null
          registration_id?: string
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: true
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          channel: string
          created_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          recipient: string
          status: string
          type: string
          user_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient: string
          status?: string
          type: string
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient?: string
          status?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          content_html: string
          content_text: string | null
          created_at: string | null
          id: string
          subject: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          content_html: string
          content_text?: string | null
          created_at?: string | null
          id?: string
          subject?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          content_html?: string
          content_text?: string | null
          created_at?: string | null
          id?: string
          subject?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      participant_addons: {
        Row: {
          addon_id: string
          created_at: string | null
          deleted_at: string | null
          id: string
          participant_id: string
          price: number
          selected_option: string | null
          updated_at: string | null
        }
        Insert: {
          addon_id: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          participant_id: string
          price?: number
          selected_option?: string | null
          updated_at?: string | null
        }
        Update: {
          addon_id?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          participant_id?: string
          price?: number
          selected_option?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participant_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "category_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_addons_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          address: string | null
          age: number | null
          bib_name: string | null
          bib_number: string | null
          category_age: string | null
          category_id: string
          check_in_time: string | null
          checked_in_by: string | null
          country: string | null
          created_at: string | null
          deleted_at: string | null
          dob: string | null
          email: string | null
          emergency_name: string | null
          emergency_phone: string | null
          full_name: string
          gender: string | null
          ic_passport: string | null
          id: string
          medical_details: string | null
          medical_status: boolean | null
          phone: string | null
          postcode: string | null
          qr_token: string | null
          registration_id: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          age?: number | null
          bib_name?: string | null
          bib_number?: string | null
          category_age?: string | null
          category_id: string
          check_in_time?: string | null
          checked_in_by?: string | null
          country?: string | null
          created_at?: string | null
          deleted_at?: string | null
          dob?: string | null
          email?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          full_name: string
          gender?: string | null
          ic_passport?: string | null
          id?: string
          medical_details?: string | null
          medical_status?: boolean | null
          phone?: string | null
          postcode?: string | null
          qr_token?: string | null
          registration_id: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          age?: number | null
          bib_name?: string | null
          bib_number?: string | null
          category_age?: string | null
          category_id?: string
          check_in_time?: string | null
          checked_in_by?: string | null
          country?: string | null
          created_at?: string | null
          deleted_at?: string | null
          dob?: string | null
          email?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          full_name?: string
          gender?: string | null
          ic_passport?: string | null
          id?: string
          medical_details?: string | null
          medical_status?: boolean | null
          phone?: string | null
          postcode?: string | null
          qr_token?: string | null
          registration_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "event_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateways: {
        Row: {
          config: Json | null
          created_at: string | null
          id: string
          is_enabled: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          deleted_at: string | null
          gateway_reference: string | null
          id: string
          metadata: Json | null
          payment_gateway: string
          receipt_url: string | null
          registration_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          gateway_reference?: string | null
          id?: string
          metadata?: Json | null
          payment_gateway: string
          receipt_url?: string | null
          registration_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          gateway_reference?: string | null
          id?: string
          metadata?: Json | null
          payment_gateway?: string
          receipt_url?: string | null
          registration_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount: number
          created_at: string | null
          deleted_at: string | null
          id: string
          payment_id: string
          processed_at: string | null
          reason: string | null
          registration_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          payment_id: string
          processed_at?: string | null
          reason?: string | null
          registration_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          payment_id?: string
          processed_at?: string | null
          reason?: string | null
          registration_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          athlete_id: string
          coupon_id: string | null
          created_at: string | null
          deleted_at: string | null
          discount_amount: number
          event_id: string
          expires_at: string | null
          form_data: Json | null
          id: string
          net_amount: number
          persons_count: number
          registration_number: string
          status: string
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          athlete_id: string
          coupon_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          discount_amount?: number
          event_id: string
          expires_at?: string | null
          form_data?: Json | null
          id?: string
          net_amount?: number
          persons_count?: number
          registration_number: string
          status?: string
          total_amount?: number
          updated_at?: string | null
        }
        Update: {
          athlete_id?: string
          coupon_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          discount_amount?: number
          event_id?: string
          expires_at?: string | null
          form_data?: Json | null
          id?: string
          net_amount?: number
          persons_count?: number
          registration_number?: string
          status?: string
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          age_group_rank: number | null
          bib_number: string
          category_rank: number | null
          certificate_url: string | null
          chip_time: string | null
          created_at: string | null
          deleted_at: string | null
          event_id: string
          finish_time: string | null
          gender_rank: number | null
          gun_time: string | null
          id: string
          overall_rank: number | null
          participant_id: string
          splits: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          age_group_rank?: number | null
          bib_number: string
          category_rank?: number | null
          certificate_url?: string | null
          chip_time?: string | null
          created_at?: string | null
          deleted_at?: string | null
          event_id: string
          finish_time?: string | null
          gender_rank?: number | null
          gun_time?: string | null
          id?: string
          overall_rank?: number | null
          participant_id: string
          splits?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          age_group_rank?: number | null
          bib_number?: string
          category_rank?: number | null
          certificate_url?: string | null
          chip_time?: string | null
          created_at?: string | null
          deleted_at?: string | null
          event_id?: string
          finish_time?: string | null
          gender_rank?: number | null
          gun_time?: string | null
          id?: string
          overall_rank?: number | null
          participant_id?: string
          splits?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "results_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_assignments: {
        Row: {
          assigned_by: string
          created_at: string | null
          event_id: string
          expires_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          assigned_by: string
          created_at?: string | null
          event_id: string
          expires_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          assigned_by?: string
          created_at?: string | null
          event_id?: string
          expires_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_preferences: {
        Row: {
          email_enabled: boolean | null
          marketing_enabled: boolean | null
          sms_enabled: boolean | null
          updated_at: string | null
          user_id: string
          whatsapp_enabled: boolean | null
        }
        Insert: {
          email_enabled?: boolean | null
          marketing_enabled?: boolean | null
          sms_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
          whatsapp_enabled?: boolean | null
        }
        Update: {
          email_enabled?: boolean | null
          marketing_enabled?: boolean | null
          sms_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
          whatsapp_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "user_notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          username: string
          avatar_url: string | null
          created_at: string | null
          deleted_at: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          password_hash: string | null
          phone: string | null
          role: string
          status: string
          updated_at: string | null
        }
        Insert: {
          username?: string
          avatar_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          password_hash?: string | null
          phone?: string | null
          role?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          username?: string
          avatar_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          password_hash?: string | null
          phone?: string | null
          role?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: { Args: never; Returns: string }
      generate_registration_number: { Args: never; Returns: string }
      redeem_coupon: {
        Args: {
          p_coupon_id: string
          p_discount_amount: number
          p_registration_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      validate_coupon: {
        Args: {
          p_code: string
          p_event_id: string
          p_order_amount: number
          p_user_id: string
        }
        Returns: Json
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
