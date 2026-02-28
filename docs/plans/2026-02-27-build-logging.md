# Build Logging Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve `vpack build` status output with chunking progress in spinner text and an embedding progress bar (no new deps).

**Architecture:** Extend `BuildReporter` with optional progress hooks, emit chunking/embedding updates in the build pipeline, and render them in the CLI using `ora` spinner text plus a simple ASCII bar.

**Tech Stack:** TypeScript, Vitest, ora.

---

### Task 1: Build pipeline progress hooks

**Files:**
- Modify: `packages/build/src/build-pipeline.ts`

**Step 1: Write failing test**

Add a new test in `packages/build/src/build-pipeline.test.ts` (see Task 3) that expects progress hooks to be called.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @vpack/build test`
Expected: FAIL with missing reporter hooks or counts.

**Step 3: Implement minimal progress reporting**

In `build-pipeline.ts`:
- Extend `BuildReporter` interface with optional hooks:
  - `onChunkProgress?(info: { source: string; docs: number; chunks: number }): void`
  - `onEmbedProgress?(info: { current: number; total: number }): void`
- Track `docsProcessed` and `chunksProduced` while chunking. After each document is fully chunked, call `reporter.onChunkProgress?.({ source: source.def.use, docs, chunks })`.
- During embedding vector assignment, call `reporter.onEmbedProgress?.({ current, total })` every 25 chunks and on the final chunk.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @vpack/build test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/build/src/build-pipeline.ts packages/build/src/build-pipeline.test.ts
git commit -m "feat(build): add progress hooks"
```

---

### Task 2: CLI rendering updates

**Files:**
- Modify: `packages/cli/src/commands/build.ts`

**Step 1: Write failing test (optional)**

If no CLI tests cover this, skip. Otherwise, add a minimal test that ensures reporter hooks can be passed.

**Step 2: Implement spinner text updates + embedding bar**

Add helper:
```ts
function renderBar(current: number, total: number, width = 20): string {
  const safeTotal = Math.max(total, 1)
  const ratio = Math.min(1, Math.max(0, current / safeTotal))
  const filled = Math.round(ratio * width)
  return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}]`
}
```

In `buildCommand`, implement reporter hooks:
- `onChunkProgress`: `spinner.text = 
  
`Chunking… ${docs} docs / ${chunks} chunks`
- `onEmbedProgress`: render bar + percent and counts:
  `Embedding… ${bar} ${Math.round(ratio*100)}% (${current}/${total})`

**Step 3: Run relevant tests**

Run: `pnpm --filter vpack test`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/cli/src/commands/build.ts
git commit -m "feat(cli): show build progress"
```

---

### Task 3: Build pipeline tests for progress hooks

**Files:**
- Modify: `packages/build/src/build-pipeline.test.ts`

**Step 1: Write failing test**

Add a test that builds a small pack with:
- 1 source producing 2 docs
- 1 chunker producing fixed chunks
- 1 embedder stub
- reporter mock collecting hook calls

Assertions:
- `onChunkProgress` called at least twice with docs 1,2 and increasing chunks.
- `onEmbedProgress` called at counts 25, 50, … and final count (use a test with e.g. 50 chunks to hit throttle).

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @vpack/build test`
Expected: FAIL with missing calls.

**Step 3: Ensure pass after Task 1**

Rerun: `pnpm --filter @vpack/build test`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/build/src/build-pipeline.test.ts
git commit -m "test(build): cover progress hooks"
```

---

### Task 4: Verification and context

**Files:**
- Modify: `tasks/context.md` (if significant)

**Step 1: Run full tests if needed**

Run: `pnpm test`
Expected: PASS

**Step 2: Update context**

Add a stopping point noting build progress improvements.

**Step 3: Commit (if context updated)**

```bash
git add tasks/context.md
git commit -m "docs: update stopping point"
```

