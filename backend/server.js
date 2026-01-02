require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const http = require('http');
const { Server } = require('socket.io');

// Use environment variables for credentials (safer than file)
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Handle newlines
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`
  });
  console.log('Firebase Admin initialized with environment variables');
} else {
  console.warn('Firebase Admin not initialized: Missing environment variables (FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL)');
}

const app = express();
const PORT = process.env.PORT || 3000;

// HTTP server (necessário para Socket.IO)
const server = http.createServer(app);

// Socket.IO (tempo real entre usuários)
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log('[Socket.IO] Cliente conectado:', socket.id);
  socket.on('disconnect', () => {
    console.log('[Socket.IO] Cliente desconectado:', socket.id);
  });
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const itemRoutes = require('./routes/items');
const userItemRoutes = require('./routes/userItems');
const boxRoutes = require('./routes/boxes');
const missionRoutes = require('./routes/missions');
const rankingRoutes = require('./routes/rankings');
const storageRoutes = require('./routes/storage');
const tradeRoutes = require('./routes/trades');
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/userItems', userItemRoutes);
app.use('/api/boxes', boxRoutes);
app.use('/api/missions', missionRoutes);
app.use('/api/rankings', rankingRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/trades', tradeRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'GachArena Backend API' });
});

// Add more routes here as we migrate services

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});