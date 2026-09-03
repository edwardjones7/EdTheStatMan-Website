// Mirrors Tier in lib/access.ts. Change both together.
export type SubscriptionTier =
  | 'retail' | 'portfolio' | 'desk' | 'private' | 'institutional'

// Stripe's own status strings, stored verbatim. NOT an enum any more: Stripe
// emits 'unpaid', 'incomplete_expired' and 'paused', and a PG enum that rejects
// one of those would make the webhook 500 into an infinite retry loop.
export type SubscriptionStatus = string

// posts.access_level now uses the same ladder as every other gated table.
export type AccessLevel = SubscriptionTier

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          subscription_tier: SubscriptionTier
          subscription_status: SubscriptionStatus | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          access_expires_at: string | null
          last_stripe_session_id: string | null
          is_admin: boolean
          utm_source: string | null
          utm_medium: string | null
          utm_campaign: string | null
          first_referrer: string | null
          landing_page: string | null
          attributed_at: string | null
          notify_email: boolean
          notify_token: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          subscription_tier?: SubscriptionTier
          subscription_status?: SubscriptionStatus | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          access_expires_at?: string | null
          last_stripe_session_id?: string | null
          is_admin?: boolean
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          first_referrer?: string | null
          landing_page?: string | null
          attributed_at?: string | null
          notify_email?: boolean
          notify_token?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          subscription_tier?: SubscriptionTier
          subscription_status?: SubscriptionStatus | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          access_expires_at?: string | null
          last_stripe_session_id?: string | null
          is_admin?: boolean
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          first_referrer?: string | null
          landing_page?: string | null
          attributed_at?: string | null
          notify_email?: boolean
          notify_token?: string
          updated_at?: string
        }
      }
      posts: {
        Row: {
          id: string
          title: string
          slug: string
          content: string
          excerpt: string | null
          tag: string
          access_level: AccessLevel
          published: boolean
          published_at: string | null
          cover_image: string | null
          author_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          content: string
          excerpt?: string | null
          tag: string
          access_level?: AccessLevel
          published?: boolean
          published_at?: string | null
          cover_image?: string | null
          author_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          slug?: string
          content?: string
          excerpt?: string | null
          tag?: string
          access_level?: AccessLevel
          published?: boolean
          published_at?: string | null
          cover_image?: string | null
          updated_at?: string
        }
      }
      purchases: {
        Row: {
          id: number
          user_id: string | null
          stripe_session_id: string
          price_id: string | null
          tier: string
          amount_cents: number
          currency: string
          utm_source: string | null
          utm_medium: string | null
          utm_campaign: string | null
          referrer: string | null
          landing_page: string | null
          created_at: string
        }
        Insert: {
          id?: number
          user_id?: string | null
          stripe_session_id: string
          price_id?: string | null
          tier: string
          amount_cents: number
          currency?: string
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          referrer?: string | null
          landing_page?: string | null
          created_at?: string
        }
        Update: {
          user_id?: string | null
          tier?: string
          amount_cents?: number
        }
      }
      events: {
        Row: {
          id: number
          event_type: string
          path: string | null
          visitor_id: string | null
          user_id: string | null
          meta: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: number
          event_type: string
          path?: string | null
          visitor_id?: string | null
          user_id?: string | null
          meta?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          event_type?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: {
      analytics_summary: {
        Args: { p_from: string; p_to: string }
        Returns: {
          unique_visitors: number
          sessions: number
          bounce_rate: number
          avg_session_s: number
        }
      }
      analytics_timeseries: {
        Args: { p_from: string; p_to: string; p_bucket: string }
        Returns: { bucket: string; views: number; visitors: number }[]
      }
      analytics_breakdown: {
        Args: { p_from: string; p_to: string; p_dim: string; p_limit?: number }
        Returns: { label: string; count: number }[]
      }
      analytics_path_visitors: {
        Args: { p_from: string; p_to: string; p_path: string }
        Returns: number
      }
      active_visitors: {
        Args: Record<string, never>
        Returns: number
      }
    }
    Enums: {
      subscription_tier: SubscriptionTier
      subscription_status: SubscriptionStatus
      access_level: AccessLevel
    }
  }
}
