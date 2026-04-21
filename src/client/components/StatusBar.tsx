import { useState, useEffect } from 'react'
import { GitBranch, Circle } from 'lucide-react'
import { api } from '../api'

interface Props {
  branch: string
  refreshKey?: number
}

const POLL_INTERVAL = 5000 // 5s

export function StatusBar({ branch, refreshKey }: Props) {
  const [changeCount, setChangeCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    const fetchStatus = async () => {
      const result = await api.getStatus()
      if (cancelled) return
      if (result.ok) {
        const s = result.data
        setChangeCount(
          (s.modified?.length || 0) + (s.not_added?.length || 0) +
          (s.deleted?.length || 0) + (s.staged?.length || 0)
        )
      }
    }

    fetchStatus()
    const id = setInterval(fetchStatus, POLL_INTERVAL)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [refreshKey])

  return (
    <div className="status-bar">
      <span className="branch" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <GitBranch size={11} /> {branch}
      </span>
      {changeCount > 0 && (
        <span className="changes" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Circle size={8} fill="currentColor" strokeWidth={0} /> {changeCount}개 변경
        </span>
      )}
      <div style={{ flex: 1 }} />
      <span>GitScope v0.1.0</span>
    </div>
  )
}