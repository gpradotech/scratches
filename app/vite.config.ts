import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {WorkspaceStore} from './server/store.ts';
import {workspaceApi} from './server/api.ts';
import {UpdateManager} from '../lib/updates.mjs';
import {updatesApi} from '../lib/updates-api.mjs';
import {feedbackApi} from '../lib/feedback-api.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const store = new WorkspaceStore(fileURLToPath(new URL('../dados/prototipo-02/workspace.json', import.meta.url)));
async function attachUpdates(server: {middlewares: {use: (handler: ReturnType<typeof updatesApi>) => void}; httpServer: {once: (event: string, handler: () => void) => void} | null}) {
  const manager = await new UpdateManager(root, {managed: false, busy: () => store.busy}).init();
  server.middlewares.use(updatesApi(manager));
  server.middlewares.use(feedbackApi());
  server.httpServer?.once('close', () => manager.close());
}
export default defineConfig({plugins: [react(), {
  name: 'scratches-local-workspace',
  async configureServer(server) {await attachUpdates(server);server.middlewares.use(workspaceApi(store));},
  async configurePreviewServer(server) {await attachUpdates(server);server.middlewares.use(workspaceApi(store));},
}], optimizeDeps: {include: ['iso-639-3']}, server: {host: '127.0.0.1'}, preview: {host: '127.0.0.1'}});
