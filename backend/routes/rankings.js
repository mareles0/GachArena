const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

// Get Firestore instance
const db = admin.firestore();

// Get global ranking
router.get('/global/:limit?', async (req, res) => {
  try {
    const limitCount = parseInt(req.params.limit) || 50;

    // Buscar todos os usuários
    const usersSnapshot = await db.collection('users').get();
    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const rankingEntries = [];

    for (const user of users) {
      if (!user.id) continue;

      try {
        // Buscar itens do usuário diretamente do Firestore
        const userItemsSnapshot = await db.collection('userItems').where('userId', '==', user.id).get();
        const userItems = userItemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Buscar detalhes dos itens
        const userItemsWithDetails = await Promise.all(userItems.map(async (ui) => {
          const itemDoc = await db.collection('items').doc(ui.itemId).get();
          const item = itemDoc.exists ? { id: itemDoc.id, ...itemDoc.data() } : null;
          return { ...ui, item };
        }));

        const userItemsFiltered = userItemsWithDetails.filter(ui => ui.item);

        if (userItemsFiltered.length === 0) {
          continue;
        }

        // Calcular score baseado nos pontos dos itens
        let totalScore = 0;

        userItemsFiltered.forEach(ui => {
          const itemPoints = (ui.item.points || 0) * ui.quantity;
          totalScore += itemPoints;
        });

        // Encontrar o item com mais pontos de nível de raridade
        let rarestItem = userItemsFiltered[0];
        let maxRarityScore = 0;

        userItemsFiltered.forEach(ui => {
          let rarityScore = ui.item.points || 0;

            // Para itens lendários e míticos, aplicar multiplicador do rarityLevel
            if ((ui.item.rarity === 'LENDARIO' || ui.item.rarity === 'MITICO') && ui.rarityLevel) {
              const rarityMultiplier = 1 + ((1000 - ui.rarityLevel) / 1000); // 1.0 a 2.0
              rarityScore = rarityScore * rarityMultiplier;
            }

            if (rarityScore > maxRarityScore) {
              maxRarityScore = rarityScore;
              rarestItem = ui;
            }
          });

          rankingEntries.push({
            userId: user.id || '',
            username: user.username || 'Jogador',
            photoURL: user.profileIcon || user.photoURL || '',
            profileBackground: user.profileBackground || '',
            rarestItem: rarestItem,
            totalItems: userItemsFiltered.length,
            score: totalScore
          });
      } catch (error) {
        console.error(`Erro ao processar usuário ${user.id}:`, error);
        continue;
      }
    }

    // Ordenar por score
    rankingEntries.sort((a, b) => b.score - a.score);

    res.json(rankingEntries.slice(0, limitCount));
  } catch (error) {
    console.error('Erro ao buscar ranking global:', error);
    res.status(500).json({ error: 'Erro ao buscar ranking global' });
  }
});

// Get ranking by box
router.get('/box/:boxId/:limit?', async (req, res) => {
  try {
    const { boxId } = req.params;
    const limitCount = parseInt(req.params.limit) || 20;

    const usersSnapshot = await db.collection('users').get();
    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const rankingEntries = [];

    for (const user of users) {
      if (!user.id) continue;

      try {
        // Buscar itens do usuário na caixa específica
        const userItemsSnapshot = await db.collection('userItems').where('userId', '==', user.id).get();
        const userItems = userItemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Filtrar itens da caixa específica e buscar detalhes
        const userItemsInBox = await Promise.all(userItems
          .filter(ui => ui.itemId) // garantir que tem itemId
          .map(async (ui) => {
            const itemDoc = await db.collection('items').doc(ui.itemId).get();
            const item = itemDoc.exists ? { id: itemDoc.id, ...itemDoc.data() } : null;
            return item && item.boxId === boxId ? { ...ui, item } : null;
          })
        );

        const validItemsInBox = userItemsInBox.filter(ui => ui !== null);

        if (validItemsInBox.length === 0) continue;

        // Encontrar o item mais raro na caixa
        let rarestItem = validItemsInBox[0];
        let maxScore = 0;

        validItemsInBox.forEach(ui => {
          let score = (ui.item.points || 0) + (ui.item.power || 0);
          if ((ui.item.rarity === 'LENDARIO' || ui.item.rarity === 'MITICO') && ui.rarityLevel) {
            const rarityMultiplier = 1 + ((1000 - ui.rarityLevel) / 1000);
            score = score * rarityMultiplier;
          }
          if (score > maxScore) {
            maxScore = score;
            rarestItem = ui;
          }
        });

        let score = (rarestItem.item.points || 0) + (rarestItem.item.power || 0);
        if ((rarestItem.item.rarity === 'LENDARIO' || rarestItem.item.rarity === 'MITICO') && rarestItem.rarityLevel) {
          const rarityMultiplier = 1 + ((1000 - rarestItem.rarityLevel) / 1000);
          score = score * rarityMultiplier;
        }

        rankingEntries.push({
          userId: user.id || '',
          username: user.username || 'Jogador',
          photoURL: user.profileIcon || user.photoURL || '',
          profileBackground: user.profileBackground || '',
          rarestItem: rarestItem,
          totalItems: validItemsInBox.length,
          score
        });
      } catch (error) {
        console.error(`Erro ao buscar dados do usuário ${user.id} para ranking:`, error);
        continue;
      }
    }

    rankingEntries.sort((a, b) => b.score - a.score);

    res.json(rankingEntries.slice(0, limitCount));
  } catch (error) {
    console.error('Erro ao buscar ranking por caixa:', error);
    res.status(500).json({ error: 'Erro ao buscar ranking por caixa' });
  }
});

module.exports = router;