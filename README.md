# GitScope

Code Forensics 시각화를 내장한 **로컬 데스크톱 Git GUI** (Tauri 기반).

![Tauri](https://img.shields.io/badge/Tauri-2.10-24c8db.svg)
![React](https://img.shields.io/badge/React-18-61dafb.svg)
![Rust](https://img.shields.io/badge/Rust-1.95+-dea584.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

## 다운로드

**[최신 릴리즈 → v0.1.1](https://github.com/cho1124/GitScope/releases/latest)**

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

### Code Forensics (차별점)
| 분석 | 설명 |
|------|------|
| **변경 빈도 히트맵** | 파일별 변경 횟수 · 추가/삭제 · 기여자 수 시각화 |
| **핫스팟 분석** | `changes × 3 + authors × 5 + churn × 0.01 + recent × 10` 공식으로 리팩토링 후보 자동 식별 |
| **시간축 트렌드** | 기간별 커밋 · 파일변경 · 코드변동량 추이 |
| **기여자 분석** | 기여자별 커밋 수 + 주요 담당 파일 영역 (대용량 레포 대응 lazy load) |
| **HEAD 기반 캐싱** | Forensics 결과를 HEAD hash로 캐싱 → 재방문 시 즉시 응답 |
| **카드별 독립 로딩** | 4종 카드가 병렬로 독립 로드, 개별 에러/재시도 |

### UX
- **Catppuccin Mocha** 다크 테마
- **Lucide SVG** 아이콘 시스템 (이모지 미사용, OS 의존성 제거)
- **토스트** 알림 (info / success / error / warn)
- **커스텀 확인 모달** (Enter/Esc 지원)
- **키보드 단축키**: Ctrl+1~4 탭 전환, F5 새로고침
- **최근 레포 목록** (AppData에 최대 10개 저장)
- **네이티브 폴더 다이얼로그** (tauri-plugin-dialog)

## 기술 스택

| 계층 | 기술 |
|------|------|
| Desktop Shell | Tauri 2.10 |
| Frontend | React 18 + TypeScript + Vite 6 |
| Backend | Rust (`std::process::Command`로 git CLI 래핑) |
| 아이콘 | lucide-react |
| Virtualization | react-window 2.x |
| 테마 | Catppuccin Mocha |

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
Tauri 창이 뜨면 폴더 선택 또는 경로 직접 입력.

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
6. **Code Forensics** 탭 — 히트맵 · 핫스팟 · 트렌드 · 기여자 분석 (HEAD 캐싱)
7. 헤더의 **브랜치 드롭다운** — 전환 / 생성 / 머지 / 삭제

## 프로젝트 구조

```
GitScope/
├── src-tauri/                    # Rust 백엔드
│   ├── src/
│   │   ├── main.rs              # entry
│   │   ├── lib.rs               # AppState + 커맨드 등록 (24개)
│   │   ├── git.rs               # 기본 git 명령 (15개)
│   │   ├── stash.rs             # stash + working tree diff (8개)
│   │   ├── forensics.rs         # Forensics 4종 + HEAD 캐싱
│   │   └── recent.rs            # 최근 레포 저장 (AppData JSON)
│   ├── capabilities/default.json # dialog 권한
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/client/                   # React 프론트엔드
│   ├── App.tsx
│   ├── api.ts                   # invoke 래퍼 + 공통 타입
│   ├── global.css               # Catppuccin + 디자인 토큰
│   ├── main.tsx                 # ToastProvider + ConfirmProvider
│   └── components/
│       ├── WelcomeScreen.tsx
│       ├── CommitLog.tsx        # pagination + 키보드 네비
│       ├── CommitPanel.tsx      # Stage + 커밋 + diff 미리보기
│       ├── DiffView.tsx         # react-window virtualization
│       ├── FileTree.tsx         # lazy loading (expand 시점 로드)
│       ├── FileHistory.tsx
│       ├── BranchSelector.tsx   # 헤더 드롭다운
│       ├── StashPanel.tsx
│       ├── StatusBar.tsx        # 5초 폴링
│       ├── ForensicsDashboard.tsx
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

유사 도구:
- **CodeScene** — SaaS, 유료, 커뮤니티 에디션 2023년 종료
- **Code Maat** — CLI 전용, 시각화 없음
- **GitScope** — 무료 + 로컬 + 시각화 + Git GUI 통합

## 개발 진행 상황

| Phase | 범위 | 상태 |
|-------|------|------|
| Phase 0-3 | Tauri 마이그레이션 (Express→Rust) + Forensics | ✅ |
| Phase 4-1 | 브랜치 UI + long path strip | ✅ |
| Phase 4-2 | 폴더 dialog + 최근 레포 + FileTree lazy | ✅ |
| Phase 4-3 | stash + working tree diff + tag pill | ✅ |
| Phase 5 | 토스트 + ConfirmModal + pagination + 키보드 네비 + Forensics 개별 로딩 | ✅ |
| Phase 6 | Lucide 아이콘 + Diff virtualization + CSS 토큰 | ✅ |
| Phase 7 | 진행률 이벤트 + 테마 전환 + 스크린샷 | 🔜 |

상세 계획과 이어받기 가이드는 [DEVELOPMENT.md](DEVELOPMENT.md) 참고.

### 브랜치
- `master` — 메인 개발 브랜치 (Tauri)
- `archive/express-version` — 이전 Express + Vite 웹앱 버전 (참조용 보존)

## 라이선스

MIT License