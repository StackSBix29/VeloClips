use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;

#[derive(Serialize, Deserialize, Clone)]
pub struct Streamer {
    pub platform: String,
    pub url: String,
}

// El archivo donde se guardarán tus perfiles
const DB_PATH: &str = "streamers.json";

pub fn load_streamers() -> HashMap<String, Streamer> {
    if let Ok(data) = fs::read_to_string(DB_PATH) {
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        HashMap::new()
    }
}

pub fn save_streamers(streamers: &HashMap<String, Streamer>) {
    if let Ok(data) = serde_json::to_string_pretty(streamers) {
        let _ = fs::write(DB_PATH, data);
    }
}