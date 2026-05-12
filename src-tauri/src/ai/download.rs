use std::io::Write;
use std::path::Path;

use futures_util::StreamExt;
use serde::Serialize;
use tauri::ipc::Channel;

/// 프론트엔드로 보내는 다운로드 진행 이벤트.
/// tauri::ipc::Channel 로 스트리밍 — 단일 HTTP 응답 안에서 여러 메시지 전송.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "stage")]
pub enum DownloadProgress {
    Started {
        /// 총 바이트 수 (Content-Length). 알 수 없으면 0
        total: u64,
    },
    Chunk {
        downloaded: u64,
        total: u64,
    },
    Finished {
        downloaded: u64,
    },
    Failed {
        message: String,
    },
}

/// URL 에서 파일을 받아 `dest` 에 저장. 진행률은 채널로 emit.
///
/// 같은 경로에 이미 파일이 있으면 덮어씌움 (검증 책임은 호출자).
pub async fn download_to_file(
    url: &str,
    dest: &Path,
    on_progress: &Channel<DownloadProgress>,
) -> Result<u64, String> {
    let client = reqwest::Client::builder()
        .user_agent("Pepper/0.4 (+https://github.com/cho1124/Pepper)")
        .build()
        .map_err(|e| format!("HTTP 클라이언트 생성 실패: {}", e))?;

    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("요청 실패: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}: {}", resp.status(), url));
    }

    let total = resp.content_length().unwrap_or(0);
    let _ = on_progress.send(DownloadProgress::Started { total });

    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("디렉토리 생성 실패: {}", e))?;
    }

    // 부분 다운로드 안전성 — .part 로 받고 완료 시 rename
    let part = dest.with_extension("part");
    let mut file = std::fs::File::create(&part)
        .map_err(|e| format!("파일 생성 실패: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut last_emit: u64 = 0;
    let mut stream = resp.bytes_stream();
    while let Some(chunk_res) = stream.next().await {
        let chunk = chunk_res.map_err(|e| format!("청크 수신 실패: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("파일 쓰기 실패: {}", e))?;
        downloaded += chunk.len() as u64;
        // 1MB 마다 또는 1% 마다 emit (너무 잦은 IPC 방지)
        let emit_interval = (total / 100).max(1_048_576);
        if downloaded - last_emit >= emit_interval {
            let _ = on_progress.send(DownloadProgress::Chunk { downloaded, total });
            last_emit = downloaded;
        }
    }
    file.flush().map_err(|e| format!("플러시 실패: {}", e))?;
    drop(file);

    std::fs::rename(&part, dest)
        .map_err(|e| format!("파일 이동 실패 ({} → {}): {}", part.display(), dest.display(), e))?;
    let _ = on_progress.send(DownloadProgress::Finished { downloaded });
    Ok(downloaded)
}