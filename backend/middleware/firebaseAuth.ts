import type { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';

export type AuthedRequest = Request & {
  auth?: {
    uid: string;
    token: admin.auth.DecodedIdToken;
    isAdmin?: boolean;
  };
};

export async function authenticateFirebaseToken(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.toLowerCase().startsWith('bearer ')) {
      return res.status(401).json({ error: 'Missing Authorization Bearer token' });
    }

    if (!admin.apps.length) {
      return res.status(500).json({ error: 'Firebase Admin not initialized on server' });
    }

    const token = header.slice('Bearer '.length);
    const decoded = await admin.auth().verifyIdToken(token);
    req.auth = { uid: decoded.uid, token: decoded };
    return next();
  } catch (error: any) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function attachIsAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.auth?.uid) return next();
    const doc = await admin.firestore().collection('users').doc(req.auth.uid).get();
    const data = doc.exists ? (doc.data() as any) : null;
    req.auth.isAdmin = data?.userType === 'ADMINISTRADOR';
    return next();
  } catch {
    return next();
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.auth?.isAdmin) return next();
  return res.status(403).json({ error: 'Admin only' });
}
