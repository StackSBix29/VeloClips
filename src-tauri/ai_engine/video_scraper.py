import sys
import json
import yt_dlp

# --- SILENCIADOR EXTREMO PARA YT-DLP ---
class MuteLogger(object):
    def debug(self, msg): pass
    def warning(self, msg): pass
    def error(self, msg): pass

def get_twitch_vods_via_api(url):
    """Consulta la API de Twitch (GQL) directamente para evitar los bloqueos de yt-dlp"""
    try:
        import requests
        
        # Extraemos el nombre limpiando la URL
        channel_name = url.split("twitch.tv/")[-1].split("/")[0].split("?")[0].strip()
        if not channel_name:
            return None
            
        headers = {
            'Client-Id': 'kimne78kx3ncx6brgo4mv6wki5h1ko', # ID público oficial de Twitch
            'Content-Type': 'application/json',
        }
        
        query = """
        query {
          user(login: "%s") {
            videos(first: 5, type: ARCHIVE) {
              edges {
                node {
                  id
                  title
                  lengthSeconds
                  viewCount
                  previewThumbnailURL(width: 640, height: 360)
                }
              }
            }
          }
        }
        """ % channel_name
        
        r = requests.post("https://gql.twitch.tv/gql", headers=headers, json={"query": query}, timeout=10)
        
        if r.status_code == 200:
            data = r.json()
            if "data" in data and data["data"]["user"] and data["data"]["user"]["videos"]:
                videos = data["data"]["user"]["videos"]["edges"]
                results = []
                for v in videos:
                    node = v["node"]
                    duration_sec = node["lengthSeconds"]
                    h = int(duration_sec // 3600)
                    m = int((duration_sec % 3600) // 60)
                    dur_str = f"{h}h {m}m" if h > 0 else f"{m}m"
                    
                    results.append({
                        "id": f"https://www.twitch.tv/videos/{node['id']}",
                        "title": node["title"],
                        "duration": dur_str,
                        "date": "Reciente",
                        "views": f"{node['viewCount']:,}".replace(',', '.') + " vistas",
                        "platform": "Twitch",
                        "img_url": node["previewThumbnailURL"]
                    })
                if results:
                    return results
    except Exception:
        return None
    return None

def get_kick_vods_via_api(url):
    """Consulta la API interna de Kick con múltiples perfiles para saltar Cloudflare."""
    try:
        from curl_cffi import requests
        
        channel_name = url.split("kick.com/")[-1].split("?")[0].strip("/")
        if not channel_name:
            return None
            
        api_url = f"https://kick.com/api/v1/channels/{channel_name}"
        
        # Kick actualiza Cloudflare seguido. Intentamos con diferentes "impersonates"
        response = None
        for browser in ["chrome110", "safari15_5", "chrome120", "edge101"]:
            try:
                response = requests.get(api_url, impersonate=browser, timeout=10)
                if response.status_code == 200:
                    break
            except:
                continue
        
        if not response or response.status_code != 200:
            return None
            
        data = response.json()
        livestreams = data.get("previous_livestreams", [])
        
        results = []
        for stream in livestreams[:5]:
            duration_ms = stream.get("duration", 0)
            duration_sec = duration_ms / 1000
            h = int(duration_sec // 3600)
            m = int((duration_sec % 3600) // 60)
            dur_str = f"{h}h {m}m" if h > 0 else f"{m}m"
            
            views = stream.get("views", 0)
            view_str = f"{views:,}".replace(',', '.') + " vistas"
            
            thumb = ""
            if stream.get("thumbnail") and isinstance(stream["thumbnail"], dict):
                thumb = stream["thumbnail"].get("url", stream["thumbnail"].get("src", ""))
            elif stream.get("thumbnail") and isinstance(stream["thumbnail"], str):
                thumb = stream["thumbnail"]
                
            if not thumb and stream.get("video") and isinstance(stream["video"], dict):
                thumb = stream["video"].get("thumbnail", "")
            
            title = stream.get("session_title", stream.get("title", "Directo de Kick sin título"))
            
            video_id = stream.get("id", "")
            if stream.get("video") and isinstance(stream["video"], dict):
                video_id = stream["video"].get("uuid", video_id)
            
            video_url = f"https://kick.com/video/{video_id}"
            
            results.append({
                "id": video_url,
                "title": title,
                "duration": dur_str,
                "date": "Reciente",
                "views": view_str,
                "platform": "Kick",
                "img_url": thumb
            })
        return results
    except Exception:
        return None 

def get_recent_vods(url, platform):
    # 1. Intentar APIs Directas primero (Son más rápidas y no las bloquean fácilmente)
    if platform.lower() == "kick":
        api_results = get_kick_vods_via_api(url)
        if api_results: return api_results

    if platform.lower() == "twitch":
        api_results = get_twitch_vods_via_api(url)
        if api_results: return api_results

    # 2. Fallback a yt-dlp (Principalmente para YouTube)
    ydl_opts = {
        'extract_flat': True,
        'playlist_items': '1-5',
        'quiet': True,
        'skip_download': True,
        'no_warnings': True,
        'ignoreerrors': True,
        'logger': MuteLogger(), 
    }

    try:
        base_url = url.split('?')[0].rstrip('/')
        target_url = base_url
        
        if platform.lower() == "twitch":
            if not target_url.endswith("/videos"):
                target_url = f"{base_url}/videos"
        elif platform.lower() == "youtube":
            if not target_url.endswith("/videos") and not target_url.endswith("/streams"):
                target_url = f"{base_url}/videos"

        results = []
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(target_url, download=False)
            
            if info and 'entries' in info:
                for entry in info['entries']:
                    if not entry: continue
                    
                    duration_sec = entry.get('duration')
                    dur_str = "VOD"
                    if duration_sec:
                        h = int(duration_sec // 3600)
                        m = int((duration_sec % 3600) // 60)
                        dur_str = f"{h}h {m}m" if h > 0 else f"{m}m"

                    views = entry.get('view_count', 0)
                    view_str = f"{views:,}".replace(',', '.') + " vistas" if views else "N/A"

                    thumb = ""
                    if entry.get('thumbnails'):
                        thumb = entry['thumbnails'][-1].get('url', '')
                    elif entry.get('thumbnail'):
                        thumb = entry.get('thumbnail', '')

                    video_id = entry.get('id', '')
                    video_url = entry.get('url', '')
                    
                    if not video_url and video_id:
                        if platform.lower() == "twitch":
                            video_url = f"https://www.twitch.tv/videos/{video_id}"
                        elif platform.lower() == "youtube":
                            video_url = f"https://www.youtube.com/watch?v={video_id}"

                    final_url = video_url if video_url else video_id

                    results.append({
                        "id": final_url,
                        "title": entry.get('title', 'Video sin título'),
                        "duration": dur_str,
                        "date": "Reciente",
                        "views": view_str,
                        "platform": platform,
                        "img_url": thumb
                    })
            return results
            
    except Exception as e:
        error_msg = str(e).replace('"', "'")
        return [{
            "id": "error",
            "title": f"⚠️ Error en {platform}: {error_msg[:80]}...",
            "duration": "Error",
            "date": "Scraper",
            "views": "0",
            "platform": platform,
            "img_url": ""
        }]

if __name__ == "__main__":
    import io
    # Forzamos UTF-8 en consola para evitar que Tauri sufra leyendo acentos y emojis
    if sys.platform == "win32":
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    if len(sys.argv) > 2:
        print(json.dumps(get_recent_vods(sys.argv[1], sys.argv[2])))
    else:
        print("[]")