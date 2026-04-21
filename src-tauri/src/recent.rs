use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecentRepo {
    pub path: String,
    pub name: String,
    pub last_opened: String, // ISO 8601
}

const MAX_RECENT: usize = 10;

fn storage_path() -> Option<PathBuf> {
    dirs::config_dir().map(|base| {
        let dir = base.join("GitScope");
        let _ = fs::create_dir_all(&dir);
        dir.join("recent.json")
    })
}

fn load_raw() -> Vec<RecentRepo> {
    let Some(path) = storage_path() else {
        return vec![];
    };
    let Ok(bytes) = fs::read(&path) else {
        return vec![];
    };
    serde_json::from_slice(&bytes).unwrap_or_default()
}

fn save_raw(list: &[RecentRepo]) -> Result<(), String> {
    let path = storage_path().ok_or("config dir를 찾을 수 없습니다")?;
    let bytes = serde_json::to_vec_pretty(list).map_err(|e| e.to_string())?;
    fs::write(&path, bytes).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_recent_repos() -> Result<Vec<RecentRepo>, String> {
    let mut list = load_raw();
    // 존재하지 않는 경로는 제거 (레포가 이동/삭제된 경우)
    list.retain(|r| PathBuf::from(&r.path).exists());
    Ok(list)
}

pub fn touch_recent(path: &str, name: &str) -> Result<(), String> {
    let mut list = load_raw();
    let now = chrono::Utc::now().to_rfc3339();
    list.retain(|r| r.path != path);
    list.insert(
        0,
        RecentRepo {
            path: path.to_string(),
            name: name.to_string(),
            last_opened: now,
        },
    );
    list.truncate(MAX_RECENT);
    save_raw(&list)
}

#[tauri::command]
pub fn remove_recent_repo(path: String) -> Result<(), String> {
    let mut list = load_raw();
    list.retain(|r| r.path != path);
    save_raw(&list)
}

#[tauri::command]
pub fn clear_recent_repos() -> Result<(), String> {
    save_raw(&[])
}