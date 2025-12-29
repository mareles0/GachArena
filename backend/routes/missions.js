const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

// Get Firestore instance
const db = admin.firestore();

// CRUD Missões
router.post('/', async (req, res) => {
  try {
    const mission = req.body;
    const payload = { ...mission };
    delete payload.id;
    payload.createdAt = admin.firestore.Timestamp.now();

    const docRef = await db.collection('missions').add(payload);
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

    // Fetch mission to determine if it should auto-complete
    const missionDoc = await db.collection('missions').doc(missionId).get();
    const mission = missionDoc.data();
    const isAutoComplete = mission && mission.type === 'DAILY' && (mission.autoComplete === true || !mission.requirement || mission.requirement.trim() === '');

    const payload = {
      userId,
      missionId,
      progress: isAutoComplete ? 100 : 0,
      completed: isAutoComplete ? true : false,
      claimed: isAutoComplete ? true : false,
      claimedDays: [],
      nextAvailableAt: isAutoComplete ? null : admin.firestore.Timestamp.now(),
      createdAt: admin.firestore.Timestamp.now()
    };

    if (isAutoComplete) {
      payload.completedAt = admin.firestore.Timestamp.now();
    }

    const docRef = await db.collection('userMissions').add(payload);
    res.status(201).json({ id: docRef.id });
  } catch (error) {
    console.error('Erro ao iniciar missão:', error);
    res.status(500).json({ error: 'Erro ao iniciar missão' });
  }
});

router.put('/user-mission/:userMissionId/claim', async (req, res) => {
  try {
    await db.collection('userMissions').doc(req.params.userMissionId).update({
      claimed: true,
      claimedAt: admin.firestore.Timestamp.now()
    });
    res.json({ message: 'Missão coletada com sucesso' });
  } catch (error) {
    console.error('Erro ao marcar missão como coletada:', error);
    res.status(500).json({ error: 'Erro ao marcar missão como coletada' });
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

      if (claimedDays.includes(day)) {
        throw new Error('Dia já coletado');
      }

      // ensure day is the next available unclaimed day (sequential rule)
      const allDays = Array.from({ length: totalDays }, (_, i) => i + 1);
      const nextUnclaimed = allDays.find(d => !claimedDays.includes(d));
      if (nextUnclaimed !== day) {
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

      claimedDays.push(day);
      const progress = Math.round((claimedDays.length / totalDays) * 100);

      const updates = { claimedDays, progress };
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
  } catch (error) {
    console.error('Erro ao coletar dia:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/user-mission/:userMissionId/progress', async (req, res) => {
  try {
    const { progress } = req.body;
    await db.collection('userMissions').doc(req.params.userMissionId).update({ progress });
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
    res.json({ message: 'Missão completada com sucesso' });
  } catch (error) {
    console.error('Erro ao completar missão:', error);
    res.status(500).json({ error: 'Erro ao completar missão' });
  }
});

module.exports = router;