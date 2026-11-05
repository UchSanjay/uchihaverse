// UchihaVerse - server.js
// Features: signup/login (JWT + hashed password), global room, private chat,
// online user list, admin panel (ban/unban, delete user, delete message, clear chat)
// Pehla register karne wala user ADMIN (owner) banta hai.

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production-please';
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], messages: [] }, null, 2));
  }
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { users: [], messages: [] }; }
}
function saveDB(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Login required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const db = loadDB();
    const user = db.users.find(u => u.username === payload.username);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.banned) return res.status(403).json({ error: 'Tum banned ho. Admin se contact karo.' });
    req.user = { username: user.username, role: user.role };
    next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Sirf admin ke liye hai' });
  next();
}
const publicUser = u => ({ username: u.username, role: u.role, banned: !!u.banned, createdAt: u.createdAt });

// ---------- Auth APIs ----------
app.post('/api/register', async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return res.status(400).json({ error: 'Username 3-20 characters, sirf letters/numbers/_ hona chahiye' });
  if (password.length < 6) return res.status(400).json({ error: 'Password kam se kam 6 characters ka rakho' });
  const db = loadDB();
  if (db.users.some(u => u.username === username)) return res.status(400).json({ error: 'Ye username pehle se taken hai' });
  const hash = await bcrypt.hash(password, 10);
  const isFirstUser = db.users.length === 0;
  const envAdmin = (process.env.ADMIN_USERNAME || '').toLowerCase();
  const role = (isFirstUser || username === envAdmin) ? 'admin' : 'user';
  const user = { username, passwordHash: hash, role, banned: false, createdAt: new Date().toISOString() };
  db.users.push(user); saveDB(db);
  const token = jwt.sign({ username, role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: publicUser(user), message: role === 'admin' ? 'Tum pehle user ho, isliye tum is website ke ADMIN / OWNER ho.' : 'Account ban gaya' });
});

app.post('/api/login', async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const db = loadDB();
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(400).json({ error: 'Galat username ya password' });
  if (user.banned) return res.status(403).json({ error: 'Tum banned ho. Admin se contact karo.' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(400).json({ error: 'Galat username ya password' });
  const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: publicUser(user) });
});

// ---------- User + Message APIs ----------
const online = new Map();
function onlineSet() { return new Set([...online.entries()].filter(([, s]) => s.size > 0).map(([u]) => u)); }

app.get('/api/users', auth, (req, res) => {
  const db = loadDB(); const on = onlineSet();
  res.json(db.users.filter(u => !u.banned).map(u => ({ username: u.username, role: u.role, online: on.has(u.username) })));
});

app.get('/api/messages', auth, (req, res) => {
  const peer = String(req.query.peer || '').trim().toLowerCase();
  const db = loadDB(); const me = req.user.username;
  let msgs;
  if (!peer || peer === 'global') msgs = db.messages.filter(m => !m.to);
  else msgs = db.messages.filter(m => (m.from === me && m.to === peer) || (m.from === peer && m.to === me));
  res.json(msgs.slice(-200));
});

// ---------- Admin APIs ----------
app.get('/api/admin/overview', auth, adminOnly, (req, res) => {
  const db = loadDB();
  res.json({ totalUsers: db.users.length, totalMessages: db.messages.length, users: db.users.map(publicUser), recentMessages: db.messages.slice(-100).reverse() });
});
app.post('/api/admin/ban', auth, adminOnly, (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  if (username === req.user.username) return res.status(400).json({ error: 'Khud ko ban nahi kar sakte' });
  const db = loadDB(); const u = db.users.find(x => x.username === username);
  if (!u) return res.status(404).json({ error: 'User nahi mila' });
  u.banned = !u.banned; saveDB(db); res.json({ ok: true, user: publicUser(u) });
});
app.post('/api/admin/delete-user', auth, adminOnly, (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  if (username === req.user.username) return res.status(400).json({ error: 'Khud ko delete nahi kar sakte' });
  const db = loadDB();
  db.users = db.users.filter(x => x.username !== username);
  db.messages = db.messages.filter(m => m.from !== username && m.to !== username);
  saveDB(db); res.json({ ok: true });
});
app.post('/api/admin/delete-message', auth, adminOnly, (req, res) => {
  const id = String(req.body.id || '');
  const db = loadDB(); db.messages = db.messages.filter(m => String(m.id) !== id); saveDB(db); res.json({ ok: true });
});
app.post('/api/admin/clear-global', auth, adminOnly, (req, res) => {
  const db = loadDB(); db.messages = db.messages.filter(m => m.to); saveDB(db);
  io.emit('chat_cleared', { peer: 'global' }); res.json({ ok: true });
});

// ---------- Socket.io (live chat) ----------
io.use((socket, next) => {
  try {
    const payload = jwt.verify(socket.handshake.auth.token, JWT_SECRET);
    const db = loadDB(); const user = db.users.find(u => u.username === payload.username);
    if (!user || user.banned) return next(new Error('unauthorized'));
    socket.username = user.username; socket.role = user.role; next();
  } catch { next(new Error('unauthorized')); }
});
io.on('connection', (socket) => {
  const me = socket.username;
  if (!online.has(me)) online.set(me, new Set());
  online.get(me).add(socket.id);
  broadcastUsers();
  socket.on('send_message', ({ to, text }) => {
    const clean = String(text || '').trim().slice(0, 2000);
    if (!clean) return;
    const db = loadDB();
    const msg = { id: Date.now() + '-' + Math.random().toString(36).slice(2, 8), from: me, to: to ? String(to).toLowerCase() : null, text: clean, at: new Date().toISOString() };
    db.messages.push(msg); saveDB(db);
    if (!msg.to) io.emit('new_message', msg);
    else {
      for (const [user, sockets] of online.entries()) {
        if (user === me || user === msg.to) sockets.forEach(sid => io.to(sid).emit('new_message', msg));
      }
    }
  });
  socket.on('disconnect', () => {
    if (online.has(me)) { online.get(me).delete(socket.id); if (online.get(me).size === 0) online.delete(me); }
    broadcastUsers();
  });
  function broadcastUsers() {
    const db = loadDB(); const on = onlineSet();
    io.emit('user_list', db.users.filter(u => !u.banned).map(u => ({ username: u.username, role: u.role, online: on.has(u.username) })));
  }
});

server.listen(PORT, () => console.log(`Chat website chal rahi hai: http://localhost:${PORT}`));
