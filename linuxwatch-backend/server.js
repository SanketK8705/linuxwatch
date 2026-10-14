require('dotenv').config();
const express = require('express');
const http = require('http');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const pool = require('./db');

const app = express();
const server = http.createServer(app);

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

const io = new Server(server, {
  cors: { origin: FRONTEND_ORIGIN, methods: ['GET', 'POST'], credentials: true },
});

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '32kb' }));

const { router: alertsRouter, setIO } = require('./routes/alerts');
const authRouter = require('./routes/auth');
const aiRouter = require('./routes/ai');
const usersRouter = require('./routes/users');
const { authLimiter } = require('./middleware/rateLimit');
const webSecurityMiddleware = require('./middleware/webSecurity');

const JWT_SECRET = process.env.JWT_SECRET || 'linuxwatch_secret';

io.use(async (socket, next) => {
  try {
    const authHeader = socket.handshake.headers.authorization;
    const cookieHeader = socket.handshake.headers.cookie || '';
    const cookieToken = cookieHeader.match(/(?:^|;\s*)lw_token=([^;]+)/)?.[1];
    const token = socket.handshake.auth?.token
      || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null)
      || cookieToken;
    if (!token) return next(new Error('Unauthorized'));

    const payload = jwt.verify(token, JWT_SECRET);
    const result = await pool.query('SELECT id, username, role FROM users WHERE id=$1', [payload.id]);
    if (!result.rows.length) return next(new Error('Unauthorized'));
    socket.user = result.rows[0];
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

setIO(io);
authRouter.setIO(io);

app.use(webSecurityMiddleware(() => io));
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', authRouter);
app.use('/api/ai', aiRouter);
app.use('/api/users', usersRouter);
app.use('/api', alertsRouter);

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id} user=${socket.user.id}`);
  socket.join(`user_${socket.user.id}`);
  socket.on('join_room', () => {
    // The authenticated socket identity, never client input, selects the room.
    socket.join(`user_${socket.user.id}`);
  });
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`LinuxWatch backend running on port ${PORT}`));
