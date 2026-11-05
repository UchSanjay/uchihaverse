// UchihaVerse - Deno Deploy version (bilkul free, bina card, GitHub login se deploy)
// Ek hi file: website (HTML) + backend API + data (Deno KV storage)
// Chat har 2.5 second me refresh (polling) hoti hai.
// Pehla register karne wala user ADMIN / OWNER banta hai.

const HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>UchihaVerse</title>
<style>
*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
body{margin:0;background:#0e1621;color:#fff;min-height:100vh}.hidden{display:none!important}
.card{max-width:420px;margin:40px auto;background:#17212b;padding:24px;border-radius:16px}
.card input{width:100%;padding:12px;margin:8px 0;border-radius:10px;border:1px solid #2b5278;background:#0e1621;color:#fff}
button{background:#2b5278;color:#fff;border:0;padding:12px 16px;border-radius:10px;cursor:pointer;width:100%;margin-top:8px}
button.secondary{background:#242f3d}button.smallbtn{width:auto;padding:6px 10px}
.muted{color:#8a9ba8}.small{font-size:13px}.msg{color:#ffd166;min-height:20px}
.layout{display:flex;height:100vh}.sidebar{width:300px;background:#17212b;padding:16px;overflow:auto}
.main{flex:1;display:flex;flex-direction:column}.main header{padding:16px;background:#17212b;font-weight:700}
#messages{flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:8px}
.bubble{max-width:70%;padding:10px 12px;border-radius:14px;background:#182533}
.bubble.mine{align-self:flex-end;background:#2b5278}.bubble .from{font-size:12px;color:#8a9ba8;margin-bottom:4px}
#sendForm{display:flex;gap:8px;padding:12px;background:#17212b}
#sendForm input{flex:1;padding:12px;border-radius:10px;border:1px solid #2b5278;background:#0e1621;color:#fff}
#sendForm button{width:auto;margin:0}.userItem{padding:10px;border-radius:10px;cursor:pointer}
.userItem:hover,.userItem.active{background:#2b5278}
.me{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.badge{background:#ffd166;color:#000;padding:2px 7px;border-radius:999px;font-size:12px}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#666;margin-right:6px}.dot.on{background:#31d158}
#adminPanel{max-width:800px}#adminUsers div,#adminMessages div{padding:8px;border-bottom:1px solid #2b5278;display:flex;justify-content:space-between;gap:8px;align-items:center}
#adminUsers button,#adminMessages button{width:auto;padding:6px 10px;margin:0}
@media(max-width:700px){.sidebar{width:180px}.bubble{max-width:85%}}
</style></head><body>
<div id="authBox" class="card">
<h1>&#128172; UchihaVerse</h1>
<p class="muted">Account banao, login karo aur logo se chat karo - Telegram style</p>
<input id="username" placeholder="Username (jaise: rahul_01)" autocomplete="username"/>
<input id="password" type="password" placeholder="Password (kam se kam 6 characters)" autocomplete="current-password"/>
<button id="loginBtn">Login</button>
<button id="registerBtn" class="secondary">Naya Account Banao</button>
<p id="authMsg" class="msg"></p>
<p class="muted small">Note: Sabse pehle register karne wala hi is website ka Admin / Owner banta hai.</p>
</div>
<div id="chatBox" class="layout hidden">
<aside class="sidebar">
<div class="me"><div><strong id="meName"></strong> <span id="meRole" class="badge"></span></div><button id="logoutBtn" class="smallbtn">Logout</button></div>
<button id="adminBtn" class="secondary hidden">&#128737; Admin Panel</button>
<h3>Chats</h3>
<div id="globalItem" class="userItem active">&#127760; Global Room <span class="muted">(sabke saath)</span></div>
<div id="userList"></div>
</aside>
<main class="main">
<header id="chatTitle">&#127760; Global Room</header>
<div id="messages"></div>
<form id="sendForm"><input id="msgInput" placeholder="Message likho..." autocomplete="off"/><button type="submit">Send</button></form>
</main></div>
<div id="adminPanel" class="card hidden">
<h2>&#128737; Admin Panel</h2><p id="adminStats" class="muted"></p>
<button id="clearGlobalBtn" class="secondary">Global chat clear karo</button>
<button id="closeAdminBtn" class="secondary">Band karo</button>
<h3>Users</h3><div id="adminUsers"></div>
<h3>Recent Messages</h3><div id="adminMessages"></div>
</div>
<script>
var token = localStorage.getItem('token') || '';
var me = null; try { me = JSON.parse(localStorage.getItem('me') || 'null'); } catch(e) {}
var currentPeer = 'global'; var lastMsgKey = ''; var timer = null;
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function api(path, options){
  options = options || {}; options.headers = { 'Content-Type':'application/json', 'Authorization':'Bearer ' + token };
  return fetch(path, options).then(function(r){ return r.json().catch(function(){return {};}).then(function(d){ if(!r.ok) throw new Error(d.error || 'Error'); return d; }); });
}
function doAuth(ep){
  $('authMsg').textContent = '';
  fetch(ep, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: $('username').value, password: $('password').value }) })
  .then(function(r){ return r.json().then(function(d){ if(!r.ok) throw new Error(d.error || 'Error'); return d; }); })
  .then(function(d){ token = d.token; me = d.user; localStorage.setItem('token', token); localStorage.setItem('me', JSON.stringify(me)); if(d.message) alert(d.message); showChat(); })
  .catch(function(e){ $('authMsg').textContent = e.message; });
}
$('loginBtn').onclick = function(){ doAuth('/api/login'); };
$('registerBtn').onclick = function(){ doAuth('/api/register'); };
$('logoutBtn').onclick = function(){ localStorage.clear(); location.reload(); };
function showChat(){
  if(!token || !me) return;
  $('authBox').classList.add('hidden'); $('chatBox').classList.remove('hidden');
  $('meName').textContent = '@' + me.username;
  $('meRole').textContent = me.role === 'admin' ? 'ADMIN / OWNER' : '';
  if(me.role === 'admin') $('adminBtn').classList.remove('hidden');
  refresh();
  if(timer) clearInterval(timer);
  timer = setInterval(refresh, 2500);
}
function refresh(){ loadUsers(); loadMessages(); }
function loadUsers(){ api('/api/users').then(renderUsers).catch(function(){}); }
function renderUsers(users){
  var box = $('userList'); box.innerHTML = '';
  users.forEach(function(u){
    if(u.username === me.username) return;
    var d = document.createElement('div');
    d.className = 'userItem' + (currentPeer === u.username ? ' active' : '');
    d.innerHTML = '<span class="dot' + (u.online ? ' on' : '') + '"></span>@' + esc(u.username) + (u.role === 'admin' ? ' &#128081;' : '');
    d.onclick = (function(name){ return function(){ selectPeer(name); }; })(u.username);
    box.appendChild(d);
  });
}
$('globalItem').onclick = function(){ selectPeer('global'); };
function selectPeer(p){ currentPeer = p; lastMsgKey=''; $('chatTitle').textContent = p === 'global' ? 'Global Room' : '@' + p; loadMessages(); loadUsers(); }
function loadMessages(){
  api('/api/messages?peer=' + encodeURIComponent(currentPeer)).then(function(msgs){
    var key = msgs.length ? msgs[msgs.length-1].id + ':' + msgs.length : '0';
    if(key === lastMsgKey) return; lastMsgKey = key;
    $('messages').innerHTML = ''; msgs.forEach(addBubble);
  }).catch(function(){});
}
function addBubble(m){
  var d = document.createElement('div');
  d.className = 'bubble' + (m.from === me.username ? ' mine' : '');
  d.innerHTML = '<div class="from">@' + esc(m.from) + ' - ' + new Date(m.at).toLocaleTimeString() + '</div>' + esc(m.text);
  $('messages').appendChild(d); $('messages').scrollTop = $('messages').scrollHeight;
}
$('sendForm').onsubmit = function(e){
  e.preventDefault(); var text = $('msgInput').value.trim(); if(!text) return; $('msgInput').value='';
  api('/api/send', { method:'POST', body: JSON.stringify({ to: currentPeer === 'global' ? null : currentPeer, text: text }) }).then(function(){ lastMsgKey=''; loadMessages(); }).catch(function(err){ alert(err.message); });
};
$('adminBtn').onclick = function(){
  $('adminPanel').classList.remove('hidden');
  api('/api/admin/overview').then(function(data){
    $('adminStats').textContent = 'Total users: ' + data.totalUsers + ' - Total messages: ' + data.totalMessages;
    var ub = $('adminUsers'); ub.innerHTML = '';
    data.users.forEach(function(u){
      var row = document.createElement('div');
      row.innerHTML = '<span>@' + esc(u.username) + ' (' + u.role + ')' + (u.banned ? ' - BANNED' : '') + '</span>';
      var wrap = document.createElement('span');
      var b1 = document.createElement('button'); b1.textContent = u.banned ? 'Unban' : 'Ban';
      b1.onclick = function(){ api('/api/admin/ban', { method:'POST', body: JSON.stringify({ username: u.username }) }).then(function(){ $('adminBtn').click(); }); };
      var b2 = document.createElement('button'); b2.textContent = 'Delete';
      b2.onclick = function(){ if(confirm('User delete karna hai?')) api('/api/admin/delete-user', { method:'POST', body: JSON.stringify({ username: u.username }) }).then(function(){ $('adminBtn').click(); }); };
      wrap.appendChild(b1); wrap.appendChild(b2); row.appendChild(wrap); ub.appendChild(row);
    });
    var mb = $('adminMessages'); mb.innerHTML = '';
    data.recentMessages.forEach(function(m){
      var row = document.createElement('div');
      row.innerHTML = '<span><b>@' + esc(m.from) + '</b>' + (m.to ? ' to @' + esc(m.to) : ' (global)') + ': ' + esc(m.text.slice(0,60)) + '</span>';
      var b = document.createElement('button'); b.textContent = 'Delete';
      b.onclick = function(){ api('/api/admin/delete-message', { method:'POST', body: JSON.stringify({ id: m.id }) }).then(function(){ $('adminBtn').click(); }); };
      row.appendChild(b); mb.appendChild(row);
    });
  });
};
$('closeAdminBtn').onclick = function(){ $('adminPanel').classList.add('hidden'); };
$('clearGlobalBtn').onclick = function(){ if(confirm('Global chat clear karna hai?')) api('/api/admin/clear-global', { method:'POST', body:'{}' }); };
if(token && me) showChat();
</script></body></html>`;

function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { "Content-Type": "application/json" } });
}
function hex(buf) { return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join(""); }
function b64(s) { return btoa(unescape(encodeURIComponent(s))); }

const kv = await Deno.openKv();
async function getSecret() {
  const e = await kv.get(["meta", "secret"]);
  if (e.value) return e.value;
  const s = hex(crypto.getRandomValues(new Uint8Array(32)));
  await kv.set(["meta", "secret"], s);
  return s;
}
const SECRET = await getSecret();

async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
  return hex(bits);
}
async function sign(payload) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
}
async function makeToken(username, role) {
  const payload = username + "|" + role + "|" + (Date.now() + 7 * 24 * 3600 * 1000);
  return b64(payload) + "." + (await sign(payload));
}
async function getUser(username) {
  const e = await kv.get(["users", username]);
  return e.value || null;
}
async function listUsers() {
  const out = [];
  for await (const e of kv.list({ prefix: ["users"] })) out.push(e.value);
  return out;
}
async function listMessages() {
  const out = [];
  for await (const e of kv.list({ prefix: ["messages"] })) out.push(e.value);
  return out;
}
function publicUser(u) { return { username: u.username, role: u.role, banned: !!u.banned, createdAt: u.createdAt }; }
async function authUser(req) {
  const h = req.headers.get("Authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  let payload;
  try { payload = decodeURIComponent(escape(atob(parts[0]))); } catch { return null; }
  if ((await sign(payload)) !== parts[1]) return null;
  const [username, , exp] = payload.split("|");
  if (Date.now() > Number(exp)) return null;
  const user = await getUser(username);
  if (!user || user.banned) return null;
  return user;
}

async function handler(req) {
  const url = new URL(req.url);
  const path = url.pathname;
  if (path === "/" || path === "/index.html") {
    return new Response(HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  if (!path.startsWith("/api/")) return new Response("Not found", { status: 404 });
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

  if (path === "/api/register" && req.method === "POST") {
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return json({ error: "Username 3-20 characters, sirf letters/numbers/_ hona chahiye" }, 400);
    if (password.length < 6) return json({ error: "Password kam se kam 6 characters ka rakho" }, 400);
    if (await getUser(username)) return json({ error: "Ye username pehle se taken hai" }, 400);
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await hashPassword(password, salt);
    const all = await listUsers();
    const role = all.length === 0 ? "admin" : "user";
    const user = { username, salt, hash, role, banned: false, createdAt: new Date().toISOString(), lastSeen: Date.now() };
    await kv.set(["users", username], user);
    const token = await makeToken(username, role);
    return json({ token, user: publicUser(user), message: role === "admin" ? "Tum pehle user ho, isliye tum is website ke ADMIN / OWNER ho." : "Account ban gaya" });
  }
  if (path === "/api/login" && req.method === "POST") {
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    const user = await getUser(username);
    if (!user) return json({ error: "Galat username ya password" }, 400);
    if (user.banned) return json({ error: "Tum banned ho. Admin se contact karo." }, 403);
    if ((await hashPassword(password, user.salt)) !== user.hash) return json({ error: "Galat username ya password" }, 400);
    user.lastSeen = Date.now();
    await kv.set(["users", username], user);
    const token = await makeToken(user.username, user.role);
    return json({ token, user: publicUser(user) });
  }

  const me = await authUser(req);
  if (!me) return json({ error: "Login required" }, 401);
  if (Math.abs((me.lastSeen || 0) - Date.now()) > 10000) { me.lastSeen = Date.now(); await kv.set(["users", me.username], me); }
  const isOnline = u => Date.now() - (u.lastSeen || 0) < 20000;

  if (path === "/api/users") {
    const all = await listUsers();
    return json(all.filter(u => !u.banned).map(u => ({ username: u.username, role: u.role, online: isOnline(u) })));
  }
  if (path === "/api/messages") {
    const peer = String(url.searchParams.get("peer") || "").toLowerCase();
    const all = await listMessages();
    const list = (!peer || peer === "global") ? all.filter(m => !m.to) : all.filter(m => (m.from === me.username && m.to === peer) || (m.from === peer && m.to === me.username));
    return json(list.slice(-200));
  }
  if (path === "/api/send" && req.method === "POST") {
    const text = String(body.text || "").trim().slice(0, 2000);
    if (!text) return json({ error: "Message khali hai" }, 400);
    const id = String(Date.now()).padStart(15, "0") + "-" + Math.random().toString(36).slice(2, 8);
    const msg = { id, from: me.username, to: body.to ? String(body.to).toLowerCase() : null, text, at: new Date().toISOString() };
    await kv.set(["messages", id], msg);
    return json({ ok: true, message: msg });
  }
  if (path.startsWith("/api/admin/")) {
    if (me.role !== "admin") return json({ error: "Sirf admin ke liye hai" }, 403);
    if (path === "/api/admin/overview") {
      const all = await listUsers();
      const msgs = await listMessages();
      return json({ totalUsers: all.length, totalMessages: msgs.length, users: all.map(publicUser), recentMessages: msgs.slice(-100).reverse() });
    }
    if (path === "/api/admin/ban") {
      const u = await getUser(String(body.username || "").toLowerCase());
      if (!u) return json({ error: "User nahi mila" }, 404);
      if (u.username === me.username) return json({ error: "Khud ko ban nahi kar sakte" }, 400);
      u.banned = !u.banned;
      await kv.set(["users", u.username], u);
      return json({ ok: true, user: publicUser(u) });
    }
    if (path === "/api/admin/delete-user") {
      const name = String(body.username || "").toLowerCase();
      if (name === me.username) return json({ error: "Khud ko delete nahi kar sakte" }, 400);
      await kv.delete(["users", name]);
      const msgs = await listMessages();
      for (const m of msgs) if (m.from === name || m.to === name) await kv.delete(["messages", m.id]);
      return json({ ok: true });
    }
    if (path === "/api/admin/delete-message") {
      await kv.delete(["messages", String(body.id || "")]);
      return json({ ok: true });
    }
    if (path === "/api/admin/clear-global") {
      const msgs = await listMessages();
      for (const m of msgs) if (!m.to) await kv.delete(["messages", m.id]);
      return json({ ok: true });
    }
  }
  return json({ error: "Not found" }, 404);
}

const port = Deno.env.get("PORT");
if (port) Deno.serve({ port: Number(port) }, handler);
else Deno.serve(handler);
