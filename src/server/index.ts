import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'
import { GitService } from './git-service.js'
import { ForensicsService } from './forensics-service.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
app.use(cors())
app.use(express.json())

// Production: serve built frontend
const clientDist = join(__dirname, '../../dist/client')
if (existsSync(clientDist)) {
  app.use(express.static(clientDist))
}

let gitService: GitService | null = null
let forensicsService: ForensicsService | null = null

// ── Repo ──────────────────────────────────────────────────

app.post('/api/repo/open', async (req, res) => {
  try {
    const { path: repoPath } = req.body
    if (!repoPath) return res.json({ ok: false, error: 'path required' })

    gitService = new GitService(repoPath)
    forensicsService = new ForensicsService(repoPath)
    const isRepo = await gitService.isGitRepo()
    if (!isRepo) return res.json({ ok: false, error: 'Not a git repository' })

    const info = await gitService.getRepoInfo()
    res.json({ ok: true, data: info })
  } catch (e: any) {
    res.json({ ok: false, error: e.message })
  }
})

// ── Git ───────────────────────────────────────────────────

app.get('/api/git/log', async (req, res) => {
  if (!gitService) return res.json({ ok: false, error: 'No repo open' })
  try {
    const maxCount = parseInt(req.query.maxCount as string) || 200
    const file = req.query.file as string | undefined
    const log = await gitService.getLog(maxCount, file)
    res.json({ ok: true, data: log })
  } catch (e: any) {
    res.json({ ok: false, error: e.message })
  }
})

app.get('/api/git/status', async (req, res) => {
  if (!gitService) return res.json({ ok: false, error: 'No repo open' })
  try {
    const status = await gitService.getStatus()
    res.json({ ok: true, data: status })
  } catch (e: any) {
    res.json({ ok: false, error: e.message })
  }
})

app.get('/api/git/diff/:hash', async (req, res) => {
  if (!gitService) return res.json({ ok: false, error: 'No repo open' })
  try {
    const diff = await gitService.getDiff(req.params.hash)
    res.json({ ok: true, data: diff })
  } catch (e: any) {
    res.json({ ok: false, error: e.message })
  }
})

app.post('/api/git/stage', async (req, res) => {
  if (!gitService) return res.json({ ok: false, error: 'No repo open' })
  try {
    await gitService.stage(req.body.files)
    res.json({ ok: true })
  } catch (e: any) {
    res.json({ ok: false, error: e.message })
  }
})

app.post('/api/git/commit', async (req, res) => {
  if (!gitService) return res.json({ ok: false, error: 'No repo open' })
  try {
    const result = await gitService.commit(req.body.message)
    res.json({ ok: true, data: result })
  } catch (e: any) {
    res.json({ ok: false, error: e.message })
  }
})

app.get('/api/git/branches', async (req, res) => {
  if (!gitService) return res.json({ ok: false, error: 'No repo open' })
  try {
    const branches = await gitService.getBranches()
    res.json({ ok: true, data: branches })
  } catch (e: any) {
    res.json({ ok: false, error: e.message })
  }
})

app.post('/api/git/checkout', async (req, res) => {
  if (!gitService) return res.json({ ok: false, error: 'No repo open' })
  try {
    await gitService.checkout(req.body.branch)
    res.json({ ok: true })
  } catch (e: any) {
    res.json({ ok: false, error: e.message })
  }
})

app.post('/api/git/push', async (req, res) => {
  if (!gitService) return res.json({ ok: false, error: 'No repo open' })
  try {
    await gitService.push()
    res.json({ ok: true })
  } catch (e: any) {
    res.json({ ok: false, error: e.message })
  }
})

app.post('/api/git/pull', async (req, res) => {
  if (!gitService) return res.json({ ok: false, error: 'No repo open' })
  try {
    await gitService.pull()
    res.json({ ok: true })
  } catch (e: any) {
    res.json({ ok: false, error: e.message })
  }
})

app.get('/api/git/tree', async (req, res) => {
  if (!gitService) return res.json({ ok: false, error: 'No repo open' })
  try {
    const tree = await gitService.getFileTree()
    res.json({ ok: true, data: tree })
  } catch (e: any) {
    res.json({ ok: false, error: e.message })
  }
})

app.get('/api/git/file-history', async (req, res) => {
  if (!gitService) return res.json({ ok: false, error: 'No repo open' })
  try {
    const filePath = req.query.path as string
    if (!filePath) return res.json({ ok: false, error: 'path required' })
    const history = await gitService.getFileHistory(filePath)
    res.json({ ok: true, data: history })
  } catch (e: any) {
    res.json({ ok: false, error: e.message })
  }
})

// ── Forensics ─────────────────────────────────────────────

app.get('/api/forensics/heatmap', async (req, res) => {
  if (!forensicsService) return res.json({ ok: false, error: 'No repo open' })
  try {
    const days = parseInt(req.query.days as string) || 90
    const data = await forensicsService.getHeatmap(days)
    res.json({ ok: true, data })
  } catch (e: any) {
    res.json({ ok: false, error: e.message })
  }
})

app.get('/api/forensics/hotspots', async (req, res) => {
  if (!forensicsService) return res.json({ ok: false, error: 'No repo open' })
  try {
    const limit = parseInt(req.query.limit as string) || 20
    const data = await forensicsService.getHotspots(limit)
    res.json({ ok: true, data })
  } catch (e: any) {
    res.json({ ok: false, error: e.message })
  }
})

app.get('/api/forensics/trend', async (req, res) => {
  if (!forensicsService) return res.json({ ok: false, error: 'No repo open' })
  try {
    const days = parseInt(req.query.days as string) || 180
    const buckets = parseInt(req.query.buckets as string) || 12
    const data = await forensicsService.getTrend(days, buckets)
    res.json({ ok: true, data })
  } catch (e: any) {
    res.json({ ok: false, error: e.message })
  }
})

app.get('/api/forensics/contributors', async (req, res) => {
  if (!forensicsService) return res.json({ ok: false, error: 'No repo open' })
  try {
    const data = await forensicsService.getContributors()
    res.json({ ok: true, data })
  } catch (e: any) {
    res.json({ ok: false, error: e.message })
  }
})

// Production: SPA fallback
if (existsSync(clientDist)) {
  app.get('*', (_req, res) => {
    res.sendFile(join(clientDist, 'index.html'))
  })
}

const PORT = 3001

app.listen(PORT, () => {
  console.log(`GitScope running at http://localhost:${PORT}`)
})