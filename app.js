// =======================
// Interactive eBook Viewer
// =======================
let currentPage = 1;
let totalPages = config.totalPages || 0;
let bookText = {};
let isLoggedIn = !config.requireLogin;
const proxyUrl = config.proxyUrl; // Google Apps Script Proxy URL

// --------------------
// Utility Functions
// --------------------
async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

function updatePageDisplay() {
  const img = document.getElementById("pageImage");
  img.src = `${config.imagePath}${currentPage}.png`;
  document.getElementById("pageInput").value = currentPage;
  document.getElementById("pageCount").textContent = `/ ${totalPages}`;
}

// --------------------
// Page Navigation
// --------------------
function goToPage(num) {
  if (num < 1 || num > totalPages) return;
  currentPage = num;
  updatePageDisplay();
}

// --------------------
// AI Helper
// --------------------
async function callAI(action, payload = {}) {
  const aiResponse = document.getElementById("aiResponse");
  aiResponse.textContent = "";
  document.getElementById("aiLoading").classList.remove("hidden");
  document.getElementById("translateResponseBtn").classList.add("hidden");

  try {
    const response = await fetchWithRetry(proxyUrl, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({action, payload})
    });

    aiResponse.innerHTML = marked.parse(response.text || "No response");
    document.getElementById("translateResponseBtn").classList.remove("hidden");
  } catch (err) {
    aiResponse.textContent = `⚠️ Error: ${err.message}`;
  } finally {
    document.getElementById("aiLoading").classList.add("hidden");
  }
}

// --------------------
// AI Helper Modal Logic
// --------------------
const aiModal = document.getElementById("aiHelperModal");
document.getElementById("aiBtn").onclick = () => aiModal.classList.remove("hidden");
document.getElementById("closeAI").onclick = () => aiModal.classList.add("hidden");

document.querySelectorAll(".ai-action").forEach(btn => {
  btn.onclick = async () => {
    const action = btn.dataset.action;
    if (action === "translate") {
      translatePage();
      aiModal.classList.add("hidden");
    } else if (action === "analyze") {
      const img = document.getElementById("pageImage");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      const base64 = canvas.toDataURL("image/png");
      callAI("analyze", {image: base64, page: currentPage});
    } else {
      const text = bookText[currentPage - 1] || "";
      callAI(action, {text, page: currentPage});
    }
  };
});

document.getElementById("translateResponseBtn").onclick = async () => {
  const text = document.getElementById("aiResponse").innerText;
  await callAI("translateText", {text});
  document.getElementById("aiResponse").innerHTML += "<br><em>(Translated)</em>";
};

// --------------------
// Page Translation
// --------------------
async function translatePage() {
  const text = bookText[currentPage - 1] || "";
  const overlay = document.getElementById("overlay-translation");
  const content = document.getElementById("translationContent");
  overlay.classList.remove("hidden");
  content.textContent = "Translating...";
  try {
    const res = await fetchWithRetry(proxyUrl, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({action: "translatePage", payload: {text}})
    });
    content.innerHTML = marked.parse(res.text || "No translation available");
  } catch (err) {
    content.textContent = `Error: ${err.message}`;
  }
}

document.getElementById("closeTranslation").onclick = () => {
  document.getElementById("overlay-translation").classList.add("hidden");
};

// --------------------
// Init
// --------------------
(async function init() {
  // Load text
  try {
    const res = await fetch("book-text.json");
    bookText = await res.json();
    document.getElementById("searchBtn").disabled = false;
  } catch {}

  totalPages = config.totalPages;
  updatePageDisplay();

  // Navigation buttons
  document.getElementById("firstBtn").onclick = () => goToPage(1);
  document.getElementById("prevBtn").onclick = () => goToPage(currentPage - 1);
  document.getElementById("nextBtn").onclick = () => goToPage(currentPage + 1);
  document.getElementById("lastBtn").onclick = () => goToPage(totalPages);
  document.getElementById("pageInput").onchange = e => goToPage(parseInt(e.target.value));
})();
