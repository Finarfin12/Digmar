export interface SocialAccount {
  id: string;
  business_unit_id: string;
  platform: 'meta_ig' | 'linkedin' | 'threads' | 'tiktok' | 'facebook';
  ig_user_id: string;
  access_token: string;
  auto_reply_enabled?: boolean;
}

export interface PostJob {
  id: string;
  job_code: string;
  target_account_ids: string[];
  media_urls: string[];
  caption: string;
  first_comment?: string;
  post_type: 'single_image' | 'carousel' | 'reels';
  cover_url?: string;
  retry_count?: number;
  next_retry_at?: string;
  log_messages: Record<string, unknown>[];
  platform_captions?: Record<string, string>;
}
