import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

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
    privateKey: privateKey.replace(/\\n/g, '\n'),
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
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;

  const auth = getFirebaseAuth();
  return auth.verifyIdToken(token);
}
