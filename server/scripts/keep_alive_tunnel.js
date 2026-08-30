const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let currentUrl = '';

function startTunnel() {
  console.log('🔄 Starting persistent SSH tunnel (Serveo)...');
  
  const tunnel = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=30',
    '-tt',
    '-R', '80:localhost:5000',
    'serveo.net'
  ], { shell: true });

  tunnel.stdout.on('data', (data) => {
    const str = data.toString();
    console.log('[Tunnel]:', str.trim());
    
    const match = str.match(/https:\/\/[a-zA-Z0-9.-]+\.serveousercontent\.com/);
    if (match) {
      currentUrl = match[0];
      console.log('\n==================================================');
      console.log('🚀 LIVE ACTIVE WEBHOOK URL:', `${currentUrl}/api/webhooks/google-form`);
      console.log('==================================================\n');
      
      // Write active URL to server/scripts/active_tunnel_url.txt
      fs.writeFileSync(path.join(__dirname, 'active_tunnel_url.txt'), `${currentUrl}/api/webhooks/google-form`);
    }
  });

  tunnel.stderr.on('data', (data) => {
    console.log('[Tunnel Info]:', data.toString().trim());
  });

  tunnel.on('close', (code) => {
    console.log(`⚠️ Tunnel disconnected with code ${code}. Reconnecting in 3 seconds...`);
    setTimeout(startTunnel, 3000);
  });
}

startTunnel();
