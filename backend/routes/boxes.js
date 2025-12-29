const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

// Create box
router.post('/', async (req, res) => {
  try {
    const box = req.body;
    const boxData = {
      ...box,
      createdAt: new Date()
    };
    const docRef = await admin.firestore().collection('boxes').add(boxData);
    res.json({ id: docRef.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active boxes
router.get('/active', async (req, res) => {
  try {
    const snapshot = await admin.firestore().collection('boxes').where('active', '==', true).get();
    const boxes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(boxes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get boxes by type
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

// Get all boxes
router.get('/', async (req, res) => {
  try {
    const snapshot = await admin.firestore().collection('boxes').get();
    const boxes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(boxes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get box by id
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

// Update box
router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body;
    await admin.firestore().collection('boxes').doc(id).update(data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete box
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await admin.firestore().collection('boxes').doc(id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;