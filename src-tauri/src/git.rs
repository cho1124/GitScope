use std::path::PathBuf;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use serde::Serialize;
use tauri::State;

use crate::AppState;

/// Windows에서 CMD 창이 뜨지 않도록 DETACHED_PROCESS | CREATE_NO_WINDOW 플래그 적용
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

// ───── Shared helpers ──────────────────────────

pub fn with_repo<R>(
    state: &State<AppState>,
    f: impl FnOnce(&PathBuf) -> Result<R, String>,
) -> Result<R, String> {
    let guard = state.repo.lock().map_err(|e| e.to_string())?;
    let path = guard.as_ref().ok_or("레포가 열려있지 않습니다")?;
    f(path)
}

pub fn run_git(path: &PathBuf, args: &[&str]) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.arg("-C").arg(path).args(args);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd
        .output()
        .map_err(|e| format!("git 실행 실패: {}", e))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

// ───── DTO ─────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LastCommit {
    hash: String,
    message: String,
    date: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoInfo {
    path: String,
    current_branch: String,
    last_commit: Option<LastCommit>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitInfo {
    hash: String,
    hash_short: String,
    message: String,
    author: String,
    email: String,
    date: String,
    refs: String,
}

#[derive(Serialize)]
pub struct StatusInfo {
    current: String,
    not_added: Vec<String>,
    modified: Vec<String>,
    deleted: Vec<String>,
    staged: Vec<String>,
    conflicted: Vec<String>,
    created: Vec<String>,
    renamed: Vec<String>,
}

#[derive(Serialize)]
pub struct BranchInfo {
    current: String,
    all: Vec<String>,
}

#[derive(Serialize)]
pub struct FileTreeNode {
    name: String,
    path: String,
    #[serde(rename = "type")]
    node_type: String,
    children: Option<Vec<FileTreeNode>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitResult {
    hash: String,
    summary: serde_json::Value,
}

// ───── Parsers ─────────────────────────────────

fn parse_log(raw: &str) -> Vec<CommitInfo> {
    raw.lines()
        .filter(|l| !l.is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.splitn(7, '\x1f').collect();
            if parts.len() != 7 {
                return None;
            }
            Some(CommitInfo {
                hash: parts[0].to_string(),
                hash_short: parts[1].to_string(),
                message: parts[2].to_string(),
                author: parts[3].to_string(),
                email: parts[4].to_string(),
                date: parts[5].to_string(),
                refs: parts[6].to_string(),
            })
        })
        .collect()
}

// ───── Commands ────────────────────────────────

fn strip_long_path_prefix(p: &str) -> String {
    // Windows canonicalize가 \\?\ prefix를 붙이는 경우 제거
    p.strip_prefix(r"\\?\").unwrap_or(p).to_string()
}

#[tauri::command]
pub fn open_repo(path: String, state: State<AppState>) -> Result<RepoInfo, String> {
    let canonical = PathBuf::from(&path)
        .canonicalize()
        .map_err(|e| format!("경로 확인 실패: {}", e))?;

    run_git(&canonical, &["rev-parse", "--git-dir"])
        .map_err(|_| "Git 레포지토리가 아닙니다".to_string())?;

    let current_branch = run_git(&canonical, &["rev-parse", "--abbrev-ref", "HEAD"])
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|_| "HEAD".to_string());

    let last_commit = run_git(
        &canonical,
        &["log", "-1", "--pretty=format:%h\x1f%s\x1f%aI"],
    )
    .ok()
    .and_then(|s| {
        let parts: Vec<&str> = s.splitn(3, '\x1f').collect();
        if parts.len() == 3 {
            Some(LastCommit {
                hash: parts[0].to_string(),
                message: parts[1].to_string(),
                date: parts[2].to_string(),
            })
        } else {
            None
        }
    });

    let display_path = strip_long_path_prefix(&canonical.to_string_lossy());
    let repo_name = canonical
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| display_path.clone());
    let info = RepoInfo {
        path: display_path.clone(),
        current_branch,
        last_commit,
    };

    // 최근 레포 기록
    let _ = crate::recent::touch_recent(&display_path, &repo_name);

    {
        let mut guard = state.repo.lock().map_err(|e| e.to_string())?;
        *guard = Some(canonical);
    }

    {
        // invalidate forensics cache for the new repo
        let mut fcache = state
            .forensics_cache
            .lock()
            .map_err(|e| e.to_string())?;
        *fcache = None;
    }

    Ok(info)
}

#[tauri::command]
pub fn get_log(
    max_count: Option<u32>,
    file: Option<String>,
    state: State<AppState>,
) -> Result<Vec<CommitInfo>, String> {
    with_repo(&state, |path| {
        let max = max_count.unwrap_or(200);
        let max_arg = format!("-{}", max);
        let mut args: Vec<&str> = vec![
            "log",
            &max_arg,
            "--pretty=format:%H\x1f%h\x1f%s\x1f%an\x1f%ae\x1f%aI\x1f%D",
        ];
        let file_ref;
        if let Some(f) = &file {
            args.push("--follow");
            args.push("--");
            file_ref = f.as_str();
            args.push(file_ref);
        }
        let raw = run_git(path, &args)?;
        Ok(parse_log(&raw))
    })
}

#[tauri::command]
pub fn get_status(state: State<AppState>) -> Result<StatusInfo, String> {
    with_repo(&state, |path| {
        let current = run_git(path, &["rev-parse", "--abbrev-ref", "HEAD"])
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|_| "HEAD".to_string());

        let raw = run_git(path, &["status", "--porcelain=v1"])?;

        let mut info = StatusInfo {
            current,
            not_added: Vec::new(),
            modified: Vec::new(),
            deleted: Vec::new(),
            staged: Vec::new(),
            conflicted: Vec::new(),
            created: Vec::new(),
            renamed: Vec::new(),
        };

        for line in raw.lines() {
            if line.len() < 3 {
                continue;
            }
            let bytes = line.as_bytes();
            let x = bytes[0] as char;
            let y = bytes[1] as char;
            let file = line[3..].to_string();

            if x == '?' && y == '?' {
                info.not_added.push(file);
                continue;
            }

            if x == 'U' || y == 'U' || (x == 'D' && y == 'D') || (x == 'A' && y == 'A') {
                info.conflicted.push(file);
                continue;
            }

            if x != ' ' {
                info.staged.push(file.clone());
                if x == 'A' {
                    info.created.push(file.clone());
                }
                if x == 'R' {
                    info.renamed.push(file.clone());
                }
            }

            match y {
                'M' => info.modified.push(file),
                'D' => info.deleted.push(file),
                _ => {}
            }
        }

        Ok(info)
    })
}

#[tauri::command]
pub fn get_diff(hash: String, state: State<AppState>) -> Result<String, String> {
    with_repo(&state, |path| {
        let parent = format!("{}^", hash);
        run_git(path, &["diff", &parent, &hash])
    })
}

#[tauri::command]
pub fn stage(files: Vec<String>, state: State<AppState>) -> Result<(), String> {
    with_repo(&state, |path| {
        let mut args: Vec<&str> = vec!["add", "--"];
        for f in &files {
            args.push(f.as_str());
        }
        run_git(path, &args)?;
        Ok(())
    })
}

#[tauri::command]
pub fn commit(message: String, state: State<AppState>) -> Result<CommitResult, String> {
    with_repo(&state, |path| {
        let out = run_git(path, &["commit", "-m", &message])?;
        let hash = out
            .lines()
            .next()
            .and_then(|l| l.split(|c| c == '[' || c == ']').nth(1))
            .and_then(|inner| inner.split_whitespace().nth(1))
            .unwrap_or("")
            .to_string();
        Ok(CommitResult {
            hash,
            summary: serde_json::json!({}),
        })
    })
}

#[tauri::command]
pub fn get_branches(state: State<AppState>) -> Result<BranchInfo, String> {
    with_repo(&state, |path| {
        let current = run_git(path, &["rev-parse", "--abbrev-ref", "HEAD"])
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|_| "HEAD".to_string());
        let raw = run_git(path, &["branch", "--list", "--format=%(refname:short)"])?;
        let all: Vec<String> = raw
            .lines()
            .filter(|l| !l.is_empty())
            .map(|s| s.to_string())
            .collect();
        Ok(BranchInfo { current, all })
    })
}

#[tauri::command]
pub fn checkout(branch: String, state: State<AppState>) -> Result<(), String> {
    with_repo(&state, |path| {
        run_git(path, &["checkout", &branch])?;
        Ok(())
    })
}

#[tauri::command]
pub fn create_branch(
    name: String,
    checkout: Option<bool>,
    state: State<AppState>,
) -> Result<(), String> {
    with_repo(&state, |path| {
        if name.trim().is_empty() {
            return Err("브랜치 이름이 비어있습니다".to_string());
        }
        if checkout.unwrap_or(false) {
            run_git(path, &["checkout", "-b", &name])?;
        } else {
            run_git(path, &["branch", &name])?;
        }
        Ok(())
    })
}

#[tauri::command]
pub fn delete_branch(
    name: String,
    force: Option<bool>,
    state: State<AppState>,
) -> Result<(), String> {
    with_repo(&state, |path| {
        let flag = if force.unwrap_or(false) { "-D" } else { "-d" };
        run_git(path, &["branch", flag, &name])?;
        Ok(())
    })
}

#[tauri::command]
pub fn merge_branch(
    name: String,
    no_ff: Option<bool>,
    state: State<AppState>,
) -> Result<String, String> {
    with_repo(&state, |path| {
        let mut args: Vec<&str> = vec!["merge"];
        if no_ff.unwrap_or(false) {
            args.push("--no-ff");
        }
        args.push(&name);
        let out = run_git(path, &args)?;
        Ok(out.trim().to_string())
    })
}

#[tauri::command]
pub fn push(state: State<AppState>) -> Result<(), String> {
    with_repo(&state, |path| {
        run_git(path, &["push"])?;
        Ok(())
    })
}

#[tauri::command]
pub fn pull(state: State<AppState>) -> Result<(), String> {
    with_repo(&state, |path| {
        run_git(path, &["pull"])?;
        Ok(())
    })
}

#[tauri::command]
pub fn get_file_history(
    file_path: String,
    state: State<AppState>,
) -> Result<Vec<CommitInfo>, String> {
    with_repo(&state, |path| {
        let raw = run_git(
            path,
            &[
                "log",
                "-100",
                "--follow",
                "--pretty=format:%H\x1f%h\x1f%s\x1f%an\x1f%ae\x1f%aI\x1f%D",
                "--",
                &file_path,
            ],
        )?;
        Ok(parse_log(&raw))
    })
}

#[tauri::command]
pub fn get_file_tree(state: State<AppState>) -> Result<Vec<FileTreeNode>, String> {
    with_repo(&state, |path| build_tree_shallow(path, ""))
}

/// lazy loading: expand 시점에 해당 디렉토리만 반환 (재귀 없음)
#[tauri::command]
pub fn get_directory_children(
    rel_path: String,
    state: State<AppState>,
) -> Result<Vec<FileTreeNode>, String> {
    with_repo(&state, |root| {
        // relative path 안전성 검증: 루트 내부 경로만 허용
        let target = root.join(&rel_path);
        let canonical = target
            .canonicalize()
            .map_err(|e| format!("경로 확인 실패: {}", e))?;
        let root_canonical = root
            .canonicalize()
            .map_err(|e| format!("루트 경로 확인 실패: {}", e))?;
        if !canonical.starts_with(&root_canonical) {
            return Err("레포 외부 경로입니다".to_string());
        }
        build_tree_shallow(&canonical, &rel_path)
    })
}

/// 1단계만 읽음 (children은 None) — lazy load 전제
fn build_tree_shallow(dir: &PathBuf, rel: &str) -> Result<Vec<FileTreeNode>, String> {
    let mut nodes = Vec::new();

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return Ok(vec![]),
    };

    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.')
            || name == "node_modules"
            || name == "dist"
            || name == "target"
        {
            continue;
        }
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let rel_path = if rel.is_empty() {
            name.clone()
        } else {
            format!("{}/{}", rel, name)
        };

        let node_type = if meta.is_dir() { "directory" } else { "file" };
        nodes.push(FileTreeNode {
            name,
            path: rel_path,
            node_type: node_type.to_string(),
            children: None,
        });
    }

    nodes.sort_by(|a, b| {
        if a.node_type != b.node_type {
            if a.node_type == "directory" {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            }
        } else {
            a.name.cmp(&b.name)
        }
    });

    Ok(nodes)
}