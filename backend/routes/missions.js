const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

const db = admin.firestore();

function normalizeTicketReward(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function pickMaxRewardValue(...values) {
  return Math.max(...values.map(v => normalizeTicketReward(v)));
}

function extractRewardFromMission(mission) {
  if (!mission) {
    return { normalTickets: 0, premiumTickets: 0 };
  }

  // Compatibilidade: alguns registros usam reward.{normalTickets,premiumTickets},
  // outros usam rewardNormal/rewardPremium e/ou normalTickets/premiumTickets no root.
  // Evitar duplicar quando mais de um formato estiver presente.
  const normalTickets = pickMaxRewardValue(
    mission.reward && typeof mission.reward === 'object' ? mission.reward.normalTickets : 0,
    mission.rewardNormal,
    mission.normalTickets
  );
  const premiumTickets = pickMaxRewardValue(
    mission.reward && typeof mission.reward === 'object' ? mission.reward.premiumTickets : 0,
    mission.rewardPremium,
    mission.premiumTickets
  );

  return { normalTickets, premiumTickets };
}

function extractDailyReward(mission, day) {
  if (mission && Array.isArray(mission.dailyRewards) && mission.dailyRewards.length) {
    const dayNumber = Number(day);
    const entry = mission.dailyRewards.find(r => Number(r.day) === dayNumber) || mission.dailyRewards[dayNumber - 1];
    if (!entry) {
      return null;
    }

    // Evitar duplicar quando reward e rewardNormal coexistirem.
    let normalTickets = pickMaxRewardValue(
      entry.reward && typeof entry.reward === 'object' ? entry.reward.normalTickets : 0,
      entry.rewardNormal,
      entry.normalTickets
    );
    let premiumTickets = pickMaxRewardValue(
      entry.reward && typeof entry.reward === 'object' ? entry.reward.premiumTickets : 0,
      entry.rewardPremium,
      entry.premiumTickets
    );

    if (normalTickets === 0 && premiumTickets === 0) {
      return extractRewardFromMission(mission);
    }

    return { normalTickets, premiumTickets };
  }

  return extractRewardFromMission(mission);
}

function normalizeMissionForClient(mission) {
  if (!mission || typeof mission !== 'object') {
    return mission;
  }

  const normalized = { ...mission };
  const reward = extractRewardFromMission(normalized);
  normalized.reward = {
    ...(normalized.reward && typeof normalized.reward === 'object' ? normalized.reward : {}),
    normalTickets: reward.normalTickets,
    premiumTickets: reward.premiumTickets
  };

  if (Array.isArray(normalized.dailyRewards)) {
    normalized.dailyRewards = normalized.dailyRewards.map((d) => {
      const entry = { ...d };
      const entryReward = {
        normalTickets: pickMaxRewardValue(
          entry.reward && typeof entry.reward === 'object' ? entry.reward.normalTickets : 0,
          entry.rewardNormal,
          entry.normalTickets
        ),
        premiumTickets: pickMaxRewardValue(
          entry.reward && typeof entry.reward === 'object' ? entry.reward.premiumTickets : 0,
          entry.rewardPremium,
          entry.premiumTickets
        )
      };
      entry.reward = {
        ...(entry.reward && typeof entry.reward === 'object' ? entry.reward : {}),
        ...entryReward
      };
      return entry;
    });
  }

  return normalized;
}

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
    const missions = snapshot.docs.map(doc => normalizeMissionForClient({ id: doc.id, ...doc.data() }));
    res.json(missions);
  } catch (error) {
    console.error('Erro ao buscar missões:', error);
    res.status(500).json({ error: 'Erro ao buscar missões' });
  }
});

router.get('/active', async (req, res) => {
  try {
    const snapshot = await db.collection('missions').where('active', '==', true).get();
    const missions = snapshot.docs.map(doc => normalizeMissionForClient({ id: doc.id, ...doc.data() }));
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
    res.json(normalizeMissionForClient({ id: doc.id, ...doc.data() }));
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

router.get('/user/:userId', async (req, res) => {
  try {
    const snapshot = await db.collection('userMissions').where('userId', '==', req.params.userId).get();
    const userMissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const missionsWithDetails = await Promise.all(userMissions.map(async (um) => {
      const missionDoc = await db.collection('missions').doc(um.missionId).get();
      const mission = missionDoc.exists ? normalizeMissionForClient({ id: missionDoc.id, ...missionDoc.data() }) : null;
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

    const existing = await db.collection('userMissions')
      .where('userId', '==', userId)
      .where('missionId', '==', missionId)
      .get();

    if (!existing.empty) {
      return res.json({ id: existing.docs[0].id });
    }

    const missionDoc = await db.collection('missions').doc(missionId).get();
    if (!missionDoc.exists) {
      return res.status(404).json({ error: 'Missão não encontrada' });
    }
    const mission = missionDoc.data();
    const isDaily = mission && mission.type === 'DAILY';
    const isAutoComplete = !isDaily && (mission && (mission.autoComplete === true || !mission.requirement || String(mission.requirement).trim() === ''));

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const payload = {
      userId,
      missionId,
      progress: isAutoComplete ? 100 : 0,
      completed: isAutoComplete ? true : false,
      claimed: false,
      claimedDays: [],
      // Missão diária: permitir coletar o dia 1 imediatamente.
      // O nextAvailableAt só deve ser definido após a primeira coleta.
      nextAvailableAt: isDaily ? null : null,
      lastDailyClaimAt: null,
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

      const allDays = Array.from({ length: totalDays }, (_, i) => i + 1);
      const nextUnclaimed = allDays.find(d => !claimedDays.includes(d));
      if (nextUnclaimed !== dayNumber) {
        throw new Error('Dia não disponível para coleta');
      }

      const nextAvailableTs = umData.nextAvailableAt;
      const lastClaimTs = umData.lastDailyClaimAt;

      // Compatibilidade: se o UserMission antigo foi criado com nextAvailableAt no futuro,
      // ainda assim o dia 1 deve ser coletável na primeira vez.
      if (claimedDays.length === 0 && dayNumber === 1 && !lastClaimTs) {
        console.log('[Missions] Primeira coleta (dia 1) - permitindo independentemente de nextAvailableAt');
      } else {
      
      console.log('[Missions] Validando disponibilidade:', {
        dayNumber,
        nextAvailableTs,
        lastClaimTs,
        hasTimestamp: !!nextAvailableTs,
        hasLastClaim: !!lastClaimTs
      });
      
      if (!nextAvailableTs && !lastClaimTs) {
        console.log('[Missions] Sem nextAvailableAt e lastDailyClaimAt, primeira coleta - permitindo');
      } else if (nextAvailableTs) {
        try {
          const nextAvailableMillis = nextAvailableTs.toMillis();
          const now = Date.now();
          console.log('[Missions] Verificando nextAvailableAt:', {
            dayNumber,
            now: new Date(now).toISOString(),
            nextAvailable: new Date(nextAvailableMillis).toISOString(),
            isAvailable: now >= nextAvailableMillis
          });
          if (now < nextAvailableMillis) {
            const hoursLeft = Math.ceil((nextAvailableMillis - now) / (1000 * 60 * 60));
            throw { statusCode: 400, message: `Você precisa esperar ${hoursLeft}h para coletar o próximo dia` };
          }
        } catch (err) {
          if (err.statusCode) {
            throw err;
          }
          console.error('[Missions] Erro ao processar nextAvailableAt:', err);
        }
      } else if (lastClaimTs) {
        const lastClaimDate = new Date(lastClaimTs.toMillis());
        const today = new Date();
        lastClaimDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        
        console.log('[Missions] Verificação de data da última coleta:', {
          lastClaimDate: lastClaimDate.toISOString(),
          today: today.toISOString(),
          sameDay: lastClaimDate.getTime() === today.getTime()
        });
        
        if (lastClaimDate.getTime() === today.getTime()) {
          throw { statusCode: 400, message: 'Você já coletou uma recompensa diária hoje. Volte amanhã!' };
        }
      }

      }

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
        console.log('[Missions] Todos os dias coletados, missão completa');
      } else {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        if (isNaN(tomorrow.getTime())) {
          console.error('[Missions] Data inválida ao calcular tomorrow');
          tomorrow.setTime(Date.now() + 24 * 60 * 60 * 1000);
        }
        
        updates.nextAvailableAt = admin.firestore.Timestamp.fromDate(tomorrow);
        console.log('[Missions] Próximo dia disponível em:', {
          tomorrow: tomorrow.toISOString(),
          timestamp: updates.nextAvailableAt.toDate().toISOString(),
          claimedDays: claimedDays.length,
          totalDays
        });
      }

      console.log('[Missions] Updates a serem aplicados:', {
        userMissionId,
        updates: {
          ...updates,
          nextAvailableAt: updates.nextAvailableAt ? updates.nextAvailableAt.toDate().toISOString() : null
        }
      });

      transaction.update(userMissionRef, updates);
    });

    res.json({ message: 'Dia coletado com sucesso' });
    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'missionsChanged' });
    io && io.emit('appEvent', { type: 'ticketsChanged' });
  } catch (error) {
    console.error('Erro ao coletar dia:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao coletar dia' });
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

router.post('/user/:userId/calculate-progress/:missionId', async (req, res) => {
  try {
    const { userId, missionId } = req.params;

    const missionDoc = await db.collection('missions').doc(missionId).get();
    if (!missionDoc.exists) {
      return res.status(404).json({ error: 'Missão não encontrada' });
    }

    const mission = missionDoc.data();
    const requirement = mission.requirement;
    const requirementAmount = mission.requirementAmount || 0;

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const userData = userDoc.data();
    let currentValue = 0;
    let progress = 0;

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

router.post('/user-mission/:userMissionId/reset-daily', async (req, res) => {
  try {
    const userMissionId = req.params.userMissionId;
    const userMissionRef = db.collection('userMissions').doc(userMissionId);
    const doc = await userMissionRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'UserMission não encontrado' });
    }
    
    const data = doc.data();
    const claimedDays = data.claimedDays || [];
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    await userMissionRef.update({
      nextAvailableAt: admin.firestore.Timestamp.fromDate(tomorrow)
    });
    
    console.log('[Missions] nextAvailableAt resetado:', {
      userMissionId,
      claimedDays,
      newNextAvailable: tomorrow.toISOString()
    });
    
    res.json({ 
      message: 'nextAvailableAt resetado com sucesso',
      nextAvailableAt: tomorrow.toISOString()
    });
    
    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'missionsChanged' });
  } catch (error) {
    console.error('Erro ao resetar daily mission:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;