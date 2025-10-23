/* app.js
   Full flipbook app logic:
   - navigation, thumbnails, search
   - highlight/draw/erase on canvas, per-page save/load
   - pinch-zoom & pan (Hammer.js)
   - PhET & YouTube modals
   - AI helper via Google Apps Script proxy (config.aiProxyURL)
*/

/* =================== sanity check =================== */
if (typeof config === "undefined") {
  throw new Error("config.js must be loaded before app.js");
}

/* =================== Globals =================== */
let currentPage = 1;
const totalPages = config.totalPages || 0;

let bookText = {}; // will be loaded from book-text.json
let numberBuffer = "";
let numberBufferTimer = null;

let isDrawingMode = false; // pen/marker/eraser active
let tool = "marker"; // "marker" (straight-line), "pen" (freehand), "eraser"
let drawColor = "rgba(255,255,0,0.4)";
let brushSize = 40;

let isPointerDown = false;
let pointerStart = null;
let freehandPath = []; // for pen freehand during drawing

let hammerManager = null;
let currentScale = 1;
let lastScale = 1;
let panX = 0, panY = 0;

/* =================== DOM refs & create page DOM =================== */
const thumbbar = document.getElementById("thumbbar");
const pageCounter = document.getElementById("pageCounter");
const pageInput = document.getElementById("pageInput");
const indexMenu = document.getElementById("indexMenu");
const indexToggle = document.getElementById("indexToggle");
const searchBtn = document.getElementById("searchBtn");
const searchContainer = document.getElementById("searchContainer");
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const searchCloseBtn = document.getElementById("searchCloseBtn");
const highlightPopup = document.getElementById("highlight-popup");
const highlightToggleBtn = document.getElementById("toggle-draw-mode-btn");
const highlightSettingsBtn = document.getElementById("highlight-settings-btn");
const colorSwatches = document.querySelectorAll(".color-swatch");
const brushSizeInput = document.getElementById("brush-size-popup");
const clearHighlightsBtn = document.getElementById("clear-highlights-btn-popup");
const phetModal = document.getElementById("phetModal");
const phetFrame = document.getElementById("phetFrame");
const phetCloseBtn = document.getElementById("phetCloseBtn");
const videoModal = document.getElementById("videoModal");
const videoFrame = document.getElementById("videoFrame");
const videoCloseBtn = document.getElementById("videoCloseBtn");
const aiHelperToggle = document.getElementById("aiHelperToggle");
const aiHelperModal = document.getElementById("aiHelperModal");
const aiCloseBtn = document.getElementById("aiCloseBtn");
const aiResponseEl = document.getElementById("aiResponse");
const aiLoadingEl = document.getElementById("aiLoading");
const translateAnalysisBtn = document.getElementById("translate-analysis-btn");

/* We'll create the page structure dynamically inside #flipbook */
const flipbook = document.getElementById("flipbook");
const pageWrap = document.createElement("div");
pageWrap.className = "page-wrap";
const pageImage = document.createElement("img");
pageImage.className = "page-image";
pageImage.alt = "Book page";
const highlightCanvas = document.createElement("canvas");
highlightCanvas.id = "highlight-canvas";
pageWrap.appendChild(pageImage);
pageWrap.appendChild(highlightCanvas);
flipbook.appendChild(pageWrap);

const ctx = highlightCanvas.getContext("2d");

/* =================== Helpers =================== */

function pad(n, width = 3) {
  return String(n).padStart(width, "0");
}

function updatePageCounter() {
  pageCounter.textContent = `Page ${currentPage} / ${totalPages}`;
  pageInput.value = currentPage;
}

function toEmbedUrl(url) {
  if (!url) return url;
  // YouTube watch -> embed
  if (url.includes("youtube.com/watch")) {
    return url.replace("watch?v=", "embed/");
  }
  // youtu.be short -> embed
  if (url.includes("youtu.be/")) {
    const id = url.split("youtu.be/")[1].split(/[?&]/)[0];
    return `https://www.youtube.com/embed/${id}`;
  }
  // shorts -> embed
  if (url.includes("youtube.com/shorts/")) {
    const id = url.split("shorts/")[1].split(/[?&]/)[0];
    return `https://www.youtube.com/embed/${id}`;
  }
  return url;
}

function debounce(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/* =================== Thumbnails =================== */

function buildThumbnails() {
  // clear
  thumbbar.innerHTML = "";
  for (let i = 1; i <= totalPages; i++) {
    const img = document.createElement("img");
    img.src = `${config.thumbPath}${pad(i)}.jpg`;
    img.alt = `thumb-${i}`;
    img.addEventListener("click", () => loadPage(i));
    thumbbar.appendChild(img);
  }
  highlightActiveThumb();
}

function highlightActiveThumb() {
  const thumbs = thumbbar.querySelectorAll("img");
  thumbs.forEach((t, idx) => t.classList.toggle("active", idx + 1 === currentPage));
}

/* =================== Page Load + Preload =================== */

function resizeCanvasToImage() {
  // We want canvas to overlay the rendered image size (not natural)
  const rect = pageImage.getBoundingClientRect();
  highlightCanvas.width = Math.round(rect.width);
  highlightCanvas.height = Math.round(rect.height);
  highlightCanvas.style.width = rect.width + "px";
  highlightCanvas.style.height = rect.height + "px";

  // redraw saved highlights (they were saved as data URLs)
  loadHighlights(currentPage);
}

function preloadPages(page) {
  [page - 1, page + 1].forEach(p => {
    if (p >= 1 && p <= totalPages) {
      const i = new Image();
      i.src = `${config.imagePath}${pad(p)}.jpg`;
    }
  });
}

function loadPage(page) {
  if (page < 1 || page > totalPages) return;
  // Save current page highlights before switching
  saveHighlights(currentPage);

  currentPage = page;
  pageImage.src = `${config.imagePath}${pad(page)}.jpg`;
  pageImage.onload = () => {
    // reset zoom/pan
    resetZoomPan();
    resizeCanvasToImage();
    updatePageCounter();
    highlightActiveThumb();
  };
  pageImage.onerror = () => {
    console.warn("Failed loading page image:", pageImage.src);
  };

  preloadPages(page);
  // auto open any linked media (but not forced if you prefer manual)
  autoOpenMedia(page);
}

/* =================== Save / Load Highlights (localStorage per page) =================== */
function localKeyForPage(p) {
  return `highlights_page_${p}`;
}

function saveHighlights(page) {
  try {
    const dataUrl = highlightCanvas.toDataURL("image/png");
    localStorage.setItem(localKeyForPage(page), dataUrl);
  } catch (err) {
    console.warn("saveHighlights failed:", err);
  }
}

function loadHighlights(page) {
  // Clear canvas
  ctx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
  const key = localKeyForPage(page);
  const data = localStorage.getItem(key);
  if (data) {
    const img = new Image();
    img.onload = () => {
      // draw onto canvas scaled to current canvas size
      ctx.drawImage(img, 0, 0, highlightCanvas.width, highlightCanvas.height);
    };
    img.src = data;
  }
}

/* Clear highlights for current page */
function clearPageHighlights() {
  ctx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
  localStorage.removeItem(localKeyForPage(currentPage));
}

/* =================== Highlight / Draw / Erase Logic =================== */

function setTool(newTool) {
  tool = newTool;
  // update popup buttons active state
  document.querySelectorAll(".tool-btn").forEach(b => b.classList.toggle("active", b.id.includes(newTool)));
}

function startPointer(x, y) {
  isPointerDown = true;
  pointerStart = { x, y };
  freehandPath = [{ x, y }];
  // disable gestures while drawing
  if (hammerManager) hammerManager.set({ enable: false });
}

function movePointer(x, y) {
  if (!isPointerDown) return;
  if (tool === "pen") {
    // freehand draw: draw immediate
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = drawColor;
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = Math.max(1, (brushSize / 6));
    ctx.beginPath();
    const last = freehandPath[freehandPath.length - 1];
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    freehandPath.push({ x, y });
  } else if (tool === "eraser") {
    // erase small rect
    const eraserSize = Math.max(8, brushSize / 2);
    ctx.clearRect(x - eraserSize / 2, y - eraserSize / 2, eraserSize, eraserSize);
  } else if (tool === "marker") {
    // while dragging show a preview line: we will redraw canvas snapshot each move
    // To avoid complex snapshotting here, we'll draw a temporary overlay by clearing and reloading saved base then drawing preview.
    // Implementation: reload saved highlights image then draw preview line
    const baseData = localStorage.getItem(localKeyForPage(currentPage));
    ctx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
    if (baseData) {
      const baseImg = new Image();
      baseImg.onload = () => {
        ctx.drawImage(baseImg, 0, 0, highlightCanvas.width, highlightCanvas.height);
        drawPreviewLine(pointerStart.x, pointerStart.y, x, pointerStart.y);
      };
      baseImg.src = baseData;
    } else {
      drawPreviewLine(pointerStart.x, pointerStart.y, x, pointerStart.y);
    }
  }
}

function endPointer(x, y) {
  if (!isPointerDown) return;
  isPointerDown = false;
  if (tool === "pen") {
    // pen already drawn directly on canvas
  } else if (tool === "eraser") {
    // already erased on canvas
  } else if (tool === "marker") {
    // draw final straight horizontal line
    drawFinalLine(pointerStart.x, pointerStart.y, x, pointerStart.y);
  }
  // re-enable gestures
  if (hammerManager) hammerManager.set({ enable: true });
  saveHighlights(currentPage);
}

/* draw preview (semi-transparent) */
function drawPreviewLine(x1, y1, x2, y2) {
  ctx.lineWidth = Math.max(4, brushSize / 2);
  ctx.lineCap = "round";
  ctx.strokeStyle = drawColor;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/* draw final marker line */
function drawFinalLine(x1, y1, x2, y2) {
  ctx.lineWidth = Math.max(4, brushSize / 2);
  ctx.lineCap = "round";
  ctx.strokeStyle = drawColor;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/* pointer event handlers for canvas (mouse + touch via Pointer events) */
function attachCanvasPointerEvents() {
  // Use pointer events for unified mouse/touch/stylus
  highlightCanvas.addEventListener("pointerdown", (ev) => {
    if (!document.body.classList.contains("highlight-mode")) return;
    ev.preventDefault();
    const rect = highlightCanvas.getBoundingClientRect();
    const x = (ev.clientX - rect.left);
    const y = (ev.clientY - rect.top);
    startPointer(x, y);
  });

  highlightCanvas.addEventListener("pointermove", (ev) => {
    if (!document.body.classList.contains("highlight-mode")) return;
    if (!isPointerDown) return;
    ev.preventDefault();
    const rect = highlightCanvas.getBoundingClientRect();
    const x = (ev.clientX - rect.left);
    const y = (ev.clientY - rect.top);
    movePointer(x, y);
  });

  highlightCanvas.addEventListener("pointerup", (ev) => {
    if (!document.body.classList.contains("highlight-mode")) return;
    if (!isPointerDown) return;
    ev.preventDefault();
    const rect = highlightCanvas.getBoundingClientRect();
    const x = (ev.clientX - rect.left);
    const y = (ev.clientY - rect.top);
    endPointer(x, y);
  });

  // If pointer leaves canvas, finalize
  highlightCanvas.addEventListener("pointerleave", (ev) => {
    if (isPointerDown) {
      endPointer();
    }
  });
}

/* =================== Zoom & Pan via Hammer.js =================== */

function initHammer() {
  if (!window.Hammer) return;
  hammerManager = new Hammer.Manager(pageWrap);
  const pinch = new Hammer.Pinch();
  const pan = new Hammer.Pan({ threshold: 0, pointers: 0 });
  hammerManager.add([pinch, pan]);

  let basePanX = 0, basePanY = 0;
  hammerManager.on("pinchstart", (ev) => {
    lastScale = currentScale;
  });

  hammerManager.on("pinchmove", (ev) => {
    const scale = Math.min(5, Math.max(1, lastScale * ev.scale));
    currentScale = scale;
    pageWrap.style.transform = `scale(${currentScale}) translate(${panX}px, ${panY}px)`;
  });

  hammerManager.on("pinchend", () => {
    lastScale = currentScale;
  });

  hammerManager.on("panstart", () => {
    basePanX = panX;
    basePanY = panY;
  });

  hammerManager.on("panmove", (ev) => {
    // allow pan only when zoomed
    if (currentScale <= 1) return;
    panX = basePanX + ev.deltaX / currentScale; // adjust by scale so movement feels natural
    panY = basePanY + ev.deltaY / currentScale;
    pageWrap.style.transform = `scale(${currentScale}) translate(${panX}px, ${panY}px)`;
  });

  hammerManager.on("panend", () => {
    // nothing special
  });
}

function resetZoomPan() {
  currentScale = 1;
  lastScale = 1;
  panX = 0;
  panY = 0;
  pageWrap.style.transform = `scale(1) translate(0px, 0px)`;
}

/* =================== Search Handling =================== */

async function loadBookText() {
  try {
    const res = await fetch("book-text.json");
    if (!res.ok) throw new Error("book-text.json not found");
    const data = await res.json();
    bookText = data;
    // enable search button only after book-text loaded
    searchBtn.disabled = false;
  } catch (err) {
    console.warn("book-text.json not loaded:", err);
  }
}

searchBtn.addEventListener("click", () => {
  searchContainer.style.display = "flex";
  searchInput.focus();
});

searchCloseBtn.addEventListener("click", () => {
  searchContainer.style.display = "none";
  searchResults.innerHTML = "";
  searchInput.value = "";
});

searchInput.addEventListener("input", debounce(() => {
  const q = searchInput.value.trim().toLowerCase();
  searchResults.innerHTML = "";
  if (q.length < 2) {
    return;
  }

  // Determine whether bookText keys are 0-based or 1-based
  const keys = Object.keys(bookText);
  const zeroBased = keys.includes("0") && !keys.includes("1");

  // Search each entry, show page (convert if zero-based)
  const results = [];
  for (const [k, v] of Object.entries(bookText)) {
    if (!v) continue;
    if (v.toLowerCase().includes(q)) {
      const pageNum = zeroBased ? parseInt(k, 10) + 1 : parseInt(k, 10);
      if (!isNaN(pageNum)) results.push({ page: pageNum, snippet: getSnippet(v, q) });
    }
  }

  if (results.length === 0) {
    searchResults.innerHTML = `<div class="no-results">No results</div>`;
    return;
  }

  for (const r of results.slice(0, 50)) {
    const div = document.createElement("div");
    div.innerHTML = `<strong>Page ${r.page}</strong> — ${r.snippet}`;
    div.addEventListener("click", () => {
      loadPage(r.page);
      searchContainer.style.display = "none";
      searchResults.innerHTML = "";
      searchInput.value = "";
      scrollToTop();
    });
    searchResults.appendChild(div);
  }
}, 180));

function getSnippet(text, q, len = 120) {
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text.slice(0, len) + (text.length > len ? "…" : "");
  const start = Math.max(0, idx - 30);
  const snippet = text.slice(start, start + len);
  return (start > 0 ? "… " : "") + snippet.replace(/\s+/g, " ") + (text.length > start + len ? "…" : "");
}

/* =================== AI Helper logic =================== */

aiHelperToggle.addEventListener("click", () => {
  aiHelperModal.style.display = "flex";
  aiResponseEl.textContent = "";
});

aiCloseBtn.addEventListener("click", () => {
  aiHelperModal.style.display = "none";
  aiResponseEl.textContent = "";
});

async function fetchWithRetryAI(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      // treat 200..299 as OK
      if (res.ok) {
        try { return await res.json(); } catch (e) { return { error: "Invalid JSON from proxy" }; }
      }
      if (![429, 503].includes(res.status)) {
        // other HTTP error: return json / throw
        const text = await res.text();
        throw new Error(`Proxy HTTP ${res.status}: ${text}`);
      }
      // for rate-limit or service-unavailable -> retry with backoff
      await new Promise(r => setTimeout(r, (i + 1) * 1000));
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, (i + 1) * 500));
    }
  }
  throw new Error("Max retries reached");
}

async function callAI(action, opts = {}) {
  if (!config.aiProxyURL) throw new Error("AI proxy URL not configured (config.aiProxyURL)");
  aiLoadingEl.style.display = "block";
  aiResponseEl.textContent = "";

  try {
    let payload = { action, page: currentPage, language: config.aiLanguage || "en", tone: config.aiTone || "friendly" };

    if (action === "analyze") {
      // capture image base64 (full natural image)
      payload.image = await getImageBase64ForAI();
    } else if (action === "translatePage") {
      // send page text
      payload.text = getPageTextForAI();
    } else {
      // other actions: include page text (if available)
      payload.text = getPageTextForAI();
    }

    const res = await fetchWithRetryAI(config.aiProxyURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.error) {
      aiResponseEl.textContent = `⚠️ AI Error: ${res.error}`;
    } else {
      // response may return { reply: "...", text: "...", output: ... }
      const reply = res.reply || res.text || res.output || JSON.stringify(res);
      aiResponseEl.innerHTML = sanitizeAndRenderMarkdown(reply);
      // show translate analysis button if reply exists
      if (reply) translateAnalysisBtn.style.display = "inline-block";
      else translateAnalysisBtn.style.display = "none";
      // Typeset MathJax if any
      if (window.MathJax && window.MathJax.typesetPromise) {
        try { window.MathJax.typesetPromise(); } catch (e) { /* ignore */ }
      }
    }

  } catch (err) {
    aiResponseEl.textContent = `⚠️ Error contacting AI: ${err.message}`;
    translateAnalysisBtn.style.display = "none";
  } finally {
    aiLoadingEl.style.display = "none";
  }
}

/* small markdown rendering with marked if available */
function sanitizeAndRenderMarkdown(mdText) {
  if (window.marked) {
    try { return marked.parse(mdText); } catch (e) { return mdText; }
  }
  return mdText;
}

/* wrapper helpers for AI actions triggered by UI */
async function getAiHelp(actionKey) {
  // actionKey: 'explain'|'quiz'|'relate'|'analyze_page'|'translate_page'
  if (actionKey === "explain") {
    await callAI("explain");
  } else if (actionKey === "quiz") {
    await callAI("quiz");
  } else if (actionKey === "relate") {
    await callAI("relate");
  } else if (actionKey === "analyze_page") {
    await callAI("analyze");
  } else if (actionKey === "translate_page") {
    await callAI("translatePage");
    // automatically show overlay if response includes translation — overlay handled server-side or by reply
  }
}

/* Translate AI response text */
translateAnalysisBtn.addEventListener("click", async () => {
  const content = aiResponseEl.textContent || aiResponseEl.innerText || "";
  if (!content) return;
  aiLoadingEl.style.display = "block";
  try {
    const res = await fetchWithRetryAI(config.aiProxyURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "translateText", text: content, language: config.aiLanguage || "ar" })
    });
    const reply = res.reply || res.text || res.output || "No translation";
    aiResponseEl.innerHTML = sanitizeAndRenderMarkdown(reply + "\n\n*(Translated)*");
    aiResponseEl.classList.add("rtl-text");
  } catch (err) {
    aiResponseEl.textContent = `⚠️ Translation failed: ${err.message}`;
  } finally {
    aiLoadingEl.style.display = "none";
  }
});

/* get page text (try both bookText modes) */
function getPageTextForAI() {
  if (!bookText || Object.keys(bookText).length === 0) return "";
  // prefer key exactly matching currentPage
  if (bookText[String(currentPage)]) return bookText[String(currentPage)];
  // if zero-based keys exist
  if (bookText[String(currentPage - 1)]) return bookText[String(currentPage - 1)];
  // otherwise return concatenation
  return Object.values(bookText).join("\n\n");
}

async function getImageBase64ForAI() {
  const img = pageImage;
  // draw natural image to offscreen canvas
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const cctx = c.getContext("2d");
  cctx.drawImage(img, 0, 0, c.width, c.height);
  // return base64 data URL
  return c.toDataURL("image/png");
}

/* =================== PhET & Video modal handling =================== */

function autoOpenMedia(page) {
  // find simulation or video for page
  const sim = (config.simulations || []).find(s => s.page === page);
  const vid = (config.videos || []).find(v => v.page === page);
  if (sim) openPhet(sim.url);
  if (vid) openVideo(vid.url);
}

function openPhet(url) {
  phetFrame.src = url;
  phetModal.style.display = "flex";
}
function closePhet() {
  phetModal.style.display = "none";
  phetFrame.src = "about:blank";
}
phetCloseBtn.addEventListener("click", closePhet);

function openVideo(url) {
  videoFrame.src = toEmbedUrl(url);
  videoModal.style.display = "flex";
}
function closeVideo() {
  videoModal.style.display = "none";
  videoFrame.src = "about:blank";
}
videoCloseBtn.addEventListener("click", closeVideo);

/* =================== Keyboard Shortcuts =================== */

document.addEventListener("keydown", (e) => {
  // avoid shortcuts while typing in input
  if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")) return;

  if (e.key === "ArrowRight") {
    loadPage(Math.min(currentPage + 1, totalPages));
  } else if (e.key === "ArrowLeft") {
    loadPage(Math.max(currentPage - 1, 1));
  } else if (e.key === "Enter" && numberBuffer) {
    const target = parseInt(numberBuffer, 10);
    if (!isNaN(target) && target >= 1 && target <= totalPages) loadPage(target);
    numberBuffer = "";
    clearTimeout(numberBufferTimer);
  } else if (/^[0-9]$/.test(e.key)) {
    numberBuffer += e.key;
    clearTimeout(numberBufferTimer);
    numberBufferTimer = setTimeout(() => numberBuffer = "", 1500);
  } else if (e.key.toLowerCase() === "d") {
    // toggle draw/highlight mode
    toggleHighlightMode();
  } else if (e.key.toLowerCase() === "h") {
    // toggle highlight popup
    highlightSettingsBtn.click();
  } else if (e.key.toLowerCase() === "s") {
    // toggle search
    searchBtn.click();
  } else if (e.key.toLowerCase() === "a") {
    aiHelperToggle.click();
  } else if (e.key === "Escape") {
    // close modals/popups
    searchContainer.style.display = "none";
    highlightPopup.classList.remove("visible");
    if (aiHelperModal) aiHelperModal.style.display = "none";
    closePhet();
    closeVideo();
  }
});

/* =================== UI Wiring =================== */

/* page input jump */
pageInput.addEventListener("change", () => {
  const val = parseInt(pageInput.value, 10);
  if (!isNaN(val)) loadPage(Math.min(Math.max(1, val), totalPages));
});

/* build index menu from config */
function buildIndexMenu() {
  indexMenu.innerHTML = "";
  (config.chapters || []).forEach(ch => {
    const btn = document.createElement("button");
    btn.textContent = ch.title;
    btn.addEventListener("click", () => {
      loadPage(ch.page);
      indexMenu.style.display = "none";
    });
    indexMenu.appendChild(btn);
  });
}
indexToggle.addEventListener("click", () => {
  indexMenu.style.display = (indexMenu.style.display === "flex" ? "none" : "flex");
});

/* highlight popup toggle */
highlightSettingsBtn.addEventListener("click", (e) => {
  highlightPopup.classList.toggle("visible");
  // position the popup under the settings button
  const rect = highlightSettingsBtn.getBoundingClientRect();
  highlightPopup.style.left = Math.max(8, rect.left) + "px";
});

/* toggle highlight/draw mode on button */
highlightToggleBtn.addEventListener("click", () => toggleHighlightMode());

function toggleHighlightMode() {
  const was = document.body.classList.toggle("highlight-mode");
  // set a default tool
  if (was) {
    document.body.classList.add("highlight-mode");
    // ensure canvas pointer events enabled via CSS
  } else {
    document.body.classList.remove("highlight-mode");
  }
}

/* tool buttons in popup */
document.getElementById("pen-tool-btn-popup").addEventListener("click", () => { setTool("pen"); setActiveToolUI("pen"); });
document.getElementById("highlight-tool-btn").addEventListener("click", () => { setTool("marker"); setActiveToolUI("marker"); });
document.getElementById("eraser-tool-btn-popup").addEventListener("click", () => { setTool("eraser"); setActiveToolUI("eraser"); });

function setActiveToolUI(name) {
  document.querySelectorAll(".tool-btn").forEach(b => b.classList.toggle("active", b.id.includes(name)));
}

/* color swatches */
colorSwatches.forEach(s => {
  s.addEventListener("click", () => {
    colorSwatches.forEach(x => x.classList.remove("active"));
    s.classList.add("active");
    drawColor = s.dataset.color;
  });
});

/* brush size input */
brushSizeInput.addEventListener("input", (e) => {
  brushSize = parseInt(e.target.value, 10) || 40;
});

/* clear page highlights */
clearHighlightsBtn.addEventListener("click", () => {
  if (confirm("Clear all highlights on this page?")) {
    clearPageHighlights();
  }
});

/* init canvas pointer events */
attachCanvasPointerEvents();

/* =================== Initialization on DOM ready =================== */

async function init() {
  // Build UI parts
  buildThumbnails();
  buildIndexMenu();
  updatePageCounter();

  // Load book text for search
  await loadBookText();

  // init hammer gestures
  initHammer();

  // responsive: update canvas on window resize
  window.addEventListener("resize", debounce(() => {
    resizeCanvasToImage();
  }, 200));

  // load first page
  loadPage(1);
}

/* run init */
init().catch(err => console.error("Init error:", err));

/* =================== Utility functions =================== */

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}
