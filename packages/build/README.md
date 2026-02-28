# @vpack/build

Node.js build pipeline orchestrator for VectorPack. Runs the plugin pipeline and
produces a `.vpack` artifact.

## Usage

```ts
import { buildPack } from '@vpack/build'

await buildPack({
  manifest,
  manifestPath: 'vpack.yml',
  output: './dist/pack.vpack',
})
```
