import { readFileSync } from 'fs';
import Fastify from 'fastify';
import consoleLogger from './console-logger.js';
const fastify = Fastify({
  logger: true,
});
let loggerViewerHtml = readFileSync('./logger-viewer.html').toString();
fastify.get('/logger-viewer.html', async function handler(req, res) {
  res.headers({
    'Content-Type': 'text/html',
  });
  // 替换loggerhost
  return loggerViewerHtml.replace('loggerhost', process.env.loggerhost!);
});
fastify.register(consoleLogger);
// Run the server!
(async () => {
  try {
    await fastify.listen({ port: 8080 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
})();
