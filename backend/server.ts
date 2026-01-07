import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import http from 'http';
import { Server } from 'socket.io';

import {
  attachIsAdmin,
  authenticateFirebaseToken,
  requireAdmin,
  type AuthedRequest
} from './middleware/firebaseAuth';

if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
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

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:4200',
      'https://gacharena-bd17c.web.app',
      'https://gacharena-bd17c.firebaseapp.com'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log('[Socket.IO] Cliente conectado:', socket.id);
  socket.on('disconnect', () => {
    console.log('[Socket.IO] Cliente desconectado:', socket.id);
  });
});

app.use(cors({
  origin: [
    'http://localhost:4200',
    'https://gacharena-bd17c.web.app',
    'https://gacharena-bd17c.firebaseapp.com'
  ],
  credentials: true
}));
app.use(express.json());

// Health
app.get('/', (req, res) => {
  res.json({ message: 'GachArena Backend API' });
});

// Health check for trade-up (no auth) to help debug 404s
app.get('/tradeup-health', (req, res) => {
  res.json({ status: 'ok', msg: 'tradeUp route module loaded (no auth)' });
});

// Auth middleware: todas as rotas /api exigem token Firebase.
app.use('/api', authenticateFirebaseToken, attachIsAdmin);

// Carrega rotas (TS)
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import itemRoutes from './routes/items';
import userItemRoutes from './routes/userItems';
import boxRoutes from './routes/boxes';
import missionRoutes from './routes/missions';
import rankingRoutes from './routes/rankings';
import storageRoutes from './routes/storage';
import tradeRoutes from './routes/trades';
import tradeUpRoutes from './routes/tradeUp';

// Regras de acesso para /users
app.use('/api/users', (req: AuthedRequest, res, next) => {
  const path = req.path || '';

  // GET /users => admin only (listar todos os usuários)
  if (req.method === 'GET' && (path === '/' || path === '')) {
    return requireAdmin(req, res, next);
  }

  // POST /:uid/tickets => admin only (adicionar tickets)
  if (req.method === 'POST' && path.includes('/tickets')) {
    return requireAdmin(req, res, next);
  }

  // Tudo o resto é permitido para jogadores autenticados
  return next();
}, userRoutes);

// Itens: CRUD admin apenas, leitura permitida para jogadores
app.use('/api/items', (req: AuthedRequest, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    return requireAdmin(req, res, next);
  }
  return next();
}, itemRoutes);

// Boxes: CRUD admin apenas, leitura e open-multiple permitidos para jogadores
app.use('/api/boxes', (req: AuthedRequest, res, next) => {
  const path = req.path || '';
  
  // POST /open-multiple é permitido para todos
  if (req.method === 'POST' && path.includes('open-multiple')) {
    return next();
  }
  
  // PUT/DELETE sempre admin
  if (['PUT', 'DELETE'].includes(req.method)) {
    return requireAdmin(req, res, next);
  }
  
  // Outros POSTs (criar box) admin apenas
  if (req.method === 'POST') {
    return requireAdmin(req, res, next);
  }
  
  return next();
}, boxRoutes);

// userItems, missions, rankings, storage, trades: tudo permitido para jogadores autenticados
app.use('/api/userItems', userItemRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/missions', missionRoutes);
app.use('/api/rankings', rankingRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/tradeUp', tradeUpRoutes);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
