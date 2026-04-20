# GitScope

Code Forensics 시각화를 내장한 Git GUI 도구입니다.

![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)
![React](https://img.shields.io/badge/React-18-61dafb.svg)
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

## 스크린샷

> TODO: 스크린샷 추가 예정

## 빠른 시작

### 요구사항

- Node.js 18+
- Git

### 설치

```bash
git clone https://github.com/cho1124/GitScope.git
cd GitScope
npm install
```

### 실행

```bash
# 개발 모드 (HMR 지원)
npm run dev

# 빌드 후 실행
npm run build
npm start
```

- 개발 모드: `http://localhost:5173` (프론트엔드) + `http://localhost:3001` (API)
- 빌드 모드: `http://localhost:3001` (프론트엔드 + API 통합)

## 사용법

1. 브라우저에서 접속
2. 레포지토리 경로 입력 (예: `C:/Users/cho/Desktop/Project/MyRepo`)
3. **커밋 로그** 탭: 커밋 목록 조회 → 클릭하면 Diff 표시
4. **변경사항** 탭: Stage → 커밋 메시지 입력 → 커밋
5. **Code Forensics** 탭: 히트맵 · 핫스팟 · 트렌드 · 기여자 분석

## 기술 스택

| 계층 | 기술 |
|------|------|
| 프론트엔드 | React 18 + TypeScript + Vite |
| 백엔드 | Express + tsx |
| Git 연동 | simple-git |
| 스타일 | Catppuccin Mocha 다크 테마 |

## 프로젝트 구조

```
GitScope/
├── src/
│   ├── server/
│   │   ├── index.ts              # Express API 서버
│   │   ├── git-service.ts        # Git 명령 래퍼
│   │   └── forensics-service.ts  # Code Forensics 엔진
│   └── client/
│       ├── App.tsx               # 메인 앱
│       ├── api.ts                # API 클라이언트
│       ├── global.css            # 테마/스타일
│       └── components/
│           ├── CommitLog.tsx
│           ├── CommitPanel.tsx
│           ├── DiffView.tsx
│           ├── FileTree.tsx
│           ├── FileHistory.tsx
│           ├── ForensicsDashboard.tsx
│           ├── StatusBar.tsx
│           └── forensics/
│               ├── HeatmapCard.tsx
│               ├── HotspotCard.tsx
│               ├── TrendChart.tsx
│               └── ContributorCard.tsx
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

## 라이선스

MIT License