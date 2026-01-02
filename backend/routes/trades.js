const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

// Get Firestore instance
const db = admin.firestore();

async function enrichTradesWithUserItems(trades) {
  const allIds = new Set();
  for (const t of trades) {
    for (const id of (t.offeredUserItemIds || [])) allIds.add(id);
    for (const id of (t.requestedUserItemIds || [])) allIds.add(id);
  }

  const ids = Array.from(allIds);
  if (ids.length === 0) {
    return trades.map(t => ({ ...t, offeredItems: [], requestedItems: [] }));
  }

  // Buscar userItems em batch
  const refs = ids.map(id => db.collection('userItems').doc(id));
  const userItemSnaps = await db.getAll(...refs);
  const userItemsById = new Map();

  const missingItemIds = new Set();
  for (const snap of userItemSnaps) {
    if (!snap.exists) continue;
    const data = snap.data();
    userItemsById.set(snap.id, { id: snap.id, ...data });
    if (!data.item && data.itemId) {
      missingItemIds.add(data.itemId);
    }
  }

  // Buscar itens faltantes (caso algum userItem não tenha item aninhado)
  const itemById = new Map();
  if (missingItemIds.size > 0) {
    const itemRefs = Array.from(missingItemIds).map(itemId => db.collection('items').doc(itemId));
    const itemSnaps = await db.getAll(...itemRefs);
    for (const snap of itemSnaps) {
      if (!snap.exists) continue;
      itemById.set(snap.id, { id: snap.id, ...snap.data() });
    }
  }

  // Enriquecer userItems com item quando necessário
  for (const [id, ui] of userItemsById.entries()) {
    if (!ui.item && ui.itemId && itemById.has(ui.itemId)) {
      ui.item = itemById.get(ui.itemId);
    }
    userItemsById.set(id, ui);
  }

  return trades.map(t => {
    const offeredItems = (t.offeredUserItemIds || []).map(id => userItemsById.get(id)).filter(Boolean);
    const requestedItems = (t.requestedUserItemIds || []).map(id => userItemsById.get(id)).filter(Boolean);
    return { ...t, offeredItems, requestedItems };
  });
}

// Create trade
router.post('/', async (req, res) => {
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
  } catch (error) {
    console.error('Erro ao criar trade:', error);
    res.status(500).json({ error: 'Erro ao criar trade' });
  }
});

// Get trade by ID
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('trades').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Trade não encontrado' });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Erro ao buscar trade:', error);
    res.status(500).json({ error: 'Erro ao buscar trade' });
  }
});

// Get user sent trades
router.get('/user/:userId/sent', async (req, res) => {
  try {
    const snapshot = await db.collection('trades').where('fromUserId', '==', req.params.userId).get();
    let trades = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (req.query.includeItems === '1' || req.query.includeItems === 'true') {
      trades = await enrichTradesWithUserItems(trades);
    }

    res.json(trades);
  } catch (error) {
    console.error('Erro ao buscar trades enviados:', error);
    res.status(500).json({ error: 'Erro ao buscar trades enviados' });
  }
});

// Get user received trades
router.get('/user/:userId/received', async (req, res) => {
  try {
    const snapshot = await db.collection('trades').where('toUserId', '==', req.params.userId).get();
    let trades = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (req.query.includeItems === '1' || req.query.includeItems === 'true') {
      trades = await enrichTradesWithUserItems(trades);
    }

    res.json(trades);
  } catch (error) {
    console.error('Erro ao buscar trades recebidos:', error);
    res.status(500).json({ error: 'Erro ao buscar trades recebidos' });
  }
});

// Accept trade
router.put('/:id/accept', async (req, res) => {
  try {
    const tradeId = req.params.id;

    await db.runTransaction(async (transaction) => {
      const tradeRef = db.collection('trades').doc(tradeId);
      const tradeDoc = await transaction.get(tradeRef);

      if (!tradeDoc.exists) {
        throw new Error('Trade não encontrado');
      }

      const trade = tradeDoc.data();
      if (trade.status !== 'PENDING') {
        throw new Error('Trade já processado');
      }

      const fromUserId = trade.fromUserId;
      const toUserId = trade.toUserId;

      // Get all userItems involved
      const allUserItemIds = [...(trade.offeredUserItemIds || []), ...(trade.requestedUserItemIds || [])];
      const userItemDocs = await Promise.all(allUserItemIds.map(id => transaction.get(db.collection('userItems').doc(id))));

      // Validate ownership
      for (const id of trade.offeredUserItemIds) {
        const doc = userItemDocs.find(d => d.id === id);
        if (!doc || !doc.exists) {
          throw new Error('Item oferecido não encontrado: ' + id);
        }
        const data = doc.data();
        if (data.userId !== fromUserId) {
          throw new Error('O usuário não possui o item oferecido: ' + id);
        }
      }

      for (const id of trade.requestedUserItemIds) {
        const doc = userItemDocs.find(d => d.id === id);
        if (!doc || !doc.exists) {
          throw new Error('Item solicitado não encontrado: ' + id);
        }
        const data = doc.data();
        if (data.userId !== toUserId) {
          throw new Error('O usuário não possui o item solicitado: ' + id);
        }
      }

      // Collect transferred userItemIds to clean showcasedCards
      const transferredUserItemIds = new Set([...trade.offeredUserItemIds, ...trade.requestedUserItemIds]);

      // Perform transfers
      // Transfer offered -> toUserId
      for (const id of trade.offeredUserItemIds) {
        const ref = db.collection('userItems').doc(id);
        const doc = userItemDocs.find(d => d.id === id);
        const data = doc.data();

        if (data.quantity && data.quantity > 1) {
          // Decrement quantity in source document
          transaction.update(ref, { quantity: data.quantity - 1 });
          // Increment/create destination document
          const destId = `${toUserId}_${data.itemId}`;
          const destRef = db.collection('userItems').doc(destId);
          const destDoc = await transaction.get(destRef);
          if (destDoc.exists) {
            transaction.update(destRef, { quantity: destDoc.data().quantity + 1 });
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
          // quantity == 1 -> change owner
          transaction.update(ref, { userId: toUserId, obtainedAt: admin.firestore.Timestamp.now() });
        }
      }

      // Transfer requested -> fromUserId
      for (const id of trade.requestedUserItemIds) {
        const ref = db.collection('userItems').doc(id);
        const doc = userItemDocs.find(d => d.id === id);
        const data = doc.data();

        if (data.quantity && data.quantity > 1) {
          transaction.update(ref, { quantity: data.quantity - 1 });
          const destId = `${fromUserId}_${data.itemId}`;
          const destRef = db.collection('userItems').doc(destId);
          const destDoc = await transaction.get(destRef);
          if (destDoc.exists) {
            transaction.update(destRef, { quantity: destDoc.data().quantity + 1 });
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

      // Clean showcasedCards for involved users
      const fromUserRef = db.collection('users').doc(fromUserId);
      const toUserRef = db.collection('users').doc(toUserId);

      const fromUserDoc = await transaction.get(fromUserRef);
      const toUserDoc = await transaction.get(toUserRef);

      if (fromUserDoc.exists) {
        const fromUserData = fromUserDoc.data();
        const currentShowcased = fromUserData.showcasedCards || [];
        const filteredShowcased = currentShowcased.filter((userItemId) => !transferredUserItemIds.has(userItemId));
        if (filteredShowcased.length !== currentShowcased.length) {
          transaction.update(fromUserRef, { showcasedCards: filteredShowcased });
        }
      }

      if (toUserDoc.exists) {
        const toUserData = toUserDoc.data();
        const currentShowcased = toUserData.showcasedCards || [];
        const filteredShowcased = currentShowcased.filter((userItemId) => !transferredUserItemIds.has(userItemId));
        if (filteredShowcased.length !== currentShowcased.length) {
          transaction.update(toUserRef, { showcasedCards: filteredShowcased });
        }
      }

      // Update trade status
      transaction.update(tradeRef, {
        status: 'ACCEPTED',
        updatedAt: admin.firestore.Timestamp.now()
      });
    });

    res.json({ message: 'Trade aceito com sucesso' });
  } catch (error) {
    console.error('Erro ao aceitar trade:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reject trade
router.put('/:id/reject', async (req, res) => {
  try {
    await db.collection('trades').doc(req.params.id).update({
      status: 'REJECTED',
      updatedAt: admin.firestore.Timestamp.now()
    });
    res.json({ message: 'Trade rejeitado com sucesso' });
  } catch (error) {
    console.error('Erro ao rejeitar trade:', error);
    res.status(500).json({ error: 'Erro ao rejeitar trade' });
  }
});

// Cancel trade
router.put('/:id/cancel', async (req, res) => {
  try {
    await db.collection('trades').doc(req.params.id).update({
      status: 'CANCELLED',
      updatedAt: admin.firestore.Timestamp.now()
    });
    res.json({ message: 'Trade cancelado com sucesso' });
  } catch (error) {
    console.error('Erro ao cancelar trade:', error);
    res.status(500).json({ error: 'Erro ao cancelar trade' });
  }
});

// Delete trade
router.delete('/:id', async (req, res) => {
  try {
    await db.collection('trades').doc(req.params.id).delete();
    res.json({ message: 'Trade deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar trade:', error);
    res.status(500).json({ error: 'Erro ao deletar trade' });
  }
});

module.exports = router;