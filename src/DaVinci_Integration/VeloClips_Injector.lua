-- ==========================================================
-- 🚀 AUTO-LANZADOR DE VELOCLIPS
-- ==========================================================
local programFiles = os.getenv("PROGRAMFILES")
local localAppData = os.getenv("LOCALAPPDATA")

-- Posibles rutas donde Tauri instala el .exe en Windows
-- *Nota: Si tu ejecutable se llama diferente, cámbialo aquí.
local path1 = programFiles .. "\\veloclips\\veloclips.exe"
local path2 = localAppData .. "\\veloclips\\veloclips.exe"

-- Comando para abrir la app (intenta ambas rutas y silencia errores si falla)
local cmd = 'start "" "' .. path1 .. '" 2>nul || start "" "' .. path2 .. '" 2>nul'
os.execute(cmd)
-- =====================================================================
-- VeloClips_Injector.lua (Cero Gaps - Lectura Real de Timeline)
-- =====================================================================

local function getWorkspacePath()
    local handle = io.popen('powershell -NoProfile -Command "[Environment]::GetFolderPath(\'MyDocuments\')"')
    if handle then
        local docsPath = handle:read("*a")
        handle:close()
        docsPath = docsPath:gsub("^%s*(.-)%s*$", "%1")
        if docsPath ~= "" then
            return docsPath .. "\\VeloClips_Workspace\\"
        end
    end
    local userProfile = os.getenv("USERPROFILE") or "C:"
    return userProfile .. "\\Documents\\VeloClips_Workspace\\"
end

local workspacePath = getWorkspacePath()
local dataFile = workspacePath .. "Exports\\VeloClips_Data.txt"
local lockFile = workspacePath .. "Exports\\VeloClips_Data.lock"
local templatesPath = workspacePath .. "Templates\\"

local myResolve = resolve
if not myResolve then myResolve = bmd.scriptapp("Resolve") end
if not myResolve then return print("❌ Error crítico: Sin conexión a DaVinci Resolve.") end

local projectManager = myResolve:GetProjectManager()
local mediaStorage = myResolve:GetMediaStorage()

local function trim(s) return s and s:match("^%s*(.-)%s*$") or "" end
local function splitData(inputstr, sep)
    local t = {}
    for str in string.gmatch(inputstr, "([^"..sep.."]+)") do 
        table.insert(t, trim(str)) 
    end
    return t
end

local function silent_sleep(seconds)
    local success, socket = pcall(require, "socket")
    if success and socket and socket.sleep then socket.sleep(seconds)
    else local t0 = os.clock(); while os.clock() - t0 <= seconds do end end
end

local function buscarClipEnCarpetas(folder, nombreDestino)
    if not folder then return nil end
    local clips = folder:GetClipList()
    for _, clip in ipairs(clips) do
        local clipName = clip:GetName()
        local cleanClipName = clipName:match("(.+)%..+") or clipName
        local cleanDestino = nombreDestino:match("(.+)%..+") or nombreDestino
        
        if string.lower(cleanClipName) == string.lower(cleanDestino) then
            return clip
        end
    end
    local subFolders = folder:GetSubFolderList()
    for _, sub in ipairs(subFolders) do
        local encontrado = buscarClipEnCarpetas(sub, nombreDestino)
        if encontrado then return encontrado end
    end
    return nil
end

print("\n\n🧹 VeloClips Detector activo y escuchando en: " .. workspacePath)

local f = io.open(lockFile, "r")
if f then f:close(); os.remove(lockFile) end

while true do
    if os.rename(dataFile, lockFile) then
        local file = io.open(lockFile, "r")
        if file then
            local clipsData = {}
            local formatoGeneral = "Vertical" 
            local requiereCamaraGlobal = false
            
            for line in file:lines() do
                local cleanedLine = trim(line)
                if cleanedLine ~= "" then
                    local parts = splitData(cleanedLine, "|")
                    local rutaVideoFinal = parts[1] or ""
                    local templateName = parts[2] or "NINGUNO"
                    local formato = parts[3] or "Vertical"
                    local tieneCamara = (trim(string.lower(parts[4] or "false")) == "true")
                    local fX = tonumber(parts[5]) or 0
                    local fY = tonumber(parts[6]) or 0
                    local fZoom = tonumber(parts[7]) or 1.0

                    if tieneCamara then requiereCamaraGlobal = true end

                    table.insert(clipsData, { 
                        path = rutaVideoFinal, 
                        template = templateName, 
                        formato = formato, 
                        hasCam = tieneCamara,
                        faceX = fX, 
                        faceY = fY, 
                        faceZoom = fZoom
                    })
                    formatoGeneral = formato
                end
            end
            file:close()
            os.remove(lockFile)

            local project = projectManager:GetCurrentProject()
            if project then
                local mediaPool = project:GetMediaPool()
                local rootFolder = mediaPool:GetRootFolder()
                local projectFps = tonumber(project:GetSetting("timelineFrameRate")) or 60
                
                mediaPool:SetCurrentFolder(rootFolder)

                local clipDeEfectoGlobal = nil
                local requiereEfecto = false
                local nombreEfectoEsperado = "Efecto_Blur"
                local archivoTemplate = ""
                
                for _, data in ipairs(clipsData) do
                    if string.upper(data.template) ~= "NINGUNO" then 
                        requiereEfecto = true 
                        archivoTemplate = data.template
                        nombreEfectoEsperado = data.template:match("([^/\\]+)%.drb$") or data.template
                        if nombreEfectoEsperado == "Plantillas" then nombreEfectoEsperado = "Efecto_Blur" end
                        break 
                    end
                end

                if requiereEfecto then
                    local rutaDRB = templatesPath .. archivoTemplate
                    print("\n📂 Efecto detectado. Forzando importación de: " .. rutaDRB)
                    
                    local success = mediaPool:ImportFolderFromFile(rutaDRB)
                    if success then silent_sleep(3) end
                    clipDeEfectoGlobal = buscarClipEnCarpetas(rootFolder, nombreEfectoEsperado)
                end

                local timelineName = "VeloClips_Lote_" .. os.date("%H%M%S")
                local timeline = mediaPool:CreateEmptyTimeline(timelineName)
                if not timeline then timeline = project:GetCurrentTimeline() end
                project:SetCurrentTimeline(timeline)

                if formatoGeneral == "Vertical" then
                    project:SetSetting("timelineResolutionWidth", "1080")
                    project:SetSetting("timelineResolutionHeight", "1920")
                    project:SetSetting("timelineUseVerticalResolution", "1")
                else
                    project:SetSetting("timelineResolutionWidth", "1920")
                    project:SetSetting("timelineResolutionHeight", "1080")
                    project:SetSetting("timelineUseVerticalResolution", "0")
                end

                local trackCamara = requiereCamaraGlobal and 2 or nil
                local trackEfecto = requiereCamaraGlobal and 3 or 2
                local targetTracks = requiereCamaraGlobal and 3 or (requiereEfecto and 2 or 1)
                
                local trackCount = timeline:GetTrackCount("video")
                while trackCount < targetTracks do
                    timeline:AddTrack("video")
                    trackCount = timeline:GetTrackCount("video")
                end
                
                local successCount = 0
                
                -- Inicio de línea de tiempo robusto
                local startFrame = 0
                if timeline.GetStartFrame then
                    startFrame = timeline:GetStartFrame()
                else
                    startFrame = 3600 * projectFps 
                end
                local currentFrame = startFrame

                -- INSERCIÓN UNO POR UNO CON LECTURA DE ESPACIO REAL
                for _, data in ipairs(clipsData) do
                    print("\n📥 Procesando Video: " .. data.path)
                    
                    local mediaList = mediaStorage:AddItemListToMediaPool({data.path})
                    if not mediaList or #mediaList == 0 then
                        local rutaAlternativa = data.path:gsub("/", "\\")
                        mediaList = mediaStorage:AddItemListToMediaPool({rutaAlternativa})
                    end

                    if mediaList and #mediaList > 0 then
                        local videoClip = mediaList[1]
                        
                        -- 1. PISTA 1: El Gameplay manda. Lo metemos completo sin restricciones.
                        local items1 = mediaPool:AppendToTimeline({{
                            mediaPoolItem = videoClip, 
                            trackIndex = 1, 
                            recordFrame = currentFrame
                        }})
                        
                        -- Le preguntamos a DaVinci EXACTAMENTE dónde quedó
                        local realStart = currentFrame
                        local realEnd = currentFrame + (projectFps * 60) 
                        
                        if items1 and #items1 > 0 then
                            realStart = items1[1]:GetStart()
                            realEnd = items1[1]:GetEnd()
                            print("   🎬 Gameplay insertado de " .. realStart .. " a " .. realEnd)
                        else
                            print("❌ Error: DaVinci ignoró la pista 1.")
                        end
                        
                        local duracionTimeline = realEnd - realStart
                        
                        -- 2. PISTA 2: Facecam. Lo clavamos en 'realStart'.
                        if data.hasCam and trackCamara then
                            local itemsCam = mediaPool:AppendToTimeline({{
                                mediaPoolItem = videoClip, 
                                trackIndex = trackCamara, 
                                recordFrame = realStart,
                                mediaType = 1 
                            }})
                            
                            if itemsCam and #itemsCam > 0 then
                                local faceItem = itemsCam[1]
                                faceItem:SetProperty("Pan", data.faceX)
                                faceItem:SetProperty("Tilt", data.faceY)
                                faceItem:SetProperty("ZoomX", data.faceZoom)
                                faceItem:SetProperty("ZoomY", data.faceZoom)
                                print("   📸 Facecam montada perfectamente encima.")
                            end
                        end
                        
                        -- 3. PISTA 3: Efecto Blur. Lo forzamos a medir 'duracionTimeline'.
                        if string.upper(data.template) ~= "NINGUNO" and clipDeEfectoGlobal then
                            mediaPool:AppendToTimeline({{
                                mediaPoolItem = clipDeEfectoGlobal, 
                                startFrame = 0, 
                                endFrame = duracionTimeline, 
                                trackIndex = trackEfecto, 
                                recordFrame = realStart,
                                mediaType = 1
                            }})
                            print("   ✨ Plantilla Blur estirada a la medida.")
                        end
                        
                        -- Avanzamos el cabezal justo donde terminó todo
                        currentFrame = realEnd
                        successCount = successCount + 1
                    else
                        print("❌ Error crítico: DaVinci no pudo mapear el archivo de video.")
                    end
                end

                print("🏁 Lote procesado con éxito: " .. successCount .. " clips ensamblados sin espacios.")
            else
                print("❌ Error: No hay ningún proyecto abierto en DaVinci Resolve.")
            end
        end
    end
    silent_sleep(1)
end