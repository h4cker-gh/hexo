/** Dashboard HTTP API — Fastify server and routes. */

export { createApiServer, startApiServer } from './server.js';
export { registerApiRoutes, apiError } from './routes.js';
export type {
  ApiDeps,
  ApiErrorBody,
  DashboardAdapter,
  HealthResponse,
  SendMessageRequest,
  SendMessageResponse,
} from './types.js';
