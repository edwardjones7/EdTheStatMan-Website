export type SubscriptionTier = 'free' | 'basic' | 'premium'
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete'
export type AccessLevel = 'free' | 'members'

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
          is_admin: boolean
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
          is_admin?: boolean
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
          is_admin?: boolean
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
          updated_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      subscription_tier: SubscriptionTier
      subscription_status: SubscriptionStatus
      access_level: AccessLevel
    }
  }
}
