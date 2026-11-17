/**
 * Server Entrypoint with HTTP & Socket.IO
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { validateEnv } = require('./config/envValidator');
validateEnv();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { initSocket } = require('./sockets/socketHandler');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow mobile, server-to-server, localhost, or deployment origins
      if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
      if (
        origin.endsWith('.vercel.app') ||
        origin.endsWith('.netlify.app') ||
        origin.endsWith('.onrender.com') ||
        origin.endsWith('.railway.app') ||
        origin === process.env.FRONTEND_URL
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Allow gracefully for real-time notifications
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

initSocket(io);

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Property Marketplace Express API running on port ${PORT}`);
  console.log(`📡 WebSocket / Socket.IO active`);
  console.log(`====================================================`);
});
