# @vpack/client

Node.js client for loading and querying local `.vpack` artifacts.

## Usage

```ts
import { load } from '@vpack/client'

const kb = await load('./dist/pack.vpack')
const results = await kb.query('what is the product vision?')
```

By default, queries are embedded using the embedder plugin declared in the pack
manifest (for example `@vpack/embedder-xenova`). You can override embedding by
passing `embed`:

```ts
const kb = await load('./dist/pack.vpack', {
  embed: async (text, config, ctx) => myEmbed(text, config, ctx),
})
```
