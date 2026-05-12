use serde::Serialize;

/// GitScope 가 지원하는 GGUF 모델 카탈로그.
///
/// 새 모델 추가 시 여기에 항목 추가하면 프론트엔드 SettingsModal 에 자동 노출.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub id: &'static str,
    pub label: &'static str,
    pub description: &'static str,
    /// HuggingFace resolve URL (직접 다운로드 가능)
    pub url: &'static str,
    pub filename: &'static str,
    /// 예상 사이즈(바이트) — UI 진행률/안내용. 실제 Content-Length 가 우선
    pub size_bytes: u64,
    pub license: &'static str,
    pub license_url: &'static str,
    /// 권장 컨텍스트 길이 (서버 -c 인자)
    pub ctx: u32,
    /// 기본 추천 여부
    pub recommended: bool,
}

pub const MODELS: &[ModelInfo] = &[
    ModelInfo {
        id: "qwen2.5-coder-3b-q4",
        label: "Qwen 2.5 Coder 3B (Q4_K_M)",
        description: "코딩 특화 3B 모델 — 커밋 메시지·심볼 요약 등 차별화 기능에 권장",
        url: "https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/qwen2.5-coder-3b-instruct-q4_k_m.gguf?download=true",
        filename: "qwen2.5-coder-3b-instruct-q4_k_m.gguf",
        size_bytes: 2_020_000_000,
        license: "Qwen License (Apache 2.0 호환)",
        license_url: "https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct-GGUF/blob/main/LICENSE",
        ctx: 8192,
        recommended: true,
    },
    ModelInfo {
        id: "qwen2.5-coder-1.5b-q4",
        label: "Qwen 2.5 Coder 1.5B (Q4_K_M)",
        description: "더 가벼운 1.5B 모델 (~1GB) — 다운로드 부담 적음. 단순 테마 생성 위주에 적합",
        url: "https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf?download=true",
        filename: "qwen2.5-coder-1.5b-instruct-q4_k_m.gguf",
        size_bytes: 1_120_000_000,
        license: "Apache 2.0",
        license_url: "https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct/blob/main/LICENSE",
        ctx: 8192,
        recommended: false,
    },
];

pub fn find(id: &str) -> Option<&'static ModelInfo> {
    MODELS.iter().find(|m| m.id == id)
}