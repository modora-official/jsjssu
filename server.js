const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const { WebcastPushConnection } = require('tiktok-live-connector');

// ==========================================
// 1. DATA PWA
// ==========================================
const manifestJson = {
    "name": "Live Flag Race", "short_name": "FlagRace", "start_url": "/", "display": "fullscreen",
    "orientation": "landscape", "background_color": "#09090b", "theme_color": "#3b82f6"
};
app.get('/manifest.json', (req, res) => res.json(manifestJson));

// ==========================================
// 2. TAMPILAN UI/UX PRO (Frontend)
// ==========================================
const htmlPage = `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Live Bar Race Pro</title>
    <link rel="manifest" href="/manifest.json">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root { --bg: #09090b; --panel: #18181b; --text: #f8fafc; --accent: #3b82f6; }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
        body { background-color: var(--bg); color: var(--text); overflow: hidden; height: 100vh; width: 100vw; display: flex; }
        
        /* OVERLAY SETUP */
        #setup-screen { position: absolute; inset: 0; background: rgba(0,0,0,0.9); z-index: 999; display: flex; flex-direction: column; align-items: center; justify-content: center; backdrop-filter: blur(10px); }
        .setup-box { background: var(--panel); padding: 30px; border-radius: 15px; text-align: center; border: 1px solid #333; box-shadow: 0 0 20px rgba(59,130,246,0.3); }
        .setup-box h2 { margin-bottom: 20px; color: #fff; }
        input { padding: 12px 20px; font-size: 16px; border-radius: 8px; border: 1px solid #444; background: #222; color: #fff; width: 100%; margin-bottom: 15px; text-align: center; }
        button { background: linear-gradient(90deg, #3b82f6, #2563eb); color: white; border: none; padding: 12px 20px; font-size: 16px; font-weight: bold; border-radius: 8px; cursor: pointer; width: 100%; text-transform: uppercase; }
        
        /* AREA GAME UTAMA (Lanskap Terbagi 2) */
        #game-screen { display: none; width: 100%; height: 100%; padding: 15px; gap: 20px; }
        
        /* KIRI: AREA BENDERA (Tengah Sempurna) */
        .left-panel { flex: 2; display: flex; flex-direction: column; justify-content: center; align-items: center; background: rgba(24, 24, 27, 0.4); border-radius: 15px; padding: 20px; border: 1px solid #222; }
        .left-panel header { text-align: center; margin-bottom: 30px; width: 100%; }
        h1 { font-size: 28px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 15px var(--accent); color: #fff; display: flex; align-items: center; justify-content: center; gap: 15px; }
        h1 i { color: #eab308; text-shadow: 0 0 10px #eab308; }
        
        .leaderboard { display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 800px; }
        .row { display: flex; align-items: center; background: rgba(0, 0, 0, 0.6); padding: 10px 15px; border-radius: 12px; border: 1px solid #333; }
        .flag { font-size: 38px; min-width: 60px; text-align: center; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.6)); }
        .track-container { flex: 1; margin: 0 15px; background: #000; border-radius: 20px; height: 28px; overflow: hidden; border: 1px solid #222; }
        .bar { height: 100%; width: 3%; border-radius: 20px; transition: width 0.3s ease; position: relative; }
        .bar::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent); animation: shimmer 1.5s infinite linear; }
        .score { font-size: 22px; font-weight: 900; min-width: 50px; text-align: right; color: #fff; }

        /* KANAN: TOP PENONTON & NOTIFIKASI */
        .right-panel { flex: 1; display: flex; flex-direction: column; gap: 15px; max-width: 350px; }
        
        /* Papan Peringkat Penonton */
        .viewer-board { background: rgba(24, 24, 27, 0.8); border: 1px solid #333; border-radius: 12px; padding: 15px; flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .viewer-title { font-size: 16px; font-weight: bold; color: #fff; text-align: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #444; display: flex; align-items: center; justify-content: center; gap: 10px; }
        .viewer-title i { color: #3b82f6; }
        .viewer-list { display: flex; flex-direction: column; gap: 10px; overflow-y: hidden; }
        .viewer-item { display: flex; justify-content: space-between; align-items: center; background: #000; padding: 8px 12px; border-radius: 8px; font-size: 14px; border-left: 3px solid #3b82f6; }
        .v-name { font-weight: bold; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; }
        .v-pts { color: #eab308; font-weight: bold; }

        /* Area Notifikasi */
        .notif-container { height: 200px; display: flex; flex-direction: column; gap: 8px; overflow: hidden; position: relative; }
        .notif { background: rgba(0, 0, 0, 0.8); padding: 10px 12px; border-radius: 8px; color: white; font-size: 13px; font-weight: bold; border: 1px solid #333; animation: slideIn 0.3s ease forwards; display: flex; align-items: center; gap: 10px; }
        .notif i { font-size: 16px; }
        .n-gift i { color: #eab308; }
        .n-like i { color: #ef4444; }
        .n-share i { color: #10b981; }
        .n-follow i { color: #3b82f6; }
        
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeOut { to { opacity: 0; transform: scale(0.9); } }
    </style>
</head>
<body>

    <div id="setup-screen">
        <div class="setup-box">
            <h2>PENGATURAN LIVE</h2>
            <input type="text" id="usernameInput" placeholder="Username TikTok..." value="gamemodapkofficial">
            <button onclick="startGame()">Mulai Layar Penuh</button>
        </div>
    </div>

    <div id="game-screen">
        <div class="left-panel">
            <header>
                <h1><i class="fa-solid fa-trophy"></i> FLAG WAR RACE <i class="fa-solid fa-trophy"></i></h1>
            </header>
            <div class="leaderboard" id="board"></div>
        </div>

        <div class="right-panel">
            <div class="viewer-board">
                <div class="viewer-title"><i class="fa-solid fa-users"></i> TOP USER</div>
                <div class="viewer-list" id="viewer-board">
                    </div>
            </div>
            <div class="notif-container" id="notif-area">
                </div>
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        const board = document.getElementById('board');
        const viewerBoard = document.getElementById('viewer-board');
        const notifArea = document.getElementById('notif-area');

        function startGame() {
            let user = document.getElementById('usernameInput').value.trim();
            if(!user) return alert("Username nggak boleh kosong!");
            
            let elem = document.documentElement;
            if (elem.requestFullscreen) { elem.requestFullscreen().catch(e => console.log(e)); }
            if(screen.orientation && screen.orientation.lock) { screen.orientation.lock('landscape').catch(e => console.log(e)); }

            document.getElementById('setup-screen').style.display = 'none';
            document.getElementById('game-screen').style.display = 'flex';
            
            socket.emit('connectToTiktok', user);
        }

        // Handle Notifikasi
        socket.on('notify', (data) => {
            const el = document.createElement('div');
            let iconHTML = '';
            
            if(data.type === 'gift') iconHTML = '<div class="n-gift"><i class="fa-solid fa-gift"></i></div>';
            else if(data.type === 'like') iconHTML = '<div class="n-like"><i class="fa-solid fa-heart"></i></div>';
            else if(data.type === 'share') iconHTML = '<div class="n-share"><i class="fa-solid fa-share"></i></div>';
            else if(data.type === 'follow') iconHTML = '<div class="n-follow"><i class="fa-solid fa-user-plus"></i></div>';

            el.className = 'notif';
            el.innerHTML = iconHTML + '<div>' + data.msg + '</div>';
            
            notifArea.prepend(el); // Taruh di paling atas list notif
            if(notifArea.children.length > 5) notifArea.lastChild.remove(); // Maksimal 5 notif tampil
            
            setTimeout(() => {
                el.style.animation = 'fadeOut 0.3s forwards';
                setTimeout(() => el.remove(), 300);
            }, 5000);
        });

        // Handle Update Bendera
        socket.on('updateData', (topFlags) => {
            board.innerHTML = ''; 
            topFlags.forEach((item, index) => {
                let percentage = Math.max(3, Math.min(100, item.score)); 
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

        // Handle Update Top Penonton
        socket.on('updateViewers', (topViewers) => {
            viewerBoard.innerHTML = '';
            topViewers.forEach((v, index) => {
                let medal = index === 0 ? '<i class="fa-solid fa-medal" style="color:#eab308"></i> ' : 
                            index === 1 ? '<i class="fa-solid fa-medal" style="color:#94a3b8"></i> ' : 
                            index === 2 ? '<i class="fa-solid fa-medal" style="color:#b45309"></i> ' : '';
                const row = document.createElement('div');
                row.className = 'viewer-item';
                row.innerHTML = \`<div class="v-name">\${medal}\${v.name}</div><div class="v-pts">\${v.pts} <i class="fa-solid fa-star" style="font-size:10px;"></i></div>\`;
                viewerBoard.appendChild(row);
            });
        });
    </script>
</body>
</html>
`;

app.get('/', (req, res) => { res.send(htmlPage); });

// ==========================================
// 3. MESIN BACKEND & KONEKSI TIKTOK
// ==========================================
let activeConnection = null;
let flagScores = {};
let viewerPoints = {}; // Simpan poin penonton
const MAX_SCORE = 100;
const flagRegex = /(?:\uD83C[\uDDE6-\uDDFF]){2}/g;

function getTop6() {
    return Object.keys(flagScores).map(flag => ({ flag, score: flagScores[flag] })).sort((a, b) => b.score - a.score).slice(0, 6);
}

// Fungsi Hitung Poin Penonton (Maksimal 6 orang top)
function addViewerPoints(username, points) {
    viewerPoints[username] = (viewerPoints[username] || 0) + points;
    let topViewers = Object.keys(viewerPoints)
        .map(name => ({ name, pts: viewerPoints[name] }))
        .sort((a, b) => b.pts - a.pts).slice(0, 6);
    io.emit('updateViewers', topViewers);
}

io.on('connection', (socket) => {
    socket.on('connectToTiktok', (username) => {
        if(activeConnection) { activeConnection.disconnect(); }
        console.log(`\n🔄 Konek ke: ${username}`);
        activeConnection = new WebcastPushConnection(username, { enableExtendedGiftInfo: true });

        activeConnection.connect().then(state => {
            console.info(`✅ KONEK: ${state.roomInfo.owner.display_id}`);
        }).catch(err => {
            console.error('❌ Gagal:', err.message);
        });

        activeConnection.on('chat', data => {
            let detectedFlags = data.comment.match(flagRegex);
            if (detectedFlags) {
                let isUpdated = false;
                detectedFlags.forEach(flag => {
                    flagScores[flag] = (flagScores[flag] || 0) + 1;
                    isUpdated = true;
                    if(flagScores[flag] >= MAX_SCORE) {
                        setTimeout(() => { flagScores = {}; io.emit('updateData', []); }, 3000);
                    }
                });
                if(isUpdated) io.emit('updateData', getTop6());
            }
            // Komen biasa dapet 1 poin
            addViewerPoints(data.uniqueId, 1);
        });

        activeConnection.on('gift', data => {
            socket.emit('notify', { type: 'gift', msg: `<b>${data.uniqueId}</b> ngirim <b>${data.giftName}</b>!` });
            addViewerPoints(data.uniqueId, data.diamondCount * 10); // Gift dapet poin gede
        });
        
        activeConnection.on('like', data => {
            socket.emit('notify', { type: 'like', msg: `<b>${data.uniqueId}</b> tap-tap layar!` });
            addViewerPoints(data.uniqueId, data.likeCount); 
        });

        activeConnection.on('share', data => {
            socket.emit('notify', { type: 'share', msg: `<b>${data.uniqueId}</b> membagikan live!` });
            addViewerPoints(data.uniqueId, 15); // Share dapet 15 poin
        });

        activeConnection.on('follow', data => {
            socket.emit('notify', { type: 'follow', msg: `<b>${data.uniqueId}</b> mulai mengikuti!` });
            addViewerPoints(data.uniqueId, 20); // Follow dapet 20 poin
        });
    });
});

http.listen(3000, () => {
    console.log('\n🚀 SERVER PRO JALAN! Buka http://localhost:3000\n');
});
