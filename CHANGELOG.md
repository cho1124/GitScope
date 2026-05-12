# Changelog

## v0.5.0 — 2026-05-12

### 🌶️ Rebranding
- **GitScope → Pepper** — 친근함과 mascot 잠재력을 위해 변경
- 자동 마이그레이션: 기존 모델/바이너리 (~2GB) + localStorage 설정 + 최근 레포 목록 모두 보존
- identifier: `com.gitscope.app` → `dev.cho1124.pepper`
- 저장소 이름: `cho1124/GitScope` → `cho1124/Pepper` (GitHub redirect 자동)

### ✨ 내장 AI (Phase 11-B-1)
- **llama.cpp sidecar 자동 통합** — 외부 ollama 설치 불필요
  - llama.cpp 최신 릴리즈 자동 다운로드 (~50MB)
  - 포트 27182부터 가용 포트 자동 선택, `/health` 폴링으로 ready 대기
- **GGUF 모델 카탈로그**
  - Qwen 2.5 Coder 3B (추천, ~2GB) — 코딩 특화
  - Qwen 2.5 Coder 1.5B (가벼움, ~1GB)
- 설정창에 모델 다운로드 진행률 + 시작/종료 UI

### 🤖 AI 차별화 기능 (Phase 11-B-2)
- **AI 커밋 메시지 생성** — 변경사항 탭에서 `✨ AI 생성` 버튼.
  staged diff → conventional commit (한국어, scope 포함, body 자동).
  사용자 힌트 입력 가능 ("리팩토링", "버그 픽스" 등)
- **AI 심볼 진화 요약** — 좌측 심볼 히스토리에서 `✨ AI 요약` 버튼.
  함수/클래스의 git log -L 결과 → 자연어 narrative (요약 / 주요 변화 bullets / 현재 상태)

### 🎨 배경 데코 시스템 (Phase 11-D)
- **떠다니는 아이콘 배경** — 설정창에서 토글
  - 시드 기반 파티클 시스템, 3가지 drift 모드 (자유/위로/아래로)
  - 9개 옵션 (농도/속도/투명도/크기/색상/방향/아이콘 종류 등)
- **36개 아이콘 풀**: git / code / minimal / fun (Cat, Dog, PawPrint 등) / custom (직접 지정)
- **AI 자연어 생성**: "고양이가 떠다니는" → `customIcons=["Cat", "PawPrint"]` 자동

### 📋 사용자 피드백 반영 (10건 중 7건)
- `#5` 커밋 로그에 "전체 브랜치 보기" 토글 (`--all`)
- `#6` 커밋 행 세로 여백 슬라이더 (그래프 lineHeight 동기화)
- `#7` 사이드바 드래그 리사이저 (180~600px, 더블클릭으로 기본값 리셋)
- `#8` 날짜 포맷 토글 (상대 / 절대) — 설정창
- `#4` hunk 단위 stage/unstage — DiffView에 hunk별 버튼
- 파일 다중 선택 (Ctrl/Shift+클릭) — 한 번에 N개 Stage/Unstage
- RemoteSync 가시성 — 상태 pill + 트리거 확대 + 드롭다운 폭 확장
- `#9` 내장 AI (위 Phase 11-B-1 참조)
- `#10` AI 차별화 (위 Phase 11-B-2 + 11-D 참조)

### 보류
- `#2` 코드 서명 (인증서 비용)
- `#3` MSI 경로 변경 시 폴더 생성 (커스텀 wxs 템플릿 필요)
- `Phase 11-B-2-c` 충돌 해결 자동 제안 (자동화 위험 검토 필요)

### 다음 후보
- **Phase 11-E** — 봉고캣 영감 미니 플로팅 모드 (메인 ↔ 미니 토글, 빠른 커밋 워크플로우)
- **#1** Git 호스팅 연동 (GitHub/GitLab API — PR/Issue)

---

## v0.4.0 — 2026-04-30
- Phase 11-A: ThemeAiProvider 추상화 + ManualPaletteEditor + auditPalette() 검증
- 커스텀 타이틀 바 (decorations false + WindowControls + drag handler)
- AnthropicThemeProvider (BYOK) + LocalLlamaThemeProvider 스텁

## v0.3.0 — 이전
- Phase 8 전체 (cherry-pick / reset / rebase / interactive rebase / 충돌 해결)

## v0.2.0 — 이전
- Phase 9 심볼 단위 히스토리 (Tree-sitter + git log -L)
- Phase 7-2 Catppuccin 4 flavor 테마 전환

## v0.1.x — Tauri 마이그레이션 초기
- Phase 0~6: Tauri 이전 + Forensics + 캐싱 + UI 폴리시