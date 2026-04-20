import { useState, useEffect } from 'react'
import { api } from '../api'

interface Props { branch: string }

export function StatusBar({ branch }: Props) {
  const [changeCount, setChangeCount] = useState(0)

  useEffect(() => {
    api.getStatus().then(result => {
      if (result.ok) {
        const s = result.data
        setChangeCount(
          (s.modified?.length || 0) + (s.not_added?.length || 0) +
          (s.deleted?.length || 0) + (s.staged?.length || 0)
        )
      }
    })
  }, [])

  return (
    <div className="status-bar">
      <span className="branch">&#x23e3; {branch}</span>
      {changeCount > 0 && <span className="changes">● {changeCount}개 변경</span>}
      <div style={{ flex: 1 }} />
      <span>GitScope v0.1.0</span>
    </div>
  )
}