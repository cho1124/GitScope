//! Phase 11-B — 로컬 AI (llama.cpp sidecar + GGUF 모델) 통합.
//!
//! 책임 분리:
//! - paths: 모델/바이너리 저장 위치 helper (~/.local/share/pepper/...)
//! - catalog: 지원 모델 목록 + 메타데이터 (URL/사이즈/라이선스)
//! - download: HTTP 스트리밍 다운로드 + 진행률 이벤트
//! - server: llama-server 자식 프로세스 시작/종료/상태
//! - commands: tauri::command 노출
//!
//! 추론 호출(OpenAI compatible) 자체는 프론트엔드에서 localhost:port 로 직접
//! fetch 한다 — Rust 는 라이프사이클만 관리.

pub mod paths;
pub mod catalog;
pub mod download;
pub mod server;
pub mod commands;

pub use commands::*;
pub use server::AiServerHandle;
