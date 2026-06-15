/**
 * Singleton getter for Firebase Messaging (Admin SDK).
 *
 * Reuses the same Firebase App instance that auth.js may already have
 * initialised via getApps() — only the first caller ever runs initializeApp().
 * Both modules share the same underlying Firebase Admin singleton.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

function normalizePrivateKey(privateKey) {
  if (!privateKey) return privateKey;

  let value = String(privateKey).trim();

  // Strip wrapping quotes introduced by some env-var editors.
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  // Convert escaped newlines to real ones (both \r\n and \n variants).
  value = value.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');

  return value;
}

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    } catch {
      return null;
    }
  }
}

function resolveCredentialConfig() {
  const fromJson = parseServiceAccount();
  if (fromJson) return fromJson;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) return null;

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
  };
}

/**
 * Returns the Firebase Messaging service, initialising the Admin App on first
 * call if it has not been initialised yet.
 *
 * @returns {import('firebase-admin/messaging').Messaging}
 */
export function getFirebaseMessaging() {
  if (getApps().length === 0) {
    const credentialConfig = resolveCredentialConfig();
    if (!credentialConfig) {
      throw new Error(
        'Firebase Admin credentials are missing. ' +
          'Set FIREBASE_SERVICE_ACCOUNT_KEY or the individual ' +
          'FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY env vars.',
      );
    }
    initializeApp({ credential: cert(credentialConfig) });
  }

  return getMessaging();
}
