import { getMongoDb } from './_lib/mongodb.js';
import { verifyFirebaseToken } from './_lib/auth.js';

function slugifyMonth(monthName = '') {
  return String(monthName).trim().toLowerCase().replace(/\s+/g, '-');
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function sanitizeBudget(payload, decodedUser) {
  const monthName = String(payload.monthName || '').trim();
  if (!monthName) {
    throw new Error('monthName is required');
  }

  const nowIso = new Date().toISOString();
  const uid = decodedUser.uid;
  const authorEmail = decodedUser.email || null;
  const authorName = decodedUser.name || payload.authorName || null;

  return {
    userId: uid,
    authorName,
    authorEmail,
    monthName,
    monthSlug: slugifyMonth(monthName),
    assets: Array.isArray(payload.assets) ? payload.assets : [],
    owed: Array.isArray(payload.owed) ? payload.owed : [],
    liabilities: Array.isArray(payload.liabilities) ? payload.liabilities : [],
    microExpenses: Array.isArray(payload.microExpenses) ? payload.microExpenses : [],
    microExpenseCategories: Array.isArray(payload.microExpenseCategories) ? payload.microExpenseCategories : [],
    totalAssets: Number(payload.totalAssets || 0),
    totalLiabilities: Number(payload.totalLiabilities || 0),
    netWorth: Number(payload.netWorth || 0),
    partialNetWorth: Number(payload.partialNetWorth || 0),
    createdAt: payload.createdAt || nowIso,
    authorId: uid,
  };
}

function toClientBudget(doc) {
  return {
    userId: doc.userId,
    authorName: doc.authorName || null,
    authorEmail: doc.authorEmail || null,
    monthName: doc.monthName,
    monthSlug: doc.monthSlug,
    assets: doc.assets || [],
    owed: doc.owed || [],
    liabilities: doc.liabilities || [],
    microExpenses: doc.microExpenses || [],
    microExpenseCategories: doc.microExpenseCategories || [],
    totalAssets: Number(doc.totalAssets || 0),
    totalLiabilities: Number(doc.totalLiabilities || 0),
    netWorth: Number(doc.netWorth || 0),
    partialNetWorth: Number(doc.partialNetWorth || 0),
    createdAt: doc.createdAt,
    authorId: doc.authorId,
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const authResult = await verifyFirebaseToken(req);
    if (!authResult.ok) {
      return res.status(401).json({
        error: 'Unauthorized',
        reason: authResult.reason,
      });
    }

    const { uid } = authResult.decoded;

    const db = await getMongoDb();
    const budgets = db.collection('budgets');

    await budgets.createIndex({ userId: 1, monthSlug: 1 }, { unique: true });

    if (req.method === 'GET') {
      const docs = await budgets
        .find({ userId: uid })
        .sort({ createdAt: -1 })
        .toArray();

      return res.status(200).json({ budgets: docs.map(toClientBudget) });
    }

    if (req.method === 'POST') {
      const payload = parseBody(req);
      const budget = sanitizeBudget(payload, authResult.decoded);
      const { createdAt, ...budgetWithoutCreatedAt } = budget;

      await budgets.updateOne(
        { userId: uid, monthSlug: budget.monthSlug },
        {
          $set: {
            ...budgetWithoutCreatedAt,
            updatedAt: new Date().toISOString(),
          },
          $setOnInsert: {
            createdAt: budget.createdAt,
          },
        },
        { upsert: true }
      );

      return res.status(200).json({ ok: true, monthSlug: budget.monthSlug });
    }

    if (req.method === 'DELETE') {
      const monthSlug = String(req.query.monthSlug || '').trim().toLowerCase();
      if (!monthSlug) {
        return res.status(400).json({ error: 'monthSlug is required' });
      }

      const result = await budgets.deleteOne({ userId: uid, monthSlug });
      return res.status(200).json({ ok: true, deletedCount: result.deletedCount });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Budgets API error:', {
      message: error?.message,
      code: error?.code,
      name: error?.name,
    });

    const isConfigError =
      String(error?.message || '').includes('Missing Firebase Admin credentials') ||
      String(error?.message || '').includes('MONGODB_URI');

    return res.status(500).json({
      error: 'Internal server error',
      reason: isConfigError ? 'server-misconfiguration' : 'unexpected-error',
    });
  }
}
