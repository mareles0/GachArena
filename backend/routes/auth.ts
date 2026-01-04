import { Router, Response } from 'express';
import admin from 'firebase-admin';
import type { AuthedRequest } from '../middleware/firebaseAuth';

const router = Router();

router.get('/profile/:uid', async (req: AuthedRequest, res: Response) => {
  try {
    const uid = req.params.uid;
    const userRecord = await admin.auth().getUser(uid);
    res.json(userRecord);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
