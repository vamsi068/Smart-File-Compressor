/* ==========================================================
   SMART FILE COMPRESSOR + CAMERA SCANNER — v6 PRO JS (2025)
   ========================================================== */

/* ======= GLOBAL ELEMENTS ======= */
const fileInput = document.getElementById("fileInput");
const sizeSelect = document.getElementById("sizeSelect");
const sizeInput = document.getElementById("sizeInput");
const formatSelect = document.getElementById("formatSelect");
const compressBtn = document.getElementById("compressBtn");
const imgToPdfBtn = document.getElementById("imgToPdfBtn");
const pdfToImgBtn = document.getElementById("pdfToImgBtn");
const downloadAllBtn = document.getElementById("downloadAllBtn");
const clearBtn = document.getElementById("clearBtn");
const info = document.getElementById("info");
const results = document.getElementById("results");

/* ======= CAMERA ELEMENTS ======= */
let stream = null;
let usingFrontCamera = false;
let capturedImage = null;
let cornerCanvas = null;
let cornerCtx = null;

const cameraView = document.getElementById("cameraView");
const captureBtn = document.getElementById("captureBtn");
const startCameraBtn = document.getElementById("startCameraBtn");
const downloadBtn = document.getElementById("downloadBtn");
const pdfBtn = document.getElementById("pdfBtn");
const snapshot = document.getElementById("snapshot");
const previewArea = document.getElementById("previewArea");
const scannedItems = document.getElementById("scannedItems");

/* ======= UTIL ======= */
function showMessage(msg) {
  console.log("ℹ️ " + msg);
  info.textContent = msg;
  setTimeout(() => (info.textContent = ""), 3000);
}

/* ==========================================================
   FILE COMPRESSION / CONVERSION
   ========================================================== */
compressBtn?.addEventListener("click", async () => {
  const files = [...fileInput.files];
  if (!files.length) return alert("Please select files to compress.");

  const targetKB =
    sizeSelect.value === "custom"
      ? parseSize(sizeInput.value)
      : parseInt(sizeSelect.value, 10);

  if (isNaN(targetKB) || targetKB <= 0)
    return alert("Invalid target size.");

  info.textContent = "⏳ Compressing files...";
  results.innerHTML = "";

  for (const file of files) {
    const result = await compressFile(file, targetKB * 1024, formatSelect.value);
    results.appendChild(result);
  }

  info.textContent = "✅ Done!";
  downloadAllBtn.disabled = false;
});

/* ===== Compress Logic ===== */
async function compressFile(file, targetBytes, format) {
  const card = document.createElement("div");
  card.className = "result-card";
  const name = file.name;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const maxW = 1200;
  const scale = Math.min(1, maxW / img.width);
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let quality = 0.9;
  let blob = await new Promise((res) =>
    canvas.toBlob(res, format, quality)
  );

  // Iterative compression
  while (blob.size > targetBytes && quality > 0.1) {
    quality -= 0.05;
    blob = await new Promise((res) =>
      canvas.toBlob(res, format, quality)
    );
  }

  const compressedURL = URL.createObjectURL(blob);
  const sizeKB = (blob.size / 1024).toFixed(1);

  card.innerHTML = `
    <img src="${compressedURL}" alt="">
    <div class="meta"><b>${name}</b></div>
    <p class="small">≈ ${sizeKB} KB</p>
    <a href="${compressedURL}" download="compressed_${name}" class="btn">⬇ Download</a>
  `;
  return card;
}

function parseSize(val) {
  if (!val) return NaN;
  const num = parseFloat(val);
  if (val.toLowerCase().includes("mb")) return num * 1024;
  return num;
}

/* ==========================================================
   IMAGE → PDF & PDF → IMAGES
   ========================================================== */
imgToPdfBtn?.addEventListener("click", async () => {
  const files = [...fileInput.files].filter((f) => f.type.startsWith("image/"));
  if (!files.length) return alert("Select image files first.");

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  for (let i = 0; i < files.length; i++) {
    const img = new Image();
    img.src = URL.createObjectURL(files[i]);
    await img.decode();

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageW / img.width, pageH / img.height);
    const w = img.width * ratio;
    const h = img.height * ratio;

    if (i > 0) pdf.addPage();
    pdf.addImage(img, "JPEG", (pageW - w) / 2, (pageH - h) / 2, w, h);
  }

  pdf.save("converted_images.pdf");
});

pdfToImgBtn?.addEventListener("click", async () => {
  const files = [...fileInput.files].filter((f) => f.type === "application/pdf");
  if (!files.length) return alert("Select PDF files first.");

  info.textContent = "⏳ Extracting images from PDF...";
  results.innerHTML = "";

  for (const pdfFile of files) {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;

      const imgURL = canvas.toDataURL("image/jpeg");
      const card = document.createElement("div");
      card.className = "result-card";
      card.innerHTML = `<img src="${imgURL}" alt="">
        <div class="meta"><b>${pdfFile.name} — Page ${i}</b></div>
        <a href="${imgURL}" download="page${i}.jpg" class="btn">⬇ Download</a>`;
      results.appendChild(card);
    }
  }
  info.textContent = "✅ Done!";
});

/* ==========================================================
   DOWNLOAD ALL
   ========================================================== */
downloadAllBtn?.addEventListener("click", async () => {
  const imgs = results.querySelectorAll("a[download]");
  if (!imgs.length) return alert("No compressed files yet.");
  for (const a of imgs) a.click();
});

/* ==========================================================
   CLEAR
   ========================================================== */
clearBtn?.addEventListener("click", () => {
  results.innerHTML = "";
  info.textContent = "";
  fileInput.value = "";
  downloadAllBtn.disabled = true;
});

/* ==========================================================
   CAMERA SCANNER SECTION
   ========================================================== */

// === DYNAMIC SWITCH BUTTON ===
if (document.querySelector(".controls")) {
  const switchBtn = document.createElement("button");
  switchBtn.textContent = "🔄 Switch Camera";
  switchBtn.id = "switchCameraBtn";
  document.querySelector(".controls").appendChild(switchBtn);

  switchBtn.addEventListener("click", async () => {
    usingFrontCamera = !usingFrontCamera;
    await startCamera(usingFrontCamera ? "user" : "environment");
  });
}

// ===== START CAMERA =====
async function startCamera(facingMode = "environment") {
  if (stream) stopCamera();

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode },
      audio: false
    });
    cameraView.srcObject = stream;
    captureBtn.disabled = false;
    showMessage(`Camera started (${facingMode})`);
  } catch (err) {
    alert("Unable to access camera: " + err.message);
  }
}

// ===== STOP CAMERA =====
function stopCamera() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

// ===== BUTTONS =====
startCameraBtn?.addEventListener("click", async () => {
  await startCamera(usingFrontCamera ? "user" : "environment");
});

captureBtn?.addEventListener("click", async () => {
  if (!stream) return;
  const ctx = snapshot.getContext("2d");
  snapshot.width = cameraView.videoWidth;
  snapshot.height = cameraView.videoHeight;
  ctx.drawImage(cameraView, 0, 0, snapshot.width, snapshot.height);
  capturedImage = snapshot.toDataURL("image/jpeg");

  previewArea.innerHTML = `<img src="${capturedImage}" id="capturedPreview" alt="Captured">`;
  addCornerSelector();
  downloadBtn.disabled = false;
  pdfBtn.disabled = false;
});

// ===== CORNER SELECTOR OVERLAY =====
function addCornerSelector() {
  if (cornerCanvas) cornerCanvas.remove();
  cornerCanvas = document.createElement("canvas");
  cornerCanvas.id = "cornerCanvas";
  cornerCanvas.width = snapshot.width;
  cornerCanvas.height = snapshot.height;
  cornerCanvas.style.position = "absolute";
  cornerCanvas.style.top = "0";
  cornerCanvas.style.left = "0";
  cornerCanvas.style.width = "100%";
  cornerCanvas.style.height = "100%";
  cornerCanvas.style.zIndex = "10";
  previewArea.appendChild(cornerCanvas);

  cornerCtx = cornerCanvas.getContext("2d");
  const w = cornerCanvas.width;
  const h = cornerCanvas.height;

  let corners = [
    { x: w * 0.2, y: h * 0.2 },
    { x: w * 0.8, y: h * 0.2 },
    { x: w * 0.8, y: h * 0.8 },
    { x: w * 0.2, y: h * 0.8 }
  ];

  function drawCorners() {
    cornerCtx.clearRect(0, 0, w, h);
    cornerCtx.strokeStyle = "#0ff8";
    cornerCtx.lineWidth = 3;
    cornerCtx.beginPath();
    corners.forEach((pt) => cornerCtx.lineTo(pt.x, pt.y));
    cornerCtx.closePath();
    cornerCtx.stroke();

    corners.forEach((pt) => {
      cornerCtx.beginPath();
      cornerCtx.arc(pt.x, pt.y, 10, 0, Math.PI * 2);
      cornerCtx.fillStyle = "#0ff";
      cornerCtx.fill();
      cornerCtx.strokeStyle = "#000";
      cornerCtx.stroke();
    });
  }

  drawCorners();

  let dragIndex = -1;
  cornerCanvas.addEventListener("mousedown", (e) => {
    const rect = cornerCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    corners.forEach((pt, i) => {
      if (Math.hypot(pt.x - x, pt.y - y) < 20) dragIndex = i;
    });
  });

  cornerCanvas.addEventListener("mousemove", (e) => {
    if (dragIndex < 0) return;
    const rect = cornerCanvas.getBoundingClientRect();
    corners[dragIndex].x = e.clientX - rect.left;
    corners[dragIndex].y = e.clientY - rect.top;
    drawCorners();
  });

  cornerCanvas.addEventListener("mouseup", () => (dragIndex = -1));
  cornerCanvas.addEventListener("mouseleave", () => (dragIndex = -1));
}

// ===== DOWNLOAD IMAGE =====
downloadBtn?.addEventListener("click", () => {
  if (!capturedImage) return;
  const a = document.createElement("a");
  a.href = capturedImage;
  a.download = "scanned_image.jpg";
  a.click();
  addToList(capturedImage, "scanned_image.jpg");
});

// ===== EXPORT PDF =====
pdfBtn?.addEventListener("click", async () => {
  if (!capturedImage) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "px", format: "a4" });
  const imgProps = doc.getImageProperties(capturedImage);
  const pdfWidth = doc.internal.pageSize.getWidth();
  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
  doc.addImage(capturedImage, "JPEG", 0, 0, pdfWidth, pdfHeight);
  const pdfBlob = doc.output("blob");
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "scanned_document.pdf";
  a.click();
  addToList(url, "scanned_document.pdf");
});

// ===== CLEAR CAMERA =====
clearBtn?.addEventListener("click", () => {
  stopCamera();
  cameraView.srcObject = null;
  previewArea.innerHTML = "";
  scannedItems.innerHTML = "";
  capturedImage = null;
  captureBtn.disabled = true;
  downloadBtn.disabled = true;
  pdfBtn.disabled = true;
  showMessage("Cleared.");
});

function addToList(src, name) {
  const card = document.createElement("div");
  card.className = "result-card";
  if (name.endsWith(".pdf")) {
    card.innerHTML = `<div class="meta"><b>${name}</b></div><p>📄 PDF saved</p>`;
  } else {
    card.innerHTML = `<img src="${src}" alt=""><div class="meta"><b>${name}</b></div>`;
  }
  scannedItems.prepend(card);
}
