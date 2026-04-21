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

export const api = {
  openRepo: (path: string) => call('open_repo', { path }),

  getLog: (opts?: { maxCount?: number; file?: string }) =>
    call('get_log', {
      maxCount: opts?.maxCount ?? 200,
      file: opts?.file ?? null,
    }),

  getStatus: () => call('get_status'),

  getDiff: (hash: string) => call('get_diff', { hash }),

  stage: (files: string[]) => call('stage', { files }),

  commit: (message: string) => call('commit', { message }),

  getBranches: () => call('get_branches'),

  checkout: (branch: string) => call('checkout', { branch }),

  push: () => call('push'),
  pull: () => call('pull'),

  getFileTree: () => call('get_file_tree'),

  getFileHistory: (filePath: string) =>
    call('get_file_history', { filePath }),

  getHeatmap: (opts?: { days?: number }) =>
    call('get_heatmap', { days: opts?.days ?? 90 }),

  getHotspots: (opts?: { limit?: number }) =>
    call('get_hotspots', { limit: opts?.limit ?? 20 }),

  getTrend: (opts?: { days?: number; buckets?: number }) =>
    call('get_trend', { days: opts?.days ?? 180, buckets: opts?.buckets ?? 12 }),

  getContributors: () => call('get_contributors'),
}
