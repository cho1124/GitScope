import simpleGit, { SimpleGit } from 'simple-git'

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

export class ForensicsService {
  private git: SimpleGit
  private repoPath: string

  constructor(repoPath: string) {
    this.repoPath = repoPath
    this.git = simpleGit({ baseDir: repoPath, maxConcurrentProcesses: 1 })
  }

  async getHeatmap(days: number = 90): Promise<HeatmapEntry[]> {
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split('T')[0]

    const raw = await this.git.raw([
      'log', '--numstat', `--since=${sinceStr}`,
      '--format=COMMIT_SEP%H\x1f%an\x1f%ae\x1f%aI', '--no-merges'
    ])

    const fileMap = new Map<string, HeatmapEntry>()

    let currentAuthor = ''
    let currentDate = ''

    for (const line of raw.split('\n')) {
      if (line.startsWith('COMMIT_SEP')) {
        const parts = line.replace('COMMIT_SEP', '').split('\x1f')
        currentAuthor = parts[1] || ''
        currentDate = parts[3] || ''
        continue
      }

      const match = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/)
      if (!match) continue

      const insertions = match[1] === '-' ? 0 : parseInt(match[1])
      const deletions = match[2] === '-' ? 0 : parseInt(match[2])
      const path = match[3]

      const existing = fileMap.get(path)
      if (existing) {
        existing.changes++
        existing.insertions += insertions
        existing.deletions += deletions
        if (!existing.authors.includes(currentAuthor)) {
          existing.authors.push(currentAuthor)
        }
        if (currentDate > existing.lastModified) {
          existing.lastModified = currentDate
        }
      } else {
        fileMap.set(path, {
          path,
          changes: 1,
          insertions,
          deletions,
          lastModified: currentDate,
          authors: [currentAuthor]
        })
      }
    }

    return Array.from(fileMap.values())
      .sort((a, b) => b.changes - a.changes)
  }

  async getHotspots(limit: number = 20): Promise<HotspotEntry[]> {
    const heatmap = await this.getHeatmap(180)

    return heatmap
      .map(entry => {
        const recentWeight = this.daysSince(entry.lastModified) < 30 ? 2 : 1
        const score =
          entry.changes * 3 +
          entry.authors.length * 5 +
          (entry.insertions + entry.deletions) * 0.01 +
          recentWeight * 10

        return {
          path: entry.path,
          score: Math.round(score * 10) / 10,
          changes: entry.changes,
          uniqueAuthors: entry.authors.length,
          avgChangesPerCommit: Math.round((entry.insertions + entry.deletions) / entry.changes),
          recentActivity: recentWeight === 2 ? 1 : 0
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  async getTrend(days: number = 180, buckets: number = 12): Promise<TrendBucket[]> {
    const now = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    const bucketSize = days / buckets

    const raw = await this.git.raw([
      'log', '--numstat', `--since=${start.toISOString().split('T')[0]}`,
      '--format=COMMIT_SEP%aI', '--no-merges'
    ])

    const result: TrendBucket[] = []
    for (let i = 0; i < buckets; i++) {
      const bucketStart = new Date(start)
      bucketStart.setDate(bucketStart.getDate() + i * bucketSize)
      const bucketEnd = new Date(start)
      bucketEnd.setDate(bucketEnd.getDate() + (i + 1) * bucketSize)

      result.push({
        label: bucketStart.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
        startDate: bucketStart.toISOString().split('T')[0],
        endDate: bucketEnd.toISOString().split('T')[0],
        commits: 0,
        filesChanged: 0,
        insertions: 0,
        deletions: 0
      })
    }

    let currentDate = ''
    const filesPerBucket = new Map<number, Set<string>>()

    for (const line of raw.split('\n')) {
      if (line.startsWith('COMMIT_SEP')) {
        currentDate = line.replace('COMMIT_SEP', '')
        const bucketIdx = this.getBucketIndex(currentDate, start, bucketSize, buckets)
        if (bucketIdx >= 0 && bucketIdx < buckets) {
          result[bucketIdx].commits++
        }
        continue
      }

      const match = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/)
      if (!match) continue

      const ins = match[1] === '-' ? 0 : parseInt(match[1])
      const del = match[2] === '-' ? 0 : parseInt(match[2])
      const path = match[3]

      const bucketIdx = this.getBucketIndex(currentDate, start, bucketSize, buckets)
      if (bucketIdx >= 0 && bucketIdx < buckets) {
        result[bucketIdx].insertions += ins
        result[bucketIdx].deletions += del
        if (!filesPerBucket.has(bucketIdx)) filesPerBucket.set(bucketIdx, new Set())
        filesPerBucket.get(bucketIdx)!.add(path)
      }
    }

    for (const [idx, files] of filesPerBucket) {
      result[idx].filesChanged = files.size
    }

    return result
  }

  async getContributors(): Promise<ContributorInfo[]> {
    const raw = await this.git.raw([
      'log', '--numstat', '--format=COMMIT_SEP%an\x1f%ae', '--no-merges'
    ])

    const authorMap = new Map<string, {
      name: string
      commits: number
      fileChanges: Map<string, number>
    }>()

    let currentAuthor = ''
    let currentEmail = ''

    for (const line of raw.split('\n')) {
      if (line.startsWith('COMMIT_SEP')) {
        const parts = line.replace('COMMIT_SEP', '').split('\x1f')
        currentAuthor = parts[0] || ''
        currentEmail = parts[1] || ''
        const key = currentEmail || currentAuthor
        const existing = authorMap.get(key)
        if (existing) {
          existing.commits++
        } else {
          authorMap.set(key, { name: currentAuthor, commits: 1, fileChanges: new Map() })
        }
        continue
      }

      const match = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/)
      if (!match) continue

      const path = match[3]
      const key = currentEmail || currentAuthor
      const author = authorMap.get(key)
      if (author) {
        author.fileChanges.set(path, (author.fileChanges.get(path) || 0) + 1)
      }
    }

    return Array.from(authorMap.entries())
      .map(([email, data]) => {
        const sortedFiles = Array.from(data.fileChanges.entries())
          .sort((a, b) => b[1] - a[1])

        return {
          name: data.name,
          email,
          commits: data.commits,
          filesOwned: sortedFiles.slice(0, 5).map(f => f[0]),
          topFiles: sortedFiles.slice(0, 10).map(f => ({ path: f[0], changes: f[1] }))
        }
      })
      .sort((a, b) => b.commits - a.commits)
  }

  private daysSince(dateStr: string): number {
    const date = new Date(dateStr)
    const now = new Date()
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  }

  private getBucketIndex(dateStr: string, start: Date, bucketSize: number, maxBuckets: number): number {
    const date = new Date(dateStr)
    const diffDays = (date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    const idx = Math.floor(diffDays / bucketSize)
    return Math.min(idx, maxBuckets - 1)
  }
}