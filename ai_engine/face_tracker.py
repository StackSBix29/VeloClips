import sys
import json
import os
import subprocess
import traceback
import uuid
import glob

try:
    import cv2
    import imageio_ffmpeg
except Exception as e:
    print(json.dumps([{"error": f"Fallo al cargar librerias base: {str(e)}", "x": 0.0, "y": 0.0, "zoom": 1.0}]))
    sys.exit(0)

try:
    import mediapipe as mp
    mp_face_detection = mp.solutions.face_detection
except Exception as e:
    print(json.dumps([{"error": f"Fallo IA (MediaPipe): {str(e)}", "x": 0.0, "y": 0.0, "zoom": 1.0}]))
    sys.exit(0)

def get_direct_url(video_path):
    if "kick.com/video/" in video_path.lower():
        try:
            from curl_cffi import requests
            vid_id = video_path.split("kick.com/video/")[-1].split("?")[0].strip("/")
            r = requests.get(f"https://kick.com/api/v1/video/{vid_id}", impersonate="chrome120", timeout=15)
            if r.status_code == 200:
                data = r.json()
                return data.get("source") or data.get("playback_url") or data.get("source_url")
        except: pass
    
    import yt_dlp
    ydl_opts = {
        'format': 'bestvideo[height<=1080][ext=mp4]/best', 
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
                if f.get('vcodec') != 'none': return f['url']
            return info['requested_formats'][0]['url']
        return video_path

def analyze_faces(video_path):
    temp_dir = "C:/temp"
    os.makedirs(temp_dir, exist_ok=True)
    unique_id = str(uuid.uuid4())[:8]
    
    try:
        try: ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        except: ffmpeg_exe = "ffmpeg"

        media_source = get_direct_url(video_path) if video_path.startswith("http") else video_path
        
        ffmpeg_base_cmd = [
            ffmpeg_exe, 
            '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
            '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5'
        ]
        
        # EL VIGILANTE DEL TIEMPO: Tomamos fotos en 3 momentos distintos del stream
        time_points = ['00:05:00', '00:15:00', '00:30:00']
        for tp in time_points:
            frame_pattern = f"{temp_dir}/face_{unique_id}_{tp.replace(':', '')}_%02d.jpg"
            cmd = ffmpeg_base_cmd + ['-ss', tp, '-i', media_source, '-t', '00:00:04', '-vf', 'fps=1', frame_pattern, '-y']
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
        frames = glob.glob(f"{temp_dir}/face_{unique_id}_*.jpg")
        
        # Si falló (video muy corto), probamos en el primer minuto como rescate
        if not frames:
            frame_pattern = f"{temp_dir}/face_{unique_id}_rescue_%02d.jpg"
            cmd = ffmpeg_base_cmd + ['-ss', '00:01:00', '-i', media_source, '-t', '00:00:04', '-vf', 'fps=1', frame_pattern, '-y']
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            frames = glob.glob(f"{temp_dir}/face_{unique_id}_*.jpg")
            
        if not frames:
            return [{"error": "No se pudieron extraer fotografias del video", "x": 0.0, "y": 0.0, "zoom": 1.0}]
        
        best_faces = []
        best_image = None
        
        with mp_face_detection.FaceDetection(model_selection=0, min_detection_confidence=0.1) as face_detection:
            for img_file in frames:
                image = cv2.imread(img_file)
                if image is None: continue
                
                h, w, _ = image.shape
                current_faces = []
                
                def scan_region(x_start, x_end, img):
                    region = img[:, int(x_start):int(x_end)]
                    img_rgb = cv2.cvtColor(region, cv2.COLOR_BGR2RGB)
                    res = face_detection.process(img_rgb)
                    if res.detections:
                        for det in res.detections:
                            bbox = det.location_data.relative_bounding_box
                            rx = (bbox.xmin * (x_end - x_start) / w) + (x_start / w) + (bbox.width * (x_end - x_start) / w / 2)
                            ry = bbox.ymin + (bbox.height / 2)
                            rh = bbox.height
                            
                            is_duplicate = False
                            for ext_face in current_faces:
                                if abs(ext_face["raw_x"] - rx) < 0.08 and abs(ext_face["raw_y"] - ry) < 0.1:
                                    is_duplicate = True
                                    break
                            
                            if not is_duplicate:
                                current_faces.append({
                                    "raw_x": rx, "raw_y": ry, "height": rh, 
                                    "box": (rx, ry, bbox.width*(x_end-x_start)/w, rh)
                                })
                
                scan_region(0, w, image)          
                scan_region(0, w*0.6, image)      
                scan_region(w*0.4, w, image)      
                scan_region(w*0.2, w*0.8, image)  
                
                if len(current_faces) > len(best_faces):
                    best_faces = current_faces
                    best_image = image.copy()
                        
        if best_image is not None:
            try:
                os.makedirs("C:/VeloClips_Exports", exist_ok=True)
                for f_info in best_faces:
                    bx, by, bw, bh = f_info["box"]
                    x1 = int((bx - bw/2) * w)
                    y1 = int((by - bh/2) * h)
                    x2 = int((bx + bw/2) * w)
                    y2 = int((by + bh/2) * h)
                    cv2.rectangle(best_image, (x1, y1), (x2, y2), (0, 255, 0), 3)
                cv2.imwrite("C:/VeloClips_Exports/DEBUG_VISION.jpg", best_image)
            except: pass

        if not best_faces:
            for img_file in frames:
                try: os.remove(img_file)
                except: pass
            return [{"error": "Nadie en pantalla (Revisa DEBUG_VISION.jpg)", "x": 0.0, "y": 0.0, "zoom": 1.0}]
            
        for img_file in frames:
            try: os.remove(img_file)
            except: pass
            
        best_faces.sort(key=lambda f: f["raw_x"]) 
        
        davinci_data = []
        for i, f in enumerate(best_faces):
            offset_x = 0.5 - f["raw_x"]
            offset_y = 0.5 - f["raw_y"]
            base_zoom = 1.6
            if f["height"] < 0.15: base_zoom = 2.1
            
            davinci_data.append({
                "id": f"Sujeto {i+1}", 
                "x": round(offset_x, 3), 
                "y": round(offset_y, 3), 
                "zoom": base_zoom
            })
            
        return davinci_data
        
    except Exception as e:
        frames = glob.glob(f"{temp_dir}/face_{unique_id}_*.jpg")
        for img_file in frames:
            try: os.remove(img_file)
            except: pass
        err_line = traceback.format_exc().strip().split('\n')[-1]
        return [{"error": f"Fallo IA: {err_line[:50]}", "x": 0.0, "y": 0.0, "zoom": 1.0}]

if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(json.dumps(analyze_faces(sys.argv[1])))
    else:
        print(json.dumps([{"error": "Falta URL"}]))