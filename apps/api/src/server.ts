import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3333);
const host = process.env.HOST ?? (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

createApp().listen(port, host, () => {
  console.log(`US-Agent API listening on http://${host}:${port}`);
});
