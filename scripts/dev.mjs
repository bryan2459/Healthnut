import { spawn } from 'node:child_process';
import net from 'node:net';
import process from 'node:process';

async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen({ port, host: '::' });
  });
}

async function findAvailablePort(startPort, maxAttempts = 20) {
  for (let port = startPort; port < startPort + maxAttempts; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  return startPort;
}

const preferredPort = Number(process.env.PORT) || 3001;
const serverPort = await findAvailablePort(preferredPort);
const env = {
  ...process.env,
  PORT: String(serverPort),
  VITE_API_TARGET: `http://localhost:${serverPort}`,
};

const vite = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite'], {
  env,
  stdio: 'inherit',
  shell: true,
});
const server = spawn(process.platform === 'win32' ? 'node.exe' : 'node', ['server/index.js'], {
  env,
  stdio: 'inherit',
  shell: true,
});

const shutdown = () => {
  vite.kill();
  server.kill();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

vite.on('close', (code) => {
  server.kill();
  process.exit(code ?? 0);
});

server.on('close', (code) => {
  vite.kill();
  process.exit(code ?? 0);
});
