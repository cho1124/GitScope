use serde::Serialize;
use tauri::State;

use crate::git::{run_git, with_repo};
use crate::AppState;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StashEntry {
    pub index: usize,
    pub ref_name: String, // stash@{0}
    pub branch: String,
    pub message: String,
}

/// `git stash list --format=%gd%x1f%gs` 파싱
/// 예: `stash@{0}\x1fWIP on master: abc123 message`
fn parse_stash_list(raw: &str) -> Vec<StashEntry> {
    raw.lines()
        .enumerate()
        .filter(|(_, l)| !l.is_empty())
        .filter_map(|(i, line)| {
            let parts: Vec<&str> = line.splitn(2, '\x1f').collect();
            if parts.len() != 2 {
                return None;
            }
            let ref_name = parts[0].to_string();
            let desc = parts[1];
            // "WIP on master: abc123 message" 또는 "On master: message"
            let (branch, message) = if let Some(rest) = desc.strip_prefix("WIP on ") {
                match rest.split_once(": ") {
                    Some((b, m)) => (b.to_string(), m.to_string()),
                    None => (String::new(), rest.to_string()),
                }
            } else if let Some(rest) = desc.strip_prefix("On ") {
                match rest.split_once(": ") {
                    Some((b, m)) => (b.to_string(), m.to_string()),
                    None => (String::new(), rest.to_string()),
                }
            } else {
                (String::new(), desc.to_string())
            };
            Some(StashEntry {
                index: i,
                ref_name,
                branch,
                message,
            })
        })
        .collect()
}

#[tauri::command]
pub fn stash_list(state: State<AppState>) -> Result<Vec<StashEntry>, String> {
    with_repo(&state, |path| {
        let raw = run_git(path, &["stash", "list", "--format=%gd\x1f%gs"])?;
        Ok(parse_stash_list(&raw))
    })
}

#[tauri::command]
pub fn stash_save(
    message: Option<String>,
    include_untracked: Option<bool>,
    state: State<AppState>,
) -> Result<(), String> {
    with_repo(&state, |path| {
        let msg = message.unwrap_or_default();
        let mut args: Vec<&str> = vec!["stash", "push"];
        if include_untracked.unwrap_or(false) {
            args.push("--include-untracked");
        }
        if !msg.trim().is_empty() {
            args.push("-m");
            args.push(&msg);
        }
        run_git(path, &args)?;
        Ok(())
    })
}

#[tauri::command]
pub fn stash_apply(ref_name: String, state: State<AppState>) -> Result<(), String> {
    with_repo(&state, |path| {
        run_git(path, &["stash", "apply", &ref_name])?;
        Ok(())
    })
}

#[tauri::command]
pub fn stash_pop(ref_name: String, state: State<AppState>) -> Result<(), String> {
    with_repo(&state, |path| {
        run_git(path, &["stash", "pop", &ref_name])?;
        Ok(())
    })
}

#[tauri::command]
pub fn stash_drop(ref_name: String, state: State<AppState>) -> Result<(), String> {
    with_repo(&state, |path| {
        run_git(path, &["stash", "drop", &ref_name])?;
        Ok(())
    })
}

#[tauri::command]
pub fn stash_show(ref_name: String, state: State<AppState>) -> Result<String, String> {
    with_repo(&state, |path| {
        run_git(path, &["stash", "show", "-p", &ref_name])
    })
}

// ───── Working tree diff ──────────────────────────────────────

#[tauri::command]
pub fn get_unstaged_diff(file: String, state: State<AppState>) -> Result<String, String> {
    with_repo(&state, |path| {
        run_git(path, &["diff", "--", &file])
    })
}

#[tauri::command]
pub fn get_staged_diff(file: String, state: State<AppState>) -> Result<String, String> {
    with_repo(&state, |path| {
        run_git(path, &["diff", "--cached", "--", &file])
    })
}

/// 모든 staged 파일의 합쳐진 diff. AI 커밋 메시지 생성용.
#[tauri::command]
pub fn get_staged_diff_all(state: State<AppState>) -> Result<String, String> {
    with_repo(&state, |path| {
        run_git(path, &["diff", "--cached"])
    })
}