import express, { Request, Response } from 'express';
import admin from 'firebase-admin';

const router = express.Router();

// Helper function para calcular pontos de itens
function calculateItemPoints(rarity: string, rarityLevel: number): number {
  const basePoints: { [key: string]: number } = {
    'COMUM': 10,
    'RARO': 30,
    'EPICO': 60,
    'LENDARIO': 100,
    'MITICO': 150
  };
  
  const base = basePoints[rarity] || 10;
  
  if (rarity === 'LENDARIO' || rarity === 'MITICO') {
    return base + Math.floor(rarityLevel / 10);
  }
  
  return base;
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const box = req.body;
    const boxData = {
      ...box,
      createdAt: new Date()
    };
    const docRef = await admin.firestore().collection('boxes').add(boxData);
    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'boxesChanged' });
    res.json({ id: docRef.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/active', async (req: Request, res: Response) => {
  try {
    const snapshot = await admin.firestore().collection('boxes').where('active', '==', true).get();
    const boxes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(boxes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/by-type/:type', async (req: Request, res: Response) => {
  try {
    const type = req.params.type;
    const snapshot = await admin.firestore().collection('boxes')
      .where('active', '==', true)
      .where('type', '==', type)
      .get();
    const boxes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(boxes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const snapshot = await admin.firestore().collection('boxes').get();
    const boxes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(boxes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const doc = await admin.firestore().collection('boxes').doc(id).get();
    if (doc.exists) {
      res.json({ id: doc.id, ...doc.data() });
    } else {
      res.status(404).json({ error: 'Box not found' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const data = req.body;
    await admin.firestore().collection('boxes').doc(id).update(data);
    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'boxesChanged' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    await admin.firestore().collection('boxes').doc(id).delete();
    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'boxesChanged' });
    io && io.emit('appEvent', { type: 'itemsChanged' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para abertura múltipla de caixas (processa tudo de forma atômica)
router.post('/open-multiple', async (req: Request, res: Response) => {
  try {
    const { userId, boxId, count } = req.body;
    
    if (!userId || !boxId || !count || count < 1 || count > 100) {
      return res.status(400).json({ error: 'Parâmetros inválidos' });
    }

    const db = admin.firestore();
    
    // Buscar box e items
    const boxDoc = await db.collection('boxes').doc(boxId).get();
    if (!boxDoc.exists) {
      return res.status(404).json({ error: 'Caixa não encontrada' });
    }

    const itemsSnapshot = await db.collection('items').where('boxId', '==', boxId).get();
    const items = itemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    
    if (items.length === 0) {
      return res.status(400).json({ error: 'Nenhum item disponível nesta caixa' });
    }

    const totalDropRate = items.reduce((sum, item) => sum + (item.dropRate || 0), 0);
    if (totalDropRate === 0) {
      return res.status(400).json({ error: 'Taxas de drop não configuradas' });
    }

    // Sortear os itens
    const drawnItems: any[] = [];
    for (let i = 0; i < count; i++) {
      const random = Math.random() * totalDropRate;
      let currentSum = 0;
      let selectedItem = items[items.length - 1];
      
      for (const item of items) {
        currentSum += (item.dropRate || 0);
        if (random <= currentSum) {
          selectedItem = item;
          break;
        }
      }
      drawnItems.push(selectedItem);
    }

    // Agrupar itens por ID para processar em batch
    const itemCounts = new Map<string, number>();
    drawnItems.forEach(item => {
      const currentCount = itemCounts.get(item.id) || 0;
      itemCounts.set(item.id, currentCount + 1);
    });

    // Processar adição de itens em batch (usando Firestore batch para atomicidade)
    const batch = db.batch();
    const addedUserItems: any[] = [];

    for (const [itemId, qty] of itemCounts.entries()) {
      const item = items.find(i => i.id === itemId);
      if (!item) continue;

      const isLegendaryOrMythic = item.rarity === 'LENDARIO' || item.rarity === 'MITICO';

      if (isLegendaryOrMythic) {
        // Itens lendários/míticos: criar um userItem separado para cada unidade
        for (let i = 0; i < qty; i++) {
          const rarityLevel = Math.floor(Math.random() * 1000) + 1;
          const points = calculateItemPoints(item.rarity, rarityLevel);
          const uniqueId = `${userId}_${itemId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const userItemRef = db.collection('userItems').doc(uniqueId);
          
          batch.set(userItemRef, {
            userId,
            itemId,
            item,
            obtainedAt: admin.firestore.Timestamp.now(),
            quantity: 1,
            rarityLevel,
            points
          });
          
          addedUserItems.push({ id: uniqueId, itemId, rarityLevel });
        }
      } else {
        // Itens comuns/raros/épicos: incrementar quantidade no doc existente ou criar novo
        const userItemId = `${userId}_${itemId}`;
        const userItemRef = db.collection('userItems').doc(userItemId);
        const userItemDoc = await userItemRef.get();
        
        const points = calculateItemPoints(item.rarity, 0);
        
        if (userItemDoc.exists) {
          const currentData = userItemDoc.data();
          batch.update(userItemRef, {
            quantity: admin.firestore.FieldValue.increment(qty),
            points: Math.max((currentData && currentData.points) || 0, points)
          });
        } else {
          batch.set(userItemRef, {
            userId,
            itemId,
            item,
            obtainedAt: admin.firestore.Timestamp.now(),
            quantity: qty,
            points
          });
        }
        
        addedUserItems.push({ id: userItemId, itemId, quantity: qty });
      }
    }

    await batch.commit();

    res.json({ 
      success: true, 
      items: drawnItems,
      addedUserItems
    });
  } catch (error: any) {
    console.error('Erro ao abrir múltiplas caixas:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
