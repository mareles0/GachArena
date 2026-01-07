import express, { Request, Response } from 'express';
import admin from 'firebase-admin';

const router = express.Router();
const db = admin.firestore();

function normalizeTicketReward(value: any): number {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function pickMaxRewardValue(...values: any[]): number {
  return Math.max(...values.map(v => normalizeTicketReward(v)));
}

function extractRewardFromMission(mission: any): { normalTickets: number; premiumTickets: number } {
  if (!mission) {
    return { normalTickets: 0, premiumTickets: 0 };
  }

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

function extractDailyReward(mission: any, day: any): { normalTickets: number; premiumTickets: number } | null {
  if (mission && Array.isArray(mission.dailyRewards) && mission.dailyRewards.length) {
    const dayNumber = Number(day);
    const entry = mission.dailyRewards.find((r: any) => Number(r.day) === dayNumber) || mission.dailyRewards[dayNumber - 1];
    if (!entry) {
      return null;
    }

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

function normalizeMissionForClient(mission: any): any {
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
    normalized.dailyRewards = normalized.dailyRewards.map((d: any) => {
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

router.post('/', async (req: Request, res: Response) => {
  try {
    const mission = req.body;
    const payload: any = { ...mission };
    delete payload.id;
    payload.createdAt = admin.firestore.Timestamp.now();

    const docRef = await db.collection('missions').add(payload);
    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'missionsChanged' });
    res.status(201).json({ id: docRef.id });
  } catch (error: any) {
    console.error('Erro ao criar missão:', error);
    res.status(500).json({ error: 'Erro ao criar missão' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const snapshot = await db.collection('missions').get();
    const missions = snapshot.docs.map(doc => normalizeMissionForClient({ id: doc.id, ...doc.data() }));
    res.json(missions);
  } catch (error: any) {
    console.error('Erro ao buscar missões:', error);
    res.status(500).json({ error: 'Erro ao buscar missões' });
  }
});

router.get('/active', async (req: Request, res: Response) => {
  try {
    const snapshot = await db.collection('missions').where('active', '==', true).get();
    const missions = snapshot.docs.map(doc => normalizeMissionForClient({ id: doc.id, ...doc.data() }));
    res.json(missions);
  } catch (error: any) {
    console.error('Erro ao buscar missões ativas:', error);
    res.status(500).json({ error: 'Erro ao buscar missões ativas' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const doc = await db.collection('missions').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Missão não encontrada' });
    }
    res.json(normalizeMissionForClient({ id: doc.id, ...doc.data() }));
  } catch (error: any) {
    console.error('Erro ao buscar missão:', error);
    res.status(500).json({ error: 'Erro ao buscar missão' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const mission = req.body;
    await db.collection('missions').doc(req.params.id).update(mission);
    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'missionsChanged' });
    res.json({ message: 'Missão atualizada com sucesso' });
  } catch (error: any) {
    console.error('Erro ao atualizar missão:', error);
    res.status(500).json({ error: 'Erro ao atualizar missão' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await db.collection('missions').doc(req.params.id).delete();
    const userMissionsSnapshot = await db.collection('userMissions').where('missionId', '==', req.params.id).get();
    const deletePromises = userMissionsSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(deletePromises);
    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'missionsChanged' });
    res.json({ message: 'Missão deletada com sucesso' });
  } catch (error: any) {
    console.error('Erro ao deletar missão:', error);
    res.status(500).json({ error: 'Erro ao deletar missão' });
  }
});

router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const snapshot = await db.collection('userMissions').where('userId', '==', req.params.userId).get();
    const userMissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const missionsWithDetails = await Promise.all(userMissions.map(async (um: any) => {
      const missionDoc = await db.collection('missions').doc(um.missionId).get();
      const mission = missionDoc.exists ? normalizeMissionForClient({ id: missionDoc.id, ...missionDoc.data() }) : null;
      return { ...um, mission };
    }));

    res.json(missionsWithDetails);
  } catch (error: any) {
    console.error('Erro ao buscar missões do usuário:', error);
    res.status(500).json({ error: 'Erro ao buscar missões do usuário' });
  }
});

router.post('/user/:userId/start/:missionId', async (req: Request, res: Response) => {
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

    const payload: any = {
      userId,
      missionId,
      progress: isAutoComplete ? 100 : 0,
      completed: isAutoComplete ? true : false,
      claimed: false,
      claimedDays: [],
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
  } catch (error: any) {
    console.error('Erro ao iniciar missão:', error);
    res.status(500).json({ error: 'Erro ao iniciar missão' });
  }
});

router.put('/user-mission/:userMissionId/claim', async (req: Request, res: Response) => {
  try {
    const userMissionId = req.params.userMissionId;
    let rewardGranted = { normalTickets: 0, premiumTickets: 0 };

    await db.runTransaction(async (transaction) => {
      const userMissionRef = db.collection('userMissions').doc(userMissionId);
      const userMissionDoc = await transaction.get(userMissionRef);

      if (!userMissionDoc.exists) {
        const err: any = new Error('UserMission não encontrado');
        err.statusCode = 404;
        throw err;
      }

      const umData = userMissionDoc.data();
      if (!umData) {
        throw new Error('Dados da missão não encontrados');
      }
      if (umData.claimed) {
        const err: any = new Error('Recompensa já coletada');
        err.statusCode = 400;
        throw err;
      }

      if (!umData.completed) {
        const err: any = new Error('Missão ainda não completada');
        err.statusCode = 400;
        throw err;
      }

      const missionRef = db.collection('missions').doc(umData.missionId);
      const missionDoc = await transaction.get(missionRef);
      const mission = missionDoc.exists ? missionDoc.data() : null;

      if (mission && mission.type === 'DAILY') {
        const err: any = new Error('Use claim-daily para missões diárias');
        err.statusCode = 400;
        throw err;
      }

      rewardGranted = extractRewardFromMission(mission);
      const normal = normalizeTicketReward(rewardGranted.normalTickets);
      const premium = normalizeTicketReward(rewardGranted.premiumTickets);

      if (normal > 0 || premium > 0) {
        const userRef = db.collection('users').doc(umData.userId);
        const updates: any = {};
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
  } catch (error: any) {
    console.error('Erro ao marcar missão como coletada:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao marcar missão como coletada' });
  }
});

router.put('/user-mission/:userMissionId/claim-daily', async (req: Request, res: Response) => {
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
      if (!umData) {
        throw new Error('Dados da missão não encontrados');
      }
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
        } catch (err: any) {
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
        const updates: any = {};
        if (normal > 0) updates.normalTickets = admin.firestore.FieldValue.increment(normal);
        if (premium > 0) updates.premiumTickets = admin.firestore.FieldValue.increment(premium);
        transaction.set(userRef, updates, { merge: true });
      }

      claimedDays.push(dayNumber);
      const progress = Math.round((claimedDays.length / totalDays) * 100);

      const updates: any = { claimedDays, progress, lastDailyClaimAt: admin.firestore.Timestamp.now() };
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
  } catch (error: any) {
    console.error('Erro ao coletar dia:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao coletar dia' });
  }
});

router.put('/user-mission/:userMissionId/progress', async (req: Request, res: Response) => {
  try {
    const { progress } = req.body;
    await db.collection('userMissions').doc(req.params.userMissionId).update({ progress });
    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'missionsChanged' });
    res.json({ message: 'Progresso atualizado com sucesso' });
  } catch (error: any) {
    console.error('Erro ao atualizar progresso:', error);
    res.status(500).json({ error: 'Erro ao atualizar progresso' });
  }
});

router.put('/user-mission/:userMissionId/complete', async (req: Request, res: Response) => {
  try {
    await db.collection('userMissions').doc(req.params.userMissionId).update({
      completed: true,
      completedAt: admin.firestore.Timestamp.now()
    });
    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'missionsChanged' });
    res.json({ message: 'Missão completada com sucesso' });
  } catch (error: any) {
    console.error('Erro ao completar missão:', error);
    res.status(500).json({ error: 'Erro ao completar missão' });
  }
});

router.post('/user/:userId/batch-progress', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { missionIds } = req.body;

    console.log('[Batch Progress] Requisição recebida:', { userId, missionIdsCount: missionIds?.length });

    if (!Array.isArray(missionIds) || missionIds.length === 0) {
      console.log('[Batch Progress] Nenhuma missão para calcular');
      return res.json({});
    }

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.log('[Batch Progress] Usuário não encontrado:', userId);
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    const userData = userDoc.data();
    console.log('[Batch Progress] Dados do usuário:', {
      totalPower: userData?.totalPower,
      boxesOpened: userData?.boxesOpened,
      gachaPulls: userData?.gachaPulls
    });

    const results: any = {};
    const batchSize = 10;
    
    for (let i = 0; i < missionIds.length; i += batchSize) {
      const batchIds = missionIds.slice(i, i + batchSize);
      
      const missionsSnapshot = await db.collection('missions').where(admin.firestore.FieldPath.documentId(), 'in', batchIds).get();
      const missionsMap = new Map();
      missionsSnapshot.docs.forEach(doc => missionsMap.set(doc.id, doc.data()));

      const userItemsSnapshot = await db.collection('userItems').where('userId', '==', userId).get();
      const userItemsCount = userItemsSnapshot.size;
      
      const tradesSnapshot1 = await db.collection('trades').where('status', '==', 'accepted').where('userId1', '==', userId).get();
      const tradesSnapshot2 = await db.collection('trades').where('status', '==', 'accepted').where('userId2', '==', userId).get();
      const completedTradesCount = tradesSnapshot1.size + tradesSnapshot2.size;

      const itemsByRarity = new Map();

      for (const missionId of batchIds) {
        const mission = missionsMap.get(missionId);
        if (!mission) {
          console.log('[Batch Progress] Missão não encontrada:', missionId);
          results[missionId] = { progress: 0, completed: false };
          continue;
        }

        const requirement = mission.requirement;
        const requirementAmount = (mission.requirementAmount || (mission.goal && mission.goal.target) || 0);
        let currentValue = 0;
        let progress = 0;

        console.log('[Batch Progress] Calculando missão:', {
          missionId,
          title: mission.title,
          requirement,
          requirementAmount
        });

        // Se não há alvo definido, não avance automaticamente
        if (!requirementAmount || requirementAmount <= 0) {
          console.log('[Batch Progress] Nenhum requirementAmount válido; definindo progress=0');
          results[missionId] = { progress: 0, currentValue: 0, targetValue: requirementAmount, completed: false };
          continue;
        }

        switch (requirement) {
          case 'TOTAL_POWER':
            currentValue = (userData?.totalPower) || 0;
            progress = Math.min(100, Math.round((currentValue / requirementAmount) * 100));
            console.log('[Batch Progress] TOTAL_POWER:', { currentValue, requirementAmount, progress });
            break;

          case 'ITEM_COUNT':
            currentValue = userItemsCount;
            progress = Math.min(100, Math.round((currentValue / requirementAmount) * 100));
            console.log('[Batch Progress] ITEM_COUNT:', { currentValue, requirementAmount, progress });
            break;

          case 'OPEN_BOXES':
            currentValue = (userData?.boxesOpened) || 0;
            progress = Math.min(100, Math.round((currentValue / requirementAmount) * 100));
            console.log('[Batch Progress] OPEN_BOXES:', { currentValue, requirementAmount, progress });
            break;

          case 'GACHA_PULLS':
            currentValue = (userData?.gachaPulls) || 0;
            progress = Math.min(100, Math.round((currentValue / requirementAmount) * 100));
            console.log('[Batch Progress] GACHA_PULLS:', { currentValue, requirementAmount, progress });
            break;

          case 'COMPLETE_TRADES':
            currentValue = completedTradesCount;
            progress = Math.min(100, Math.round((currentValue / requirementAmount) * 100));
            console.log('[Batch Progress] COMPLETE_TRADES:', { currentValue, requirementAmount, progress });
            break;

          case 'RARITY_COMMON':
          case 'RARITY_RARE':
          case 'RARITY_EPIC':
          case 'RARITY_LEGENDARY':
          case 'RARITY_MYTHIC':
            const rarity = requirement.replace('RARITY_', '');
            
            if (!itemsByRarity.has(rarity)) {
              let rarityCount = 0;
              for (const doc of userItemsSnapshot.docs) {
                const itemData = doc.data();
                
                let itemRarity = itemData.item?.rarity;
                
                if (!itemRarity && itemData.itemId) {
                  const itemDoc = await db.collection('items').doc(itemData.itemId).get();
                  if (itemDoc.exists) {
                    const itemDocData = itemDoc.data();
                    itemRarity = itemDocData?.rarity;
                  }
                }
                
                const normalizedRarity = itemRarity === 'COMUM' ? 'COMMON'
                  : itemRarity === 'RARO' ? 'RARE'
                  : itemRarity === 'EPICO' ? 'EPIC'
                  : itemRarity === 'LENDARIO' ? 'LEGENDARY' 
                  : itemRarity === 'MITICO' ? 'MYTHIC' 
                  : itemRarity;
                
                if (normalizedRarity === rarity) {
                  rarityCount += itemData.quantity || 1;
                  console.log('[Batch Progress] Item encontrado:', { 
                    itemId: itemData.itemId, 
                    itemRarity, 
                    normalizedRarity,
                    quantity: itemData.quantity || 1 
                  });
                }
              }
              itemsByRarity.set(rarity, rarityCount);
              console.log('[Batch Progress] Contou itens de raridade', rarity, ':', rarityCount);
            }
            
            currentValue = itemsByRarity.get(rarity);
            progress = requirementAmount > 0 
              ? Math.min(100, Math.round((currentValue / requirementAmount) * 100))
              : (currentValue > 0 ? 100 : 0);
            console.log('[Batch Progress] RARITY:', { rarity, currentValue, requirementAmount, progress });
            break;

          default:
            console.log('[Batch Progress] Requirement desconhecido:', requirement);
            progress = 0;
        }

        results[missionId] = {
          progress,
          currentValue,
          targetValue: requirementAmount,
          completed: progress >= 100
        };
      }
    }

    console.log('[Batch Progress] Resultados finais:', results);
    res.json(results);
  } catch (error: any) {
    console.error('Erro ao calcular progresso em lote:', error);
    res.status(500).json({ error: 'Erro ao calcular progresso em lote' });
  }
});

router.post('/user/:userId/calculate-progress/:missionId', async (req: Request, res: Response) => {
  try {
    const { userId, missionId } = req.params;

    const missionDoc = await db.collection('missions').doc(missionId).get();
    if (!missionDoc.exists) {
      return res.status(404).json({ error: 'Missão não encontrada' });
    }

    const mission = missionDoc.data();
    if (!mission) {
      return res.status(404).json({ error: 'Dados da missão não encontrados' });
    }
    const requirement = mission.requirement;
    const requirementAmount = (mission.requirementAmount || (mission.goal && mission.goal.target) || 0);

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const userData = userDoc.data();
    let currentValue = 0;
    let progress = 0;

    // Proteção: se não há requisito bem definido, não marcar como completo
    if (!requirementAmount || requirementAmount <= 0) {
      console.log('[Missions] calculate-progress: requirementAmount inválido para missionId=', missionId);
      return res.json({ progress: 0, currentValue: 0, targetValue: requirementAmount, completed: false });
    }

    switch (requirement) {
      case 'TOTAL_POWER':
        currentValue = (userData?.totalPower) || 0;
        progress = Math.min(100, Math.round((currentValue / requirementAmount) * 100));
        break;

      case 'ITEM_COUNT':
        const userItemsSnapshot = await db.collection('userItems').where('userId', '==', userId).get();
        currentValue = userItemsSnapshot.size;
        progress = Math.min(100, Math.round((currentValue / requirementAmount) * 100));
        console.log(`[Missions] ITEM_COUNT: userId=${userId}, currentValue=${currentValue}, target=${requirementAmount}, progress=${progress}%`);
        break;

      case 'OPEN_BOXES':
        currentValue = (userData?.boxesOpened) || 0;
        progress = Math.min(100, Math.round((currentValue / requirementAmount) * 100));
        break;

      case 'GACHA_PULLS':
        currentValue = (userData?.gachaPulls) || 0;
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
        
        let rarityCount = 0;
        for (const doc of itemsSnapshot.docs) {
          const itemData = doc.data();
          
          let itemRarity = itemData.item?.rarity;
          
          if (!itemRarity && itemData.itemId) {
            const itemDoc = await db.collection('items').doc(itemData.itemId).get();
            if (itemDoc.exists) {
              const itemDocData = itemDoc.data();
              itemRarity = itemDocData?.rarity;
            }
          }
          
          const normalizedRarity = itemRarity === 'COMUM' ? 'COMMON'
            : itemRarity === 'RARO' ? 'RARE'
            : itemRarity === 'EPICO' ? 'EPIC'
            : itemRarity === 'LENDARIO' ? 'LEGENDARY' 
            : itemRarity === 'MITICO' ? 'MYTHIC' 
            : itemRarity;
          
          if (normalizedRarity === rarity) {
            rarityCount += itemData.quantity || 1;
          }
        }
        currentValue = rarityCount;
        progress = requirementAmount > 0 
          ? Math.min(100, Math.round((currentValue / requirementAmount) * 100))
          : (currentValue > 0 ? 100 : 0);
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
  } catch (error: any) {
    console.error('Erro ao calcular progresso:', error);
    res.status(500).json({ error: 'Erro ao calcular progresso' });
  }
});

router.post('/user-mission/:userMissionId/reset-daily', async (req: Request, res: Response) => {
  try {
    const userMissionId = req.params.userMissionId;
    const userMissionRef = db.collection('userMissions').doc(userMissionId);
    const doc = await userMissionRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'UserMission não encontrado' });
    }
    
    const data = doc.data();
    const claimedDays = data?.claimedDays || [];
    
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
  } catch (error: any) {
    console.error('Erro ao resetar daily mission:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para criar 20 missões regulares de uma vez
router.post('/bulk/create-regular-missions', async (req: Request, res: Response) => {
  try {
    const regularMissions = [
      // Missões de coletar itens
      {
        title: 'Coletor Iniciante',
        description: 'Colete 15 itens para desbloquear',
        type: 'ACHIEVEMENT',
        goal: { type: 'ITEMS_COLLECTED', target: 15 },
        reward: { normalTickets: 15, premiumTickets: 0 },
        active: true,
        icon: '📦'
      },
      {
        title: 'Coletor Dedicado',
        description: 'Colete 50 itens para desbloquear',
        type: 'ACHIEVEMENT',
        goal: { type: 'ITEMS_COLLECTED', target: 50 },
        reward: { normalTickets: 25, premiumTickets: 5 },
        active: true,
        icon: '📦'
      },
      {
        title: 'Coletor Mestre',
        description: 'Colete 150 itens para desbloquear',
        type: 'ACHIEVEMENT',
        goal: { type: 'ITEMS_COLLECTED', target: 150 },
        reward: { normalTickets: 40, premiumTickets: 10 },
        active: true,
        icon: '📦'
      },
      {
        title: 'Coletor Supremo',
        description: 'Colete 300 itens para desbloquear',
        type: 'ACHIEVEMENT',
        goal: { type: 'ITEMS_COLLECTED', target: 300 },
        reward: { normalTickets: 50, premiumTickets: 20 },
        active: true,
        icon: '📦'
      },
      // Missões de abrir caixas
      {
        title: 'Explorador Curioso',
        description: 'Abra 15 caixas para desbloquear',
        type: 'ACHIEVEMENT',
        goal: { type: 'BOXES_OPENED', target: 15 },
        reward: { normalTickets: 20, premiumTickets: 0 },
        active: true,
        icon: '🎁'
      },
      {
        title: 'Explorador Ávido',
        description: 'Abra 30 caixas para desbloquear',
        type: 'ACHIEVEMENT',
        goal: { type: 'BOXES_OPENED', target: 30 },
        reward: { normalTickets: 30, premiumTickets: 5 },
        active: true,
        icon: '🎁'
      },
      {
        title: 'Explorador Veterano',
        description: 'Abra 75 caixas para desbloquear',
        type: 'ACHIEVEMENT',
        goal: { type: 'BOXES_OPENED', target: 75 },
        reward: { normalTickets: 50, premiumTickets: 15 },
        active: true,
        icon: '🎁'
      },
      {
        title: 'Explorador Lendário',
        description: 'Abra 150 caixas para desbloquear',
        type: 'ACHIEVEMENT',
        goal: { type: 'BOXES_OPENED', target: 150 },
        reward: { normalTickets: 75, premiumTickets: 25 },
        active: true,
        icon: '🎁'
      },
      // Missões de poder total
      {
        title: 'Poder Crescente',
        description: 'Atinja 5000 de poder total',
        type: 'ACHIEVEMENT',
        goal: { type: 'TOTAL_POWER', target: 5000 },
        reward: { normalTickets: 15, premiumTickets: 0 },
        active: true,
        icon: '⚡'
      },
      {
        title: 'Força Impressionante',
        description: 'Atinja 10000 de poder total',
        type: 'ACHIEVEMENT',
        goal: { type: 'TOTAL_POWER', target: 10000 },
        reward: { normalTickets: 30, premiumTickets: 10 },
        active: true,
        icon: '⚡'
      },
      {
        title: 'Potência Dominante',
        description: 'Atinja 20000 de poder total',
        type: 'ACHIEVEMENT',
        goal: { type: 'TOTAL_POWER', target: 20000 },
        reward: { normalTickets: 50, premiumTickets: 20 },
        active: true,
        icon: '⚡'
      },
      {
        title: 'Poder Infinito',
        description: 'Atinja 50000 de poder total',
        type: 'ACHIEVEMENT',
        goal: { type: 'TOTAL_POWER', target: 50000 },
        reward: { normalTickets: 100, premiumTickets: 50 },
        active: true,
        icon: '⚡'
      },
      // Missões de raridades específicas
      {
        title: 'Caçador de Raros',
        description: 'Ganhe 3 itens raros para desbloquear',
        type: 'ACHIEVEMENT',
        goal: { type: 'RARITY_COLLECTED', target: 3, rarity: 'RARO' },
        reward: { normalTickets: 10, premiumTickets: 0 },
        active: true,
        icon: '💎'
      },
      {
        title: 'Colecionador de Raros',
        description: 'Ganhe 10 itens raros para desbloquear',
        type: 'ACHIEVEMENT',
        goal: { type: 'RARITY_COLLECTED', target: 10, rarity: 'RARO' },
        reward: { normalTickets: 25, premiumTickets: 5 },
        active: true,
        icon: '💎'
      },
      {
        title: 'Caçador de Épicos',
        description: 'Ganhe 2 itens épicos para desbloquear',
        type: 'ACHIEVEMENT',
        goal: { type: 'RARITY_COLLECTED', target: 2, rarity: 'EPICO' },
        reward: { normalTickets: 20, premiumTickets: 5 },
        active: true,
        icon: '💜'
      },
      {
        title: 'Colecionador de Épicos',
        description: 'Ganhe 5 itens épicos para desbloquear',
        type: 'ACHIEVEMENT',
        goal: { type: 'RARITY_COLLECTED', target: 5, rarity: 'EPICO' },
        reward: { normalTickets: 40, premiumTickets: 15 },
        active: true,
        icon: '💜'
      },
      {
        title: 'Caçador de Lendários',
        description: 'Ganhe 3 itens lendários para desbloquear',
        type: 'ACHIEVEMENT',
        goal: { type: 'RARITY_COLLECTED', target: 3, rarity: 'LENDARIO' },
        reward: { normalTickets: 50, premiumTickets: 20 },
        active: true,
        icon: '🌟'
      },
      {
        title: 'Sortudo Supremo',
        description: 'Ganhe 1 item mítico para desbloquear',
        type: 'ACHIEVEMENT',
        goal: { type: 'RARITY_COLLECTED', target: 1, rarity: 'MITICO' },
        reward: { normalTickets: 100, premiumTickets: 50 },
        active: true,
        icon: '✨'
      },
      // Missões de amizades
      {
        title: 'Fazendo Amigos',
        description: 'Adicione 3 amigos para desbloquear',
        type: 'ACHIEVEMENT',
        goal: { type: 'FRIENDS_ADDED', target: 3 },
        reward: { normalTickets: 10, premiumTickets: 0 },
        active: true,
        icon: '👥'
      },
      {
        title: 'Círculo Social',
        description: 'Adicione 10 amigos para desbloquear',
        type: 'ACHIEVEMENT',
        goal: { type: 'FRIENDS_ADDED', target: 10 },
        reward: { normalTickets: 30, premiumTickets: 10 },
        active: true,
        icon: '👥'
      }
    ];

    const createdMissions = [];
    for (const mission of regularMissions) {
      const payload: any = { ...mission };
      payload.createdAt = admin.firestore.Timestamp.now();
      const docRef = await db.collection('missions').add(payload);
      createdMissions.push({ id: docRef.id, ...mission });
    }

    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'missionsChanged' });
    
    res.status(201).json({ 
      message: `${createdMissions.length} missões regulares criadas com sucesso`,
      missions: createdMissions 
    });
  } catch (error: any) {
    console.error('Erro ao criar missões regulares:', error);
    res.status(500).json({ error: 'Erro ao criar missões regulares' });
  }
});

export default router;
