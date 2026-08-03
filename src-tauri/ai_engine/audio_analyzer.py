import sys
import json
import librosa
import numpy as np
import os
import subprocess
import imageio_ffmpeg
import scipy.signal
import traceback
import uuid
import io

# --- SILENCIADOR EXTREMO PARA YT-DLP ---
class MuteLogger(object):
    def debug(self, msg): pass
    def warning(self, msg): pass
    def error(self, msg): pass
# ---------------------------------------

def get_direct_url(video_path):
    # Solo usamos streaming directo para Kick (sus servidores no bloquean la velocidad)
    if "kick.com/video/" in video_path.lower():
        try:
            from curl_cffi import requests
            vid_id = video_path.split("kick.com/video/")[-1].split("?")[0].strip("/")
            api_url = f"https://kick.com/api/v1/video/{vid_id}"
            r = requests.get(api_url, impersonate="chrome120", timeout=15)
            if r.status_code == 200:
                data = r.json()
                src = data.get("source") or data.get("playback_url") or data.get("source_url")
                if src: return src
            raise Exception(f"Kick API HTTP {r.status_code}")
        except Exception as e:
            raise Exception(f"Bypass Kick Falló: {str(e)}")
    return None

def analyze_audio_in_ram(video_path, max_clips_str):
    temp_audio_file = None
    try:
        max_clips = int(max_clips_str)
        sr = 8000
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        
        media_source = video_path
        
        # --- EL NUEVO TRUCO PARA ACELERAR YOUTUBE (Descarga Fantasma) ---
        if video_path.startswith("http"):
            if "kick.com" in video_path.lower():
                media_source = get_direct_url(video_path)
            else:
                import yt_dlp
                unique_id = str(uuid.uuid4())[:8]
                temp_dir = "C:/temp"
                os.makedirs(temp_dir, exist_ok=True)
                temp_audio_file = f"{temp_dir}/fast_audio_{unique_id}.m4a"
                
                ydl_opts = {
                    'format': 'bestaudio[ext=m4a]/bestaudio/best', 
                    'outtmpl': temp_audio_file,
                    'quiet': True,
                    'no_warnings': True,
                    'noprogress': True,        # <-- APAGA LA BARRA DE DESCARGA
                    'logger': MuteLogger()     # <-- SILENCIA CUALQUIER OTRA BASURA
                }
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([video_path])
                
                media_source = temp_audio_file

        if not media_source:
            return [{"title": "Error: Enlace multimedia no encontrado.", "score": 0, "time": "00:00", "seconds_raw": 0}]

        # ffmpeg ahora lee desde el archivo local (súper rápido)
        command = [ffmpeg_exe, '-i', media_source, '-f', 'f32le', '-ac', '1', '-ar', str(sr), 'pipe:1']
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        raw_audio, stderr_data = process.communicate()
        
        # BORRAMOS EL ARCHIVO FANTASMA INMEDIATAMENTE
        if temp_audio_file and os.path.exists(temp_audio_file):
            try: os.remove(temp_audio_file)
            except: pass
            
        y = np.frombuffer(raw_audio, dtype=np.float32)
        if y is None or len(y) == 0:
            err = stderr_data.decode('utf-8', errors='ignore')[-60:]
            return [{"title": f"Fallo al leer audio: {err}", "score": 0, "time": "00:00", "seconds_raw": 0}]
            
        b, a = scipy.signal.butter(N=3, Wn=[300, 3000], btype='bandpass', fs=sr)
        y_voice = scipy.signal.filtfilt(b, a, y)
        
        rms = librosa.feature.rms(y=y_voice)[0]
        threshold = np.percentile(rms, 90) 
        
        peak_frames = np.where(rms > threshold)[0]
        peak_times = librosa.frames_to_time(peak_frames, sr=sr)
        
        raw_highlights = []
        last_time = -100
        for t in peak_times:
            if t - last_time > 60: 
                frame_idx = librosa.time_to_frames(t, sr=sr)
                intensity = float(rms[frame_idx]) 
                raw_highlights.append({"time": t, "intensity": intensity})
                last_time = t

        block_size = 600  
        blocks = {}
        for hl in raw_highlights:
            block_idx = int(hl["time"] // block_size)
            if block_idx not in blocks:
                blocks[block_idx] = []
            blocks[block_idx].append(hl)
            
        for b in blocks:
            blocks[b].sort(key=lambda x: x["intensity"], reverse=True)
            
        distributed_highlights = []
        round_idx = 0
        while len(distributed_highlights) < max_clips and any(len(clips) > round_idx for clips in blocks.values()):
            for b in sorted(blocks.keys()):
                if len(distributed_highlights) >= max_clips: break
                if len(blocks[b]) > round_idx:
                    distributed_highlights.append(blocks[b][round_idx])
            round_idx += 1

        distributed_highlights.sort(key=lambda x: x["time"])
        
        highlights = []
        for hl in distributed_highlights:
            t = hl["time"]
            m, s = divmod(int(t), 60)
            h, m = divmod(m, 60)
            time_str = f"{h:02d}:{m:02d}:{s:02d}" if h > 0 else f"{m:02d}:{s:02d}"
            highlights.append({
                "title": "🗣️ Pico Vocal Detectado",
                "score": min(99, int(75 + (hl["intensity"] * 100))), 
                "time": time_str,
                "seconds_raw": int(t)
            })

        if not highlights:
            return [{"title": "No se encontraron picos altos", "score": 0, "time": "00:00", "seconds_raw": 0}]

        return highlights
    except Exception as e:
        if temp_audio_file and os.path.exists(temp_audio_file):
            try: os.remove(temp_audio_file)
            except: pass
        err_line = traceback.format_exc().strip().split('\n')[-1]
        return [{"title": f"Fallo: {err_line[:60]}", "score": 0, "time": "00:00", "seconds_raw": 0}]

if __name__ == "__main__":
    # Forzamos la codificación para que el emoji "🗣️" no rompa la consola en Windows
    if sys.platform == "win32":
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    if len(sys.argv) > 2:
        print(json.dumps(analyze_audio_in_ram(sys.argv[1], sys.argv[2])))
    else:
        print("[]")