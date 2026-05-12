import { useCallback, useEffect, useState } from 'react'
import { Download, Check, AlertTriangle, Cpu, Play, Square } from 'lucide-react'
import { api, type AiStatus, type ModelStatus, type DownloadProgress } from '../api'
import {
  getSelectedLocalModel,
  setSelectedLocalModel,
} from '../lib/ai/local'
import { useToast } from './Toast'

interface Props {
  /** 다운로드/상태 변경 시 호출 — 부모(SettingsModal) 가 provider availability 다시 검사하도록 */
  onChanged?: () => void
}

/** "1.2 GB" / "234 MB" 형식 */
function formatBytes(n: number): string {
  if (n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`
}

interface ActiveDownload {
  /** model id 또는 'server' */
  target: string
  downloaded: number
  total: number
  stage: DownloadProgress['stage']
  errorMessage?: string
}

export function LocalAiSettings({ onChanged }: Props) {
  const toast = useToast()
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [active, setActive] = useState<ActiveDownload | null>(null)
  const [selectedModel, setSelected] = useState<string>(getSelectedLocalModel())
  const [busyStart, setBusyStart] = useState(false)

  const refresh = useCallback(async () => {
    const r = await api.aiStatus()
    if (r.ok) setStatus(r.data)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const isDownloading = (target: string) =>
    active !== null && active.target === target && active.stage !== 'finished' && active.stage !== 'failed'

  const startDownload = useCallback(async (target: 'server' | string) => {
    if (active && active.stage !== 'finished' && active.stage !== 'failed') {
      toast.error('이미 다른 다운로드가 진행 중입니다')
      return
    }
    setActive({ target, downloaded: 0, total: 0, stage: 'started' })

    const onProgress = (p: DownloadProgress) => {
      if (p.stage === 'started') {
        setActive({ target, downloaded: 0, total: p.total, stage: 'started' })
      } else if (p.stage === 'chunk') {
        setActive({ target, downloaded: p.downloaded, total: p.total, stage: 'chunk' })
      } else if (p.stage === 'finished') {
        setActive({ target, downloaded: p.downloaded, total: p.downloaded, stage: 'finished' })
      } else if (p.stage === 'failed') {
        setActive({ target, downloaded: 0, total: 0, stage: 'failed', errorMessage: p.message })
      }
    }

    const r = target === 'server'
      ? await api.aiDownloadServer(onProgress)
      : await api.aiDownloadModel(target, onProgress)

    if (r.ok) {
      toast.success(target === 'server' ? '추론 엔진 설치 완료' : '모델 다운로드 완료')
      await refresh()
      onChanged?.()
    } else {
      toast.error(`다운로드 실패: ${r.error}`)
      setActive({ target, downloaded: 0, total: 0, stage: 'failed', errorMessage: r.error })
    }
  }, [active, refresh, onChanged, toast])

  const handleSelect = (id: string) => {
    setSelected(id)
    setSelectedLocalModel(id)
    onChanged?.()
  }

  const handleStartServer = async (modelId: string) => {
    setBusyStart(true)
    const r = await api.aiStartServer(modelId)
    setBusyStart(false)
    if (r.ok) {
      toast.success(`서버 시작 — port ${r.data}`)
      await refresh()
    } else {
      toast.error(`서버 시작 실패: ${r.error}`)
    }
  }

  const handleStopServer = async () => {
    const r = await api.aiStopServer()
    if (r.ok) {
      toast.info('서버 종료')
      await refresh()
    } else {
      toast.error(`서버 종료 실패: ${r.error}`)
    }
  }

  if (!status) {
    return <div className="loading"><span className="spinner" /> 상태 확인 중...</div>
  }

  const serverDl = active && active.target === 'server' ? active : null
  const serverProgressPct = serverDl && serverDl.total > 0
    ? Math.min(100, (serverDl.downloaded / serverDl.total) * 100)
    : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 엔진 상태 */}
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 'calc(var(--radius) - 2px)',
        padding: '10px 12px',
        background: status.serverInstalled ? 'rgba(166, 227, 161, 0.06)' : 'rgba(249, 226, 175, 0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          {status.serverInstalled ? (
            <Check size={13} color="var(--green)" strokeWidth={2.5} />
          ) : (
            <AlertTriangle size={13} color="var(--yellow)" />
          )}
          <strong style={{ fontSize: 12 }}>추론 엔진 (llama-server)</strong>
          <span style={{ flex: 1 }} />
          {!status.serverInstalled && !isDownloading('server') && (
            <button
              className="btn btn-sm"
              onClick={() => startDownload('server')}
              style={{ fontSize: 11, padding: '4px 10px' }}
              disabled={!!active && active.stage !== 'finished' && active.stage !== 'failed'}
            >
              <Download size={11} style={{ marginRight: 4 }} />
              설치
            </button>
          )}
          {status.serverInstalled && status.runningPort && (
            <span style={{ fontSize: 10, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
              실행 중 · port {status.runningPort}
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {status.serverInstalled
            ? '설치 완료 — ggml-org/llama.cpp 최신 릴리즈에서 받음'
            : 'github.com/ggml-org/llama.cpp 의 최신 릴리즈에서 자동 다운로드 (~50MB)'}
        </div>
        {serverDl && (
          <ProgressBar
            stage={serverDl.stage}
            pct={serverProgressPct}
            current={serverDl.downloaded}
            total={serverDl.total}
            error={serverDl.errorMessage}
          />
        )}
      </div>

      {/* 모델 카드 리스트 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {status.models.map(m => (
          <ModelCard
            key={m.id}
            model={m}
            selected={m.id === selectedModel}
            running={status.runningModel === m.id}
            downloading={isDownloading(m.id)}
            progress={active && active.target === m.id ? active : null}
            onDownload={() => startDownload(m.id)}
            onSelect={() => handleSelect(m.id)}
            onStart={() => handleStartServer(m.id)}
            onStop={handleStopServer}
            canStart={status.serverInstalled && !busyStart}
          />
        ))}
      </div>
    </div>
  )
}

function ModelCard({
  model, selected, running, downloading, progress,
  onDownload, onSelect, onStart, onStop, canStart,
}: {
  model: ModelStatus
  selected: boolean
  running: boolean
  downloading: boolean
  progress: ActiveDownload | null
  onDownload: () => void
  onSelect: () => void
  onStart: () => void
  onStop: () => void
  canStart: boolean
}) {
  const pct = progress && progress.total > 0
    ? Math.min(100, (progress.downloaded / progress.total) * 100)
    : 0

  return (
    <div style={{
      border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
      borderLeft: selected ? '3px solid var(--accent)' : '1px solid var(--border)',
      borderRadius: 'calc(var(--radius) - 2px)',
      padding: '10px 12px',
      background: selected ? 'rgba(137, 180, 250, 0.04)' : 'transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Cpu size={13} color={selected ? 'var(--accent)' : 'var(--text-muted)'} />
        <strong style={{ fontSize: 12, flex: 1 }}>
          {model.label}
          {model.recommended && (
            <span style={{
              marginLeft: 6, fontSize: 9, padding: '1px 5px',
              background: 'var(--mauve)', color: 'var(--bg-primary)',
              borderRadius: 8, fontWeight: 600,
            }}>추천</span>
          )}
        </strong>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {formatBytes(model.installed && model.localBytes > 0 ? model.localBytes : model.sizeBytes)}
        </span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
        {model.description}
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6 }}>
        라이선스: <a
          href={model.licenseUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--text-muted)' }}
        >{model.license}</a>
      </div>
      {progress && (
        <ProgressBar
          stage={progress.stage}
          pct={pct}
          current={progress.downloaded}
          total={progress.total}
          error={progress.errorMessage}
        />
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        {!model.installed && !downloading && (
          <button
            className="btn btn-sm"
            onClick={onDownload}
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            <Download size={11} style={{ marginRight: 4 }} />
            다운로드
          </button>
        )}
        {model.installed && !selected && (
          <button
            className="btn btn-sm"
            onClick={onSelect}
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            선택
          </button>
        )}
        {model.installed && selected && !running && (
          <button
            className="btn btn-sm"
            onClick={onStart}
            disabled={!canStart}
            style={{
              fontSize: 11, padding: '4px 10px',
              background: 'var(--green)', color: 'var(--bg-primary)', borderColor: 'var(--green)',
            }}
            title={!canStart ? '엔진을 먼저 설치하세요' : '서버 시작 + 워밍업 (최대 30초)'}
          >
            <Play size={11} style={{ marginRight: 4 }} />
            서버 시작
          </button>
        )}
        {model.installed && selected && running && (
          <button
            className="btn btn-sm"
            onClick={onStop}
            style={{ fontSize: 11, padding: '4px 10px' }}
            title="서버 종료"
          >
            <Square size={11} style={{ marginRight: 4 }} />
            서버 종료
          </button>
        )}
        {selected && (
          <span style={{
            marginLeft: 'auto', fontSize: 10,
            color: running ? 'var(--green)' : 'var(--accent)',
            fontFamily: 'var(--font-mono)',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            {running ? <>● 실행 중</> : <>✓ 선택됨</>}
          </span>
        )}
      </div>
    </div>
  )
}

function ProgressBar({
  stage, pct, current, total, error,
}: {
  stage: DownloadProgress['stage']
  pct: number
  current: number
  total: number
  error?: string
}) {
  if (stage === 'failed') {
    return (
      <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 6, display: 'flex', gap: 4, alignItems: 'center' }}>
        <AlertTriangle size={10} /> 실패: {error ?? '알 수 없는 오류'}
      </div>
    )
  }
  if (stage === 'finished') {
    return (
      <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 6 }}>
        ✓ 완료 — {formatBytes(current)}
      </div>
    )
  }
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{
        height: 4, background: 'var(--bg-surface)',
        borderRadius: 2, overflow: 'hidden', position: 'relative',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: 'var(--accent)', transition: 'width 0.2s ease-out',
        }} />
      </div>
      <div style={{
        fontSize: 9, color: 'var(--text-muted)', marginTop: 2,
        fontFamily: 'var(--font-mono)',
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>{formatBytes(current)}{total > 0 ? ` / ${formatBytes(total)}` : ''}</span>
        {total > 0 && <span>{pct.toFixed(1)}%</span>}
      </div>
    </div>
  )
}
