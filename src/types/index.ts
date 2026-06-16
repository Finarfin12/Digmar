export interface BusinessUnit {
  id: string;
  brand_name: string;
  business_category: string;
  ai_system_prompt: string;
  user_id?: string;
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
