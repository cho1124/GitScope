const BASE = '/api'

async function request(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  })
  return res.json()
}

export const api = {
  openRepo: (path: string) =>
    request('/repo/open', { method: 'POST', body: JSON.stringify({ path }) }),

  getLog: (opts?: { maxCount?: number; file?: string }) => {
    const params = new URLSearchParams()
    if (opts?.maxCount) params.set('maxCount', String(opts.maxCount))
    if (opts?.file) params.set('file', opts.file)
    return request(`/git/log?${params}`)
  },

  getStatus: () => request('/git/status'),

  getDiff: (hash: string) => request(`/git/diff/${hash}`),

  stage: (files: string[]) =>
    request('/git/stage', { method: 'POST', body: JSON.stringify({ files }) }),

  commit: (message: string) =>
    request('/git/commit', { method: 'POST', body: JSON.stringify({ message }) }),

  getBranches: () => request('/git/branches'),

  checkout: (branch: string) =>
    request('/git/checkout', { method: 'POST', body: JSON.stringify({ branch }) }),

  push: () => request('/git/push', { method: 'POST' }),
  pull: () => request('/git/pull', { method: 'POST' }),

  getFileTree: () => request('/git/tree'),

  getFileHistory: (filePath: string) =>
    request(`/git/file-history?path=${encodeURIComponent(filePath)}`),

  getHeatmap: (opts?: { days?: number }) =>
    request(`/forensics/heatmap?days=${opts?.days ?? 90}`),

  getHotspots: (opts?: { limit?: number }) =>
    request(`/forensics/hotspots?limit=${opts?.limit ?? 20}`),

  getTrend: (opts?: { days?: number; buckets?: number }) =>
    request(`/forensics/trend?days=${opts?.days ?? 180}&buckets=${opts?.buckets ?? 12}`),

  getContributors: () => request('/forensics/contributors')
}