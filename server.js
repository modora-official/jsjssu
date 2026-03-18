const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const { WebcastPushConnection } = require('tiktok-live-connector');

// TAMPILAN WEB GAMENYA
const htmlPage = `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Live Bar Race</title>
    <style>
        body { background-color: #111; color: white; font-family: sans-serif; padding: 20px; overflow: hidden; }
        h2 { text-align: center; margin-bottom: 30px; text-transform: uppercase; }
        .track { background: #333; width: 100%; height: 40px; border-radius: 20px; margin-bottom: 20px; position: relative; overflow: hidden; box-shadow: inset 0 0 10px rgba(0,0,0,0.5); }
        .bar { height: 100%; width: 0%; border-radius: 20px; transition: width 0.3s ease-out; display: flex; align-items: center; padding-left: 15px; font-weight: bold; font-size: 18px; text-shadow: 1px 1px 2px black; white-space: nowrap; }
        #bar-indo { background: linear-gradient(90deg, #ff0000, #ff4d4d); }
        #bar-malay { background: linear-gradient(90deg, #0000ff, #4d4dff); }
        #bar-gift { background: linear-gradient(90deg, #ffd700, #ffea00); color: black; text-shadow: none; }
    </style>
</head>
<body>
    <h2>🔥 RACE: KOMEN BENDERA VS GIFT 🔥</h2>
    <div class="track"><div class="bar" id="bar-indo">🇮🇩 INDO (0%)</div></div>
    <div class="track"><div class="bar" id="bar-malay">🇲🇾 MALAY (0%)</div></div>
    <div class="track"><div class="bar" id="bar-gift">🎁 SULTAN GIFT (0%)</div></div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        let scoreIndo = 0, scoreMalay = 0, scoreGift = 0;

        socket.on('updateBar', function(data) {
            if (data.type === 'indo') { scoreIndo += data.amount; if(scoreIndo > 100) scoreIndo = 100; document.getElementById('bar-indo').style.width = scoreIndo + '%'; document.getElementById('bar-indo').innerText = '🇮🇩 INDO (' + scoreIndo + '%)'; } 
            else if (data.type === 'malay') { scoreMalay += data.amount; if(scoreMalay > 100) scoreMalay = 100; document.getElementById('bar-malay').style.width = scoreMalay + '%'; document.getElementById('bar-malay').innerText = '🇲🇾 MALAY (' + scoreMalay + '%)'; }
            else if (data.type === 'gift') { scoreGift += data.amount; if(scoreGift > 100) scoreGift = 100; document.getElementById('bar-gift').style.width = scoreGift + '%'; document.getElementById('bar-gift').innerText = '🎁 SULTAN GIFT (' + scoreGift + '%)'; }

            // Reset kalau ada yang mentok 100%
            if (scoreIndo === 100 || scoreMalay === 100 || scoreGift === 100) {
                setTimeout(() => {
                    scoreIndo = scoreMalay = scoreGift = 0;
                    document.getElementById('bar-indo').style.width = '0%'; document.getElementById('bar-indo').innerText = '🇮🇩 INDO (0%)';
                    document.getElementById('bar-malay').style.width = '0%'; document.getElementById('bar-malay').innerText = '🇲🇾 MALAY (0%)';
                    document.getElementById('bar-gift').style.width = '0%'; document.getElementById('bar-gift').innerText = '🎁 SULTAN GIFT (0%)';
                }, 3000);
            }
        });
    </script>
</body>
</html>
`;

app.get('/', (req, res) => { res.send(htmlPage); });

// USERNAME TIKTOK LU UDAH GUA PASANG DI SINI
let tiktokUsername = "gamemodapkofficial";
let tiktokLiveConnection = new WebcastPushConnection(tiktokUsername);

tiktokLiveConnection.connect().then(state => {
    console.info(`\n✅ BERHASIL KONEK KE LIVE: ${state.roomInfo.owner.display_id}`);
}).catch(err => {
    console.error('\n❌ GAGAL KONEK! Pastiin lu udah mulai Live di aplikasi TikTok!\n', err);
});

// LOGIKA KOMENTAR
tiktokLiveConnection.on('chat', data => {
    let komen = data.comment.toLowerCase();
    if (komen.includes('🇮🇩') || komen.includes('indo')) { io.emit('updateBar', { type: 'indo', amount: 1 }); }
    if (komen.includes('🇲🇾') || komen.includes('malay')) { io.emit('updateBar', { type: 'malay', amount: 1 }); }
});

// LOGIKA GIFT
tiktokLiveConnection.on('gift', data => {
    if (data.giftType === 1 && !data.repeatEnd) return; 
    io.emit('updateBar', { type: 'gift', amount: data.diamondCount * 2 }); 
});

http.listen(3000, () => {
    console.log('\n=======================================');
    console.log('🚀 SERVER JALAN BOSKU!');
    console.log('👉 Buka Chrome/Safari, ketik: http://localhost:3000');
    console.log('=======================================\n');
});
