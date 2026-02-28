import type { FastifyInstance } from 'fastify'

// RFC-0001 §11.1 — Registry API routes
// TODO: wire up storage backend (Cloudflare R2 / local)

export async function packsRoutes(fastify: FastifyInstance) {
  // GET /v1/packs/:scope/:name — list versions
  fastify.get('/:scope/:name', async (req, reply) => {
    reply.status(501).send({ error: 'not implemented' })
  })

  // GET /v1/packs/:scope/:name/:version — pack metadata
  fastify.get('/:scope/:name/:version', async (req, reply) => {
    reply.status(501).send({ error: 'not implemented' })
  })

  // POST /v1/packs/:scope/:name/:version/upload/init — initiate chunked upload
  fastify.post('/:scope/:name/:version/upload/init', async (req, reply) => {
    reply.status(501).send({ error: 'not implemented' })
  })

  // GET /v1/packs/:scope/:name/:version/bundle — full pack download
  fastify.get('/:scope/:name/:version/bundle', async (req, reply) => {
    reply.status(501).send({ error: 'not implemented' })
  })

  // GET /v1/packs/:scope/:name/:version/section/:id — partial section download
  fastify.get('/:scope/:name/:version/section/:sectionId', async (req, reply) => {
    reply.status(501).send({ error: 'not implemented' })
  })
}
