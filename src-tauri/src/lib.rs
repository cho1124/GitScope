mod forensics;
mod git;
mod recent;

use std::path::PathBuf;
use std::sync::Mutex;

use forensics::CachedScan;

#[derive(Default)]
pub struct AppState {
    pub repo: Mutex<Option<PathBuf>>,
    pub forensics_cache: Mutex<Option<CachedScan>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            git::open_repo,
            git::get_log,
            git::get_status,
            git::get_diff,
            git::stage,
            git::commit,
            git::get_branches,
            git::checkout,
            git::create_branch,
            git::delete_branch,
            git::merge_branch,
            git::push,
            git::pull,
            git::get_file_history,
            git::get_file_tree,
            git::get_directory_children,
            forensics::get_heatmap,
            forensics::get_hotspots,
            forensics::get_trend,
            forensics::get_contributors,
            recent::get_recent_repos,
            recent::remove_recent_repo,
            recent::clear_recent_repos,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}