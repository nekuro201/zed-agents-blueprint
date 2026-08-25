//! Bridge Rust entre a UI (webview) e o Engine (sidecar Node).
//!
//! O engine é um processo Node (`engine/dist/index.mjs`) que roda o SDK do pi
//! e fala JSON por linha (stdin/stdout). Este módulo:
//!   - sobe o engine com `--project-dir <projeto>` (e `--mock` no modo simulado)
//!   - encaminha cada linha de stdout como evento `engine-event` para a UI
//!   - encaminha stderr como `engine-log`
//!   - escreve comandos da UI no stdin do engine (`engine_send`)
//!   - mata o processo quando solicitado (`engine_stop`) ou ao fechar o app

use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, RunEvent, State};

/// Processo do engine mantido em estado gerenciado.
struct EngineProc {
    child: Option<Child>,
    stdin: Option<ChildStdin>,
}

impl EngineProc {
    fn new() -> Self {
        Self {
            child: None,
            stdin: None,
        }
    }
}

type EngineState = Mutex<EngineProc>;

/// Localiza o script do engine. Prioridade: `PI_ENGINE_PATH` -> <app>/engine/dist/index.mjs.
fn engine_script_path() -> PathBuf {
    if let Ok(p) = std::env::var("PI_ENGINE_PATH") {
        return PathBuf::from(p);
    }
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR")); // <app>/src-tauri
    let app_root = manifest
        .parent()
        .expect("src-tauri deve ser filho do app root");
    app_root.join("engine").join("dist").join("index.mjs")
}

#[tauri::command]
fn engine_start(
    app: AppHandle,
    state: State<'_, EngineState>,
    project_dir: String,
    mock: bool,
) -> Result<(), String> {
    let script = engine_script_path();
    if !script.exists() {
        return Err(format!(
            "Engine não encontrado em {}. Rode `pnpm engine:build` na pasta `app/`.",
            script.display()
        ));
    }

    {
        let proc = state.lock().unwrap();
        if proc.child.is_some() {
            return Err("Já existe um engine em execução. Use Stop antes de iniciar outro.".into());
        }
    }

    let mut cmd = Command::new("node");
    cmd.arg(&script)
        .arg("--project-dir")
        .arg(&project_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if mock {
        cmd.arg("--mock");
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Falha ao iniciar o engine (Node no PATH?): {e}"))?;

    let stdin = child.stdin.take().ok_or("engine sem stdin")?;
    let stdout = child.stdout.take().ok_or("engine sem stdout")?;
    let stderr = child.stderr.take().ok_or("engine sem stderr")?;

    // Thread de stdout -> eventos da UI.
    let app_ev = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            match line {
                Ok(text) => {
                    let _ = app_ev.emit("engine-event", text);
                }
                Err(_) => break,
            }
        }
        let _ = app_ev.emit("engine-exit", "process terminated");
    });

    // Thread de stderr -> logs (debug).
    let app_log = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(text) = line {
                let _ = app_log.emit("engine-log", text);
            }
        }
    });

    {
        let mut proc = state.lock().unwrap();
        proc.child = Some(child);
        proc.stdin = Some(stdin);
    }

    Ok(())
}

#[tauri::command]
fn engine_send(state: State<'_, EngineState>, command: String) -> Result<(), String> {
    let mut proc = state.lock().unwrap();
    let stdin = proc
        .stdin
        .as_mut()
        .ok_or_else(|| "Engine não iniciado.".to_string())?;
    stdin
        .write_all(format!("{command}\n").as_bytes())
        .and_then(|_| stdin.flush())
        .map_err(|e| format!("Falha ao enviar comando ao engine: {e}"))
}

#[tauri::command]
fn engine_stop(state: State<'_, EngineState>) -> Result<(), String> {
    let mut proc = state.lock().unwrap();
    kill_proc(&mut proc);
    Ok(())
}

fn kill_proc(proc: &mut EngineProc) {
    if let Some(mut child) = proc.child.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    proc.stdin = None;
}

/// Leitura SOMENTE-leitura de arquivos do projeto-alvo (inspector 2.3).
/// Nunca expõe caminhos fora do `project_dir` (guarda contra `../`).
fn read_scoped_file(project_dir: &str, rel_path: &str) -> Result<String, String> {
    let base = std::path::PathBuf::from(project_dir);
    let base_canonical = base
        .canonicalize()
        .map_err(|e| format!("Diretório de projeto inválido: {e}"))?;

    let target = base.join(rel_path);
    let target_canonical = target
        .canonicalize()
        .map_err(|_| format!("Arquivo não encontrado: {rel_path}"))?;

    if !target_canonical.starts_with(&base_canonical) {
        return Err("Caminho fora do projeto".into());
    }

    std::fs::read_to_string(&target_canonical).map_err(|e| format!("Falha ao ler {rel_path}: {e}"))
}

#[tauri::command]
fn read_project_file(project_dir: String, rel_path: String) -> Result<String, String> {
    read_scoped_file(&project_dir, &rel_path)
}

/// Leitura SOMENTE-leitura do `graph.html` do projeto-alvo (viewer do grafo — E3).
/// Mesma guarda de path do `read_project_file` (nunca escapa do projectDir).
#[tauri::command]
fn read_graph_file(project_dir: String, rel_path: String) -> Result<String, String> {
    read_scoped_file(&project_dir, &rel_path)
}

/// Diretórios que NÃO representam código-fonte — não contam para a staleness.
const GRAPH_SKIP_DIRS: &[&str] = &[
    "graphify-out",
    ".git",
    "node_modules",
    "dist",
    "target",
    ".next",
    ".nuxt",
];

/// Varre recursivamente `dir` contando arquivos regulares com mtime posterior a
/// `newer_than`. Pula diretórios de artefato e symlinks (sem recursão infinita).
fn count_newer_files(
    dir: &std::path::Path,
    newer_than: std::time::SystemTime,
) -> Result<u64, String> {
    let mut count: u64 = 0;
    let entries = std::fs::read_dir(dir).map_err(|e| format!("read_dir {}: {e}", dir.display()))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("entry: {e}"))?;
        let name = entry.file_name();
        if GRAPH_SKIP_DIRS.contains(&name.to_string_lossy().as_ref()) {
            continue;
        }
        let file_type = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            count += count_newer_files(&entry.path(), newer_than)?;
        } else if file_type.is_file() {
            if let Ok(md) = entry.metadata() {
                if let Ok(modified) = md.modified() {
                    if modified > newer_than {
                        count += 1;
                    }
                }
            }
        }
    }
    Ok(count)
}

/// Detector de staleness do grafo (E3, Fase 5): `graph.json` mais velho que a
/// fonte mais nova → `stale:true` + quantos arquivos mudaram. Sem `graph.json`,
/// retorna `{ stale:false, changedCount:0 }` (ausência ≠ desatualizado).
#[tauri::command]
fn graph_staleness(project_dir: String) -> Result<serde_json::Value, String> {
    let base = canonical_project(&project_dir)?;
    let graph_json = base.join("graphify-out").join("graph.json");
    let graph_mtime = match std::fs::metadata(&graph_json) {
        Ok(md) => md
            .modified()
            .map_err(|e| format!("mtime do graph.json: {e}"))?,
        Err(_) => return Ok(serde_json::json!({ "stale": false, "changedCount": 0 })),
    };

    let changed_count = count_newer_files(&base, graph_mtime)?;
    Ok(serde_json::json!({ "stale": changed_count > 0, "changedCount": changed_count }))
}

fn canonical_project(project_dir: &str) -> Result<std::path::PathBuf, String> {
    std::path::PathBuf::from(project_dir)
        .canonicalize()
        .map_err(|e| format!("Diretório de projeto inválido: {e}"))
}

fn run_git(cwd: &std::path::Path, args: &[&str]) -> Result<String, String> {
    let out = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("git: {e}"))?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

#[tauri::command]
fn git_branches(project_dir: String) -> Result<serde_json::Value, String> {
    let cwd = canonical_project(&project_dir)?;
    let current = run_git(&cwd, &["branch", "--show-current"])?
        .trim()
        .to_string();
    let listed = run_git(&cwd, &["branch", "--format=%(refname:short)"])?;
    let branches: Vec<String> = listed
        .lines()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from)
        .collect();
    Ok(serde_json::json!({ "current": current, "branches": branches }))
}

#[tauri::command]
fn git_checkout_new(project_dir: String, name: String) -> Result<(), String> {
    if !name
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-' | '/'))
        || name.is_empty()
        || name.contains("..")
    {
        return Err("Nome de branch inválido".into());
    }
    let cwd = canonical_project(&project_dir)?;
    run_git(&cwd, &["checkout", "-b", &name])?;
    Ok(())
}

/// Encerra o engine ao fechar a janela/app.
fn kill_on_exit(app: &AppHandle) {
    if let Some(state) = app.try_state::<EngineState>() {
        let mut proc = state.lock().unwrap();
        kill_proc(&mut proc);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(EngineState::new(EngineProc::new()))
        .invoke_handler(tauri::generate_handler![
            engine_start,
            engine_send,
            engine_stop,
            read_project_file,
            read_graph_file,
            graph_staleness,
            git_branches,
            git_checkout_new
        ])
        .build(tauri::generate_context!())
        .expect("erro ao construir o app Tauri")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                kill_on_exit(app_handle);
            }
        });
}
