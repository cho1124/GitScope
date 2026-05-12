use serde::Serialize;
use tauri::ipc::Channel;
use tauri::State;

use crate::AppState;

use super::catalog::{self, ModelInfo};
use super::download::{download_to_file, DownloadProgress};
use super::paths;
use super::server::{download_server, spawn_server};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelStatus {
    pub id: String,
    pub label: String,
    pub description: String,
    pub size_bytes: u64,
    pub license: String,
    pub license_url: String,
    pub recommended: bool,
    /// 디스크에 존재 여부
    pub installed: bool,
    /// 디스크 상의 실제 사이즈 (없으면 0)
    pub local_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiStatus {
    /// llama-server 바이너리 설치 여부
    pub server_installed: bool,
    /// 현재 실행 중인 sidecar 의 포트 (없으면 None)
    pub running_port: Option<u16>,
    /// 실행 중인 모델 ID (없으면 None)
    pub running_model: Option<String>,
    pub models: Vec<ModelStatus>,
}

fn model_to_status(m: &ModelInfo) -> ModelStatus {
    let path = paths::model_path(m.filename).ok();
    let (installed, local_bytes) = match path {
        Some(p) if p.exists() => {
            let bytes = std::fs::metadata(&p).map(|md| md.len()).unwrap_or(0);
            (true, bytes)
        }
        _ => (false, 0),
    };
    ModelStatus {
        id: m.id.to_string(),
        label: m.label.to_string(),
        description: m.description.to_string(),
        size_bytes: m.size_bytes,
        license: m.license.to_string(),
        license_url: m.license_url.to_string(),
        recommended: m.recommended,
        installed,
        local_bytes,
    }
}

#[tauri::command]
pub fn ai_status(state: State<AppState>) -> Result<AiStatus, String> {
    let server_path = paths::server_binary_path()?;
    let server_installed = server_path.exists();

    let (running_port, running_model) = {
        let guard = state.ai_server.lock().map_err(|e| e.to_string())?;
        match guard.as_ref() {
            Some(h) => (Some(h.port), Some(h.model_id.clone())),
            None => (None, None),
        }
    };

    let models = catalog::MODELS.iter().map(model_to_status).collect();
    Ok(AiStatus {
        server_installed,
        running_port,
        running_model,
        models,
    })
}

#[tauri::command]
pub async fn ai_download_model(
    model_id: String,
    on_progress: Channel<DownloadProgress>,
) -> Result<(), String> {
    let info = catalog::find(&model_id)
        .ok_or_else(|| format!("알 수 없는 모델: {}", model_id))?;
    let dest = paths::model_path(info.filename)?;
    download_to_file(info.url, &dest, &on_progress).await?;
    Ok(())
}

#[tauri::command]
pub async fn ai_download_server(
    on_progress: Channel<DownloadProgress>,
) -> Result<String, String> {
    download_server(&on_progress).await
}

#[tauri::command]
pub async fn ai_start_server(
    model_id: String,
    state: State<'_, AppState>,
) -> Result<u16, String> {
    // (1) 이미 같은 모델로 실행 중인지 확인하고, 다른 모델이면 prev 꺼내기 — guard 는 이 블록을 벗어나면 drop
    let prev = {
        let mut guard = state.ai_server.lock().map_err(|e| e.to_string())?;
        if let Some(h) = guard.as_ref() {
            if h.model_id == model_id {
                return Ok(h.port);
            }
        }
        guard.take()
    };
    // (2) 이전 sidecar 종료 — guard 가 drop 된 뒤에만 await
    if let Some(prev) = prev {
        prev.stop().await;
    }

    let info = catalog::find(&model_id)
        .ok_or_else(|| format!("알 수 없는 모델: {}", model_id))?;
    let model_path = paths::model_path(info.filename)?;
    let handle = spawn_server(&model_path, info.ctx, model_id.clone()).await?;
    let port = handle.port;
    {
        let mut guard = state.ai_server.lock().map_err(|e| e.to_string())?;
        *guard = Some(handle);
    }
    Ok(port)
}

#[tauri::command]
pub async fn ai_stop_server(state: State<'_, AppState>) -> Result<(), String> {
    let prev = {
        let mut guard = state.ai_server.lock().map_err(|e| e.to_string())?;
        guard.take()
    };
    if let Some(prev) = prev {
        prev.stop().await;
    }
    Ok(())
}