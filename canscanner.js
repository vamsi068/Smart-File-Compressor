let stream = null;
const cameraView = document.getElementById("cameraView");
const captureBtn = document.getElementById("captureBtn");
const startCameraBtn = document.getElementById("startCameraBtn");
const downloadBtn = document.getElementById("downloadBtn");
const pdfBtn = document.getElementById("pdfBtn");
const clearBtn = document.getElementById("clearBtn");
const snapshot = document.getElementById("snapshot");
const previewArea = document.getElementById("previewArea");
const scannedItems = document.getElementById("scannedItems");

let capturedImage = null;

// Start camera
startCameraBtn.addEventListener("click", async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    cameraView.srcObject = stream;
    captureBtn.disabled = false;
    showMessage("Camera started");
  } catch (err) {
    alert("Unable to access camera: " + err.message);
  }
});

// Capture snapshot
captureBtn.addEventListener("click", () => {
  if (!stream) return;
  const videoTrack = stream.getVideoTracks()[0];
  const settings = videoTrack.getSettings();
  snapshot.width = cameraView.videoWidth;
  snapshot.height = cameraView.videoHeight;
  const ctx = snapshot.getContext("2d");
  ctx.drawImage(cameraView, 0, 0, snapshot.width, snapshot.height);

  capturedImage = snapshot.toDataURL("image/jpeg");
  previewArea.innerHTML = `<img src="${capturedImage}" alt="Captured Image">`;
  downloadBtn.disabled = false;
  pdfBtn.disabled = false;
});

// Download image
downloadBtn.addEventListener("click", () => {
  if (!capturedImage) return;
  const a = document.createElement("a");
  a.href = capturedImage;
  a.download = "scanned_image.jpg";
  a.click();
  addToList(capturedImage, "scanned_image.jpg");
});

// Convert to PDF
pdfBtn.addEventListener("click", async () => {
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

// Clear everything
clearBtn.addEventListener("click", () => {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  cameraView.srcObject = null;
  previewArea.innerHTML = "";
  capturedImage = null;
  scannedItems.innerHTML = "";
  captureBtn.disabled = true;
  downloadBtn.disabled = true;
  pdfBtn.disabled = true;
  showMessage("Cleared.");
});

function addToList(src, name) {
  const card = document.createElement("div");
  card.className = "result-card";
  if (name.endsWith(".pdf")) {
    card.innerHTML = `<div class="meta"><b>${name}</b></div>
                      <p>📄 PDF saved</p>`;
  } else {
    card.innerHTML = `<img src="${src}" alt=""><div class="meta"><b>${name}</b></div>`;
  }
  scannedItems.prepend(card);
}

function showMessage(msg) {
  console.log("📸 " + msg);
}
