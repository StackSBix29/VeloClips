import sys
import json
import os
import subprocess
import imageio_ffmpeg

def get_direct_url(video_path):
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
        except: pass
        raise Exception("API Kick falló")
    else:
        import yt_dlp
        ydl_opts = {
            'format': 'best', 
            'quiet': True,
            'no_warnings': True,
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
            }
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_path, download=False)
            if 'url' in info: return info['url']
            elif 'requested_formats' in info:
                for f in info['requested_formats']:
                    if f.get('acodec') != 'none' and f.get('vcodec') != 'none':
                        return f['url']
                return info['requested_formats'][0]['url']
            return video_path

def download_and_cut(video_url, payload_json, duration_str):
    try:
        payload = json.loads(payload_json)
        if isinstance(payload, list): highlights = payload
        else: highlights = payload.get("highlights", [])

        duration = int(duration_str)
        try: ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        except: ffmpeg_exe = "ffmpeg"
        
        direct_url = video_url
        
        # --- EL ARREGLO ---
        # Iniciamos la base del comando limpia
        ffmpeg_base = [ffmpeg_exe]
        
        # Si es un enlace de internet, le agregamos los trucos de conexión
        if video_url.startswith("http"):
            direct_url = get_direct_url(video_url)
            ffmpeg_base.extend([
                '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5'
            ])
            
        # OBTENEMOS LA RUTA UNIVERSAL DE EXPORTACIÓN
        user_profile = os.environ.get("USERPROFILE", "C:")
        export_dir = os.path.join(user_profile, "Documents", "VeloClips_Workspace", "Exports").replace("\\", "/")
        os.makedirs(export_dir, exist_ok=True)
        
        clips = []
        for i, hl in enumerate(highlights):
            start_time = max(0, hl["seconds_raw"] - int(duration * 0.2)) 
            out_file = f"{export_dir}/Velo_Crudo_{i+1}_{hl['seconds_raw']}.mp4"
            
            # El comando ahora funciona perfecto sin importar si es web o local
            cmd = ffmpeg_base + [
                '-ss', str(start_time), 
                '-i', direct_url, 
                '-t', str(duration), 
                '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-ac', '2', '-ar', '48000', '-b:a', '192k',
                out_file, '-y'
            ]
            
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
            if os.path.exists(out_file) and os.path.getsize(out_file) > 50000:
                clips.append(out_file)
                
        return json.dumps({"status": "success", "clips": clips})
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

if __name__ == "__main__":
    if len(sys.argv) > 3:
        print(download_and_cut(sys.argv[1], sys.argv[2], sys.argv[3]))