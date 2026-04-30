# GitScope

Code Forensics 시각화와 **심볼 단위 히스토리**를 내장한 **로컬 데스크톱 Git GUI** (Tauri 기반).

![Tauri](https://img.shields.io/badge/Tauri-2.10-24c8db.svg)
![React](https://img.shields.io/badge/React-18-61dafb.svg)
![Rust](https://img.shields.io/badge/Rust-1.95+-dea584.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

## 다운로드

**[최신 릴리즈 → v0.3.0](https://github.com/cho1124/GitScope/releases/latest)**  
(Phase 8: 고급 Git 액션 — cherry-pick / reset / rebase / interactive rebase / 충돌 빠른 해결)

| 파일 | 크기 | 설명 |
|------|------|------|
| `GitScope_x.y.z_x64-setup.exe` | ~2 MB | NSIS 설치 (권장) |
| `GitScope_x.y.z_x64_en-US.msi` | ~3 MB | MSI 설치 (기업 배포용) |

> ⚠ 코드 서명이 없어 Windows SmartScreen 경고가 뜹니다.
> "추가 정보" → "실행"을 클릭하면 설치됩니다.

## 주요 기능

### 기본 Git 작업
| 기능 | 설명 |
|------|------|
| **커밋 로그** | 페이지네이션 (100개씩), ↑↓ 또는 j/k 키보드 네비게이션 |
| **Diff 뷰** | 400줄 이상 자동 virtualization (react-window) |
| **변경사항 관리** | Stage → Commit → Push/Pull + 파일 클릭 시 working tree diff 미리보기 |
| **브랜치** | 생성 / 전환 / 머지 (--no-ff 옵션) / 삭제 (force 옵션) |
| **Stash** | save (untracked 포함 옵션) / apply / pop / drop / diff 미리보기 |
| **파일 히스토리** | `git log --follow` 기반 타임라인 + 커밋 클릭 시 diff 전환 |
| **태그 표시** | 커밋 로그에 HEAD/브랜치/리모트/태그 pill 분리 |

### 심볼 단위 히스토리 (차별점) ⭐
일반 Git GUI는 파일 단위 추적만 가능. GitScope는 **Tree-sitter + `git log -L`** 로 **함수/클래스/메서드 단위 히스토리**를 제공합니다.

| 지원 언어 | 탐지 심볼 |
|---|---|
| TypeScript / TSX / JavaScript / JSX | function, class, method, interface, enum, type, arrow function |
| Rust | function, struct, enum, trait, impl, mod |
| Python | function, class (+ decorated) |
| **C#** | method, class, struct, interface, enum, constructor, record, property |

파일 히스토리 탭에서 심볼을 고르면 **그 심볼이 변경된 커밋만** 필터링됩니다. 리팩토링 히스토리 추적, 특정 함수의 의도 변화 파악, 인수인계에 유용합니다.

### 고급 Git 액션 (v0.3.0 신규) 🆕
커밋 로그에서 **우클릭** 한 번으로 모든 고급 작업 수행:

| 액션 | 설명 |
|------|------|
| **Cherry-pick** | 다른 브랜치 커밋을 현재 브랜치로 적용 · 머지 커밋은 `-m 1` 자동 적용 · 충돌 시 진행 중 배너로 abort/continue |
| **Reset** (soft / mixed / hard) | HEAD 이동 — soft는 staging 유지, mixed는 staging 비움, **hard는 명시적 데이터 손실 경고** + danger ConfirmModal |
| **Rebase** (비-interactive) | 현재 브랜치를 선택 커밋 위로 재배치 · 충돌 시 계속 / 건너뛰기 / 중단 3-액션 배너 |
| **Interactive rebase** ⭐ | 모달로 ↑↓ 재정렬 / drop / **reword** / **squash** (메시지 결합) / **fixup** (메시지 폐기) 5가지 액션 · `git rebase -i` todo 파일 안 쓰고 cherry-pick 체인으로 안전 구현 · 충돌 또는 실패 시 **원본 HEAD로 자동 롤백** |
| **충돌 빠른 해결** | cherry-pick / rebase 진행 중 충돌 파일 자동 감지 → 파일별 [Take ours] [Take theirs] 버튼으로 즉시 해결 + auto-staging |

### Code Forensics
| 분석 | 설명 |
|------|------|
| **변경 빈도 히트맵** | 파일별 변경 횟수 · 추가/삭제 · 기여자 수 시각화 |
| **핫스팟 분석** | `changes × 3 + authors × 5 + churn × 0.01 + recent × 10` 공식으로 리팩토링 후보 자동 식별 |
| **시간축 트렌드** | 기간별 커밋 · 파일변경 · 코드변동량 추이 |
| **기여자 분석** | 기여자별 커밋 수 + 주요 담당 파일 영역 (대용량 레포 대응 lazy load) |
| **HEAD 기반 캐싱** | Forensics 결과를 HEAD hash로 캐싱 → 재방문 시 즉시 응답 |
| **진행률 스트리밍** | `tauri::ipc::Channel`로 스캔 중 실시간 진행도 표시 (대용량 레포) |
| **카드별 독립 로딩** | 4종 카드가 병렬로 독립 로드, 개별 에러/재시도 |

### UX
- **Catppuccin 4 flavor 테마 전환** — Mocha / Latte / Frappé / Macchiato (localStorage 저장)
- **Lucide SVG** 아이콘 시스템 (이모지 미사용, OS 의존성 제거)
- **토스트** 알림 (info / success / error / warn)
- **커스텀 확인 모달** (Enter/Esc 지원)
- **키보드 단축키**: Ctrl+1~4 탭 전환, F5 새로고침, ↑↓/j·k 리스트 네비
- **최근 레포 목록** (AppData에 최대 10개 저장)
- **네이티브 폴더 다이얼로그** (tauri-plugin-dialog)

## 기술 스택

| 계층 | 기술 |
|------|------|
| Desktop Shell | Tauri 2.10 |
| Frontend | React 18 + TypeScript + Vite 6 |
| Backend | Rust (`std::process::Command` 로 git CLI 래핑) |
| AST 파싱 | tree-sitter + TS/Rust/Python/C# grammar |
| 아이콘 | lucide-react |
| Virtualization | react-window 2.x |
| 테마 | Catppuccin (4 flavor) |

## 빠른 시작 (개발자)

### 요구사항
- **Node.js 18+**
- **Rust (rustup)** — [rustup.rs](https://rustup.rs) (Windows는 MSVC toolchain)
- **Microsoft C++ Build Tools** (Windows) — "Desktop development with C++" 워크로드
- **Git 2.0+**
- **WebView2** — Windows 10 1803+ / 11에는 자동 포함

### 설치
```bash
git clone https://github.com/cho1124/GitScope.git
cd GitScope
npm install
```

### 개발 모드 실행
```bash
npm run dev
```
Tauri 창이 뜨면 폴더 선택 또는 경로 직접 입력. 첫 빌드는 tree-sitter grammar 컴파일 때문에 ~2분.

### 프로덕션 빌드
```bash
npm run build
```
산출물:
- `src-tauri/target/release/app.exe` — 단일 실행 파일
- `src-tauri/target/release/bundle/nsis/*.exe` — NSIS 설치 프로그램
- `src-tauri/target/release/bundle/msi/*.msi` — MSI 설치

## 사용법

1. 앱 실행 → **폴더 선택** 버튼으로 레포 선택 (또는 경로 직접 입력)
2. 이후 접속은 웰컴 화면의 **최근 레포** 목록에서 클릭
3. **커밋 로그** 탭 — 커밋 클릭 → diff 표시 (↑↓ 또는 j/k로 이동)
4. **변경사항** 탭 — 파일 클릭 → working tree diff 미리보기 → Stage → 커밋
5. **Stash** 탭 — 저장 / apply / pop / drop
6. **Code Forensics** 탭 — 히트맵 · 핫스팟 · 트렌드 · 기여자 분석 (HEAD 캐싱 + 진행률)
7. 헤더의 **브랜치 드롭다운** — 전환 / 생성 / 머지 / 삭제
8. 헤더의 **테마 드롭다운** — Mocha / Latte / Frappé / Macchiato
9. 파일 트리에서 파일 선택 → **파일 히스토리** 탭 → 상단 **심볼 드롭다운** 에서 함수/클래스 선택

## 프로젝트 구조

```
GitScope/
├── src-tauri/                    # Rust 백엔드
│   ├── src/
│   │   ├── main.rs              # entry
│   │   ├── lib.rs               # AppState + 커맨드 등록 (26개)
│   │   ├── git.rs               # 기본 git 명령 (15개)
│   │   ├── stash.rs             # stash + working tree diff (8개)
│   │   ├── forensics.rs         # Forensics 4종 + HEAD 캐싱 + 진행률 스트리밍
│   │   ├── symbols.rs           # Tree-sitter 심볼 파싱 + git log -L
│   │   └── recent.rs            # 최근 레포 저장 (AppData JSON)
│   ├── capabilities/default.json # dialog 권한
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/client/                   # React 프론트엔드
│   ├── App.tsx
│   ├── api.ts                   # invoke 래퍼 + 공통 타입 (Symbol, ProgressEvent 등)
│   ├── global.css               # Catppuccin 4 flavor + 디자인 토큰 + progress bar
│   ├── main.tsx                 # ToastProvider + ConfirmProvider + initial theme
│   └── components/
│       ├── WelcomeScreen.tsx
│       ├── CommitLog.tsx        # pagination + 키보드 네비
│       ├── CommitPanel.tsx      # Stage + 커밋 + diff 미리보기
│       ├── DiffView.tsx         # react-window virtualization
│       ├── FileTree.tsx         # lazy loading (expand 시점 로드)
│       ├── FileHistory.tsx      # 심볼 드롭다운 통합
│       ├── BranchSelector.tsx   # 헤더 드롭다운
│       ├── ThemeSelector.tsx    # 헤더 테마 드롭다운
│       ├── StashPanel.tsx
│       ├── StatusBar.tsx        # 5초 폴링
│       ├── ForensicsDashboard.tsx # 카드별 AsyncState + progress
│       ├── Toast.tsx            # ToastProvider + useToast
│       ├── ConfirmModal.tsx     # ConfirmProvider + useConfirm
│       └── forensics/
│           ├── HeatmapCard.tsx
│           ├── HotspotCard.tsx
│           ├── TrendChart.tsx
│           └── ContributorCard.tsx
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Code Forensics란?

기존 Git GUI는 커밋 로그와 Diff만 보여줍니다. GitScope는 **코드 변경 패턴을 분석**하여 추가 인사이트를 제공합니다.

- **히트맵**: "어떤 파일이 가장 자주 바뀌는가?" → 불안정한 코드 식별
- **핫스팟**: 변경 빈도 × 기여자 수 × 최근 활동도 → 리팩토링 우선순위
- **트렌드**: "프로젝트의 변경 속도가 빨라지고 있는가?" → 개발 추이 파악
- **기여자**: "누가 어떤 코드를 주로 관리하는가?" → 코드 오너십 시각화

여기에 **심볼 단위 히스토리** (GitScope 고유)로 "이 함수는 왜 이렇게 복잡해졌지?"를 커밋 단위로 추적할 수 있습니다.

유사 도구:
- **CodeScene** — SaaS, 유료, 커뮤니티 에디션 2023년 종료
- **Code Maat** — CLI 전용, 시각화 없음
- **GitScope** — 무료 + 로컬 + 시각화 + Git GUI 통합 + **심볼 단위 히스토리**

## 로컬 디자인 엔진 방향

GitScope의 AI 기능은 일반 챗봇을 붙이는 방향보다 **로컬 디자인 엔진 내장**으로 가져간다. 목표는 테마 커스터마이징을 앱의 고유 기능으로 만드는 것이며, 외부 서비스 의존 없이 로컬 모델이 Git GUI용 팔레트를 생성하고 수정하도록 한다.

### 핵심 판단
- **Ollama 의존은 피한다.** 설치/실행/model pull을 사용자에게 맡기면 앱 내장 기능이라기보다 외부 연동처럼 보인다.
- **1차 구현은 `llama.cpp` sidecar + Gemma 계열 GGUF 모델**이 가장 현실적이다. `libllama`를 Rust에 직접 링크하는 방식은 더 깊은 내장이지만, Windows 배포와 GPU/CPU 빌드 분기, FFI 안정성 비용이 커서 후순위로 둔다.
- 모델 자체를 처음부터 디자인 전용으로 학습하기보다, **디자인 전용 시스템 프롬프트 + 예시 팔레트 + JSON grammar + 코드 검증**으로 좁은 문제를 안정화한다.
- 테마 생성은 범위가 좁으므로 거대한 모델보다 **Gemma 1B/2B급 instruct Q4 GGUF**로 먼저 검증한다. 고품질 모드는 이후 4B/7B 선택지로 확장한다.

### 제안 아키텍처
```text
SettingsModal
  -> invoke('generate_local_theme')
    -> src-tauri/src/ai.rs
      -> llama.cpp sidecar 실행/상태 확인
      -> localhost OpenAI-compatible API 호출
      -> ThemePalette JSON 파싱
      -> WCAG/토큰 검증 및 필요 시 보정
      -> 프론트로 14개 CSS 토큰 반환
```

### 구현 단계
1. 기존 Anthropic 테마 생성기를 `ThemeAiProvider` 구조로 분리한다.
   - `anthropic`은 선택적 BYOK provider로 유지 가능.
   - 기본 방향은 `local-llama` provider.
2. `src-tauri/src/ai.rs`를 추가한다.
   - `get_ai_status`
   - `start_local_model`
   - `generate_local_theme`
3. `llama-server`를 Tauri sidecar로 번들링한다.
   - `src-tauri/tauri.conf.json`의 `bundle.externalBin` 사용.
   - 모델 로딩 상태, 실패 원인, 포트 점유 상태를 UI에 노출.
4. Gemma GGUF 모델 관리 정책을 정한다.
   - 앱에 동봉할지, 첫 실행 시 사용자가 라이선스 동의 후 다운로드하게 할지 결정.
   - Gemma 라이선스 조건 때문에 배포 방식은 별도 확인 필요.
5. 출력 안정화를 코드에서 강제한다.
   - 14개 토큰 누락 검증.
   - hex 형식 검증.
   - `text-primary`/`bg-primary` WCAG AA contrast 검사.
   - dark/light 배경 luminance 검사.
   - semantic color hue 분리 검사.
6. 수동 커스터마이징 편집기를 붙인다.
   - AI 생성만 있으면 뽑기 기능에 가깝다.
   - 색상 picker, 토큰별 swatch, JSON import/export, contrast warning까지 있어야 테마 커스터마이징으로 느껴진다.
7. AI 수정 명령을 지원한다.
   - "이 테마를 더 어둡게"
   - "accent만 파란 계열로"
   - "대비를 더 올려줘"
   - "GitHub Dark 느낌으로"

### 포지셔닝
이 기능은 "AI 챗봇 내장"이 아니라 **GitScope Local Design Engine**으로 표현한다. GitScope가 코드 히스토리와 Forensics를 로컬에서 분석하듯, 테마 디자인도 로컬 모델이 앱 내부에서 생성/수정하는 구조가 제품 정체성과 잘 맞는다.
## 개발 진행 상황

| Phase | 범위 | 상태 |
|-------|------|------|
| Phase 0-3 | Tauri 마이그레이션 (Express→Rust) + Forensics | ✅ |
| Phase 4-1 | 브랜치 UI + long path strip | ✅ |
| Phase 4-2 | 폴더 dialog + 최근 레포 + FileTree lazy | ✅ |
| Phase 4-3 | stash + working tree diff + tag pill | ✅ |
| Phase 5 | 토스트 + ConfirmModal + pagination + 키보드 네비 + Forensics 개별 로딩 | ✅ |
| Phase 6 | Lucide 아이콘 + Diff virtualization + CSS 토큰 | ✅ |
| Phase 7-1 | Forensics 진행률 스트리밍 (tauri::ipc::Channel) | ✅ |
| Phase 7-2 | 테마 전환 (Catppuccin 4 flavor) | ✅ |
| **Phase 9-A/B** | **심볼 단위 히스토리 (Tree-sitter + `git log -L`)** | ✅ |
| **Phase 9-C** | **Python + C# 언어 지원 확장** | ✅ |
| Phase 9-D | 리네임/이동 추적 — `git log -L` 가 자동 처리 확인 후 종료 | ✅ |
| **Phase 8-A** | **Cherry-pick (단일 + 충돌 처리 + merge `-m 1`)** | ✅ |
| **Phase 8-B** | **Reset (soft / mixed / hard, 위험도 차등 ConfirmModal)** | ✅ |
| **Phase 8-C** | **Rebase 비-interactive (충돌 시 ProgressBanner)** | ✅ |
| **Phase 8-D** | **Interactive rebase MVP (reorder + drop, cherry-pick 체인 + 자동 롤백)** | ✅ |
| **Phase 8-E** | **Interactive rebase reword** | ✅ |
| **Phase 8-F** | **Interactive rebase squash + fixup** | ✅ |
| **Phase 8-G-1** | **충돌 ours/theirs 빠른 해결 패널** | ✅ |
| Phase 8-G-2 | 3-way side-by-side diff viewer (region 단위 해결) | 🔜 |
| Phase 10 | Knowledge Graph + MCP (GitNexus 영감) | 🔜 |
| Phase 11 | Local Design Engine: llama.cpp sidecar + Gemma GGUF 기반 로컬 테마 생성/수정 | 🔜 |

상세 계획과 이어받기 가이드는 [DEVELOPMENT.md](DEVELOPMENT.md) 참고.

### 브랜치
- `master` — 메인 개발 브랜치 (Tauri)
- `archive/express-version` — 이전 Express + Vite 웹앱 버전 (참조용 보존)

## 라이선스

MIT License