export interface BusinessUnit {
  id: string;
  brand_name: string;
  business_category: string;
  ai_system_prompt: string;
  user_id?: string;
  use_vision_ai?: boolean;
  custom_variables?: Record<string, unknown>;
  brand_color?: string;
  brand_logo_url?: string;
  created_at?: string;
}

export interface SocialAccount {
  id: string;
  business_unit_id: string;
  platform: 'meta_ig' | 'linkedin' | 'threads' | 'tiktok' | string;
  ig_user_id: string;
  access_token?: string;
  access_token_encrypted?: string;
  auto_reply_enabled?: boolean;
}

export interface ProviderConfig {
  id: string;
  provider_name: string;
  base_url: string;
  model: string;
  has_key?: boolean;
}

export interface ImageProviderConfig {
  id?: string;
  provider_type: string;
  model: string | null;
  has_key: boolean;
  config: Record<string, unknown> | null;
  is_active?: boolean;
}

export interface VisionProviderConfig {
  id?: string;
  provider_type: string;
  base_url: string;
  model: string | null;
  has_key: boolean;
  is_active?: boolean;
}

export interface AIResult {
  pilihan_1?: { caption: string; hashtag: string };
  pilihan_2?: { caption: string; hashtag: string };
  pilihan_3?: { caption: string; hashtag: string };
  cerita_musiman?: string;
  keyword_cloud?: string[];
}

export interface PostJob {
  id: string;
  business_unit_id: string;
  target_account_ids: string[];
  scheduled_at: string;
  caption: string;
  media_urls: string[];
  post_type: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  error_message?: string;
}

export interface AnalyticsMetrics {
  followers: number;
  posts: number;
  name: string;
  profile_pic: string;
  reach_7d: number;
  impressions_7d: number;
  engagement_rate: number;
  profile_views_7d: number;
  is_mock: boolean;
}

export interface ChartDataPoint {
  date: string;
  reach: number;
  impressions: number;
  engagement: number;
}

export interface TopPost {
  id: string;
  caption: string;
  media_url: string;
  likes: number;
  comments: number;
  reach: number;
  engagement_rate: number;
  published_at: string;
}

export interface SocialConversation {
  id: string;
  business_unit_id: string;
  account_id: string;
  platform: string;
  type: 'dm' | 'comment';
  customer_id: string;
  customer_name: string;
  customer_avatar_url?: string;
  latest_message: string;
  latest_message_at: string;
  ai_sentiment: 'positif' | 'negatif' | 'netral' | 'keluhan' | 'tanya_harga' | string;
  unread_count: number;
}

export interface SocialMessage {
  id: string;
  conversation_id: string;
  sender_type: 'customer' | 'brand' | 'ai_auto';
  content: string;
  media_url?: string;
  platform_message_id?: string;
  created_at: string;
}
