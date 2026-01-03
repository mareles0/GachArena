const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

router.get('/profile/:uid', async (req, res) => {
  try {
    const uid = req.params.uid;
    const userRecord = await admin.auth().getUser(uid);
    res.json(userRecord);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;