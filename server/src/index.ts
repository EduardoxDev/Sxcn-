import { createScxnServer } from './app';
import { config } from './config';

const server = createScxnServer(config);

server.http.listen(config.port, () => {
  console.info(`[scxn] signaling listening on http://localhost:${config.port}`);
  if (!config.iceServers.some((s) => [s.urls].flat().some((u) => u.startsWith('turn')))) {
    console.info(
      '[scxn] no TURN server configured — peers behind symmetric NAT may fail to connect',
    );
  }
});

const shutdown = () => {
  console.info('[scxn] shutting down');
  void server.close().finally(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
