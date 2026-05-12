use std::path::PathBuf;

/// 앱 데이터 루트 (`<DataLocal>/gitscope/`).
fn root() -> Result<PathBuf, String> {
    let base = dirs::data_local_dir()
        .ok_or_else(|| "사용자 데이터 디렉토리를 찾을 수 없습니다".to_string())?;
    Ok(base.join("gitscope"))
}

pub fn models_dir() -> Result<PathBuf, String> {
    let p = root()?.join("models");
    std::fs::create_dir_all(&p).map_err(|e| format!("models dir 생성 실패: {}", e))?;
    Ok(p)
}

pub fn bin_dir() -> Result<PathBuf, String> {
    let p = root()?.join("bin");
    std::fs::create_dir_all(&p).map_err(|e| format!("bin dir 생성 실패: {}", e))?;
    Ok(p)
}

pub fn model_path(filename: &str) -> Result<PathBuf, String> {
    Ok(models_dir()?.join(filename))
}

/// llama-server 실행 파일 경로 (플랫폼별 확장자 포함).
pub fn server_binary_path() -> Result<PathBuf, String> {
    let name = if cfg!(target_os = "windows") {
        "llama-server.exe"
    } else {
        "llama-server"
    };
    Ok(bin_dir()?.join(name))
}