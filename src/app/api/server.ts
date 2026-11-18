/** Fastify server assembly for the dashboard API. */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { apiError, registerApiRoutes } from './routes.js';
import type { ApiDeps } from './types.js';

/** Extract a valid HTTP status code from an unknown error. */
function resolveStatusCode(error: unknown): number {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const value = (error as { statusCode?: unknown }).statusCode;
    if (typeof value === 'number' && value >= 400 && value <= 599) return value;
  }
  return 500;
}

const DEV_HINT_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>HexoBot Dashboard</title>
  </head>
  <body>
    <main>
      <h1>HexoBot Dashboard</h1>
      <p>The API is running, but <code>web/dist</code> was not found.</p>
      <p>Run the Vite dev server from the repository root:</p>
      <pre>npm run web:dev</pre>
      <p>Then open the URL printed by Vite (usually http://localhost:5173).</p>
    </main>
  </body>
</html>`;

/** Create the Fastify instance without listening (testable). */
export async function createApiServer(deps: ApiDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const webDist = resolve(process.cwd(), 'web', 'dist');
  const hasWebDist = existsSync(webDist);
  const hasIndex = existsSync(resolve(webDist, 'index.html'));

  await app.register(cors, { origin: deps.config.server.corsOrigins });
  await registerApiRoutes(app, deps);

  if (hasWebDist) {
    await app.register(fastifyStatic, {
      root: webDist,
      prefix: '/',
      index: ['index.html'],
    });
  }

  app.setNotFoundHandler((request, reply) => {
    const isApi = request.url.startsWith('/api');
    if (request.method === 'GET' && !isApi) {
      if (hasIndex) {
        return reply.sendFile('index.html');
      }
      return reply.type('text/html').send(DEV_HINT_HTML);
    }
    return reply.status(404).send(apiError('NOT_FOUND', 'Route not found'));
  });

  app.setErrorHandler((error: unknown, request, reply) => {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    deps.logger.error('API request failed', {
      method: request.method,
      url: request.url,
      error: message,
    });
    const status = resolveStatusCode(error);
    const code = status === 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST';
    return reply.status(status).send(apiError(code, message));
  });

  return app;
}

/** Create and listen on the configured host and port. */
export async function startApiServer(deps: ApiDeps): Promise<FastifyInstance> {
  const app = await createApiServer(deps);
  await app.listen({
    host: deps.config.server.host,
    port: deps.config.server.port,
  });
  return app;
}
