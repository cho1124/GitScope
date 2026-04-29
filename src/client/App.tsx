import { useState, useCallback, useEffect } from 'react'
import { api, type RepoInfo } from './api'
import { FileTree } from './components/FileTree'
import { CommitLog } from './components/CommitLog'
import { DiffView } from './components/DiffView'
import { ForensicsDashboard } from './components/ForensicsDashboard'
import { StatusBar } from './components/StatusBar'
import { CommitPanel } from './components/CommitPanel'
import { FileHistory } from './components/FileHistory'
import { BranchSelector } from './components/BranchSelector'
import { WelcomeScreen } from './components/WelcomeScreen'
import { StashPanel } from './components/StashPanel'
import { ThemeSelector } from './components/ThemeSelector'
import { useToast } from './components/Toast'

type Tab = 'commits' | 'changes' | 'stash' | 'forensics'

export default function App() {
  const toast = useToast()
  const [repo, setRepo] = useState<RepoInfo | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('commits')
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [diff, setDiff] = useState<string>('')
  const [showFileHistory, setShowFileHistory] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(false)

  const handleOpenRepo = useCallback(async (path: string) => {
    const trimmed = path.trim()
    if (!trimmed) return
    setLoading(true)
    const result = await api.openRepo(trimmed)
    setLoading(false)
    if (result.ok) {
      setRepo(result.data)
      setSelectedCommit(null)
      setDiff('')
      setSelectedFile(null)
      setRefreshKey(k => k + 1)
    } else {
      toast.error(result.error)
    }
  }, [toast])

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

  const handleBranchChanged = useCallback((newBranch: string) => {
    setRepo(prev => prev ? { ...prev, currentBranch: newBranch } : prev)
    setSelectedCommit(null)
    setDiff('')
    setRefreshKey(k => k + 1)
  }, [])

  // 키보드 단축키 (Ctrl+1~4 탭 전환, F5 새로고침)
  useEffect(() => {
    if (!repo) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '1') { e.preventDefault(); setActiveTab('commits') }
        else if (e.key === '2') { e.preventDefault(); setActiveTab('changes') }
        else if (e.key === '3') { e.preventDefault(); setActiveTab('stash') }
        else if (e.key === '4') { e.preventDefault(); setActiveTab('forensics') }
      }
      if (e.key === 'F5') { e.preventDefault(); handleRefresh() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [repo, handleRefresh])

  if (!repo) {
    return (
      <div className="app-container">
        <WelcomeScreen onOpen={handleOpenRepo} opening={loading} />
      </div>
    )
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>GitScope</h1>
        <span className="repo-path">{repo.path}</span>
        <div style={{ flex: 1 }} />
        <BranchSelector
          currentBranch={repo.currentBranch}
          onBranchChanged={handleBranchChanged}
          refreshKey={refreshKey}
        />
        <ThemeSelector />
        <button className="btn btn-sm" onClick={() => setRepo(null)} aria-label="다른 레포 열기">
          다른 레포
        </button>
        <button className="btn btn-sm" onClick={handleRefresh} title="F5" aria-label="새로고침 (F5)">
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
              title="선택한 파일의 함수/클래스 단위 변경 히스토리"
            >
              심볼 히스토리
            </button>
          </div>
          <div className="sidebar-content">
            {showFileHistory && selectedFile ? (
              <FileHistory
                key={`fh-${refreshKey}`}
                filePath={selectedFile}
                selectedCommit={selectedCommit}
                onSelectCommit={(hash) => {
                  setActiveTab('commits')
                  handleSelectCommit(hash)
                }}
              />
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
          <div className="content-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'commits'}
              className={`content-tab ${activeTab === 'commits' ? 'active' : ''}`}
              onClick={() => setActiveTab('commits')}
              title="Ctrl+1"
            >
              커밋 로그
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'changes'}
              className={`content-tab ${activeTab === 'changes' ? 'active' : ''}`}
              onClick={() => setActiveTab('changes')}
              title="Ctrl+2"
            >
              변경사항
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'stash'}
              className={`content-tab ${activeTab === 'stash' ? 'active' : ''}`}
              onClick={() => setActiveTab('stash')}
              title="Ctrl+3"
            >
              Stash
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'forensics'}
              className={`content-tab ${activeTab === 'forensics' ? 'active' : ''}`}
              onClick={() => setActiveTab('forensics')}
              title="Ctrl+4"
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

            {activeTab === 'stash' && (
              <StashPanel key={`st-${refreshKey}`} onStashChanged={handleRefresh} />
            )}

            {activeTab === 'forensics' && (
              <ForensicsDashboard key={`fd-${refreshKey}`} />
            )}
          </div>
        </div>
      </div>

      <StatusBar branch={repo.currentBranch} refreshKey={refreshKey} />
    </div>
  )
}