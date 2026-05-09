const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'http://localhost:3000', methods: ['GET', 'POST'] }
});

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

const { router: alertsRouter, setIO } = require('./routes/alerts');
const authRouter = require('./routes/auth');

setIO(io);

app.use('/api', alertsRouter);
app.use('/api/auth', authRouter);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Frontend emits join_room with userId right after connecting
  socket.on('join_room', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`Socket ${socket.id} joined room user_${userId}`);
  });

  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`LinuxWatch backend running on port ${PORT}`));