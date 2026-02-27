const localtunnel = require('C:\\Users\\USER\\AppData\\Local\\npm-cache\\_npx\\75ac80b86e83d4a2\\node_modules\\localtunnel');

(async () => {
  const tunnel = await localtunnel({ port: 3001 });
  console.log('TUNNEL_URL=' + tunnel.url);
  tunnel.on('close', () => {
    console.log('Tunnel closed');
    process.exit(0);
  });
})();
