const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

// Get Firestore instance
const db = admin.firestore();

function normalizeTicketReward(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function extractRewardFromMission(mission) {
  let normalTickets = 0;
  let premiumTickets = 0;

  if (!mission) {
    return { normalTickets, premiumTickets };
  }

  if (mission.reward && typeof mission.reward === 'object') {
    normalTickets += normalizeTicketReward(mission.reward.normalTickets);
    premiumTickets += normalizeTicketReward(mission.reward.premiumTickets);
  }

  // Campos legados
  normalTickets += normalizeTicketReward(mission.rewardNormal);
  premiumTickets += normalizeTicketReward(mission.rewardPremium);

  return { normalTickets, premiumTickets };
}

function extractDailyReward(mission, day) {
  if (mission && Array.isArray(mission.dailyRewards) && mission.dailyRewards.length) {
    const dayNumber = Number(day);
    const entry = mission.dailyRewards.find(r => Number(r.day) === dayNumber) || mission.dailyRewards[dayNumber - 1];
    if (!entry) {
      return null;
    }

    let normalTickets = 0;
    let premiumTickets = 0;

    if (entry.reward && typeof entry.reward === 'object') {
      normalTickets += normalizeTicketReward(entry.reward.normalTickets);
      premiumTickets += normalizeTicketReward(entry.reward.premiumTickets);
    }
    // Campos legados do dailyRewards
    normalTickets += normalizeTicketReward(entry.rewardNormal);
    premiumTickets += normalizeTicketReward(entry.rewardPremium);

    // Fallback: se não tiver nada definido no dia, usar recompensa base da missão
    if (normalTickets === 0 && premiumTickets === 0) {
      return extractRewardFromMission(mission);
    }

    return { normalTickets, premiumTickets };
  }

  // Se não houver dailyRewards, usar a recompensa base
  return extractRewardFromMission(mission);
}

// CRUD Missões
router.post('/', async (req, res) => {
  try {
    const mission = req.body;
    const payload = { ...mission };
    delete payload.id;
    payload.createdAt = admin.firestore.Timestamp.now();

    const docRef = await db.collection('missions').add(payload);
    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'missionsChanged' });
    res.status(201).json({ id: docRef.id });
  } catch (error) {
    console.error('Erro ao criar missão:', error);
    res.status(500).json({ error: 'Erro ao criar missão' });
  }
});

router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('missions').get();
    const missions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(missions);
  } catch (error) {
    console.error('Erro ao buscar missões:', error);
    res.status(500).json({ error: 'Erro ao buscar missões' });
  }
});

router.get('/active', async (req, res) => {
  try {
    const snapshot = await db.collection('missions').where('active', '==', true).get();
    const missions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(missions);
  } catch (error) {
    console.error('Erro ao buscar missões ativas:', error);
    res.status(500).json({ error: 'Erro ao buscar missões ativas' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('missions').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Missão não encontrada' });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Erro ao buscar missão:', error);
    res.status(500).json({ error: 'Erro ao buscar missão' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const mission = req.body;
    await db.collection('missions').doc(req.params.id).update(mission);
    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'missionsChanged' });
    res.json({ message: 'Missão atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar missão:', error);
    res.status(500).json({ error: 'Erro ao atualizar missão' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.collection('missions').doc(req.params.id).delete();
    // Deletar todas as UserMissions associadas
    const userMissionsSnapshot = await db.collection('userMissions').where('missionId', '==', req.params.id).get();
    const deletePromises = userMissionsSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(deletePromises);
    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'missionsChanged' });
    res.json({ message: 'Missão deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar missão:', error);
    res.status(500).json({ error: 'Erro ao deletar missão' });
  }
});

// UserMissions
router.get('/user/:userId', async (req, res) => {
  try {
    const snapshot = await db.collection('userMissions').where('userId', '==', req.params.userId).get();
    const userMissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Buscar detalhes da missão
    const missionsWithDetails = await Promise.all(userMissions.map(async (um) => {
      const missionDoc = await db.collection('missions').doc(um.missionId).get();
      const mission = missionDoc.exists ? { id: missionDoc.id, ...missionDoc.data() } : null;
      return { ...um, mission };
    }));

    res.json(missionsWithDetails);
  } catch (error) {
    console.error('Erro ao buscar missões do usuário:', error);
    res.status(500).json({ error: 'Erro ao buscar missões do usuário' });
  }
});

router.post('/user/:userId/start/:missionId', async (req, res) => {
  try {
    const { userId, missionId } = req.params;

    // Verificar se já existe
    const existing = await db.collection('userMissions')
      .where('userId', '==', userId)
      .where('missionId', '==', missionId)
      .get();

    if (!existing.empty) {
      return res.json({ id: existing.docs[0].id });
    }

    // Fetch mission to determine behavior
    const missionDoc = await db.collection('missions').doc(missionId).get();
    if (!missionDoc.exists) {
      return res.status(404).json({ error: 'Missão não encontrada' });
    }
    const mission = missionDoc.data();
    const isDaily = mission && mission.type === 'DAILY';
    // Auto-complete só faz sentido para missões NÃO-diárias (as diárias usam claim-daily)
    const isAutoComplete = !isDaily && (mission && (mission.autoComplete === true || !mission.requirement || String(mission.requirement).trim() === ''));

    const payload = {
      userId,
      missionId,
      progress: isAutoComplete ? 100 : 0,
      completed: isAutoComplete ? true : false,
      // Importante: não marcar como claimed automaticamente, senão a UI bloqueia a coleta e a recompensa nunca é creditada
      claimed: false,
      claimedDays: [],
      nextAvailableAt: isDaily ? admin.firestore.Timestamp.now() : null,
      createdAt: admin.firestore.Timestamp.now()
    };

    if (isAutoComplete) {
      payload.completedAt = admin.firestore.Timestamp.now();
    }

    const docRef = await db.collection('userMissions').add(payload);
    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'missionsChanged' });
    res.status(201).json({ id: docRef.id });
  } catch (error) {
    console.error('Erro ao iniciar missão:', error);
    res.status(500).json({ error: 'Erro ao iniciar missão' });
  }
});

router.put('/user-mission/:userMissionId/claim', async (req, res) => {
  try {
    const userMissionId = req.params.userMissionId;
    let rewardGranted = { normalTickets: 0, premiumTickets: 0 };

    await db.runTransaction(async (transaction) => {
      const userMissionRef = db.collection('userMissions').doc(userMissionId);
      const userMissionDoc = await transaction.get(userMissionRef);

      if (!userMissionDoc.exists) {
        const err = new Error('UserMission não encontrado');
        err.statusCode = 404;
        throw err;
      }

      const umData = userMissionDoc.data();
      if (umData.claimed) {
        const err = new Error('Recompensa já coletada');
        err.statusCode = 400;
        throw err;
      }

      if (!umData.completed) {
        const err = new Error('Missão ainda não completada');
        err.statusCode = 400;
        throw err;
      }

      const missionRef = db.collection('missions').doc(umData.missionId);
      const missionDoc = await transaction.get(missionRef);
      const mission = missionDoc.exists ? missionDoc.data() : null;

      if (mission && mission.type === 'DAILY') {
        const err = new Error('Use claim-daily para missões diárias');
        err.statusCode = 400;
        throw err;
      }

      rewardGranted = extractRewardFromMission(mission);
      const normal = normalizeTicketReward(rewardGranted.normalTickets);
      const premium = normalizeTicketReward(rewardGranted.premiumTickets);

      if (normal > 0 || premium > 0) {
        const userRef = db.collection('users').doc(umData.userId);
        const updates = {};
        if (normal > 0) updates.normalTickets = admin.firestore.FieldValue.increment(normal);
        if (premium > 0) updates.premiumTickets = admin.firestore.FieldValue.increment(premium);
        transaction.set(userRef, updates, { merge: true });
      }

      transaction.update(userMissionRef, {
        claimed: true,
        claimedAt: admin.firestore.Timestamp.now()
      });
    });

    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'missionsChanged' });
    io && io.emit('appEvent', { type: 'ticketsChanged' });
    res.json({ message: 'Recompensa coletada com sucesso', reward: rewardGranted });
  } catch (error) {
    console.error('Erro ao marcar missão como coletada:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao marcar missão como coletada' });
  }
});

router.put('/user-mission/:userMissionId/claim-daily', async (req, res) => {
  try {
    const { day } = req.body;
    const userMissionId = req.params.userMissionId;

    await db.runTransaction(async (transaction) => {
      const userMissionRef = db.collection('userMissions').doc(userMissionId);
      const userMissionDoc = await transaction.get(userMissionRef);

      if (!userMissionDoc.exists) {
        throw new Error('UserMission não encontrado');
      }

      const umData = userMissionDoc.data();
      const missionId = umData.missionId;
      const missionDoc = await transaction.get(db.collection('missions').doc(missionId));
      const mission = missionDoc.data();
      const totalDays = (mission && mission.dailyRewards && mission.dailyRewards.length) || 7;
      const claimedDays = (umData.claimedDays || []).slice();

      const dayNumber = Number(day);
      if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > totalDays) {
        throw new Error('Dia inválido');
      }

      if (claimedDays.includes(dayNumber)) {
        throw new Error('Dia já coletado');
      }

      // ensure day is the next available unclaimed day (sequential rule)
      const allDays = Array.from({ length: totalDays }, (_, i) => i + 1);
      const nextUnclaimed = allDays.find(d => !claimedDays.includes(d));
      if (nextUnclaimed !== dayNumber) {
        throw new Error('Dia não disponível para coleta');
      }

      // check time-based availability
      const nextAvailableTs = umData.nextAvailableAt;
      if (nextAvailableTs) {
        const nextAvailableMillis = nextAvailableTs.toMillis();
        if (Date.now() < nextAvailableMillis) {
          throw new Error('Dia ainda não disponível');
        }
      }

      // Aplicar recompensa do dia no usuário
      const dailyReward = extractDailyReward(mission, dayNumber);
      if (!dailyReward) {
        throw new Error('Recompensa do dia não encontrada');
      }

      const normal = normalizeTicketReward(dailyReward.normalTickets);
      const premium = normalizeTicketReward(dailyReward.premiumTickets);
      if (normal > 0 || premium > 0) {
        const userRef = db.collection('users').doc(umData.userId);
        const updates = {};
        if (normal > 0) updates.normalTickets = admin.firestore.FieldValue.increment(normal);
        if (premium > 0) updates.premiumTickets = admin.firestore.FieldValue.increment(premium);
        transaction.set(userRef, updates, { merge: true });
      }

      claimedDays.push(dayNumber);
      const progress = Math.round((claimedDays.length / totalDays) * 100);

      const updates = { claimedDays, progress, lastDailyClaimAt: admin.firestore.Timestamp.now() };
      if (claimedDays.length === totalDays) {
        updates.completed = true;
        updates.completedAt = admin.firestore.Timestamp.now();
        updates.claimed = true;
        updates.claimedAt = admin.firestore.Timestamp.now();
        updates.nextAvailableAt = null;
      } else {
        // set next available to +24h
        updates.nextAvailableAt = admin.firestore.Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
      }

      transaction.update(userMissionRef, updates);
    });

    res.json({ message: 'Dia coletado com sucesso' });
    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'missionsChanged' });
    io && io.emit('appEvent', { type: 'ticketsChanged' });
  } catch (error) {
    console.error('Erro ao coletar dia:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/user-mission/:userMissionId/progress', async (req, res) => {
  try {
    const { progress } = req.body;
    await db.collection('userMissions').doc(req.params.userMissionId).update({ progress });
    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'missionsChanged' });
    res.json({ message: 'Progresso atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar progresso:', error);
    res.status(500).json({ error: 'Erro ao atualizar progresso' });
  }
});

router.put('/user-mission/:userMissionId/complete', async (req, res) => {
  try {
    await db.collection('userMissions').doc(req.params.userMissionId).update({
      completed: true,
      completedAt: admin.firestore.Timestamp.now()
    });
    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'missionsChanged' });
    res.json({ message: 'Missão completada com sucesso' });
  } catch (error) {
    console.error('Erro ao completar missão:', error);
    res.status(500).json({ error: 'Erro ao completar missão' });
  }
});

// Calcular progresso de uma missão regular baseado nos dados do usuário
router.post('/user/:userId/calculate-progress/:missionId', async (req, res) => {
  try {
    const { userId, missionId } = req.params;

    // Buscar a missão
    const missionDoc = await db.collection('missions').doc(missionId).get();
    if (!missionDoc.exists) {
      return res.status(404).json({ error: 'Missão não encontrada' });
    }

    const mission = missionDoc.data();
    const requirement = mission.requirement;
    const requirementAmount = mission.requirementAmount || 0;

    // Buscar dados do usuário
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const userData = userDoc.data();
    let currentValue = 0;
    let progress = 0;

    // Calcular progresso baseado no tipo de requisito
    switch (requirement) {
      case 'TOTAL_POWER':
        currentValue = userData.totalPower || 0;
        progress = Math.min(100, Math.round((currentValue / requirementAmount) * 100));
        break;

      case 'ITEM_COUNT':
        const userItemsSnapshot = await db.collection('userItems').where('userId', '==', userId).get();
        currentValue = userItemsSnapshot.size;
        progress = Math.min(100, Math.round((currentValue / requirementAmount) * 100));
        console.log(`[Missions] ITEM_COUNT: userId=${userId}, currentValue=${currentValue}, target=${requirementAmount}, progress=${progress}%`);
        break;

      case 'OPEN_BOXES':
        currentValue = userData.boxesOpened || 0;
        progress = Math.min(100, Math.round((currentValue / requirementAmount) * 100));
        break;

      case 'GACHA_PULLS':
        currentValue = userData.gachaPulls || 0;
        progress = Math.min(100, Math.round((currentValue / requirementAmount) * 100));
        break;

      case 'COMPLETE_TRADES':
        const tradesSnapshot = await db.collection('trades')
          .where('status', '==', 'accepted')
          .where('userId1', '==', userId)
          .get();
        const tradesSnapshot2 = await db.collection('trades')
          .where('status', '==', 'accepted')
          .where('userId2', '==', userId)
          .get();
        currentValue = tradesSnapshot.size + tradesSnapshot2.size;
        progress = Math.min(100, Math.round((currentValue / requirementAmount) * 100));
        break;

      case 'RARITY_COMMON':
      case 'RARITY_RARE':
      case 'RARITY_EPIC':
      case 'RARITY_LEGENDARY':
      case 'RARITY_MYTHIC':
        const rarity = requirement.replace('RARITY_', '');
        const itemsSnapshot = await db.collection('userItems')
          .where('userId', '==', userId)
          .get();
        
        let hasRarity = false;
        for (const doc of itemsSnapshot.docs) {
          const itemData = doc.data();
          if (itemData.itemId) {
            const itemDoc = await db.collection('items').doc(itemData.itemId).get();
            if (itemDoc.exists && itemDoc.data().rarity === rarity) {
              hasRarity = true;
              break;
            }
          }
        }
        currentValue = hasRarity ? 1 : 0;
        progress = hasRarity ? 100 : 0;
        break;

      default:
        progress = 0;
    }

    const completed = progress >= 100;

    res.json({ 
      progress, 
      currentValue, 
      targetValue: requirementAmount,
      completed 
    });
  } catch (error) {
    console.error('Erro ao calcular progresso:', error);
    res.status(500).json({ error: 'Erro ao calcular progresso' });
  }
});

module.exports = router;