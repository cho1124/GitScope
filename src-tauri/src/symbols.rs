use std::fs;

use serde::Serialize;
use tauri::State;
use tree_sitter::{Language, Parser, Query, QueryCursor, StreamingIterator};

use crate::git::{run_git, with_repo, CommitInfo};
use crate::AppState;

// ───── DTO ─────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Symbol {
    name: String,
    kind: String,
    start_line: u32,
    end_line: u32,
}

// ───── Language detection ──────────────────────

fn language_for_file(file_path: &str) -> Option<(Language, &'static str)> {
    let lower = file_path.to_lowercase();
    if lower.ends_with(".ts") {
        Some((tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into(), "typescript"))
    } else if lower.ends_with(".tsx") {
        Some((tree_sitter_typescript::LANGUAGE_TSX.into(), "tsx"))
    } else if lower.ends_with(".jsx") || lower.ends_with(".js") || lower.ends_with(".mjs") {
        // JSX/JS는 TSX grammar가 더 관대해서 사용
        Some((tree_sitter_typescript::LANGUAGE_TSX.into(), "tsx"))
    } else if lower.ends_with(".rs") {
        Some((tree_sitter_rust::LANGUAGE.into(), "rust"))
    } else if lower.ends_with(".py") || lower.ends_with(".pyi") {
        Some((tree_sitter_python::LANGUAGE.into(), "python"))
    } else if lower.ends_with(".cs") {
        Some((tree_sitter_c_sharp::LANGUAGE.into(), "csharp"))
    } else {
        None
    }
}

fn query_for_language(lang_name: &str) -> &'static str {
    match lang_name {
        "typescript" | "tsx" => {
            r#"
(function_declaration name: (identifier) @name) @function
(class_declaration name: (type_identifier) @name) @class
(method_definition name: (property_identifier) @name) @method
(interface_declaration name: (type_identifier) @name) @interface
(enum_declaration name: (identifier) @name) @enum
(type_alias_declaration name: (type_identifier) @name) @type
(lexical_declaration
  (variable_declarator
    name: (identifier) @name
    value: (arrow_function))) @arrow_fn
"#
        }
        "rust" => {
            r#"
(function_item name: (identifier) @name) @function
(struct_item name: (type_identifier) @name) @struct
(enum_item name: (type_identifier) @name) @enum
(trait_item name: (type_identifier) @name) @trait
(impl_item type: (type_identifier) @name) @impl
(mod_item name: (identifier) @name) @mod
"#
        }
        "python" => {
            r#"
(function_definition name: (identifier) @name) @function
(class_definition name: (identifier) @name) @class
(decorated_definition
  definition: (function_definition name: (identifier) @name)) @function
(decorated_definition
  definition: (class_definition name: (identifier) @name)) @class
"#
        }
        "csharp" => {
            r#"
(method_declaration name: (identifier) @name) @method
(class_declaration name: (identifier) @name) @class
(struct_declaration name: (identifier) @name) @struct
(interface_declaration name: (identifier) @name) @interface
(enum_declaration name: (identifier) @name) @enum
(constructor_declaration name: (identifier) @name) @constructor
(record_declaration name: (identifier) @name) @record
(property_declaration name: (identifier) @name) @property
"#
        }
        _ => "",
    }
}

// ───── Commands ────────────────────────────────

#[tauri::command]
pub fn get_symbols(file_path: String, state: State<AppState>) -> Result<Vec<Symbol>, String> {
    with_repo(&state, |repo_path| {
        let full_path = repo_path.join(&file_path);
        let source = fs::read_to_string(&full_path)
            .map_err(|e| format!("파일 읽기 실패: {}", e))?;

        let (lang, lang_name) = match language_for_file(&file_path) {
            Some(v) => v,
            None => return Ok(vec![]),
        };

        let mut parser = Parser::new();
        parser
            .set_language(&lang)
            .map_err(|e| format!("언어 설정 실패: {}", e))?;

        let tree = parser.parse(&source, None).ok_or("파싱 실패")?;
        let query_src = query_for_language(lang_name);
        if query_src.is_empty() {
            return Ok(vec![]);
        }
        let query = Query::new(&lang, query_src).map_err(|e| format!("쿼리 생성 실패: {}", e))?;

        let capture_names = query.capture_names();
        let mut cursor = QueryCursor::new();
        let source_bytes = source.as_bytes();
        let mut matches = cursor.matches(&query, tree.root_node(), source_bytes);

        let mut symbols: Vec<Symbol> = Vec::new();

        while let Some(m) = matches.next() {
            let mut name: Option<String> = None;
            let mut kind: Option<String> = None;
            let mut range: Option<(u32, u32)> = None;

            for c in m.captures.iter() {
                let cap_name = capture_names[c.index as usize];
                let node = c.node;
                if cap_name == "name" {
                    let text = node.utf8_text(source_bytes).unwrap_or("").to_string();
                    name = Some(text);
                } else {
                    // kind capture
                    kind = Some(normalize_kind(cap_name));
                    range = Some((
                        node.start_position().row as u32 + 1,
                        node.end_position().row as u32 + 1,
                    ));
                }
            }

            if let (Some(n), Some(k), Some((s, e))) = (name, kind, range) {
                symbols.push(Symbol {
                    name: n,
                    kind: k,
                    start_line: s,
                    end_line: e,
                });
            }
        }

        symbols.sort_by_key(|s| s.start_line);
        Ok(symbols)
    })
}

fn normalize_kind(raw: &str) -> String {
    match raw {
        "arrow_fn" => "function".to_string(),
        other => other.to_string(),
    }
}

#[tauri::command]
pub fn get_symbol_history(
    file_path: String,
    start_line: u32,
    end_line: u32,
    state: State<AppState>,
) -> Result<Vec<CommitInfo>, String> {
    with_repo(&state, |path| {
        let l_arg = format!("{},{}:{}", start_line, end_line, file_path);
        let raw = run_git(
            path,
            &[
                "log",
                "-L",
                &l_arg,
                "--format=COMMIT_SEP%H\x1f%h\x1f%s\x1f%an\x1f%ae\x1f%aI\x1f%D\x1f%P",
            ],
        )?;
        Ok(parse_symbol_log(&raw))
    })
}

/// 심볼 영역의 git log -L 결과 with patch — AI 요약용.
/// 각 커밋의 메시지 + 그 심볼 영역에서 어떻게 변했는지 patch 형식으로.
#[tauri::command]
pub fn get_symbol_history_patch(
    file_path: String,
    start_line: u32,
    end_line: u32,
    state: State<AppState>,
) -> Result<String, String> {
    with_repo(&state, |path| {
        let l_arg = format!("{},{}:{}", start_line, end_line, file_path);
        run_git(
            path,
            &["log", "-L", &l_arg, "--no-color"],
        )
    })
}

fn parse_symbol_log(raw: &str) -> Vec<CommitInfo> {
    let mut commits = Vec::new();
    for chunk in raw.split("COMMIT_SEP").skip(1) {
        let Some(first_line) = chunk.lines().next() else {
            continue;
        };
        let parts: Vec<&str> = first_line.splitn(8, '\x1f').collect();
        if parts.len() != 8 {
            continue;
        }
        let parents: Vec<String> = parts[7]
            .split_whitespace()
            .map(|s| s.to_string())
            .collect();
        commits.push(CommitInfo {
            hash: parts[0].to_string(),
            hash_short: parts[1].to_string(),
            message: parts[2].to_string(),
            author: parts[3].to_string(),
            email: parts[4].to_string(),
            date: parts[5].to_string(),
            refs: parts[6].to_string(),
            parents,
        });
    }
    commits
}