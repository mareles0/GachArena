const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

const db = admin.firestore();

router.get('/global/:limit?', async (req, res) => {
  try {
    const limitCount = parseInt(req.params.limit) || 50;

    const usersSnapshot = await db.collection('users').get();
    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const rankingEntries = [];

    for (const user of users) {
      if (!user.id) continue;

      try {
        const userItemsSnapshot = await db.collection('userItems').where('userId', '==', user.id).get();
        const userItems = userItemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const userItemsWithDetails = await Promise.all(userItems.map(async (ui) => {
          const itemDoc = await db.collection('items').doc(ui.itemId).get();
          const item = itemDoc.exists ? { id: itemDoc.id, ...itemDoc.data() } : null;
          return { ...ui, item };
        }));

        const userItemsFiltered = userItemsWithDetails.filter(ui => ui.item);

        if (userItemsFiltered.length === 0) {
          continue;
        }

        let totalScore = 0;

        userItemsFiltered.forEach(ui => {
          const itemPoints = (ui.item.points || 0) * ui.quantity;
          totalScore += itemPoints;
        });

        let rarestItem = userItemsFiltered[0];
        let maxRarityScore = 0;

        userItemsFiltered.forEach(ui => {
          let rarityScore = ui.item.points || 0;

            if ((ui.item.rarity === 'LENDARIO' || ui.item.rarity === 'MITICO') && ui.rarityLevel) {
              const rarityMultiplier = 1 + ((1000 - ui.rarityLevel) / 1000);
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

    rankingEntries.sort((a, b) => b.score - a.score);

    res.json(rankingEntries.slice(0, limitCount));
  } catch (error) {
    console.error('Erro ao buscar ranking global:', error);
    res.status(500).json({ error: 'Erro ao buscar ranking global' });
  }
});

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
        const userItemsSnapshot = await db.collection('userItems').where('userId', '==', user.id).get();
        const userItems = userItemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const userItemsInBox = await Promise.all(userItems
          .filter(ui => ui.itemId)
          .map(async (ui) => {
            const itemDoc = await db.collection('items').doc(ui.itemId).get();
            const item = itemDoc.exists ? { id: itemDoc.id, ...itemDoc.data() } : null;
            return item && item.boxId === boxId ? { ...ui, item } : null;
          })
        );

        const validItemsInBox = userItemsInBox.filter(ui => ui !== null);

        if (validItemsInBox.length === 0) continue;

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