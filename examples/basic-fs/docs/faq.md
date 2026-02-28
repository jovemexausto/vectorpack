# FAQ memo

Q: Why not just use a vector database?
A: A database is a service. VectorPack is a portable artifact. You can ship it, cache it, and query it without the original pipeline.

Q: Is this just another embedding wrapper?
A: No. The embedding step is a build phase. The real product is the compiled pack and the rules that make it reproducible.

Q: What makes this trustworthy?
A: Deterministic builds. The same manifest and inputs produce the same pack. You can verify provenance without trusting a server.
