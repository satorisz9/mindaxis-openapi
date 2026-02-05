/**
 * MindAxis Open API - React Hooks Example
 *
 * This example provides React hooks for integrating MindAxis API
 * into a Next.js or React application.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  MindAxisClient,
  generatePKCE,
  type PublicPersonalityProfile,
  type InterestsResponse,
  type SnacksResponse,
  type PostsTimelineResponse,
  type PostsTab,
  type Post,
  type Scope,
  type TokenResponse,
  MindAxisOAuthError,
  MindAxisApiError,
} from '../sdk/mindaxis-client';

// ===========================================
// Types
// ===========================================

interface MindAxisAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}

interface UseMindAxisAuthReturn extends MindAxisAuthState {
  login: (scopes?: Scope[]) => Promise<void>;
  logout: () => void;
  getAccessToken: () => Promise<string | null>;
}

interface UseMindAxisProfileReturn {
  profile: PublicPersonalityProfile | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ===========================================
// Configuration
// ===========================================

const STORAGE_KEY = 'mindaxis_auth';
const DEFAULT_SCOPES: Scope[] = ['profile:read', 'interests:read', 'snacks:read'];

// Create client instance (configure based on your environment)
const createClient = () => new MindAxisClient({
  clientId: process.env.NEXT_PUBLIC_MINDAXIS_CLIENT_ID || '',
  clientSecret: process.env.MINDAXIS_CLIENT_SECRET || '',
  redirectUri: typeof window !== 'undefined'
    ? `${window.location.origin}/auth/mindaxis/callback`
    : '',
});

// ===========================================
// Auth Hook
// ===========================================

export function useMindAxisAuth(): UseMindAxisAuthReturn {
  const [state, setState] = useState<MindAxisAuthState>({
    isAuthenticated: false,
    isLoading: true,
    error: null,
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
  });

  // Load stored auth on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const auth = JSON.parse(stored);
        setState({
          isAuthenticated: true,
          isLoading: false,
          error: null,
          accessToken: auth.accessToken,
          refreshToken: auth.refreshToken,
          expiresAt: auth.expiresAt,
        });
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Start OAuth login flow
  const login = useCallback(async (scopes: Scope[] = DEFAULT_SCOPES) => {
    const client = createClient();

    // Generate PKCE
    const { codeVerifier, codeChallenge } = await generatePKCE();

    // Store code verifier for callback
    sessionStorage.setItem('mindaxis_code_verifier', codeVerifier);

    // Generate state for CSRF protection
    const state = crypto.randomUUID();
    sessionStorage.setItem('mindaxis_oauth_state', state);

    // Redirect to authorization URL
    const authUrl = client.getAuthorizationUrl(scopes, state, { codeChallenge });
    window.location.href = authUrl;
  }, []);

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({
      isAuthenticated: false,
      isLoading: false,
      error: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
    });
  }, []);

  // Get valid access token (refresh if needed)
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!state.accessToken) return null;

    // Check if token is expired (with 5 minute buffer)
    const now = Date.now();
    if (state.expiresAt && now > state.expiresAt - 5 * 60 * 1000) {
      // Token is expired or about to expire, refresh it
      if (!state.refreshToken) {
        logout();
        return null;
      }

      try {
        const client = createClient();
        const tokens = await client.refreshAccessToken(state.refreshToken);

        const newExpiresAt = Date.now() + tokens.expires_in * 1000;

        const newState = {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || state.refreshToken,
          expiresAt: newExpiresAt,
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));

        setState(prev => ({
          ...prev,
          ...newState,
        }));

        return tokens.access_token;
      } catch (error) {
        console.error('Token refresh failed:', error);
        logout();
        return null;
      }
    }

    return state.accessToken;
  }, [state.accessToken, state.refreshToken, state.expiresAt, logout]);

  return {
    ...state,
    login,
    logout,
    getAccessToken,
  };
}

// ===========================================
// OAuth Callback Handler
// ===========================================

export function useMindAxisCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const errorParam = params.get('error');
      const errorDescription = params.get('error_description');

      if (errorParam) {
        setError(errorDescription || errorParam);
        setStatus('error');
        return;
      }

      if (!code) {
        setError('No authorization code received');
        setStatus('error');
        return;
      }

      // Verify state
      const storedState = sessionStorage.getItem('mindaxis_oauth_state');
      if (state !== storedState) {
        setError('Invalid state parameter');
        setStatus('error');
        return;
      }

      // Get code verifier
      const codeVerifier = sessionStorage.getItem('mindaxis_code_verifier');
      if (!codeVerifier) {
        setError('Missing code verifier');
        setStatus('error');
        return;
      }

      try {
        const client = createClient();
        const tokens = await client.exchangeCode(code, codeVerifier);

        // Store tokens
        const auth = {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));

        // Clean up
        sessionStorage.removeItem('mindaxis_code_verifier');
        sessionStorage.removeItem('mindaxis_oauth_state');

        setStatus('success');

        // Redirect to home or stored redirect path
        const redirectPath = sessionStorage.getItem('mindaxis_redirect') || '/';
        sessionStorage.removeItem('mindaxis_redirect');
        window.location.href = redirectPath;
      } catch (err) {
        console.error('Token exchange failed:', err);
        setError(err instanceof Error ? err.message : 'Token exchange failed');
        setStatus('error');
      }
    };

    handleCallback();
  }, []);

  return { status, error };
}

// ===========================================
// Profile Hook
// ===========================================

export function useMindAxisProfile(): UseMindAxisProfileReturn {
  const { getAccessToken, isAuthenticated } = useMindAxisAuth();
  const [profile, setProfile] = useState<PublicPersonalityProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!isAuthenticated) {
      setProfile(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No access token');
      }

      const client = createClient();
      const data = await client.getMyProfile(token);
      setProfile(data);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      if (err instanceof MindAxisOAuthError) {
        setError(err.message);
      } else if (err instanceof MindAxisApiError) {
        setError(err.message);
      } else {
        setError('Failed to fetch profile');
      }
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, getAccessToken]);

  useEffect(() => {
    if (isAuthenticated) {
      refetch();
    }
  }, [isAuthenticated, refetch]);

  return { profile, isLoading, error, refetch };
}

// ===========================================
// Interests Hook
// ===========================================

export function useMindAxisInterests() {
  const { getAccessToken, isAuthenticated } = useMindAxisAuth();
  const [interests, setInterests] = useState<InterestsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!isAuthenticated) {
      setInterests(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No access token');
      }

      const client = createClient();
      const data = await client.getInterests(token);
      setInterests(data);
    } catch (err) {
      console.error('Failed to fetch interests:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch interests');
      setInterests(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, getAccessToken]);

  useEffect(() => {
    if (isAuthenticated) {
      refetch();
    }
  }, [isAuthenticated, refetch]);

  return { interests, isLoading, error, refetch };
}

// ===========================================
// Snacks Hook
// ===========================================

export function useMindAxisSnacks() {
  const { getAccessToken, isAuthenticated } = useMindAxisAuth();
  const [snacks, setSnacks] = useState<SnacksResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!isAuthenticated) {
      setSnacks(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No access token');
      }

      const client = createClient();
      const data = await client.getSnacks(token);
      setSnacks(data);
    } catch (err) {
      console.error('Failed to fetch snacks:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch snacks');
      setSnacks(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, getAccessToken]);

  useEffect(() => {
    if (isAuthenticated) {
      refetch();
    }
  }, [isAuthenticated, refetch]);

  return { snacks, isLoading, error, refetch };
}

// ===========================================
// Posts Timeline Hook
// ===========================================

export function useMindAxisTimeline(initialTab: PostsTab = 'latest') {
  const { getAccessToken, isAuthenticated } = useMindAxisAuth();
  const [tab, setTab] = useState<PostsTab>(initialTab);
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(async (cursor?: string) => {
    if (!isAuthenticated) {
      setPosts([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No access token');
      }

      const client = createClient();
      const data = await client.getPostsTimeline(token, {
        tab,
        cursor,
        limit: 20,
      });

      if (cursor) {
        // Append for pagination
        setPosts(prev => [...prev, ...data.posts]);
      } else {
        // Replace for fresh fetch
        setPosts(data.posts);
      }
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch posts');
      if (!cursor) {
        setPosts([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, getAccessToken, tab]);

  // Reset and fetch when tab changes
  useEffect(() => {
    if (isAuthenticated) {
      setPosts([]);
      setNextCursor(null);
      fetchPosts();
    }
  }, [isAuthenticated, tab, fetchPosts]);

  const loadMore = useCallback(() => {
    if (nextCursor && !isLoading) {
      fetchPosts(nextCursor);
    }
  }, [nextCursor, isLoading, fetchPosts]);

  const switchTab = useCallback((newTab: PostsTab) => {
    setTab(newTab);
  }, []);

  const refetch = useCallback(() => {
    setPosts([]);
    setNextCursor(null);
    fetchPosts();
  }, [fetchPosts]);

  return {
    tab,
    posts,
    hasMore,
    isLoading,
    error,
    switchTab,
    loadMore,
    refetch,
  };
}

// ===========================================
// Example Usage Component
// ===========================================

export function MindAxisProfileCard() {
  const { isAuthenticated, isLoading: authLoading, login, logout } = useMindAxisAuth();
  const { profile, isLoading: profileLoading, error } = useMindAxisProfile();

  if (authLoading || profileLoading) {
    return <div className="animate-pulse bg-gray-200 rounded-lg h-48" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Connect with MindAxis</h2>
        <p className="text-gray-600 mb-4">
          Sign in to view your personality profile.
        </p>
        <button
          onClick={() => login()}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Login with MindAxis
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 rounded-lg">
        <p className="text-red-600">Error: {error}</p>
        <button onClick={logout} className="mt-2 text-sm text-red-500 underline">
          Logout
        </button>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="flex items-center gap-4 mb-4">
        {profile.avatarThumbnailUrl && (
          <img
            src={profile.avatarThumbnailUrl}
            alt="Avatar"
            className="w-16 h-16 rounded-full"
          />
        )}
        <div>
          <h2 className="text-xl font-bold">{profile.displayName || 'Anonymous'}</h2>
          <p className="text-gray-500">Twin: {profile.twinName || 'Unnamed'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-500">MBTI</p>
          <p className="text-2xl font-bold">{profile.personalitySnapshot.mbti}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Full Code</p>
          <p className="text-lg font-mono">{profile.personalitySnapshot.fullCode}</p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-500 mb-2">Big Five</p>
        <div className="space-y-2">
          {Object.entries(profile.personalitySnapshot.bigFive).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-4 text-xs text-gray-500">{key}</span>
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full"
                  style={{ width: `${value}%` }}
                />
              </div>
              <span className="w-8 text-xs text-gray-500">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={logout}
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        Disconnect
      </button>
    </div>
  );
}

// ===========================================
// Posts Timeline Component (Tab Example)
// ===========================================

const TAB_LABELS: Record<PostsTab, string> = {
  latest: '最新',
  popular: '人気',
};

export function MindAxisTimeline() {
  const { isAuthenticated, isLoading: authLoading } = useMindAxisAuth();
  const { tab, posts, hasMore, isLoading, error, switchTab, loadMore } = useMindAxisTimeline();

  if (authLoading) {
    return <div className="animate-pulse bg-gray-200 rounded-lg h-48" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <p className="text-gray-600">Sign in to view the timeline.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Tab bar */}
      <div className="flex border-b">
        {(['latest', 'popular'] as PostsTab[]).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={`flex-1 py-3 text-center font-medium transition-colors ${
              tab === t
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 text-red-600 text-sm">{error}</div>
      )}

      {/* Posts list */}
      <div className="divide-y">
        {posts.map((post) => (
          <div key={post.id} className="p-4">
            <div className="flex items-center gap-3 mb-2">
              {post.author.avatarThumbnailUrl && (
                <img
                  src={post.author.avatarThumbnailUrl}
                  alt=""
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div>
                <p className="font-medium">{post.author.displayName || 'Anonymous'}</p>
                {post.author.personalityCode && (
                  <p className="text-xs text-gray-400 font-mono">{post.author.personalityCode}</p>
                )}
              </div>
              <time className="ml-auto text-xs text-gray-400">
                {new Date(post.createdAt).toLocaleDateString()}
              </time>
            </div>
            <p className="text-gray-800 mb-2">{post.body}</p>
            <div className="flex gap-4 text-sm text-gray-500">
              <span>{post.likeCount} likes</span>
              <span>{post.commentCount} comments</span>
            </div>
          </div>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="p-4 text-center text-gray-500">Loading...</div>
      )}

      {/* Empty state */}
      {!isLoading && posts.length === 0 && (
        <div className="p-8 text-center text-gray-400">
          {tab === 'popular' ? 'No popular posts in the last 24 hours.' : 'No posts yet.'}
        </div>
      )}

      {/* Load more */}
      {hasMore && !isLoading && (
        <div className="p-4 text-center">
          <button
            onClick={loadMore}
            className="px-4 py-2 text-purple-600 hover:text-purple-800 font-medium"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
