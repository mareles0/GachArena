import express, { Request, Response } from 'express';
import admin from 'firebase-admin';

const router = express.Router();
const db = admin.firestore();

async function enrichTradesWithUserItems(trades: any[]): Promise<any[]> {
  const allIds = new Set<string>();
  for (const t of trades) {
    for (const id of (t.offeredUserItemIds || [])) allIds.add(id);
    for (const id of (t.requestedUserItemIds || [])) allIds.add(id);
  }

  const ids = Array.from(allIds);
  if (ids.length === 0) {
    return trades.map(t => ({ ...t, offeredItems: [], requestedItems: [] }));
  }

  const refs = ids.map(id => db.collection('userItems').doc(id));
  const userItemSnaps = await db.getAll(...refs);
  const userItemsById = new Map<string, any>();

  const missingItemIds = new Set<string>();
  for (const snap of userItemSnaps) {
    if (!snap.exists) continue;
    const data = snap.data();
    userItemsById.set(snap.id, { id: snap.id, ...data });
    if (!data?.item && data?.itemId) {
      missingItemIds.add(data.itemId);
    }
  }

  const itemById = new Map<string, any>();
  if (missingItemIds.size > 0) {
    const itemRefs = Array.from(missingItemIds).map(itemId => db.collection('items').doc(itemId));
    const itemSnaps = await db.getAll(...itemRefs);
    for (const snap of itemSnaps) {
      if (!snap.exists) continue;
      itemById.set(snap.id, { id: snap.id, ...snap.data() });
    }
  }

  for (const [id, ui] of userItemsById.entries()) {
    if (!ui.item && ui.itemId && itemById.has(ui.itemId)) {
      ui.item = itemById.get(ui.itemId);
    }
    userItemsById.set(id, ui);
  }

  return trades.map(t => {
    const offeredItems = (t.offeredUserItemIds || []).map((id: string) => userItemsById.get(id)).filter(Boolean);
    const requestedItems = (t.requestedUserItemIds || []).map((id: string) => userItemsById.get(id)).filter(Boolean);
    return { ...t, offeredItems, requestedItems };
  });
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const trade = req.body;
    const tradeData = {
      ...trade,
      status: 'PENDING',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };

    const docRef = await db.collection('trades').add(tradeData);
    res.status(201).json({ id: docRef.id });
  } catch (error: any) {
    console.error('Erro ao criar trade:', error);
    res.status(500).json({ error: 'Erro ao criar trade' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const doc = await db.collection('trades').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Trade não encontrado' });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) {
    console.error('Erro ao buscar trade:', error);
    res.status(500).json({ error: 'Erro ao buscar trade' });
  }
});

router.get('/user/:userId/sent', async (req: Request, res: Response) => {
  try {
    const snapshot = await db.collection('trades').where('fromUserId', '==', req.params.userId).get();
    let trades = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (req.query.includeItems === '1' || req.query.includeItems === 'true') {
      trades = await enrichTradesWithUserItems(trades);
    }

    res.json(trades);
  } catch (error: any) {
    console.error('Erro ao buscar trades enviados:', error);
    res.status(500).json({ error: 'Erro ao buscar trades enviados' });
  }
});

router.get('/user/:userId/received', async (req: Request, res: Response) => {
  try {
    const snapshot = await db.collection('trades').where('toUserId', '==', req.params.userId).get();
    let trades = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (req.query.includeItems === '1' || req.query.includeItems === 'true') {
      trades = await enrichTradesWithUserItems(trades);
    }

    res.json(trades);
  } catch (error: any) {
    console.error('Erro ao buscar trades recebidos:', error);
    res.status(500).json({ error: 'Erro ao buscar trades recebidos' });
  }
});

router.put('/:id/accept', async (req: Request, res: Response) => {
  try {
    const tradeId = req.params.id;
    console.log('[Trades] Aceitando trade:', tradeId);

    await db.runTransaction(async (transaction) => {
      const tradeRef = db.collection('trades').doc(tradeId);
      const tradeDoc = await transaction.get(tradeRef);

      if (!tradeDoc.exists) {
        throw new Error('Trade não encontrado');
      }

      const trade = tradeDoc.data();
      if (!trade) {
        throw new Error('Dados do trade não encontrados');
      }
      console.log('[Trades] Trade data:', { 
        status: trade.status, 
        fromUserId: trade.fromUserId, 
        toUserId: trade.toUserId,
        offeredUserItemIds: trade.offeredUserItemIds,
        requestedUserItemIds: trade.requestedUserItemIds
      });
      
      if (trade.status !== 'PENDING') {
        throw new Error('Trade já processado');
      }

      const fromUserId = trade.fromUserId;
      const toUserId = trade.toUserId;

      const allUserItemIds = [...(trade.offeredUserItemIds || []), ...(trade.requestedUserItemIds || [])];
      console.log('[Trades] Buscando userItems:', allUserItemIds);
      const userItemDocs = await Promise.all(allUserItemIds.map((id: string) => transaction.get(db.collection('userItems').doc(id))));
      console.log('[Trades] UserItems encontrados:', userItemDocs.length);

      const destRefsToRead: Array<{ ref: any; destId: string }> = [];
      for (const id of trade.offeredUserItemIds) {
        const doc = userItemDocs.find(d => d.id === id);
        if (!doc || !doc.exists) {
          throw new Error('Item oferecido não encontrado: ' + id);
        }
        const data = doc.data();
        if (!data) {
          throw new Error('Dados do item não encontrados: ' + id);
        }
        if (data.userId !== fromUserId) {
          throw new Error('O usuário não possui o item oferecido: ' + id);
        }
        if (data.quantity && data.quantity > 1) {
          const destId = `${toUserId}_${data.itemId}`;
          destRefsToRead.push({ ref: db.collection('userItems').doc(destId), destId });
        }
      }

      for (const id of trade.requestedUserItemIds) {
        const doc = userItemDocs.find((d: any) => d.id === id);
        if (!doc || !doc.exists) {
          throw new Error('Item solicitado não encontrado: ' + id);
        }
        const data = doc.data();
        if (!data) {
          throw new Error('Dados do item não encontrados: ' + id);
        }
        if (data.userId !== toUserId) {
          throw new Error('O usuário não possui o item solicitado: ' + id);
        }
        if (data.quantity && data.quantity > 1) {
          const destId = `${fromUserId}_${data.itemId}`;
          destRefsToRead.push({ ref: db.collection('userItems').doc(destId), destId });
        }
      }

      console.log('[Trades] Lendo destRefs:', destRefsToRead.length);
      const destDocs = await Promise.all(destRefsToRead.map(item => transaction.get(item.ref)));
      const destDocsMap = new Map<string, any>();
      destRefsToRead.forEach((item, idx) => {
        destDocsMap.set(item.destId, destDocs[idx]);
      });

      const fromUserRef = db.collection('users').doc(fromUserId);
      const toUserRef = db.collection('users').doc(toUserId);
      const fromUserDoc = await transaction.get(fromUserRef);
      const toUserDoc = await transaction.get(toUserRef);

      console.log('[Trades] Todas as leituras concluídas, iniciando escritas');

      const transferredUserItemIds = new Set([...trade.offeredUserItemIds, ...trade.requestedUserItemIds]);

      for (const id of trade.offeredUserItemIds) {
        const ref = db.collection('userItems').doc(id);
        const doc = userItemDocs.find((d: any) => d.id === id);
        if (!doc) continue;
        const data = doc.data();
        if (!data) continue;

        if (data.quantity && data.quantity > 1) {
          transaction.update(ref, { quantity: data.quantity - 1 });
          const destId = `${toUserId}_${data.itemId}`;
          const destRef = db.collection('userItems').doc(destId);
          const destDoc = destDocsMap.get(destId);
          if (destDoc && destDoc.exists) {
            const destData = destDoc.data();
            transaction.update(destRef, { quantity: (destData?.quantity || 0) + 1 });
          } else {
            transaction.set(destRef, {
              userId: toUserId,
              itemId: data.itemId,
              item: data.item,
              obtainedAt: admin.firestore.Timestamp.now(),
              quantity: 1
            });
          }
        } else {
          transaction.update(ref, { userId: toUserId, obtainedAt: admin.firestore.Timestamp.now() });
        }
      }

      for (const id of trade.requestedUserItemIds) {
        const ref = db.collection('userItems').doc(id);
        const doc = userItemDocs.find((d: any) => d.id === id);
        if (!doc) continue;
        const data = doc.data();
        if (!data) continue;

        if (data.quantity && data.quantity > 1) {
          transaction.update(ref, { quantity: data.quantity - 1 });
          const destId = `${fromUserId}_${data.itemId}`;
          const destRef = db.collection('userItems').doc(destId);
          const destDoc = destDocsMap.get(destId);
          if (destDoc && destDoc.exists) {
            const destData = destDoc.data();
            transaction.update(destRef, { quantity: (destData?.quantity || 0) + 1 });
          } else {
            transaction.set(destRef, {
              userId: fromUserId,
              itemId: data.itemId,
              item: data.item,
              obtainedAt: admin.firestore.Timestamp.now(),
              quantity: 1
            });
          }
        } else {
          transaction.update(ref, { userId: fromUserId, obtainedAt: admin.firestore.Timestamp.now() });
        }
      }

      if (fromUserDoc.exists) {
        const fromUserData = fromUserDoc.data();
        const currentShowcased = fromUserData?.showcasedCards || [];
        const filteredShowcased = currentShowcased.filter((userItemId: string) => !transferredUserItemIds.has(userItemId));
        if (filteredShowcased.length !== currentShowcased.length) {
          transaction.update(fromUserRef, { showcasedCards: filteredShowcased });
        }
      }

      if (toUserDoc.exists) {
        const toUserData = toUserDoc.data();
        const currentShowcased = toUserData?.showcasedCards || [];
        const filteredShowcased = currentShowcased.filter((userItemId: string) => !transferredUserItemIds.has(userItemId));
        if (filteredShowcased.length !== currentShowcased.length) {
          transaction.update(toUserRef, { showcasedCards: filteredShowcased });
        }
      }

      transaction.update(tradeRef, {
        status: 'ACCEPTED',
        updatedAt: admin.firestore.Timestamp.now()
      });
    });

    res.json({ message: 'Trade aceito com sucesso' });
    const io = req.app.get('io');
    if (io) {
      io.emit('appEvent', { type: 'tradesChanged' });
      io.emit('appEvent', { type: 'itemsChanged' });
    }
  } catch (error: any) {
    console.error('Erro ao aceitar trade:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/reject', async (req: Request, res: Response) => {
  try {
    await db.collection('trades').doc(req.params.id).update({
      status: 'REJECTED',
      updatedAt: admin.firestore.Timestamp.now()
    });
    res.json({ message: 'Trade rejeitado com sucesso' });
    const io = req.app.get('io');
    if (io) {
      io.emit('appEvent', { type: 'tradesChanged' });
    }
  } catch (error: any) {
    console.error('Erro ao rejeitar trade:', error);
    res.status(500).json({ error: 'Erro ao rejeitar trade' });
  }
});

router.put('/:id/cancel', async (req: Request, res: Response) => {
  try {
    await db.collection('trades').doc(req.params.id).update({
      status: 'CANCELLED',
      updatedAt: admin.firestore.Timestamp.now()
    });
    res.json({ message: 'Trade cancelado com sucesso' });
    const io = req.app.get('io');
    if (io) {
      io.emit('appEvent', { type: 'tradesChanged' });
    }
  } catch (error: any) {
    console.error('Erro ao cancelar trade:', error);
    res.status(500).json({ error: 'Erro ao cancelar trade' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await db.collection('trades').doc(req.params.id).delete();
    res.json({ message: 'Trade deletado com sucesso' });
  } catch (error: any) {
    console.error('Erro ao deletar trade:', error);
    res.status(500).json({ error: 'Erro ao deletar trade' });
  }
});

export default router;
