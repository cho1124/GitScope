# 🌶️ Pepper

> 내장 AI · Code Forensics · 심볼 단위 히스토리를 갖춘 친근한 로컬 데스크톱 Git GUI.
> **Tauri 2 + Rust + React + 로컬 GGUF 모델** — 외부 클라우드 의존 없이 코드의 매운맛까지 분석합니다.

![Tauri](https://img.shields.io/badge/Tauri-2.10-24c8db.svg)
![React](https://img.shields.io/badge/React-18-61dafb.svg)
![Rust](https://img.shields.io/badge/Rust-1.95+-dea584.svg)
![On-device AI](https://img.shields.io/badge/AI-on--device-ff6b35.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

## 다운로드

**[최신 릴리즈 → v0.5.0](https://github.com/cho1124/Pepper/releases/latest)**
(GitScope → Pepper 리브랜딩 · llama.cpp 내장 AI · AI 커밋 메시지 · AI 심볼 요약 · 배경 데코)

| 파일                          | 크기  | 설명               |
|-------------------------------|-------|--------------------|
| `Pepper_x.y.z_x64-setup.exe`  | ~4 MB | NSIS 설치 (권장)   |
| `Pepper_x.y.z_x64_en-US.msi`  | ~6 MB | MSI 설치 (기업용)  |

> ⚠ 코드 서명이 없어 Windows SmartScreen 경고가 뜹니다.
> "추가 정보" → "실행"을 클릭하면 설치됩니다.
>
> ℹ️ 이전 이름 `GitScope` 시절 데이터(모델/설정/최근 레포)는 첫 실행 시 `pepper/` 디렉토리로 자동 마이그레이션됩니다.

## 주요 기능

### 기본 Git 작업
| 기능 | 설명 |
|------|------|
| **커밋 로그** | 페이지네이션 (100개씩), ↑↓ 또는 j/k 키보드 네비게이션, `--all` 전체 브랜치 토글, 행 세로 여백 슬라이더 |
| **Diff 뷰** | 400줄 이상 자동 virtualization (react-window), **hunk 단위 stage/unstage** |
| **변경사항 관리** | Stage → Commit → Push/Pull · 파일 클릭 시 working tree diff 미리보기 · **Ctrl/Shift 클릭으로 다중 선택** |
| **브랜치** | 생성 / 전환 / 머지 (--no-ff 옵션) / 삭제 (force 옵션) |
| **Stash** | save (untracked 포함 옵션) / apply / pop / drop / diff 미리보기 |
| **파일 히스토리** | `git log --follow` 기반 타임라인 + 커밋 클릭 시 diff 전환 |
| **태그 표시** | 커밋 로그에 HEAD/브랜치/리모트/태그 pill 분리 |
| **원격 동기화** | fetch · pull · push 통합 버튼 + 상태 pill (5초 폴링으로 ahead/behind 자동 표시) |

### 심볼 단위 히스토리 (차별점) ⭐
일반 Git GUI는 파일 단위 추적만 가능. Pepper는 **Tree-sitter + `git log -L`** 로 **함수/클래스/메서드 단위 히스토리**를 제공합니다.

| 지원 언어 | 탐지 심볼 |
|---|---|
| TypeScript / TSX / JavaScript / JSX | function, class, method, interface, enum, type, arrow function |
| Rust | function, struct, enum, trait, impl, mod |
| Python | function, class (+ decorated) |
| **C#** | method, class, struct, interface, enum, constructor, record, property |

파일 히스토리 탭에서 심볼을 고르면 **그 심볼이 변경된 커밋만** 필터링됩니다. 리팩토링 히스토리 추적, 특정 함수의 의도 변화 파악, 인수인계에 유용합니다.

### 내장 로컬 AI (v0.5.0 신규) 🆕
**llama.cpp sidecar + GGUF 모델**을 앱이 직접 관리합니다. 외부 ollama / API 키 / 클라우드 의존 없이 완전히 로컬에서 동작합니다.

| 항목 | 설명 |
|---|---|
| **llama.cpp 자동 통합** | 최신 릴리즈를 자동 다운로드(~50MB) · 포트 27182부터 가용 포트 자동 선택 · `/health` 폴링으로 ready 대기 · 메인 프로세스 종료 시 자동 정리 |
| **GGUF 모델 카탈로그** | **Qwen 2.5 Coder 3B Q4_K_M** (추천, ~2GB, 코딩 특화) · Qwen 2.5 Coder 1.5B (~1GB, 가벼움) |
| **`ThemeAiProvider` 추상화** | 로컬 / Anthropic BYOK 둘 다 같은 인터페이스로 호출 — `generate` · `refine` · `generateDecor` · `generateCommitMessage` · `summarizeSymbolHistory` 5개 메서드 |
| **OpenAI-compatible API** | 프론트에서 `localhost:port/v1/chat/completions` 로 직접 호출, Rust는 라이프사이클만 관리 |
| **StatusBar AI 칩** | 우측 `AI off` 클릭 → 30초 워밍업 후 `AI · :PORT` 표시 |

### AI 차별화 기능 (v0.5.0 신규) 🆕
로컬 AI를 단순 챗봇이 아니라 **Git 워크플로우 깊이 통합**합니다.

| 기능 | 설명 |
|---|---|
| **AI 커밋 메시지 생성** | 변경사항 탭 → 파일 stage → 힌트 입력(선택) → `✨ AI 생성` → conventional commit 한국어 subject/body 자동 분리. staged diff 기반 |
| **AI 심볼 진화 요약** | 좌측 심볼 히스토리 탭 → 심볼 선택 → `✨ AI 요약` → 함수/클래스의 `git log -L` 결과 → 자연어 narrative (요약 / 주요 변화 bullets / 현재 상태) |
| **AI 테마 생성기** | 자연어 ("어두운 사이버펑크 분위기") → Catppuccin 호환 14개 토큰 자동 생성 + `auditPalette()` 검증 |
| **AI 배경 데코 생성** | "고양이가 떠다니는" → `customIcons=["Cat","PawPrint"]` 자동 매핑 |

### 배경 데코 시스템 (v0.5.0 신규) 🎨
설정창 토글로 켜는 **떠다니는 아이콘 배경**. 시드 기반 파티클 시스템으로 결정적 렌더링.

- **3가지 drift 모드** — 자유 / 위로 / 아래로
- **9개 옵션** — 농도 · 속도 · 투명도 · 크기 · 색상 · 방향 · 아이콘 종류 등
- **36개 아이콘 풀** — git · code · minimal · fun (Cat, Dog, PawPrint 등) · custom (직접 지정)

### 커스텀 타이틀 바 (v0.4.0)
Linear / Discord 스타일의 통합 헤더. `decorations: false` 윈도우에 **자체 윈도우 컨트롤**을 그리고 헤더 전체를 드래그 영역으로 사용합니다.

- 🪟 **통합 헤더** — 로고 · 레포 · 브랜치 · 원격 동기화 · 설정 · 윈도우 컨트롤이 한 줄
- 🔄 **통합 RemoteSyncButton** — fetch/pull/push/refresh 4버튼을 1개로 + 상태 pill
- 📑 **탭 재정렬** — Stash 패널을 변경사항 탭에 흡수, 메인 탭은 변경사항 / 커밋 로그 / Forensics 3개

### 고급 Git 액션 (v0.3.0)
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
- **Catppuccin 4 flavor + AI 생성/수동 팔레트** — Mocha / Latte / Frappé / Macchiato + 커스텀 테마 (localStorage 저장)
- **Lucide SVG** 아이콘 시스템 (이모지 미사용, OS 의존성 제거)
- **사이드바 드래그 리사이저** (180~600px, 더블클릭으로 기본값 리셋)
- **날짜 포맷 토글** — 상대 / 절대 (설정창)
- **토스트** 알림 (info / success / error / warn) + **커스텀 확인 모달** (Enter/Esc)
- **키보드 단축키**: Ctrl+1~3 탭 전환, F5 새로고침, ↑↓/j·k 리스트 네비
- **최근 레포 목록** (AppData에 최대 10개 저장) + 네이티브 폴더 다이얼로그
- **WebView2 컨텍스트 메뉴 차단** — 우클릭 시 브라우저 기본 메뉴 차단

## 기술 스택

| 계층 | 기술 |
|------|------|
| Desktop Shell | Tauri 2.10 |
| Frontend | React 18 + TypeScript + Vite 6 |
| Backend | Rust (`std::process::Command` 로 git CLI 래핑) |
| AST 파싱 | tree-sitter + TS/Rust/Python/C# grammar |
| **로컬 AI** | **llama.cpp sidecar + Qwen 2.5 Coder GGUF** (OpenAI-compatible HTTP) |
| 아이콘 | lucide-react |
| Virtualization | react-window 2.x |
| 테마 | Catppuccin (4 flavor) + 커스텀 (AI 생성 / 수동 편집) |

## 빠른 시작 (개발자)

### 요구사항
- **Node.js 18+**
- **Rust (rustup)** — [rustup.rs](https://rustup.rs) (Windows는 MSVC toolchain)
- **Microsoft C++ Build Tools** (Windows) — "Desktop development with C++" 워크로드
- **Git 2.0+**
- **WebView2** — Windows 10 1803+ / 11에는 자동 포함

### 설치
```bash
git clone https://github.com/cho1124/Pepper.git
cd Pepper
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
3. **AI 워밍업**: StatusBar 우측 `AI off` 칩 → 시작 → 30초 후 `AI · :PORT` 표시 (첫 실행 시 모델 ~2GB 다운로드)
4. **변경사항** 탭 — 파일 클릭 → working tree diff → Stage (hunk 단위 가능) → `✨ AI 생성`으로 커밋 메시지 자동 작성 → 커밋. 하단 패널에서 **Stash** save / apply / pop / drop
5. **커밋 로그** 탭 — 커밋 클릭 → diff 표시 (↑↓ 또는 j/k로 이동) · 우클릭으로 cherry-pick / reset / rebase 등 고급 액션 · `--all` 토글로 전체 브랜치 보기
6. **Code Forensics** 탭 — 히트맵 · 핫스팟 · 트렌드 · 기여자 분석 (HEAD 캐싱 + 진행률)
7. 헤더의 **레포 셀렉터 / 브랜치 / 원격 동기화 / 설정** — 한 줄에서 모두 접근
8. **설정창** — 테마 (4 flavor + AI 생성 + 수동 편집) · AI 모델 관리 · 배경 데코 · 날짜 포맷
9. 좌측 **심볼 히스토리** 사이드바 → 파일 선택 → 함수/클래스 단위 변경 커밋만 필터링 → `✨ AI 요약`으로 진화 narrative 생성

## 프로젝트 구조

```
Pepper/
├── src-tauri/                       # Rust 백엔드
│   ├── src/
│   │   ├── main.rs                  # entry
│   │   ├── lib.rs                   # AppState + 커맨드 등록
│   │   ├── git.rs                   # 기본 git 명령 (cherry-pick / reset / rebase / fetch 등)
│   │   ├── stash.rs                 # stash + working tree diff + hunk staging
│   │   ├── forensics.rs             # Forensics 4종 + HEAD 캐싱 + 진행률 스트리밍
│   │   ├── symbols.rs               # Tree-sitter 심볼 파싱 + git log -L
│   │   ├── recent.rs                # 최근 레포 저장 (AppData JSON)
│   │   └── ai/                      # 로컬 AI 모듈 (Phase 11-B)
│   │       ├── mod.rs
│   │       ├── catalog.rs           # GGUF 모델 카탈로그
│   │       ├── download.rs          # llama.cpp + 모델 다운로드 + SHA 검증
│   │       ├── paths.rs             # AppData/pepper/ 경로 관리 + GitScope 마이그레이션
│   │       ├── server.rs            # llama.cpp sidecar 라이프사이클 + 포트 선택
│   │       └── commands.rs          # Tauri invoke 핸들러
│   ├── capabilities/default.json
│   ├── Cargo.toml
│   └── tauri.conf.json              # decorations: false
├── src/client/                      # React 프론트엔드
│   ├── App.tsx                      # 통합 헤더 + 배경 데코 마운트
│   ├── api.ts                       # invoke 래퍼 + 공통 타입
│   ├── global.css                   # Catppuccin 4 flavor + 디자인 토큰
│   ├── main.tsx                     # ToastProvider + ConfirmProvider + initial theme
│   ├── lib/
│   │   ├── dragRegion.ts
│   │   ├── graph.ts                 # 브랜치 lane 알고리즘
│   │   └── ai/                      # ThemeAiProvider 추상화
│   │       ├── types.ts             # 5개 메서드 인터페이스
│   │       ├── anthropic.ts         # Anthropic BYOK provider
│   │       ├── local.ts             # llama.cpp 로컬 provider (5개 메서드 전체 구현)
│   │       ├── validation.ts        # auditPalette() 검증
│   │       └── index.ts             # provider 선택 / 초기화
│   └── components/
│       ├── WelcomeScreen.tsx
│       ├── WindowControls.tsx
│       ├── BackgroundDecor.tsx      # 시드 기반 파티클 + 36 아이콘 풀
│       ├── LocalAiSettings.tsx      # 모델 다운로드 진행률 + 시작/종료
│       ├── RemoteSyncButton.tsx
│       ├── RepoSelector.tsx
│       ├── BranchSelector.tsx
│       ├── SettingsModal.tsx
│       ├── ThemeSelector.tsx
│       ├── ManualPaletteEditor.tsx
│       ├── CommitLog.tsx
│       ├── CommitGraph.tsx
│       ├── CommitPanel.tsx          # AI 커밋 메시지 진입점
│       ├── StashAccordion.tsx
│       ├── StashPanel.tsx
│       ├── DiffView.tsx             # hunk 단위 stage 버튼
│       ├── FileTree.tsx
│       ├── FileHistory.tsx          # AI 심볼 요약 진입점
│       ├── InteractiveRebaseModal.tsx
│       ├── StatusBar.tsx            # AI 상태 칩
│       ├── ForensicsDashboard.tsx
│       ├── Toast.tsx
│       ├── ConfirmModal.tsx
│       └── forensics/
│           ├── HeatmapCard.tsx
│           ├── HotspotCard.tsx
│           ├── TrendChart.tsx
│           └── ContributorCard.tsx
├── package.json
├── vite.config.ts                   # src-tauri/target/ watch 제외 필수
└── tsconfig.json
```

## Code Forensics란?

기존 Git GUI는 커밋 로그와 Diff만 보여줍니다. Pepper는 **코드 변경 패턴을 분석**하여 추가 인사이트를 제공합니다.

- **히트맵**: "어떤 파일이 가장 자주 바뀌는가?" → 불안정한 코드 식별
- **핫스팟**: 변경 빈도 × 기여자 수 × 최근 활동도 → 리팩토링 우선순위
- **트렌드**: "프로젝트의 변경 속도가 빨라지고 있는가?" → 개발 추이 파악
- **기여자**: "누가 어떤 코드를 주로 관리하는가?" → 코드 오너십 시각화

여기에 **심볼 단위 히스토리** (Pepper 고유)로 "이 함수는 왜 이렇게 복잡해졌지?"를 커밋 단위로 추적할 수 있습니다.

유사 도구:
- **CodeScene** — SaaS, 유료, 커뮤니티 에디션 2023년 종료
- **Code Maat** — CLI 전용, 시각화 없음
- **Pepper** — 무료 + 로컬 + 시각화 + Git GUI 통합 + **심볼 단위 히스토리** + **내장 AI**

## 로컬 디자인 엔진 (Pepper Local Design Engine)

Pepper의 AI는 일반 챗봇을 붙이는 방향이 아니라 **앱에 내장된 좁은 도구**로 설계했습니다. Git 컨텍스트 (diff, 커밋 메타, 심볼 변경 이력)를 로컬 모델에 그대로 전달하고, 출력은 코드에서 검증·강제합니다.

### 핵심 판단
- **외부 ollama 의존을 제거합니다.** 사용자에게 ollama 설치/실행/`ollama pull`을 맡기면 외부 연동처럼 보입니다 — Pepper는 llama.cpp 바이너리와 GGUF 모델을 직접 관리합니다.
- **llama.cpp sidecar + GGUF**가 Windows 배포에 가장 안전합니다. `libllama` Rust FFI 방식은 GPU/CPU 빌드 분기, FFI 안정성 비용이 커서 후순위로 둡니다.
- **Qwen 2.5 Coder 3B Q4_K_M** — 코딩 컨텍스트 이해 + JSON 출력 + 한국어 OK + ~2GB. Phi-4-mini / Gemma 3 보다 코딩 특화로 선택.
- 거대한 모델보다 **좁은 시스템 프롬프트 + 예시 + JSON grammar + 코드 검증**으로 작은 모델을 안정화합니다.

### 구현 단계
1. ~~`ThemeAiProvider` 추상화로 Anthropic BYOK 분리~~ ✅ **Phase 11-A (v0.4.0)**
2. ~~`src-tauri/src/ai/` 모듈: 카탈로그 · 다운로드 · sidecar 라이프사이클~~ ✅ **Phase 11-B-1 (v0.5.0)**
3. ~~llama.cpp sidecar 자동 다운로드 + 가용 포트 자동 선택~~ ✅ **Phase 11-B-1 (v0.5.0)**
4. ~~GGUF 모델 카탈로그 + 라이선스 동의 후 첫 실행 시 다운로드~~ ✅ **Phase 11-B-1 (v0.5.0)**
5. ~~출력 안정화 (14 토큰 누락 검증 · hex 검증 · WCAG AA contrast · luminance · hue 분리)~~ ✅ **Phase 11-A**
6. ~~수동 팔레트 편집기 (`ManualPaletteEditor`)~~ ✅ **Phase 11-A**
7. ~~AI 커밋 메시지 · AI 심볼 진화 요약 · AI 배경 데코 생성~~ ✅ **Phase 11-B-2 / 11-D (v0.5.0)**
8. AI refine — 자연어 테마 수정 ("더 어둡게", "accent 파란색") 🔜 **Phase 11-C**

## 개발 진행 상황

| Phase | 범위 | 상태 |
|-------|------|------|
| Phase 0-3 | Tauri 마이그레이션 (Express→Rust) + Forensics | ✅ |
| Phase 4-1/2/3 | 브랜치 UI + 최근 레포 + lazy FileTree + stash | ✅ |
| Phase 5 | 토스트 + ConfirmModal + pagination + 키보드 네비 + Forensics 개별 로딩 | ✅ |
| Phase 6 | Lucide 아이콘 + Diff virtualization + CSS 토큰 | ✅ |
| Phase 7-1 | Forensics 진행률 스트리밍 (tauri::ipc::Channel) | ✅ |
| Phase 7-2 | 테마 전환 (Catppuccin 4 flavor) | ✅ |
| Phase 9-A/B/C | 심볼 단위 히스토리 (Tree-sitter + `git log -L`, TS/TSX/JS/Rust/Python/C#) | ✅ |
| Phase 9-D | 리네임/이동 추적 — `git log -L` 자동 처리 확인 후 종료 | ✅ |
| Phase 8-A~F | Cherry-pick / Reset 3종 / Rebase / Interactive rebase 5액션 | ✅ |
| Phase 8-G-1 | 충돌 ours/theirs 빠른 해결 패널 | ✅ |
| Phase 11-A | `ThemeAiProvider` 추상화 + 수동 팔레트 편집기 + auditPalette 검증 | ✅ |
| 커스텀 타이틀 바 | `decorations: false` + WindowControls + 통합 RemoteSyncButton (v0.4.0) | ✅ |
| **Phase 11-B-1** | **llama.cpp sidecar + Qwen GGUF 모델 카탈로그 (v0.5.0)** | ✅ |
| **Phase 11-B-2** | **AI 커밋 메시지 + AI 심볼 진화 요약 (v0.5.0)** | ✅ |
| **Phase 11-D** | **배경 데코 시스템 + AI 자연어 데코 생성 (v0.5.0)** | ✅ |
| **GitScope → Pepper 리브랜딩** | **identifier · 데이터 디렉토리 자동 마이그레이션 (v0.5.0)** | ✅ |
| **사용자 피드백 반영** | **hunk 단위 staging · 파일 다중 선택 · 사이드바 리사이저 · 날짜 포맷 토글 · `--all` 토글 · 행 여백 슬라이더 (v0.5.0)** | ✅ |
| Phase 8-G-2 | 3-way side-by-side diff viewer (region 단위 해결) | 🔜 |
| Phase 11-B-2-c | 충돌 해결 AI 제안 (자동화 위험 검토 후) | 🔜 |
| Phase 11-C | AI refine — 자연어 테마 수정 | 🔜 |
| Phase 11-E | 봉고캣 영감 미니 플로팅 모드 (메인 ↔ 미니 토글) | 🔜 |
| Phase 10 | Knowledge Graph + MCP (GitNexus 영감) | 🔜 |
| Git 호스팅 연동 | GitHub/GitLab API (PR/Issue) | 🔜 |

상세 계획과 이어받기 가이드는 [DEVELOPMENT.md](DEVELOPMENT.md) 참고.

### 브랜치
- `master` — 메인 개발 브랜치
- `archive/express-version` — 이전 Express + Vite 웹앱 버전 (참조용 보존)

## 라이선스

MIT License