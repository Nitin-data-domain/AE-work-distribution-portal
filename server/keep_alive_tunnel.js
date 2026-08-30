// ============================================================
// Automatic Tunnel & Server Keep-Alive Monitor
// Keeps localtunnel / serveo tunnel active during development
// ============================================================
const https = require('https');
const http = require('http');

const fs = require('fs');
const path = require('path');

let TUNNEL_URL = 'https://price-notified-roller-screenshots.trycloudflare.com';
const activeUrlFile = path.join(__dirname, 'scripts/active_tunnel_url.txt');
if (fs.existsSync(activeUrlFile)) {
  const fullWebhookUrl = fs.readFileSync(activeUrlFile, 'utf8').trim();
  const match = fullWebhookUrl.match(/https:\/\/[^\/]+/);
  if (match) TUNNEL_URL = match[0];
}

console.log('⚡ Aharada Education — Webhook Keep-Alive Monitor Started');
console.log(`🌐 Tunnel Target: ${TUNNEL_URL}`);

function pingTunnel() {
  const mod = TUNNEL_URL.startsWith('https') ? https : http;
  mod.get(`${TUNNEL_URL}/api/health`, (res) => {
    if (res.statusCode === 200) {
      console.log(`[${new Date().toLocaleTimeString()}] 💚 Webhook Tunnel Active & Healthy (HTTP 200)`);
    } else {
      console.warn(`[${new Date().toLocaleTimeString()}] ⚠️ Tunnel responded with HTTP ${res.statusCode}`);
    }
  }).on('error', (err) => {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ Ping failed: ${err.message}`);
  });
}

// Ping every 2 minutes to ensure SSH tunnel connections never idle or drop
setInterval(pingTunnel, 2 * 60 * 1000);
pingTunnel();
