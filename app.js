// ---------- Validate Config ----------
if (typeof config === "undefined") {
    console.error("❌ Config file not loaded. Please ensure config.js is included before app.js.");
} else {
    config.imageExt = config.imageExt || ".png";
    config.thumbExt = config.thumbExt || ".jpg";
}

// ---------- Global State ----------
let currentPage = 1;
let isDrawing = false;
let currentTool = "highlight"; // highlight | pen | eraser
let drawColor = "rgba(255, 255, 0, 0.4)";
let brushSize = 40;
let drawingData = {}; // Stores per-page highlights
let isLocked = config.requireLogin;
let canvas, ctx;

// ---------- Initialization ----------
document.addEventListener("DOMContentLoaded", () => {
    if (isLocked) setupLogin();
    else initFlipbook();
});

// ---------- Login ----------
function setupLogin() {
    document.getElementById("lockScreen").style.display = "flex";
    document.getElementById("unlockBtn").addEventListener("click", () => {
        const id = document.getElementById("idInput").value.trim();
        if (/^\d{6,12}$/.test(id)) {
            localStorage.setItem("student_id", id);
            document.getElementById("lockScreen").style.display = "none";
            initFlipbook();
        } else {
            document.getElementById("idError").style.display = "block";
        }
    });
}

// ---------- Flipbook Setup ----------
function initFlipbook() {
    loadPage(currentPage);
    loadThumbnails();
    setupToolbar();
    setupDrawingTools();
    setupAIHelper();
    setupModals();
    setupKeyboardShortcuts();
}

// ---------- Page Loader ----------
function loadPage(page) {
    currentPage = page;
    const flipbook = document.getElementById("flipbook");
    flipbook.innerHTML = "";

    const pageContainer = document.createElement("div");
    pageContainer.classList.add("page");

    const mainImage = document.createElement("img");
    mainImage.classList.add("page-image");
    mainImage.src = `${config.imagePath}${page}${config.imageExt}`;
    mainImage.alt = `Page ${page}`;

    // Canvas for highlights
    canvas = document.createElement("canvas");
    canvas.classList.add("highlight-layer");
    mainImage.onload = () => {
        canvas.width = mainImage.clientWidth;
        canvas.height = mainImage.clientHeight;
        ctx = canvas.getContext("2d");
        loadHighlightsForPage(page);
    };

    pageContainer.appendChild(mainImage);
    pageContainer.appendChild(canvas);
    flipbook.appendChild(pageContainer);

    document.getElementById("pageCounter").textContent = `Page ${page} / ${config.totalPages}`;
    preloadImages(page);
    updateChapterTitle(page);
    if (window.MathJax) MathJax.typesetPromise();
}

// ---------- Page Navigation ----------
function nextPage() {
    if (currentPage < config.totalPages) loadPage(currentPage + 1);
}
function prevPage() {
    if (currentPage > 1) loadPage(currentPage - 1);
}
function firstPage() { loadPage(1); }
function lastPage() { loadPage(config.totalPages); }
function jumpToPage() {
    const val = parseInt(document.getElementById("pageInput").value);
    if (!isNaN(val) && val >= 1 && val <= config.totalPages) loadPage(val);
}

// ---------- Preload Nearby ----------
function preloadImages(current) {
    const range = 2;
    for (let i = Math.max(1, current - range); i <= Math.min(config.totalPages, current + range); i++) {
        const img = new Image();
        img.src = `${config.imagePath}${i}${config.imageExt}`;
    }
}

// ---------- Thumbnails ----------
function loadThumbnails() {
    const bar = document.getElementById("thumbbar");
    bar.innerHTML = "";
    for (let i = 1; i <= config.totalPages; i++) {
        const t = document.createElement("img");
        t.classList.add("thumb");
        t.loading = "lazy";
        t.src = `${config.thumbPath}${i}${config.thumbExt}`;
        t.onclick = () => loadPage(i);
        bar.appendChild(t);
    }
}

// ---------- Drawing Tools ----------
function setupDrawingTools() {
    document.getElementById("toggle-draw-mode-btn").onclick = toggleDrawMode;
    document.getElementById("highlight-settings-btn").onclick = toggleHighlightPopup;

    document.querySelectorAll(".color-swatch").forEach(s => {
        s.onclick = () => {
            document.querySelectorAll(".color-swatch").forEach(x => x.classList.remove("active"));
            s.classList.add("active");
            drawColor = s.dataset.color;
        };
    });

    document.getElementById("brush-size-popup").oninput = e => brushSize = e.target.value;
    document.getElementById("clear-highlights-btn-popup").onclick = clearHighlights;
    document.getElementById("pen-tool-btn-popup").onclick = () => currentTool = "pen";
    document.getElementById("highlight-tool-btn").onclick = () => currentTool = "highlight";
    document.getElementById("eraser-tool-btn-popup").onclick = () => currentTool = "eraser";

    setupCanvasEvents();
}

function toggleDrawMode() {
    isDrawing = !isDrawing;
    document.getElementById("toggle-draw-mode-btn").classList.toggle("active", isDrawing);
}

function setupCanvasEvents() {
    document.addEventListener("mousedown", startDraw);
    document.addEventListener("mousemove", draw);
    document.addEventListener("mouseup", stopDraw);
}

function startDraw(e) {
    if (!isDrawing || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.strokeStyle = currentTool === "eraser" ? "#fff" : drawColor;
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    canvas.isDrawing = true;
}

function draw(e) {
    if (!canvas?.isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
}

function stopDraw() {
    if (!canvas?.isDrawing) return;
    canvas.isDrawing = false;
    saveHighlightsForPage(currentPage);
}

// ---------- Highlight Persistence ----------
function saveHighlightsForPage(page) {
    const dataURL = canvas.toDataURL();
    localStorage.setItem(`highlight_${page}`, dataURL);
}
function loadHighlightsForPage(page) {
    const saved = localStorage.getItem(`highlight_${page}`);
    if (saved) {
        const img = new Image();
        img.src = saved;
        img.onload = () => ctx.drawImage(img, 0, 0);
    }
}
function clearHighlights() {
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    localStorage.removeItem(`highlight_${currentPage}`);
}

// ---------- AI Helper ----------
function setupAIHelper() {
    const modal = document.getElementById("aiHelperModal");
    const toggle = document.getElementById("aiHelperToggle");
    const close = document.getElementById("aiCloseBtn");

    toggle.onclick = () => modal.style.display = "flex";
    close.onclick = () => modal.style.display = "none";
}

async function getAiHelp(type) {
    document.getElementById("aiResponse").innerHTML = "";
    document.getElementById("aiLoading").style.display = "block";

    try {
        const res = await fetch("https://script.google.com/macros/s/AKfycbxzKK4RKp0rpCZcznOYPyV4aWMhBZLqYSn_ZFyNe3EO6_MxPWHZ3laF1QGL6zk6E4-h/exec", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: type,
                page: currentPage,
                chapter: getChapterTitle(currentPage)
            })
        });
        const data = await res.json();
        document.getElementById("aiResponse").innerHTML = data.response || "No response.";
    } catch (err) {
        document.getElementById("aiResponse").innerHTML = "Error connecting to AI helper.";
    } finally {
        document.getElementById("aiLoading").style.display = "none";
    }
}

function getChapterTitle(page) {
    let title = "Unknown Chapter";
    for (let ch of config.chapters) {
        if (page >= ch.page) title = ch.title;
    }
    return title;
}
function updateChapterTitle(page) {
    document.getElementById("aiChapterTitle").textContent = getChapterTitle(page);
}

// ---------- Modals ----------
function setupModals() {
    document.getElementById("phetCloseBtn").onclick = () => document.getElementById("phetModal").style.display = "none";
    document.getElementById("videoCloseBtn").onclick = () => document.getElementById("videoModal").style.display = "none";
}

function openPhet(url) {
    document.getElementById("phetFrame").src = url;
    document.getElementById("phetModal").style.display = "flex";
}
function openVideo(url) {
    document.getElementById("videoFrame").src = url;
    document.getElementById("videoModal").style.display = "flex";
}

// ---------- Keyboard Shortcuts ----------
function setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") nextPage();
        else if (e.key === "ArrowLeft") prevPage();
        else if (e.key.toLowerCase() === "d") toggleDrawMode();
        else if (e.key.toLowerCase() === "a") document.getElementById("aiHelperToggle").click();
        else if (e.key === "Delete") clearHighlights();
        else if (!isNaN(parseInt(e.key))) {
            const num = parseInt(e.key);
            if (num >= 1 && num <= 9) loadPage(num);
        }
    });
}
