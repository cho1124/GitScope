# GitScope

Code Forensics 시각화를 내장한 **로컬 데스크톱 Git GUI** (Tauri 기반).

![Tauri](https://img.shields.io/badge/Tauri-2.10-24c8db.svg)
![React](https://img.shields.io/badge/React-18-61dafb.svg)
![Rust](https://img.shields.io/badge/Rust-1.95+-dea584.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

## 주요 기능

| 기능 | 설명 |
|------|------|
| **커밋 로그** | 커밋 히스토리 조회 + Diff 뷰 |
| **변경사항 관리** | Stage / Commit / Push / Pull |
| **파일 히스토리** | 파일별 커밋 타임라인 (`git log --follow`) |
| **변경 빈도 히트맵** | 파일별 변경 횟수 · 추가/삭제 · 기여자 수 시각화 |
| **핫스팟 분석** | 자주 바뀌는 파일 = 리팩토링 후보 자동 식별 |
| **시간축 트렌드** | 기간별 커밋 · 파일변경 · 코드변동량 추이 |
| **기여자 분석** | 기여자별 커밋 수 + 주요 담당 파일 영역 |
| **HEAD 기반 캐싱** | Forensics 결과를 HEAD hash로 캐싱 → 재방문 시 즉시 응답 |

## 기술 스택

| 계층 | 기술 |
|------|------|
| Desktop Shell | Tauri 2.10 |
| Frontend | React 18 + TypeScript + Vite 6 |
| Backend | Rust (std::process::Command로 git CLI 래핑) |
| 스타일 | Catppuccin Mocha 다크 테마 |

## 빠른 시작

### 요구사항
- **Node.js 18+**
- **Rust (rustup)** — [rustup.rs](https://rustup.rs) (Windows는 MSVC toolchain)
- **Microsoft C++ Build Tools** (Windows) — [다운로드](https://visualstudio.microsoft.com/visual-cpp-build-tools/), "Desktop development with C++" 워크로드
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
Tauri 창이 뜨면 레포 경로 입력 또는 선택.

### 프로덕션 빌드 (MSI/EXE)
```bash
npm run build
```
산출물: `src-tauri/target/release/bundle/`

## 사용법

1. **레포 열기** — 경로 입력 (예: `C:/Users/yourname/project`)
2. **커밋 로그 탭** — 커밋 목록 → 클릭하면 Diff 표시
3. **변경사항 탭** — Stage → 커밋 메시지 입력 → 커밋
4. **파일 트리** 사이드바에서 파일 클릭 → 파일 히스토리 전환
5. **Code Forensics 탭** — 히트맵 · 핫스팟 · 트렌드 · 기여자 분석 (첫 스캔 후 캐시됨)

## 프로젝트 구조

```
GitScope/
├── src-tauri/                    # Rust 백엔드
│   ├── src/
│   │   ├── main.rs              # entry
│   │   ├── lib.rs               # AppState + 커맨드 등록
│   │   ├── git.rs               # 기본 git 명령 12개
│   │   └── forensics.rs         # Forensics 4종 + HEAD 캐싱
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/client/                   # React 프론트엔드
│   ├── App.tsx
│   ├── api.ts                   # invoke 래퍼
│   ├── global.css               # Catppuccin Mocha 테마
│   └── components/
│       ├── CommitLog.tsx
│       ├── CommitPanel.tsx
│       ├── DiffView.tsx
│       ├── FileTree.tsx
│       ├── FileHistory.tsx
│       ├── ForensicsDashboard.tsx
│       ├── StatusBar.tsx
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
- **핫스팟**: `changes × 3 + authors × 5 + churn × 0.01 + recent × 10` 공식으로 리팩토링 우선순위
- **트렌드**: "프로젝트의 변경 속도가 빨라지고 있는가?" → 개발 추이 파악
- **기여자**: "누가 어떤 코드를 주로 관리하는가?" → 코드 오너십 시각화

## 진행 상황

Phase 0-3 완료 (Tauri 마이그레이션 + Forensics 캐싱). 남은 계획은 [DEVELOPMENT.md](DEVELOPMENT.md) 참고.

### 브랜치
- `master` — 메인 개발 브랜치 (Tauri)
- `archive/express-version` — 이전 Express + Vite 웹앱 버전 (참조용 보존)

## 라이선스

MIT License
