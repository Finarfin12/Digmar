import { createClient } from '@/lib/supabase/server';
import { decryptValue } from '@/lib/crypto/server';
import { NextResponse, type NextRequest } from 'next/server';
import { handleApiError } from '@/lib/utils/error-handler';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: accounts, error } = await supabase
      .from('social_accounts')
      .select('*, business_units!inner(*)')
      .eq('business_units.user_id', user.id); // join to business units to get user_id because social_accounts belongs to business_unit_id

    if (error || !accounts) {
      throw new Error('Failed to fetch accounts');
    }

    let updatedCount = 0;

    for (const acc of accounts) {
      if (!acc.access_token_encrypted || !acc.ig_user_id) continue;

      try {
        const token = decryptValue(acc.access_token_encrypted);
        let avatar_url = null;
        let account_name = null;
        let followers_count = null;

        if (acc.platform === 'meta_ig') {
          const res = await fetch(`https://graph.facebook.com/v19.0/${acc.ig_user_id}?fields=profile_picture_url,followers_count,username&access_token=${token}`);
          if (res.ok) {
            const data = await res.json();
            avatar_url = data.profile_picture_url;
            account_name = data.username ? `@${data.username}` : null;
            followers_count = data.followers_count;
          }
        } else if (acc.platform === 'facebook') {
          const res = await fetch(`https://graph.facebook.com/v19.0/${acc.ig_user_id}?fields=picture{url},followers_count,name&access_token=${token}`);
          if (res.ok) {
            const data = await res.json();
            avatar_url = data.picture?.data?.url;
            account_name = data.name;
            followers_count = data.followers_count;
          }
        } else if (acc.platform === 'threads') {
          const res = await fetch(`https://graph.threads.net/v1.0/${acc.ig_user_id}?fields=threads_profile_picture_url,username&access_token=${token}`);
          if (res.ok) {
            const data = await res.json();
            avatar_url = data.threads_profile_picture_url;
            account_name = data.username ? `@${data.username}` : null;
          }
        } else if (acc.platform === 'tiktok') {
          // TikTok doesn't have a simple GET user info without a specific token scope, or maybe they do. We'll skip for now if not available.
        }

        if (avatar_url || account_name || followers_count !== null) {
          const updateData: any = {};
          if (avatar_url) updateData.avatar_url = avatar_url;
          if (account_name) updateData.account_name = account_name;
          if (followers_count !== null && followers_count !== undefined) updateData.followers_count = followers_count;

          await supabase
            .from('social_accounts')
            .update(updateData)
            .eq('id', acc.id);
          updatedCount++;
        }
      } catch (e) {
        console.error(`Failed to sync profile for account ${acc.id}:`, e);
      }
    }

    return NextResponse.json({ message: `Synced ${updatedCount} accounts`, success: true });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
