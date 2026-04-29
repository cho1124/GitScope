import { useState, useCallback, useEffect } from 'react'
import { DownloadCloud, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Settings as SettingsIcon } from 'lucide-react'
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
import { RepoSelector } from './components/RepoSelector'
import { SettingsModal } from './components/SettingsModal'
import { useToast } from './components/Toast'

type Tab = 'changes' | 'commits' | 'forensics'

function repoNameFromPath(path: string): string {
  const cleaned = path.replace(/[\\/]+$/, '')
  const idx = Math.max(cleaned.lastIndexOf('/'), cleaned.lastIndexOf('\\'))
  return idx >= 0 ? cleaned.slice(idx + 1) : cleaned
}

export default function App() {
  const toast = useToast()
  const [repo, setRepo] = useState<RepoInfo | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('changes')
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [diff, setDiff] = useState<string>('')
  const [showFileHistory, setShowFileHistory] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [remoteBusy, setRemoteBusy] = useState<null | 'fetch' | 'pull' | 'push'>(null)

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
      setShowFileHistory(false)
      setActiveTab('changes')
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

  const handleFetch = useCallback(async () => {
    setRemoteBusy('fetch')
    const r = await api.fetch()
    setRemoteBusy(null)
    if (r.ok) {
      toast.success('Fetch 완료')
      setRefreshKey(k => k + 1)
    } else {
      toast.error(`Fetch 실패: ${r.error}`)
    }
  }, [toast])

  const handlePull = useCallback(async () => {
    setRemoteBusy('pull')
    const r = await api.pull()
    setRemoteBusy(null)
    if (r.ok) {
      toast.success('Pull 완료')
      setRefreshKey(k => k + 1)
    } else {
      toast.error(`Pull 실패: ${r.error}`)
    }
  }, [toast])

  const handlePush = useCallback(async () => {
    setRemoteBusy('push')
    const r = await api.push()
    setRemoteBusy(null)
    if (r.ok) {
      toast.success('Push 완료')
      setRefreshKey(k => k + 1)
    } else {
      toast.error(`Push 실패: ${r.error}`)
    }
  }, [toast])

  // 키보드 단축키 (Ctrl+1~3 탭 전환, F5 새로고침)
  useEffect(() => {
    if (!repo) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '1') { e.preventDefault(); setActiveTab('changes') }
        else if (e.key === '2') { e.preventDefault(); setActiveTab('commits') }
        else if (e.key === '3') { e.preventDefault(); setActiveTab('forensics') }
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
      <header className="app-header" style={{ gap: 8 }}>
        <RepoSelector
          currentPath={repo.path}
          currentName={repoNameFromPath(repo.path)}
          onPickRepo={handleOpenRepo}
        />
        <BranchSelector
          currentBranch={repo.currentBranch}
          onBranchChanged={handleBranchChanged}
          refreshKey={refreshKey}
        />

        <div style={{
          display: 'flex',
          gap: 2,
          padding: '0 4px',
          borderLeft: '1px solid var(--border)',
          marginLeft: 4,
        }}>
          <IconButton
            icon={<DownloadCloud size={13} />}
            label="Fetch"
            shortcut="git fetch --all --prune"
            onClick={handleFetch}
            busy={remoteBusy === 'fetch'}
            disabled={remoteBusy !== null}
          />
          <IconButton
            icon={<ArrowDownToLine size={13} />}
            label="Pull"
            shortcut="git pull"
            onClick={handlePull}
            busy={remoteBusy === 'pull'}
            disabled={remoteBusy !== null}
          />
          <IconButton
            icon={<ArrowUpFromLine size={13} />}
            label="Push"
            shortcut="git push"
            onClick={handlePush}
            busy={remoteBusy === 'push'}
            disabled={remoteBusy !== null}
          />
          <IconButton
            icon={<RefreshCw size={13} />}
            label="Refresh"
            shortcut="F5"
            onClick={handleRefresh}
          />
        </div>

        <div style={{ flex: 1 }} />

        <IconButton
          icon={<SettingsIcon size={13} />}
          label="설정"
          onClick={() => setSettingsOpen(true)}
        />
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
              aria-selected={activeTab === 'changes'}
              className={`content-tab ${activeTab === 'changes' ? 'active' : ''}`}
              onClick={() => setActiveTab('changes')}
              title="Ctrl+1"
            >
              변경사항
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'commits'}
              className={`content-tab ${activeTab === 'commits' ? 'active' : ''}`}
              onClick={() => setActiveTab('commits')}
              title="Ctrl+2"
            >
              커밋 로그
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'forensics'}
              className={`content-tab ${activeTab === 'forensics' ? 'active' : ''}`}
              onClick={() => setActiveTab('forensics')}
              title="Ctrl+3"
            >
              Code Forensics
            </button>
          </div>

          <div className="content-area">
            {activeTab === 'changes' && (
              <CommitPanel key={`cp-${refreshKey}`} onCommitDone={handleRefresh} />
            )}

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

            {activeTab === 'forensics' && (
              <ForensicsDashboard key={`fd-${refreshKey}`} />
            )}
          </div>
        </div>
      </div>

      <StatusBar branch={repo.currentBranch} refreshKey={refreshKey} />

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

interface IconButtonProps {
  icon: React.ReactNode
  label: string
  shortcut?: string
  onClick: () => void
  busy?: boolean
  disabled?: boolean
}

function IconButton({ icon, label, shortcut, onClick, busy, disabled }: IconButtonProps) {
  return (
    <button
      className="btn btn-sm"
      onClick={onClick}
      disabled={disabled || busy}
      title={shortcut ? `${label} · ${shortcut}` : label}
      aria-label={label}
      style={{
        padding: '4px 6px',
        minWidth: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? <span className="spinner" style={{ width: 11, height: 11, borderWidth: 1 }} /> : icon}
    </button>
  )
}
