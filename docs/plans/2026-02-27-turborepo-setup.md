# Turborepo Setup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace root build/test/lint/typecheck scripts with Turborepo to enable local caching and parallelism, including Rust engine outputs.

**Architecture:** Add a `turbo.json` pipeline defining task dependencies, inputs, and outputs so Turbo can skip unchanged work. Update root `package.json` scripts to use `turbo run` and ensure the Rust native build outputs are captured for cache reuse.

**Tech Stack:** Turborepo, pnpm, TypeScript, Rust (napi), Vitest.

---

### Task 1: Audit current scripts and outputs

**Files:**
- Review: `package.json`
- Review: `packages/*/package.json`
- Review: `engine-rust/`

**Step 1: Enumerate repo scripts and outputs**
- Note current root scripts for `build`, `test`, `lint`, `typecheck`.
- Identify package build outputs (`dist/**`, `*.tsbuildinfo`) and native outputs (`packages/engine/native/**`).

**Step 2: Confirm no existing Turbo config**
- Check for `turbo.json` or `turbo` config in `package.json`.

### Task 2: Add Turbo dependency and config

**Files:**
- Modify: `package.json`
- Create: `turbo.json`

**Step 1: Add Turborepo dependency**
- Add `turbo` as a dev dependency in root `package.json`.

**Step 2: Create `turbo.json` pipeline**
- Define tasks: `build`, `test`, `lint`, `typecheck`, `dev`, `clean`.
- Set `dependsOn` so `build` depends on `^build` and `test` depends on `^build`.
- Define `outputs` for TS packages (`dist/**`, `*.tsbuildinfo`).
- For `@vpack/engine`, include `packages/engine/native/**` in `outputs`.
- Include `engine-rust/**` and `packages/engine/src/**` in `inputs` for `build` to ensure Rust changes invalidate cache.

### Task 3: Replace root scripts with Turbo

**Files:**
- Modify: `package.json`

**Step 1: Update scripts**
- Replace `build`, `test`, `lint`, `typecheck`, `dev`, `clean` with `turbo run ...` equivalents.
- Keep existing per-package scripts unchanged.

**Step 2: Ensure `turbo run` respects pnpm**
- Verify Turbo config uses standard task names and relies on package scripts.

### Task 4: Verify behavior locally

**Files:**
- None

**Step 1: Run build**
- Run: `pnpm run build`
- Expected: Turbo runs build tasks, no errors.

**Step 2: Re-run build to confirm caching**
- Run: `pnpm run build`
- Expected: Turbo reports cache hits for unchanged packages.

**Step 3: Run tests**
- Run: `pnpm run test`
- Expected: Turbo executes tests, respects `^build` dependency.

### Task 5: Document and stop

**Files:**
- Modify: `README.md`
- Modify: `tasks/context.md`

**Step 1: Update README**
- Note Turbo usage for build/test and local caching.

**Step 2: Add stopping point**
- Add a stopping point entry describing Turbo setup and verification status.

---

## Execution Notes
- No worktrees per user request.
- Local-only cache (no remote cache configuration).
