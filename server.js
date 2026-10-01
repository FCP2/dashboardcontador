require('dotenv').config();

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const dashboardFunction = require('./netlify/functions/dashboard-data.js');

const port = Number(process.env.PORT || 5001);
const root = __dirname;

const server = http.createServer(async (req, res) => {
  const requestPath = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;

  if (requestPath === '/.netlify/functions/dashboard-data') {
    const result = await dashboardFunction.handler({}, {});
    res.writeHead(result.statusCode, result.headers);
    res.end(result.body);
    return;
  }

  const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const filePath = path.resolve(root, relativePath);

  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
  };

  res.writeHead(200, {
    'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  res.end(fs.readFileSync(filePath));
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`El puerto ${port} ya está ocupado. Cierra la instancia anterior o ejecuta con PORT=5001.`);
    process.exit(1);
  }
  console.error('No fue posible iniciar el dashboard:', error.message);
  process.exit(1);
});

server.listen(port, () => {
  console.log(`Dashboard local: http://localhost:${port}`);
});
