use std::collections::{HashMap, HashSet};
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use chrono::{DateTime, Datelike, Duration, FixedOffset, Utc};
use serde::Serialize;
use tauri::ipc::Channel;
use tauri::State;

use crate::git::{run_git, with_repo};
use crate::AppState;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

// ───── Cache ───────────────────────────────────

#[derive(Clone)]
struct CommitEntry {
    #[allow(dead_code)]
    hash: String,
    author: String,
    email: String,
    date: DateTime<FixedOffset>,
    files: Vec<FileChange>,
}

#[derive(Clone)]
struct FileChange {
    path: String,
    insertions: u32,
    deletions: u32,
}

pub struct CachedScan {
    head: String,
    since_days: Option<u32>, // None = full history
    commits: Vec<CommitEntry>,
}

// ───── Progress events ─────────────────────────

#[derive(Clone, Serialize)]
#[serde(tag = "stage", rename_all = "camelCase")]
pub enum ProgressEvent {
    /// 캐시에서 즉시 반환
    CacheHit,
    /// 총 커밋 수 집계 중
    Counting,
    /// git log 스트리밍 중
    Scanning { current: u32, total: u32 },
    /// 합산/정렬 중
    Aggregating,
}

fn current_head(path: &PathBuf) -> Result<String, String> {
    Ok(run_git(path, &["rev-parse", "HEAD"])?.trim().to_string())
}

fn count_commits(path: &PathBuf, since_days: Option<u32>) -> Result<u32, String> {
    let since_owned: Option<String> = since_days.map(|d| {
        let since = Utc::now() - Duration::days(d as i64);
        format!("--since={}", since.format("%Y-%m-%d"))
    });
    let mut args: Vec<&str> = vec!["rev-list", "--count", "HEAD", "--no-merges"];
    if let Some(s) = &since_owned {
        args.push(s.as_str());
    }
    let out = run_git(path, &args)?;
    out.trim()
        .parse::<u32>()
        .map_err(|e| format!("commit count 파싱 실패: {}", e))
}

fn scan_log_streaming(
    path: &PathBuf,
    since_days: Option<u32>,
    progress: Option<&Channel<ProgressEvent>>,
) -> Result<Vec<CommitEntry>, String> {
    if let Some(p) = progress {
        let _ = p.send(ProgressEvent::Counting);
    }
    let total = count_commits(path, since_days).unwrap_or(0);

    let since_owned: Option<String> = since_days.map(|d| {
        let since = Utc::now() - Duration::days(d as i64);
        format!("--since={}", since.format("%Y-%m-%d"))
    });

    let mut cmd = Command::new("git");
    cmd.arg("-C").arg(path);
    cmd.args([
        "log",
        "--numstat",
        "--format=COMMIT_SEP%H\x1f%an\x1f%ae\x1f%aI",
        "--no-merges",
    ]);
    if let Some(s) = &since_owned {
        cmd.arg(s);
    }

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("git spawn 실패: {}", e))?;
    let stdout = child.stdout.take().ok_or("stdout 없음")?;

    let mut commits: Vec<CommitEntry> = Vec::new();
    let mut current: Option<CommitEntry> = None;
    let mut count: u32 = 0;
    let mut last_reported: u32 = 0;
    let report_step: u32 = std::cmp::max(100, total / 100); // 1%마다 또는 100 커밋마다

    let reader = BufReader::new(stdout);
    for line_res in reader.lines() {
        let line = line_res.map_err(|e| format!("git log 읽기 실패: {}", e))?;

        if let Some(rest) = line.strip_prefix("COMMIT_SEP") {
            if let Some(c) = current.take() {
                commits.push(c);
            }
            let parts: Vec<&str> = rest.splitn(4, '\x1f').collect();
            if parts.len() == 4 {
                if let Ok(date) = DateTime::parse_from_rfc3339(parts[3]) {
                    current = Some(CommitEntry {
                        hash: parts[0].to_string(),
                        author: parts[1].to_string(),
                        email: parts[2].to_string(),
                        date,
                        files: Vec::new(),
                    });
                }
            }
            count += 1;
            if let Some(p) = progress {
                if count - last_reported >= report_step {
                    last_reported = count;
                    let _ = p.send(ProgressEvent::Scanning { current: count, total });
                }
            }
            continue;
        }

        if line.is_empty() {
            continue;
        }

        let fields: Vec<&str> = line.splitn(3, '\t').collect();
        if fields.len() != 3 {
            continue;
        }
        let ins: u32 = if fields[0] == "-" {
            0
        } else {
            fields[0].parse().unwrap_or(0)
        };
        let del: u32 = if fields[1] == "-" {
            0
        } else {
            fields[1].parse().unwrap_or(0)
        };
        let fpath = fields[2].to_string();

        if let Some(c) = current.as_mut() {
            c.files.push(FileChange {
                path: fpath,
                insertions: ins,
                deletions: del,
            });
        }
    }

    if let Some(c) = current.take() {
        commits.push(c);
    }

    let status = child.wait().map_err(|e| format!("git wait 실패: {}", e))?;
    if !status.success() {
        return Err("git log 비정상 종료".to_string());
    }

    if let Some(p) = progress {
        let _ = p.send(ProgressEvent::Scanning {
            current: count,
            total,
        });
        let _ = p.send(ProgressEvent::Aggregating);
    }

    Ok(commits)
}

fn ensure_scanned(
    state: &State<AppState>,
    path: &PathBuf,
    need_days: Option<u32>,
    progress: Option<&Channel<ProgressEvent>>,
) -> Result<Vec<CommitEntry>, String> {
    let head = current_head(path)?;
    let mut cache_guard = state.forensics_cache.lock().map_err(|e| e.to_string())?;

    let reuse = match cache_guard.as_ref() {
        Some(c) if c.head == head => match (c.since_days, need_days) {
            (None, _) => true,
            (Some(cd), Some(nd)) => cd >= nd,
            (Some(_), None) => false,
        },
        _ => false,
    };

    if reuse {
        if let Some(p) = progress {
            let _ = p.send(ProgressEvent::CacheHit);
        }
        return Ok(cache_guard.as_ref().unwrap().commits.clone());
    }

    // lock을 scan 동안 유지: 같은 시점에 여러 forensics 호출이 와도 중복 scan 방지.
    // 두 번째 호출부터는 lock 획득 시점에 cache hit으로 빠르게 완료됨.
    let commits = scan_log_streaming(path, need_days, progress)?;
    *cache_guard = Some(CachedScan {
        head,
        since_days: need_days,
        commits: commits.clone(),
    });
    Ok(commits)
}

// ───── Public DTO ──────────────────────────────

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HeatmapEntry {
    path: String,
    changes: u32,
    insertions: u32,
    deletions: u32,
    last_modified: String,
    authors: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HotspotEntry {
    path: String,
    score: f64,
    changes: u32,
    unique_authors: u32,
    avg_changes_per_commit: u32,
    recent_activity: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrendBucket {
    label: String,
    start_date: String,
    end_date: String,
    commits: u32,
    files_changed: u32,
    insertions: u32,
    deletions: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContributorInfo {
    name: String,
    email: String,
    commits: u32,
    files_owned: Vec<String>,
    top_files: Vec<TopFile>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopFile {
    path: String,
    changes: u32,
}

// ───── Aggregators ─────────────────────────────

fn build_heatmap(commits: &[CommitEntry], cutoff: DateTime<Utc>) -> Vec<HeatmapEntry> {
    let mut map: HashMap<String, HeatmapEntry> = HashMap::new();

    for c in commits.iter() {
        if c.date.with_timezone(&Utc) < cutoff {
            continue;
        }
        for f in c.files.iter() {
            let date_str = c.date.to_rfc3339();
            let entry = map.entry(f.path.clone()).or_insert_with(|| HeatmapEntry {
                path: f.path.clone(),
                changes: 0,
                insertions: 0,
                deletions: 0,
                last_modified: date_str.clone(),
                authors: Vec::new(),
            });
            entry.changes += 1;
            entry.insertions += f.insertions;
            entry.deletions += f.deletions;
            if !entry.authors.iter().any(|a| a == &c.author) {
                entry.authors.push(c.author.clone());
            }
            if date_str > entry.last_modified {
                entry.last_modified = date_str;
            }
        }
    }

    let mut result: Vec<HeatmapEntry> = map.into_values().collect();
    result.sort_by(|a, b| b.changes.cmp(&a.changes));
    result
}

fn days_since(iso: &str) -> i64 {
    if let Ok(d) = DateTime::parse_from_rfc3339(iso) {
        let now = Utc::now();
        let diff = now.signed_duration_since(d.with_timezone(&Utc));
        diff.num_days()
    } else {
        i64::MAX
    }
}

// ───── Commands ────────────────────────────────

#[tauri::command]
pub fn get_heatmap(
    days: Option<u32>,
    on_progress: Channel<ProgressEvent>,
    state: State<AppState>,
) -> Result<Vec<HeatmapEntry>, String> {
    let d = days.unwrap_or(90);
    with_repo(&state, |path| {
        let commits = ensure_scanned(&state, path, Some(d), Some(&on_progress))?;
        let _ = on_progress.send(ProgressEvent::Aggregating);
        let cutoff = Utc::now() - Duration::days(d as i64);
        Ok(build_heatmap(&commits, cutoff))
    })
}

#[tauri::command]
pub fn get_hotspots(
    limit: Option<u32>,
    on_progress: Channel<ProgressEvent>,
    state: State<AppState>,
) -> Result<Vec<HotspotEntry>, String> {
    let lim = limit.unwrap_or(20) as usize;
    with_repo(&state, |path| {
        let commits = ensure_scanned(&state, path, Some(180), Some(&on_progress))?;
        let _ = on_progress.send(ProgressEvent::Aggregating);
        let cutoff = Utc::now() - Duration::days(180);
        let heatmap = build_heatmap(&commits, cutoff);

        let mut hotspots: Vec<HotspotEntry> = heatmap
            .iter()
            .map(|e| {
                let recent = if days_since(&e.last_modified) < 30 {
                    2_u32
                } else {
                    1_u32
                };
                let score = (e.changes as f64) * 3.0
                    + (e.authors.len() as f64) * 5.0
                    + ((e.insertions + e.deletions) as f64) * 0.01
                    + (recent as f64) * 10.0;
                let avg = if e.changes == 0 {
                    0
                } else {
                    (e.insertions + e.deletions) / e.changes
                };
                HotspotEntry {
                    path: e.path.clone(),
                    score: (score * 10.0).round() / 10.0,
                    changes: e.changes,
                    unique_authors: e.authors.len() as u32,
                    avg_changes_per_commit: avg,
                    recent_activity: if recent == 2 { 1 } else { 0 },
                }
            })
            .collect();

        hotspots.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        hotspots.truncate(lim);
        Ok(hotspots)
    })
}

#[tauri::command]
pub fn get_trend(
    days: Option<u32>,
    buckets: Option<u32>,
    on_progress: Channel<ProgressEvent>,
    state: State<AppState>,
) -> Result<Vec<TrendBucket>, String> {
    let d = days.unwrap_or(180);
    let b = buckets.unwrap_or(12).max(1);
    with_repo(&state, |path| {
        let commits = ensure_scanned(&state, path, Some(d), Some(&on_progress))?;
        let _ = on_progress.send(ProgressEvent::Aggregating);

        let now = Utc::now();
        let start = now - Duration::days(d as i64);
        let bucket_size_days = (d as f64) / (b as f64);

        let mut result: Vec<TrendBucket> = Vec::with_capacity(b as usize);
        for i in 0..b {
            let bs = start + Duration::seconds((i as f64 * bucket_size_days * 86400.0) as i64);
            let be =
                start + Duration::seconds(((i + 1) as f64 * bucket_size_days * 86400.0) as i64);
            result.push(TrendBucket {
                label: format!("{}월 {}일", bs.month(), bs.day()),
                start_date: bs.format("%Y-%m-%d").to_string(),
                end_date: be.format("%Y-%m-%d").to_string(),
                commits: 0,
                files_changed: 0,
                insertions: 0,
                deletions: 0,
            });
        }

        let mut files_per_bucket: HashMap<usize, HashSet<String>> = HashMap::new();

        for c in commits.iter() {
            let c_utc = c.date.with_timezone(&Utc);
            if c_utc < start || c_utc > now {
                continue;
            }
            let diff_days = c_utc.signed_duration_since(start).num_seconds() as f64 / 86400.0;
            let idx_raw = (diff_days / bucket_size_days).floor() as i64;
            if idx_raw < 0 {
                continue;
            }
            let idx = std::cmp::min(idx_raw as usize, (b as usize) - 1);
            result[idx].commits += 1;
            for f in c.files.iter() {
                result[idx].insertions += f.insertions;
                result[idx].deletions += f.deletions;
                files_per_bucket
                    .entry(idx)
                    .or_insert_with(HashSet::new)
                    .insert(f.path.clone());
            }
        }

        for (idx, set) in files_per_bucket {
            result[idx].files_changed = set.len() as u32;
        }

        Ok(result)
    })
}

#[tauri::command]
pub fn get_contributors(
    on_progress: Channel<ProgressEvent>,
    state: State<AppState>,
) -> Result<Vec<ContributorInfo>, String> {
    with_repo(&state, |path| {
        let commits = ensure_scanned(&state, path, None, Some(&on_progress))?;
        let _ = on_progress.send(ProgressEvent::Aggregating);

        let mut map: HashMap<String, (String, String, u32, HashMap<String, u32>)> = HashMap::new();

        for c in commits.iter() {
            let key = if c.email.is_empty() {
                c.author.clone()
            } else {
                c.email.clone()
            };
            let entry = map
                .entry(key.clone())
                .or_insert_with(|| (c.author.clone(), c.email.clone(), 0, HashMap::new()));
            entry.2 += 1;
            for f in c.files.iter() {
                *entry.3.entry(f.path.clone()).or_insert(0) += 1;
            }
        }

        let mut result: Vec<ContributorInfo> = map
            .into_iter()
            .map(|(_, (name, email, commits, fc))| {
                let mut files: Vec<(String, u32)> = fc.into_iter().collect();
                files.sort_by(|a, b| b.1.cmp(&a.1));
                let files_owned: Vec<String> =
                    files.iter().take(5).map(|(p, _)| p.clone()).collect();
                let top_files: Vec<TopFile> = files
                    .iter()
                    .take(10)
                    .map(|(p, c)| TopFile {
                        path: p.clone(),
                        changes: *c,
                    })
                    .collect();
                ContributorInfo {
                    name,
                    email,
                    commits,
                    files_owned,
                    top_files,
                }
            })
            .collect();

        result.sort_by(|a, b| b.commits.cmp(&a.commits));
        Ok(result)
    })
}