import { readFileSync, existsSync } from 'fs';
import path from 'path';
import Fastify from 'fastify';
import consoleLogger from './console-logger.js';
import { execSync } from 'child_process';
const fastify = Fastify({
  logger: true,
});
let loggerViewerHtml = '';
fastify.get('/logger-viewer.html', async function handler(req, res) {
  console.log('IP：', req.ip);
  const filePath = path.join('web/dist', '/index.html');
  // 检查文件是否存在
  if (!existsSync(filePath) && loggerViewerHtml == '') {
    console.log('等待打包');
    execSync('npx vite build');
    console.log('打包完成');
  }
  loggerViewerHtml = readFileSync('web/dist/index.html').toString();

  res.headers({
    'Content-Type': 'text/html',
  });
  return loggerViewerHtml;
});
fastify.get('/*', async function handler(req, res) {
  const filePath = path.join('web/dist', req.url);

  // 检查文件是否存在
  if (!existsSync(filePath)) {
    res.code(404);
    return { error: '文件未找到' };
  }

  try {
    const content = readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();

    // 设置适当的Content-Type
    const contentTypes = {
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.html': 'text/html',
    };

    res.headers({
      'Content-Type': contentTypes[ext] || 'application/octet-stream',
    });

    return content;
  } catch (error) {
    res.code(500);
    return { error: '服务器内部错误' };
  }
});
fastify.register(consoleLogger);
(async () => {
  try {
    await fastify.listen({ port: 8080 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
})();
