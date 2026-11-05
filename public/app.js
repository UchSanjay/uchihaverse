let token = localStorage.getItem('token') || '';
let me = JSON.parse(localStorage.getItem('me') || 'null');
let socket = null;
let currentPeer = 'global';
const $ = id => document.getElementById(id);
async function api(path, options = {}) {
  const res = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Kuch galat ho gaya');
  return data;
}
async function doAuth(endpoint) {
  $('authMsg').textContent = '';
  try {
    const data = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: $('username').value, password: $('password').value }) }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Error'); return d; });
    token = data.token; me = data.user;
    localStorage.setItem('token', token); localStorage.setItem('me', JSON.stringify(me));
    if (data.message) alert(data.message);
    showChat();
  } catch (e) { $('authMsg').textContent = e.message; }
}
$('loginBtn').onclick = () => doAuth('/api/login');
$('registerBtn').onclick = () => doAuth('/api/register');
$('logoutBtn').onclick = () => { localStorage.clear(); location.reload(); };
function showChat() {
  if (!token || !me) return;
  $('authBox').classList.add('hidden');
  $('chatBox').classList.remove('hidden');
  $('meName').textContent = '@' + me.username;
  $('meRole').textContent = me.role === 'admin' ? 'ADMIN / OWNER' : '';
  if (me.role === 'admin') $('adminBtn').classList.remove('hidden');
  connectSocket(); loadUsers(); loadMessages();
}
function connectSocket() {
  socket = io({ auth: { token } });
  socket.on('new_message', msg => {
    const peerForMsg = msg.to ? (msg.from === me.username ? msg.to : msg.from) : 'global';
    if (peerForMsg === currentPeer) addBubble(msg);
  });
  socket.on('user_list', renderUsers);
  socket.on('chat_cleared', () => { if (currentPeer === 'global') $('messages').innerHTML = ''; });
}
async function loadUsers() { try { renderUsers(await api('/api/users')); } catch {} }
function renderUsers(users) {
  const box = $('userList'); box.innerHTML = '';
  users.filter(u => u.username !== me.username).forEach(u => {
    const d = document.createElement('div');
    d.className = 'userItem' + (currentPeer === u.username ? ' active' : '');
    d.innerHTML = `<span class="dot ${u.online ? 'on' : ''}"></span>@${u.username} ${u.role === 'admin' ? '👑' : ''}`;
    d.onclick = () => selectPeer(u.username);
    box.appendChild(d);
  });
}
$('globalItem').onclick = () => selectPeer('global');
function selectPeer(peer) {
  currentPeer = peer;
  $('chatTitle').textContent = peer === 'global' ? '🌐 Global Room' : '💬 @' + peer;
  document.querySelectorAll('.userItem').forEach(el => el.classList.remove('active'));
  if (peer === 'global') $('globalItem').classList.add('active');
  loadMessages(); loadUsers();
}
async function loadMessages() {
  try {
    const msgs = await api('/api/messages?peer=' + encodeURIComponent(currentPeer));
    $('messages').innerHTML = ''; msgs.forEach(addBubble);
  } catch {}
}
function addBubble(m) {
  const d = document.createElement('div');
  d.className = 'bubble' + (m.from === me.username ? ' mine' : '');
  d.innerHTML = `<div class="from">@${escapeHtml(m.from)} • ${new Date(m.at).toLocaleTimeString()}</div>${escapeHtml(m.text)}`;
  $('messages').appendChild(d); $('messages').scrollTop = $('messages').scrollHeight;
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
$('sendForm').onsubmit = e => {
  e.preventDefault();
  const text = $('msgInput').value.trim(); if (!text || !socket) return;
  socket.emit('send_message', { to: currentPeer === 'global' ? null : currentPeer, text });
  $('msgInput').value = '';
};
$('adminBtn').onclick = async () => {
  $('adminPanel').classList.remove('hidden');
  const data = await api('/api/admin/overview');
  $('adminStats').textContent = `Total users: ${data.totalUsers} • Total messages: ${data.totalMessages}`;
  const ub = $('adminUsers'); ub.innerHTML = '';
  data.users.forEach(u => {
    const row = document.createElement('div');
    row.innerHTML = `<span>@${u.username} (${u.role}) ${u.banned ? '— BANNED' : ''}</span>`;
    const b1 = document.createElement('button'); b1.textContent = u.banned ? 'Unban' : 'Ban';
    b1.onclick = async () => { await api('/api/admin/ban', { method: 'POST', body: JSON.stringify({ username: u.username }) }); $('adminBtn').click(); };
    const b2 = document.createElement('button'); b2.textContent = 'Delete';
    b2.onclick = async () => { if (confirm('User delete karna hai?')) { await api('/api/admin/delete-user', { method: 'POST', body: JSON.stringify({ username: u.username }) }); $('adminBtn').click(); } };
    const wrap = document.createElement('span'); wrap.append(b1, b2); row.appendChild(wrap); ub.appendChild(row);
  });
  const mb = $('adminMessages'); mb.innerHTML = '';
  data.recentMessages.forEach(m => {
    const row = document.createElement('div');
    row.innerHTML = `<span><b>@${escapeHtml(m.from)}</b>${m.to ? ' → @' + escapeHtml(m.to) : ' (global)'}: ${escapeHtml(m.text.slice(0, 60))}</span>`;
    const b = document.createElement('button'); b.textContent = 'Delete';
    b.onclick = async () => { await api('/api/admin/delete-message', { method: 'POST', body: JSON.stringify({ id: m.id }) }); $('adminBtn').click(); };
    row.appendChild(b); mb.appendChild(row);
  });
};
$('closeAdminBtn').onclick = () => $('adminPanel').classList.add('hidden');
$('clearGlobalBtn').onclick = async () => { if (confirm('Global chat clear karna hai?')) await api('/api/admin/clear-global', { method: 'POST', body: '{}' }); };
if (token && me) showChat();
