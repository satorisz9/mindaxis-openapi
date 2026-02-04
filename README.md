# MindAxis Open API

MindAxis Open API provides programmatic access to user personality profiles, interests, and snack balances.

## Overview

| Feature | Description |
|---------|-------------|
| **Authentication** | OAuth 2.0 (PKCE) + API Key |
| **Data Access** | Public personality profiles only |
| **Rate Limit** | 1,000 requests/hour (API Key) |
| **Formats** | JSON |

## Quick Start

### Installation

```bash
# Copy the SDK to your project
cp sdk/mindaxis-client.ts your-project/lib/

# Or install from npm (when published)
npm install @mindaxis/api-client
```

### OAuth Flow (User's Own Data)

```typescript
import { MindAxisClient, generatePKCE } from './mindaxis-client';

const client = new MindAxisClient({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'https://your-app.com/callback',
});

// 1. Generate PKCE codes
const { codeVerifier, codeChallenge } = await generatePKCE();
// Store codeVerifier in session for later use

// 2. Redirect user to authorization URL
const authUrl = client.getAuthorizationUrl(
  ['profile:read', 'interests:read'],
  'random-state-string',
  { codeChallenge }
);
// Redirect user to authUrl

// 3. Handle callback - exchange code for tokens
const tokens = await client.exchangeCode(code, codeVerifier);

// 4. Fetch user data
const profile = await client.getMyProfile(tokens.access_token);
console.log(profile.personalitySnapshot.mbti); // "INFJ"
```

### API Key Flow (Public Profiles)

```typescript
import { MindAxisClient } from './mindaxis-client';

const client = new MindAxisClient({
  apiKey: 'your-api-key',
});

// Fetch a single profile
const profile = await client.getPublicProfile('twin-share-id');

// Fetch multiple profiles (max 100)
const batch = await client.getPublicProfiles(['id1', 'id2', 'id3']);
console.log(batch.profiles['id1'].personalitySnapshot.bigFive);
```

## Authentication

### OAuth 2.0 (Authorization Code Flow with PKCE)

For accessing user's own data with their consent.

| Parameter | Description |
|-----------|-------------|
| `client_id` | Your registered client ID |
| `client_secret` | Your client secret |
| `redirect_uri` | Must match registered URI |
| `scope` | Space-separated scopes |
| `code_challenge` | PKCE challenge (recommended) |

**Available Scopes:**

| Scope | Access |
|-------|--------|
| `profile:read` | User profile, personality data |
| `interests:read` | User interests/genres |
| `snacks:read` | Snack balance |
| `snacks:consume` | Consume snacks |

### API Key

For accessing public profile data. Read-only access.

```
Authorization: Bearer your-api-key
```

**Rate Limit:** 1,000 requests per hour

## Endpoints

### Profile Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/open/me` | OAuth | Get authenticated user's profile |
| GET | `/api/open/names` | OAuth | Get owner/twin names (lightweight) |
| GET | `/api/open/profile/{id}` | API Key | Get public profile by twinShareId |
| POST | `/api/open/profiles` | API Key | Get multiple profiles (max 100) |

### Interests Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/open/interests` | OAuth | Get user's interests |

### Snacks Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/open/snacks` | OAuth | Get snack balance |
| POST | `/api/open/snacks/consume` | OAuth | Consume snacks |

## Data Models

### PublicPersonalityProfile

```typescript
interface PublicPersonalityProfile {
  id: string;                    // Public ID (twinShareId)
  displayName: string | null;    // User's display name
  twinName: string | null;       // Twin's name
  avatarUrl: string | null;      // Avatar image URL

  personalitySnapshot: {
    mbti: string;                // "INFJ", "ENTP", etc.
    narr4: string;               // Narrative style (4 letters)
    rep4: string;                // Representation style (4 letters)
    fullCode: string;            // "INFJ-ARLO-VSOA"
    bigFive: {
      O: number;                 // Openness (0-100)
      C: number;                 // Conscientiousness (0-100)
      E: number;                 // Extraversion (0-100)
      A: number;                 // Agreeableness (0-100)
      N: number;                 // Neuroticism (0-100)
    };
    bfFlags: string | null;      // Extreme score flags
    strengthsSummary: string;    // Max 200 chars
    weaknessesSummary: string;   // Max 200 chars
  };

  twinStyle: {
    tone: 'gentle' | 'casual' | 'formal';
    tempo: 'slow' | 'moderate' | 'fast';
    formality: 'casual' | 'polite' | 'formal';
  };

  safetyPrefs: {
    allowRomance: boolean;
    allowPolitics: boolean;
    allowReligion: boolean;
    customBlockedTopics: string[];
  };

  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
}
```

### Snack Action Costs

| Action | Cost |
|--------|------|
| EXPLORE | 5 |
| POST | 10 |
| COMMENT | 3 |
| LIKE | 1 |
| FOLLOW | 5 |

## Error Handling

### OAuth Errors (RFC 6749)

```json
{
  "error": "invalid_token",
  "error_description": "Token has expired"
}
```

| Error | Description |
|-------|-------------|
| `invalid_request` | Missing/invalid parameters |
| `invalid_client` | Client authentication failed |
| `invalid_grant` | Code expired or already used |
| `invalid_scope` | Invalid scope requested |
| `insufficient_scope` | Token lacks required scope |
| `access_denied` | User denied consent |

### API Errors

```json
{
  "error": "Too Many Requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": "Retry after 120 seconds"
}
```

| Code | Description |
|------|-------------|
| `MISSING_API_KEY` | No Authorization header |
| `INVALID_API_KEY` | API key not found |
| `API_KEY_EXPIRED` | API key expired |
| `RATE_LIMIT_EXCEEDED` | Rate limit hit |
| `NOT_FOUND` | Resource not found |

## Security

### What's Accessible

- Public personality profile (MBTI, Big Five, etc.)
- User interests (AI-abstracted genres)
- Snack balance

### What's NOT Accessible

- Journal entries (private)
- Images and media (private)
- Activity logs (private)
- Chat history (private)
- Non-public profile data (private)

## SDK Reference

### MindAxisClient

```typescript
// OAuth configuration
const client = new MindAxisClient({
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  baseUrl?: string;  // Default: https://mindaxis.app/api
});

// API Key configuration
const client = new MindAxisClient({
  apiKey: string;
  baseUrl?: string;
});
```

### Methods

| Method | Auth | Returns |
|--------|------|---------|
| `getAuthorizationUrl(scopes, state?, pkce?)` | - | `string` |
| `exchangeCode(code, codeVerifier?)` | - | `Promise<TokenResponse>` |
| `refreshAccessToken(refreshToken)` | - | `Promise<TokenResponse>` |
| `getMyProfile(accessToken)` | OAuth | `Promise<PublicPersonalityProfile>` |
| `getNames(accessToken)` | OAuth | `Promise<OwnerTwinNames>` |
| `getPublicProfile(twinShareId)` | API Key | `Promise<PublicPersonalityProfile>` |
| `getPublicProfiles(twinShareIds)` | API Key | `Promise<BatchProfilesResponse>` |
| `getInterests(accessToken)` | OAuth | `Promise<InterestsResponse>` |
| `getSnacks(accessToken)` | OAuth | `Promise<SnacksResponse>` |
| `consumeSnacks(accessToken, action)` | OAuth | `Promise<ConsumeSnacksResponse>` |

### PKCE Helper

```typescript
import { generatePKCE } from './mindaxis-client';

const { codeVerifier, codeChallenge } = await generatePKCE();
```

## OpenAPI Specification

Full API specification is available in `openapi.yaml`. You can use it with:

- [Swagger UI](https://swagger.io/tools/swagger-ui/)
- [Redoc](https://github.com/Redocly/redoc)
- Code generators (OpenAPI Generator, etc.)

```bash
# Preview with Swagger UI
npx @redocly/cli preview-docs openapi.yaml

# Generate client code
npx openapi-generator-cli generate -i openapi.yaml -g typescript-fetch -o ./generated
```

## License

MIT License - see LICENSE file for details.

## Support

- Issues: https://github.com/satorisz9/mindaxis-openapi/issues
- Documentation: https://github.com/satorisz9/mindaxis-openapi
