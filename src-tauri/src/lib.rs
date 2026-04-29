mod forensics;
mod git;
mod recent;
mod stash;
mod symbols;

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
            git::cherry_pick,
            git::cherry_pick_abort,
            git::cherry_pick_continue,
            git::cherry_pick_in_progress,
            git::reset,
            git::rebase,
            git::rebase_abort,
            git::rebase_continue,
            git::rebase_skip,
            git::rebase_in_progress,
            git::list_commits_in_range,
            git::interactive_rebase,
            git::list_conflicted_files,
            git::resolve_conflict,
            git::fetch,
            git::get_remote_status,
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
            stash::stash_list,
            stash::stash_save,
            stash::stash_apply,
            stash::stash_pop,
            stash::stash_drop,
            stash::stash_show,
            stash::get_unstaged_diff,
            stash::get_staged_diff,
            symbols::get_symbols,
            symbols::get_symbol_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}