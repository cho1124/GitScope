/** 단일 파일의 diff 헤더 + 그 안의 hunk 목록. */
export interface DiffFile {
  /** diff --git ~ +++ 까지의 헤더 라인들 (개행 포함하지 않은 배열) */
  header: string[]
  hunks: DiffHunk[]
}

export interface DiffHunk {
  /** "@@ -a,b +c,d @@..." 첫 줄 */
  headerLine: string
  /** hunk 본문 (헤더 라인 포함, 마지막 개행은 join 시 처리) */
  lines: string[]
}

/** `git diff` 출력을 파일별 + hunk별로 분해한다. */
export function parseDiff(diff: string): DiffFile[] {
  if (!diff) return []
  const lines = diff.split('\n')
  const files: DiffFile[] = []
  let current: DiffFile | null = null
  let currentHunk: DiffHunk | null = null

  const pushHunk = () => {
    if (current && currentHunk) {
      current.hunks.push(currentHunk)
      currentHunk = null
    }
  }
  const pushFile = () => {
    pushHunk()
    if (current) files.push(current)
  }

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      pushFile()
      current = { header: [line], hunks: [] }
      currentHunk = null
      continue
    }
    if (!current) {
      // 헤더 없이 시작하는 경우는 무시
      continue
    }
    if (line.startsWith('@@')) {
      pushHunk()
      currentHunk = { headerLine: line, lines: [line] }
      continue
    }
    if (currentHunk) {
      currentHunk.lines.push(line)
    } else {
      // 아직 hunk 시작 전 → 헤더 (index/---/+++/mode/new file/ 등)
      current.header.push(line)
    }
  }
  pushFile()
  return files
}

/** 단일 hunk + 그 hunk 가 속한 파일 헤더로 `git apply` 가능한 patch 문자열을 만든다. */
export function buildHunkPatch(file: DiffFile, hunk: DiffHunk): string {
  const headerLines = file.header.filter(l => l.length > 0 || true) // 모든 헤더 유지
  // 마지막 hunk 직전에 빈 라인이 있을 수 있으니 trim 하지 않음
  const out: string[] = [...headerLines, ...hunk.lines]
  // git apply 는 마지막에 개행이 있어야 함
  return out.join('\n') + (out[out.length - 1].endsWith('\n') ? '' : '\n')
}