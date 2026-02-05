/**
 * MindAxis Open API Client SDK
 *
 * A TypeScript client for the MindAxis Open API.
 *
 * @example OAuth Flow
 * ```typescript
 * const client = new MindAxisClient({
 *   clientId: 'your-client-id',
 *   clientSecret: 'your-client-secret',
 *   redirectUri: 'https://your-app.com/callback',
 * });
 *
 * // Generate authorization URL
 * const authUrl = client.getAuthorizationUrl(['profile:read', 'interests:read']);
 *
 * // After user authorizes, exchange code for tokens
 * const tokens = await client.exchangeCode(code, codeVerifier);
 *
 * // Use access token to fetch data
 * const profile = await client.getMyProfile(tokens.access_token);
 * ```
 *
 * @example API Key Flow
 * ```typescript
 * const client = new MindAxisClient({ apiKey: 'your-api-key' });
 *
 * const profile = await client.getPublicProfile('twin-share-id');
 * ```
 */

// ===========================================
// Types
// ===========================================

export interface BigFiveScores {
  O: number; // Openness (0-100)
  C: number; // Conscientiousness (0-100)
  E: number; // Extraversion (0-100)
  A: number; // Agreeableness (0-100)
  N: number; // Neuroticism (0-100)
}

export interface PersonalitySnapshot {
  mbti: string;
  narr4: string;
  rep4: string;
  fullCode: string;
  bigFive: BigFiveScores;
  bfFlags: string | null;
  strengthsSummary: string;
  weaknessesSummary: string;
}

export interface TwinStyle {
  tone: 'gentle' | 'casual' | 'formal';
  tempo: 'slow' | 'moderate' | 'fast';
  formality: 'casual' | 'polite' | 'formal';
}

export interface SafetyPrefs {
  allowRomance: boolean;
  allowPolitics: boolean;
  allowReligion: boolean;
  customBlockedTopics: string[];
}

export interface PublicPersonalityProfile {
  id: string;
  userIdPublic: string;
  twinId: string;
  displayName: string | null;
  twinName: string | null;
  avatarUrl: string | null;
  avatarThumbnailUrl: string | null;
  personalitySnapshot: PersonalitySnapshot;
  twinStyle: TwinStyle;
  safetyPrefs: SafetyPrefs;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerTwinNames {
  ownerName: string | null;
  twinName: string | null;
}

export interface InterestGenre {
  name: string;
  count: number;
  lastSeen: string;
}

export interface InterestsResponse {
  genres: InterestGenre[];
  updatedAt: string;
  extractionMethod: 'weekly_report' | 'journal_analysis';
}

export interface ActionCost {
  action: SnackActionType;
  cost: number;
  affordable: boolean;
}

export interface SnacksResponse {
  balance: number;
  totalPurchased: number;
  totalConsumed: number;
  actionCosts: ActionCost[];
}

export type SnackActionType = 'EXPLORE' | 'POST' | 'COMMENT' | 'LIKE' | 'FOLLOW';

export interface ConsumeSnacksResponse {
  success: true;
  action: SnackActionType;
  consumed: number;
  remaining: number;
}

export interface ConsumeSnacksError {
  success: false;
  error: 'insufficient_snacks';
  error_description: string;
  remaining: number;
  cost: number;
}

export type PostsTab = 'latest' | 'popular';

export interface PostAuthor {
  id: string;
  displayName: string | null;
  avatarThumbnailUrl: string | null;
  personalityCode: string | null;
}

export interface Post {
  id: string;
  author: PostAuthor;
  body: string;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  createdAt: string;
}

export interface PostsTimelineResponse {
  tab: PostsTab;
  posts: Post[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface GetPostsOptions {
  tab?: PostsTab;
  cursor?: string;
  limit?: number;
}

export interface BatchProfilesResponse {
  profiles: Record<string, PublicPersonalityProfile>;
  notFound: string[];
  meta: {
    requested: number;
    found: number;
    maxBatchSize: number;
  };
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface OAuthError {
  error: string;
  error_description?: string;
}

export interface ApiError {
  error: string;
  code: string;
  details?: string;
}

export type Scope = 'profile:read' | 'interests:read' | 'snacks:read' | 'snacks:consume' | 'posts:read';

// ===========================================
// Configuration
// ===========================================

export interface MindAxisOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  baseUrl?: string;
}

export interface MindAxisApiKeyConfig {
  apiKey: string;
  baseUrl?: string;
}

export type MindAxisConfig = MindAxisOAuthConfig | MindAxisApiKeyConfig;

// ===========================================
// PKCE Helper
// ===========================================

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

export async function generatePKCE(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
}> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const codeVerifier = base64UrlEncode(array.buffer);
  const codeChallenge = base64UrlEncode(await sha256(codeVerifier));
  return { codeVerifier, codeChallenge };
}

// ===========================================
// Error Classes
// ===========================================

export class MindAxisApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: string;

  constructor(message: string, status: number, code?: string, details?: string) {
    super(message);
    this.name = 'MindAxisApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class MindAxisOAuthError extends Error {
  public readonly errorCode: string;

  constructor(error: string, description?: string) {
    super(description || error);
    this.name = 'MindAxisOAuthError';
    this.errorCode = error;
  }
}

// ===========================================
// Client
// ===========================================

export class MindAxisClient {
  private readonly baseUrl: string;
  private readonly config: MindAxisConfig;

  constructor(config: MindAxisConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://mindaxis.app/api';
  }

  // -------------------------------------------
  // OAuth Methods
  // -------------------------------------------

  /**
   * Generate the authorization URL for OAuth flow.
   *
   * @param scopes - Array of scopes to request
   * @param state - Optional state parameter for CSRF protection
   * @param pkce - Optional PKCE parameters (codeChallenge)
   * @returns Authorization URL to redirect user to
   */
  getAuthorizationUrl(
    scopes: Scope[],
    state?: string,
    pkce?: { codeChallenge: string }
  ): string {
    if (!this.isOAuthConfig(this.config)) {
      throw new Error('OAuth configuration required for getAuthorizationUrl');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: scopes.join(' '),
    });

    if (state) {
      params.set('state', state);
    }

    if (pkce) {
      params.set('code_challenge', pkce.codeChallenge);
      params.set('code_challenge_method', 'S256');
    }

    return `${this.baseUrl}/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens.
   *
   * @param code - Authorization code from callback
   * @param codeVerifier - PKCE code verifier (if PKCE was used)
   * @returns Token response
   */
  async exchangeCode(code: string, codeVerifier?: string): Promise<TokenResponse> {
    if (!this.isOAuthConfig(this.config)) {
      throw new Error('OAuth configuration required for exchangeCode');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    if (codeVerifier) {
      body.set('code_verifier', codeVerifier);
    }

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new MindAxisOAuthError(data.error, data.error_description);
    }

    return data as TokenResponse;
  }

  /**
   * Refresh an access token using a refresh token.
   *
   * @param refreshToken - Refresh token
   * @returns New token response
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    if (!this.isOAuthConfig(this.config)) {
      throw new Error('OAuth configuration required for refreshAccessToken');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new MindAxisOAuthError(data.error, data.error_description);
    }

    return data as TokenResponse;
  }

  // -------------------------------------------
  // Profile Methods (OAuth)
  // -------------------------------------------

  /**
   * Get the authenticated user's profile.
   * Requires `profile:read` scope.
   *
   * @param accessToken - OAuth access token
   * @returns User's public personality profile
   */
  async getMyProfile(accessToken: string): Promise<PublicPersonalityProfile> {
    return this.fetchWithOAuth<PublicPersonalityProfile>('/open/me', accessToken);
  }

  /**
   * Get the authenticated user's owner and twin names.
   * Requires `profile:read` scope.
   *
   * @param accessToken - OAuth access token
   * @returns Owner and twin names
   */
  async getNames(accessToken: string): Promise<OwnerTwinNames> {
    return this.fetchWithOAuth<OwnerTwinNames>('/open/names', accessToken);
  }

  // -------------------------------------------
  // Profile Methods (API Key)
  // -------------------------------------------

  /**
   * Get a public profile by twinShareId.
   * Uses API key authentication.
   *
   * @param twinShareId - Public twin share ID
   * @returns Public personality profile
   */
  async getPublicProfile(twinShareId: string): Promise<PublicPersonalityProfile> {
    return this.fetchWithApiKey<PublicPersonalityProfile>(`/open/profile/${twinShareId}`);
  }

  /**
   * Get multiple public profiles by twinShareIds.
   * Uses API key authentication. Max 100 IDs per request.
   *
   * @param twinShareIds - Array of public twin share IDs
   * @returns Batch profiles response
   */
  async getPublicProfiles(twinShareIds: string[]): Promise<BatchProfilesResponse> {
    return this.fetchWithApiKey<BatchProfilesResponse>('/open/profiles', {
      method: 'POST',
      body: JSON.stringify({ twinShareIds }),
    });
  }

  // -------------------------------------------
  // Interests Methods (OAuth)
  // -------------------------------------------

  /**
   * Get the authenticated user's interests.
   * Requires `interests:read` scope.
   *
   * @param accessToken - OAuth access token
   * @returns User's interests
   */
  async getInterests(accessToken: string): Promise<InterestsResponse> {
    return this.fetchWithOAuth<InterestsResponse>('/open/interests', accessToken);
  }

  // -------------------------------------------
  // Posts Methods (OAuth)
  // -------------------------------------------

  /**
   * Get the posts timeline.
   * Requires `posts:read` scope.
   *
   * @param accessToken - OAuth access token
   * @param options - Timeline options (tab, cursor, limit)
   * @returns Paginated posts timeline
   *
   * @example Latest posts (最新)
   * ```typescript
   * const timeline = await client.getPostsTimeline(token, { tab: 'latest' });
   * ```
   *
   * @example Popular posts (人気)
   * ```typescript
   * const timeline = await client.getPostsTimeline(token, { tab: 'popular' });
   * ```
   */
  async getPostsTimeline(
    accessToken: string,
    options: GetPostsOptions = {}
  ): Promise<PostsTimelineResponse> {
    const params = new URLSearchParams();
    if (options.tab) params.set('tab', options.tab);
    if (options.cursor) params.set('cursor', options.cursor);
    if (options.limit) params.set('limit', String(options.limit));

    const query = params.toString();
    const path = `/open/posts${query ? `?${query}` : ''}`;
    return this.fetchWithOAuth<PostsTimelineResponse>(path, accessToken);
  }

  // -------------------------------------------
  // Snacks Methods (OAuth)
  // -------------------------------------------

  /**
   * Get the authenticated user's snack balance.
   * Requires `snacks:read` scope.
   *
   * @param accessToken - OAuth access token
   * @returns Snack balance and action costs
   */
  async getSnacks(accessToken: string): Promise<SnacksResponse> {
    return this.fetchWithOAuth<SnacksResponse>('/open/snacks', accessToken);
  }

  /**
   * Consume snacks for an action.
   * Requires `snacks:consume` scope.
   *
   * @param accessToken - OAuth access token
   * @param action - Action type to consume snacks for
   * @returns Consumption result
   */
  async consumeSnacks(
    accessToken: string,
    action: SnackActionType
  ): Promise<ConsumeSnacksResponse | ConsumeSnacksError> {
    const response = await fetch(`${this.baseUrl}/open/snacks/consume`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action }),
    });

    const data = await response.json();

    if (response.status === 400 && data.error === 'insufficient_snacks') {
      return data as ConsumeSnacksError;
    }

    if (!response.ok) {
      this.handleErrorResponse(response.status, data);
    }

    return data as ConsumeSnacksResponse;
  }

  // -------------------------------------------
  // Private Helpers
  // -------------------------------------------

  private isOAuthConfig(config: MindAxisConfig): config is MindAxisOAuthConfig {
    return 'clientId' in config;
  }

  private isApiKeyConfig(config: MindAxisConfig): config is MindAxisApiKeyConfig {
    return 'apiKey' in config;
  }

  private async fetchWithOAuth<T>(path: string, accessToken: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      this.handleErrorResponse(response.status, data);
    }

    return data as T;
  }

  private async fetchWithApiKey<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.isApiKeyConfig(this.config)) {
      throw new Error('API key configuration required');
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      this.handleErrorResponse(response.status, data);
    }

    return data as T;
  }

  private handleErrorResponse(status: number, data: OAuthError | ApiError): never {
    if ('error_description' in data || !('code' in data)) {
      // OAuth error
      const oauthError = data as OAuthError;
      throw new MindAxisOAuthError(oauthError.error, oauthError.error_description);
    } else {
      // API error
      const apiError = data as ApiError;
      throw new MindAxisApiError(apiError.error, status, apiError.code, apiError.details);
    }
  }
}

// Default export
export default MindAxisClient;
