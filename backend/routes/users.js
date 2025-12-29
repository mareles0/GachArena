const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

// Save user data
router.post('/:uid', async (req, res) => {
  try {
    const uid = req.params.uid;
    const userData = req.body;
    await admin.firestore().collection('users').doc(uid).set(userData);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user data
router.get('/:uid', async (req, res) => {
  try {
    const uid = req.params.uid;
    const doc = await admin.firestore().collection('users').doc(uid).get();
    if (doc.exists) {
      res.json(doc.data());
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all users
router.get('/', async (req, res) => {
  try {
    const snapshot = await admin.firestore().collection('users').get();
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user
router.put('/:uid', async (req, res) => {
  try {
    const uid = req.params.uid;
    const data = req.body;
    await admin.firestore().collection('users').doc(uid).update(data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add tickets (delegate to ticket service logic, but for now simple)
router.post('/:uid/tickets', async (req, res) => {
  try {
    const uid = req.params.uid;
    const { amount, type } = req.body;
    // Assuming tickets are in user doc or separate
    // For simplicity, update user doc
    const increment = admin.firestore.FieldValue.increment(amount);
    const field = type === 'premium' ? 'premiumTickets' : 'normalTickets';
    await admin.firestore().collection('users').doc(uid).update({ [field]: increment });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Get user tickets
router.get('/:uid/tickets', async (req, res) => {
  try {
    const uid = req.params.uid;
    const doc = await admin.firestore().collection('users').doc(uid).get();
    if (doc.exists) {
      const data = doc.data();
      res.json({
        normalTickets: data.normalTickets || 0,
        premiumTickets: data.premiumTickets || 0
      });
    } else {
      res.json({ normalTickets: 0, premiumTickets: 0 });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Use ticket
router.post('/:uid/use-ticket', async (req, res) => {
  try {
    const uid = req.params.uid;
    const { type } = req.body;
    const docRef = admin.firestore().collection('users').doc(uid);
    const doc = await docRef.get();
    if (doc.exists) {
      const data = doc.data();
      const field = type === 'PREMIUM' ? 'premiumTickets' : 'normalTickets';
      if (data[field] > 0) {
        await docRef.update({ [field]: admin.firestore.FieldValue.increment(-1) });
        res.json({ success: true });
      } else {
        res.status(400).json({ error: 'Not enough tickets' });
      }
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;