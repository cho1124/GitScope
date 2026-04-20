import { useState, useCallback } from 'react'
import { api } from './api'
import { FileTree } from './components/FileTree'
import { CommitLog } from './components/CommitLog'
import { DiffView } from './components/DiffView'
import { ForensicsDashboard } from './components/ForensicsDashboard'
import { StatusBar } from './components/StatusBar'
import { CommitPanel } from './components/CommitPanel'
import { FileHistory } from './components/FileHistory'

type Tab = 'commits' | 'forensics' | 'changes'

interface RepoInfo {
  path: string
  currentBranch: string
  lastCommit: { hash: string; message: string; date: string } | null
}

export default function App() {
  const [repo, setRepo] = useState<RepoInfo | null>(null)
  const [repoInput, setRepoInput] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('commits')
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [diff, setDiff] = useState<string>('')
  const [showFileHistory, setShowFileHistory] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(false)

  const handleOpenRepo = useCallback(async () => {
    if (!repoInput.trim()) return
    setLoading(true)
    const result = await api.openRepo(repoInput.trim())
    setLoading(false)
    if (result.ok) {
      setRepo(result.data)
      setSelectedCommit(null)
      setDiff('')
      setSelectedFile(null)
      setRefreshKey(k => k + 1)
    } else {
      alert(result.error)
    }
  }, [repoInput])

  const handleSelectCommit = useCallback(async (hash: string) => {
    setSelectedCommit(hash)
    const result = await api.getDiff(hash)
    if (result.ok) setDiff(result.data)
  }, [])

  const handleSelectFile = useCallback((path: string) => {
    setSelectedFile(path)
    setShowFileHistory(true)
  }, [])

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  if (!repo) {
    return (
      <div className="app-container">
        <div className="welcome-screen">
          <h2>GitScope</h2>
          <p>Code Forensics를 내장한 Git GUI</p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <input
              type="text"
              value={repoInput}
              onChange={e => setRepoInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleOpenRepo()}
              placeholder="레포지토리 경로 (예: C:\Users\cho\Desktop\Project\MyRepo)"
              style={{ width: '500px' }}
              autoFocus
            />
            <button
              className="btn btn-primary"
              onClick={handleOpenRepo}
              disabled={loading}
            >
              {loading ? '열는 중...' : '열기'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>GitScope</h1>
        <span className="repo-path">{repo.path}</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={() => { setRepo(null); setRepoInput('') }}>
          다른 레포
        </button>
        <button className="btn btn-sm" onClick={handleRefresh}>
          새로고침
        </button>
      </header>

      <div className="app-body">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${!showFileHistory ? 'active' : ''}`}
              onClick={() => setShowFileHistory(false)}
            >
              파일 트리
            </button>
            <button
              className={`sidebar-tab ${showFileHistory ? 'active' : ''}`}
              onClick={() => selectedFile && setShowFileHistory(true)}
            >
              파일 히스토리
            </button>
          </div>
          <div className="sidebar-content">
            {showFileHistory && selectedFile ? (
              <FileHistory key={`fh-${refreshKey}`} filePath={selectedFile} />
            ) : (
              <FileTree
                key={`ft-${refreshKey}`}
                onSelectFile={handleSelectFile}
                selectedFile={selectedFile}
              />
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="main-content">
          <div className="content-tabs">
            <button
              className={`content-tab ${activeTab === 'commits' ? 'active' : ''}`}
              onClick={() => setActiveTab('commits')}
            >
              커밋 로그
            </button>
            <button
              className={`content-tab ${activeTab === 'changes' ? 'active' : ''}`}
              onClick={() => setActiveTab('changes')}
            >
              변경사항
            </button>
            <button
              className={`content-tab ${activeTab === 'forensics' ? 'active' : ''}`}
              onClick={() => setActiveTab('forensics')}
            >
              Code Forensics
            </button>
          </div>

          <div className="content-area">
            {activeTab === 'commits' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flex: 1, overflow: 'auto' }}>
                  <CommitLog
                    key={`cl-${refreshKey}`}
                    selectedCommit={selectedCommit}
                    onSelectCommit={handleSelectCommit}
                    file={selectedFile}
                  />
                </div>
                {diff && (
                  <div style={{ flex: 1, overflow: 'auto', borderTop: '1px solid var(--border)' }}>
                    <DiffView diff={diff} />
                  </div>
                )}
              </div>
            )}

            {activeTab === 'changes' && (
              <CommitPanel key={`cp-${refreshKey}`} onCommitDone={handleRefresh} />
            )}

            {activeTab === 'forensics' && (
              <ForensicsDashboard key={`fd-${refreshKey}`} />
            )}
          </div>
        </div>
      </div>

      <StatusBar key={`sb-${refreshKey}`} branch={repo.currentBranch} />
    </div>
  )
}