const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const { WebcastPushConnection } = require('tiktok-live-connector');

const manifestJson = {
    "name": "Live Flag Race", "short_name": "FlagRace", "start_url": "/", "display": "fullscreen",
    "orientation": "landscape", "background_color": "#09090b", "theme_color": "#3b82f6"
};
app.get('/manifest.json', (req, res) => res.json(manifestJson));

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
        
        #setup-screen { position: absolute; inset: 0; background: rgba(0,0,0,0.9); z-index: 999; display: flex; flex-direction: column; align-items: center; justify-content: center; backdrop-filter: blur(10px); }
        .setup-box { background: var(--panel); padding: 30px; border-radius: 15px; text-align: center; border: 1px solid #333; }
        input { padding: 12px 20px; font-size: 16px; border-radius: 8px; border: 1px solid #444; background: #222; color: #fff; width: 100%; margin-bottom: 15px; text-align: center; }
        button { background: linear-gradient(90deg, #3b82f6, #2563eb); color: white; border: none; padding: 12px 20px; font-size: 16px; font-weight: bold; border-radius: 8px; cursor: pointer; width: 100%; text-transform: uppercase; }
        
        #game-screen { display: none; width: 100%; height: 100%; padding: 10px; gap: 10px; }
        
        /* KIRI: BENDERA */
        .left-panel { flex: 1.8; display: flex; flex-direction: column; justify-content: center; align-items: center; background: rgba(24, 24, 27, 0.4); border-radius: 15px; padding: 10px; border: 1px solid #222; }
        header { text-align: center; margin-bottom: 15px; }
        h1 { font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 10px var(--accent); color: #fff; display: flex; align-items: center; justify-content: center; gap: 10px; }
        h1 i { color: #eab308; }
        
        .leaderboard { display: flex; flex-direction: column; gap: 8px; width: 100%; }
        .row { display: flex; align-items: center; background: rgba(0, 0, 0, 0.6); padding: 8px 12px; border-radius: 12px; border: 1px solid #333; }
        .flag { font-size: 32px; min-width: 50px; text-align: center; }
        .track-container { flex: 1; margin: 0 10px; background: #000; border-radius: 20px; height: 22px; overflow: hidden; border: 1px solid #222; }
        .bar { height: 100%; width: 3%; border-radius: 20px; transition: width 0.3s ease; position: relative; }
        .bar::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent); animation: shimmer 1.5s infinite linear; }
        .score { font-size: 18px; font-weight: 900; min-width: 40px; text-align: right; color: #fff; }

        /* KANAN: TOP PENONTON & NOTIF */
        .right-panel { flex: 1; display: flex; flex-direction: column; gap: 10px; max-width: 300px; }
        
        /* FIX: TOP PENONTON (DIKECILIN BIAR MUAT 3+) */
        .viewer-board { background: rgba(24, 24, 27, 0.8); border: 1px solid #333; border-radius: 12px; padding: 10px; display: flex; flex-direction: column; min-height: 180px; }
        .viewer-title { font-size: 14px; font-weight: bold; color: #fff; text-align: center; margin-bottom: 8px; padding-bottom: 5px; border-bottom: 1px solid #444; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .viewer-title i { color: #3b82f6; }
        .viewer-list { display: flex; flex-direction: column; gap: 5px; }
        .viewer-item { display: flex; justify-content: space-between; align-items: center; background: #000; padding: 6px 10px; border-radius: 8px; font-size: 12px; border-left: 3px solid #3b82f6; }
        .v-name { font-weight: bold; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px; }
        .v-pts { color: #eab308; font-weight: bold; }

        /* Area Notifikasi */
        .notif-container { flex: 1; display: flex; flex-direction: column; gap: 5px; overflow: hidden; }
        .notif { background: rgba(0, 0, 0, 0.8); padding: 8px 10px; border-radius: 8px; color: white; font-size: 11px; font-weight: bold; border: 1px solid #333; animation: slideIn 0.3s ease forwards; display: flex; align-items: center; gap: 8px; }
        
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
                <div class="viewer-title"><i class="fa-solid fa-users"></i> TOP PENONTON</div>
                <div class="viewer-list" id="viewer-board"></div>
            </div>
            <div class="notif-container" id="notif-area"></div>
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
            if (elem.requestFullscreen) { elem.requestFullscreen(); }
            if(screen.orientation && screen.orientation.lock) { screen.orientation.lock('landscape'); }
            document.getElementById('setup-screen').style.display = 'none';
            document.getElementById('game-screen').style.display = 'flex';
            socket.emit('connectToTiktok', user);
        }

        socket.on('notify', (data) => {
            const el = document.createElement('div');
            el.className = 'notif';
            el.innerHTML = '<div>' + data.msg + '</div>';
            notifArea.prepend(el);
            if(notifArea.children.length > 4) notifArea.lastChild.remove();
            setTimeout(() => { el.style.animation = 'fadeOut 0.3s forwards'; setTimeout(() => el.remove(), 300); }, 5000);
        });

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
                row.innerHTML = \`<div class="flag">\${item.flag}</div><div class="track-container"><div class="bar" style="width: \${percentage}%; background: \${barColor}"></div></div><div class="score">\${item.score}</div>\`;
                board.appendChild(row);
            });
        });

        socket.on('updateViewers', (topViewers) => {
            viewerBoard.innerHTML = '';
            topViewers.forEach((v, index) => {
                const row = document.createElement('div');
                row.className = 'viewer-item';
                row.innerHTML = \`<div class="v-name">\${v.name}</div><div class="v-pts">\${v.pts} ★</div>\`;
                viewerBoard.appendChild(row);
            });
        });
    </script>
</body>
</html>
`;

app.get('/', (req, res) => { res.send(htmlPage); });

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
    let topViewers = Object.keys(viewerPoints).map(name => ({ name, pts: viewerPoints[name] })).sort((a, b) => b.pts - a.pts).slice(0, 5);
    io.emit('updateViewers', topViewers);
}

io.on('connection', (socket) => {
    socket.on('connectToTiktok', (username) => {
        if(activeConnection) { activeConnection.disconnect(); }
        activeConnection = new WebcastPushConnection(username);
        activeConnection.connect().then(state => console.log('Konek')).catch(err => console.log('Error'));
        activeConnection.on('chat', data => {
            let df = data.comment.match(flagRegex);
            if (df) {
                df.forEach(f => {
                    flagScores[f] = (flagScores[f] || 0) + 1;
                    if(flagScores[f] >= MAX_SCORE) { flagScores = {}; io.emit('updateData', []); }
                });
                io.emit('updateData', getTop6());
            }
            addViewerPoints(data.uniqueId, 1);
        });
        activeConnection.on('gift', data => {
            socket.emit('notify', { msg: \`<b>\${data.uniqueId}</b> kirim gift!\` });
            addViewerPoints(data.uniqueId, data.diamondCount * 5);
        });
        activeConnection.on('like', data => { addViewerPoints(data.uniqueId, 1); });
    });
});

http.listen(3000, () => console.log('Jalan!'));
