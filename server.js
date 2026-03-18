const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const { WebcastPushConnection } = require('tiktok-live-connector');

// ==========================================
// 1. DATA PWA (Biar bisa di-install di Chrome)
// ==========================================
const manifestJson = {
    "name": "Live Flag Race",
    "short_name": "FlagRace",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#0f172a",
    "theme_color": "#3b82f6",
    "icons": [{"src": "/icon.svg", "sizes": "512x512", "type": "image/svg+xml", "purpose": "any maskable"}]
};

const swJs = `
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(clients.claim()); });
self.addEventListener('fetch', (e) => { e.respondWith(fetch(e.request).catch(() => new Response('Offline'))); });
`;

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#3b82f6"/><text x="50%" y="50%" font-size="40" text-anchor="middle" dy=".3em" fill="#fff">🏁</text></svg>`;

app.get('/manifest.json', (req, res) => res.json(manifestJson));
app.get('/sw.js', (req, res) => { res.setHeader('Content-Type', 'application/javascript'); res.send(swJs); });
app.get('/icon.svg', (req, res) => { res.setHeader('Content-Type', 'image/svg+xml'); res.send(iconSvg); });

// ==========================================
// 2. TAMPILAN UI/UX (Frontend)
// ==========================================
const htmlPage = `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Live Bar Race Pro</title>
    <link rel="manifest" href="/manifest.json">
    <style>
        :root { --bg: #0f172a; --panel: #1e293b; --text: #f8fafc; --accent: #3b82f6; }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        body { background-color: var(--bg); color: var(--text); overflow: hidden; display: flex; flex-direction: column; height: 100vh; padding: 20px; }
        
        header { text-align: center; margin-bottom: 20px; }
        h1 { font-size: 24px; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 10px var(--accent); }
        .status { font-size: 12px; color: #94a3b8; margin-top: 5px; }
        .status span { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #ef4444; margin-right: 5px; box-shadow: 0 0 8px #ef4444; }
        .status.online span { background: #22c55e; box-shadow: 0 0 8px #22c55e; }

        .leaderboard { display: flex; flex-direction: column; gap: 12px; flex: 1; justify-content: center; }
        .row { display: flex; align-items: center; background: var(--panel); padding: 10px 15px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); transition: transform 0.3s ease; }
        
        .flag { font-size: 30px; min-width: 50px; text-align: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }
        .track-container { flex: 1; margin: 0 15px; background: #0f172a; border-radius: 20px; height: 24px; overflow: hidden; position: relative; box-shadow: inset 0 2px 4px rgba(0,0,0,0.5); }
        
        .bar { height: 100%; width: 3%; background: linear-gradient(90deg, #3b82f6, #60a5fa); border-radius: 20px; transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 0 10px rgba(59, 130, 246, 0.5); position: relative; }
        .bar::after { content: ''; position: absolute; top: 0; right: 0; bottom: 0; left: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent); animation: shimmer 2s infinite; }
        
        .score { font-size: 18px; font-weight: bold; min-width: 40px; text-align: right; color: #cbd5e1; }
        
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
    </style>
</head>
<body>
    <header>
        <h1>🏆 FLAG WAR RACE 🏆</h1>
        <div class="status" id="conn-status"><span></span>Menunggu Live Dimulai...</div>
    </header>

    <div class="leaderboard" id="board">
        </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        // Registrasi PWA (Biar bisa di-install)
        if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js'); }

        const socket = io();
        const board = document.getElementById('board');
        const statusEl = document.getElementById('conn-status');

        socket.on('status', (msg) => {
            if(msg === 'online') {
                statusEl.classList.add('online');
                statusEl.innerHTML = '<span></span>Live Tersambung!';
            } else {
                statusEl.classList.remove('online');
                statusEl.innerHTML = '<span></span>Menunggu Live...';
            }
        });

        socket.on('updateData', (topFlags) => {
            board.innerHTML = ''; // Bersihkan layar
            
            // Loop Top 6 Bendera
            topFlags.forEach((item, index) => {
                // Minimal 3%, Maksimal 100%
                let percentage = Math.max(3, Math.min(100, item.score)); 
                
                // Ganti warna bar sesuai ranking (Emas, Perak, Perunggu, Biru)
                let barColor = index === 0 ? 'linear-gradient(90deg, #eab308, #fef08a)' : 
                               index === 1 ? 'linear-gradient(90deg, #94a3b8, #e2e8f0)' : 
                               index === 2 ? 'linear-gradient(90deg, #b45309, #fcd34d)' : 
                               'linear-gradient(90deg, #3b82f6, #60a5fa)';

                const row = document.createElement('div');
                row.className = 'row';
                row.innerHTML = \`
                    <div class="flag">\${item.flag}</div>
                    <div class="track-container">
                        <div class="bar" style="width: \${percentage}%; background: \${barColor}"></div>
                    </div>
                    <div class="score">\${item.score}</div>
                \`;
                board.appendChild(row);
            });
        });
    </script>
</body>
</html>
`;

app.get('/', (req, res) => { res.send(htmlPage); });

// ==========================================
// 3. MESIN BACKEND & TIKTOK
// ==========================================
let tiktokUsername = "gamemodapkofficial";
let tiktokLiveConnection = new WebcastPushConnection(tiktokUsername);

let flagScores = {}; // Simpan skor bendera
const MAX_SCORE = 100;

// Regex untuk mendeteksi emoji bendera negara secara akurat
const flagRegex = /(?:\uD83C[\uDDE6-\uDDFF]){2}/g;

function getTop6() {
    // Ubah object ke array, urutkan dari terbesar, ambil 6 teratas
    return Object.keys(flagScores)
        .map(flag => ({ flag, score: flagScores[flag] }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);
}

// Fungsi koneksi cerdas (Bisa auto-reconnect walau web udah nyala)
function connectToTikTok() {
    tiktokLiveConnection.connect().then(state => {
        console.info(`✅ KONEK KE LIVE: ${state.roomInfo.owner.display_id}`);
        io.emit('status', 'online');
    }).catch(err => {
        console.error('⏳ Belum Live. Coba lagi 10 detik...');
        io.emit('status', 'offline');
        setTimeout(connectToTikTok, 10000); // Coba terus tiap 10 detik tanpa matiin server
    });
}

tiktokLiveConnection.on('chat', data => {
    let komen = data.comment;
    
    // Cari semua emoji bendera di komen
    let detectedFlags = komen.match(flagRegex);
    
    if (detectedFlags) {
        let isUpdated = false;
        
        // Tambah poin ke bendera yang dikomen
        detectedFlags.forEach(flag => {
            flagScores[flag] = (flagScores[flag] || 0) + 1;
            isUpdated = true;
            
            // Auto Reset kalau ada yang mentok 100
            if(flagScores[flag] >= MAX_SCORE) {
                setTimeout(() => { flagScores = {}; io.emit('updateData', []); }, 3000);
            }
        });

        // Kirim update 6 besar ke layar web
        if(isUpdated) {
            io.emit('updateData', getTop6());
        }
    }
});

tiktokLiveConnection.on('streamEnd', () => {
    console.log('🔴 Live Berakhir, mode standby...');
    io.emit('status', 'offline');
    setTimeout(connectToTikTok, 10000);
});

http.listen(3000, () => {
    console.log('\n=======================================');
    console.log('🚀 SERVER JALAN BOSKU!');
    console.log('👉 Buka Chrome/Safari, ketik: http://localhost:3000');
    console.log('👉 Web udah bisa di-Install ke Beranda!');
    console.log('👉 Kalau TikTok belum Live, server tetep aman standby.');
    console.log('=======================================\n');
    connectToTikTok(); // Mulai nyari live TikTok
});
