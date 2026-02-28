import Fastify from 'fastify'
import { packsRoutes } from './routes/packs.js'
import { queryRoutes } from './routes/query.js'

const server = Fastify({ logger: true })

async function start() {
  // ── Routes ──────────────────────────────────────────────────────────────────
  await server.register(packsRoutes, { prefix: '/v1/packs' })
  await server.register(queryRoutes, { prefix: '/v1/packs' })

  // ── Health ──────────────────────────────────────────────────────────────────
  server.get('/health', async () => ({ status: 'ok', version: '0.1.0' }))

  // ── Start ───────────────────────────────────────────────────────────────────
  const port = Number(process.env['PORT'] ?? 3000)
  const host = process.env['HOST'] ?? '0.0.0.0'

  await server.listen({ port, host })
}

start().catch((err) => {
  server.log.error(err)
  process.exit(1)
})
