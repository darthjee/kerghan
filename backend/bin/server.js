import { WebServer } from '../lib/server/WebServer.js';

const port = Number(process.env.PORT ?? 8080);

new WebServer({ port }).start();
