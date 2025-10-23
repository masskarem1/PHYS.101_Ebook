// ======================= CONFIG =======================
const config = {
  imagePath: "images/",
  thumbPath: "thumbs/",
  filePrefix: "Book_PHYS101_",
  imageExt: ".png",
  thumbExt: ".jpg",
  totalPages: 230, // adjust based on your images
  aiProxy: "/ai-proxy"
};

// ======================= INIT =======================
document.addEventListener("DOMContentLoaded", () => {
  initFlipbook();
  initAIHelper();
  console.log("E-Book App Initialized ✅");
});

// ======================= FLIPBOOK =======================
let currentPage = 0;

function initFlipbook() {
  const flipbook = document.getElementById("flipbook");
  if (!flipbook) return;

  loadPage(currentPage);

  document.getElementById("nextPage").addEventListener("click", nextPage);
  document.getElementById("prevPage").addEventListener("click", prevPage);
}

function loadPage(pageNumber) {
  const flipbook = document.getElementById("flipbook");
  if (!flipbook) return;

  const pageImg = `${config.imagePath}${config.filePrefix}${pageNumber}${config.imageExt}`;
  flipbook.innerHTML = `<img src="${pageImg}" class="page-image" alt="Page ${pageNumber}">`;

  // Try both MathJax v3 and v2
  if (window.MathJax) {
    if (typeof MathJax.typesetPromise === "function") {
      MathJax.typesetPromise();
    } else if (typeof MathJax.Hub !== "undefined") {
      MathJax.Hub.Queue(["Typeset", MathJax.Hub, flipbook]);
    }
  }
}

function nextPage() {
  if (currentPage < config.totalPages - 1) {
    currentPage++;
    loadPage(currentPage);
  }
}

function prevPage() {
  if (currentPage > 0) {
    currentPage--;
    loadPage(currentPage);
  }
}

// ======================= TOOLBAR FUNCTIONS =======================
function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

function shareBook() {
  if (navigator.share) {
    navigator.share({
      title: "PHYS101 eBook",
      text: "Check out this interactive Physics eBook!",
      url: window.location.href
    }).catch(err => console.log("Share canceled:", err));
  } else {
    alert("Sharing is not supported on this browser.");
  }
}

// ======================= AI HELPER MODAL =======================
function initAIHelper() {
  const aiButton = document.getElementById("aiHelperBtn");
  const aiModal = document.getElementById("aiHelperModal");
  const aiClose = document.getElementById("aiHelperClose");
  const aiForm = document.getElementById("aiHelperForm");
  const aiOutput = document.getElementById("aiHelperOutput");

  if (!aiButton || !aiModal) return;

  aiButton.addEventListener("click", () => aiModal.style.display = "block");
  aiClose.addEventListener("click", () => aiModal.style.display = "none");

  aiForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const query = document.getElementById("aiHelperInput").value.trim();
    if (!query) return;

    aiOutput.innerHTML = "🤖 Thinking...";

    try {
      const response = await fetch(config.aiProxy, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });
      const data = await response.json();
      aiOutput.innerHTML = data.answer || "No answer found.";
    } catch (err) {
      aiOutput.innerHTML = "❌ Error fetching AI response.";
      console.error(err);
    }
  });

  // Close modal on outside click
  window.addEventListener("click", (event) => {
    if (event.target === aiModal) aiModal.style.display = "none";
  });
}
