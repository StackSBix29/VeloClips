import { useState, useEffect, useRef } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-shell';
import { ask } from '@tauri-apps/plugin-dialog';
import { Sparkles, Settings, X, Search, Download, CheckCircle2, Tv, Layers, Crosshair, Flame, Scissors, ChevronLeft, Trash2, FileVideo, RefreshCw, BookmarkPlus, Save, History } from 'lucide-react';

const appWindow = getCurrentWindow();

const customScrollbarStyle = `
  .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: #030305; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #2a2a35; border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #b026ff; }
  
  .toggle-checkbox:checked { right: 0; border-color: #b026ff; }
  .toggle-checkbox:checked + .toggle-label { background-color: #b026ff; }

  .drag-region { -webkit-app-region: drag; }
`;

// --- COMPONENTES SECUNDARIOS ---
const HighlightCard = ({ title, score, time }: any) => (
  <div className="flex items-center justify-between p-2.5 bg-[#0c0c10] border border-[#1a1a24] rounded-lg hover:border-[#b026ff] cursor-pointer transition-all mb-2">
    <div className="flex flex-col">
      <span className="text-[13px] font-bold text-white leading-tight">{title}</span>
      <span className="text-[10px] text-gray-400">Marca: {time}</span>
    </div>
    <div className="flex items-center gap-1 bg-[#1a0933] border border-[#b026ff]/50 px-1.5 py-0.5 rounded text-[10px] font-bold text-[#e0b0ff]">
      <Flame size={10} /> {score}%
    </div>
  </div>
);

const ControlSlider = ({ label, value, onChange, max = 100, min = 0 }: any) => (
  <div className="flex flex-col gap-1 mb-3">
    <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
      <span>{label}</span><span className="text-[#b026ff]">{value}</span>
    </div>
    <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full h-1 bg-[#1a1a24] rounded-lg appearance-none cursor-pointer accent-[#b026ff]" />
  </div>
);

const VideoCard = ({ title, duration, date, views, platform, img_url, local_path, onClick, isSelected, videoRef }: any) => {
    const getPlatformColor = (plat: string) => {
      if (plat === 'Kick') return 'text-[#53fc18] border-[#53fc18]/30';
      if (plat === 'YouTube') return 'text-[#ff0000] border-[#ff0000]/30';
      if (plat === 'Local') return 'text-[#00e5ff] border-[#00e5ff]/30';
      return 'text-[#b026ff] border-[#b026ff]/30';
    };
  
    return (
      <div onClick={onClick} className={`flex flex-col gap-3 p-3 bg-[#0a0a0f] border rounded-xl transition-all cursor-pointer group ${isSelected ? 'border-[#b026ff] shadow-[0_0_15px_rgba(176,38,255,0.15)] bg-[#120529]' : 'border-[#1a1a24] hover:border-[#b026ff]/50'}`}>
        <div className={`relative w-full h-32 rounded-lg border flex items-center justify-center overflow-hidden ${getPlatformColor(platform)} transition-colors bg-black`}>
          {img_url ? (
            <img src={img_url} alt="Thumbnail" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
          ) : local_path ? (
            <video ref={videoRef} controls src={convertFileSrc(local_path)} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" preload="metadata" />
          ) : (
            <Tv size={24} className="opacity-80" />
          )}
          {!local_path && <div className="absolute bottom-2 right-2 bg-black/90 px-2 py-1 rounded text-[10px] font-bold text-white tracking-wider">{duration}</div>}
        </div>
        <div className="flex flex-col gap-1 overflow-hidden">
          <h3 className="font-bold text-white text-sm line-clamp-2 leading-tight">{title}</h3>
          <div className="flex items-center gap-2 text-[11px] text-gray-400 font-medium mt-1">
            <span className={getPlatformColor(platform).split(' ')[0]}>{platform}</span>
            <span>•</span><span>{date}</span><span>•</span><span>{views}</span>
          </div>
        </div>
      </div>
    );
};

// --- APP PRINCIPAL ---
export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Centro de Mando Listo.");
  const [streamers, setStreamers] = useState<any>({});
  const [activeProfile, setActiveProfile] = useState<string | null>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState("");
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [localVideoPath, setLocalVideoPath] = useState<string | null>(null);
  
  const [highlights, setHighlights] = useState<any[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressPhase, setProgressPhase] = useState("");
  
  // States para la Biblioteca de Proyectos
  const [showLibrary, setShowLibrary] = useState(false);
  const [savedProjects, setSavedProjects] = useState<any[]>([]);
  
  const [faces, setFaces] = useState<any[]>([]);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);

  // Parámetros del Proyecto
  const [clipDuration, setClipDuration] = useState(60); 
  const [maxClips, setMaxClips] = useState(10);
  const [useOverlay, setUseOverlay] = useState(true);
  
  // UI States
  const [showSettings, setShowSettings] = useState(false);

  const [useDaVinci, setUseDaVinci] = useState(() => {
    const saved = localStorage.getItem('velo_use_davinci');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleDaVinci = (val: boolean) => {
    setUseDaVinci(val);
    localStorage.setItem('velo_use_davinci', String(val));
  };

  const defaultTemplates = [
    { name: "Video Original Puro (Sin Efectos)", value: "NINGUNO" },
    { name: "Fondo Inmersivo (Blur)", value: "Plantillas.drb" },
    { name: "Horizontal (Normal para YouTube)", value: "Horizontal.drb" },
    { name: "1 Participante (Vertical)", value: "Vertical_1Cam.drb" },
    { name: "2 Participantes (Duo)", value: "Vertical_2Cam.drb" }
  ];
  
  const [savedTemplates, setSavedTemplates] = useState<{name: string, value: string}[]>([]);
  const [preset, setPreset] = useState(defaultTemplates[1].value);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  const needsFaceScan = preset.includes("Cam");
  const canRender = !isAnalyzing && (localVideoPath || selectedVideo) && (!needsFaceScan || faces.length > 0);

  // --- 1. CARGA INICIAL ---
  useEffect(() => {
    appWindow.show(); 
    const saved = localStorage.getItem('velo_custom_templates');
    if (saved) setSavedTemplates(JSON.parse(saved));
    loadProfiles();
    
    // --- NUEVO SISTEMA DE ACTUALIZACIONES VÍA GITHUB ---
    const checkForUpdates = async () => {
      try {
        const versionActual = await getVersion();
        
        const respuesta = await fetch('https://api.github.com/repos/StackSBix29/VeloClips/releases/latest');
        if (!respuesta.ok) return; 
        
        const datos = await respuesta.json();
        const ultimaVersion = datos.tag_name.replace('v', '');
        
        if (ultimaVersion !== versionActual) {
          const yes = await ask(
            `¡Hay una nueva versión de VeloClips disponible (${ultimaVersion})!\n\n¿Quieres descargarla ahora?`, 
            { title: 'Actualización Disponible', kind: 'info', okLabel: 'Descargar', cancelLabel: 'Más tarde' }
          );
          if (yes) {
            await open(datos.html_url);
          }
        }
      } catch (error) {
        console.error("Error buscando actualizaciones:", error);
      }
    };

    checkForUpdates();
    // ----------------------------------------------------

    const checkDaVinci = async () => {
      try { setIsConnected(await invoke<boolean>('check_davinci_status')); } 
      catch (e) { setIsConnected(false); }
    };
    checkDaVinci();
    const interval = setInterval(checkDaVinci, 2000);
    return () => clearInterval(interval);
  }, []);

  // --- 2. SISTEMA DE PROYECTOS (GUARDAR ESTADO) ---
  useEffect(() => {
    const currentId = localVideoPath || selectedVideo;
    if (!currentId || highlights.length === 0) return;

    const projectData = {
      id: currentId,
      isLocal: !!localVideoPath,
      path: localVideoPath,
      timestamp: new Date().toISOString(),
      highlights,
      clipDuration,
      maxClips,
      preset,
      faces,
      useOverlay
    };
    localStorage.setItem(`veloclips_project_${currentId}`, JSON.stringify(projectData));
  }, [highlights, clipDuration, maxClips, preset, faces, useOverlay, localVideoPath, selectedVideo]);

  // --- 3. SISTEMA DE PROYECTOS (CARGAR ESTADO) ---
  useEffect(() => {
    const currentId = localVideoPath || selectedVideo;
    if (!currentId) return;

    const savedProject = localStorage.getItem(`veloclips_project_${currentId}`);
    if (savedProject) {
      const data = JSON.parse(savedProject);
      setHighlights(data.highlights || []);
      setClipDuration(data.clipDuration || 60);
      setMaxClips(data.maxClips || 10);
      setPreset(data.preset || defaultTemplates[1].value);
      setFaces(data.faces || []);
      setUseOverlay(data.useOverlay ?? true);
      setStatusMsg("Proyecto recuperado del historial.");
    } else {
      setHighlights([]);
      setFaces([]);
      setStatusMsg("Nuevo proyecto cargado.");
      checkAndAnalyze(); 
    }
  }, [selectedVideo, localVideoPath]);

  useEffect(() => {
    if (needsFaceScan && faces.length === 0 && (localVideoPath || selectedVideo) && !isAnalyzing) {
        handleScanFaces();
    }
  }, [preset, localVideoPath, selectedVideo]);

  const handleSaveTemplate = () => {
    if (!newTemplateName) return;
    const newTemplate = { name: newTemplateName, value: newTemplateName.replace(/\s+/g, '_') + ".drb" };
    const updated = [...savedTemplates, newTemplate];
    setSavedTemplates(updated);
    localStorage.setItem('velo_custom_templates', JSON.stringify(updated));
    setPreset(newTemplate.value);
    setNewTemplateName("");
    setIsSavingTemplate(false);
    setStatusMsg(`Plantilla custom guardada.`);
  };

  useEffect(() => {
    if (!isAnalyzing) { setProgress(0); return; }
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100;
        return prev + ((100 - prev) * 0.08) > 99.9 ? 99.9 : prev + ((100 - prev) * 0.08);
      });
    }, 250);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const getActiveUrl = () => {
    if (localVideoPath) return localVideoPath;
    const vid = videos.find(v => v.id === selectedVideo);
    if (!vid || !vid.id || vid.id.trim() === "") return null; 
    if (vid.id.startsWith("http")) return vid.id;
    if (vid.platform === 'YouTube') return `https://www.youtube.com/watch?v=${vid.id}`;
    if (vid.platform === 'Twitch') return `https://www.twitch.tv/videos/${vid.id}`;
    if (vid.platform === 'Kick') return `https://kick.com/video/${vid.id}`;
    return vid.id; 
  };

  const checkAndAnalyze = async () => {
    const realPathToSend = getActiveUrl();
    
    // 1. Validar que exista un video antes de intentar llamar a los scripts
    if (!realPathToSend) {
        setStatusMsg("⚠️ Selecciona o importa un video primero para iniciar la IA.");
        return;
    }

    setIsAnalyzing(true); 
    setProgress(0); 
    setProgressPhase("Analizando Picos...");
    
    try {
      const audioResStr = await invoke<string>('analyze_audio', { videoPath: realPathToSend, maxClips });
      console.log("Respuesta cruda de audio_analyzer:", audioResStr);
      let audioData = [];
      const startIndex = audioResStr.indexOf('[');
      if (startIndex !== -1) audioData = JSON.parse(audioResStr.substring(startIndex));

      let chatData: any[] = [];
      if (!localVideoPath) {
          try {
              const chatResStr = await invoke<string>('analyze_chat_command', { videoPath: realPathToSend });
              let chatStartIndex = chatResStr.indexOf('[{');
              if (chatStartIndex === -1) chatStartIndex = chatResStr.indexOf('[]');
              if (chatStartIndex !== -1) chatData = JSON.parse(chatResStr.substring(chatStartIndex));
          } catch (chatError) {
              // Si el chat falla (ej. Error 429 de YouTube), lo ignoramos silenciosamente
              // para no arruinar el análisis de audio que sí funcionó.
              console.warn("No se pudo analizar el chat, omitiendo...", chatError);
          }
      }
      let combinedData = [...audioData, ...chatData].sort((a, b) => a.seconds_raw - b.seconds_raw).slice(0, maxClips);
      
      setProgress(100); 
      setTimeout(() => {
          setHighlights(combinedData);
          setStatusMsg(`¡Análisis Completado! ${combinedData.length} clips detectados.`);
          setIsAnalyzing(false);
      }, 400);
      
    } catch (e: any) { 
      setIsAnalyzing(false); 
      // 2. Imprimir cualquier error de Rust directamente en la barra de estado
      setStatusMsg(`❌ Error crítico en IA: ${e}`); 
      console.error(e);
    }
  };

  const loadProfiles = async () => { try { setStreamers(await invoke<any>('get_all_streamers')); } catch (e) {} };
  const fetchVideos = async (name: string, platform: string) => {
    setIsLoadingFeed(true); setVideos([]);
    try { setVideos(await invoke<any[]>('get_recent_videos', { name, platform })); setSelectedVideo(null); } 
    catch (e) { setStatusMsg(`❌ Error cargando videos: ${e}`); } finally { setIsLoadingFeed(false); }
  };

  // --- CARGAR HISTORIAL DE PROYECTOS ---
  const handleOpenLibrary = () => {
    const projects = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('veloclips_project_')) {
        try {
            const data = JSON.parse(localStorage.getItem(key) || '{}');
            projects.push(data);
        } catch (e) {}
      }
    }
    // Ordenar por más recientes
    projects.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setSavedProjects(projects);
    setShowLibrary(true);
  };

  const loadProjectFromLibrary = (project: any) => {
    if (project.isLocal) {
        setLocalVideoPath(project.path);
        setActiveProfile("Archivo Local");
        setSelectedVideo(null);
    } else {
        setLocalVideoPath(null);
        setSelectedVideo(project.id);
        setActiveProfile("VOD Guardado"); // Nombre genérico para el feed
    }
    setShowLibrary(false);
  };

  const handleImportLocalVideo = async () => {
    try {
      const path = await invoke<string>('select_local_video');
      if (path) { setSelectedVideo(null); setLocalVideoPath(path); setActiveProfile("Archivo Local"); setShowLibrary(false); }
    } catch (e: any) {
        setStatusMsg(`❌ Error importando video: ${e}`);
    }
  };

  const handleManualMark = () => {
      if (videoPlayerRef.current) {
          const rawSeconds = videoPlayerRef.current.currentTime;
          const h = Math.floor(rawSeconds / 3600), m = Math.floor((rawSeconds % 3600) / 60), s = Math.floor(rawSeconds % 60);
          const timeStr = h > 0 ? `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
          const newArray = [...highlights, { title: "📌 Marca Manual", score: 100, time: timeStr, seconds_raw: Math.floor(rawSeconds) }].sort((a, b) => a.seconds_raw - b.seconds_raw);
          setHighlights(newArray); setStatusMsg(`Marca guardada en ${timeStr}`);
      }
  };

  const handleAddChannel = async () => {
    if (!newUrl) return;
    let platform = 'Local', name = newUrl;
    if (newUrl.includes('kick.com')) { platform = 'Kick'; name = newUrl.split('kick.com/')[1]?.split('?')[0] || name; }
    else if (newUrl.includes('twitch.tv')) { platform = 'Twitch'; name = newUrl.split('twitch.tv/')[1]?.split('?')[0] || name; }
    else if (newUrl.includes('youtube.com') || newUrl.includes('youtu.be')) { platform = 'YouTube'; name = newUrl.split('@')[1]?.split('/')[0] || 'YouTube Creador'; }
    try {
      setStatusMsg("Vinculando...");
      setStatusMsg(await invoke<string>('add_streamer', { name, platform, url: newUrl }));
      setNewUrl(""); await loadProfiles(); setActiveProfile(name);
    } catch (error: any) {
        setStatusMsg(`❌ Error vinculando canal: ${error}`);
    }
  };

  const handleDeleteChannel = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke<string>('delete_streamer', { name });
      if (activeProfile === name) { setActiveProfile(null); setSelectedVideo(null); }
      await loadProfiles();
    } catch (error: any) {}
  };

  const handleScanFaces = async () => {
    const realUrl = getActiveUrl();
    if (!realUrl) return;
    setIsAnalyzing(true); setProgress(0); setProgressPhase("Auto-Encuadre IA...");
    try {
      const res = await invoke<string>('analyze_faces_command', { videoPath: realUrl });
      const parsed = JSON.parse(res.trim().replace(/^[^\[{]*|[^\]}]*$/, ""));
      setProgress(100);
      setTimeout(() => {
        if (parsed[0]?.error) setStatusMsg(`❌ ${parsed[0].error}`);
        else { setFaces(parsed); setStatusMsg(`✅ IA Facial Lista.`); }
        setIsAnalyzing(false);
      }, 400);
    } catch (e: any) { 
        setProgress(100); 
        setStatusMsg(`❌ Error IA: ${e}`); // <-- El error ahora será visible
        setIsAnalyzing(false); 
    }
  };

  const handleApplyToDaVinci = async () => {
    if (!canRender) return;
    try {
      const realUrl = getActiveUrl();
      if (!realUrl || highlights.length === 0) return;
      setIsAnalyzing(true); setProgress(0); setProgressPhase("Generando clips...");

      const masterPayload = {
         highlights: highlights,
         faces: faces,
         isVertical: !preset.includes("Horizontal"),
         template: preset, 
         useOverlay: useOverlay
      };

      const resultStr = await invoke<string>('download_and_cut_clips', { 
        videoUrl: realUrl, 
        highlightsJson: JSON.stringify(masterPayload),
        duration: clipDuration
      });

      const result = JSON.parse(resultStr.substring(resultStr.indexOf('{')));
      if (result.status === "error") throw new Error(result.message);
      
      const allClips = result.clips; 

      if (useDaVinci && isConnected) {
        setProgressPhase("Comunicando con DaVinci...");
        setProgress(90);
        
        const templateValue = useOverlay ? preset : "NINGUNO";
        
        const res = await invoke<string>('apply_layout_command', {
          videoPaths: allClips, 
          insertKey: templateValue, 
          hasCam: needsFaceScan, 
          camX: faces.length > 0 ? faces[0].x : 0.0, 
          camY: faces.length > 0 ? faces[0].y : 0.0, 
          camScale: faces.length > 0 ? faces[0].zoom : 1.0,
          gameX: 50.0, gameY: 50.0, gameScale: 100.0, addTitle: false
        });
        
        setProgress(95); await invoke('open_export_folder'); setProgress(100); 
        setStatusMsg(res);
        setTimeout(() => setIsAnalyzing(false), 800);
      } else {
        setProgressPhase("Abriendo carpeta...");
        setProgress(95); await invoke('open_export_folder'); setProgress(100);
        setStatusMsg(`✅ ${allClips.length} clips en crudo exportados exitosamente.`);
        setTimeout(() => setIsAnalyzing(false), 800);
      }
    } catch (e: any) { 
        setStatusMsg(`❌ Error: ${e}`); 
        setIsAnalyzing(false); 
    }
  };

  const activeVideoData = videos.find(v => v.id === selectedVideo) || { 
    title: localVideoPath ? (localVideoPath.split('\\').pop()?.split('/').pop() || "Archivo Local") : "Archivo Local", 
    duration: "--:--", date: "PC", platform: "Local", views: "-", local_path: localVideoPath
  };
  
  const allTemplates = [...defaultTemplates, ...savedTemplates];

  return (
    <>
    <style dangerouslySetInnerHTML={{ __html: customScrollbarStyle }} />
    <div className="fixed inset-0 bg-[#030305] text-white font-sans flex flex-col overflow-hidden border border-[#1a1a24]">
      
      {/* BARRA SUPERIOR CUSTOM */}
      <div 
        className="drag-region flex-none h-10 bg-[#0a0a0f] border-b border-[#1a1a24] flex items-center justify-between px-3 select-none z-[9999] w-full"
        data-tauri-drag-region
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <Sparkles className="text-[#b026ff]" size={14} />
          <span className="text-xs font-bold tracking-widest text-white">VELOCLIPS</span>
        </div>
        
        <div className="flex items-center gap-3 h-full z-50">
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition-all duration-300 ${isConnected ? 'bg-[#1a2e15] border-[#53fc18]/30' : 'bg-transparent border-transparent'}`} title={isConnected ? 'DaVinci Conectado' : 'Desconectado'}>
                <div className={`w-2 h-2 rounded-full transition-all duration-300 ${isConnected ? 'bg-[#53fc18] shadow-[0_0_8px_#53fc18]' : 'bg-red-500'}`}></div>
                {isConnected && (
                    <div className="flex items-center gap-1 text-[#53fc18] text-[9px] font-bold uppercase tracking-wider animate-in fade-in zoom-in duration-300">
                        DaVinci
                    </div>
                )}
            </div>
            
            <button 
              onPointerDown={(e) => e.stopPropagation()} 
              onClick={() => setShowSettings(true)} 
              className="text-gray-400 hover:text-white transition-colors cursor-pointer p-1"
            >
                <Settings size={14} />
            </button>

            <button 
              onPointerDown={(e) => e.stopPropagation()} 
              onClick={async () => { await appWindow.close(); }} 
              className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer p-1"
            >
                <X size={16} />
            </button>
        </div>
      </div>

      {/* MODAL DE CONFIGURACIÓN */}
      {showSettings && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#0a0a0f] border border-[#1a1a24] w-full max-w-sm rounded-xl p-5 shadow-2xl flex flex-col gap-4 relative">
                <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white font-bold"><X size={16}/></button>
                <h2 className="text-lg font-bold flex items-center gap-2 mb-2"><Settings size={18} className="text-[#b026ff]"/> Configuración</h2>
                
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"><Search size={12}/> Idioma / Language</label>
                        <select className="bg-[#120529] border border-[#1a1a24] text-white text-sm rounded-lg p-2 outline-none">
                            <option>Español (Latinoamérica)</option>
                            <option>English (US)</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1 mt-2">
                        <label className="text-[10px] font-bold text-[#b026ff] uppercase tracking-wider flex items-center gap-1"><Tv size={12}/> Editor Destino</label>
                        <div className="flex items-center justify-between mt-1 p-3 bg-[#120529] rounded-lg border border-[#1a1a24]">
                            <span className="text-sm font-semibold text-gray-300">Activar Integración con DaVinci</span>
                            <div className="relative inline-block w-10 align-middle select-none transition duration-200 ease-in">
                                <input type="checkbox" id="toggleDaVinci" checked={useDaVinci} onChange={(e) => toggleDaVinci(e.target.checked)} className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 border-gray-600 appearance-none cursor-pointer z-10 transition-all"/>
                                <label htmlFor="toggleDaVinci" className="toggle-label block overflow-hidden h-5 rounded-full bg-gray-600 cursor-pointer transition-colors"></label>
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">Si está desactivado, VeloClips solo exportará los clips de video puros sin generar código para Lua.</p>
                    </div>

                    <div className="h-px w-full bg-[#1a1a24] my-2"></div>

                    <button onClick={() => open("https://github.com/StackSBix29/VeloClips")} className="flex items-center gap-3 p-3 rounded-lg bg-[#0c0c10] border border-[#1a1a24] hover:border-gray-500 transition-colors text-sm font-medium w-full text-left">
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                        Repositorio Oficial (GitHub)
                    </button>
                    
                    <button onClick={() => open("https://ko-fi.com/stacks_bix29")} className="flex items-center gap-3 p-3 rounded-lg bg-[#1a0933] border border-[#b026ff]/30 hover:border-[#b026ff] transition-colors text-sm font-medium text-[#e0b0ff] w-full text-left">
                        <Flame size={18} /> Apoyar el Proyecto (Donaciones)
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* ÁREA PRINCIPAL CON SCROLL */}
      <div className="flex-1 overflow-y-auto relative custom-scrollbar flex flex-col">
        {!activeProfile && !showLibrary && (
          <div className="flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-300 min-h-full">
            <h1 className="text-4xl font-bold mb-3 flex items-center gap-3"><Sparkles className="text-[#b026ff]" size={32} /> VeloClips</h1>
            <p className="text-gray-400 mb-8 text-sm text-center">El puente inteligente entre la IA y tu editor de video.</p>

            <div className="flex gap-4 w-full max-w-xl mb-8">
              <button onClick={handleImportLocalVideo} className="flex-1 py-5 rounded-2xl bg-[#120529] border border-[#b026ff]/50 hover:border-[#b026ff] transition-all flex flex-col items-center justify-center gap-2 group shadow-[0_0_15px_rgba(176,38,255,0.1)]">
                <FileVideo size={28} className="text-[#b026ff] group-hover:-translate-y-1 transition-transform" />
                <span className="text-sm font-bold text-white text-center">Importar Archivo Local</span>
              </button>
              <button onClick={handleOpenLibrary} className="flex-1 py-5 rounded-2xl bg-[#0c0c10] border border-[#1a1a24] hover:border-[#00e5ff]/50 transition-all flex flex-col items-center justify-center gap-2 group hover:shadow-[0_0_20px_rgba(0,229,255,0.1)]">
                <History size={28} className="text-[#00e5ff] group-hover:-translate-y-1 transition-transform" />
                <span className="text-sm font-bold text-white text-center">Proyectos Recientes</span>
              </button>
            </div>

            <div className="w-full max-w-xl flex flex-col gap-3 mb-10">
              <div className="flex-1 flex items-center gap-3 bg-[#0c0c10] border border-[#1a1a24] rounded-xl px-4 py-3 focus-within:border-[#b026ff] transition-colors shadow-inner">
                <Search size={18} className="text-[#b026ff] shrink-0" />
                <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} type="text" placeholder="Pegar URL de Kick, Twitch, YouTube..." className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-gray-600" onKeyDown={(e) => e.key === 'Enter' && handleAddChannel()} />
              </div>
              <button onClick={handleAddChannel} className="bg-[#b026ff] hover:bg-[#c24dff] text-black py-3 rounded-xl font-bold text-sm transition-all shadow-[0_0_20px_rgba(176,38,255,0.3)]">Vincular Canal</button>
            </div>

            {Object.keys(streamers).length > 0 && (
              <div className="w-full max-w-3xl flex flex-col items-center">
                <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-5">Perfiles Guardados</h2>
                <div className="flex flex-wrap justify-center gap-3">
                  {Object.entries(streamers).map(([name, data]: any) => (
                    <div key={name} className="relative group">
                      <button onClick={() => {setActiveProfile(name); fetchVideos(name, data.platform);}} className="px-6 py-3 rounded-2xl border border-[#1a1a24] bg-[#0c0c10] text-gray-300 hover:text-white hover:border-[#b026ff] transition-all flex items-center gap-2 font-bold hover:-translate-y-0.5 pr-12">
                        <Tv size={16} className={data.platform === 'Kick' ? 'text-[#53fc18]' : data.platform === 'YouTube' ? 'text-[#ff0000]' : 'text-[#b026ff]'} /> {name}
                      </button>
                      <button onClick={(e) => handleDeleteChannel(name, e)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* HISTORIAL DE PROYECTOS */}
        {showLibrary && !activeProfile && (
           <div className="flex flex-col p-6 animate-in slide-in-from-right-8 duration-300 min-h-full">
             <button onClick={() => setShowLibrary(false)} className="flex items-center gap-2 text-gray-400 hover:text-[#b026ff] w-max mb-6 transition-colors font-semibold text-sm">
               <ChevronLeft size={16} /> Volver al Inicio
             </button>
             <div className="flex items-center gap-3 mb-6 border-b border-[#1a1a24] pb-4">
                <div className="w-10 h-10 bg-[#001a1f] rounded-lg flex items-center justify-center border border-[#00e5ff]/30"><History size={20} className="text-[#00e5ff]" /></div>
                <div><h1 className="text-xl font-bold leading-none mb-1">Proyectos Recientes</h1><span className="text-xs text-gray-500 font-medium">Continúa editando tus videos marcados</span></div>
             </div>
             {savedProjects.length > 0 ? (
               <div className="grid grid-cols-1 gap-4">
                 {savedProjects.map((proj, i) => (
                     <div key={i} onClick={() => loadProjectFromLibrary(proj)} className="flex flex-col gap-3 p-3 bg-[#0a0a0f] border border-[#1a1a24] rounded-xl hover:border-[#00e5ff] cursor-pointer group transition-all hover:-translate-y-1">
                        <div className="w-full h-12 rounded-lg bg-[#001a1f] border border-[#00e5ff]/20 flex items-center justify-between px-4">
                            <div className="flex items-center gap-2">
                                <FileVideo size={20} className="text-[#00e5ff] opacity-80 group-hover:opacity-100 transition-opacity" />
                                <h3 className="font-bold text-white text-sm truncate max-w-[200px]">{proj.isLocal ? proj.path.split(/[/\\]/).pop() : `VOD: ${proj.id}`}</h3>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] text-gray-400 bg-[#1a1a24] px-2 py-1 rounded">{proj.highlights?.length || 0} Clips</span>
                                <span className="text-[10px] text-[#b026ff] font-bold">{new Date(proj.timestamp).toLocaleDateString()}</span>
                            </div>
                        </div>
                     </div>
                 ))}
               </div>
             ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-gray-600 text-sm gap-3"><History size={40} className="opacity-30" /> No hay proyectos guardados aún.</div>
             )}
           </div>
        )}

        {/* FEED DE VODS DEL PERFIL */}
        {activeProfile && activeProfile !== "Archivo Local" && activeProfile !== "VOD Guardado" && !selectedVideo && !showLibrary && (
          <div className="flex flex-col p-6 animate-in slide-in-from-right-8 duration-300 min-h-full">
            <button onClick={() => setActiveProfile(null)} className="flex items-center gap-2 text-gray-400 hover:text-[#b026ff] w-max mb-6 transition-colors font-semibold text-sm">
              <ChevronLeft size={16} /> Volver a Perfiles
            </button>
            {isLoadingFeed ? (
              <div className="flex flex-col items-center justify-center flex-grow opacity-60 animate-pulse mt-20">
                <RefreshCw className="animate-spin text-[#b026ff] mb-4" size={40} />
                <h3 className="text-white font-bold text-lg mb-2">Conectando...</h3>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {videos.map(vid => (<VideoCard key={vid.id} {...vid} onClick={() => setSelectedVideo(vid.id)} />))}
              </div>
            )}
          </div>
        )}

        {/* MODO EDICIÓN DEL PROYECTO */}
        {activeProfile && (selectedVideo || localVideoPath) && (
          <div className="flex flex-col gap-5 p-4 animate-in slide-in-from-right-8 duration-300">
            <button onClick={() => {setActiveProfile(null); setSelectedVideo(null); setLocalVideoPath(null);}} className="flex items-center gap-2 text-gray-400 hover:text-white w-max transition-colors text-sm font-semibold">
                <ChevronLeft size={16} /> Guardar y Cerrar Proyecto
            </button>

            {/* ZONA DE VIDEO */}
            {localVideoPath ? (
                <div className="rounded-xl overflow-hidden border border-[#b026ff]/30 bg-[#0a0a0f] shadow-[0_0_20px_rgba(176,38,255,0.1)] relative flex items-center justify-center h-48 shrink-0">
                    <video key={localVideoPath} ref={videoPlayerRef} controls src={convertFileSrc(localVideoPath)} className="w-full h-full object-contain outline-none bg-black" preload="auto"/>
                </div>
            ) : (
                <div className="shrink-0"><VideoCard {...activeVideoData} isSelected={true} platform={activeVideoData.platform} videoRef={videoPlayerRef} /></div>
            )}

            {localVideoPath && (
                <button onClick={handleManualMark} className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#1a0933] border border-[#b026ff]/50 hover:border-[#b026ff] hover:bg-[#250d47] text-[#e0b0ff] rounded-lg text-sm font-bold transition-all shadow-sm shrink-0">
                    <BookmarkPlus size={16} /> Añadir Marcador Manual (Este fotograma)
                </button>
            )}

            <div className="h-px w-full bg-[#1a1a24] shrink-0"></div>

            {/* GESTOR DE PLANTILLAS */}
            <div className="bg-[#0c0c10] border border-[#1a1a24] rounded-xl p-4 flex flex-col gap-3 shrink-0">
                <div className="flex justify-between items-end mb-1">
                    <h3 className="text-[10px] font-bold text-[#b026ff] uppercase tracking-wider flex items-center gap-1"><Layers size={12}/> Gestor de Plantillas</h3>
                    <button onClick={() => setIsSavingTemplate(!isSavingTemplate)} className={`text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 transition-all ${isSavingTemplate ? 'bg-[#1a1a24] text-gray-400' : 'bg-[#1a0933] border border-[#b026ff]/50 hover:border-[#b026ff] text-[#e0b0ff]'}`}>
                        {isSavingTemplate ? 'Cancelar' : <><Save size={12}/> Crear Custom</>}
                    </button>
                </div>
                
                {isSavingTemplate && (
                    <div className="flex gap-2 mb-2 animate-in fade-in slide-in-from-top-2 p-2 bg-[#0a0a0f] border border-[#b026ff]/40 rounded-lg">
                        <input type="text" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="Ej: Mi Duo de Warzone" className="w-full bg-[#120529] border border-[#b026ff]/50 focus:border-[#b026ff] text-white text-xs rounded px-2 py-1.5 outline-none" />
                        <button onClick={handleSaveTemplate} className="bg-gradient-to-r from-[#b026ff] to-[#c24dff] text-white font-bold px-3 py-1.5 rounded text-xs shadow-md">Guardar</button>
                    </div>
                )}

                <select 
                  value={preset} 
                  onChange={(e) => setPreset(e.target.value)} 
                  className="w-full bg-[#120529] border border-[#b026ff] text-[#e0b0ff] text-sm font-bold rounded-lg p-2.5 outline-none cursor-pointer shadow-[0_0_15px_rgba(176,38,255,0.15)]"
                >
                    {allTemplates.map((t, idx) => <option key={idx} value={t.value} className="bg-[#0c0c10] text-white">{t.name}</option>)}
                </select>

                <div className="flex items-center justify-between mt-1 p-2 bg-[#050508] rounded-lg border border-[#1a1a24]">
                    <span className="text-[11px] font-semibold text-gray-300">Aplicar Efectos Visuales (Overlay .drb)</span>
                    <div className="relative inline-block w-8 mr-1 align-middle select-none transition duration-200 ease-in">
                        <input type="checkbox" id="toggleOverlay" checked={useOverlay} onChange={() => setUseOverlay(!useOverlay)} className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 border-gray-600 appearance-none cursor-pointer z-10 transition-all"/>
                        <label htmlFor="toggleOverlay" className="toggle-label block overflow-hidden h-4 rounded-full bg-gray-600 cursor-pointer transition-colors"></label>
                    </div>
                </div>

                {needsFaceScan && (
                    <div className="flex flex-col gap-2 mt-2 animate-in fade-in">
                        <button onClick={handleScanFaces} disabled={isAnalyzing} className={`w-full py-2.5 border text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${faces.length > 0 ? 'bg-[#050508] border-[#1a1a24] text-gray-400 hover:text-white hover:border-[#b026ff]' : 'bg-[#1a0933] border-[#b026ff] text-[#e0b0ff] shadow-[0_0_15px_rgba(176,38,255,0.2)]'}`}>
                            <Crosshair size={14} /> {faces.length > 0 ? 'Volver a Detectar Rostros' : 'Detectar Rostros (Obligatorio)'}
                        </button>
                    </div>
                )}
            </div>

            {/* SECCIÓN DE CLIPS Y AJUSTES */}
            <div className="flex flex-col gap-3">
                <div className="bg-[#0c0c10] border border-[#1a1a24] rounded-xl p-4">
                    <h3 className="text-[10px] font-bold text-[#00e5ff] uppercase tracking-wider mb-4 flex items-center gap-1"><Scissors size={12}/> Lógica de Recorte</h3>
                    <ControlSlider label="Duración por Clip (segundos)" value={clipDuration} min={10} max={180} onChange={(v:any) => setClipDuration(v)} />
                    <ControlSlider label="Cantidad Máxima de Clips" value={maxClips} min={1} max={30} onChange={(v:any) => setMaxClips(v)} />
                </div>

                <div className="flex items-center justify-between mb-1 mt-2">
                    <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2"><Flame size={16} className="text-[#b026ff]"/> Mapa de Calor (IA)</h2>
                    {!isAnalyzing && (
                        <button onClick={checkAndAnalyze} className="flex items-center gap-1.5 px-2.5 py-1 bg-[#0c0c10] border border-[#1a1a24] hover:border-[#b026ff] rounded text-[10px] font-bold text-gray-400 hover:text-white transition-all shadow-sm">
                            <RefreshCw size={10} /> Re-Escanear
                        </button>
                    )}
                </div>
                
                <div className="flex flex-col gap-1">
                    {isAnalyzing ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-6">
                            <div className="w-full max-w-[200px] bg-[#0c0c10] border border-[#1a1a24] rounded-full h-3 overflow-hidden relative shadow-inner">
                                <div className="h-full bg-gradient-to-r from-[#b026ff] to-[#53fc18] transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#b026ff] animate-pulse">{progressPhase}</span>
                        </div>
                    ) : highlights.length > 0 ? (
                        highlights.map((h, i) => (<HighlightCard key={i} title={h.title} score={h.score} time={h.time} />))
                    ) : (
                        <div className="text-center text-gray-500 text-xs py-4 border border-dashed border-[#1a1a24] rounded-lg">Ajusta los parámetros para detectar clips.</div>
                    )}
                </div>
            </div>

            {/* BOTÓN RENDER */}
            <div className="mt-4 shrink-0 pb-4">
                <button 
                    onClick={isAnalyzing ? undefined : handleApplyToDaVinci} 
                    disabled={!canRender}
                    className={`w-full font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg ${canRender ? 'bg-gradient-to-r from-[#b026ff] to-[#c24dff] text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(176,38,255,0.3)]' : 'bg-[#1a1a24] text-gray-500 cursor-not-allowed border border-[#2a2a35]'}`}
                >
                    {isAnalyzing ? <RefreshCw className="animate-spin" size={18} /> : (!canRender && needsFaceScan ? <Flame size={18} /> : <Download size={18} />)}
                    {isAnalyzing ? 'Procesando...' : (!canRender && needsFaceScan ? 'Requiere Detección Facial' : (useDaVinci && isConnected ? 'Renderizar a DaVinci' : 'Exportar Clips Crudos'))}
                </button>
            </div>
            
            <div className="fixed bottom-0 left-0 w-full h-8 bg-[#050508] border-t border-[#1a1a24] flex items-center px-4 gap-2 z-40">
                <CheckCircle2 size={12} className={statusMsg.includes('❌') ? 'text-red-500' : 'text-[#53fc18]'} />
                <span className="text-[10px] text-gray-400 font-medium truncate">{statusMsg}</span>
            </div>
            <div className="h-8"></div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}