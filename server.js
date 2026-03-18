const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const { WebcastPushConnection } = require('tiktok-live-connector');

// ==========================================
// 1. DATA PWA
// ==========================================
const manifestJson = {
    "name": "Live Flag Race Pro", "short_name": "FlagRace", "start_url": "/", "display": "fullscreen",
    "orientation": "portrait", "background_color": "#09090b", "theme_color": "#000000"
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
    <title>Live Bar Race 3:4 Pro</title>
    <link rel="manifest" href="/manifest.json">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root { --bg: #020617; --panel: #0f172a; --text: #f8fafc; --accent: #3b82f6; }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, sans-serif; }
        
        body { 
            background-color: #000; 
            color: var(--text); 
            height: 100vh; 
            width: 100vw; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            overflow: hidden; 
        }

        /* CONTAINER RASIO 3:4 */
        .aspect-container {
            width: auto;
            height: 100vh;
            aspect-ratio: 3 / 4;
            background-color: var(--bg);
            position: relative;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            border-left: 1px solid #1e293b;
            border-right: 1px solid #1e293b;
        }
        
        #setup-screen { position: absolute; inset: 0; background: rgba(0,0,0,0.95); z-index: 999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); }
        .setup-box { background: var(--panel); padding: 30px; border-radius: 15px; text-align: center; width: 80%; border: 1px solid #334155; }
        input { padding: 12px; border-radius: 8px; border: 1px solid #334155; background: #000; color: #fff; width: 100%; margin-bottom: 15px; text-align: center; }
        button { background: #3b82f6; color: white; border: none; padding: 12px; font-weight: bold; border-radius: 8px; cursor: pointer; width: 100%; }

        /* HEADER */
        header { padding: 20px 10px; text-align: center; background: linear-gradient(to bottom, #1e293b, transparent); }
        h1 { font-size: 22px; font-weight: 900; color: #fff; text-shadow: 0 0 10px rgba(59,130,246,0.5); }

        /* AREA GAME */
        .game-content { flex: 1; display: flex; flex-direction: column; padding: 15px; gap: 20px; }
        
        .leaderboard { display: flex; flex-direction: column; gap: 15px; }
        .row { display: flex; align-items: center; background: rgba(30, 41, 59, 0.5); padding: 12px; border-radius: 10px; border: 1px solid #1e293b; }
        .flag { font-size: 32px; min-width: 50px; }
        
        .track-container { 
            flex: 1; 
            margin: 0 12px; 
            background: #1e293b; 
            border-radius: 5px; 
            height: 24px; 
            border: 1px solid #334155;
            position: relative;
        }
        /* BAR WARNA HITAM */
        .bar { 
            height: 100%; 
            width: 3%; 
            background: #000000 !important; 
            border: 1px solid #444; 
            transition: width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
        }
        .score { font-size: 18px; font-weight: 800; min-width: 40px; color: #3b82f6; }

        /* TOP 3 USER & NOTIF */
        .bottom-panels { display: grid; grid-template-columns: 1fr; gap: 15px; margin-top: auto; padding-bottom: 10px; }
        
        .viewer-board { background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 12px; }
        .viewer-title { font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #94a3b8; display: flex; align-items: center; gap: 8px; }
        .viewer-list { display: flex; flex-direction: column; gap: 8px; }
        
        /* LIMIT 3 USER + ELLIPSIS */
        .viewer-item { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            background: #020617; 
            padding: 10px 15px; 
            border-radius: 8px; 
            border-left: 4px solid #3b82f6; 
        }
        .v-name { 
            font-weight: 600; 
            color: #e2e8f0; 
            white-space: nowrap; 
            overflow: hidden; 
            text-overflow: ellipsis; 
            max-width: 140px; /* Batasi lebar agar titik-titik muncul */
        }
        .v-pts { color: #eab308; font-weight: bold; font-size: 13px; }

        .notif-container { height: 120px; overflow: hidden; display: flex; flex-direction: column; gap: 5px; }
        .notif { background: #1e293b; padding: 8px 12px; border-radius: 6px; font-size: 12px; animation: slideIn 0.3s ease; border: 1px solid #334155; }
        
        @keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    </style>
</head>
<body>

    <div class="aspect-container">
        <div id="setup-screen">
            <div class="setup-box">
                <h2 style="margin-bottom:15px">LIVE SETUP</h2>
                <input type="text" id="usernameInput" placeholder="@username_tiktok" value="gamemodapkofficial">
                <button onclick="startGame()">MASUK LIVE</button>
            </div>
        </div>

        <header>
            <h1><i class="fa-solid fa-flag-checkered"></i> FLAG RACE PRO</h1>
        </header>

        <div class="game-content">
            <div class="leaderboard" id="board"></div>

            <div class="bottom-panels">
                <div class="viewer-board">
                    <div class="viewer-title"><i class="fa-solid fa-crown"></i> TOP 3 RANKING</div>
                    <div class="viewer-list" id="viewer-board"></div>
                </div>
                <div class="notif-container" id="notif-area"></div>
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
            if(!user) return alert("Isi username dulu!");
            document.getElementById('setup-screen').style.display = 'none';
            socket.emit('connectToTiktok', user);
        }

        socket.on('notify', (data) => {
            const el = document.createElement('div');
            el.className = 'notif';
            el.innerHTML = \`<b>\${data.msg}</b>\`;
            notifArea.prepend(el);
            if(notifArea.children.length > 3) notifArea.lastChild.remove();
            setTimeout(() => el.remove(), 4000);
        });

        socket.on('updateData', (topFlags) => {
            board.innerHTML = ''; 
            topFlags.forEach((item) => {
                let percentage = Math.max(3, item.score);
                const row = document.createElement('div');
                row.className = 'row';
                row.innerHTML = \`
                    <div class="flag">\${item.flag}</div>
                    <div class="track-container">
                        <div class="bar" style="width: \${percentage}%"></div>
                    </div>
                    <div class="score">\${item.score}</div>
                \`;
                board.appendChild(row);
            });
        });

        socket.on('updateViewers', (topViewers) => {
            viewerBoard.innerHTML = '';
            topViewers.slice(0, 3).forEach((v, index) => { // Pastikan hanya 3 di frontend
                const row = document.createElement('div');
                row.className = 'viewer-item';
                row.innerHTML = \`<div class="v-name">\${index+1}. \${v.name}</div><div class="v-pts">\${v.pts} XP</div>\`;
                viewerBoard.appendChild(row);
            });
        });
    </script>
</body>
</html>
`;

app.get('/', (req, res) => { res.send(htmlPage); });

// ==========================================
// 3. MESIN BACKEND (Logic Tetap Sama)
// ==========================================
let activeConnection = null;
let flagScores = {};
let viewerPoints = {}; 
const MAX_SCORE = 100;
const flagRegex = /(?:\uD83C[\uDDE6-\uDDFF]){2}/g;

function getTop6() {
    return Object.keys(flagScores).map(flag => ({ flag, score: flagScores[flag] })).sort((a, b) => b.score - a.score).slice(0, 6);
}

function addViewerPoints(username, points) {
    viewerPoints[username] = (viewerPoints[username] || 0) + points;
    // Backend kirim 3 saja ke frontend
    let topViewers = Object.keys(viewerPoints)
        .map(name => ({ name, pts: viewerPoints[name] }))
        .sort((a, b) => b.pts - a.pts).slice(0, 3);
    io.emit('updateViewers', topViewers);
}

io.on('connection', (socket) => {
    socket.on('connectToTiktok', (username) => {
        if(activeConnection) { activeConnection.disconnect(); }
        activeConnection = new WebcastPushConnection(username);
        activeConnection.connect().catch(err => console.error('Error:', err.message));

        activeConnection.on('chat', data => {
            let detectedFlags = data.comment.match(flagRegex);
            if (detectedFlags) {
                detectedFlags.forEach(flag => {
                    flagScores[flag] = (flagScores[flag] || 0) + 1;
                    if(flagScores[flag] >= MAX_SCORE) flagScores = {};
                });
                io.emit('updateData', getTop6());
            }
            addViewerPoints(data.uniqueId, 1);
        });

        activeConnection.on('gift', data => {
            io.emit('notify', { msg: \`\${data.uniqueId} kirim \${data.giftName}!\` });
            addViewerPoints(data.uniqueId, data.diamondCount * 5);
        });
        
        activeConnection.on('like', data => addViewerPoints(data.uniqueId, 1));
        activeConnection.on('share', data => addViewerPoints(data.uniqueId, 10));
        activeConnection.on('follow', data => addViewerPoints(data.uniqueId, 15));
    });
});

http.listen(3000, () => {
    console.log('\n🚀 SERVER 3:4 READY! http://localhost:3000\n');
});
