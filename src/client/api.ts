import { invoke } from '@tauri-apps/api/core'

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

// ───── API ──────────────────────────────────────────────

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

  push: () => call<void>('push'),
  pull: () => call<void>('pull'),

  getFileTree: () => call<FileTreeNode[]>('get_file_tree'),

  getFileHistory: (filePath: string) =>
    call<CommitInfo[]>('get_file_history', { filePath }),

  getHeatmap: (opts?: { days?: number }) =>
    call<HeatmapEntry[]>('get_heatmap', { days: opts?.days ?? 90 }),

  getHotspots: (opts?: { limit?: number }) =>
    call<HotspotEntry[]>('get_hotspots', { limit: opts?.limit ?? 20 }),

  getTrend: (opts?: { days?: number; buckets?: number }) =>
    call<TrendBucket[]>('get_trend', { days: opts?.days ?? 180, buckets: opts?.buckets ?? 12 }),

  getContributors: () => call<ContributorInfo[]>('get_contributors'),
}