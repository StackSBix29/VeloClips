import sys
import json
import os
import re
import yt_dlp

# --- CLASE PARA SILENCIAR yt-dlp ---
class MuteLogger(object):
    def debug(self, msg): pass
    def warning(self, msg): pass
    def error(self, msg): pass
# -----------------------------------

def analyze_chat(video_url):
    try:
        # Si es un archivo local, el chat no aplica[cite: 4]
        if not video_url.startswith("http"):
            return []

        temp_dir = "C:/temp"
        os.makedirs(temp_dir, exist_ok=True)
        temp_sub = f"{temp_dir}/chat_temp"
        
        # Configuración nativa de yt_dlp para descargar subtítulos silenciosamente[cite: 4]
        ydl_opts = {
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitlesformat': 'vtt',
            'skip_download': True,
            'outtmpl': temp_sub,
            'quiet': True,
            'no_warnings': True,
            'logger': MuteLogger() # <-- ¡AQUÍ ESTÁ EL SILENCIADOR!
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])
        
        sub_file = None
        for file in os.listdir(temp_dir):
            if file.startswith("chat_temp") and file.endswith(".vtt"):
                sub_file = f"{temp_dir}/{file}"
                break
                
        if not sub_file:
            return []
            
        timestamps = []
        with open(sub_file, 'r', encoding='utf-8') as f:
            content = f.read()
            matches = re.findall(r'(\d{2}:\d{2}:\d{2})\.\d{3}', content)
            for m in matches:
                h, m, s = map(int, m.split(':'))
                timestamps.append(h * 3600 + m * 60 + s)
                
        if not timestamps: return []

        # Agrupamos mensajes cada 10 segundos[cite: 4]
        chat_density = {}
        for t in timestamps:
            window = t // 10
            chat_density[window] = chat_density.get(window, 0) + 1
            
        high_density = [w for w, count in chat_density.items() if count > 5]
        
        highlights = []
        last_t = -100
        for w in high_density:
            raw_sec = w * 10
            if raw_sec - last_t > 60:
                h, m_rem = divmod(raw_sec, 3600)
                m, s = divmod(m_rem, 60)
                time_str = f"{h:02d}:{m:02d}:{s:02d}" if h > 0 else f"{m:02d}:{s:02d}"
                highlights.append({
                    "title": "🔥 Explosión en el Chat", 
                    "score": 99, 
                    "time": time_str, 
                    "seconds_raw": raw_sec
                })
                last_t = raw_sec
                
        os.remove(sub_file)
        return highlights
    except Exception as e:
        return []

if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(json.dumps(analyze_chat(sys.argv[1])))
    else:
        print("[]")