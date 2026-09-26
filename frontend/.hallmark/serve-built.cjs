const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const port = Number(process.env.PORT || 4200);
const backendPort = Number(process.env.BACKEND_PORT || 8080);
const akinatorPort = Number(process.env.AKINATOR_PORT || 4201);
const browserDir = path.resolve(__dirname, '..', 'dist', 'creditplus-focal', 'browser');
const indexFile = path.join(browserDir, 'index.csr.html');
const proxyPrefixes = ['/auth/', '/api/'];

app.use((request, response, next) => {
  if (!proxyPrefixes.some((prefix) => request.originalUrl.startsWith(prefix))) {
    next();
    return;
  }

  const targetPort = request.originalUrl.startsWith('/api/akinator') ? akinatorPort : backendPort;
  const headers = { ...request.headers, host: `127.0.0.1:${targetPort}` };
  const proxy = http.request(
    {
      hostname: '127.0.0.1',
      port: targetPort,
      path: request.originalUrl,
      method: request.method,
      headers
    },
    (backendResponse) => {
      response.writeHead(backendResponse.statusCode || 502, backendResponse.headers);
      backendResponse.pipe(response);
    }
  );

  proxy.on('error', (error) => {
    if (!response.headersSent) response.status(502);
    response.end(`Backend proxy error: ${error.message}`);
  });

  request.pipe(proxy);
});

app.use(express.static(browserDir, { index: false }));
app.use((request, response, next) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    next();
    return;
  }
  response.sendFile(indexFile);
});

app.listen(port, '0.0.0.0', () => {
  process.stdout.write(`Focal frontend listening on http://localhost:${port}\n`);
});
