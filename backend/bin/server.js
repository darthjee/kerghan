import { WebServer } from '../lib/server/WebServer.js';
import { User } from '../models/index.js';

const port = Number(process.env.PORT ?? 8080);
const secretKey = process.env.KERGHAN_SECRET_KEY;
const isProduction = process.env.NODE_ENV === 'production';

new WebServer({ port, secretKey, isProduction, models: { User } }).start();
