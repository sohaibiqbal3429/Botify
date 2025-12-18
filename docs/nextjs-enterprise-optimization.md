# Next.js Enterprise Performance Blueprint (App Router, Node API, MongoDB, Redis, PM2, Nginx)

This playbook gives exact, production-ready settings to hit sub-100ms TTFB, zero-downtime deploys, and survive >1M concurrent users. Apply in order of the **Prioritized Roadmap** at the end.

## 1) Frontend Performance (Next.js App Router)
- **Rendering strategy by page type**
  - **Marketing/landing, docs, pricing, FAQ**: `generateStaticParams` + `revalidate: 86400` (ISR). Ship prebuilt HTML, auto-refresh daily.
  - **Blog/articles**: ISR with `revalidate: 600` and on-demand revalidation via webhook for publishes.
  - **Product catalog / public listings**: ISR with `revalidate: 120` + tag-based cache revalidation when inventory updates.
  - **Auth-gated dashboard shells**: **SSR on Edge Runtime** (`export const runtime = "edge"`) with streaming and `cache: "no-store"`. Hydrate critical widgets from Redis (see API caching below).
  - **User profiles / vanity URLs**: ISR with `revalidate: 300` + fallback blocking for new users.
  - **Search results, cart/checkout**: Dynamic route handlers with **server actions** + incremental hydration; avoid client data fetching.
- **Bundle diet**
  - Enforce **server components by default**; mark client code with `'use client'` only where interactivity is required.
  - Replace Moment/Lodash with **date-fns/lodash-es cherry-picks**; enable **modular imports** via `babel-plugin-lodash` if needed.
  - Use **next/font** for self-hosted fonts; remove external CSS/font blocking calls.
  - Add **Bundle Analyzer** in CI to block regressions: `next build --profile` and `ANALYZE=true next build` with size budget checks.
  - Turn on **swcMinify**, **modularizeImports**, and **removeConsole** in prod.
- **Caching, compression, prefetch**
  - In `next.config.mjs`: enable **`compression: true`**, **`poweredByHeader: false`**, `reactStrictMode: true`, **`images: { formats: ['image/avif', 'image/webp'] }`**.
  - Use **`prefetch={true}`** on critical `<Link>`s; leverage **Route Segment Config `dynamic = 'error'`** for static routes.
  - Add **`Cache-Control: public, max-age=31536000, immutable`** on hashed assets via Nginx (see config).
- **Edge/CDN**
  - Terminate TLS and serve static assets via **Cloudflare/Akamai**; enable **Full Page Cache** for ISR pages with **stale-while-revalidate**.
  - Route **Geo/AB experiments** to Edge Middleware; keep middleware logic <1ms and avoid network calls.

## 2) Backend & API Optimization (Next.js API routes / Route Handlers)
- **Non-blocking design**
  - Use **Edge Runtime** for read-most endpoints (`export const runtime = 'edge'`). Keep Node runtime only for endpoints requiring native modules (Mongoose/Redis client).
  - Avoid heavy startup: **initialize DB/Redis outside handler** once per module; reuse connections across invocations.
- **Caching & batching**
  - Introduce **read-through Redis** for hot GETs (dashboard counts, profile widgets): cache JSON for 30–120s with **cache tags**; bust via tag on mutation.
  - **Batch writes**: queue mutations to BullMQ (Redis) for non-critical paths (analytics events, email sends); respond immediately with 202.
  - Implement **`If-None-Match`/`ETag`** support for list endpoints; return 304 when unchanged.
- **Authentication (NextAuth)**
  - Use **JWT session strategy** with short TTL (15m) + sliding refresh; store signing keys in env-loaded `NEXTAUTH_SECRET`.
  - Offload session lookups: **cache user/session claims in Redis** keyed by token jti for 15m; invalidate on logout.
  - Place **NextAuth on Edge** where providers allow; otherwise keep Node handler warm with PM2 cluster.
- **Throughput hardening**
  - Set **HTTP timeouts** (Nginx proxy_read_timeout 30s) and **circuit breakers** (reject upstream if Mongo latency > threshold via opentelemetry/hedging).
  - Use **streaming responses** for large payloads; paginate with **cursor-based pagination** only.

## 3) MongoDB (Atlas + Mongoose) Scaling
- **Connection**: `maxPoolSize=200`, `minPoolSize=20`, `maxIdleTimeMS=60000`, `serverSelectionTimeoutMS=5000`, `socketTimeoutMS=30000`.
- **Indexes (examples)**
  - Users: `{ email: 1 }` unique; `{ status: 1, createdAt: -1 }`; `{ lastLoginAt: -1 }` with TTL for inactive temp accounts.
  - Sessions/logins: `{ userId: 1, createdAt: -1 }` TTL 30d via `expireAfterSeconds`.
  - Transactions/orders: compound `{ userId: 1, createdAt: -1 }`, `{ status: 1, createdAt: -1 }`, partial index on `{ status: 'pending' }`.
  - Metrics/analytics: **time-partitioned collections** (monthly) or **capped collections** for logs to avoid unbounded growth.
- **Query optimization**
  - Always use **`lean()`**, **field projections**, **readPreference=secondaryPreferred** for read-heavy widgets when replicas exist.
  - Replace `skip/limit` with **`_id` or `createdAt` cursors**.
  - Precompute aggregates via **scheduled workers** writing to Redis; serve dashboards from cache first.
- **Scaling writes**
  - Enable **Atlas sharding** on high-cardinality key (e.g., `userId`); co-locate analytical queries on dedicated **read replicas**.
  - Use **retryable writes** and **bulkWrite** for batch ingestion.

## 4) Redis & Queues (BullMQ / Rate Limiting)
- **Config**: `maxmemory 75%`, `maxmemory-policy allkeys-lru`, `tcp-keepalive 60`, `hz 10`, `timeout 0`, enable **AOF everysec** + **RDB 5m** snapshots.
- **Queues**
  - **BullMQ** with separate queues: `emails`, `webhooks`, `analytics`, `exports`. Concurrency tuned per CPU core; enable **backoff (exponential)** and **dead-letter queue** for poison messages.
  - **Idempotency keys** stored in Redis `SETNX` with TTL to avoid duplicate jobs.
- **Rate limiting**
  - Use **sliding window** or **token bucket** per IP/user via Redis LUA scripts; exempt authenticated premium tiers; enforce tighter limits on expensive routes.
- **Fail-safe**
  - Wrap cache calls with **timeouts + fallbacks**; if Redis is down, bypass cache and **short-circuit queues** to log-only mode to keep requests flowing.

## 5) PM2 & Node.js Runtime
- **Cluster mode**: `instances: 'max'` (one per core) with **`exec_mode: 'cluster'`** for API server; enable **`exp_backoff_restart_delay: 100`**.
- **Memory**: `node_args: ['--max-old-space-size=2048']`; set **`autorestart: true`** and **`max_memory_restart: '1G'`** to recycle leaky workers.
- **Zero downtime reload**: `pm2 reload ecosystem.config.cjs --update-env`. Use **graceful shutdown hooks** to close DB/Redis connections.
- **Health checks**: expose `/healthz` that verifies Mongo ping + Redis ping; tie PM2 `wait_ready: true`, `listen_timeout: 8000`.

### Example `ecosystem.config.cjs`
```js
module.exports = {
  apps: [
    {
      name: 'next-app',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 0.0.0.0 -p 3000',
      exec_mode: 'cluster',
      instances: 'max',
      wait_ready: true,
      listen_timeout: 8000,
      kill_timeout: 8000,
      max_memory_restart: '1G',
      node_args: ['--max-old-space-size=2048'],
      env: { NODE_ENV: 'production' }
    }
  ]
};
```

## 6) Nginx & Network
- **TLS & HTTP versions**: enable **HTTP/2 + HTTP/3 (QUIC)**; use **Brotli** preferred over gzip.
- **Keep-alive & buffering**: `keepalive_timeout 65`, `client_body_buffer_size 128k`, `proxy_buffering on`, `proxy_buffers 16 64k`, `proxy_busy_buffers_size 128k`, `proxy_read_timeout 30s`.
- **Security/performance headers**: `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Resource-Policy`, `Cache-Control` for assets.
- **DoS protection**: `limit_req zone=api burst=40 nodelay` for API; `limit_conn zone=addr 100`; enable **`proxy_cache_bypass`** on auth cookies to avoid caching private data.

### Example `/etc/nginx/sites-available/next.conf`
```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=STATIC:10m inactive=60m use_temp_path=off;
map $http_upgrade $connection_upgrade { default upgrade; '' close; }
map $http_cookie $no_cache { "*next-auth.session-token*" 1; default 0; }

server {
  listen 80;
  listen 443 ssl http2;
  listen 443 quic reuseport;
  server_name example.com;

  # SSL certs here

  brotli on;
  brotli_comp_level 6;
  gzip on; gzip_types text/plain text/css application/json application/javascript application/xml+rss image/svg+xml;

  location /_next/static/ {
    alias /var/www/app/.next/static/;
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_buffering on;
    proxy_buffers 16 64k;
    proxy_busy_buffers_size 128k;
    proxy_read_timeout 30s;
    proxy_cache STATIC;
    proxy_cache_valid 200 301 302 10m;
    proxy_cache_bypass $no_cache;
  }

  location /healthz { proxy_pass http://127.0.0.1:3000/healthz; }

  limit_req_zone $binary_remote_addr zone=api:10m rate=20r/s;
  limit_conn_zone $binary_remote_addr zone=addr:10m;
}
```

## 7) CI/CD & Builds (GitHub Actions)
- **Build speed**
  - Use **`pnpm` with `pnpm/action-setup`** + **Turbo/Next cache** stored in GitHub Actions cache keyed by `lockfile` + `next.config.mjs` hash.
  - Add **`NEXT_TELEMETRY_DISABLED=1`** during CI.
  - Run **`next lint`**, **`next test`**, **`next build`** with `NODE_OPTIONS=--max_old_space_size=4096` to avoid OOM.
- **Pipeline**
  - **Stages**: lint → test → build (artifact) → deploy → smoke test.
  - Build once, **upload `.next` + `node_modules/.prisma` (if used)** as artifact; deploy artifact to servers to avoid rebuilding on host.
  - Use **blue/green**: deploy to **`app-blue`** behind Nginx upstream; health check; switch symlink/upstream; keep **`app-green`** for instant rollback.
- **Rollback**: retain last 2 artifacts; `pm2 reload` pointing back to previous directory + Nginx upstream switch.

## 8) Horizontal Scaling Plan
- **Stateless backend**: store sessions in **JWT + Redis cache**; no local disk state. Use **object storage (S3)** for uploads.
- **Load balancer**: place **Nginx/HAProxy** or **cloud LB** in front of PM2 nodes; enable **sticky sessions only for WebSockets**, otherwise round-robin.
- **Shared cache/DB**: single Redis cluster + Mongo Atlas cluster with **read replicas**; ensure **`trust proxy`** set for real IP.
- **Autoscale**: use metrics (CPU>60%, p95 latency>150ms, queue depth) to scale PM2 hosts; run separate **worker nodes** for BullMQ queues.

## 9) Observability
- **Metrics**: p50/p95/p99 latency per route, cache hit rate, Mongo query time & pool usage, Redis command latency, queue depth, job failure rate, PM2 restarts, Nginx 4xx/5xx, GC pauses.
- **Tracing**: **OpenTelemetry** SDK for Node + **OTLP exporter** (Datadog/Tempo). Trace from Next API → Mongo → Redis → queues.
- **Logs**: structured JSON via `pino`; ship to Loki/ELK. Include request ID and user ID.
- **Alerting**: page when p99 > 300ms, cache hit rate < 70%, Mongo slow queries > 200ms, queue retries > 3%, error rate > 1% per minute.

## 10) Prioritized Roadmap (execute in order)
1. **CDN + Nginx static caching + Brotli** → instant asset wins.
2. **Page rendering split (ISR vs Edge SSR)** + bundle slimming and analyzer gates.
3. **Redis read-through cache + cursor pagination** on hottest APIs; add ETags.
4. **Mongo indexes & connection tuning** + move heavy aggregates to workers writing to Redis.
5. **PM2 cluster + health-checked zero-downtime reload** and `/healthz` endpoint.
6. **BullMQ queues with backoff + rate limiting** for expensive ops.
7. **GitHub Actions caching + artifact deploy + blue/green**.
8. **Observability stack + autoscaling thresholds** before traffic surge.
