import { useState, useEffect } from 'react'
import { api } from '../api'

interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

interface Props {
  onSelectFile: (path: string) => void
  selectedFile: string | null
}

export function FileTree({ onSelectFile, selectedFile }: Props) {
  const [tree, setTree] = useState<FileTreeNode[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    api.getFileTree().then(result => {
      if (result.ok) setTree(result.data)
    })
  }, [])

  const toggleDir = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const renderNode = (node: FileTreeNode, depth: number = 0) => {
    const isDir = node.type === 'directory'
    const isExpanded = expanded.has(node.path)
    const isSelected = node.path === selectedFile

    return (
      <div key={node.path}>
        <div
          className={`file-tree-item ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: 12 + depth * 16 }}
          onClick={() => {
            if (isDir) toggleDir(node.path)
            else onSelectFile(node.path)
          }}
        >
          <span className="icon">
            {isDir ? (isExpanded ? '\u{1F4C2}' : '\u{1F4C1}') : '\u{1F4C4}'}
          </span>
          <span className="name">{node.name}</span>
        </div>
        {isDir && isExpanded && node.children?.map(child => renderNode(child, depth + 1))}
      </div>
    )
  }

  if (tree.length === 0) {
    return <div className="loading"><span className="spinner" /> Loading...</div>
  }

  return <div>{tree.map(node => renderNode(node))}</div>
}