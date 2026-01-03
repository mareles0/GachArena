const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const item = req.body;
    const itemData = {
      ...item,
      createdAt: new Date()
    };
    const docRef = await admin.firestore().collection('items').add(itemData);
    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'itemsChanged' });
    res.json({ id: docRef.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const snapshot = await admin.firestore().collection('items').get();
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      points: doc.data().points ?? 0
    }));
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/by-box/:boxId', async (req, res) => {
  try {
    const boxId = req.params.boxId;
    const snapshot = await admin.firestore().collection('items').where('boxId', '==', boxId).get();
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      points: doc.data().points ?? 0
    }));
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await admin.firestore().collection('items').doc(id).get();
    if (doc.exists) {
      res.json({
        id: doc.id,
        ...doc.data(),
        points: doc.data().points ?? 0
      });
    } else {
      res.status(404).json({ error: 'Item not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body;
    await admin.firestore().collection('items').doc(id).update(data);
    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'itemsChanged' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await admin.firestore().collection('items').doc(id).delete();
    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'itemsChanged' });
    res.json({ success: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;