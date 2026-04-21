# GitScope — Development Handoff

> 작업 이어받기용 문서. 다른 PC/세션에서 이어받을 때 이 파일만 읽어도 컨텍스트 복원됨.

## 현재 상태 (2026-04-21 저녁 기준)

**Tauri 마이그레이션 Phase 0-3 완료.** Phase 4 착수 직전 단계.

### 한 줄 요약
Express + Vite 웹앱 → Tauri 2.10 + Rust 로컬 앱으로 전면 재작성. 기본 기능 (커밋 로그, diff, stage/commit, push/pull, Forensics 4종) 모두 동작 확인.

---

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

### 필수 도구 (집 PC에 없으면 설치)
| 도구 | 설치 명령 | 용도 |
|---|---|---|
| Node.js 18+ | [nodejs.org](https://nodejs.org) LTS | Vite / npm |
| Rust (rustup) | `winget install --id Rustlang.Rustup` | 백엔드 컴파일 |
| VS C++ Build Tools | [다운로드](https://visualstudio.microsoft.com/visual-cpp-build-tools/) → "Desktop development with C++" 체크 | Rust 링커 (Windows) |
| Git 2.0+ | [git-scm.com](https://git-scm.com) | 버전 관리 + CLI wrapper 의존 |
| WebView2 | Windows 11 자동 포함 | Tauri 렌더러 |

rustup 설치 후 PowerShell/터미널 재시작하면 `rustc --version`, `cargo --version` 확인 가능.

### 레포 클론 + 실행
```bash
git clone https://github.com/cho1124/GitScope.git
cd GitScope
npm install
npm run dev
```

첫 `npm run dev`는 Rust 크레이트들(tauri, serde, chrono 등) 컴파일해서 **첫 빌드 30초~1분** 소요. 이후 재실행은 즉시.

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
- Rust 12 커맨드 구현: `open_repo` / `get_log` / `get_status` / `get_diff` / `stage` / `commit` / `get_branches` / `checkout` / `push` / `pull` / `get_file_history` / `get_file_tree`
- `AppState { repo: Mutex<Option<PathBuf>>, forensics_cache: Mutex<Option<CachedScan>> }` — Tauri-managed state로 전역 싱글톤 대체

### Phase 3 — Forensics Rust 포팅 + 캐싱 ✅
- 모듈 분리: `lib.rs` (entry, 45줄) / `git.rs` (389줄) / `forensics.rs` (365줄)
- 4 커맨드: `get_heatmap` / `get_hotspots` / `get_trend` / `get_contributors`
- **HEAD 기반 캐시**: `CachedScan { head, since_days, commits }` — 같은 HEAD + 캐시 범위가 같거나 더 넓으면 재사용. `open_repo` 시 명시적 무효화, commit 후 HEAD 바뀌면 자동 무효화.
- 기존 TS `forensics-service.ts`의 파싱 로직(`COMMIT_SEP` 구분자 + `git log --numstat`)을 chrono 의존 Rust로 1:1 포팅
- `chrono = "0.4"` 추가 (Cargo.toml)

### 빌드 검증
- Rust `cargo check`: 8.98s (warning 0)
- Vite `build`: 398ms, 번들 164KB (gzip 52KB)

### 실사용 테스트 (사용자)
- 작은 레포: 모든 탭 정상 동작
- 40GB Unity 레포 (M823_System): 초기 로드에 "응답 없음" 발생 후 결국 로드 완료. Forensics 캐시는 2번째부터 즉시.

---

## 남은 계획 (Phase 4부터)

### Round 4-1 — 브랜치 UI + long path strip (~30분)
**사용자 직접 지적 사항 포함.**
- Rust: `create_branch` / `delete_branch` / `merge_branch` 커맨드 추가 (git.rs)
- React: 헤더에 브랜치 드롭다운 컴포넌트 (`BranchSelector`) + 새 브랜치 modal + merge 버튼
- Rust: `open_repo` 반환 path에서 Windows long path prefix(`\\?\`) strip

### Round 4-2 — 폴더 dialog + 최근 레포 + FileTree lazy (~1~2시간)
**40GB 레포 "응답 없음" 근본 원인 해결.**
- `npm install @tauri-apps/plugin-dialog@latest` + Cargo 의존 추가
- Rust: `pick_directory` (실제로는 JS에서 plugin-dialog 직접 호출 가능)
- 웰컴 스크린에 "폴더 선택" 버튼
- 최근 레포: AppData에 JSON 저장 (`tauri_plugin_fs` or 직접 File I/O), 웰컴에 리스트
- FileTree: `get_directory_children(path)` 추가 → expand 시점에 해당 디렉토리만 로드 (현재는 한 번에 5 depth 전체)

### Round 4-3 — stash + working tree diff + tag (~1~2시간)
**사용자가 stash 자주 씀.**
- Rust: `stash_list` / `stash_save` / `stash_apply` / `stash_pop` / `stash_drop`
- Rust: `get_unstaged_diff(file)` / `get_staged_diff(file)`
- React: `StashPanel` 컴포넌트 (탭 or 사이드바)
- React: CommitPanel에서 파일 클릭 시 working tree diff 미리보기
- 커밋 로그 항목에 tag pill (`refs` 필드 이미 있어 간단)

### Phase 5 — UX 폴리시
- Forensics 카드별 개별 로딩 (Promise.all 해체) — Codex가 P1로 지적
- Contributors lazy load 버튼 (40GB 레포 대응)
- 진행률/스캔 상태 이벤트 (`tauri::ipc::Channel` 또는 `emit`)
- `alert()` → 토스트 컴포넌트
- 커밋 로그/파일 트리 pagination
- 키보드 네비, ARIA 라벨

### Phase 6 — 디자인 개선
- 색 시스템 재정비 (Catppuccin 외 옵션)
- 레이아웃 튜닝
- 아이콘 교체 (이모지 → SVG)
- 스크린샷 촬영 → README 업데이트

---

## 알려진 이슈

### 1. 40GB 레포에서 "응답 없음" (UI freeze)
**원인**: FileTree가 5 depth 전체를 한 번에 Rust에서 반환 + React가 수만 개 노드 한 번에 렌더링. IPC payload도 수 MB.
**해결**: Round 4-2의 FileTree lazy loading (expand 시점에만 로드).
**임시 대응**: `build_tree`의 max_depth를 줄이거나, 사용자가 참고 말고 넘어가면 됨 (로드되긴 함).

### 2. Windows long path prefix (`\\?\D:\...`)
**원인**: `PathBuf::canonicalize()`가 Windows UNC-like 경로를 반환.
**해결**: Round 4-1에서 strip. 구현 메모:
```rust
let display_path = canonical.to_string_lossy().to_string();
let display_path = display_path.strip_prefix(r"\\?\").unwrap_or(&display_path).to_string();
```
또는 `dunce = "1.0"` 크레이트 사용.

### 3. FileHistory 클릭 시 Diff 연결 안 됨
**원인**: FileHistory.tsx에 onClick 핸들러 없음 (기존 Express 버전부터).
**해결**: Phase 5 UX 폴리시에 포함.

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
| 브랜치 UI 전무 (API만 존재) | ⏳ Round 4-1 |
| Working tree diff 없음 | ⏳ Round 4-3 |
| stash/tag/merge/rebase | ⏳ Round 4-1, 4-3 |
| "열는 중" 오타 | ✅ 제거됨 (api.ts 교체 시) |

### P2 (폴리시)
| 항목 | 상태 |
|---|---|
| 대용량 diff virtualization 없음 | ⏳ Phase 5 |
| `useState<any>` 남용 | ⏳ Phase 5 |
| `-webkit-app-region: drag` Electron 잔재 | ⚠️ 여전히 남아 있음 (Tauri에선 다른 방식) — Phase 5에서 제거 |
| `alert()` 에러 UX | ⏳ Phase 5 |
| 키보드 네비 / ARIA | ⏳ Phase 5 |
| FileHistory onClick 없음 | ⏳ Phase 5 |
| StatusBar 변경 카운트 poll 없음 | ⏳ Phase 5 |

---

## 파일 구조 핵심 포인트

### Rust 모듈 간 경계
- `lib.rs`는 **entry + AppState 정의 + 커맨드 등록**만. 로직 X.
- `git.rs`의 `with_repo` / `run_git` 헬퍼는 `pub`로 export → `forensics.rs`에서 재사용.
- `forensics.rs`의 `CachedScan`은 `pub`로 export → `lib.rs`의 AppState에서 `Mutex<Option<CachedScan>>`로 보유.

### Tauri serde 네이밍 규칙
- 대부분 struct에 `#[serde(rename_all = "camelCase")]` 붙어 있음 → TS는 camelCase로 받음 (예: `hash_short` → `hashShort`).
- 예외: `StatusInfo`는 `not_added` 등 snake_case 그대로 (클라이언트 CommitPanel이 simple-git 시절부터 `status.not_added` 사용).
- invoke 인자는 Tauri가 자동 camelCase ↔ snake_case 변환 (JS `{ maxCount: 100 }` → Rust `max_count: u32`).

### api.ts의 ApiResult<T>
`{ ok: true, data } | { ok: false, error }` 형태로 통일. 기존 fetch API 패턴 유지 → 컴포넌트 수정 불필요. `invoke`의 throw를 `call()` 래퍼가 catch해서 이 형태로 변환.

---

## 다음 세션 시작 시 권장 순서

1. `git pull origin master` (로컬 최신화)
2. `npm install` (필요 시)
3. `npm run dev`로 창 뜨는지 확인
4. 이 파일(DEVELOPMENT.md)을 Claude에게 읽히기:
   > "GitScope 이어서 작업. DEVELOPMENT.md 읽어봐줘. Round 4-1부터 진행할거야."
5. Round 4-1(브랜치 UI) 착수
