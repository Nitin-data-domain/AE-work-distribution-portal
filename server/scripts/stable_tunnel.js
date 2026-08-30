// ============================================================
// Aharada Education — Stable Localtunnel Server
// Runs localtunnel in-process with automatic reconnection
// ============================================================
const localtunnel = require('localtunnel');
const fs = require('fs');
const path = require('path');

const PORT = 5000;
const SUBDOMAIN = 'aharada-education-portal';
const GS_PATH = path.join(__dirname, '../../google-form/Code.gs');

let tunnel = null;
let retryCount = 0;
const MAX_RETRIES = 50;

async function startTunnel() {
  try {
    console.log(`\n⚡ [${new Date().toLocaleTimeString()}] Starting localtunnel (attempt ${retryCount + 1})...`);
    
    tunnel = await localtunnel({
      port: PORT,
      subdomain: SUBDOMAIN,
      local_host: '127.0.0.1',
      allow_invalid_cert: true,
    });

    const webhookUrl = `${tunnel.url}/api/webhooks/google-form`;
    
    console.log('==================================================');
    console.log('🚀 LIVE TUNNEL ACTIVE!');
    console.log('🌐 Tunnel URL  :', tunnel.url);
    console.log('📋 Webhook URL :', webhookUrl);
    console.log('==================================================\n');

    // Save active URL
    fs.writeFileSync(path.join(__dirname, 'active_tunnel_url.txt'), webhookUrl);

    // Update Code.gs
    if (fs.existsSync(GS_PATH)) {
      let gs = fs.readFileSync(GS_PATH, 'utf8');
      gs = gs.replace(/const API_ENDPOINT = ".*";/, `const API_ENDPOINT = "${webhookUrl}";`);
      fs.writeFileSync(GS_PATH, gs);
      console.log('✅ Updated google-form/Code.gs');
    }

    retryCount = 0; // Reset on success

    tunnel.on('close', () => {
      console.log(`⚠️ [${new Date().toLocaleTimeString()}] Tunnel closed. Reconnecting in 2s...`);
      setTimeout(startTunnel, 2000);
    });

    tunnel.on('error', (err) => {
      console.error(`❌ Tunnel error: ${err.message}`);
    });

  } catch (err) {
    retryCount++;
    if (retryCount < MAX_RETRIES) {
      const delay = Math.min(5000, retryCount * 1000);
      console.error(`❌ Tunnel failed: ${err.message}. Retrying in ${delay/1000}s...`);
      setTimeout(startTunnel, delay);
    } else {
      console.error('❌ Max retries exceeded. Please restart manually.');
    }
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  if (tunnel) tunnel.close();
  process.exit(0);
});

startTunnel();
