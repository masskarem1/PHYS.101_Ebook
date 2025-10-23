// ================== MAIN APP SCRIPT ==================

// ---------- Globals ----------
let currentPage = 1;
let totalPages = config.totalPages;
let zoom = 1;
let isDrawing = false;
let highlightMode = false;
let highlights = [];

// ---------- DOM References ----------
const flipbook = document.getElementById("flipbook");
const pageImage = document.querySelector(".page-image");
const pageInput = document.getElementById("pageInput");
const pageCounter = document.getElementById("pageCounter");
const indexMenu = document.getElementById("indexMenu");
const indexToggle = document.getElementById("indexToggle");
const thumbbar = document.querySelector(".thumbbar");
const searchContainer = document.getElementById("searchContainer");
const searchBtn = document.getElementById("searchBtn");
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const searchCloseBtn = document.getElementById("searchCloseBtn");
const phetModal = document.getElementById("phetModal");
const phetFrame = document.getElementById("phetFrame");
const phetCloseBtn = document.getElementById("phetCloseBtn");
const videoModal = document.getElementById("videoModal");
const videoFrame = document.getElementById("videoFrame");
const videoCloseBtn = document.getElementById("videoCloseBtn");
const aiHelperToggle = document.getElementById("aiHelperToggle");
const aiHelperModal = document.getElementById("aiHelperModal");
const aiCloseBtn = document.getElementById("aiCloseBtn");
const aiResponse = document.getElementById("aiResponse");

// ---------- Initialization ----------
document.addEventListener("DOMContentLoaded", () => {
  loadPage(1);
  updatePageCounter();
  buildThumbnails();
  buildIndex();
});

// ---------- Page Management ----------
function loadPage(page) {
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  pageImage.src = `${config.imagePath}${page}.jpg`;
  pageInput.value = page;
  updatePageCounter();
  highlightActiveThumb();
  autoOpenMedia(page);
}

function nextPage() {
  if (currentPage < totalPages) loadPage(currentPage + 1);
}

function prevPage() {
  if (currentPage > 1) loadPage(currentPage - 1);
}

function updatePageCounter() {
  pageCounter.textContent = `Page ${currentPage} / ${totalPages}`;
}

// ---------- Thumbnail Bar ----------
function buildThumbnails() {
  thumbbar.innerHTML = "";
  for (let i = 1; i <= totalPages; i++) {
    const img = document.createElement("img");
    img.src = `${config.thumbPath}${i}.jpg`;
    img.addEventListener("click", () => loadPage(i));
    thumbbar.appendChild(img);
  }
  highlightActiveThumb();
}

function highlightActiveThumb() {
  document.querySelectorAll(".thumbbar img").forEach((img, index) => {
    img.classList.toggle("active", index + 1 === currentPage);
  });
}

// ---------- Index Menu ----------
function buildIndex() {
  indexMenu.innerHTML = "";
  config.chapters.forEach(ch => {
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
  indexMenu.style.display = indexMenu.style.display === "flex" ? "none" : "flex";
});

// ---------- Search ----------
searchBtn.addEventListener("click", () => {
  searchContainer.style.display = "flex";
  searchInput.focus();
});
searchCloseBtn.addEventListener("click", () => {
  searchContainer.style.display = "none";
  searchResults.innerHTML = "";
  searchInput.value = "";
});

// Demo search (basic placeholder)
searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim().toLowerCase();
  searchResults.innerHTML = "";
  if (!q) return;

  const matches = config.chapters.filter(c => c.title.toLowerCase().includes(q));
  if (matches.length === 0) {
    searchResults.innerHTML = `<div class="no-results">No results</div>`;
  } else {
    matches.forEach(m => {
      const div = document.createElement("div");
      div.textContent = `${m.title} (p.${m.page})`;
      div.addEventListener("click", () => {
        loadPage(m.page);
        searchContainer.style.display = "none";
      });
      searchResults.appendChild(div);
    });
  }
});

// ---------- PhET & Video ----------
function autoOpenMedia(page) {
  const sim = config.simulations.find(s => s.page === page);
  const vid = config.videos.find(v => v.page === page);
  if (sim) openPhet(sim.url);
  if (vid) openVideo(vid.url);
}

function openPhet(url) {
  phetFrame.src = url;
  phetModal.style.display = "flex";
}
function closePhet() {
  phetModal.style.display = "none";
  phetFrame.src = "";
}
phetCloseBtn.addEventListener("click", closePhet);

function openVideo(url) {
  const embedURL = url.replace("watch?v=", "embed/").replace("shorts/", "embed/");
  videoFrame.src = embedURL;
  videoModal.style.display = "flex";
}
function closeVideo() {
  videoModal.style.display = "none";
  videoFrame.src = "";
}
videoCloseBtn.addEventListener("click", closeVideo);

// ---------- Highlight Mode ----------
const highlightCanvas = document.getElementById("highlight-canvas");
const ctx = highlightCanvas.getContext("2d");

function toggleHighlightMode() {
  highlightMode = !highlightMode;
  document.body.classList.toggle("highlight-mode", highlightMode);
  highlightCanvas.classList.toggle("highlight-cursor", highlightMode);
}

// Placeholder drawing logic (basic box)
highlightCanvas.addEventListener("mousedown", e => {
  if (!highlightMode) return;
  const rect = highlightCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  ctx.fillStyle = "rgba(255,255,0,0.3)";
  ctx.fillRect(x - 30, y - 10, 100, 20);
  highlights.push({ page: currentPage, x, y });
});

// ---------- AI Helper ----------
aiHelperToggle.addEventListener("click", () => {
  aiHelperModal.style.display = "flex";
});
aiCloseBtn.addEventListener("click", () => {
  aiHelperModal.style.display = "none";
  aiResponse.textContent = "";
});

// Proxy Request Function
async function callAIHelper(prompt) {
  aiResponse.textContent = "Thinking...";
  try {
    const res = await fetch(config.aiProxyURL, {
      method: "POST",
      body: JSON.stringify({ prompt }),
      headers: { "Content-Type": "application/json" }
    });
    const data = await res.json();
    aiResponse.textContent = data.response || "No response.";
  } catch (err) {
    aiResponse.textContent = "⚠️ Error contacting AI server.";
  }
}

// Attach button listeners
document.getElementById("summarizeBtn").addEventListener("click", () =>
  callAIHelper(`Summarize page ${currentPage} of the physics textbook.`)
);
document.getElementById("explainBtn").addEventListener("click", () =>
  callAIHelper(`Explain the concept shown on page ${currentPage} in simple terms.`)
);
document.getElementById("quizBtn").addEventListener("click", () =>
  callAIHelper(`Generate 3 quiz questions about the topic on page ${currentPage}.`)
);
document.getElementById("translate-analysis-btn").addEventListener("click", () => {
  aiResponse.classList.toggle("rtl-text");
});

// ---------- Keyboard Shortcuts ----------
document.addEventListener("keydown", e => {
  if (e.key === "ArrowRight") nextPage();
  else if (e.key === "ArrowLeft") prevPage();
});

// ---------- Zoom Placeholder (Optional) ----------
pageImage.addEventListener("wheel", e => {
  e.preventDefault();
  zoom += e.deltaY * -0.001;
  zoom = Math.min(Math.max(zoom, 0.8), 2);
  pageImage.style.transform = `scale(${zoom})`;
});

// ---------- Utility ----------
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}
