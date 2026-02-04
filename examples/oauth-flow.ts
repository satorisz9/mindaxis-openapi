/**
 * MindAxis Open API - OAuth Flow Example
 *
 * This example demonstrates the complete OAuth 2.0 authorization code flow
 * with PKCE for a Node.js/Express application.
 *
 * Run: npx ts-node oauth-flow.ts
 */

import crypto from 'crypto';
import express from 'express';
import { MindAxisClient, generatePKCE, type Scope } from '../sdk/mindaxis-client';

const app = express();
const PORT = 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ===========================================
// Security Helpers
// ===========================================

/**
 * Escape HTML to prevent XSS attacks
 */
function escapeHtml(unsafe: string | null | undefined): string {
  if (unsafe == null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate secure session cookie options
 */
function getSecureCookieOptions(sessionId: string): string {
  const options = [
    `session=${sessionId}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
  ];
  if (IS_PRODUCTION) {
    options.push('Secure');
  }
  return options.join('; ');
}

// Configuration
const client = new MindAxisClient({
  clientId: process.env.MINDAXIS_CLIENT_ID || 'your-client-id',
  clientSecret: process.env.MINDAXIS_CLIENT_SECRET || 'your-client-secret',
  redirectUri: `http://localhost:${PORT}/callback`,
});

// In-memory storage for demo (use a proper session store in production)
const sessions: Map<string, {
  codeVerifier: string;
  accessToken?: string;
  refreshToken?: string;
}> = new Map();

// Scopes to request
const SCOPES: Scope[] = ['profile:read', 'interests:read', 'snacks:read'];

// ===========================================
// Routes
// ===========================================

/**
 * Home page - shows login button or user info
 */
app.get('/', async (req, res) => {
  const sessionId = req.headers.cookie?.match(/session=([^;]+)/)?.[1];
  const session = sessionId ? sessions.get(sessionId) : null;

  if (session?.accessToken) {
    try {
      // Fetch user profile
      const profile = await client.getMyProfile(session.accessToken);

      res.send(`
        <h1>Welcome, ${escapeHtml(profile.displayName) || 'User'}!</h1>
        <h2>Your Personality</h2>
        <ul>
          <li>MBTI: ${escapeHtml(profile.personalitySnapshot.mbti)}</li>
          <li>Full Code: ${escapeHtml(profile.personalitySnapshot.fullCode)}</li>
          <li>Big Five:
            <ul>
              <li>Openness: ${profile.personalitySnapshot.bigFive.O}</li>
              <li>Conscientiousness: ${profile.personalitySnapshot.bigFive.C}</li>
              <li>Extraversion: ${profile.personalitySnapshot.bigFive.E}</li>
              <li>Agreeableness: ${profile.personalitySnapshot.bigFive.A}</li>
              <li>Neuroticism: ${profile.personalitySnapshot.bigFive.N}</li>
            </ul>
          </li>
        </ul>
        <p>Twin Name: ${escapeHtml(profile.twinName) || 'Not set'}</p>
        <a href="/interests">View Interests</a> |
        <a href="/snacks">View Snacks</a> |
        <a href="/logout">Logout</a>
      `);
    } catch (error) {
      // Token might be expired, try to refresh
      if (session.refreshToken) {
        try {
          const tokens = await client.refreshAccessToken(session.refreshToken);
          session.accessToken = tokens.access_token;
          if (tokens.refresh_token) {
            session.refreshToken = tokens.refresh_token;
          }
          res.redirect('/');
          return;
        } catch {
          // Refresh failed, need to re-authenticate
        }
      }
      res.redirect('/login');
    }
  } else {
    res.send(`
      <h1>MindAxis OAuth Demo</h1>
      <p>Click the button below to login with MindAxis:</p>
      <a href="/login">
        <button>Login with MindAxis</button>
      </a>
    `);
  }
});

/**
 * Start OAuth flow
 */
app.get('/login', async (req, res) => {
  // Generate PKCE codes
  const { codeVerifier, codeChallenge } = await generatePKCE();

  // Generate cryptographically secure session ID
  const sessionId = crypto.randomUUID();

  // Store code verifier
  sessions.set(sessionId, { codeVerifier });

  // Set session cookie with secure options
  res.setHeader('Set-Cookie', getSecureCookieOptions(sessionId));

  // Generate authorization URL with PKCE
  const authUrl = client.getAuthorizationUrl(SCOPES, sessionId, { codeChallenge });

  // Redirect to MindAxis
  res.redirect(authUrl);
});

/**
 * OAuth callback
 */
app.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  // Check for errors
  if (error) {
    res.status(400).send(`
      <h1>Authorization Error</h1>
      <p>Error: ${escapeHtml(String(error))}</p>
      <p>${escapeHtml(String(error_description || ''))}</p>
      <a href="/">Go Home</a>
    `);
    return;
  }

  // Verify state matches session
  const sessionId = state as string;
  const session = sessions.get(sessionId);

  if (!session) {
    res.status(400).send('Invalid session');
    return;
  }

  try {
    // Exchange code for tokens
    const tokens = await client.exchangeCode(
      code as string,
      session.codeVerifier
    );

    // Store tokens in session
    session.accessToken = tokens.access_token;
    session.refreshToken = tokens.refresh_token;

    // Redirect to home
    res.redirect('/');
  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(500).send(`
      <h1>Token Exchange Error</h1>
      <p>${escapeHtml(error instanceof Error ? error.message : 'Unknown error')}</p>
      <a href="/">Go Home</a>
    `);
  }
});

/**
 * View interests
 */
app.get('/interests', async (req, res) => {
  const sessionId = req.headers.cookie?.match(/session=([^;]+)/)?.[1];
  const session = sessionId ? sessions.get(sessionId) : null;

  if (!session?.accessToken) {
    res.redirect('/login');
    return;
  }

  try {
    const interests = await client.getInterests(session.accessToken);

    res.send(`
      <h1>Your Interests</h1>
      <p>Extraction Method: ${escapeHtml(interests.extractionMethod)}</p>
      <p>Last Updated: ${escapeHtml(interests.updatedAt)}</p>
      <h2>Genres</h2>
      <ul>
        ${interests.genres.map(g => `
          <li>${escapeHtml(g.name)} (count: ${g.count}, last seen: ${escapeHtml(g.lastSeen)})</li>
        `).join('')}
      </ul>
      <a href="/">Back to Home</a>
    `);
  } catch (error) {
    res.status(500).send(`
      <h1>Error</h1>
      <p>${escapeHtml(error instanceof Error ? error.message : 'Unknown error')}</p>
      <a href="/">Go Home</a>
    `);
  }
});

/**
 * View snacks
 */
app.get('/snacks', async (req, res) => {
  const sessionId = req.headers.cookie?.match(/session=([^;]+)/)?.[1];
  const session = sessionId ? sessions.get(sessionId) : null;

  if (!session?.accessToken) {
    res.redirect('/login');
    return;
  }

  try {
    const snacks = await client.getSnacks(session.accessToken);

    res.send(`
      <h1>Your Snacks</h1>
      <p>Balance: ${snacks.balance}</p>
      <p>Total Purchased: ${snacks.totalPurchased}</p>
      <p>Total Consumed: ${snacks.totalConsumed}</p>
      <h2>Action Costs</h2>
      <table border="1">
        <tr>
          <th>Action</th>
          <th>Cost</th>
          <th>Can Afford</th>
        </tr>
        ${snacks.actionCosts.map(a => `
          <tr>
            <td>${escapeHtml(a.action)}</td>
            <td>${a.cost}</td>
            <td>${a.affordable ? 'Yes' : 'No'}</td>
          </tr>
        `).join('')}
      </table>
      <a href="/">Back to Home</a>
    `);
  } catch (error) {
    res.status(500).send(`
      <h1>Error</h1>
      <p>${escapeHtml(error instanceof Error ? error.message : 'Unknown error')}</p>
      <a href="/">Go Home</a>
    `);
  }
});

/**
 * Logout
 */
app.get('/logout', (req, res) => {
  const sessionId = req.headers.cookie?.match(/session=([^;]+)/)?.[1];
  if (sessionId) {
    sessions.delete(sessionId);
  }
  const clearCookieOptions = ['session=', 'HttpOnly', 'Path=/', 'Max-Age=0', 'SameSite=Lax'];
  if (IS_PRODUCTION) {
    clearCookieOptions.push('Secure');
  }
  res.setHeader('Set-Cookie', clearCookieOptions.join('; '));
  res.redirect('/');
});

// ===========================================
// Start Server
// ===========================================

app.listen(PORT, () => {
  console.log(`
  MindAxis OAuth Demo Server
  ==========================

  Server running at http://localhost:${PORT}

  Before running, set environment variables:
    export MINDAXIS_CLIENT_ID=your-client-id
    export MINDAXIS_CLIENT_SECRET=your-client-secret

  Make sure your client's redirect URI is set to:
    http://localhost:${PORT}/callback
  `);
});
