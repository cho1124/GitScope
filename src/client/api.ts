import { invoke, Channel } from '@tauri-apps/api/core'

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<ApiResult<T>> {
  try {
    const data = await invoke<T>(cmd, args)
    return { ok: true, data }
  } catch (e: unknown) {
    return { ok: false, error: typeof e === 'string' ? e : String(e) }
  }
}

// ───── Shared types ─────────────────────────────────────

export interface RepoInfo {
  path: string
  currentBranch: string
  lastCommit: { hash: string; message: string; date: string } | null
}

export interface CommitInfo {
  hash: string
  hashShort: string
  message: string
  author: string
  email: string
  date: string
  refs: string
  parents: string[]
}

export interface StatusInfo {
  current: string
  not_added: string[]
  modified: string[]
  deleted: string[]
  staged: string[]
  conflicted: string[]
  created: string[]
  renamed: string[]
}

export interface BranchInfo {
  current: string
  all: string[]
}

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

export interface CommitResult {
  hash: string
  summary: unknown
}

// Forensics types (loose — UI는 필요한 필드만 읽음)
export interface HeatmapEntry {
  path: string
  changes: number
  insertions: number
  deletions: number
  lastModified: string
  authors: string[]
}

export interface HotspotEntry {
  path: string
  score: number
  changes: number
  uniqueAuthors: number
  avgChangesPerCommit: number
  recentActivity: number
}

export interface TrendBucket {
  label: string
  startDate: string
  endDate: string
  commits: number
  filesChanged: number
  insertions: number
  deletions: number
}

export interface ContributorInfo {
  name: string
  email: string
  commits: number
  filesOwned: string[]
  topFiles: { path: string; changes: number }[]
}

export interface RecentRepo {
  path: string
  name: string
  lastOpened: string
}

export interface StashEntry {
  index: number
  refName: string
  branch: string
  message: string
}

// Symbol: 파일 안의 함수/클래스/메서드 등 (Phase 9-A)
export interface Symbol {
  name: string
  kind: string   // "function" | "class" | "method" | "interface" | "enum" | "type" | "struct" | "trait" | "impl" | "mod"
  startLine: number
  endLine: number
}

// Forensics progress event (Phase 7-1)
export type ProgressEvent =
  | { stage: 'cacheHit' }
  | { stage: 'counting' }
  | { stage: 'scanning'; current: number; total: number }
  | { stage: 'aggregating' }

// ───── API ──────────────────────────────────────────────

function mkProgressChannel(handler?: (e: ProgressEvent) => void): Channel<ProgressEvent> {
  const ch = new Channel<ProgressEvent>()
  if (handler) ch.onmessage = handler
  return ch
}

export const api = {
  openRepo: (path: string) => call<RepoInfo>('open_repo', { path }),

  getLog: (opts?: { maxCount?: number; file?: string }) =>
    call<CommitInfo[]>('get_log', {
      maxCount: opts?.maxCount ?? 200,
      file: opts?.file ?? null,
    }),

  getStatus: () => call<StatusInfo>('get_status'),

  getDiff: (hash: string) => call<string>('get_diff', { hash }),

  stage: (files: string[]) => call<void>('stage', { files }),

  commit: (message: string) => call<CommitResult>('commit', { message }),

  getBranches: () => call<BranchInfo>('get_branches'),

  checkout: (branch: string) => call<void>('checkout', { branch }),

  createBranch: (name: string, checkout?: boolean) =>
    call<void>('create_branch', { name, checkout: checkout ?? false }),

  deleteBranch: (name: string, force?: boolean) =>
    call<void>('delete_branch', { name, force: force ?? false }),

  mergeBranch: (name: string, noFf?: boolean) =>
    call<string>('merge_branch', { name, noFf: noFf ?? false }),

  // ── Cherry-pick (Phase 8-A) ──────────────────────────
  cherryPick: (hash: string, opts?: { noCommit?: boolean; mainline?: number }) =>
    call<void>('cherry_pick', {
      hash,
      noCommit: opts?.noCommit ?? false,
      mainline: opts?.mainline ?? null,
    }),
  cherryPickAbort: () => call<void>('cherry_pick_abort'),
  cherryPickContinue: () => call<void>('cherry_pick_continue'),
  cherryPickInProgress: () => call<boolean>('cherry_pick_in_progress'),

  // ── Reset (Phase 8-B) ────────────────────────────────
  reset: (hash: string, mode: 'soft' | 'mixed' | 'hard') =>
    call<void>('reset', { hash, mode }),

  // ── Rebase (Phase 8-C) ───────────────────────────────
  rebase: (target: string) => call<void>('rebase', { target }),
  rebaseAbort: () => call<void>('rebase_abort'),
  rebaseContinue: () => call<void>('rebase_continue'),
  rebaseSkip: () => call<void>('rebase_skip'),
  rebaseInProgress: () => call<boolean>('rebase_in_progress'),

  // ── Interactive rebase (Phase 8-D) ───────────────────
  listCommitsInRange: (from: string) =>
    call<CommitInfo[]>('list_commits_in_range', { from }),
  interactiveRebase: (from: string, operations: Array<{ hash: string; action: 'pick' | 'drop' }>) =>
    call<void>('interactive_rebase', { from, operations }),

  push: () => call<void>('push'),
  pull: () => call<void>('pull'),

  getFileTree: () => call<FileTreeNode[]>('get_file_tree'),

  getDirectoryChildren: (relPath: string) =>
    call<FileTreeNode[]>('get_directory_children', { relPath }),

  getFileHistory: (filePath: string) =>
    call<CommitInfo[]>('get_file_history', { filePath }),

  getRecentRepos: () => call<RecentRepo[]>('get_recent_repos'),

  removeRecentRepo: (path: string) => call<void>('remove_recent_repo', { path }),

  clearRecentRepos: () => call<void>('clear_recent_repos'),

  // ── Forensics (with progress streaming) ─────────────
  getHeatmap: (opts?: { days?: number; onProgress?: (e: ProgressEvent) => void }) =>
    call<HeatmapEntry[]>('get_heatmap', {
      days: opts?.days ?? 90,
      onProgress: mkProgressChannel(opts?.onProgress),
    }),

  getHotspots: (opts?: { limit?: number; onProgress?: (e: ProgressEvent) => void }) =>
    call<HotspotEntry[]>('get_hotspots', {
      limit: opts?.limit ?? 20,
      onProgress: mkProgressChannel(opts?.onProgress),
    }),

  getTrend: (opts?: {
    days?: number
    buckets?: number
    onProgress?: (e: ProgressEvent) => void
  }) =>
    call<TrendBucket[]>('get_trend', {
      days: opts?.days ?? 180,
      buckets: opts?.buckets ?? 12,
      onProgress: mkProgressChannel(opts?.onProgress),
    }),

  getContributors: (opts?: { onProgress?: (e: ProgressEvent) => void }) =>
    call<ContributorInfo[]>('get_contributors', {
      onProgress: mkProgressChannel(opts?.onProgress),
    }),

  // ── Stash ────────────────────────────────────────────
  stashList: () => call<StashEntry[]>('stash_list'),

  stashSave: (message?: string, includeUntracked?: boolean) =>
    call<void>('stash_save', {
      message: message ?? null,
      includeUntracked: includeUntracked ?? false,
    }),

  stashApply: (refName: string) => call<void>('stash_apply', { refName }),
  stashPop: (refName: string) => call<void>('stash_pop', { refName }),
  stashDrop: (refName: string) => call<void>('stash_drop', { refName }),
  stashShow: (refName: string) => call<string>('stash_show', { refName }),

  // ── Working tree diff ────────────────────────────────
  getUnstagedDiff: (file: string) => call<string>('get_unstaged_diff', { file }),
  getStagedDiff: (file: string) => call<string>('get_staged_diff', { file }),

  // ── Symbols (Phase 9) ────────────────────────────────
  getSymbols: (filePath: string) =>
    call<Symbol[]>('get_symbols', { filePath }),

  getSymbolHistory: (filePath: string, startLine: number, endLine: number) =>
    call<CommitInfo[]>('get_symbol_history', { filePath, startLine, endLine }),
}