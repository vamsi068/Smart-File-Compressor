// ===============================
// Image Compressor (Merged Version)
// ===============================

// ===== DOM Elements =====
const fileInput = document.getElementById("fileInput");
const compressBtn = document.getElementById("compressBtn");
const downloadAllBtn = document.getElementById("downloadAllBtn");
const clearBtn = document.getElementById("clearBtn");
const results = document.getElementById("results");
const info = document.getElementById("info");
const sizeSelect = document.getElementById("sizeSelect");
const sizeInput = document.getElementById("sizeInput");

let compressedFiles = [];

// ===== Toggle custom size input =====
sizeSelect.addEventListener("change", () => {
  sizeInput.style.display = sizeSelect.value === "custom" ? "block" : "none";
});

// ===== Parse selected or custom target size =====
function getTargetBytes() {
  if (sizeSelect.value !== "custom") return parseInt(sizeSelect.value, 10) * 1024;
  const val = sizeInput.value.trim().toUpperCase();
  if (!val) return null;
  const num = parseFloat(val);
  if (isNaN(num)) return null;
  const unit = val.replace(/[0-9.\s]/g, "");
  if (unit === "MB") return num * 1024 * 1024;
  return num * 1024;
}

// ===== DataURL → Blob =====
function dataURLToBlob(dataURL) {
  const [meta, data] = dataURL.split(",");
  const mime = meta.match(/:(.*?);/)[1];
  const bin = atob(data);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// ===== Create Card UI =====
function createCard(file) {
  const div = document.createElement("div");
  div.className = "result";
  div.innerHTML = `
    <img src="${URL.createObjectURL(file)}">
    <p><b>${file.name}</b></p>
    <p>Original: ${(file.size / 1024).toFixed(1)} KB</p>
    <p class="newsize">Compressing...</p>
    <div class="progress"><div class="bar"></div></div>
    <button disabled>Download</button>
  `;
  return div;
}

// ===== Update progress in card =====
function updateCard(card, percent, text) {
  card.querySelector(".bar").style.width = percent + "%";
  if (text) card.querySelector(".newsize").textContent = text;
}

// ===== Image Compression =====
async function compressImage(file, targetBytes, progressCb) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => (img.src = e.target.result);
    reader.readAsDataURL(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      let scale = 1,
        quality = 0.9;
      const maxIter = 40;

      (function tryCompress(iter = 0) {
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const blob = dataURLToBlob(canvas.toDataURL("image/jpeg", quality));
        progressCb(Math.min(100, (targetBytes / blob.size) * 100), `Size: ${(blob.size / 1024).toFixed(1)} KB`);

        if (blob.size <= targetBytes || iter >= maxIter || quality < 0.05) {
          return resolve(new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg" }));
        }

        if (blob.size > targetBytes * 2) scale *= 0.9;
        else quality -= 0.05;

        requestAnimationFrame(() => tryCompress(iter + 1));
      })();
    };

    img.onerror = () => resolve(file);
  });
}

// ===== Compress Button =====
compressBtn.addEventListener("click", async () => {
  const files = [...fileInput.files];
  if (!files.length) return alert("Please select at least one image!");
  const targetBytes = getTargetBytes();
  if (!targetBytes) return alert("Enter or select a valid target size!");

  results.innerHTML = "";
  info.innerHTML = `<p>Compressing ${files.length} image(s)...</p>`;
  compressedFiles = [];

  for (const file of files) {
    const card = createCard(file);
    results.appendChild(card);

    if (!file.type.startsWith("image/")) {
      updateCard(card, 100, "Skipped (not an image)");
      continue;
    }

    const compressed = await compressImage(file, targetBytes, (pct, text) => updateCard(card, pct, text));

    compressedFiles.push(compressed);
    updateCard(card, 100, `Compressed: ${(compressed.size / 1024).toFixed(1)} KB`);

    const btn = card.querySelector("button");
    btn.disabled = false;
    btn.onclick = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(compressed);
      a.download = compressed.name;
      a.click();
    };
  }

  downloadAllBtn.disabled = compressedFiles.length <= 1;
  info.innerHTML += `<p>All tasks finished ✅</p>`;
});

// ===== Download All =====
downloadAllBtn.addEventListener("click", () => {
  compressedFiles.forEach((file, idx) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    setTimeout(() => {
      a.click();
      URL.revokeObjectURL(a.href);
    }, idx * 300);
  });
});

// ===== Clear =====
clearBtn.addEventListener("click", () => {
  fileInput.value = "";
  results.innerHTML = "";
  info.innerHTML = "";
  compressedFiles = [];
  downloadAllBtn.disabled = true;
});
