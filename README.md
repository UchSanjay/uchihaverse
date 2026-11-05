# UchihaVerse — Chat Website

Telegram style ki chat website: log account banate hain, login karte hain, Global Room me sabse aur kisi bhi user se private chat kar sakte hain. Real-time chat Socket.io se chalti hai.

## Sabse important baat — Admin / Owner kaun hai?
**Sabse pehle register karne wala user hi Admin / Owner banta hai.**
Isliye deploy karte hi sabse pehle TUM apna account banao. Uske baad jo log aayenge wo normal user honge.

## Admin Panel se tum kya control kar sakte ho?
Login karne ke baad agar tum admin ho, to tumhe **Admin Panel** button dikhega. Usme:
- Total kitne users hain, kitne messages hain — dekh sakte ho
- Kisi bhi user ko **Ban / Unban** kar sakte ho (banned user login/chat nahi kar payega)
- Kisi user ko **Delete** kar sakte ho (uske messages bhi delete ho jayenge)
- Koi bhi **galat message delete** kar sakte ho
- **Global chat clear** kar sakte ho

## Local me kaise chalaye
1. Node.js 18+ install hona chahiye
2. Is folder me: npm install, phir npm start
3. Browser me kholo: http://localhost:3000
4. Pehla account banao — wahi admin hoga.

## Free me Publish / Deploy — Render
Note: `.etc` koi real domain extension nahi hai. Website ka naam **UchihaVerse** rakha hai. Free deploy par address milega: `uchihaverse.onrender.com` (agar available ho).
Steps: GitHub par repo banao aur files upload karo. Render.com par Sign up with GitHub karo. New Web Service / Blueprint se uchihaverse repo select karo. Build Command: `npm install`, Start Command: `npm start`, Instance Type: Free, Environment Variable JWT_SECRET = lamba random text. Create Web Service par click karo, deploy ke baad mile hue link ko kholke sabse pehle apna account register karo taaki tum Admin/Owner bano.

## Ek limitation
Render free plan par server so sakta hai aur restart par data/db.json reset ho sakti hai — free version shuruaat ke liye hai. Hamesha ke data ke liye baad me MongoDB Atlas jod sakte hain.

## Files
- `server.js` — backend: login/signup, chat, admin APIs
- `public/` — website design + chat screen
- `render.yaml` — Render deploy settings
