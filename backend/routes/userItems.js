const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

router.get('/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const snapshot = await admin.firestore().collection('userItems').where('userId', '==', userId).get();
    const userItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(userItems);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await admin.firestore().collection('userItems').doc(id).get();
    if (doc.exists) {
      res.json({ id: doc.id, ...doc.data() });
    } else {
      res.status(404).json({ error: 'User item not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body;
    await admin.firestore().collection('userItems').doc(id).update(data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await admin.firestore().collection('userItems').doc(id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/remove', async (req, res) => {
  try {
    const id = req.params.id;
    const { quantity } = req.body;
    const docRef = admin.firestore().collection('userItems').doc(id);
    const doc = await docRef.get();
    if (doc.exists) {
      const data = doc.data();
      if (data.quantity > quantity) {
        await docRef.update({ quantity: data.quantity - quantity });
      } else {
        await docRef.delete();
      }
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;