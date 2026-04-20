import simpleGit, { SimpleGit, LogResult, StatusResult, BranchSummary } from 'simple-git'
import { readdir, stat } from 'fs/promises'
import { join, resolve } from 'path'

export interface CommitInfo {
  hash: string
  hashShort: string
  message: string
  author: string
  email: string
  date: string
  refs: string
}

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

export class GitService {
  private git: SimpleGit
  private repoPath: string

  constructor(repoPath: string) {
    this.repoPath = repoPath
    this.git = simpleGit(repoPath)
  }

  async isGitRepo(): Promise<boolean> {
    try {
      await this.git.revparse(['--git-dir'])
      return true
    } catch {
      return false
    }
  }

  async getRepoInfo() {
    const branches = await this.git.branch()
    const log = await this.git.log({ maxCount: 1 })
    return {
      path: this.repoPath,
      currentBranch: branches.current,
      lastCommit: log.latest ? {
        hash: log.latest.hash.substring(0, 7),
        message: log.latest.message,
        date: log.latest.date
      } : null
    }
  }

  async getLog(maxCount: number = 200, file?: string): Promise<CommitInfo[]> {
    const options: any = { maxCount }
    if (file) options.file = file

    const log: LogResult = await this.git.log(options)
    return log.all.map(entry => ({
      hash: entry.hash,
      hashShort: entry.hash.substring(0, 7),
      message: entry.message,
      author: entry.author_name,
      email: entry.author_email,
      date: entry.date,
      refs: entry.refs
    }))
  }

  async getStatus(): Promise<StatusResult> {
    return this.git.status()
  }

  async getDiff(hash: string): Promise<string> {
    return this.git.diff([`${hash}^`, hash])
  }

  async stage(files: string[]): Promise<void> {
    await this.git.add(files)
  }

  async commit(message: string) {
    const result = await this.git.commit(message)
    return {
      hash: result.commit,
      summary: result.summary
    }
  }

  async getBranches(): Promise<BranchSummary> {
    return this.git.branch()
  }

  async checkout(branch: string): Promise<void> {
    await this.git.checkout(branch)
  }

  async push(): Promise<void> {
    await this.git.push()
  }

  async pull(): Promise<void> {
    await this.git.pull()
  }

  async getFileHistory(filePath: string): Promise<CommitInfo[]> {
    const log = await this.git.log({ file: filePath, maxCount: 100, '--follow': null })
    return log.all.map(entry => ({
      hash: entry.hash,
      hashShort: entry.hash.substring(0, 7),
      message: entry.message,
      author: entry.author_name,
      email: entry.author_email,
      date: entry.date,
      refs: entry.refs
    }))
  }

  async getFileTree(maxDepth: number = 5): Promise<FileTreeNode[]> {
    return this.buildTree(this.repoPath, '', 0, maxDepth)
  }

  validatePath(filePath: string): string {
    const resolved = resolve(this.repoPath, filePath)
    if (!resolved.startsWith(resolve(this.repoPath))) {
      throw new Error('Path traversal not allowed')
    }
    return filePath
  }

  private async buildTree(dirPath: string, relPath: string, depth: number, maxDepth: number): Promise<FileTreeNode[]> {
    if (depth >= maxDepth) return []
    const entries = await readdir(dirPath)
    const nodes: FileTreeNode[] = []

    for (const name of entries) {
      if (name.startsWith('.') || name === 'node_modules' || name === 'dist') continue
      const fullPath = join(dirPath, name)
      const rel = relPath ? `${relPath}/${name}` : name
      try {
        const s = await stat(fullPath)
        if (s.isDirectory()) {
          nodes.push({
            name,
            path: rel,
            type: 'directory',
            children: await this.buildTree(fullPath, rel, depth + 1, maxDepth)
          })
        } else {
          nodes.push({ name, path: rel, type: 'file' })
        }
      } catch {
        // skip inaccessible files
      }
    }

    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }
}