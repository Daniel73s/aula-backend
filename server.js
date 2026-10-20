import 'dotenv/config';
import { createServer } from 'node:http';
import app from './src/app.js';
import { initSockets } from './src/sockets.js';
import { config } from './src/config.js';

const httpServer = createServer(app);
const io = initSockets(httpServer);
app.set('io', io);

httpServer.listen(config.port, () => {
  console.log(`Aula backend escuchando en http://localhost:${config.port}`);
});
