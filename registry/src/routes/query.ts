import type { FastifyInstance } from 'fastify'

// RFC-0001 §11.3 — Query-on-registry (verified packs only)
// Client sends plain text → registry embeds → HNSW traversal → ranked chunks
// TODO: implement once storage + embed model runner are wired up

export async function queryRoutes(fastify: FastifyInstance) {
  fastify.post('/:scope/:name/:version/query', async (req, reply) => {
    // TODO:
    // 1. Load pack from storage by (scope, name, version)
    // 2. Check pack tier — return 403 if not verified
    // 3. Embed req.body.query using the model declared in pack manifest
    // 4. Run HNSW query via engine
    // 5. Return ranked chunks with model metadata in response
    reply.status(501).send({ error: 'query-on-registry not yet implemented' })
  })
}
