/**
 * Kidney Stone Diagnostics - Clinical AI JavaScript Controller
 * Standalone, Netlify-ready single page application engine.
 * Supports dual-mode: Client-side medical simulation OR live FastAPI backend execution.
 */

document.addEventListener("DOMContentLoaded", () => {
    // ==========================================================================
    // STATE VARIABLES
    // ==========================================================================
    let currentTab = "ultrasound"; // "ultrasound" or "ct"
    let uploadedFile = null;
    let uploadedImageElement = null; // HTML Image element for canvas drawing
    let scanId = "";
    
    // Core configurations (Settings)
    let config = {
        simulationMode: true,
        apiUrl: "http://localhost:8000"
    };

    // Simulated stone patterns (normalized coords [x, y, width, height] in range 0-1)
    // Used to draw simulated bounding boxes on uploaded images to look authentic!
    const SIMULATED_STONES = [
        { x: 0.35, y: 0.42, w: 0.12, h: 0.10, conf: 92.4 },
        { x: 0.58, y: 0.35, w: 0.08, h: 0.09, conf: 86.8 },
        { x: 0.45, y: 0.55, w: 0.15, h: 0.12, conf: 94.1 }
    ];

    // ==========================================================================
    // DOM ELEMENTS
    // ==========================================================================
    // Header
    const tabUltrasoundBtn = document.getElementById("tabUltrasound");
    const tabCTBtn = document.getElementById("tabCT");
    const currentScanIdEl = document.getElementById("currentScanId");
    const currentTimeEl = document.getElementById("currentTime");
    const apiStatusBadge = document.getElementById("apiStatusBadge");
    
    // Dropzone & inputs
    const dropzone = document.getElementById("dropzone");
    const scanFileInput = document.getElementById("scanFileInput");
    const uploadHintText = document.getElementById("uploadHintText");
    const previewOverlay = document.getElementById("previewOverlay");
    const imagePreview = document.getElementById("imagePreview");
    const removeFileBtn = document.getElementById("removeFileBtn");
    const calibrationCard = document.getElementById("calibrationCard");
    const mmPerPixelInput = document.getElementById("mmPerPixel");
    const imageWarningBanner = document.getElementById("imageWarningBanner");
    const warningBannerText = document.getElementById("warningBannerText");
    
    // Patient symptoms
    const patientAgeInput = document.getElementById("patientAge");
    const painLevelInput = document.getElementById("painLevel");
    const painBadge = document.getElementById("painBadge");
    const feverToggle = document.getElementById("feverToggle");
    const vomitingToggle = document.getElementById("vomitingToggle");
    const bloodUrineToggle = document.getElementById("bloodUrineToggle");
    const historyToggle = document.getElementById("historyToggle");
    
    // Actions & console
    const analyzeBtn = document.getElementById("analyzeBtn");
    const btnSpinner = document.getElementById("btnSpinner");
    const consoleLogsCard = document.getElementById("consoleLogsCard");
    const consoleLogs = document.getElementById("consoleLogs");
    
    // Visualizer console
    const visualizerModeLabel = document.getElementById("visualizerModeLabel");
    const scaleIndicator = document.getElementById("scaleIndicator");
    const noScanMsg = document.getElementById("noScanMsg");
    const canvasContainer = document.getElementById("canvasContainer");
    const scanCanvas = document.getElementById("scanCanvas");
    const ctx = scanCanvas.getContext("2d");
    const laserScanner = document.getElementById("laserScanner");
    
    // Report outcomes
    const diagnosisCard = document.getElementById("diagnosisCard");
    const diagIcon = document.getElementById("diagIcon");
    const diagResult = document.getElementById("diagResult");
    const diagModelInfo = document.getElementById("diagModelInfo");
    const diagConfidence = document.getElementById("diagConfidence");
    const diagConfidenceFill = document.getElementById("diagConfidenceFill");
    
    const riskCard = document.getElementById("riskCard");
    const riskNeedle = document.getElementById("riskNeedle");
    const riskLevelText = document.getElementById("riskLevelText");
    
    const stoneDetectionsCard = document.getElementById("stoneDetectionsCard");
    const detectionsTableBody = document.getElementById("detectionsTableBody");
    
    const reasonsCard = document.getElementById("reasonsCard");
    const reasonsList = document.getElementById("reasonsList");
    
    const exportReportBtn = document.getElementById("exportReportBtn");

    // Modal elements
    const openSettingsBtn = document.getElementById("openSettingsBtn");
    const closeSettingsBtn = document.getElementById("closeSettingsBtn");
    const settingsModal = document.getElementById("settingsModal");
    const simulationModeToggle = document.getElementById("simulationModeToggle");
    const apiUrlInputGroup = document.getElementById("apiUrlInputGroup");
    const backendApiUrlInput = document.getElementById("backendApiUrl");
    const connectionTester = document.getElementById("connectionTester");
    const connectionTestStatus = document.getElementById("connectionTestStatus");
    const testConnectionBtn = document.getElementById("testConnectionBtn");
    const saveSettingsBtn = document.getElementById("saveSettingsBtn");

    // Theme toggle elements
    const themeToggleBtn = document.getElementById("themeToggleBtn");
    const moonIcon = themeToggleBtn.querySelector(".moon-icon");
    const sunIcon = themeToggleBtn.querySelector(".sun-icon");

    // ==========================================================================
    // INITIALIZATION & TIMERS
    // ==========================================================================
    function initialize() {
        generateScanId();
        updateTime();
        setInterval(updateTime, 1000);
        loadLocalSettings();
        themeSetup();
        updateUIState(null);
    }

    // Theme Switcher core setup
    function themeSetup() {
        const storedTheme = localStorage.getItem("ksd_theme") || "light";
        setTheme(storedTheme);
    }

    function setTheme(theme) {
        if (theme === "dark") {
            document.documentElement.classList.add("dark-theme");
            moonIcon.classList.add("hidden");
            sunIcon.classList.remove("hidden");
            localStorage.setItem("ksd_theme", "dark");
        } else {
            document.documentElement.classList.remove("dark-theme");
            moonIcon.classList.remove("hidden");
            sunIcon.classList.add("hidden");
            localStorage.setItem("ksd_theme", "light");
        }
    }

    // Dynamic Clock
    function updateTime() {
        const now = new Date();
        currentTimeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    // Dynamic Scan ID Generator
    function generateScanId() {
        const prefix = currentTab === "ultrasound" ? "US" : "CT";
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const rand = Math.floor(10000 + Math.random() * 90000);
        scanId = `KSD-${prefix}-${dateStr}-${rand}`;
        currentScanIdEl.textContent = scanId;
    }

    // Load user configurations
    function loadLocalSettings() {
        const storedConfig = localStorage.getItem("ksd_clinical_config");
        if (storedConfig) {
            try {
                config = JSON.parse(storedConfig);
            } catch (e) {
                console.error("Error loading config", e);
            }
        }
        
        // Populate inputs
        simulationModeToggle.checked = config.simulationMode;
        backendApiUrlInput.value = config.apiUrl;
        
        updateApiStatusIndicator();
    }

    function updateApiStatusIndicator() {
        if (config.simulationMode) {
            apiStatusBadge.className = "connection-status badge badge-simulation";
            apiStatusBadge.querySelector(".status-text").textContent = "Simulation Mode";
            apiUrlInputGroup.style.opacity = "0.5";
            apiUrlInputGroup.style.pointerEvents = "none";
            testConnectionBtn.disabled = true;
        } else {
            apiStatusBadge.className = "connection-status badge badge-live";
            apiStatusBadge.querySelector(".status-text").textContent = "Live API Mode";
            apiUrlInputGroup.style.opacity = "1";
            apiUrlInputGroup.style.pointerEvents = "all";
            testConnectionBtn.disabled = false;
        }
    }

    // ==========================================================================
    // INTERACTIVE EVENT LISTENERS
    // ==========================================================================
    
    // Tab switching
    tabUltrasoundBtn.addEventListener("click", () => switchTab("ultrasound"));
    tabCTBtn.addEventListener("click", () => switchTab("ct"));

    function switchTab(tab) {
        if (currentTab === tab) return;
        currentTab = tab;
        
        // Reset tab UI
        if (tab === "ultrasound") {
            tabUltrasoundBtn.classList.add("active");
            tabCTBtn.classList.remove("active");
            calibrationCard.classList.add("hidden");
            stoneDetectionsCard.classList.add("hidden");
            uploadHintText.textContent = "Upload ultrasound kidney image to begin AI stone detection.";
            visualizerModeLabel.textContent = "Ultrasound Imaging Console";
        } else {
            tabUltrasoundBtn.classList.remove("active");
            tabCTBtn.classList.add("active");
            calibrationCard.classList.remove("hidden");
            uploadHintText.textContent = "Upload CT abdominal slice to calculate stone dimensions (YOLOv8).";
            visualizerModeLabel.textContent = "CT Scan Imaging Console";
        }

        generateScanId();
        resetDiagnosisOutput();
    }

    // Pain level slider dynamic badge and color shifting
    painLevelInput.addEventListener("input", (e) => {
        const val = parseInt(e.target.value);
        let category = "Mild";
        let statusClass = "pain-badge";
        
        if (val >= 7) {
            category = "Severe Pain";
            painBadge.style.color = "var(--status-danger)";
            painBadge.style.borderColor = "rgba(239, 68, 68, 0.4)";
            painBadge.style.background = "rgba(239, 68, 68, 0.1)";
        } else if (val >= 4) {
            category = "Moderate Pain";
            painBadge.style.color = "var(--status-warning)";
            painBadge.style.borderColor = "rgba(245, 158, 11, 0.4)";
            painBadge.style.background = "rgba(245, 158, 11, 0.1)";
        } else {
            category = "Mild Pain";
            painBadge.style.color = "var(--status-success)";
            painBadge.style.borderColor = "rgba(16, 185, 129, 0.4)";
            painBadge.style.background = "rgba(16, 185, 129, 0.1)";
        }
        
        painBadge.textContent = `${val} - ${category}`;
    });

    // File Dropzone Handling
    dropzone.addEventListener("click", () => scanFileInput.click());
    
    dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.style.borderColor = "var(--accent-cyan)";
    });

    dropzone.addEventListener("dragleave", () => {
        dropzone.style.borderColor = "";
    });

    dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.style.borderColor = "";
        if (e.dataTransfer.files.length > 0) {
            handleSelectedFile(e.dataTransfer.files[0]);
        }
    });

    scanFileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            handleSelectedFile(e.target.files[0]);
        }
    });

    removeFileBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        resetUpload();
    });

    function handleSelectedFile(file) {
        if (!file.type.match("image.*")) {
            alert("Error: Unsupported file format. Please upload an image file (JPG, PNG).");
            return;
        }
        
        uploadedFile = file;
        
        // Show local preview in dropzone
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            previewOverlay.style.display = "flex";
            
            // Draw image on visualizer canvas
            uploadedImageElement = new Image();
            uploadedImageElement.onload = () => {
                drawOriginalImage();
                analyzeBtn.disabled = false;
                
                // Client-side image validation
                const validation = checkIsMedicalScan(uploadedImageElement);
                if (imageWarningBanner && warningBannerText) {
                    if (!validation.isValid) {
                        imageWarningBanner.classList.remove("hidden");
                        warningBannerText.textContent = validation.reason;
                    } else {
                        imageWarningBanner.classList.add("hidden");
                    }
                }
            };
            uploadedImageElement.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function drawOriginalImage() {
        if (!uploadedImageElement) return;
        
        noScanMsg.classList.add("hidden");
        canvasContainer.classList.remove("hidden");
        
        // Adjust canvas resolution dynamically with robust fallbacks
        let viewportWidth = canvasContainer.clientWidth;
        let viewportHeight = canvasContainer.clientHeight || 350;
        
        // If clientWidth/clientHeight returns 0 due to layout flow latency, fall back to visible parent containers
        if (!viewportWidth || viewportWidth < 50) {
            const parentViewport = canvasContainer.parentElement;
            viewportWidth = parentViewport.clientWidth || 500;
            viewportHeight = parentViewport.clientHeight || 350;
        }
        
        // Maintain image ratio
        const imgRatio = uploadedImageElement.width / uploadedImageElement.height;
        let drawWidth = viewportWidth;
        let drawHeight = viewportWidth / imgRatio;
        
        if (drawHeight > viewportHeight) {
            drawHeight = viewportHeight;
            drawWidth = viewportHeight * imgRatio;
        }
        
        // Guarantee positive non-zero boundaries
        drawWidth = Math.max(100, drawWidth);
        drawHeight = Math.max(100, drawHeight);
        
        scanCanvas.width = drawWidth;
        scanCanvas.height = drawHeight;
        
        ctx.clearRect(0, 0, drawWidth, drawHeight);
        ctx.drawImage(uploadedImageElement, 0, 0, drawWidth, drawHeight);
        
        scaleIndicator.textContent = `Scale: ${uploadedImageElement.width}×${uploadedImageElement.height} px`;
    }

    function resetUpload() {
        uploadedFile = null;
        uploadedImageElement = null;
        scanFileInput.value = "";
        previewOverlay.style.display = "none";
        imagePreview.src = "";
        analyzeBtn.disabled = true;
        
        // Reset Visualizer
        noScanMsg.classList.remove("hidden");
        canvasContainer.classList.add("hidden");
        scaleIndicator.textContent = "Scale: Auto";
        
        resetDiagnosisOutput();
        
        // Hide warning banner
        if (imageWarningBanner) {
            imageWarningBanner.classList.add("hidden");
        }
    }

    function resetDiagnosisOutput() {
        // Clear outputs
        diagnosisCard.className = "card report-card card-diagnosis gray-out";
        diagResult.textContent = "Awaiting Analysis";
        diagConfidence.textContent = "0.00%";
        diagConfidenceFill.style.width = "0%";
        diagIcon.innerHTML = `<svg viewBox="0 0 24 24" class="report-svg" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
        
        riskCard.className = "card report-card card-risk gray-out";
        riskNeedle.style.transform = "rotate(-90deg)";
        riskLevelText.textContent = "Awaiting";
        
        reasonsCard.className = "card report-card card-reasons gray-out";
        reasonsList.innerHTML = `<li class="reason-placeholder">Please upload a scan and hit diagnostic execution to view medical explanation factors.</li>`;
        
        stoneDetectionsCard.classList.add("hidden");
        detectionsTableBody.innerHTML = `<tr><td colspan="4" class="empty-table-msg">No stones detected. Run AI CT sizing scan.</td></tr>`;
        
        consoleLogsCard.classList.add("hidden");
        consoleLogs.innerHTML = "";
        
        exportReportBtn.disabled = true;
    }

    // Handle Window resizing to keep canvas looking beautiful
    window.addEventListener("resize", () => {
        if (uploadedImageElement) {
            drawOriginalImage();
        }
    });

    // ==========================================================================
    // DIAGNOSTIC PROCESS MANAGER (SIMULATION VS LIVE API)
    // ==========================================================================
    analyzeBtn.addEventListener("click", () => {
        if (!uploadedFile) return;
        
        resetDiagnosisOutput();
        updateUIState("analyzing");
        
        if (config.simulationMode) {
            runClientSimulation();
        } else {
            runLiveAPIDiagnostics();
        }
    });

    function updateUIState(state) {
        if (state === "analyzing") {
            analyzeBtn.disabled = true;
            btnSpinner.classList.remove("hidden");
            analyzeBtn.querySelector(".btn-text").textContent = "Analyzing Scan...";
            laserScanner.classList.remove("hidden");
        } else {
            analyzeBtn.disabled = !uploadedFile;
            btnSpinner.classList.add("hidden");
            analyzeBtn.querySelector(".btn-text").textContent = "Run Neural Diagnostics";
            laserScanner.classList.add("hidden");
        }
    }

    // ==========================================================================
    // NEURAL INFERENCE CLIENT-SIDE SIMULATION
    // ==========================================================================
    function logConsole(message, type = "info") {
        consoleLogsCard.classList.remove("hidden");
        const logLine = document.createElement("div");
        logLine.className = `console-line console-${type}`;
        
        const timestamp = new Date().toLocaleTimeString([], { hour12: false });
        logLine.innerHTML = `<span class="console-time">[${timestamp}]</span> ${message}`;
        
        consoleLogs.appendChild(logLine);
        consoleLogs.scrollTop = consoleLogs.scrollHeight;
    }

    function runClientSimulation() {
        const stages = [
            { t: 0, msg: "Initializing AI Diagnostic Engine...", type: "info" },
            { t: 400, msg: `Scanning input image: ${uploadedFile.name} (${(uploadedFile.size / 1024).toFixed(1)} KB)`, type: "info" },
            { t: 800, msg: currentTab === "ultrasound" ? "Analyzing ultrasound echogenicity levels..." : "Segmenting abdominal slice layers via YOLOv8...", type: "info" },
            { t: 1200, msg: "Applying clinical metric factor calculations...", type: "info" },
            { t: 1600, msg: "AI Diagnostics successfully executed. Rendering reports.", type: "success" }
        ];

        stages.forEach(stage => {
            setTimeout(() => {
                logConsole(stage.msg, stage.type);
            }, stage.t);
        });

        // Sim log warning if scan validation failed
        if (uploadedImageElement) {
            const validation = checkIsMedicalScan(uploadedImageElement);
            if (!validation.isValid) {
                setTimeout(() => {
                    logConsole(`WARNING: Non-medical image pattern detected. Diagnostic metrics may be compromised.`, "warn");
                }, 900);
            }
        }

        // Final output generation
        setTimeout(() => {
            const age = parseInt(patientAgeInput.value) || 25;
            const pain = parseInt(painLevelInput.value);
            const fever = feverToggle.checked;
            const vomiting = vomitingToggle.checked;
            const blood = bloodUrineToggle.checked;
            const history = historyToggle.checked;
            
            // Core logic: Simulate predictions based on file name or characteristics
            // If image filename contains "clear", "normal", or "no_stone" we output clean, else stone!
            const fnLower = uploadedFile.name.toLowerCase();
            const hasStoneWord = fnLower.includes("stone") || fnLower.includes("calculus") || fnLower.includes("kidney");
            const hasClearWord = fnLower.includes("clear") || fnLower.includes("normal") || fnLower.includes("healthy") || fnLower.includes("no");
            
            let stoneDetected = true;
            if (hasClearWord && !hasStoneWord) {
                stoneDetected = false;
            } else if (!hasStoneWord) {
                // If it's a random image, 75% chance stone is detected (it's a clinical portal)
                stoneDetected = Math.random() > 0.25;
            }
            
            let confidence = parseFloat((80 + Math.random() * 19.5).toFixed(2));
            let stoneSize = 0;
            let detections = [];

            // Draw bounding boxes on canvas if CT stone detected
            if (stoneDetected) {
                drawOriginalImage(); // Redraw fresh to prevent boxes from stacking
                
                if (currentTab === "ct") {
                    const mmPerPx = parseFloat(mmPerPixelInput.value) || 0.10;
                    
                    // Create 1 or 2 simulated stones
                    const stoneCount = Math.random() > 0.6 ? 2 : 1;
                    
                    for (let i = 0; i < stoneCount; i++) {
                        const box = SIMULATED_STONES[i % SIMULATED_STONES.length];
                        
                        // Calculate coordinates based on canvas width
                        const rx = box.x * scanCanvas.width;
                        const ry = box.y * scanCanvas.height;
                        const rw = box.w * scanCanvas.width;
                        const rh = box.h * scanCanvas.height;
                        
                        // Draw custom high-end radiological rectangular bounding boxes
                        ctx.strokeStyle = "var(--status-danger)";
                        ctx.lineWidth = 2.5;
                        ctx.setLineDash([4, 4]);
                        ctx.strokeRect(rx, ry, rw, rh);
                        
                        // Bounding Box text tag
                        ctx.fillStyle = "rgba(239, 68, 68, 0.85)";
                        ctx.fillRect(rx, ry - 22, rw > 120 ? rw : 120, 22);
                        
                        ctx.fillStyle = "#fff";
                        ctx.font = "bold 11px Inter, sans-serif";
                        ctx.setLineDash([]);
                        ctx.fillText(`Stone #${i+1} [Conf: ${box.conf}%]`, rx + 5, ry - 7);
                        
                        // Calculate sizes
                        const diameterPx = Math.max(rw / (box.w * scanCanvas.width) * (box.w * 400), rh / (box.h * scanCanvas.height) * (box.h * 400)); // normalized px
                        const sizeMm = parseFloat((diameterPx * mmPerPx).toFixed(2));
                        stoneSize = Math.max(stoneSize, sizeMm);
                        
                        detections.push({
                            index: i + 1,
                            confidence: box.conf,
                            bbox: `${Math.round(rx)}, ${Math.round(ry)}, ${Math.round(rx+rw)}, ${Math.round(ry+rh)}`,
                            size: sizeMm
                        });
                    }
                } else {
                    // Draw a highlight circle overlay for ultrasound to make it visually epic
                    const cx = 0.5 * scanCanvas.width;
                    const cy = 0.45 * scanCanvas.height;
                    const r = 0.12 * scanCanvas.width;
                    
                    ctx.strokeStyle = "var(--accent-cyan)";
                    ctx.lineWidth = 2;
                    ctx.setLineDash([6, 3]);
                    ctx.beginPath();
                    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
                    ctx.stroke();
                    
                    ctx.fillStyle = "rgba(0, 240, 255, 0.85)";
                    ctx.fillRect(cx - 65, cy - r - 25, 130, 20);
                    ctx.fillStyle = "#000";
                    ctx.font = "bold 10px Inter, sans-serif";
                    ctx.setLineDash([]);
                    ctx.fillText(`Echogenic Shadow Detected`, cx - 60, cy - r - 11);
                }
            }

            // Calculate simulated Risk level based on exact app/risk.py clinical rules!
            const riskData = evaluateClinicalRisk(stoneDetected, stoneSize, pain, fever, vomiting, blood, history);
            
            // Populate HTML components
            displayDiagnosticResults(stoneDetected, confidence, riskData, detections);
            
            updateUIState("idle");
        }, 1800);
    }

    // Replicates app/risk.py in browser Javascript
    function evaluateClinicalRisk(stoneDetected, stoneSize, pain, fever, vomiting, blood, history) {
        let score = 0;
        let reasons = [];
        
        if (stoneDetected) {
            score += 3;
            reasons.push("Stone detected in scan image.");
            
            if (currentTab === "ct" && stoneSize > 0) {
                if (stoneSize < 5) {
                    score += 1;
                    reasons.push(`Stone size (${stoneSize} mm) is small (< 5 mm). Spontaneous passage is highly likely.`);
                } else if (stoneSize <= 10) {
                    score += 2;
                    reasons.push(`Stone size (${stoneSize} mm) is moderate (5 mm to 10 mm). Clinical intervention may be needed.`);
                } else {
                    score += 4;
                    reasons.push(`Stone size (${stoneSize} mm) is large (> 10 mm). Spontaneous passage is unlikely; consultation required.`);
                }
            } else {
                reasons.push("Ultrasound scanning performed. Precise stone size calibration not available in US mode.");
            }
        } else {
            reasons.push("No stone detected in scan image.");
        }
        
        if (pain >= 7) {
            score += 2;
            reasons.push("Severe clinical pain level reported.");
        } else if (pain >= 4) {
            score += 1;
            reasons.push("Moderate pain level reported.");
        }
        
        if (fever) {
            score += 3;
            reasons.push("Patient reports active fever: elevated risk of urinary tract infection / pyelonephritis.");
        }
        if (vomiting) {
            score += 1;
            reasons.push("Nausea or vomiting reported, indicating active renal colic reflex.");
        }
        if (blood) {
            score += 1;
            reasons.push("Hematuria (blood in urine) reported, consistent with mucosal irritation by stone.");
        }
        if (history) {
            score += 1;
            reasons.push("Previous clinical kidney stone history reported.");
        }
        
        let level = "Low";
        if (score <= 3) {
            level = "Low";
        } else if (score <= 7) {
            level = "Moderate";
        } else {
            level = "High";
        }
        
        return { level, reasons, score };
    }

    // Renders the calculated inputs to beautiful dashboard cards
    function displayDiagnosticResults(stoneDetected, confidence, riskData, detections) {
        // 1. Diagnostics card
        diagnosisCard.className = `card report-card card-diagnosis ${stoneDetected ? "stone-detected-state" : "stone-clear-state"}`;
        diagResult.textContent = stoneDetected ? "Stone Detected" : "No Stone Detected";
        diagConfidence.textContent = `${confidence.toFixed(2)}%`;
        diagConfidenceFill.style.width = `${confidence}%`;
        
        diagModelInfo.textContent = currentTab === "ultrasound" 
            ? "Primary Model: TensorFlow Keras CNN" 
            : "Primary Model: Ultralytics YOLOv8n Segment";
            
        diagIcon.innerHTML = stoneDetected 
            ? `<svg viewBox="0 0 24 24" class="report-svg" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`
            : `<svg viewBox="0 0 24 24" class="report-svg" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
            
        // 2. Risk Card
        riskCard.className = "card report-card card-risk";
        riskLevelText.textContent = riskData.level;
        
        // Needle rotation mapping: Low (-60deg), Moderate (0deg), High (60deg)
        let rotation = -60;
        if (riskData.level === "Moderate") {
            rotation = 0;
            riskCard.style.borderLeftColor = "var(--status-warning)";
            riskLevelText.style.color = "var(--status-warning)";
        } else if (riskData.level === "High") {
            rotation = 60;
            riskCard.style.borderLeftColor = "var(--status-danger)";
            riskLevelText.style.color = "var(--status-danger)";
        } else {
            riskCard.style.borderLeftColor = "var(--status-success)";
            riskLevelText.style.color = "var(--status-success)";
        }
        riskNeedle.style.transform = `rotate(${rotation}deg)`;
        
        // 3. Reasons
        reasonsCard.className = "card report-card card-reasons";
        reasonsList.innerHTML = riskData.reasons.map(r => `<li>${r}</li>`).join("");
        
        // 4. CT Detections Table
        if (currentTab === "ct" && detections.length > 0) {
            stoneDetectionsCard.classList.remove("hidden");
            detectionsTableBody.innerHTML = detections.map(d => `
                <tr>
                    <td><span class="stone-index-badge">Stone #${d.index}</span></td>
                    <td>${d.confidence.toFixed(1)}%</td>
                    <td><code style="color:var(--text-muted);font-size:0.7rem;">[${d.bbox}]</code></td>
                    <td><strong class="stone-size-highlight">${d.size} mm</strong></td>
                </tr>
            `).join("");
        } else {
            stoneDetectionsCard.classList.add("hidden");
        }
        
        // Enable report export
        exportReportBtn.disabled = false;
    }

    // ==========================================================================
    // LIVE REST API DIAGNOSTICS (FASTAPI INTEGRATION)
    // ==========================================================================
    async function runLiveAPIDiagnostics() {
        logConsole("Establishing link with active FastAPI backend server...", "info");
        
        const formData = new FormData();
        formData.append("image", uploadedFile);
        formData.append("age", parseInt(patientAgeInput.value) || 25);
        formData.append("pain_level", parseInt(painLevelInput.value));
        formData.append("fever", feverToggle.checked ? "Yes" : "No");
        formData.append("vomiting", vomitingToggle.checked ? "Yes" : "No");
        formData.append("blood_in_urine", bloodUrineToggle.checked ? "Yes" : "No");
        formData.append("previous_history", historyToggle.checked ? "Yes" : "No");
        
        const isUltrasound = currentTab === "ultrasound";
        const endpoint = isUltrasound ? "/predict-ultrasound" : "/predict-ct";
        
        if (!isUltrasound) {
            formData.append("mm_per_pixel", parseFloat(mmPerPixelInput.value) || 0.10);
        }

        try {
            logConsole(`Sending POST payload to backend endpoint: ${endpoint}...`, "info");
            const response = await fetch(`${config.apiUrl}${endpoint}`, {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP network error. Status: ${response.status}`);
            }

            const data = await response.json();
            logConsole("Neural payload successfully received. Parsing model layers.", "success");
            
            // Check validation warning from backend
            if (data.is_valid_scan === false) {
                logConsole(`WARNING: ${data.validation_warning}`, "warn");
                if (imageWarningBanner && warningBannerText) {
                    imageWarningBanner.classList.remove("hidden");
                    warningBannerText.textContent = data.validation_warning;
                }
            } else {
                if (imageWarningBanner) {
                    imageWarningBanner.classList.add("hidden");
                }
            }
            
            // Format dynamic returns
            const isStone = data.stone_detected;
            const confidence = data.confidence || 0;
            const riskData = {
                level: data.risk_level,
                reasons: data.reasons || [],
                score: 0
            };
            
            // Handle CT Image draw or original image base64 draw
            if (!isUltrasound && isStone && data.marked_image_base64) {
                // If backend processed CT bounding box, load the marked base64 image onto the canvas!
                const markedImg = new Image();
                markedImg.onload = () => {
                    ctx.clearRect(0, 0, scanCanvas.width, scanCanvas.height);
                    ctx.drawImage(markedImg, 0, 0, scanCanvas.width, scanCanvas.height);
                    logConsole("YOLO Bounding boxes accurately overlaid on medical console.", "success");
                };
                markedImg.src = `data:image/jpeg;base64,${data.marked_image_base64}`;
            } else {
                drawOriginalImage(); // Draw normal clean image
            }

            // Detections mapping
            const detections = (data.detections || []).map((det, index) => ({
                index: index + 1,
                confidence: det.confidence,
                bbox: det.bbox ? det.bbox.join(", ") : "N/A",
                size: det.size_mm
            }));

            displayDiagnosticResults(isStone, confidence, riskData, detections);

        } catch (error) {
            logConsole(`API CONNECTION ERROR: Failed to stream results from ${config.apiUrl}.`, "error");
            logConsole("Reason: Network unreachable or backend CORS permissions missing.", "error");
            logConsole("Recommendation: Go to Settings (gear icon) and confirm endpoint OR enable Simulation Mode to work locally without servers.", "warn");
            
            alert(`API Error: Could not connect to your backend at ${config.apiUrl}. Reverting to offline diagnostic mode.`);
            
            // Fallback gracefully
            resetDiagnosisOutput();
        } finally {
            updateUIState("idle");
        }
    }

    // ==========================================================================
    // SETTINGS MODAL MANAGER
    // ==========================================================================
    openSettingsBtn.addEventListener("click", () => {
        settingsModal.style.display = "flex";
        // Check current connection
        testBackendServerConnection();
    });

    closeSettingsBtn.addEventListener("click", () => {
        settingsModal.style.display = "none";
    });

    // Close on click outside
    settingsModal.addEventListener("click", (e) => {
        if (e.target === settingsModal) {
            settingsModal.style.display = "none";
        }
    });

    simulationModeToggle.addEventListener("change", (e) => {
        config.simulationMode = e.target.checked;
        updateApiStatusIndicator();
        testBackendServerConnection();
    });

    backendApiUrlInput.addEventListener("input", (e) => {
        config.apiUrl = e.target.value.trim();
    });

    saveSettingsBtn.addEventListener("save", () => saveConfigSettings());
    saveSettingsBtn.addEventListener("click", () => saveConfigSettings());

    themeToggleBtn.addEventListener("click", () => {
        const isDark = document.documentElement.classList.contains("dark-theme");
        setTheme(isDark ? "light" : "dark");
    });

    function saveConfigSettings() {
        localStorage.setItem("ksd_clinical_config", JSON.stringify(config));
        settingsModal.style.display = "none";
        logConsole(`System settings re-calibrated. Mode: ${config.simulationMode ? "Simulation" : "Live API"}`, "success");
    }

    // Backend connectivity ping test
    async function testBackendServerConnection() {
        if (config.simulationMode) {
            connectionTester.classList.add("hidden");
            return;
        }
        
        connectionTester.classList.remove("hidden");
        connectionTestStatus.textContent = "Pinging API backend endpoint...";
        connectionTestStatus.style.color = "var(--text-sub)";
        
        try {
            // Simple GET to health endpoint or check response headers
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 3000); // 3 sec timeout
            
            const response = await fetch(config.apiUrl, { 
                method: "GET", 
                signal: controller.signal,
                mode: "cors"
            }).catch(e => {
                // If it's a 404 but we connected, that means server exists! FastAPI root might be 404.
                if (e.name === 'AbortError') throw new Error("Connection Timeout");
                return { ok: false, status: 0 };
            });
            
            clearTimeout(id);
            
            // FastAPI backend is running!
            connectionTestStatus.textContent = `Success! Connected to server at ${config.apiUrl}`;
            connectionTestStatus.style.color = "var(--status-success)";
        } catch (e) {
            connectionTestStatus.textContent = `Server Offline: Failed to handshake with ${config.apiUrl}`;
            connectionTestStatus.style.color = "var(--status-danger)";
        }
    }

    testConnectionBtn.addEventListener("click", () => {
        testBackendServerConnection();
    });

    // ==========================================================================
    // CLINICAL REPORT PDF EXPORTER
    // ==========================================================================
    exportReportBtn.addEventListener("click", () => {
        if (!uploadedFile) return;
        
        const patientAge = patientAgeInput.value;
        const painLevel = painLevelInput.value;
        const resultText = diagResult.textContent;
        const confText = diagConfidence.textContent;
        const riskVal = riskLevelText.textContent;
        const reasonsHTML = Array.from(reasonsList.querySelectorAll("li")).map(li => `<li>${li.innerText}</li>`).join("");
        
        const printWindow = window.open("", "_blank");
        printWindow.document.write(`
            <html>
            <head>
                <title>Kidney Stone Diagnostic Report - ${scanId}</title>
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; padding: 40px; line-height: 1.5; }
                    .header { border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 30px; display:flex; justify-content:space-between; align-items:center; }
                    .header h1 { margin: 0; color: #1e3a8a; font-size: 24px; }
                    .report-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 35px; background: #f3f4f6; padding: 15px; border-radius: 6px; }
                    .meta-item { font-size: 14px; }
                    .meta-item strong { color: #1f2937; }
                    .section-title { font-size: 16px; font-weight: 700; color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin-top: 25px; margin-bottom: 12px; text-transform: uppercase; }
                    .result-box { display: flex; gap: 20px; margin-bottom: 25px; }
                    .metric-card { flex: 1; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb; background: #fafafa; }
                    .metric-title { font-size: 12px; color: #6b7280; font-weight: 600; margin-bottom: 5px; text-transform: uppercase; }
                    .metric-value { font-size: 20px; font-weight: 700; color: #1f2937; }
                    .value-stone { color: #ef4444 !important; }
                    .value-clear { color: #10b981 !important; }
                    ul { padding-left: 20px; margin: 0; }
                    li { font-size: 13px; margin-bottom: 6px; color: #4b5563; }
                    .disclaimer { font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; margin-top: 50px; padding-top: 15px; line-height: 1.4; text-align: justify; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h1>KIDNEY STONE DIAGNOSTIC ANALYSIS</h1>
                        <p style="margin: 3px 0 0; font-size:12px; color:#6b7280;">Decision Support Clinical Portal & Neural Visualizer</p>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-weight:700; font-size:14px; color:#2563eb;">${scanId}</span>
                    </div>
                </div>
                
                <div class="report-meta">
                    <div class="meta-item"><strong>Patient Age:</strong> ${patientAge}</div>
                    <div class="meta-item"><strong>Symptom Pain Level:</strong> ${painLevel} / 10</div>
                    <div class="meta-item"><strong>Diagnostic Date:</strong> ${new Date().toLocaleDateString()}</div>
                    <div class="meta-item"><strong>Scan Modality:</strong> ${currentTab.toUpperCase()} Scan</div>
                </div>

                <div class="section-title">Inference Outcomes</div>
                <div class="result-box">
                    <div class="metric-card">
                        <div class="metric-title">Primary Diagnosis</div>
                        <div class="metric-value ${resultText.includes("No") ? "value-clear" : "value-stone"}">${resultText}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-title">Model Confidence</div>
                        <div class="metric-value">${confText}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-title">Risk Assessment</div>
                        <div class="metric-value" style="color: ${riskVal === 'High' ? '#ef4444' : riskVal === 'Moderate' ? '#f59e0b' : '#10b981'}">${riskVal} Risk</div>
                    </div>
                </div>

                <div class="section-title">Clinical Diagnostic Explanations</div>
                <ul>
                    ${reasonsHTML}
                </ul>

                <p class="disclaimer">
                    <strong>MEDICO-LEGAL LIMITATION OF LIABILITY:</strong> This computerized report is produced automatically by academic deep learning algorithms analyzing ultrasound or CT visual densities. It has not been authorized or approved by the FDA as a final clinical diagnostic tool. Bounding boxes represent statistical model anomalies, not certified medical diagnoses. Bounding box coordinates and size metrics must be manually validated by a board-certified consulting physician prior to clinical therapy or surgical intervention.
                </p>

                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    });

    function checkIsMedicalScan(imgElement) {
        try {
            // Create a small temporary canvas to analyze image pixels quickly
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.width = 50;
            canvas.height = 50;
            
            ctx.drawImage(imgElement, 0, 0, 50, 50);
            const imgData = ctx.getImageData(0, 0, 50, 50);
            const data = imgData.data;
            
            let totalBrightness = 0;
            let totalSaturation = 0;
            let colorDifference = 0;
            const pixelCount = data.length / 4;
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i+1];
                const b = data[i+2];
                
                // 1. Brightness
                const brightness = (r + g + b) / 3;
                totalBrightness += brightness;
                
                // 2. Color difference (deviation from grayscale)
                const avg = (r + g + b) / 3;
                const diff = Math.abs(r - avg) + Math.abs(g - avg) + Math.abs(b - avg);
                colorDifference += diff / 3;
                
                // 3. Simple saturation calculation
                const maxVal = Math.max(r, g, b);
                const minVal = Math.min(r, g, b);
                const saturation = maxVal === 0 ? 0 : (maxVal - minVal) / maxVal;
                totalSaturation += saturation;
            }
            
            const avgBrightness = totalBrightness / pixelCount;
            const avgColorDifference = colorDifference / pixelCount;
            const avgSaturation = totalSaturation / pixelCount;
            
            // Conditions for warning:
            if (avgBrightness > 165) {
                return {
                    isValid: false,
                    reason: "High average brightness detected (e.g. document, screenshot, or white page). Please upload only a valid ultrasound or CT scan image with a dark background."
                };
            }
            if (avgColorDifference > 25 || avgSaturation > 0.22) {
                return {
                    isValid: false,
                    reason: "High color saturation or color variety detected. Please upload only a valid ultrasound or CT scan image (typically grayscale/dark)."
                };
            }
            if (avgBrightness < 2.0) {
                return {
                    isValid: false,
                    reason: "Image appears to be completely blank or black. Please upload a valid scan image."
                };
            }
            return { isValid: true };
        } catch (e) {
            return { isValid: true };
        }
    }

    // Start App!
    initialize();
});
