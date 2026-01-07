import express, { Request, Response } from 'express';
import admin from 'firebase-admin';
import type { AuthedRequest } from '../middleware/firebaseAuth';

const router = express.Router();
const db = admin.firestore();

// Função para calcular tickets baseados nos itens
function calculateTickets(items: any[]): { normal: number, premium: number } {
  let totalNormal = 0;
  let totalPremium = 0;

  for (const item of items) {
    const rarity = item.item.rarity;
    const quantity = item.quantity;

    if (rarity === 'COMUM') {
      // 10 comuns = 5 normais, então 0.5 por comum
      totalNormal += quantity * 0.5;
    } else if (rarity === 'RARO') {
      // 10 raros = 10 normais, então 1 por raro
      totalNormal += quantity * 1;
    } else if (rarity === 'EPICO') {
      // 10 epicos = 5 premium, então 0.5 por epico
      totalPremium += quantity * 0.5;
    }
    // Ignorar LENDARIO e MITICO para trade-up
  }

  // Arredondar para baixo, pois tickets são inteiros
  return { normal: Math.floor(totalNormal), premium: Math.floor(totalPremium) };
}

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', route: 'tradeUp' });
});

router.post('/', async (req: AuthedRequest, res: Response) => {
  try {
    const { userId, itemsToTrade } = req.body; // itemsToTrade: [{ userItemId, quantity }]
    console.log('[tradeUp] POST received:', { userId, itemsToTrade });

    if (!userId || !itemsToTrade || itemsToTrade.length === 0) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }

    // Verificar se o usuário autenticado é o mesmo
    if (req.auth?.uid !== userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Buscar os userItems
    const userItemIds = itemsToTrade.map((it: any) => it.userItemId);
    const userItemRefs = userItemIds.map((id: string) => db.collection('userItems').doc(id));
    const userItemSnaps = await db.getAll(...userItemRefs);

    const userItems: any[] = [];
    for (const snap of userItemSnaps) {
      if (!snap.exists) {
        return res.status(400).json({ error: `Item ${snap.id} não encontrado` });
      }
      const data = snap.data();
      if (data?.userId !== userId) {
        return res.status(400).json({ error: `Item ${snap.id} não pertence ao usuário` });
      }
      userItems.push({ id: snap.id, ...data });
    }

    // Enriquecer com item details
    const itemIds = userItems.map(ui => ui.itemId).filter(id => id);
    const itemRefs = itemIds.map(id => db.collection('items').doc(id));
    const itemSnaps = await db.getAll(...itemRefs);
    const itemsById = new Map();
    for (const snap of itemSnaps) {
      if (snap.exists) {
        itemsById.set(snap.id, { id: snap.id, ...snap.data() });
      }
    }

    const enrichedItems = userItems.map(ui => ({
      ...ui,
      item: itemsById.get(ui.itemId) || null
    }));

    // Verificar quantidades e raridades permitidas
    for (const trade of itemsToTrade) {
      const ui = enrichedItems.find(ui => ui.id === trade.userItemId);
      if (!ui) continue;
      if (ui.quantity < trade.quantity) {
        return res.status(400).json({ error: `Quantidade insuficiente para ${ui.item?.name}` });
      }
      const rarity = ui.item?.rarity;
      if (!['COMUM', 'RARO', 'EPICO'].includes(rarity)) {
        return res.status(400).json({ error: `Raridade ${rarity} não permitida para trade-up` });
      }
    }

    // Verificar mínimo de itens
    const totalQuantity = itemsToTrade.reduce((s: number, t: any) => s + (t.quantity || 0), 0);
    if (totalQuantity < 10) {
      return res.status(400).json({ error: 'É necessário selecionar ao menos 10 itens para trade-up' });
    }

    // Calcular tickets
    const ticketsToAdd = calculateTickets(enrichedItems.map(ui => {
      const trade = itemsToTrade.find((t: any) => t.userItemId === ui.id);
      return { ...ui, quantity: trade.quantity };
    }));

    if (ticketsToAdd.normal === 0 && ticketsToAdd.premium === 0) {
      return res.status(400).json({ error: 'Nenhum ticket ganho com essa combinação' });
    }

    // Remover itens
    for (const trade of itemsToTrade) {
      const ui = enrichedItems.find(ui => ui.id === trade.userItemId);
      if (ui.quantity > trade.quantity) {
        await db.collection('userItems').doc(ui.id).update({
          quantity: ui.quantity - trade.quantity
        });
      } else {
        await db.collection('userItems').doc(ui.id).delete();
      }
    }

    // Recalcular totalPower após remoção dos itens
    try {
      const { recalcAndUpdateUserTotalPower } = await import('../helpers/userStats');
      const newTotalPower = await recalcAndUpdateUserTotalPower(userId);
      console.log('[tradeUp] totalPower recalculado:', newTotalPower, 'for user', userId);
      const io = req.app.get('io');
      io && io.emit('appEvent', { type: 'missionsChanged' });
      io && io.emit('appEvent', { type: 'userDataChanged' });
    } catch (err) {
      console.warn('[tradeUp] Falha ao recalcular totalPower:', err);
    }

    // Adicionar tickets
    const userRef = db.collection('users').doc(userId);
    const incrementNormal = admin.firestore.FieldValue.increment(ticketsToAdd.normal);
    const incrementPremium = admin.firestore.FieldValue.increment(ticketsToAdd.premium);
    await userRef.update({
      normalTickets: incrementNormal,
      premiumTickets: incrementPremium
    });

    console.log('[tradeUp] ticketsAdded:', ticketsToAdd, 'to user:', userId);

    // Emitir evento
    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'ticketsChanged' });
    io && io.emit('appEvent', { type: 'userDataChanged' });

    const successMessage = `Troca realizada! Ganhou ${ticketsToAdd.normal} tickets normais e ${ticketsToAdd.premium} tickets premium. A troca é permanente e os itens foram removidos do seu inventário.`;
    console.log('[tradeUp] success:', successMessage);

    res.json({
      success: true,
      ticketsAdded: ticketsToAdd,
      message: successMessage
    });

  } catch (error: any) {
    console.error('Erro no trade-up:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;