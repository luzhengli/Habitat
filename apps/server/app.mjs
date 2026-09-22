import {skillFiles} from './skill-files.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { scanInventory, readSkill } from './inventory.mjs';

const token = () => randomBytes(32).toString('hex');
const same = (a, b) => typeof a === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const capabilities = Object.freeze({ mode: 'local-web-bootstrap', readInventory: true, readSkill: true,
  metadataParser: false, grantRootsOverHttp: false, registerProject: false, manageCopies: false,
  planChanges: false, applyChanges: false, undo: false, runtimeDiscovery: false, cloudAccounts: false });
const STATIC_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" };

export function createApp({ root, grants = [], dev = false, catalog = null, operations = null, gitSources = null }) {
  const sessions = new Map();
  let lastSnapshot = null;
  let scanPromise = null;
  const scan = async () => {
    if (!scanPromise) scanPromise = scanInventory(grants).then(value => (lastSnapshot = value)).finally(() => { scanPromise = null; });
    return scanPromise;
  };
  const server = http.createServer(async (req, res) => {
    const requestId = token().slice(0, 16);
    for (const [key, value] of Object.entries(STATIC_HEADERS)) res.setHeader(key, value);
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    const error = (status, code, message) => json(status, { error: { code, message, requestId } });
    try {
      const port = server.address()?.port;
      const authority = `127.0.0.1:${port}`;
      if (req.headers.host !== authority) return error(403, 'HOST_REJECTED', 'Use the exact loopback address printed by Habitat.');
      const pathname = new URL(req.url ?? '/', `http://${authority}`).pathname;
      const origins = new Set([`http://${authority}`, ...(dev ? ['http://127.0.0.1:5173'] : [])]);
      const origin = req.headers.origin;
      if (origin !== undefined && !origins.has(origin)) return error(403, 'ORIGIN_REJECTED', 'Origin not authorized.');
      const fetchSite = req.headers['sec-fetch-site'];
      if (fetchSite === 'cross-site' || (fetchSite === 'same-site' && !(origin && origins.has(origin)))) return error(403, 'FETCH_SITE_REJECTED', 'Cross-site requests are not accepted.');
      if (pathname.startsWith('/api/')) {
        if (req.headers['x-habitat-client'] !== 'habitat-web') return error(403, 'CLIENT_HEADER_REQUIRED', 'Use the Habitat same-origin client.');
        // No permissive CORS, no OPTIONS grant, no state-changing GET route.
        if (pathname === '/api/v1/session' && req.method === 'GET') {
          const now = Date.now();
          const existingId=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('habitat_session='))?.slice(16);
          const existing=existingId&&sessions.get(existingId);
          if(existing&&existing.expiresAt>now)return json(200,{csrfToken:existing.csrf,expiresAt:existing.expiresAt});
          for (const [id, value] of sessions) if (value.expiresAt <= now) sessions.delete(id);
          if (sessions.size >= 64) return error(429, 'SESSION_LIMIT', 'Too many active bootstrap sessions; retry after expiration or restart.');
          const id = token(), csrf = token();
          const session = { csrf, expiresAt: now + 3600000 };
          sessions.set(id, session);
          res.setHeader('Set-Cookie', `habitat_session=${id}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=3600`);
          return json(200, { csrfToken: csrf, expiresAt: session.expiresAt });
        }
        const id = req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith('habitat_session='))?.slice(16);
        const session = id && sessions.get(id);
        if (!session || session.expiresAt <= Date.now()) return error(401, 'SESSION_REQUIRED', 'Local session missing or expired.');
        if (!same(req.headers['x-habitat-csrf'], session.csrf)) return error(403, 'CSRF_REJECTED', 'Invalid session request token.');
        if (catalog) {
          const url = new URL(req.url, `http://${authority}`);
          let body = {};
          if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
            if (!req.headers['content-type']?.startsWith('application/json')) return error(415, 'JSON_REQUIRED', 'Use application/json.');
            const chunks = []; let size = 0;
            for await (const chunk of req) { size += chunk.length; if (size > 16384) return error(413, 'BODY_LIMIT', 'Request exceeds 16 KiB.'); chunks.push(chunk); }
            try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return error(422, 'INVALID_JSON', 'Invalid JSON body.'); }
            if (!body || Array.isArray(body) || typeof body !== 'object') return error(422, 'INVALID_INPUT', 'Expected an object.');
          }
          if (pathname === '/api/v1/export' && req.method === 'GET') return json(200,{schemaVersion:1,exportedAt:new Date().toISOString(),sources:catalog.list('source'),skills:catalog.list('skill'),projects:catalog.list('project'),bindings:catalog.list('binding'),operations:catalog.list('operation')});
          if (pathname === '/api/v1/capabilities' && req.method === 'GET') return json(200, {...capabilities, mode:'local-web', metadataParser:true, grantRootsOverHttp:true, persistentIndex:true, publicGit:!!gitSources, registerProject:!!operations, manageCopies:!!operations, planChanges:!!operations, applyChanges:!!operations, undo:!!operations, authorizedRoots:catalog.grants().length});
          if (gitSources) {
            if(pathname === '/api/v1/git-candidates' && req.method === 'POST') return json(201,await gitSources.download(body));
            if(pathname === '/api/v1/git-sources' && req.method === 'POST') return json(201,await gitSources.accept(body));
            if(pathname === '/api/v1/source-checks' && req.method === 'POST') return json(201,await gitSources.check(body));
          }
          if (operations) {
            const draftMatch = /^\/api\/v1\/projects\/([a-zA-Z0-9-]+)\/draft$/.exec(pathname);
            if (draftMatch) {
              const p=catalog.get('project',draftMatch[1]);if(!p)return error(404,'NOT_FOUND','Unknown project.');
              if(req.method==='GET')return json(200,catalog.get('draft',p.id)??{id:p.id,changes:[],revision:p.revision,generation:0});
              if(req.method==='PATCH'){if(body.revision!==p.revision)return error(409,'REVISION_CHANGED','项目版本已变化');const previous=catalog.get('draft',p.id);if(body.generation!==(previous?.generation??0))return error(409,'DRAFT_CHANGED','另一个标签页已更改草稿，请刷新');if(!Array.isArray(body.changes)||body.changes.length>50)return error(422,'INVALID_DRAFT','Invalid draft.');return json(200,catalog.put('draft',{id:p.id,changes:body.changes,revision:p.revision,generation:(previous?.generation??0)+1}));}
            }

            if (pathname === '/api/v1/projects' && req.method === 'GET') return json(200,{items:catalog.list('project')});
            if (pathname === '/api/v1/projects' && req.method === 'POST') return json(201,await operations.project(body));
            const projectMatch = /^\/api\/v1\/projects\/([a-zA-Z0-9-]+)(\/exposures)?$/.exec(pathname);
            if (projectMatch && req.method === 'GET') return json(200,await operations.exposures(projectMatch[1]));
            if (projectMatch && req.method === 'DELETE') {const p=catalog.get('project',projectMatch[1]);if(!p)return error(404,'NOT_FOUND','Project unknown');return json(200,catalog.put('project',{...p,revokedAt:new Date().toISOString(),revision:p.revision+1}));}
            if (pathname === '/api/v1/plans' && req.method === 'POST') return json(201,await operations.plan(body));
            if (pathname === '/api/v1/operations' && req.method === 'POST') return json(202,await new Promise((resolve,reject)=>{operations.execute(body,resolve).then(resolve,reject);}));
            if (pathname === '/api/v1/operations' && req.method === 'GET') return json(200,{items:catalog.list('operation').reverse()});
            const cancelMatch=/^\/api\/v1\/operations\/([a-zA-Z0-9-]+)\/cancel$/.exec(pathname);
            if(cancelMatch&&req.method==='POST'){const op=catalog.get('operation',cancelMatch[1]);if(op?.status!=='running')return error(409,'NOT_RUNNING','操作不在执行中');catalog.put('cancellation',{id:op.id,requestedAt:new Date().toISOString()});return json(202,{operationId:op.id,status:'cancel-requested',message:'在下一个安全边界停止并补偿'});}
            const opMatch = /^\/api\/v1\/operations\/([a-zA-Z0-9-]+)$/.exec(pathname);
            if (opMatch && req.method === 'GET') {const op=catalog.get('operation',opMatch[1]);return op?json(200,op):error(404,'NOT_FOUND','Operation unknown');}
            if (pathname === '/api/v1/diagnostics' && req.method === 'POST') return json(200,await operations.exposures(body.projectId));
          }
          if (pathname === '/api/v1/sources' && req.method === 'GET') return json(200, {items:catalog.list('source')});
          if (pathname === '/api/v1/sources' && req.method === 'POST') return json(201, await catalog.authorize(body));
          const sourceMatch = /^\/api\/v1\/sources\/([a-zA-Z0-9-]+)$/.exec(pathname);
          if (sourceMatch && req.method === 'DELETE') return json(200, catalog.revoke(sourceMatch[1]));
          if (pathname === '/api/v1/scans' && req.method === 'POST') return json(202, await catalog.scan());
          const jobMatch = /^\/api\/v1\/jobs\/([a-zA-Z0-9-]+)$/.exec(pathname);
          if (jobMatch && req.method === 'GET') { const job = catalog.get('job',jobMatch[1]); return job ? json(200,job) : error(404,'NOT_FOUND','Unknown job.'); }
          if (pathname === '/api/v1/inventory' && req.method === 'GET') return json(200,catalog.inventory());
          if (pathname === '/api/v1/skills' && req.method === 'GET') {
            const q = (url.searchParams.get('q') ?? '').toLowerCase();
            const offset = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 50);
            if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) return error(422,'INVALID_PAGE','Invalid pagination.');
            const all = catalog.inventory().skills.filter(s => `${s.declaredName ?? ''} ${s.description ?? ''} ${s.path}`.toLowerCase().includes(q));
            return json(200,{items:all.slice(offset,offset+limit),total:all.length,nextOffset:offset+limit<all.length?offset+limit:null});
          }
          const filesMatch=/^\/api\/v1\/skills\/([a-zA-Z0-9-]+)\/files(?:\/([a-f0-9]{24}))?$/.exec(pathname);
          if(filesMatch&&req.method==='GET')return json(200,await skillFiles(catalog,filesMatch[1],filesMatch[2]));
          const skillMatch = /^\/api\/v1\/skills\/([a-zA-Z0-9-]+)(\/preferences|\/files\/skill-md)?$/.exec(pathname);
          if (skillMatch && req.method === 'GET' && skillMatch[2] !== '/preferences') return json(200,await catalog.read(skillMatch[1]));
          if (skillMatch && req.method === 'PATCH' && skillMatch[2] === '/preferences') return json(200,catalog.preferences(skillMatch[1],body));
          return error(req.method === 'GET' ? 404 : 501,'NOT_IMPLEMENTED','Capability not implemented.');
        }
        if (req.method !== 'GET') return error(501, 'NOT_IMPLEMENTED', 'This bootstrap has no filesystem mutation endpoints.');
        if (pathname === '/api/v1/capabilities') return json(200, { ...capabilities, authorizedRoots: grants.length });
        if (pathname === '/api/v1/sources') return json(200, { items: grants.map(g => ({ id: g.id, path: g.path, permission: 'read-only' })) });
        if (pathname === '/api/v1/inventory') return json(200, await scan());
        const match = /^\/api\/v1\/skills\/([a-f0-9]{24})$/.exec(pathname);
        if (match) {
          const skill = lastSnapshot?.skills.find(s => s.id === match[1]);
          if (!skill) return error(404, 'SKILL_UNKNOWN', 'Refresh inventory and use a returned skill ID.');
          try { return json(200, await readSkill(grants, skill)); } catch (e) { return error(409, 'SOURCE_CHANGED', e.message); }
        }
        return error(404, 'NOT_FOUND', 'Unknown API route.');
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return error(405, 'METHOD_NOT_ALLOWED', 'Read-only static routes.');
      let file, contentType;
      if (pathname === '/demo' || pathname === '/demo/') {
        const nonce = token();
        let html = await fs.readFile(path.join(root, 'reference/air/Habitat-Air.html'), 'utf8');
        html = html.replace('<div id="root"></div><script>', `<div id="root"></div><script nonce="${nonce}">`);
        res.setHeader('Content-Security-Policy', STATIC_HEADERS['Content-Security-Policy'].replace("script-src 'self'", `script-src 'self' 'nonce-${nonce}'`));
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(req.method === 'HEAD' ? undefined : html);
      }
      const explicit = { '/bootstrap.css': ['apps/bootstrap/style.css', 'text/css'], '/bootstrap.js': ['apps/bootstrap/client.mjs', 'text/javascript'], '/favicon.ico': [null, null] };
      if (pathname in explicit) {
        const value = explicit[pathname];
        if (!value[0]) { res.writeHead(204); return res.end(); }
        file = path.join(root, value[0]); contentType = value[1];
      } else {
        // Serve only Vite-built static files beneath dist. Never expose repository source or user roots.
        const dist = path.join(root, 'apps/web/dist');
        let hasBuild = false;
        try { hasBuild = (await fs.stat(path.join(dist, 'index.html'))).isFile(); } catch {}
        if (pathname === '/') {
          file = hasBuild ? path.join(dist, 'index.html') : path.join(root, 'apps/bootstrap/index.html');
          contentType = 'text/html';
        } else if (hasBuild && /^\/assets\/[A-Za-z0-9_.-]+\.(js|css|svg|png|woff2)$/.test(pathname)) {
          file = path.join(dist, pathname.slice(1));
          contentType = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' }[path.extname(file)];
        } else if (hasBuild && /^\/(?:(?:library|projects)(?:\/[A-Za-z0-9_-]+)?|issues|history|settings)$/.test(pathname)) {
          file = path.join(dist, 'index.html'); contentType = 'text/html';
        } else return error(404, 'NOT_FOUND', 'Unknown resource.');
      }
      const data = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': `${contentType}${contentType?.startsWith('text/') ? '; charset=utf-8' : ''}` });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (e) { if (!res.headersSent) error(e.status ?? 500, e.code && e.status ? e.code : 'INTERNAL_ERROR', e.status ? e.message : 'Operation failed; check source permissions and service state.'); else res.end(); }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.maxHeadersCount = 50;
  return server;
}
