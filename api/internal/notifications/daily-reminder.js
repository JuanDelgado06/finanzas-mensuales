/**
 * POST /api/internal/notifications/daily-reminder
 *
 * Internal endpoint that sends a daily-reminder FCM message to the topic
 * "finanzas-recordatorios". Intended to be called exclusively by a cron job.
 *
 * Security
 * --------
 * - Validates the `x-cron-secret` header against the CRON_SECRET env var.
 * - Has an in-process cooldown guard (MIN_INTERVAL_MS) to absorb duplicate
 *   cron triggers within the same serverless instance. Note: this guard resets
 *   on cold starts, so CRON_SECRET remains the primary protection.
 *
 * Environment variables required
 * --------------------------------
 * CRON_SECRET             – Shared secret sent by the cron job in x-cron-secret
 * FIREBASE_PROJECT_ID     – Firebase project id
 * FIREBASE_CLIENT_EMAIL   – Service account client_email
 * FIREBASE_PRIVATE_KEY    – Service account private_key (see README for format)
 *   OR
 * FIREBASE_SERVICE_ACCOUNT_KEY – Full service account JSON (raw or base-64)
 */

import { getFirebaseMessaging } from '../_lib/firebaseMessaging.js';

/** Minimum milliseconds between successful sends within the same instance. */
const MIN_INTERVAL_MS = 55 * 60 * 1000; // 55 minutes

/** Module-level timestamp of the last successful send (per warm instance). */
let lastSentAt = null;

export default async function handler(req, res) {
  // ── 1. Method guard ──────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // ── 2. Secret validation ─────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[daily-reminder] CRON_SECRET env var is not set.');
    return res.status(500).json({ success: false, error: 'Server misconfiguration: missing CRON_SECRET' });
  }

  const incomingSecret = req.headers['x-cron-secret'];
  if (!incomingSecret || incomingSecret !== cronSecret) {
    console.warn('[daily-reminder] Rejected request – invalid or missing x-cron-secret.');
    // Return 401 regardless of whether the header is missing or wrong to
    // avoid leaking whether a secret even exists.
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  // ── 3. In-process cooldown guard ─────────────────────────────────────────
  const now = Date.now();
  if (lastSentAt !== null && now - lastSentAt < MIN_INTERVAL_MS) {
    const waitSec = Math.ceil((MIN_INTERVAL_MS - (now - lastSentAt)) / 1000);
    console.warn(`[daily-reminder] Cooldown active – ignoring duplicate call (retry in ${waitSec}s).`);
    return res.status(429).json({
      success: false,
      error: `Too many requests. Wait ${waitSec} seconds before retrying.`,
    });
  }

  // ── 4. Build FCM message ─────────────────────────────────────────────────
  const message = {
    topic: 'finanzas-recordatorios',
    notification: {
      title: 'Recordatorio diario',
      body: 'Registra tus gastos de hoy en menos de 1 minuto.',
    },
    data: {
      type: 'daily_reminder',
    },
    android: {
      priority: 'high',
      notification: {
        priority: 'high',
        defaultSound: true,
      },
    },
    apns: {
      headers: {
        'apns-priority': '10',
      },
      payload: {
        aps: {
          sound: 'default',
          contentAvailable: true,
        },
      },
    },
  };

  // ── 5. Send via Firebase Admin SDK ───────────────────────────────────────
  try {
    const messaging = getFirebaseMessaging();
    const messageId = await messaging.send(message);

    lastSentAt = Date.now();

    console.log(`[daily-reminder] Message sent successfully. messageId=${messageId}`);
    return res.status(200).json({ success: true, messageId });
  } catch (error) {
    console.error('[daily-reminder] Failed to send FCM message:', error);
    return res.status(500).json({
      success: false,
      error: error?.message ?? 'Unknown error sending FCM message',
      ...(error?.code ? { code: error.code } : {}),
    });
  }
}
