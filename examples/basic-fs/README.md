# basic-fs example

A tiny product strategy pack that demonstrates the VectorPack value proposition:
turn raw docs into a portable, queryable artifact.

## Run it

```bash
# Install deps
pnpm install

# Create example docs
mkdir -p docs

cat > docs/product-vision.md <<'DOC'
# Product vision memo

We win by being the default "knowledge compiler" for teams that already have a lot of docs but no way to make them queryable and portable.

The core promise is simple:
- build once
- query anywhere
- ship knowledge like a package

This is not a chatbot. It is a reproducible artifact. If a pack builds from a manifest today, it must build the same byte-for-byte artifact tomorrow. That is the trust anchor.
DOC

cat > docs/pricing.md <<'DOC'
# Pricing and packaging memo

Pricing should track the value of faster decision making, not storage.

The business model is a registry subscription with usage-based query costs. The pack format itself stays open so teams can self-host if they want.
DOC

cat > docs/positioning.md <<'DOC'
# Positioning memo

VectorPack is the package manager for knowledge, not another RAG tool.

The differentiation is that the output is a portable, verifiable artifact. Most RAG pipelines are process-heavy and non-reproducible. VectorPack makes a build pipeline deterministic and shareable.
DOC

# Build
vpack build

# Query examples
vpack query ./dist/pack.vpack "what is the product vision?"
vpack query ./dist/pack.vpack "how do we position VectorPack?"
vpack query ./dist/pack.vpack "how should pricing work?"

# Inspect
vpack inspect ./dist/pack.vpack
```

## What you get

A `dist/pack.vpack` artifact containing your documents, chunked and embedded,
ready to query from any adapter or push to the registry.

Note: the first build downloads the `Xenova/all-MiniLM-L6-v2` model via
`@xenova/transformers`, which may take a minute.
