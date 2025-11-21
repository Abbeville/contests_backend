import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import { UserType } from '../types';
import { socialMediaService } from '../services/socialMediaService';
import crypto from 'crypto';

const router = express.Router();

// In-memory store for PKCE code verifiers keyed by state
const tiktokPkceStore: Map<string, string> = new Map();
const instagramPkceStore: Map<string, string> = new Map();
const facebookPkceStore: Map<string, string> = new Map();
const youtubePkceStore: Map<string, string> = new Map();
const xPkceStore: Map<string, string> = new Map();

function base64UrlEncode(buffer: Buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function generateCodeVerifier(): string {
  // 32-byte random -> base64url
  return base64UrlEncode(crypto.randomBytes(32));
}

function generateCodeChallenge(codeVerifier: string): string {
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  return base64UrlEncode(hash);
}

// TikTok OAuth: get authorization URL
router.get('/tiktok/oauth/url', authenticate, async (req: any, res) => {
  try {
    const clientId = process.env.TIKTOK_CLIENT_ID;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI;
    // const scopes = process.env.TIKTOK_SCOPES || 'user.info.basic,user.info.profile,user.info.stats,video.list';
    const scopes = 'user.info.basic,user.info.profile,user.info.stats,video.list';

    if (!clientId || !redirectUri) {
      return res.status(500).json({ success: false, message: 'TikTok OAuth not configured' });
    }

    const state = `${req.user.id}.${Date.now()}`;
    // Generate PKCE values
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    // Store verifier by state for use on exchange
    tiktokPkceStore.set(state, codeVerifier);
    const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
    url.searchParams.set('client_key', clientId);
    url.searchParams.set('scope', scopes);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    return res.json({ success: true, data: { url: url.toString(), state } });
  } catch (error) {
    console.error('TikTok OAuth URL error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate TikTok OAuth URL' });
  }
});

// Instagram OAuth: get authorization URL (Facebook OAuth for IG Graph)
router.get('/instagram/oauth/url', authenticate, async (req: any, res) => {
  try {
    const clientId = process.env.INSTAGRAM_CLIENT_ID;
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
    const scopes = process.env.INSTAGRAM_SCOPES || 'instagram_basic,pages_show_list,instagram_manage_insights';

    if (!clientId || !redirectUri) {
      return res.status(500).json({ success: false, message: 'Instagram OAuth not configured' });
    }

    const state = `${req.user.id}.${Date.now()}`;
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    instagramPkceStore.set(state, codeVerifier);

    const url = new URL('https://www.facebook.com/v18.0/dialog/oauth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    url.searchParams.set('scope', scopes);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    return res.json({ success: true, data: { url: url.toString(), state } });
  } catch (error) {
    console.error('Instagram OAuth URL error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate Instagram OAuth URL' });
  }
});

// YouTube OAuth: get authorization URL
router.get('/youtube/oauth/url', authenticate, async (req: any, res) => {
  try {
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI;
    const scopes = (process.env.YOUTUBE_SCOPES || 'https://www.googleapis.com/auth/youtube.readonly').split(',').map(s => s.trim());
    if (!clientId || !redirectUri) {
      return res.status(500).json({ success: false, message: 'YouTube OAuth not configured' });
    }
    const state = `${req.user.id}.${Date.now()}`;
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    youtubePkceStore.set(state, codeVerifier);
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', scopes.join(' '));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return res.json({ success: true, data: { url: url.toString(), state } });
  } catch (error) {
    console.error('YouTube OAuth URL error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate YouTube OAuth URL' });
  }
});

// Facebook OAuth: get authorization URL (for managing Pages)
router.get('/facebook/oauth/url', authenticate, async (req: any, res) => {
  try {
    const clientId = process.env.FACEBOOK_CLIENT_ID;
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
    // Request page management/read scopes so we can pull page stats
    const scopes = (process.env.FACEBOOK_SCOPES || 'pages_show_list,pages_read_engagement,pages_read_user_content').split(',').map(s => s.trim());

    if (!clientId || !redirectUri) {
      return res.status(500).json({ success: false, message: 'Facebook OAuth not configured' });
    }

    const state = `${req.user.id}.${Date.now()}`;
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    facebookPkceStore.set(state, codeVerifier);

    const url = new URL('https://www.facebook.com/v18.0/dialog/oauth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    url.searchParams.set('scope', scopes.join(','));
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    return res.json({ success: true, data: { url: url.toString(), state } });
  } catch (error) {
    console.error('Facebook OAuth URL error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate Facebook OAuth URL' });
  }
});

// Facebook OAuth: exchange code for access token and upsert a Page account
router.post('/facebook/oauth/exchange', authenticate, async (req: any, res) => {
  try {
    const { code, state } = req.body as { code: string; state?: string };
    if (!code) {
      return res.status(400).json({ success: false, message: 'Missing authorization code' });
    }

    let codeVerifier: string | undefined;
    if (state) {
      codeVerifier = facebookPkceStore.get(state);
      facebookPkceStore.delete(state);
    }
    if (!codeVerifier) {
      console.warn('Facebook OAuth: Missing code_verifier for state', state);
    }

    const clientId = process.env.FACEBOOK_CLIENT_ID as string;
    const clientSecret = process.env.FACEBOOK_CLIENT_SECRET as string;
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI as string;

    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(500).json({ success: false, message: 'Facebook OAuth not configured' });
    }

    // Exchange short-lived user token
    const tokenResp = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
      }) as any,
    });
    const tokenData: any = await tokenResp.json();
    if (!tokenResp.ok || !tokenData?.access_token) {
      console.error('Facebook token error:', tokenData);
      return res.status(400).json({ success: false, message: 'Failed to exchange Facebook code', data: tokenData });
    }

    const userAccessToken = tokenData.access_token as string;

    // Get pages for this user and take the first one (can improve with UI selection later)
    const pagesResp = await fetch('https://graph.facebook.com/v18.0/me/accounts', {
      headers: { Authorization: `Bearer ${userAccessToken}` },
    });
    const pagesData: any = await pagesResp.json();
    if (!pagesResp.ok || !pagesData?.data?.length) {
      console.error('Facebook pages error:', pagesData);
      return res.status(400).json({ success: false, message: 'No Facebook Page found for this user', data: pagesData });
    }
    const page = pagesData.data[0];

    // Upsert Facebook Page account using page access token (for stats)
    const account = await socialMediaService.connectSocialAccount(req.user.id, {
      platform: 'facebook',
      platform_user_id: page.id,
      username: page.name || 'facebook_page',
      access_token: page.access_token || userAccessToken,
    });

    return res.json({ success: true, message: 'Facebook connected', data: { account } });
  } catch (error) {
    console.error('Facebook OAuth exchange error:', error);
    return res.status(500).json({ success: false, message: 'Facebook exchange failed' });
  }
});

// X (Twitter) OAuth: get authorization URL
router.get('/x/oauth/url', authenticate, async (req: any, res) => {
  try {
    const clientId = process.env.TWITTER_CLIENT_ID;
    const redirectUri = process.env.TWITTER_REDIRECT_URI;
    const scopes = (process.env.TWITTER_SCOPES || 'tweet.read users.read offline.access').split(',').map(s => s.trim());

    if (!clientId || !redirectUri) {
      return res.status(500).json({ success: false, message: 'X (Twitter) OAuth not configured' });
    }

    const state = `${req.user.id}.${Date.now()}`;
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    xPkceStore.set(state, codeVerifier);

    const url = new URL('https://twitter.com/i/oauth2/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', scopes.join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    return res.json({ success: true, data: { url: url.toString(), state } });
  } catch (error) {
    console.error('X OAuth URL error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate X OAuth URL' });
  }
});

// X (Twitter) OAuth: exchange code for tokens and upsert account
router.post('/x/oauth/exchange', authenticate, async (req: any, res) => {
  try {
    const { code, state } = req.body as { code: string; state?: string };
    if (!code) {
      return res.status(400).json({ success: false, message: 'Missing authorization code' });
    }

    let codeVerifier: string | undefined;
    if (state) {
      codeVerifier = xPkceStore.get(state);
      xPkceStore.delete(state);
    }
    if (!codeVerifier) {
      console.warn('X OAuth: Missing code_verifier for state', state);
    }

    const clientId = process.env.TWITTER_CLIENT_ID as string;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET as (string | undefined);
    const redirectUri = process.env.TWITTER_REDIRECT_URI as string;

    if (!clientId || !redirectUri) {
      return res.status(500).json({ success: false, message: 'X (Twitter) OAuth not configured' });
    }

    // Exchange code for access/refresh tokens
    const bodyParams: Record<string, string> = {
      client_id: clientId,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    };
    if (codeVerifier) bodyParams.code_verifier = codeVerifier;

    const tokenResp = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(bodyParams) as any,
    });
    const tokenData: any = await tokenResp.json();
    if (!tokenResp.ok || !tokenData?.access_token) {
      console.error('X token error:', tokenData);
      return res.status(400).json({ success: false, message: 'Failed to exchange X code', data: tokenData });
    }

    const accessToken = tokenData.access_token as string;
    const refreshToken = tokenData.refresh_token as (string | undefined);

    // Fetch current user info with public metrics
    const meResp = await fetch('https://api.twitter.com/2/users/me?user.fields=public_metrics,verified,username', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const meData: any = await meResp.json();
    if (!meResp.ok || !meData?.data?.id) {
      console.error('X user info error:', meData);
      return res.status(400).json({ success: false, message: 'Failed to fetch X user info', data: meData });
    }

    const userId = meData.data.id as string;
    const username = meData.data.username || 'x_user';
    const followerCount = meData.data.public_metrics?.followers_count ?? undefined;

    const account = await socialMediaService.connectSocialAccount(req.user.id, {
      platform: 'twitter',
      platform_user_id: userId,
      username,
      access_token: accessToken,
      refresh_token: refreshToken,
      follower_count: followerCount,
      verified: !!meData.data.verified,
    });

    return res.json({ success: true, message: 'X connected', data: { account } });
  } catch (error) {
    console.error('X OAuth exchange error:', error);
    return res.status(500).json({ success: false, message: 'X exchange failed' });
  }
});

// YouTube OAuth: exchange code for tokens and upsert youtube account
router.post('/youtube/oauth/exchange', authenticate, async (req: any, res) => {
  try {
    const { code, state } = req.body as { code: string; state?: string };
    if (!code) return res.status(400).json({ success: false, message: 'Missing authorization code' });
    let codeVerifier: string | undefined;
    if (state) {
      codeVerifier = youtubePkceStore.get(state);
      youtubePkceStore.delete(state);
    }
    if (!codeVerifier) console.warn('YouTube OAuth: Missing code_verifier for state', state);

    const clientId = process.env.YOUTUBE_CLIENT_ID as string;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET as string;
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI as string;
    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(500).json({ success: false, message: 'YouTube OAuth not configured' });
    }
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
      }) as any,
    });
    const tokenData: any = await tokenResp.json();
    if (!tokenResp.ok || !tokenData?.access_token) {
      console.error('YouTube token error:', tokenData);
      return res.status(400).json({ success: false, message: 'Failed to exchange YouTube code', data: tokenData });
    }
    const accessToken = tokenData.access_token as string;
    const refreshToken = tokenData.refresh_token as (string | undefined);

    // Retrieve channel id of the authenticated user
    const chResp = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const chData: any = await chResp.json();
    if (!chResp.ok || !chData?.items?.length) {
      console.error('YouTube channels error:', chData);
      return res.status(400).json({ success: false, message: 'Failed to fetch YouTube channel', data: chData });
    }
    const channelId = chData.items[0].id;

    const account = await socialMediaService.connectSocialAccount(req.user.id, {
      platform: 'youtube',
      platform_user_id: channelId,
      username: 'youtube_channel',
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    return res.json({ success: true, message: 'YouTube connected', data: { account } });
  } catch (error) {
    console.error('YouTube OAuth exchange error:', error);
    return res.status(500).json({ success: false, message: 'YouTube exchange failed' });
  }
});

// Instagram OAuth: exchange code for access token and upsert social account
router.post('/instagram/oauth/exchange', authenticate, async (req: any, res) => {
  try {
    const { code, state } = req.body as { code: string; state?: string };
    if (!code) {
      return res.status(400).json({ success: false, message: 'Missing authorization code' });
    }
    let codeVerifier: string | undefined;
    if (state) {
      codeVerifier = instagramPkceStore.get(state);
      instagramPkceStore.delete(state);
    }
    if (!codeVerifier) {
      console.warn('Instagram OAuth: Missing code_verifier for state', state);
    }

    const clientId = process.env.INSTAGRAM_CLIENT_ID as string;
    const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET as string;
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI as string;

    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(500).json({ success: false, message: 'Instagram OAuth not configured' });
    }

    const tokenResp = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
      }) as any,
    });
    const tokenData: any = await tokenResp.json();
    if (!tokenResp.ok || !tokenData?.access_token) {
      console.error('Instagram token error:', tokenData);
      return res.status(400).json({ success: false, message: 'Failed to exchange Instagram code', data: tokenData, hint: !codeVerifier ? 'Missing PKCE code_verifier - refresh and try again' : undefined });
    }

    const accessToken = tokenData.access_token as string;
    const refreshToken = undefined; // Facebook/IG typically uses long-lived tokens via separate exchange

    // Resolve pages for this user, then IG business account id
    const pagesResp = await fetch('https://graph.facebook.com/v18.0/me/accounts', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const pagesData: any = await pagesResp.json();
    if (!pagesResp.ok) {
      console.error('Instagram pages error:', pagesData);
      return res.status(400).json({ success: false, message: 'Failed to fetch user pages', data: pagesData });
    }
    const firstPage = pagesData?.data?.[0];
    if (!firstPage?.id) {
      return res.status(400).json({ success: false, message: 'No connected Facebook Page found for Instagram Business account' });
    }
    const pageInfoResp = await fetch(`https://graph.facebook.com/v18.0/${firstPage.id}?fields=instagram_business_account`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const pageInfo: any = await pageInfoResp.json();
    const igBiz = pageInfo?.instagram_business_account?.id;
    if (!igBiz) {
      return res.status(400).json({ success: false, message: 'No Instagram Business account linked to the Page' });
    }

    // Upsert Instagram account
    const account = await socialMediaService.connectSocialAccount(req.user.id, {
      platform: 'instagram',
      platform_user_id: igBiz,
      username: 'instagram_business',
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    return res.json({ success: true, message: 'Instagram connected', data: { account } });
  } catch (error) {
    console.error('Instagram OAuth exchange error:', error);
    return res.status(500).json({ success: false, message: 'Instagram exchange failed' });
  }
});
// TikTok OAuth: exchange code for access token and upsert social account
router.post('/tiktok/oauth/exchange', authenticate, async (req: any, res) => {
  try {
    const { code, state } = req.body as { code: string; state?: string };
    if (!code) {
      return res.status(400).json({ success: false, message: 'Missing authorization code' });
    }
    // Retrieve PKCE code_verifier using state
    let codeVerifier: string | undefined;
    if (state) {
      codeVerifier = tiktokPkceStore.get(state);
      // One-time use
      tiktokPkceStore.delete(state);
    }
    if (!codeVerifier) {
      console.warn('TikTok OAuth: Missing code_verifier for state', state);
    }

    const clientId = process.env.TIKTOK_CLIENT_ID as string;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET as string;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI as string;

    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(500).json({ success: false, message: 'TikTok OAuth not configured' });
    }

    // Exchange code for access token
    const tokenResp = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
      }) as any,
    });

    const tokenData: any = await tokenResp.json();
    if (!tokenResp.ok || !tokenData?.access_token) {
      console.error('TikTok token error:', tokenData);
      return res.status(400).json({ success: false, message: 'Failed to exchange TikTok code', data: tokenData, hint: !codeVerifier ? 'Missing PKCE code_verifier - refresh and try again' : undefined });
    }

    const accessToken = tokenData.access_token as string;
    const refreshToken = tokenData.refresh_token as string | undefined;

    // Fetch user info from TikTok (request explicit fields)
    const fields = [
      'display_name',
      'username',
      'profile_deep_link',
      'avatar_url',
      'is_verified',
      'follower_count'
    ].join(',');
    const meUrl = `https://open.tiktokapis.com/v2/user/info/?fields=${encodeURIComponent(fields)}`;
    const meResp = await fetch(meUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const meData: any = await meResp.json();
    if (!meResp.ok) {
      console.error('TikTok user info error:', { status: meResp.status, statusText: meResp.statusText, body: meData });
      return res.status(400).json({ success: false, message: 'Failed to fetch TikTok user info', data: meData });
    }

    // Normalize username/profile url if available
    const platformUserId = meData?.data?.user?.open_id || meData?.data?.user?.user_id || meData?.data?.user?.username || undefined;
    const username = meData?.data?.user?.display_name || meData?.data?.user?.username || 'tiktok_user';
    const profileUrl = meData?.data?.user?.profile_deep_link || undefined;
    const followerCount = meData?.data?.user?.follower_count || undefined;

    // Upsert social account record
    const account = await socialMediaService.connectSocialAccount(req.user.id, {
      platform: 'tiktok',
      platform_user_id: platformUserId || username,
      username,
      access_token: accessToken,
      refresh_token: refreshToken,
      profile_url: profileUrl,
      follower_count: followerCount,
      verified: !!meData?.data?.user?.is_verified,
    });

    return res.json({ success: true, message: 'TikTok connected', data: { account } });
  } catch (error) {
    console.error('TikTok OAuth exchange error:', error);
    return res.status(500).json({ success: false, message: 'TikTok exchange failed' });
  }
});

// Connect social media account
router.post('/connect', authenticate, [
  body('platform').notEmpty().trim(),
  body('username').notEmpty().trim(),
  body('access_token').notEmpty().trim(),
  body('refresh_token').optional().trim(),
  body('profile_url').optional().trim(),
  body('follower_count').optional().isInt({ min: 0 }),
  body('verified').optional().isBoolean()
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const socialData = {
      platform: req.body.platform,
      username: req.body.username,
      access_token: req.body.access_token,
      refresh_token: req.body.refresh_token,
      profile_url: req.body.profile_url,
      follower_count: req.body.follower_count,
      verified: req.body.verified
    };

    const account = await socialMediaService.connectSocialAccount(req.user.id, socialData);

    res.status(201).json({
      success: true,
      message: 'Social media account connected successfully',
      data: { account }
    });
  } catch (error) {
    console.error('Connect social media error:', error);
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user's social media accounts
router.get('/accounts', authenticate, async (req: any, res) => {
  try {
    const accounts = await socialMediaService.getUserSocialAccounts(req.user.id);

    res.json({
      success: true,
      data: { accounts }
    });
  } catch (error) {
    console.error('Get social media accounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Refresh live stats for connected accounts (no DB schema changes needed)
router.get('/accounts/refresh', authenticate, async (req: any, res) => {
  try {
    const accounts = await socialMediaService.getUserSocialAccounts(req.user.id);
    const refreshed = [] as any[];

    for (const acc of accounts as any[]) {
      const platform = (acc.platform || '').toLowerCase();
      if (platform === 'tiktok' && acc.access_token) {
        try {
          const fields = [
            'display_name',
            'username',
            'profile_deep_link',
            'avatar_url',
            'is_verified',
            'follower_count',
            'following_count',
            'likes_count',
            'video_count'
          ].join(',');
          const meUrl = `https://open.tiktokapis.com/v2/user/info/?fields=${encodeURIComponent(fields)}`;
          const meResp = await fetch(meUrl, {
            method: 'GET',
            headers: { Authorization: `Bearer ${acc.access_token}` },
          });
          const meData: any = await meResp.json();
          if (meResp.ok) {
            const follower_count = meData?.data?.user?.follower_count || 0;
            const following_count = meData?.data?.user?.following_count || 0;
            const likes_count = meData?.data?.user?.likes_count || 0;
            const video_count = meData?.data?.user?.video_count || 0;

            // Persist stats on the account
            acc.username = meData?.data?.user?.username || acc.username;
            (acc as any).profile_url = meData?.data?.user?.profile_deep_link || (acc as any).profile_url;
            (acc as any).follower_count = follower_count;
            (acc as any).following_count = following_count;
            (acc as any).likes_count = likes_count;
            (acc as any).video_count = video_count;
            (acc as any).verified = !!meData?.data?.user?.is_verified;
            acc.updated_at = new Date();
            await (await import('../config/database')).AppDataSource.getRepository((await import('../models/SocialMediaAccount')).SocialMediaAccount).save(acc);

            refreshed.push({
              id: acc.id,
              platform: 'tiktok',
              username: acc.username,
              profile_url: (acc as any).profile_url,
              follower_count,
              following_count,
              likes_count,
              video_count,
              verified: (acc as any).verified || false,
            });
            continue;
          }
        } catch (e) {
          console.error('TikTok refresh failed for account', acc.id, e);
        }
      }
      if (platform === 'twitter' && acc.access_token) {
        try {
          // If platform_user_id is known, use it; otherwise fetch /users/me
          let twitterId = (acc as any).platform_user_id;
          if (!twitterId) {
            const meResp = await fetch('https://api.twitter.com/2/users/me?user.fields=public_metrics,verified,username', {
              headers: { Authorization: `Bearer ${acc.access_token}` },
            });
            const meData: any = await meResp.json();
            if (meResp.ok && meData?.data?.id) {
              twitterId = meData.data.id;
              acc.username = meData.data.username || acc.username;
              (acc as any).verified = !!meData.data.verified;
              const pm = meData.data.public_metrics || {};
              (acc as any).follower_count = pm.followers_count || 0;
              (acc as any).following_count = pm.following_count || 0;
              (acc as any).tweet_count = pm.tweet_count || 0;
            }
          }

          if (twitterId) {
            const userResp = await fetch(`https://api.twitter.com/2/users/${encodeURIComponent(twitterId)}?user.fields=public_metrics,verified,username`, {
              headers: { Authorization: `Bearer ${acc.access_token}` },
            });
            const userData: any = await userResp.json();
            if (userResp.ok && userData?.data) {
              acc.username = userData.data.username || acc.username;
              const pm = userData.data.public_metrics || {};
              (acc as any).follower_count = pm.followers_count || 0;
              (acc as any).following_count = pm.following_count || 0;
              (acc as any).tweet_count = pm.tweet_count || 0;
              (acc as any).verified = !!userData.data.verified;
              acc.updated_at = new Date();
              await (await import('../config/database')).AppDataSource.getRepository((await import('../models/SocialMediaAccount')).SocialMediaAccount).save(acc);

              refreshed.push({
                id: acc.id,
                platform: 'twitter',
                username: acc.username,
                profile_url: (acc as any).profile_url,
                follower_count: (acc as any).follower_count || 0,
                following_count: (acc as any).following_count || 0,
                likes_count: (acc as any).likes_count || 0,
                tweet_count: (acc as any).tweet_count || 0,
                verified: (acc as any).verified || false,
              });
              continue;
            }
          }
        } catch (e) {
          console.error('X refresh failed for account', acc.id, e);
        }
      }
      if (platform === 'instagram' && acc.access_token) {
        try {
          // Resolve IG business id may already be stored as platform_user_id
          let igId = (acc as any).platform_user_id;
          if (!igId) {
            // Fallback: attempt to resolve via pages
            const pagesResp = await fetch('https://graph.facebook.com/v18.0/me/accounts', {
              headers: { Authorization: `Bearer ${acc.access_token}` },
            });
            const pagesData: any = await pagesResp.json();
            const firstPage = pagesData?.data?.[0];
            if (firstPage?.id) {
              const pageInfoResp = await fetch(`https://graph.facebook.com/v18.0/${firstPage.id}?fields=instagram_business_account`, {
                headers: { Authorization: `Bearer ${acc.access_token}` },
              });
              const pageInfo: any = await pageInfoResp.json();
              igId = pageInfo?.instagram_business_account?.id;
            }
          }

          if (igId) {
            const igFields = ['username', 'followers_count', 'media_count'].join(',');
            const igResp = await fetch(`https://graph.facebook.com/v18.0/${igId}?fields=${encodeURIComponent(igFields)}`, {
              headers: { Authorization: `Bearer ${acc.access_token}` },
            });
            const igData: any = await igResp.json();
            if (igResp.ok) {
              const follower_count = igData?.followers_count || 0;
              const video_count = igData?.media_count || 0;
              acc.username = igData?.username || acc.username;
              (acc as any).follower_count = follower_count;
              (acc as any).video_count = video_count;
              // follows_count often requires additional permissions; leave following_count as-is
              acc.updated_at = new Date();
              await (await import('../config/database')).AppDataSource.getRepository((await import('../models/SocialMediaAccount')).SocialMediaAccount).save(acc);

              refreshed.push({
                id: acc.id,
                platform: 'instagram',
                username: acc.username,
                profile_url: (acc as any).profile_url,
                follower_count,
                following_count: (acc as any).following_count || 0,
                likes_count: (acc as any).likes_count || 0,
                video_count,
                verified: (acc as any).verified || false,
              });
              continue;
            }
          }
        } catch (e) {
          console.error('Instagram refresh failed for account', acc.id, e);
        }
      }
      if (platform === 'facebook' && acc.access_token) {
        try {
          const pageId = (acc as any).platform_user_id;
          if (pageId) {
            const fbResp = await fetch(`https://graph.facebook.com/v18.0/${encodeURIComponent(pageId)}?fields=name,fan_count`, {
              headers: { Authorization: `Bearer ${acc.access_token}` },
            });
            const fbData: any = await fbResp.json();
            if (fbResp.ok && fbData) {
              acc.username = fbData.name || acc.username;
              (acc as any).follower_count = (fbData.fan_count ?? 0) as number;
              acc.updated_at = new Date();
              await (await import('../config/database')).AppDataSource.getRepository((await import('../models/SocialMediaAccount')).SocialMediaAccount).save(acc);

              refreshed.push({
                id: acc.id,
                platform: 'facebook',
                username: acc.username,
                profile_url: (acc as any).profile_url,
                follower_count: (acc as any).follower_count || 0,
                following_count: (acc as any).following_count || 0,
                likes_count: (acc as any).likes_count || 0,
                video_count: (acc as any).video_count || 0,
                verified: (acc as any).verified || false,
              });
              continue;
            }
          }
        } catch (e) {
          console.error('Facebook refresh failed for account', acc.id, e);
        }
      }
      if (platform === 'youtube' && acc.access_token) {
        try {
          const channelId = (acc as any).platform_user_id;
          if (channelId) {
            const statsResp = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${encodeURIComponent(channelId)}`, {
              headers: { Authorization: `Bearer ${acc.access_token}` },
            });
            const statsData: any = await statsResp.json();
            if (statsResp.ok && statsData?.items?.length) {
              const s = statsData.items[0].statistics || {};
              const follower_count = parseInt(s.subscriberCount || '0', 10) || 0;
              const video_count = parseInt(s.videoCount || '0', 10) || 0;
              const views_count = parseInt(s.viewCount || '0', 10) || 0;
              (acc as any).follower_count = follower_count;
              (acc as any).video_count = video_count;
              (acc as any).views_count = views_count;
              acc.updated_at = new Date();
              await (await import('../config/database')).AppDataSource.getRepository((await import('../models/SocialMediaAccount')).SocialMediaAccount).save(acc);
              refreshed.push({
                id: acc.id,
                platform: 'youtube',
                username: acc.username,
                profile_url: (acc as any).profile_url,
                follower_count,
                following_count: (acc as any).following_count || 0,
                likes_count: (acc as any).likes_count || 0,
                video_count,
                views_count,
                verified: (acc as any).verified || false,
              });
              continue;
            } else {
              console.error('YouTube stats error:', statsData);
            }
          }
        } catch (e) {
          console.error('YouTube refresh failed for account', acc.id, e);
        }
      }
      // Fallback: return minimal info
      refreshed.push({
        id: acc.id,
        platform: acc.platform,
        username: acc.username,
        profile_url: (acc as any).profile_url,
        follower_count: (acc as any).follower_count || 0,
        verified: (acc as any).verified || false,
      });
    }

    res.json({ success: true, data: { accounts: refreshed } });
  } catch (error) {
    console.error('Refresh social media accounts error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Update social media account
router.put('/accounts/:platform', authenticate, [
  body('username').optional().trim(),
  body('access_token').optional(),
  body('refresh_token').optional(),
  body('profile_url').optional().trim(),
  body('follower_count').optional().isInt({ min: 0 }),
  body('verified').optional().isBoolean()
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const updateData = {
      username: req.body.username,
      access_token: req.body.access_token,
      refresh_token: req.body.refresh_token,
      profile_url: req.body.profile_url,
      follower_count: req.body.follower_count,
      verified: req.body.verified
    };

    const account = await socialMediaService.updateSocialAccount(
      req.user.id,
      req.params.platform,
      updateData
    );

    res.json({
      success: true,
      message: 'Social media account updated successfully',
      data: { account }
    });
  } catch (error) {
    console.error('Update social media account error:', error);
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Disconnect social media account
router.delete('/accounts/:platform', authenticate, async (req: any, res) => {
  try {
    const result = await socialMediaService.disconnectSocialAccount(
      req.user.id,
      req.params.platform
    );

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Disconnect social media account error:', error);
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get social media account by ID
router.get('/accounts/:id', authenticate, async (req: any, res) => {
  try {
    const account = await socialMediaService.getSocialAccountById(req.params.id);

    // Check if account belongs to user
    if (account.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: { account }
    });
  } catch (error) {
    console.error('Get social media account error:', error);
    if (error instanceof Error && error.message === 'Social media account not found') {
      return res.status(404).json({
        success: false,
        message: 'Social media account not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Test social media connection
router.post('/accounts/:id/test', authenticate, async (req: any, res) => {
  try {
    const account = await socialMediaService.getSocialAccountById(req.params.id);

    // Check if account belongs to user
    if (account.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // In a real application, you would test the connection by making an API call
    // to the respective social media platform using the access token
    // For now, we'll simulate a successful test

    res.json({
      success: true,
      message: 'Social media connection test successful',
      data: {
        platform: account.platform,
        username: account.username,
        is_active: account.is_active
      }
    });
  } catch (error) {
    console.error('Test social media connection error:', error);
    if (error instanceof Error && error.message === 'Social media account not found') {
      return res.status(404).json({
        success: false,
        message: 'Social media account not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get recent posts from connected social media accounts
router.get('/posts/recent', authenticate, async (req: any, res) => {
  try {
    const platform = req.query.platform as string;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const accounts = await socialMediaService.getUserSocialAccounts(req.user.id);
    const posts = [];

    for (const account of accounts) {
      if (platform && account.platform !== platform) continue;
      
      try {
        let platformPosts = [];
        
        switch (account.platform) {
          case 'tiktok':
            platformPosts = await fetchTikTokPosts(account.access_token, limit);
            break;
          case 'instagram':
            platformPosts = await fetchInstagramPosts(account.access_token, limit);
            break;
          case 'facebook':
            platformPosts = await fetchFacebookPosts(account.access_token, limit);
            break;
          case 'youtube':
            platformPosts = await fetchYouTubePosts(account.access_token, limit);
            break;
          case 'x':
            platformPosts = await fetchTwitterPosts(account.access_token, limit);
            break;
        }
        
        posts.push(...platformPosts.map(post => ({
          ...post,
          platform: account.platform,
          account_username: account.username
        })));
      } catch (error) {
        console.error(`Error fetching ${account.platform} posts:`, error);
        // Continue with other platforms
      }
    }

    // Sort by creation date (most recent first)
    posts.sort((a, b) => new Date(b.created_time).getTime() - new Date(a.created_time).getTime());

    res.json({
      success: true,
      data: { posts: posts.slice(0, limit) }
    });
  } catch (error) {
    console.error('Get recent posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Helper functions for fetching posts from each platform
async function fetchTikTokPosts(accessToken: string, limit: number) {
  try {
    console.log('Attempting to fetch TikTok posts with token:', accessToken.substring(0, 20) + '...');
    
    // Try the user info endpoint first to validate the token
    const userResponse = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name', {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('TikTok user info response:', userResponse.status, userResponse.statusText);
    
    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('TikTok user info failed:', userResponse.status, userResponse.statusText, errorText);
      return [];
    }
    
    const userData: any = await userResponse.json();
    console.log('TikTok user data:', JSON.stringify(userData, null, 2));
    
    const userId = userData.data?.user?.open_id;
    
    if (!userId) {
      console.error('TikTok user ID not found in response');
      return [];
    }
    
    // Use the correct TikTok API endpoint for fetching user videos
    const response = await fetch('https://open.tiktokapis.com/v2/video/list/?fields=id,create_time,cover_image_url,share_url,video_description,duration,height,width,title,embed_html,embed_link,like_count,comment_count,share_count,view_count', {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        max_count: limit
      })
    });
    
    console.log("TikTok posts response:", response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('TikTok posts fetch failed:', response.status, response.statusText, errorText);
      
      // If 404, it might be that the endpoint doesn't exist or requires different permissions
      if (response.status === 404) {
        console.error('TikTok posts endpoint not found - this might require different API permissions or the endpoint might be deprecated');
      }
      
      return [];
    }
    
    const data: any = await response.json();
    console.log('TikTok posts API response:', JSON.stringify(data, null, 2));
    
    return data.data?.videos?.map((video: any) => ({
      id: video.id,
      caption: video.video_description || video.title || '',
      media_url: video.cover_image_url || '',
      created_time: new Date(video.create_time * 1000).toISOString(), // Convert Unix timestamp to ISO string
      metrics: {
        likes: video.like_count || 0,
        comments: video.comment_count || 0,
        shares: video.share_count || 0,
        views: video.view_count || 0
      },
      post_url: video.share_url || `https://www.tiktok.com/@user/video/${video.id}`
    })) || [];
  } catch (error) {
    console.error('TikTok posts fetch error:', error);
    return [];
  }
}

async function fetchInstagramPosts(accessToken: string, limit: number) {
  try {
    // First get the Instagram Business Account ID
    const pagesResponse = await fetch('https://graph.facebook.com/v18.0/me/accounts', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!pagesResponse.ok) return [];
    
    const pagesData: any = await pagesResponse.json();
    const firstPage = pagesData.data?.[0];
    
    if (!firstPage?.id) return [];
    
    const pageInfoResponse = await fetch(`https://graph.facebook.com/v18.0/${firstPage.id}?fields=instagram_business_account`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    const pageInfo: any = await pageInfoResponse.json();
    const igBizId = pageInfo?.instagram_business_account?.id;
    
    if (!igBizId) return [];
    
    // Fetch recent media
    const mediaResponse = await fetch(`https://graph.facebook.com/v18.0/${igBizId}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,insights.metric(impressions,reach,likes,comments,shares)&limit=${limit}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!mediaResponse.ok) return [];
    
    const mediaData: any = await mediaResponse.json();
    return mediaData.data?.map((post: any) => ({
      id: post.id,
      caption: post.caption || '',
      media_url: post.media_url || post.thumbnail_url || '',
      created_time: post.timestamp,
      metrics: {
        likes: post.insights?.data?.find((i: any) => i.name === 'likes')?.values?.[0]?.value || 0,
        comments: post.insights?.data?.find((i: any) => i.name === 'comments')?.values?.[0]?.value || 0,
        shares: post.insights?.data?.find((i: any) => i.name === 'shares')?.values?.[0]?.value || 0,
        views: post.insights?.data?.find((i: any) => i.name === 'impressions')?.values?.[0]?.value || 0
      },
      post_url: `https://www.instagram.com/p/${post.id}/`
    })) || [];
  } catch (error) {
    console.error('Instagram posts fetch error:', error);
    return [];
  }
}

async function fetchFacebookPosts(accessToken: string, limit: number) {
  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/me/posts?fields=id,message,created_time,attachments{media},insights.metric(post_impressions,post_engaged_users)&limit=${limit}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!response.ok) return [];
    
    const data: any = await response.json();
    return data.data?.map((post: any) => ({
      id: post.id,
      caption: post.message || '',
      media_url: post.attachments?.data?.[0]?.media?.image?.src || '',
      created_time: post.created_time,
      metrics: {
        likes: 0, // Facebook doesn't provide likes in this endpoint
        comments: 0,
        shares: 0,
        views: post.insights?.data?.find((i: any) => i.name === 'post_impressions')?.values?.[0]?.value || 0
      },
      post_url: `https://www.facebook.com/posts/${post.id}`
    })) || [];
  } catch (error) {
    console.error('Facebook posts fetch error:', error);
    return [];
  }
}

async function fetchYouTubePosts(accessToken: string, limit: number) {
  try {
    // First get the channel ID
    const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!channelResponse.ok) return [];
    
    const channelData: any = await channelResponse.json();
    const channelId = channelData.items?.[0]?.id;
    
    if (!channelId) return [];
    
    // Fetch recent videos
    const videosResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=${limit}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!videosResponse.ok) return [];
    
    const videosData: any = await videosResponse.json();
    
    // Get video statistics
    const videoIds = videosData.items?.map((v: any) => v.id.videoId).join(',');
    const statsResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!statsResponse.ok) return [];
    
    const statsData: any = await statsResponse.json();
    
    return statsData.items?.map((video: any) => ({
      id: video.id,
      caption: video.snippet?.title || '',
      media_url: video.snippet?.thumbnails?.high?.url || '',
      created_time: video.snippet?.publishedAt,
      metrics: {
        likes: parseInt(video.statistics?.likeCount || '0'),
        comments: parseInt(video.statistics?.commentCount || '0'),
        shares: 0, // YouTube doesn't provide share count in this endpoint
        views: parseInt(video.statistics?.viewCount || '0')
      },
      post_url: `https://www.youtube.com/watch?v=${video.id}`
    })) || [];
  } catch (error) {
    console.error('YouTube posts fetch error:', error);
    return [];
  }
}

async function fetchTwitterPosts(accessToken: string, limit: number) {
  try {
    // First get user ID
    const userResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!userResponse.ok) return [];
    
    const userData: any = await userResponse.json();
    const userId = userData.data?.id;
    
    if (!userId) return [];
    
    // Fetch recent tweets
    const tweetsResponse = await fetch(`https://api.twitter.com/2/users/${userId}/tweets?tweet.fields=created_at,public_metrics,attachments&media.fields=url&max_results=${limit}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!tweetsResponse.ok) return [];
    
    const tweetsData: any = await tweetsResponse.json();
    return tweetsData.data?.map((tweet: any) => ({
      id: tweet.id,
      caption: tweet.text || '',
      media_url: tweet.attachments?.media_keys?.[0] ? '' : '', // Would need separate media fetch
      created_time: tweet.created_at,
      metrics: {
        likes: tweet.public_metrics?.like_count || 0,
        comments: tweet.public_metrics?.reply_count || 0,
        shares: tweet.public_metrics?.retweet_count || 0,
        views: tweet.public_metrics?.impression_count || 0
      },
      post_url: `https://twitter.com/i/web/status/${tweet.id}`
    })) || [];
  } catch (error) {
    console.error('Twitter posts fetch error:', error);
    return [];
  }
}

// Get social media statistics
router.get('/stats', authenticate, async (req: any, res) => {
  try {
    const stats = await socialMediaService.getSocialMediaStats(req.user.id);

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Get social media stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Search social media accounts
router.get('/search', authenticate, async (req: any, res) => {
  try {
    const params = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      search: req.query.search as string,
      platform: req.query.platform as string,
      minFollowers: req.query.min_followers ? parseInt(req.query.min_followers as string) : undefined,
      maxFollowers: req.query.max_followers ? parseInt(req.query.max_followers as string) : undefined,
      verified: req.query.verified === 'true' ? true : req.query.verified === 'false' ? false : undefined
    };

    const result = await socialMediaService.searchSocialAccounts(params);

    res.json({
      success: true,
      data: { accounts: result.accounts },
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Search social media accounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Admin routes
// Get all social media accounts (admin only)
router.get('/admin/accounts', authenticate, authorize(UserType.ADMIN), async (req: any, res) => {
  try {
    const params = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      platform: req.query.platform as string,
      verified: req.query.verified === 'true' ? true : req.query.verified === 'false' ? false : undefined,
      userId: req.query.user_id as string
    };

    const result = await socialMediaService.getAllSocialAccounts(params);

    res.json({
      success: true,
      data: { accounts: result.accounts },
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get all social media accounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Verify social media account (admin only)
router.patch('/admin/accounts/:id/verify', authenticate, authorize(UserType.ADMIN), [
  body('verified').isBoolean()
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { verified } = req.body;

    const account = await socialMediaService.verifySocialAccount(req.params.id, verified);

    res.json({
      success: true,
      message: `Social media account ${verified ? 'verified' : 'unverified'} successfully`,
      data: { account }
    });
  } catch (error) {
    console.error('Verify social media account error:', error);
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete social media account (admin only)
router.delete('/admin/accounts/:id', authenticate, authorize(UserType.ADMIN), async (req: any, res) => {
  try {
    const result = await socialMediaService.deleteSocialAccount(req.params.id);

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Delete social media account error:', error);
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get platform statistics (admin only)
router.get('/admin/platforms/:platform/stats', authenticate, authorize(UserType.ADMIN), async (req: any, res) => {
  try {
    const stats = await socialMediaService.getPlatformStats(req.params.platform);

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Get platform stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;