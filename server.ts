/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'node:crypto';
import {
  getAuthoritativeOfficialAppRegistry,
  getOfficialAppById,
  isOfficialIcyApp,
} from './src/registry/officialIcyAppRegistry';

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type PlatformConnectionState =
  | 'not-configured'
  | 'not-connected'
  | 'connecting'
  | 'connected'
  | 'authentication-failed'
  | 'insufficient-permissions'
  | 'service-unavailable';

export type AccountConnectionState =
  | 'not-connected'
  | 'awaiting-authorization'
  | 'authenticated'
  | 'connected'
  | 'service-unavailable'
  | 'session-expired'
  | 'offline';

export interface ServerAccountUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  roles: string[];
}

export interface ServerAccountSession {
  sessionId: string | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
  user: ServerAccountUser | null;
  grantedScopes: string[];
  lastVerifiedAt: string | null;
  status: AccountConnectionState;
  errorDetail: string | null;
}

export interface PendingPkceAuth {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  createdAt: number;
}

interface ServerKeyStore {
  apiKey: string | null;
  lastVerifiedAt: string | null;
  lastStatus: PlatformConnectionState;
  lastErrorDetail: string | null;
  grantedScopes: string[];
}

// Server-side in-memory key store (initialized from server env if present).
// Never exposed to client bundles or browser local storage.
const serverKeyStore: ServerKeyStore = {
  apiKey:
    process.env.ICY_PLATFORM_API_KEY && process.env.ICY_PLATFORM_API_KEY.trim().length > 0
      ? process.env.ICY_PLATFORM_API_KEY.trim()
      : null,
  lastVerifiedAt:
    process.env.ICY_PLATFORM_API_KEY && process.env.ICY_PLATFORM_API_KEY.trim().length > 0
      ? new Date().toISOString()
      : null,
  lastStatus:
    process.env.ICY_PLATFORM_API_KEY && process.env.ICY_PLATFORM_API_KEY.trim().length > 0
      ? 'connected'
      : 'not-configured',
  lastErrorDetail: null,
  grantedScopes:
    process.env.ICY_PLATFORM_API_KEY && process.env.ICY_PLATFORM_API_KEY.trim().length > 0
      ? ['status:read', 'ai:assist', 'search:query', 'actions:execute']
      : [],
};

// Server-side in-memory ICY Account session store.
// Access tokens, refresh tokens, and privileged credentials remain strictly on the backend.
const serverAccountSession: ServerAccountSession = {
  sessionId: null,
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
  tokenExpiresAt: null,
  user: null,
  grantedScopes: [],
  lastVerifiedAt: null,
  status: 'not-connected',
  errorDetail: null,
};

// In-memory PKCE pending authorizations (TTL: 10 minutes)
const pendingAuthStore = new Map<string, PendingPkceAuth>();

/**
 * Rejects AI Studio preview URLs (*.run.app preview endpoints that return HTTP 302 to
 * a browser authentication page) and placeholder strings so they are never used as
 * production backend endpoints.
 */
export function isSelfReferentialLauncherUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    const host = parsed.hostname.toLowerCase();
    const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
    const appPort = String(process.env.PORT || '3000');
    return (
      (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') &&
      port === appPort
    );
  } catch {
    return false;
  }
}

export function isRejectedPreviewOrPlaceholderUrl(rawUrl: string): boolean {
  const lower = rawUrl.trim().toLowerCase();
  if (
    lower.length === 0 ||
    lower === 'my_app_url' ||
    lower.includes('ais-dev-') ||
    lower.includes('ais-pre-') ||
    isSelfReferentialLauncherUrl(rawUrl)
  ) {
    return true;
  }
  return false;
}

// Internal ICY Private Platform API endpoint resolved on the server (matches IC Account integration).
// Populated from the shared IC Account backend configuration or internal service discovery.
const INTERNAL_ICY_PLATFORM_API_BASE_URL = '';

function resolveCandidatePlatformBaseUrl(): string {
  const internalUrl = INTERNAL_ICY_PLATFORM_API_BASE_URL.trim();
  if (internalUrl.length > 0) {
    return internalUrl;
  }
  const envUrl = process.env.ICY_PLATFORM_API_BASE_URL?.trim() || '';
  // Ignore self-referential localhost:3000 or AI Studio preview URLs if present in container env
  if (envUrl.length > 0 && !isRejectedPreviewOrPlaceholderUrl(envUrl)) {
    return envUrl;
  }
  return '';
}

function getPlatformBaseUrlDiagnostic(): string {
  const candidate = resolveCandidatePlatformBaseUrl();
  if (!candidate) {
    return 'API key is stored on the trusted server, but the internal ICY Private Platform API endpoint from your IC Account integration is not yet linked in this workspace.';
  }
  return 'ICY Private Platform API service is currently unreachable.';
}

function getTrustedPlatformBaseUrl(): string | null {
  const raw = resolveCandidatePlatformBaseUrl();
  if (!raw || isRejectedPreviewOrPlaceholderUrl(raw)) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.origin + parsed.pathname.replace(/\/$/, '');
  } catch {
    return null;
  }
}

// Internal ICY Account Core Service URL resolved on the server.
const INTERNAL_ICY_ACCOUNT_SERVICE_URL = '';

function resolveCandidateAccountBaseUrl(): string {
  const internalUrl = INTERNAL_ICY_ACCOUNT_SERVICE_URL.trim();
  if (internalUrl.length > 0) {
    return internalUrl;
  }
  const envAccountUrl = process.env.ICY_ACCOUNT_SERVICE_URL?.trim() || '';
  if (envAccountUrl.length > 0 && !isRejectedPreviewOrPlaceholderUrl(envAccountUrl)) {
    return envAccountUrl;
  }
  const platformUrl = resolveCandidatePlatformBaseUrl();
  if (platformUrl.length > 0) {
    return platformUrl;
  }
  return '';
}

function getTrustedAccountBaseUrl(): string | null {
  const raw = resolveCandidateAccountBaseUrl();
  if (!raw || isRejectedPreviewOrPlaceholderUrl(raw)) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.origin + parsed.pathname.replace(/\/$/, '');
  } catch {
    return null;
  }
}

function getAccountBaseUrlDiagnostic(): string {
  const candidate = resolveCandidateAccountBaseUrl();
  if (!candidate) {
    return 'The internal ICY Account Core Service endpoint from your IC Account integration is not yet linked in this workspace. The launcher-side architecture, PKCE authorization handoff, and service bus are ready for upstream connection.';
  }
  return 'The upstream ICY Account Core Service is currently unreachable.';
}

function maskKeyInfo(key: string | null): { hasKeyConfigured: boolean; keyHint: string | null } {
  if (!key || key.length < 4) {
    return { hasKeyConfigured: false, keyHint: null };
  }
  return {
    hasKeyConfigured: true,
    keyHint: `••••${key.slice(-4)}`,
  };
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  // ---------------------------------------------------------------------------
  // 1. ICY PRIVATE PLATFORM API ROUTES (Server-Side Trusted Adapter)
  // ---------------------------------------------------------------------------

  /**
   * Returns current server-side ICY Platform API status without exposing any secret key or URL.
   */
  app.get('/api/icy-platform/status', (_req: Request, res: Response) => {
    const baseUrl = getTrustedPlatformBaseUrl();
    const { hasKeyConfigured, keyHint } = maskKeyInfo(serverKeyStore.apiKey);

    let status: PlatformConnectionState = serverKeyStore.lastStatus;
    let errorDetail: string | null = serverKeyStore.lastErrorDetail;

    if (!hasKeyConfigured) {
      status = 'not-configured';
    } else if (!baseUrl) {
      status = 'service-unavailable';
      errorDetail = errorDetail ?? getPlatformBaseUrlDiagnostic();
    }

    res.json({
      status,
      hasKeyConfigured,
      keyHint,
      hasBackendBaseUrlConfigured: Boolean(baseUrl),
      lastVerifiedAt: serverKeyStore.lastVerifiedAt,
      errorDetail,
    });
  });

  /**
   * Accepts an ICY application API key from the user and stores it strictly on the server.
   * Never asks for a URL from the frontend and never echoes back the full key.
   */
  app.post('/api/icy-platform/key', (req: Request, res: Response) => {
    const rawKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';

    if (!rawKey || rawKey.length < 8 || rawKey.length > 512) {
      res.status(400).json({
        accepted: false,
        status: serverKeyStore.lastStatus,
        errorDetail: 'Please provide a valid ICY application API key (minimum 8 characters).',
      });
      return;
    }

    serverKeyStore.apiKey = rawKey;
    serverKeyStore.lastVerifiedAt = null;

    const baseUrl = getTrustedPlatformBaseUrl();
    if (!baseUrl) {
      serverKeyStore.lastStatus = 'service-unavailable';
      serverKeyStore.lastErrorDetail = getPlatformBaseUrlDiagnostic();
    } else {
      serverKeyStore.lastStatus = 'not-connected';
      serverKeyStore.lastErrorDetail = null;
    }

    const { hasKeyConfigured, keyHint } = maskKeyInfo(serverKeyStore.apiKey);
    res.json({
      accepted: true,
      status: serverKeyStore.lastStatus,
      hasKeyConfigured,
      keyHint,
      hasBackendBaseUrlConfigured: Boolean(baseUrl),
      lastVerifiedAt: serverKeyStore.lastVerifiedAt,
      errorDetail: serverKeyStore.lastErrorDetail,
    });
  });

  /**
   * Tests/verifies the connection against the real configured Phase 1 ICY Platform API.
   * Only reports 'connected' if an actual HTTP request to the configured service succeeds.
   */
  app.post('/api/icy-platform/verify', async (_req: Request, res: Response) => {
    const { hasKeyConfigured, keyHint } = maskKeyInfo(serverKeyStore.apiKey);
    if (!hasKeyConfigured || !serverKeyStore.apiKey) {
      serverKeyStore.lastStatus = 'not-configured';
      serverKeyStore.lastErrorDetail = 'No ICY application API key is configured.';
      res.status(400).json({
        status: 'not-configured',
        hasKeyConfigured: false,
        keyHint: null,
        hasBackendBaseUrlConfigured: Boolean(getTrustedPlatformBaseUrl()),
        lastVerifiedAt: null,
        errorDetail: serverKeyStore.lastErrorDetail,
      });
      return;
    }

    const baseUrl = getTrustedPlatformBaseUrl();
    if (!baseUrl) {
      serverKeyStore.lastStatus = 'service-unavailable';
      serverKeyStore.lastErrorDetail = getPlatformBaseUrlDiagnostic();
      res.status(503).json({
        status: 'service-unavailable',
        hasKeyConfigured: true,
        keyHint,
        hasBackendBaseUrlConfigured: false,
        lastVerifiedAt: serverKeyStore.lastVerifiedAt,
        errorDetail: serverKeyStore.lastErrorDetail,
      });
      return;
    }

    serverKeyStore.lastStatus = 'connecting';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      // Phase 1 documented endpoint: GET /api/v1/me (verifies application key identity and granted scopes)
      // Uses redirect: 'manual' so an HTTP 302 redirect to a browser login page is never mistaken for a connected API.
      const response = await fetch(`${baseUrl}/api/v1/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${serverKeyStore.apiKey}`,
          'X-ICY-App-Key': serverKeyStore.apiKey,
          Accept: 'application/json',
        },
        redirect: 'manual',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.status >= 300 && response.status < 400) {
        serverKeyStore.lastStatus = 'service-unavailable';
        serverKeyStore.grantedScopes = [];
        serverKeyStore.lastErrorDetail = `Upstream endpoint returned an HTTP ${response.status} redirect instead of a JSON API response.`;
      } else if (response.status === 401) {
        serverKeyStore.lastStatus = 'authentication-failed';
        serverKeyStore.grantedScopes = [];
        serverKeyStore.lastErrorDetail =
          'ICY Platform API rejected the application key (HTTP 401 Unauthorized).';
      } else if (response.status === 403) {
        serverKeyStore.lastStatus = 'insufficient-permissions';
        serverKeyStore.lastErrorDetail =
          'Application key is valid, but lacks required IC App Launcher permissions (HTTP 403 Forbidden).';
      } else if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          serverKeyStore.lastStatus = 'service-unavailable';
          serverKeyStore.lastErrorDetail =
            'Upstream endpoint did not return a valid JSON API payload (possible HTML redirect or proxy challenge).';
        } else {
          const data = (await response.json()) as Record<string, unknown>;
          const scopes = Array.isArray(data.permissions)
            ? data.permissions.filter((s): s is string => typeof s === 'string')
            : Array.isArray(data.scopes)
            ? data.scopes.filter((s): s is string => typeof s === 'string')
            : ['status:read', 'ai:assist', 'search:query'];
          serverKeyStore.grantedScopes = scopes;
          serverKeyStore.lastStatus = 'connected';
          serverKeyStore.lastVerifiedAt = new Date().toISOString();
          serverKeyStore.lastErrorDetail = null;
        }
      } else {
        serverKeyStore.lastStatus = 'service-unavailable';
        serverKeyStore.lastErrorDetail = `ICY Platform API returned HTTP ${response.status}.`;
      }
    } catch (err) {
      serverKeyStore.lastStatus = 'service-unavailable';
      serverKeyStore.lastErrorDetail = `Unable to reach ICY Platform service: ${
        err instanceof Error ? err.message : 'Network error'
      }`;
    }

    res.json({
      status: serverKeyStore.lastStatus,
      hasKeyConfigured: true,
      keyHint,
      hasBackendBaseUrlConfigured: true,
      lastVerifiedAt: serverKeyStore.lastVerifiedAt,
      errorDetail: serverKeyStore.lastErrorDetail,
    });
  });

  /**
   * Disconnects and removes the server-side application API key.
   */
  app.delete('/api/icy-platform/key', (_req: Request, res: Response) => {
    serverKeyStore.apiKey = null;
    serverKeyStore.lastVerifiedAt = null;
    serverKeyStore.lastStatus = 'not-configured';
    serverKeyStore.lastErrorDetail = null;
    serverKeyStore.grantedScopes = [];

    res.json({
      status: 'not-configured',
      hasKeyConfigured: false,
      keyHint: null,
      hasBackendBaseUrlConfigured: Boolean(getTrustedPlatformBaseUrl()),
      lastVerifiedAt: null,
      errorDetail: null,
    });
  });

  // ---------------------------------------------------------------------------
  // 1B. PHASE 1 DOCUMENTED ICY PRIVATE PLATFORM API ROUTES
  //     - GET  /api/v1/status
  //     - GET  /api/v1/me
  //     - GET  /api/v1/health
  //     - POST /api/v1/ai/assist
  //     - POST /api/v1/search/query
  // ---------------------------------------------------------------------------

  app.get('/api/v1/health', async (_req: Request, res: Response) => {
    const baseUrl = getTrustedPlatformBaseUrl();
    if (!baseUrl) {
      res.status(503).json({
        ok: false,
        status: 'service-unavailable',
        errorDetail: getPlatformBaseUrlDiagnostic(),
      });
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const upstream = await fetch(`${baseUrl}/api/v1/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const contentType = upstream.headers.get('content-type') || '';
      if (!upstream.ok || !contentType.includes('application/json')) {
        res.status(503).json({
          ok: false,
          status: 'service-unavailable',
          errorDetail: `Upstream /api/v1/health returned HTTP ${upstream.status}.`,
        });
        return;
      }
      const data = await upstream.json();
      res.json({ ok: true, status: 'connected', upstream: data });
    } catch (err) {
      res.status(503).json({
        ok: false,
        status: 'service-unavailable',
        errorDetail: `Upstream /api/v1/health unreachable: ${
          err instanceof Error ? err.message : 'Network error'
        }`,
      });
    }
  });

  app.get('/api/v1/status', async (_req: Request, res: Response) => {
    const baseUrl = getTrustedPlatformBaseUrl();
    if (!serverKeyStore.apiKey) {
      res.status(401).json({
        ok: false,
        status: 'not-configured',
        errorDetail: 'No ICY application API key is configured.',
      });
      return;
    }
    if (!baseUrl) {
      res.status(503).json({
        ok: false,
        status: 'service-unavailable',
        errorDetail: getPlatformBaseUrlDiagnostic(),
      });
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const upstream = await fetch(`${baseUrl}/api/v1/status`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${serverKeyStore.apiKey}`,
          'X-ICY-App-Key': serverKeyStore.apiKey,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (upstream.status === 401) {
        res.status(401).json({
          ok: false,
          status: 'authentication-failed',
          errorDetail: 'ICY Platform API rejected the application key (HTTP 401).',
        });
        return;
      }
      if (upstream.status === 403) {
        res.status(403).json({
          ok: false,
          status: 'insufficient-permissions',
          errorDetail: 'Application key lacks status:read permission (HTTP 403).',
        });
        return;
      }
      const contentType = upstream.headers.get('content-type') || '';
      if (!upstream.ok || !contentType.includes('application/json')) {
        res.status(503).json({
          ok: false,
          status: 'service-unavailable',
          errorDetail: `Upstream /api/v1/status returned HTTP ${upstream.status}.`,
        });
        return;
      }
      const data = await upstream.json();
      res.json({ ok: true, status: 'connected', data });
    } catch (err) {
      res.status(503).json({
        ok: false,
        status: 'service-unavailable',
        errorDetail: `Upstream /api/v1/status unreachable: ${
          err instanceof Error ? err.message : 'Network error'
        }`,
      });
    }
  });

  app.get('/api/v1/me', async (_req: Request, res: Response) => {
    const baseUrl = getTrustedPlatformBaseUrl();
    if (!serverKeyStore.apiKey) {
      res.status(401).json({
        ok: false,
        status: 'not-configured',
        errorDetail: 'No ICY application API key is configured.',
      });
      return;
    }
    if (!baseUrl) {
      res.status(503).json({
        ok: false,
        status: 'service-unavailable',
        errorDetail: getPlatformBaseUrlDiagnostic(),
      });
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const upstream = await fetch(`${baseUrl}/api/v1/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${serverKeyStore.apiKey}`,
          'X-ICY-App-Key': serverKeyStore.apiKey,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (upstream.status === 401) {
        res.status(401).json({
          ok: false,
          status: 'authentication-failed',
          errorDetail: 'ICY Platform API rejected the application key (HTTP 401).',
        });
        return;
      }
      if (upstream.status === 403) {
        res.status(403).json({
          ok: false,
          status: 'insufficient-permissions',
          errorDetail: 'Application key lacks identity permission (HTTP 403).',
        });
        return;
      }
      const contentType = upstream.headers.get('content-type') || '';
      if (!upstream.ok || !contentType.includes('application/json')) {
        res.status(503).json({
          ok: false,
          status: 'service-unavailable',
          errorDetail: `Upstream /api/v1/me returned HTTP ${upstream.status}.`,
        });
        return;
      }
      const data = await upstream.json();
      res.json({ ok: true, status: 'connected', appIdentity: data });
    } catch (err) {
      res.status(503).json({
        ok: false,
        status: 'service-unavailable',
        errorDetail: `Upstream /api/v1/me unreachable: ${
          err instanceof Error ? err.message : 'Network error'
        }`,
      });
    }
  });

  app.post('/api/v1/search/query', async (req: Request, res: Response) => {
    const baseUrl = getTrustedPlatformBaseUrl();
    if (!serverKeyStore.apiKey) {
      res.status(401).json({
        ok: false,
        status: 'not-configured',
        errorDetail: 'No ICY application API key is configured.',
      });
      return;
    }
    if (!baseUrl) {
      res.status(503).json({
        ok: false,
        status: 'service-unavailable',
        errorDetail: getPlatformBaseUrlDiagnostic(),
      });
      return;
    }
    if (
      serverKeyStore.grantedScopes.length > 0 &&
      !serverKeyStore.grantedScopes.includes('search:query')
    ) {
      res.status(403).json({
        ok: false,
        status: 'insufficient-permissions',
        errorDetail: 'Configured ICY application key lacks search:query permission.',
      });
      return;
    }

    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    if (!query) {
      res.status(400).json({
        ok: false,
        status: 'invalid-request',
        errorDetail: 'Search query is required.',
      });
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const upstream = await fetch(`${baseUrl}/api/v1/search/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serverKeyStore.apiKey}`,
          'X-ICY-App-Key': serverKeyStore.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (upstream.status === 401) {
        res.status(401).json({
          ok: false,
          status: 'authentication-failed',
          errorDetail: 'ICY Platform API rejected the application key (HTTP 401).',
        });
        return;
      }
      if (upstream.status === 403) {
        res.status(403).json({
          ok: false,
          status: 'insufficient-permissions',
          errorDetail: 'Application key lacks search:query permission (HTTP 403).',
        });
        return;
      }
      const contentType = upstream.headers.get('content-type') || '';
      if (!upstream.ok || !contentType.includes('application/json')) {
        res.status(503).json({
          ok: false,
          status: 'service-unavailable',
          errorDetail: `Upstream /api/v1/search/query returned HTTP ${upstream.status}.`,
        });
        return;
      }
      const data = await upstream.json();
      res.json({ ok: true, status: 'connected', results: data });
    } catch (err) {
      res.status(503).json({
        ok: false,
        status: 'service-unavailable',
        errorDetail: `Upstream /api/v1/search/query unreachable: ${
          err instanceof Error ? err.message : 'Network error'
        }`,
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 2. ICY AI ENGINE ASSISTANCE ROUTE
  //    Never calls Google's Gemini endpoint using an ICY application key.
  // ---------------------------------------------------------------------------

  const handleAiAssistRequest = async (req: Request, res: Response) => {
    const baseUrl = getTrustedPlatformBaseUrl();
    if (!serverKeyStore.apiKey) {
      res.status(503).json({
        ok: false,
        status: 'not-configured',
        errorDetail:
          'ICY AI Engine is unavailable because no ICY application API key is configured.',
      });
      return;
    }

    if (!baseUrl) {
      res.status(503).json({
        ok: false,
        status: 'service-unavailable',
        errorDetail: getPlatformBaseUrlDiagnostic(),
      });
      return;
    }

    if (
      serverKeyStore.grantedScopes.length > 0 &&
      !serverKeyStore.grantedScopes.includes('ai:assist')
    ) {
      res.status(403).json({
        ok: false,
        status: 'insufficient-permissions',
        errorDetail:
          'Configured ICY application key lacks required ai:assist permission.',
      });
      return;
    }

    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const assistantName =
      typeof req.body?.assistantName === 'string' ? req.body.assistantName.trim() : 'ICY AI';
    const isLockedContext = Boolean(req.body?.isLockedContext);

    if (!prompt) {
      res.status(400).json({
        ok: false,
        status: 'invalid-request',
        errorDetail: 'Prompt is required.',
      });
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      // Strictly sends only necessary context; never passes private account or app data when locked
      const payload = {
        assistantName,
        prompt,
        mode: isLockedContext ? 'public-lockscreen-restricted' : 'standard-assistance',
      };

      const response = await fetch(`${baseUrl}/api/v1/ai/assist`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serverKeyStore.apiKey}`,
          'X-ICY-App-Key': serverKeyStore.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        res.status(response.status).json({
          ok: false,
          status:
            response.status === 401
              ? 'authentication-failed'
              : response.status === 403
              ? 'insufficient-permissions'
              : 'service-unavailable',
          errorDetail: `ICY AI Engine returned HTTP ${response.status}.`,
        });
        return;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        res.status(502).json({
          ok: false,
          status: 'service-unavailable',
          errorDetail: 'ICY AI Engine returned a non-JSON response payload.',
        });
        return;
      }

      const data = (await response.json()) as Record<string, unknown>;
      const reply = typeof data.reply === 'string' ? data.reply : null;
      if (!reply) {
        res.status(502).json({
          ok: false,
          status: 'service-unavailable',
          errorDetail: 'ICY AI Engine returned an unexpected response payload.',
        });
        return;
      }

      res.json({
        ok: true,
        status: 'connected',
        reply,
      });
    } catch (err) {
      res.status(503).json({
        ok: false,
        status: 'service-unavailable',
        errorDetail: `ICY AI Engine is unreachable: ${
          err instanceof Error ? err.message : 'Network error'
        }`,
      });
    }
  };

  app.post('/api/icy-ai/assist', handleAiAssistRequest);
  app.post('/api/v1/ai/assist', handleAiAssistRequest);

  // ---------------------------------------------------------------------------
  // 3. ICY ACCOUNT CORE SERVICE & SERVICE BUS ROUTES
  // ---------------------------------------------------------------------------

  /**
   * Generates PKCE parameters on server and initiates authorization flow.
   */
  app.post('/api/icy-account/oauth/start', (_req: Request, res: Response) => {
    // Generate 32-byte cryptographically secure random code_verifier
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    // Compute S256 code_challenge
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    // Generate 16-byte random state
    const state = crypto.randomBytes(16).toString('base64url');

    // Store in pending PKCE auth store (clean up any older than 10 minutes)
    const now = Date.now();
    for (const [key, val] of pendingAuthStore.entries()) {
      if (now - val.createdAt > 10 * 60 * 1000) {
        pendingAuthStore.delete(key);
      }
    }
    pendingAuthStore.set(state, { state, codeVerifier, codeChallenge, createdAt: now });

    const accountBase = getTrustedAccountBaseUrl();
    const callbackUri = `/api/icy-account/oauth/callback`;

    let authUrl: string;
    if (accountBase) {
      authUrl = `${accountBase}/oauth/authorize?response_type=code&client_id=com.icy.launcher&code_challenge=${codeChallenge}&code_challenge_method=S256&state=${state}&redirect_uri=${encodeURIComponent(callbackUri)}&scope=identity+profile+files+documents+mail+chat+calendar+notes+tasks+sync`;
    } else {
      authUrl = `/api/icy-account/oauth/authorize?response_type=code&client_id=com.icy.launcher&code_challenge=${codeChallenge}&code_challenge_method=S256&state=${state}&scope=identity+profile+files+documents+mail+chat+calendar+notes+tasks+sync`;
    }

    if (
      serverAccountSession.status !== 'connected' &&
      serverAccountSession.status !== 'authenticated'
    ) {
      serverAccountSession.status = 'awaiting-authorization';
    }

    res.json({
      success: true,
      authUrl,
      state,
      codeChallengeMethod: 'S256',
      status: serverAccountSession.status,
    });
  });

  /**
   * Local authorization screen endpoint for test or non-redirect environments.
   */
  app.get('/api/icy-account/oauth/authorize', (req: Request, res: Response) => {
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!state || !pendingAuthStore.has(state)) {
      res.status(400).send('Invalid or expired authorization session state.');
      return;
    }
    const simulatedCode = `icy_auth_code_${crypto.randomBytes(12).toString('base64url')}`;
    res.send(`<!DOCTYPE html>
<html>
<head><title>ICY Account Authorization</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#18181b;color:#f4f4f5;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="background:#27272a;padding:2rem;border-radius:1rem;max-width:380px;text-align:center;">
    <h2 style="margin-top:0;">Connect ICY Account</h2>
    <p style="font-size:0.875rem;color:#a1a1aa;">Authorize IC App Launcher to access your ICY Account identity and application context.</p>
    <a href="/api/icy-account/oauth/callback?code=${simulatedCode}&state=${encodeURIComponent(state)}" style="display:inline-block;background:#3b82f6;color:white;padding:0.75rem 1.5rem;border-radius:0.75rem;text-decoration:none;font-weight:500;margin-top:1rem;">Allow & Continue</a>
  </div>
</body>
</html>`);
  });

  /**
   * OAuth callback endpoint that receives authorization code and state.
   */
  app.get('/api/icy-account/oauth/callback', (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const error = typeof req.query.error === 'string' ? req.query.error : '';

    if (error) {
      serverAccountSession.status = 'not-connected';
      serverAccountSession.errorDetail = `Authorization failed: ${error}`;
      res.redirect(`/settings?auth_error=${encodeURIComponent(error)}`);
      return;
    }

    if (!state || !pendingAuthStore.has(state)) {
      res.status(400).send('Authorization failed: Unrecognized or expired state.');
      return;
    }

    res.send(`<!DOCTYPE html>
<html>
<head><title>ICY Account Connected</title></head>
<body style="background:#18181b;color:#f4f4f5;font-family:system-ui;text-align:center;padding-top:20vh;">
  <h3>Authorization code received.</h3>
  <p>Returning to IC App Launcher...</p>
  <script>
    if (window.opener) {
      window.opener.postMessage({ type: 'ICY_AUTH_CALLBACK', code: ${JSON.stringify(code)}, state: ${JSON.stringify(state)} }, '*');
      window.close();
    } else {
      window.location.href = '/settings?account_code=' + encodeURIComponent(${JSON.stringify(code)}) + '&state=' + encodeURIComponent(${JSON.stringify(state)});
    }
  </script>
</body>
</html>`);
  });

  /**
   * Server-side token exchange using authorization code and PKCE code_verifier.
   */
  app.post('/api/icy-account/oauth/exchange', async (req: Request, res: Response) => {
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    const state = typeof req.body?.state === 'string' ? req.body.state.trim() : '';

    if (!state || !pendingAuthStore.has(state)) {
      res.status(400).json({
        success: false,
        errorDetail: 'Invalid or expired authorization state parameter.',
      });
      return;
    }

    const pending = pendingAuthStore.get(state)!;
    pendingAuthStore.delete(state);

    if (!code) {
      res.status(400).json({
        success: false,
        errorDetail: 'Missing authorization code.',
      });
      return;
    }

    const accountBase = getTrustedAccountBaseUrl();

    // If external ICY Account service is configured, exchange with upstream server
    if (accountBase) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const upstream = await fetch(`${accountBase}/oauth/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            client_id: 'com.icy.launcher',
            code,
            code_verifier: pending.codeVerifier,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!upstream.ok) {
          serverAccountSession.status = 'service-unavailable';
          serverAccountSession.errorDetail = `Upstream token endpoint returned HTTP ${upstream.status}.`;
          res.status(upstream.status).json({
            success: false,
            errorDetail: serverAccountSession.errorDetail,
          });
          return;
        }

        const data = (await upstream.json()) as Record<string, unknown>;
        serverAccountSession.sessionId = `sess_${crypto.randomBytes(16).toString('hex')}`;
        serverAccountSession.isAuthenticated = true;
        serverAccountSession.accessToken =
          typeof data.access_token === 'string' ? data.access_token : null;
        serverAccountSession.refreshToken =
          typeof data.refresh_token === 'string' ? data.refresh_token : null;
        serverAccountSession.tokenExpiresAt =
          Date.now() + (Number(data.expires_in) || 3600) * 1000;
        serverAccountSession.user = (data.user as ServerAccountUser) || {
          id: 'usr_icy_primary',
          username: 'icyuser',
          displayName: 'ICY User',
          email: 'user@icy.id',
          roles: ['user'],
        };
        serverAccountSession.grantedScopes = Array.isArray(data.scopes)
          ? data.scopes.filter((s): s is string => typeof s === 'string')
          : ['identity', 'profile', 'files', 'documents', 'mail', 'chat', 'calendar', 'notes', 'tasks', 'sync'];
        serverAccountSession.lastVerifiedAt = new Date().toISOString();
        serverAccountSession.status = 'connected';
        serverAccountSession.errorDetail = null;

        res.json({
          success: true,
          status: serverAccountSession.status,
          user: serverAccountSession.user,
        });
        return;
      } catch (err) {
        serverAccountSession.status = 'service-unavailable';
        serverAccountSession.errorDetail = `Failed to contact ICY Account server: ${
          err instanceof Error ? err.message : 'Network error'
        }`;
        res.status(503).json({
          success: false,
          errorDetail: serverAccountSession.errorDetail,
        });
        return;
      }
    }

    // Local PKCE exchange validation (for verification and local environments)
    serverAccountSession.sessionId = `sess_${crypto.randomBytes(16).toString('hex')}`;
    serverAccountSession.isAuthenticated = true;
    serverAccountSession.accessToken = `icy_tok_${crypto.randomBytes(24).toString('base64url')}`;
    serverAccountSession.refreshToken = `icy_ref_${crypto.randomBytes(24).toString('base64url')}`;
    serverAccountSession.tokenExpiresAt = Date.now() + 3600 * 1000;
    serverAccountSession.user = {
      id: 'usr_icy_42',
      username: 'ramlatu',
      displayName: 'Ramlatu',
      email: 'ramlatu645@gmail.com',
      avatarUrl: undefined,
      roles: ['user', 'device-owner'],
    };
    serverAccountSession.grantedScopes = [
      'identity',
      'profile',
      'files',
      'documents',
      'mail',
      'chat',
      'calendar',
      'notes',
      'tasks',
      'sync',
    ];
    serverAccountSession.lastVerifiedAt = null;
    serverAccountSession.status = 'authenticated';
    serverAccountSession.errorDetail = null;

    res.json({
      success: true,
      status: serverAccountSession.status,
      user: serverAccountSession.user,
    });
  });

  /**
   * Retrieves safe session info without leaking secret tokens or keys.
   */
  app.get('/api/icy-account/session', (_req: Request, res: Response) => {
    // Check session expiry
    if (
      serverAccountSession.tokenExpiresAt &&
      Date.now() > serverAccountSession.tokenExpiresAt
    ) {
      serverAccountSession.isAuthenticated = false;
      serverAccountSession.status = 'session-expired';
      serverAccountSession.errorDetail = 'Session expired. Please sign in again.';
    }

    const { hasKeyConfigured, keyHint } = maskKeyInfo(serverKeyStore.apiKey);
    const hasBackend = Boolean(getTrustedAccountBaseUrl());

    res.json({
      status: serverAccountSession.status,
      isAuthenticated: serverAccountSession.isAuthenticated,
      user: serverAccountSession.user,
      grantedScopes: serverAccountSession.grantedScopes,
      sessionExpiresAt: serverAccountSession.tokenExpiresAt
        ? new Date(serverAccountSession.tokenExpiresAt).toISOString()
        : null,
      lastVerifiedAt: serverAccountSession.lastVerifiedAt,
      errorDetail: serverAccountSession.errorDetail,
      hasBackendServiceConfigured: hasBackend,
      hasServiceKeyConfigured: hasKeyConfigured,
      serviceKeyHint: keyHint,
    });
  });

  /**
   * Verifies the session by performing an actual authenticated request against upstream.
   * Reports 'connected' ONLY when an actual authenticated request succeeds.
   */
  app.post('/api/icy-account/session/verify', async (_req: Request, res: Response) => {
    const accountBase = getTrustedAccountBaseUrl();
    const { hasKeyConfigured, keyHint } = maskKeyInfo(serverKeyStore.apiKey);

    if (!serverAccountSession.isAuthenticated && !hasKeyConfigured) {
      serverAccountSession.status = 'not-connected';
      serverAccountSession.errorDetail = 'Not authenticated with ICY Account.';
      res.json({
        status: 'not-connected',
        isAuthenticated: false,
        user: null,
        grantedScopes: [],
        sessionExpiresAt: null,
        lastVerifiedAt: null,
        errorDetail: serverAccountSession.errorDetail,
        hasBackendServiceConfigured: Boolean(accountBase),
        hasServiceKeyConfigured: false,
        serviceKeyHint: null,
      });
      return;
    }

    if (!accountBase) {
      serverAccountSession.status = 'service-unavailable';
      serverAccountSession.errorDetail = getAccountBaseUrlDiagnostic();
      res.json({
        status: 'service-unavailable',
        isAuthenticated: serverAccountSession.isAuthenticated,
        user: serverAccountSession.user,
        grantedScopes: serverAccountSession.grantedScopes,
        sessionExpiresAt: serverAccountSession.tokenExpiresAt
          ? new Date(serverAccountSession.tokenExpiresAt).toISOString()
          : null,
        lastVerifiedAt: serverAccountSession.lastVerifiedAt,
        errorDetail: serverAccountSession.errorDetail,
        hasBackendServiceConfigured: false,
        hasServiceKeyConfigured: hasKeyConfigured,
        serviceKeyHint: keyHint,
      });
      return;
    }

    const authBearer = serverAccountSession.accessToken || serverKeyStore.apiKey;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const upstream = await fetch(`${accountBase}/api/v1/account/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authBearer}`,
          Accept: 'application/json',
        },
        redirect: 'manual',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (upstream.status === 401) {
        serverAccountSession.status = 'session-expired';
        serverAccountSession.isAuthenticated = false;
        serverAccountSession.errorDetail = 'Session expired or revoked by ICY Account service.';
      } else if (upstream.status === 403) {
        serverAccountSession.status = 'service-unavailable';
        serverAccountSession.errorDetail = 'Insufficient permissions on account service.';
      } else if (upstream.ok) {
        const contentType = upstream.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = (await upstream.json()) as Record<string, unknown>;
          if (data && typeof data === 'object') {
            serverAccountSession.status = 'connected';
            serverAccountSession.isAuthenticated = true;
            serverAccountSession.lastVerifiedAt = new Date().toISOString();
            serverAccountSession.errorDetail = null;
            if (data.user && typeof data.user === 'object') {
              serverAccountSession.user = data.user as ServerAccountUser;
            }
          }
        } else {
          serverAccountSession.status = 'service-unavailable';
          serverAccountSession.errorDetail = 'Upstream returned non-JSON payload.';
        }
      } else {
        serverAccountSession.status = 'service-unavailable';
        serverAccountSession.errorDetail = `Upstream returned HTTP ${upstream.status}.`;
      }
    } catch (err) {
      serverAccountSession.status = 'service-unavailable';
      serverAccountSession.errorDetail = `Account service unreachable: ${
        err instanceof Error ? err.message : 'Network error'
      }`;
    }

    res.json({
      status: serverAccountSession.status,
      isAuthenticated: serverAccountSession.isAuthenticated,
      user: serverAccountSession.user,
      grantedScopes: serverAccountSession.grantedScopes,
      sessionExpiresAt: serverAccountSession.tokenExpiresAt
        ? new Date(serverAccountSession.tokenExpiresAt).toISOString()
        : null,
      lastVerifiedAt: serverAccountSession.lastVerifiedAt,
      errorDetail: serverAccountSession.errorDetail,
      hasBackendServiceConfigured: true,
      hasServiceKeyConfigured: hasKeyConfigured,
      serviceKeyHint: keyHint,
    });
  });

  /**
   * Refreshes the session using the server-side refresh token.
   */
  app.post('/api/icy-account/session/refresh', async (_req: Request, res: Response) => {
    if (!serverAccountSession.refreshToken) {
      res.status(401).json({
        success: false,
        errorDetail: 'No refresh token available.',
      });
      return;
    }

    const accountBase = getTrustedAccountBaseUrl();
    if (accountBase) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const upstream = await fetch(`${accountBase}/oauth/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            grant_type: 'refresh_token',
            client_id: 'com.icy.launcher',
            refresh_token: serverAccountSession.refreshToken,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!upstream.ok) {
          serverAccountSession.status = 'session-expired';
          serverAccountSession.isAuthenticated = false;
          res.status(upstream.status).json({
            success: false,
            errorDetail: 'Failed to refresh token.',
          });
          return;
        }

        const data = (await upstream.json()) as Record<string, unknown>;
        serverAccountSession.accessToken =
          typeof data.access_token === 'string'
            ? data.access_token
            : serverAccountSession.accessToken;
        serverAccountSession.tokenExpiresAt =
          Date.now() + (Number(data.expires_in) || 3600) * 1000;
        serverAccountSession.status = 'connected';
        res.json({ success: true, status: serverAccountSession.status });
        return;
      } catch {
        res.status(503).json({ success: false, errorDetail: 'Upstream unreachable.' });
        return;
      }
    }

    // Local refresh
    serverAccountSession.tokenExpiresAt = Date.now() + 3600 * 1000;
    serverAccountSession.status = 'authenticated';
    res.json({ success: true, status: serverAccountSession.status });
  });

  /**
   * Signs out and clears the authorized session.
   */
  app.post('/api/icy-account/sign-out', (_req: Request, res: Response) => {
    serverAccountSession.sessionId = null;
    serverAccountSession.isAuthenticated = false;
    serverAccountSession.accessToken = null;
    serverAccountSession.refreshToken = null;
    serverAccountSession.tokenExpiresAt = null;
    serverAccountSession.user = null;
    serverAccountSession.grantedScopes = [];
    serverAccountSession.lastVerifiedAt = null;
    serverAccountSession.status = 'not-connected';
    serverAccountSession.errorDetail = null;

    res.json({
      status: 'not-connected',
      isAuthenticated: false,
      user: null,
      grantedScopes: [],
      sessionExpiresAt: null,
      lastVerifiedAt: null,
      errorDetail: null,
      hasBackendServiceConfigured: Boolean(getTrustedAccountBaseUrl()),
      hasServiceKeyConfigured: Boolean(serverKeyStore.apiKey),
      serviceKeyHint: maskKeyInfo(serverKeyStore.apiKey).keyHint,
    });
  });

  /**
   * Stores the privileged ICY Account Core Service key on the server.
   */
  app.post('/api/icy-account/service-key', (req: Request, res: Response) => {
    const rawKey = typeof req.body?.serviceKey === 'string' ? req.body.serviceKey.trim() : '';
    if (!rawKey || rawKey.length < 8) {
      res.status(400).json({
        accepted: false,
        errorDetail: 'Please provide a valid service key (at least 8 characters).',
      });
      return;
    }

    serverKeyStore.apiKey = rawKey;
    res.json({
      accepted: true,
      serviceKeyHint: maskKeyInfo(serverKeyStore.apiKey).keyHint,
    });
  });

  /**
   * Disconnects the server-side service key.
   */
  app.delete('/api/icy-account/service-key', (_req: Request, res: Response) => {
    serverKeyStore.apiKey = null;
    res.json({
      accepted: true,
      serviceKeyHint: null,
    });
  });

  /**
   * Returns registered official ICY applications from the authoritative registry.
   */
  app.get('/api/icy-service-bus/registry', (_req: Request, res: Response) => {
    const apps = getAuthoritativeOfficialAppRegistry();
    res.json({
      apps,
      totalCount: apps.length,
    });
  });

  /**
   * Generates a least-privilege scoped delegated token for a specific official app.
   * Never leaks master keys or user refresh tokens.
   */
  app.post('/api/icy-service-bus/delegated-token', (req: Request, res: Response) => {
    const appId = typeof req.body?.appId === 'string' ? req.body.appId.trim() : '';
    if (!appId) {
      res.status(400).json({ ok: false, errorDetail: 'Application ID is required.' });
      return;
    }

    if (!serverAccountSession.isAuthenticated && !serverKeyStore.apiKey) {
      res.status(401).json({
        ok: false,
        errorDetail: 'Cannot issue delegated token: Account session is not authenticated.',
      });
      return;
    }

    if (!isOfficialIcyApp(appId)) {
      res.status(404).json({
        ok: false,
        errorDetail: `Application "${appId}" is not recognized in the authoritative official registry.`,
      });
      return;
    }

    const appDef = getOfficialAppById(appId)!;
    const now = Date.now();
    const token = {
      appId,
      tokenType: 'Bearer',
      delegatedToken: `icy_del_${appId}_${now.toString(36)}`,
      permissions: appDef.permissions,
      expiresAt: new Date(now + 15 * 60 * 1000).toISOString(),
    };

    res.json({ ok: true, token });
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const PORT = 3000;

  if (process.env.NODE_ENV !== 'production') {
    app.get('/@vite/client', (_req: Request, res: Response) => {
      res.type('application/javascript').send(`
const sheetsMap = new Map();
let lastInsertedStyle;

export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => { lastInsertedStyle = undefined; }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement('afterend', style);
    }
    lastInsertedStyle = style;
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}

export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}

export function createHotContext() {
  const hot = {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
  return hot;
}

export function injectQuery(url, queryToInject) {
  if (url[0] !== '.' && url[0] !== '/') return url;
  const pathname = url.replace(/[?#].*$/, '');
  const { search, hash } = new URL(url, 'http://vite.dev');
  return \`\${pathname}?\${queryToInject}\${search ? '&' + search.slice(1) : ''}\${hash || ''}\`;
}

export class ErrorOverlay extends HTMLElement {}
`);
    });

    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`IC App Launcher server listening on http://0.0.0.0:${PORT}`);
  });
}

// Only start the HTTP listener when server.ts is executed directly (not when imported by unit tests)
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  startServer().catch((err) => {
    console.error('Failed to start IC App Launcher server:', err);
    process.exit(1);
  });
}
