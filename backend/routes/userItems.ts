import express, { Request, Response } from 'express';
import admin from 'firebase-admin';

const router = express.Router();

router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const snapshot = await admin.firestore().collection('userItems').where('userId', '==', userId).get();
    const userItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(userItems);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const doc = await admin.firestore().collection('userItems').doc(id).get();
    if (doc.exists) {
      res.json({ id: doc.id, ...doc.data() });
    } else {
      res.status(404).json({ error: 'User item not found' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const data = req.body;
    const docRef = admin.firestore().collection('userItems').doc(id);
    await docRef.update(data);

    // Recalcular totalPower do usuário afetado
    const doc = await docRef.get();
    if (doc.exists) {
      const d = doc.data();
      if (d && d.userId) {
        const { recalcAndUpdateUserTotalPower } = await import('../helpers/userStats');
        const totalPower = await recalcAndUpdateUserTotalPower(d.userId);
        const io = req.app.get('io');
        io && io.emit('appEvent', { type: 'missionsChanged' });
        io && io.emit('appEvent', { type: 'userDataChanged' });
        console.log('[UserItems] totalPower recalculado (PUT):', totalPower, 'for user', d.userId);
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const docRef = admin.firestore().collection('userItems').doc(id);
    const doc = await docRef.get();
    let userId: string | undefined;
    if (doc.exists) {
      const d = doc.data();
      userId = d?.userId;
    }

    await docRef.delete();

    // Recalcular totalPower se possível
    if (userId) {
      const { recalcAndUpdateUserTotalPower } = await import('../helpers/userStats');
      const totalPower = await recalcAndUpdateUserTotalPower(userId);
      const io = req.app.get('io');
      io && io.emit('appEvent', { type: 'missionsChanged' });
      io && io.emit('appEvent', { type: 'userDataChanged' });
      console.log('[UserItems] totalPower recalculado (DELETE):', totalPower, 'for user', userId);
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/remove', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { quantity } = req.body;
    const docRef = admin.firestore().collection('userItems').doc(id);
    const doc = await docRef.get();
    let userId: string | undefined;
    if (doc.exists) {
      const data = doc.data();
      userId = data?.userId;
      if (data && data.quantity > quantity) {
        await docRef.update({ quantity: data.quantity - quantity });
      } else {
        await docRef.delete();
      }
    }

    // Recalcular totalPower se possível
    if (userId) {
      const { recalcAndUpdateUserTotalPower } = await import('../helpers/userStats');
      const totalPower = await recalcAndUpdateUserTotalPower(userId);
      const io = req.app.get('io');
      io && io.emit('appEvent', { type: 'missionsChanged' });
      io && io.emit('appEvent', { type: 'userDataChanged' });
      console.log('[UserItems] totalPower recalculado (REMOVE):', totalPower, 'for user', userId);
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
