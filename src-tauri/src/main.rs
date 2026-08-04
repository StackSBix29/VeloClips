#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

// --- IMPORTACIONES PARA OCULTAR LA CONSOLA EN WINDOWS ---
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;
// --------------------------------------------------------

#[derive(Serialize, Deserialize, Clone)]
pub struct VideoFeed {
    id: String,
    title: String,
    duration: String,
    date: String,
    views: String,
    platform: String,
    img_url: String,
}

fn get_workspace_dir() -> PathBuf {
    let profile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".to_string());
    let mut path = PathBuf::from(profile);
    path.push("Documents");
    path.push("VeloClips_Workspace");
    path
}

fn get_exports_dir() -> PathBuf {
    let mut path = get_workspace_dir();
    path.push("Exports");
    path
}

fn get_templates_dir() -> PathBuf {
    let mut path = get_workspace_dir();
    path.push("Templates");
    path
}

// --- AUTO-INYECCIÓN DEL SCRIPT LUA EN DAVINCI RESOLVE ---
fn ensure_lua_script_installed() {
    if let Some(appdata) = dirs::config_dir() {
        let mut davinci_script_dir = appdata.clone();
        davinci_script_dir.push("Blackmagic Design");
        davinci_script_dir.push("DaVinci Resolve");
        davinci_script_dir.push("Support");
        davinci_script_dir.push("Fusion");
        davinci_script_dir.push("Scripts");
        davinci_script_dir.push("Utility");

        if davinci_script_dir.exists() {
            let target_script = davinci_script_dir.join("VeloClips_Injector.lua");

            let current_dir = std::env::current_dir().unwrap_or_default();
            let source_script = if current_dir.ends_with("src-tauri") {
                current_dir
                    .parent()
                    .unwrap()
                    .join("DaVinci_Integration")
                    .join("VeloClips_Injector.lua")
            } else {
                current_dir
                    .join("DaVinci_Integration")
                    .join("VeloClips_Injector.lua")
            };

            if source_script.exists() {
                let _ = fs::copy(&source_script, &target_script);
            }
        }
    }
}

#[tauri::command]
fn select_local_video() -> Result<String, String> {
    if let Some(path) = rfd::FileDialog::new()
        .add_filter("Videos", &["mp4", "mkv", "mov", "avi"])
        .pick_file()
    {
        Ok(path.display().to_string())
    } else {
        Err("Selección cancelada.".into())
    }
}

// Función de ayuda inteligente para buscar los .exe de la IA
fn run_local_exe(exe_name: &str, args: Vec<&str>) -> Result<String, String> {
    let mut base_path = std::env::current_exe().map_err(|e| e.to_string())?;
    base_path.pop(); // Salimos de veloclips.exe

    // Opción 1: Buscar los scripts de Python en la misma carpeta raíz
    let mut exe_path = base_path.clone();
    exe_path.push(exe_name);

    // Opción 2: Si no están sueltos, buscar en la subcarpeta "bin"
    if !exe_path.exists() {
        exe_path = base_path.clone();
        exe_path.push("bin");
        exe_path.push(exe_name);
    }

    // Si después de buscar en ambos lados no existe, lanzamos un error claro
    if !exe_path.exists() {
        return Err(format!("Falta el archivo: {}. No se encontró ni en la raíz ni en bin/", exe_name));
    }

    let mut cmd = std::process::Command::new(exe_path);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.args(args)
        .output()
        .map_err(|e| format!("Error del sistema ejecutando {}: {}", exe_name, e))?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn analyze_audio(video_path: String, max_clips: i32) -> Result<String, String> {
    let safe_video_path = video_path.replace("\\", "/");
    let max_clips_str = max_clips.to_string();
    
    tauri::async_runtime::spawn_blocking(move || {
        run_local_exe("audio_analyzer-x86_64-pc-windows-msvc.exe", vec![&safe_video_path, &max_clips_str])
    })
    .await
    .unwrap_or_else(|_| Err("Error interno del hilo".into()))
}

#[tauri::command]
async fn analyze_chat_command(video_path: String) -> Result<String, String> {
    let safe_video_path = video_path.replace("\\", "/");
    
    tauri::async_runtime::spawn_blocking(move || {
        run_local_exe("chat_analyzer-x86_64-pc-windows-msvc.exe", vec![&safe_video_path])
    })
    .await
    .unwrap_or_else(|_| Err("Error interno del hilo".into()))
}

#[tauri::command]
async fn analyze_faces_command(video_path: String) -> Result<String, String> {
    let safe_video_path = video_path.replace("\\", "/");
    
    tauri::async_runtime::spawn_blocking(move || {
        run_local_exe("face_tracker-x86_64-pc-windows-msvc.exe", vec![&safe_video_path])
    })
    .await
    .unwrap_or_else(|_| Err("Error interno del hilo".into()))
}

#[tauri::command]
async fn get_recent_videos(name: String, platform: String) -> Result<Vec<VideoFeed>, String> {
    let streamers = db::load_streamers();
    let url = match streamers.get(&name) {
        Some(streamer) => streamer.url.clone(),
        None => return Err("No existe el perfil".into()),
    };

    let output_str = tauri::async_runtime::spawn_blocking(move || {
        run_local_exe("video_scraper-x86_64-pc-windows-msvc.exe", vec![&url, &platform])
    })
    .await
    .unwrap_or_else(|_| Err("Error interno del hilo".into()))?;

    match serde_json::from_str::<Vec<VideoFeed>>(&output_str) {
        Ok(v) => Ok(v),
        Err(_) => Ok(vec![]), // Si la IA devuelve algo que no es JSON válido o hubo error.
    }
}

#[tauri::command]
async fn download_and_cut_clips(video_url: String, highlights_json: String, duration: i32) -> Result<String, String> {
    let duration_str = duration.to_string();
    
    tauri::async_runtime::spawn_blocking(move || {
        run_local_exe("clip_downloader-x86_64-pc-windows-msvc.exe", vec![&video_url, &highlights_json, &duration_str])
    })
    .await
    .unwrap_or_else(|_| Err("Error interno del hilo".into()))
}

// =========================================================================

// --- APLICAR LAYOUT A DAVINCI ---
#[tauri::command]
async fn apply_layout_command(
    video_paths: Vec<String>,
    insert_key: String,
    has_cam: bool,
    cam_x: f32,
    cam_y: f32,
    cam_scale: f32,
    _game_x: f32,
    _game_y: f32,
    _game_scale: f32,
    _add_title: bool,
) -> Result<String, String> {
    let export_dir = get_exports_dir();
    if !export_dir.exists() {
        fs::create_dir_all(&export_dir)
            .map_err(|e| format!("Error creando carpeta de exportación: {}", e))?;
    }
    let data_file = export_dir.join("VeloClips_Data.txt");

    let mut lines = Vec::new();
    let formato = if insert_key.contains("Horizontal") {
        "Horizontal"
    } else {
        "Vertical"
    };

    for path in video_paths {
        let line = format!(
            "{}|{}|{}|{}|{}|{}|{}",
            path, insert_key, formato, has_cam, cam_x, cam_y, cam_scale
        );
        lines.push(line);
    }
    let content = lines.join("\n");

    match fs::write(&data_file, content) {
        Ok(_) => Ok("✅ ¡Instrucciones enviadas a DaVinci Resolve!".to_string()),
        Err(e) => Err(format!("Error escribiendo datos para DaVinci: {}", e)),
    }
}

#[tauri::command]
fn get_all_streamers() -> Result<HashMap<String, db::Streamer>, String> {
    Ok(db::load_streamers())
}

#[tauri::command]
fn add_streamer(name: String, platform: String, url: String) -> Result<String, String> {
    let mut streamers = db::load_streamers();
    streamers.insert(name, db::Streamer { platform, url });
    db::save_streamers(&streamers);
    Ok("¡Perfil vinculado con éxito!".into())
}

#[tauri::command]
fn delete_streamer(name: String) -> Result<String, String> {
    let mut streamers = db::load_streamers();
    streamers.remove(&name);
    db::save_streamers(&streamers);
    Ok("Perfil eliminado.".into())
}

#[tauri::command]
async fn check_davinci_status() -> bool {
    let result = tauri::async_runtime::spawn_blocking(|| {
        let mut cmd = std::process::Command::new("tasklist");
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);

        if let Ok(output) = cmd.output() {
            return String::from_utf8_lossy(&output.stdout)
                .to_lowercase()
                .contains("resolve.exe");
        }
        false
    })
    .await;

    result.unwrap_or(false)
}

#[tauri::command]
async fn get_local_library() -> Result<Vec<String>, String> {
    let mut files = Vec::new();
    let path = get_exports_dir();

    if let Ok(entries) = std::fs::read_dir(&path) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_file() {
                    if let Ok(file_name) = entry.file_name().into_string() {
                        if file_name.ends_with(".mp4") || file_name.ends_with(".mkv") {
                            files.push(
                                path.join(&file_name)
                                    .display()
                                    .to_string()
                                    .replace("\\", "/"),
                            );
                        }
                    }
                }
            }
        }
    }
    Ok(files)
}

#[tauri::command]
fn open_export_folder() -> Result<String, String> {
    let path = get_exports_dir();
    let _ = std::fs::create_dir_all(&path);

    #[cfg(target_os = "windows")]
    {
        let mut cmd = std::process::Command::new("explorer");
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.arg(path).spawn().map_err(|e| e.to_string())?;
    }
    Ok("Carpeta abierta con éxito".into())
}

#[tauri::command]
async fn graceful_restart(app: tauri::AppHandle) {
    let mut cmd = std::process::Command::new("taskkill");
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    
    let _ = cmd.args(["/F", "/IM", "fuscript.exe", "/T"]).output();

    app.restart();
}

fn main() {
    let _ = fs::create_dir_all(get_exports_dir());
    let _ = fs::create_dir_all(get_templates_dir());
    ensure_lua_script_installed();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init()) // Esto se mantiene para que funcione la apertura de enlaces web desde React
        .on_window_event(|_window, event| match event {
            tauri::WindowEvent::CloseRequested { .. } => {
                let mut cmd = std::process::Command::new("taskkill");
                #[cfg(target_os = "windows")]
                cmd.creation_flags(CREATE_NO_WINDOW);

                let _ = cmd.args(["/F", "/IM", "fuscript.exe", "/T"]).output();
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            apply_layout_command,
            get_all_streamers,
            add_streamer,
            delete_streamer,
            get_recent_videos,
            check_davinci_status,
            select_local_video,
            analyze_audio,
            analyze_chat_command,
            analyze_faces_command,
            download_and_cut_clips,
            get_local_library,
            open_export_folder,
            graceful_restart
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}