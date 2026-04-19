import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function normalizePrivateKey(privateKey) {
  if (!privateKey) return privateKey;

  let value = String(privateKey).trim();

  // Remove wrapping quotes often introduced when pasting env vars.
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  // Support escaped line breaks and keep already-valid PEM untouched.
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
      const decoded = Buffer.from(raw, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }
}

function getCredentialConfig() {
  const fromJson = parseServiceAccount();
  if (fromJson) return fromJson;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
  };
}

function getFirebaseAuth() {
  if (getApps().length === 0) {
    const credentialConfig = getCredentialConfig();
    if (!credentialConfig) {
      throw new Error('Missing Firebase Admin credentials in environment variables.');
    }

    initializeApp({
      credential: cert(credentialConfig),
    });
  }

  return getAuth();
}

export async function verifyFirebaseToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, reason: 'missing-token' };
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return { ok: false, reason: 'missing-token' };

  try {
    const auth = getFirebaseAuth();
    const decoded = await auth.verifyIdToken(token);
    return { ok: true, decoded };
  } catch (error) {
    const isInvalidToken =
      error?.code === 'auth/argument-error' ||
      error?.code === 'auth/id-token-expired' ||
      error?.code === 'auth/id-token-revoked' ||
      error?.code === 'auth/invalid-id-token';

    if (isInvalidToken) {
      return { ok: false, reason: 'invalid-token' };
    }

    throw error;
  }
}
