const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

router.post('/', async (req, res) => {
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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/active', async (req, res) => {
  try {
    const snapshot = await admin.firestore().collection('boxes').where('active', '==', true).get();
    const boxes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(boxes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/by-type/:type', async (req, res) => {
  try {
    const type = req.params.type;
    const snapshot = await admin.firestore().collection('boxes')
      .where('active', '==', true)
      .where('type', '==', type)
      .get();
    const boxes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(boxes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const snapshot = await admin.firestore().collection('boxes').get();
    const boxes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(boxes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await admin.firestore().collection('boxes').doc(id).get();
    if (doc.exists) {
      res.json({ id: doc.id, ...doc.data() });
    } else {
      res.status(404).json({ error: 'Box not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body;
    await admin.firestore().collection('boxes').doc(id).update(data);
    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'boxesChanged' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await admin.firestore().collection('boxes').doc(id).delete();
    const io = req.app.get('io');
    io && io.emit('appEvent', { type: 'boxesChanged' });
    io && io.emit('appEvent', { type: 'itemsChanged' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;