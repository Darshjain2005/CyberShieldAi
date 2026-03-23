import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

import apiRoutes from './routes/api.js';
import cveRoutes from './routes/cve.js';
import policyRoutes from './routes/policy.js';
import { initDB } from './db.js';

dotenv.config(); // ✅ FIXED (no path)

const app = express();
const httpServer = createServer(app);

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Attach socket instance to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use('/api', apiRoutes);
app.use('/api', cveRoutes);
app.use('/api', policyRoutes);

// Socket connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Port
const PORT = process.env.PORT || 5000;

// Start server after DB init
(async () => {
  await initDB();

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
})();