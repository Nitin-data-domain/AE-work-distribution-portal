const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('⚡ Starting Cloudflare Public HTTPS Tunnel for 127.0.0.1:5000...');

const cloudflaredBin = path.join(__dirname, '../node_modules/cloudflared/bin/cloudflared.exe');
const cmd = fs.existsSync(cloudflaredBin) ? cloudflaredBin : 'npx';
const args = fs.existsSync(cloudflaredBin)
  ? ['tunnel', '--url', 'http://127.0.0.1:5000', '--http-host-header', '127.0.0.1:5000']
  : ['-y', 'cloudflared', 'tunnel', '--url', 'http://127.0.0.1:5000', '--http-host-header', '127.0.0.1:5000'];

const child = spawn(cmd, args, { shell: true });

child.stderr.on('data', (data) => {
  const str = data.toString();
  const match = str.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (match) {
    const tunnelUrl = match[0];
    const webhookUrl = `${tunnelUrl}/api/webhooks/google-form`;
    console.log('\n==================================================');
    console.log('🚀 LIVE CLOUDFLARE PUBLIC TUNNEL ACTIVE!');
    console.log('🌐 Tunnel Base URL :', tunnelUrl);
    console.log('📋 Webhook API URL :', webhookUrl);
    console.log('==================================================\n');

    fs.writeFileSync(path.join(__dirname, 'active_tunnel_url.txt'), webhookUrl);

    const gsPath = path.join(__dirname, '../../google-form/Code.gs');
    if (fs.existsSync(gsPath)) {
      let gsContent = fs.readFileSync(gsPath, 'utf8');
      gsContent = gsContent.replace(/const API_ENDPOINT = ".*";/, `const API_ENDPOINT = "${webhookUrl}";`);
      fs.writeFileSync(gsPath, gsContent);
      console.log('✅ Updated google-form/Code.gs API_ENDPOINT successfully!');
    }
  }
});

child.stdout.on('data', (data) => {
  console.log('[Tunnel Output]:', data.toString().trim());
});

child.on('close', (code) => {
  console.log(`⚠️ Tunnel closed with code ${code}. Reconnecting in 3 seconds...`);
  setTimeout(() => {
    require('child_process').fork(__filename);
  }, 3000);
});
