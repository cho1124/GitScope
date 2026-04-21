# GitScope — Development Handoff

> 작업 이어받기용 문서. 다른 PC/세션에서 이어받을 때 이 파일만 읽어도 컨텍스트 복원됨.

## 현재 상태 (2026-04-21 밤 기준)

**Phase 4~6 전체 완료 + v0.1.1 릴리즈 배포.**

### 한 줄 요약
Express + Vite 웹앱 → Tauri 2.10 + Rust 로컬 앱으로 전면 재작성 후, 브랜치 UI / 최근 레포 / Stash / Forensics 개별 로딩 / Diff virtualization / Lucide 아이콘까지 완료. 깃헙 Releases에 NSIS/MSI 배포.

### 릴리즈
- **v0.1.0** (2026-04-21 저녁) — 첫 배포
- **v0.1.1** (2026-04-21 밤) — Windows CMD 창 무한 깜빡임 버그 수정

## 왜 Tauri로 갔나 (결정 배경)

**원래**: Express HTTP 서버 + Vite + React 웹앱 구조. 브라우저에서 `localhost:3001` 접속.

**문제**:
1. 적대적 감사(자체 + Codex)에서 P0 보안 이슈 5건 발견:
   - CORS 와일드카드 + 인증/CSRF 없음 → 악성 웹사이트가 localhost로 commit/push 트리거 가능
   - `app.listen(PORT)` host 미지정 → LAN 전체 노출
   - path traversal 가능 (`validatePath` 선언만 있고 미사용)
   - 전역 싱글톤 `gitService` → 멀티 탭/레포 race
   - 모든 에러 `{ok:false}` 200 OK → HTTP 상태 미활용
2. 폴더 선택 dialog 등 네이티브 기능 불가 (브라우저 한계)
3. 사용자는 본인만 쓸 로컬 도구 원함 → 웹 서버가 과함

**선택**: Tauri 2 + Rust + std::process::Command (git CLI wrapper)
- 이유: `git2-rs` (libgit2 바인딩)은 `--follow` 미지원 등 기능 갭 있음. CLI wrapper 방식은 현재 TS 파싱 로직을 거의 1:1로 Rust 포팅 가능. Fork/GitHub Desktop도 이 방식.
- 얻은 것: P0 5건 중 3건(CORS/host/CSRF) 완전 소멸, 2건(path/singleton) Rust 구조로 해결.

---

## 환경 설정 (다른 PC에서 세팅)

### 필수 도구
| 도구 | 설치 명령 | 용도 |
|---|---|---|
| Node.js 18+ | [nodejs.org](https://nodejs.org) LTS | Vite / npm |
| Rust (rustup) | `winget install --id Rustlang.Rustup` | 백엔드 컴파일 |
| VS C++ Build Tools | `winget install Microsoft.VisualStudio.2022.BuildTools` + "Desktop development with C++" 워크로드 | Rust 링커 (Windows) |
| Git 2.0+ | [git-scm.com](https://git-scm.com) | 버전 관리 + CLI wrapper 의존 |
| WebView2 | Windows 11 자동 포함 | Tauri 렌더러 |
| GitHub CLI (선택) | `winget install GitHub.cli` | Release 배포 |

rustup 설치 후 PowerShell/터미널 재시작하면 `rustc --version`, `cargo --version` 확인 가능.

### 레포 클론 + 실행
```bash
git clone https://github.com/cho1124/GitScope.git
cd GitScope
npm install
npm run dev
```

첫 `npm run dev`는 Rust 크레이트들 컴파일해서 **첫 빌드 1분 내외** 소요. 이후 재실행은 즉시.

### 릴리즈 빌드 (배포용)
```bash
npm run build
```
산출물:
- `src-tauri/target/release/app.exe` (단일 실행 파일)
- `src-tauri/target/release/bundle/nsis/GitScope_X.Y.Z_x64-setup.exe` (NSIS 설치)
- `src-tauri/target/release/bundle/msi/GitScope_X.Y.Z_x64_en-US.msi` (MSI 설치)

릴리즈 빌드는 LTO 최적화로 **5-10분** 소요.

### GitHub Release 업로드
```bash
gh release create vX.Y.Z \
  "src-tauri/target/release/bundle/nsis/GitScope_X.Y.Z_x64-setup.exe" \
  "src-tauri/target/release/bundle/msi/GitScope_X.Y.Z_x64_en-US.msi" \
  --title "GitScope vX.Y.Z" \
  --notes "..."
```

---

## 완료된 마이그레이션 이력

### Phase 0 — 환경 구축 ✅
- `archive/express-version` 브랜치에 이전 Express 코드 보존 (참조용, 원격에도 푸시됨)
- Rust 1.95.0 stable-x86_64-pc-windows-msvc 설치
- VS BuildTools 2022 17.14.30 (C++ 워크로드 확인 완료)
- Tauri CLI 2.10.1 + @tauri-apps/api 2.10.1

### Phase 1+2 — Tauri 초기화 + Rust git CLI wrapper ✅
- `src-tauri/` 생성, identifier `com.gitscope.app`, 1280×800 윈도우
- Express 의존성 전면 제거 (`cors`, `express`, `simple-git`, `tsx`, `concurrently` 삭제, 197→74 패키지)
- `src/server/` + `tsconfig.server.json` 삭제
- `api.ts` fetch → `invoke` 전면 교체 (함수 시그니처는 유지 → 컴포넌트 수정 최소)
- Rust 12 커맨드 구현
- `AppState { repo: Mutex<Option<PathBuf>>, forensics_cache: Mutex<Option<CachedScan>> }` — Tauri-managed state로 전역 싱글톤 대체

### Phase 3 — Forensics Rust 포팅 + 캐싱 ✅
- 모듈 분리: `lib.rs` / `git.rs` / `forensics.rs`
- 4 커맨드: `get_heatmap` / `get_hotspots` / `get_trend` / `get_contributors`
- **HEAD 기반 캐시**: `CachedScan { head, since_days, commits }`
- 기존 TS `forensics-service.ts`의 파싱 로직(`COMMIT_SEP` 구분자 + `git log --numstat`)을 chrono 의존 Rust로 1:1 포팅

### Phase 4-1 — 브랜치 UI + long path strip ✅
- Rust: `create_branch` / `delete_branch` / `merge_branch` 3개 커맨드 추가
- `strip_long_path_prefix` 헬퍼 추가, Windows `\\?\` prefix 제거
- React: `BranchSelector` 컴포넌트 (드롭다운 + 생성/머지/삭제 모달)
- `api.ts` 공통 DTO 타입 export, 제네릭 타입 명시
- "열는 중" 오타 수정

### Phase 4-2 — 폴더 dialog + 최근 레포 + FileTree lazy ✅
- `@tauri-apps/plugin-dialog` + `tauri-plugin-dialog` 크레이트 추가
- `dirs` 크레이트로 AppData 경로 접근
- `recent.rs` 신규: `get_recent_repos` / `remove_recent_repo` / `clear_recent_repos` + `touch_recent` (open_repo에서 자동 호출)
- `get_directory_children` 신규: expand 시점에 해당 디렉토리만 1단계 로드 (40GB 레포 "응답 없음" 해결)
- `WelcomeScreen.tsx` 신규: 네이티브 폴더 다이얼로그 + 최근 레포 리스트
- `FileTree.tsx` lazy loading: expand 시 `getDirectoryChildren` 호출, childrenMap 캐싱

### Phase 4-3 — stash + working tree diff + tag pill ✅
- `stash.rs` 신규 모듈:
  - `stash_list` / `stash_save` / `stash_apply` / `stash_pop` / `stash_drop` / `stash_show`
  - `get_unstaged_diff` / `get_staged_diff`
- `StashPanel.tsx` 신규: stash 목록 + 선택 시 diff 미리보기 + 저장 모달
- `CommitPanel.tsx` 재설계: 좌 파일 리스트 + 우 diff 2-pane
- `CommitLog.tsx`: refs 파싱 (HEAD/브랜치/리모트/태그 pill 분리)
- App.tsx: "Stash" 탭 추가

### Phase 5 — UX 폴리시 ✅
**5-1차 (토스트 + Forensics 개별 로딩):**
- `Toast.tsx` 신규: ToastProvider + useToast hook (info/success/error/warn)
- 모든 `alert()` 호출 제거, 성공 토스트 추가 (Pull/Push/Commit)
- `ForensicsDashboard.tsx`: Promise.all 해체 → 카드별 `AsyncState<T>` 판별 유니언
- `CardWrapper` 공용 컴포넌트 (로딩/에러/재시도)
- Contributors **lazy load 버튼** (대용량 레포 대응)
- `FileHistory` 커밋 클릭 → diff 뷰 전환
- `StatusBar` 5초 polling + refreshKey 외부 동기화
- `-webkit-app-region: drag` Electron 잔재 제거
- `vite-env.d.ts` 추가 (CSS 타입 선언)

**5-2차 (ConfirmModal + pagination + 키보드):**
- `ConfirmModal.tsx` 신규: Promise 기반 `confirm({title, message, variant})`
- 오버레이 + Enter=확인 / Esc=취소, variant (info/warn/danger)
- `main.tsx`에 ConfirmProvider 추가
- BranchSelector 브랜치 삭제, StashPanel stash drop에서 `window.confirm` → `useConfirm`
- `CommitLog` pagination: 100개 → "더 보기" 버튼으로 +100씩
- 키보드 네비: ↑↓ 또는 j/k (listbox focus 상태), scrollIntoView
- `role=listbox` + `aria-selected` 추가
- App.tsx: Ctrl+1~4 탭 전환, F5 새로고침
- content-tabs에 `role=tablist/tab`, 버튼에 `aria-label`

### Phase 6 — 디자인 개선 ✅
- **Lucide 아이콘** 도입 (`lucide-react`): 모든 이모지 → 일관된 SVG
  - Toast: Info/CheckCircle2/XCircle/AlertTriangle/X
  - ConfirmModal: AlertTriangle/Info
  - FileTree: Folder/FolderOpen/FileText
  - WelcomeScreen: FolderOpen/Folder/X
  - BranchSelector: GitBranch/ChevronDown/Plus/GitMerge/Trash2/Check
  - StatusBar: GitBranch/Circle
  - CommitLog: Tag
  - ForensicsDashboard: TrendingUp/Flame/Map/Users + CardMeta 패턴
- **Diff virtualization** (`react-window` 2.x): 400줄 미만은 일반 렌더링 (복사/드래그 보존), 이상은 List로 virtualize + "virtualized · N lines" 배지
- **CSS 디자인 토큰** 보완: `--radius-sm/lg`, `--shadow-sm/md/lg`, `--space-1~6`, `--transition-fast`

### v0.1.0 배포 ✅
- `gh release create v0.1.0` + NSIS/MSI 첨부
- Release 페이지: https://github.com/cho1124/GitScope/releases/tag/v0.1.0

### v0.1.1 핫픽스 ✅
- **증상**: Windows에서 설치 후 실행 시 검은 CMD 창이 무한히 깜빡임
- **원인**: Rust `std::process::Command`가 Windows에서 기본적으로 새 콘솔을 띄움. StatusBar 5초 폴링 + Forensics 스캔이 계속 돌아서 창이 번쩍
- **해결**: `run_git` 헬퍼에 `CREATE_NO_WINDOW (0x08000000)` creation_flag 추가
  ```rust
  #[cfg(target_os = "windows")]
  cmd.creation_flags(CREATE_NO_WINDOW);
  ```
- 모든 git 호출이 `run_git` 경유이므로 한 지점 수정으로 전역 적용
- `tauri.conf.json`의 `beforeBuildCommand: "npm run build"` 재귀 버그 수정 (→ `npm run vite:build`)

---

## 남은 계획 (Phase 7 이후)

### 스크린샷 + README 업데이트 (다음 세션 필수)
- 앱 실행 스크린샷 촬영: 웰컴 / 커밋 로그 / 변경사항 / Stash / Code Forensics
- README의 `> TODO: 스크린샷` 섹션 교체

### Forensics 진행률 이벤트 (Phase 7)
- 현재는 스캔 중 spinner만 표시, 대용량 레포에서 언제 끝나는지 모름
- Tauri `ipc::Channel` 또는 `emit` 로 진행률 스트리밍
  - Rust: 커밋 파싱 루프에서 every 1000 commits emit
  - React: 카드별 진행률 바 표시

### 테마 시스템 (Phase 7)
- Catppuccin Mocha 고정 → Latte (light), Frappe, Macchiato 옵션
- 토큰화는 되어 있음 (`--bg-primary` 등), 테마 선택 UI만 추가
- localStorage 또는 AppData에 선호 저장

### 고급 Git 기능 (Phase 8)
- `rebase` — interactive 모드는 모달로, 비-interactive는 바로
- `cherry-pick` — 커밋 로그에서 우클릭
- merge conflict 해결 UI — 3-way diff 뷰
- `reset` (soft/mixed/hard) — 위험 작업이라 ConfirmModal 필수

### 원래 구상 되찾기 — 심볼 단위 히스토리 (Phase 9+)
- 적대적 검증 당시 미룬 핵심 차별점
- `git log -L :funcName:file` 래핑 → 함수 단위 히스토리 타임라인
- Tree-sitter 통합 (기본 언어 2-3개: TS/Python/C# 순서)
- 리네임 추적 3단계 중 2단계(AST diff)까지 구현

### 기타 백로그
- **Git LFS / sparse-checkout** 지원
- **멀티 레포 탭** (싱글톤 state → tab-per-repo)
- **다른 플랫폼 빌드** (macOS/Linux) — CI 설정 필요

---

## 알려진 이슈

### 1. 40GB 레포 첫 로드 성능
**상태**: 일부 해결 (FileTree lazy loading 완료).
**남은 작업**: Forensics 첫 스캔 시간이 여전히 긺 → Phase 7 진행률 표시로 UX 개선 필요.

### 2. Windows 코드 서명 없음
**증상**: 설치 시 SmartScreen "알 수 없는 게시자" 경고.
**우회**: "추가 정보" → "실행".
**근본 해결**: Authenticode 인증서 (~연 $75-300). 개인 프로젝트에는 과함.

### 3. FileHistory onClick (P2 잔여)
**상태**: Phase 5에서 해결 완료 (App.tsx에서 `onSelectCommit` 핸들러 연결).

### 4. confirm/alert native dialog
**상태**: Phase 5-2에서 해결 완료 (ConfirmModal + Toast).

---

## 적대적 감사 결과 (참고용)

### P0 (차단급)
| 항목 | 상태 |
|---|---|
| CORS 무제한 + CSRF | ✅ HTTP 서버 제거로 소멸 |
| `app.listen` host 미지정 | ✅ 소멸 |
| path traversal (`validatePath` 미사용) | ✅ Rust `canonicalize()` + `git rev-parse --git-dir` 검증 |
| 전역 싱글톤 `gitService` | ✅ `State<Mutex<Option<PathBuf>>>` 로 대체 |
| `{ok:false}` 200 OK | ✅ Tauri invoke `Result<T, String>` 네이티브 에러 |

### P1 (실사용 필수)
| 항목 | 상태 |
|---|---|
| Forensics 4종 중복 스캔 (Codex 지적) | ✅ HEAD hash + since_days 캐시 |
| 브랜치 UI 전무 (API만 존재) | ✅ Phase 4-1 |
| Working tree diff 없음 | ✅ Phase 4-3 |
| stash/tag/merge | ✅ Phase 4-1, 4-3 |
| Forensics 카드별 독립 로딩 | ✅ Phase 5 |
| "열는 중" 오타 | ✅ 제거됨 |

### P2 (폴리시)
| 항목 | 상태 |
|---|---|
| 대용량 diff virtualization 없음 | ✅ Phase 6 (react-window) |
| `useState<any>` 남용 | ✅ Phase 5 (api.ts 공통 타입 + StatusInfo 적용) |
| `-webkit-app-region: drag` Electron 잔재 | ✅ Phase 5 |
| `alert()` 에러 UX | ✅ Phase 5 (Toast) |
| 키보드 네비 / ARIA | ✅ Phase 5-2 (Ctrl+숫자 / ↑↓ / role/aria-*) |
| FileHistory onClick 없음 | ✅ Phase 5 |
| StatusBar 변경 카운트 poll 없음 | ✅ Phase 5 (5초 polling) |
| confirm() native dialog | ✅ Phase 5-2 (ConfirmModal) |
| Windows CMD 창 번쩍임 (설치 후 발견) | ✅ v0.1.1 (CREATE_NO_WINDOW) |

### 잔여 (Phase 7+)
| 항목 | 상태 |
|---|---|
| Forensics 진행률 이벤트 | ⏳ Phase 7 |
| 테마 전환 | ⏳ Phase 7 |
| rebase/cherry-pick/reset | ⏳ Phase 8 |
| 심볼 단위 히스토리 (원안) | ⏳ Phase 9+ |
| macOS/Linux 빌드 | ⏳ 추후 |

---

## 파일 구조 핵심 포인트

### Rust 모듈 간 경계
- `lib.rs`는 **entry + AppState 정의 + 커맨드 등록**만. 로직 X.
- `git.rs`의 `with_repo` / `run_git` 헬퍼는 `pub`로 export → `forensics.rs` / `stash.rs`에서 재사용.
- `forensics.rs`의 `CachedScan`은 `pub`로 export → `lib.rs`의 AppState에서 `Mutex<Option<CachedScan>>`로 보유.
- `recent.rs`: AppData 경로는 `dirs::config_dir()`, 파일 `GitScope/recent.json`. 존재하지 않는 경로는 읽을 때 자동 제거.
- `stash.rs`: 모든 git 호출은 `git::run_git` 경유 → CMD 창 회피 플래그 자동 적용.

### Tauri serde 네이밍 규칙
- 대부분 struct에 `#[serde(rename_all = "camelCase")]` 붙어 있음 → TS는 camelCase로 받음.
- 예외: `StatusInfo`는 `not_added` 등 snake_case 그대로 (클라이언트 CommitPanel이 simple-git 시절부터 `status.not_added` 사용).
- invoke 인자는 Tauri가 자동 camelCase ↔ snake_case 변환.

### api.ts 공통 타입
- Phase 5에서 모든 DTO 타입을 export하도록 정리.
- 컴포넌트에서 `import { type RepoInfo, type StatusInfo, ... } from '../api'` 형태로 재사용.
- `ApiResult<T> = { ok: true, data: T } | { ok: false, error: string }` 판별 유니언.

### Windows CMD 창 회피 (v0.1.1)
```rust
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn run_git(path: &PathBuf, args: &[&str]) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.arg("-C").arg(path).args(args);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output().map_err(...)?;
    // ...
}
```

### 토스트 + 확인 모달 사용법
```tsx
// Provider는 main.tsx에서 감싸고 있음
import { useToast } from './components/Toast'
import { useConfirm } from './components/ConfirmModal'

const toast = useToast()
const confirm = useConfirm()

toast.success('저장됨')
toast.error(result.error)

const ok = await confirm({
  title: '삭제 확인',
  message: '되돌릴 수 없습니다.',
  variant: 'danger',
  confirmLabel: '삭제'
})
```

---

## 다음 세션 시작 시 권장 순서

1. `git pull origin master` (로컬 최신화)
2. `npm install` (필요 시)
3. `npm run dev`로 창 뜨는지 확인
4. 이 파일(DEVELOPMENT.md)을 Claude에게 읽히기:
   > "GitScope 이어서 작업. DEVELOPMENT.md 읽어봐줘. Phase 7부터 진행할거야."
5. 먼저 스크린샷 촬영 → README TODO 섹션 교체
6. Phase 7(진행률 이벤트 + 테마) 착수

---

## 관련 링크

- **GitHub 레포**: https://github.com/cho1124/GitScope
- **Releases**: https://github.com/cho1124/GitScope/releases
- **적대적 검증 문서**: https://github.com/cho1124/multi-agent-adversarial-verification/tree/master/docs/experiments/2026-04-20-GitScope-Verification