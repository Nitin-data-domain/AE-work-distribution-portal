const https = require('https');
https.get('https://17r3d9w7ay.c36.airoapp.ai/login', (res) => {
  let html = '';
  res.on('data', d => html += d);
  res.on('end', () => {
    const match = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
    if(match) {
      console.log('Found JS file:', match[1]);
      https.get('https://17r3d9w7ay.c36.airoapp.ai' + match[1], (res2) => {
        let js = '';
        res2.on('data', d => js += d);
        res2.on('end', () => {
          if (js.includes('localhost:5000')) {
            console.log('❌ YES, localhost:5000 is still hardcoded in the live JS bundle!');
          } else if (js.includes('"/api"')) {
            console.log('✅ JS bundle has the correct /api URL.');
          } else {
            console.log('❓ Could not find localhost or /api in the bundle.');
          }
        });
      });
    } else {
      console.log('Could not find JS file in HTML');
    }
  });
});
