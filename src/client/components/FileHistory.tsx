import { useState, useEffect } from 'react'
import { Info } from 'lucide-react'
import { api, type CommitInfo, type Symbol } from '../api'

// 옵션 B (2026-04-29): 파일 전체 로그는 우측 커밋 로그 탭에서 보고,
// 좌측은 심볼 단위 히스토리 전용으로 재정의.

interface Props {
  filePath: string
  selectedCommit?: string | null
  onSelectCommit?: (hash: string) => void
}

const KIND_COLORS: Record<string, string> = {
  function: 'var(--accent)',
  method: 'var(--accent)',
  constructor: 'var(--accent)',
  class: 'var(--mauve)',
  struct: 'var(--mauve)',
  record: 'var(--mauve)',
  interface: 'var(--yellow)',
  trait: 'var(--yellow)',
  enum: 'var(--peach)',
  impl: 'var(--green)',
  property: 'var(--green)',
  type: 'var(--red)',
  mod: 'var(--text-secondary)',
}

export function FileHistory({ filePath, selectedCommit, onSelectCommit }: Props) {
  const [commits, setCommits] = useState<CommitInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [symbols, setSymbols] = useState<Symbol[]>([])
  // -1 = 전체 파일
  const [selectedSymbolIdx, setSelectedSymbolIdx] = useState<number>(-1)

  // 심볼 로드 (파일 바뀔 때만)
  useEffect(() => {
    setSelectedSymbolIdx(-1)
    setSymbols([])
    api.getSymbols(filePath).then(result => {
      if (result.ok) setSymbols(result.data)
    })
  }, [filePath])

  // 심볼 선택 시에만 히스토리 로드 (파일 전체 로그는 우측 커밋 로그 탭에서)
  useEffect(() => {
    if (selectedSymbolIdx === -1) {
      setCommits([])
      setLoading(false)
      return
    }
    const sym = symbols[selectedSymbolIdx]
    if (!sym) {
      setCommits([])
      setLoading(false)
      return
    }
    setLoading(true)
    api.getSymbolHistory(filePath, sym.startLine, sym.endLine).then(r => {
      setCommits(r.ok ? r.data : [])
      setLoading(false)
    })
  }, [filePath, selectedSymbolIdx, symbols])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  const currentSymbol = selectedSymbolIdx >= 0 ? symbols[selectedSymbolIdx] : null

  return (
    <div>
      <div
        style={{
          padding: '8px 12px',
          fontSize: '11px',
          color: 'var(--accent)',
          fontFamily: 'var(--font-mono)',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
        }}
      >
        {filePath}
      </div>

      {/* 심볼 선택기 */}
      <div
        style={{
          padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
        }}
      >
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
          심볼 단위 히스토리{' '}
          {currentSymbol && `(L${currentSymbol.startLine}–${currentSymbol.endLine})`}
        </div>
        {symbols.length > 0 ? (
          <>
            <select
              value={selectedSymbolIdx}
              onChange={e => setSelectedSymbolIdx(Number(e.target.value))}
              style={{
                width: '100%',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                padding: '4px 6px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <option value={-1}>— 심볼 선택 ({symbols.length}개 탐지됨) —</option>
              {symbols.map((s, i) => (
                <option key={`${s.kind}-${s.name}-${s.startLine}`} value={i}>
                  [{s.kind}] {s.name} · L{s.startLine}–{s.endLine}
                </option>
              ))}
            </select>
            {currentSymbol && (
              <div
                style={{
                  fontSize: '10px',
                  color: KIND_COLORS[currentSymbol.kind] ?? 'var(--text-secondary)',
                  marginTop: '4px',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                ● {currentSymbol.kind}: {currentSymbol.name}
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              padding: '4px 0',
              fontStyle: 'italic',
            }}
          >
            이 파일에서 탐지된 심볼이 없습니다 (지원 언어: TS/TSX/JS/Rust/Python/C#)
          </div>
        )}
      </div>

      {/* 빈 상태: 심볼 미선택 시 가이드 (파일 전체 로그는 우측 탭으로 안내) */}
      {selectedSymbolIdx === -1 && !loading && (
        <div
          style={{
            margin: '12px',
            padding: '12px',
            background: 'var(--bg-surface)',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius)',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start',
            lineHeight: 1.6,
          }}
        >
          <Info size={14} strokeWidth={2.5} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            {symbols.length > 0 ? (
              <>
                위 드롭다운에서 <strong style={{ color: 'var(--accent)' }}>함수/클래스/메서드</strong>를
                선택하면 그 심볼이 변경된 커밋만 표시됩니다.
                <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                  파일 전체 로그는 <strong>우측 「커밋 로그」 탭</strong>에서 자동으로 같은 파일로 필터됩니다.
                </div>
              </>
            ) : (
              <>
                심볼이 탐지되지 않아 심볼 단위 히스토리를 표시할 수 없습니다.
                <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                  파일 전체 로그는 <strong>우측 「커밋 로그」 탭</strong>에서 확인하세요 (해당 파일로 자동 필터).
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {selectedSymbolIdx >= 0 && (loading ? (
        <div className="loading">
          <span className="spinner" /> 히스토리 로딩 중...
        </div>
      ) : (
        <>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '8px 12px' }}>
            총 {commits.length}개 커밋 (심볼 단위)
          </div>
          {commits.map((commit, i) => {
            const isSelected = selectedCommit === commit.hash
            return (
              <div
                key={commit.hash}
                onClick={() => onSelectCommit?.(commit.hash)}
                style={{
                  display: 'flex',
                  gap: '8px',
                  padding: '6px 12px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: isSelected ? 'var(--bg-surface)' : 'transparent',
                  borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                }}
                className="file-tree-item"
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    width: '16px',
                  }}
                >
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: i === 0 ? 'var(--accent)' : 'var(--bg-hover)',
                      border: '2px solid var(--accent)',
                      flexShrink: 0,
                    }}
                  />
                  {i < commits.length - 1 && (
                    <div
                      style={{
                        width: '1px',
                        flex: 1,
                        background: 'var(--border)',
                        marginTop: '2px',
                      }}
                    />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '11px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {commit.message}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                      {commit.hashShort}
                    </span>
                    {' · '}
                    {commit.author}
                    {' · '}
                    {formatDate(commit.date)}
                  </div>
                </div>
              </div>
            )
          })}
          {commits.length === 0 && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '16px' }}>
              해당 심볼의 변경 히스토리가 없습니다
            </div>
          )}
        </>
      ))}
    </div>
  )
}