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

function sanitizeBudget(payload, uid) {
  const monthName = String(payload.monthName || '').trim();
  if (!monthName) {
    throw new Error('monthName is required');
  }

  const nowIso = new Date().toISOString();

  return {
    userId: uid,
    monthName,
    monthSlug: slugifyMonth(monthName),
    assets: Array.isArray(payload.assets) ? payload.assets : [],
    owed: Array.isArray(payload.owed) ? payload.owed : [],
    liabilities: Array.isArray(payload.liabilities) ? payload.liabilities : [],
    microExpenses: Array.isArray(payload.microExpenses) ? payload.microExpenses : [],
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
    monthName: doc.monthName,
    monthSlug: doc.monthSlug,
    assets: doc.assets || [],
    owed: doc.owed || [],
    liabilities: doc.liabilities || [],
    microExpenses: doc.microExpenses || [],
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
    const decoded = await verifyFirebaseToken(req);
    if (!decoded?.uid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getMongoDb();
    const budgets = db.collection('budgets');

    await budgets.createIndex({ userId: 1, monthSlug: 1 }, { unique: true });

    if (req.method === 'GET') {
      const docs = await budgets
        .find({ userId: decoded.uid })
        .sort({ createdAt: -1 })
        .toArray();

      return res.status(200).json({ budgets: docs.map(toClientBudget) });
    }

    if (req.method === 'POST') {
      const payload = parseBody(req);
      const budget = sanitizeBudget(payload, decoded.uid);

      await budgets.updateOne(
        { userId: decoded.uid, monthSlug: budget.monthSlug },
        {
          $set: {
            ...budget,
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

      const result = await budgets.deleteOne({ userId: decoded.uid, monthSlug });
      return res.status(200).json({ ok: true, deletedCount: result.deletedCount });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Budgets API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
