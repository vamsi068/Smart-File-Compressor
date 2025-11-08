// =========================================================
// SMART FILE COMPRESSOR + CONVERTER + PDF TOOLS (FINAL MERGED)
// =========================================================

// ---------- DOM ----------
const fileInput = document.getElementById('fileInput');
const compressBtn = document.getElementById('compressBtn');
const imgToPdfBtn = document.getElementById('imgToPdfBtn');
const pdfToImgBtn = document.getElementById('pdfToImgBtn');
const clearBtn = document.getElementById('clearBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const sizeSelect = document.getElementById('sizeSelect');
const sizeInput = document.getElementById('sizeInput');
const formatSelect = document.getElementById('formatSelect');
const resultsEl = document.getElementById('results');
const info = document.getElementById('info');
const themeSwitch = document.getElementById('themeSwitch');

let currentFiles = [];
let processedFiles = [];

// ---------- HELPERS ----------
function showInfo(txt, isError = false) {
  info.innerHTML = `<div style="color:${isError ? '#ff6b6b' : '#374151'}">${txt}</div>`;
}
function bytesToKB(b) {
  return (b / 1024).toFixed(1) + ' KB';
}
function getTargetBytes() {
  if (sizeSelect.value !== 'custom') return Number(sizeSelect.value) * 1024;
  const v = sizeInput.value.trim().toUpperCase();
  if (!v) return null;
  const n = parseFloat(v);
  if (isNaN(n)) return null;
  const unit = v.replace(/[0-9.\s]/g, '');
  if (unit === 'MB') return n * 1024 * 1024;
  return n * 1024;
}
function dataURLToBlob(dataURL) {
  const [meta, data] = dataURL.split(',');
  const mime = meta.match(/:(.*?);/)[1];
  const bin = atob(data);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// ---------- CARD UI ----------
function createCard(file) {
  const card = document.createElement('div');
  card.className = 'result-card';
  card.innerHTML = `
    <img src="${URL.createObjectURL(file)}" alt="">
    <div class="meta"><strong>${file.name}</strong></div>
    <div class="small">Original: ${bytesToKB(file.size)}</div>
    <div class="progress" style="margin-top:6px"><div class="bar"></div></div>
    <div class="card-actions"></div>
  `;
  resultsEl.prepend(card);
  return card;
}

function updateCard(card, percent, text) {
  const bar = card.querySelector('.bar');
  const small = card.querySelector('.small');
  if (bar) bar.style.width = Math.min(100, Math.max(0, percent)) + '%';
  if (small && text) small.textContent = text;
}

function attachDownload(card, blob, filename) {
  const btns = card.querySelector('.card-actions');
  btns.innerHTML = '';
  const dl = document.createElement('button');
  dl.textContent = 'Download';
  dl.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  const previewBtn = document.createElement('button');
  previewBtn.textContent = 'Preview';
  previewBtn.addEventListener('click', () => {
    const w = window.open();
    w.document.body.style.margin = 0;
    if (blob.type.startsWith('image/')) {
      const img = w.document.createElement('img');
      img.src = URL.createObjectURL(blob);
      img.style.maxWidth = '100%';
      w.document.body.appendChild(img);
    } else {
      const p = w.document.createElement('pre');
      p.textContent = 'Cannot preview this file type.';
      w.document.body.appendChild(p);
    }
  });
  btns.appendChild(dl);
  btns.appendChild(previewBtn);
}

// ---------- IMAGE COMPRESSION ----------
async function compressAndConvertImage(file, targetBytes, outMime, card, progressCb) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    const img = new Image();
    reader.onload = (e) => (img.src = e.target.result);
    reader.readAsDataURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const MAX_WIDTH = 2500;
      let width = img.width;
      let height = img.height;
      if (width > MAX_WIDTH) {
        const scale = MAX_WIDTH / width;
        width *= scale;
        height *= scale;
      }

      let scale = 1,
        quality = 0.92,
        bestBlob = null,
        attempts = 0;
      const MAX_ATTEMPTS = 40;

      function render(q, s) {
        canvas.width = width * s;
        canvas.height = height * s;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        try {
          const dataURL = canvas.toDataURL(outMime, q);
          return dataURLToBlob(dataURL);
        } catch {
          return dataURLToBlob(canvas.toDataURL('image/jpeg', q));
        }
      }

      (function iterate() {
        attempts++;
        const blob = render(quality, scale);
        if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
        progressCb && progressCb({ attempts, quality, scale, size: blob.size, bestSize: bestBlob.size });

        if (bestBlob.size <= targetBytes || attempts >= MAX_ATTEMPTS || quality < 0.05) {
          const outFile = new File(
            [bestBlob],
            file.name.replace(/\.[^/.]+$/, '') +
              (outMime === 'image/jpeg'
                ? '.jpg'
                : outMime === 'image/png'
                ? '.png'
                : outMime === 'image/webp'
                ? '.webp'
                : '.img'),
            { type: bestBlob.type }
          );
          return resolve(outFile);
        }

        if (quality > 0.15) quality -= 0.07;
        else scale *= 0.9;
        requestAnimationFrame(iterate);
      })();
    };
    img.onerror = () => resolve(file);
  });
}

// ---------- IMAGE -> PDF ----------
async function imagesToPdf(files) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('jsPDF not loaded.');
    return null;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let first = true;
  for (const f of files) {
    const imgURL = URL.createObjectURL(f);
    const img = new Image();
    await new Promise((res) => {
      img.onload = res;
      img.src = imgURL;
    });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    let w = img.width,
      h = img.height;
    const ratio = Math.min(pageW / w, pageH / h);
    w *= ratio;
    h *= ratio;
    const x = (pageW - w) / 2;
    const y = (pageH - h) / 2;
    if (!first) doc.addPage();
    first = false;
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d').drawImage(img, 0, 0);
    const dataURL = canvas.toDataURL('image/jpeg', 0.9);
    doc.addImage(dataURL, 'JPEG', x, y, w, h);
    URL.revokeObjectURL(imgURL);
  }
  return doc.output('blob');
}

// ---------- PDF -> IMAGES ----------
async function pdfToImages(file, onPage) {
  if (!window.pdfjsLib) {
    alert('pdf.js not loaded.');
    return [];
  }
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.172/pdf.worker.min.js';
  }
  const data = await file.arrayBuffer();
  const loading = pdfjsLib.getDocument({ data });
  const pdf = await loading.promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataURL = canvas.toDataURL('image/jpeg', 0.9);
    const blob = dataURLToBlob(dataURL);
    pages.push({ page: p, blob });
    onPage && onPage(p, blob);
  }
  return pages;
}

// ---------- IMAGE → TEXT (OCR) ----------
const imgToTextBtn = document.getElementById("imgToTextBtn");
imgToTextBtn &&
  imgToTextBtn.addEventListener("click", async () => {
    const imgs = currentFiles.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return alert("Select image files first.");
    showInfo("Extracting text from image(s)...");
    for (const img of imgs) {
      const { data } = await Tesseract.recognize(img, "eng", {
        logger: (m) => showInfo(`🧠 OCR: ${m.status} ${(m.progress * 100).toFixed(0)}%`)
      });
      const card = document.createElement("div");
      card.className = "result-card text-card";
      card.innerHTML = `<div class="meta"><b>${img.name}</b></div>
                        <textarea readonly>${data.text.trim() || "(No text detected)"}</textarea>
                        <div class="card-actions"></div>`;
      resultsEl.prepend(card);

      const blob = new Blob([data.text], { type: "text/plain" });
      attachDownload(card, blob, img.name.replace(/\.[^/.]+$/, "") + "_ocr.txt");
    }
    showInfo("Image → Text complete ✅");
  });

// ---------- PDF → TEXT ----------
const pdfToTextBtn = document.getElementById("pdfToTextBtn");
pdfToTextBtn &&
  pdfToTextBtn.addEventListener("click", async () => {
    const pdfs = currentFiles.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) return alert("Select PDF files first.");
    showInfo("Extracting text from PDF(s)...");
    for (const pdf of pdfs) {
      const data = await pdf.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
      let fullText = "";
      for (let p = 1; p <= pdfDoc.numPages; p++) {
        const page = await pdfDoc.getPage(p);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((i) => i.str).join(" ");
        fullText += `\n\n--- Page ${p} ---\n${pageText}`;
        showInfo(`Extracting PDF page ${p}...`);
      }
      if (!fullText.trim()) {
        showInfo("No embedded text found — using OCR fallback...");
        const pages = await pdfToImages(pdf);
        for (const pg of pages) {
          const { data } = await Tesseract.recognize(pg.blob, "eng");
          fullText += `\n\n--- OCR Page ${pg.page} ---\n${data.text}`;
        }
      }

      const blob = new Blob([fullText.trim()], { type: "text/plain" });
      const card = document.createElement("div");
      card.className = "result-card text-card";
      card.innerHTML = `<div class="meta"><b>${pdf.name}</b></div>
                        <textarea readonly>${fullText.trim().slice(0, 2000)}${fullText.length > 2000 ? "\n...(truncated)" : ""}</textarea>
                        <div class="card-actions"></div>`;
      resultsEl.prepend(card);
      attachDownload(card, blob, pdf.name.replace(/\.pdf$/i, "") + "_text.txt");
    }
    showInfo("PDF → Text complete ✅");
  });

// ---------- TEXT → IMAGE ----------
const textToImgBtn = document.getElementById("textToImgBtn");
textToImgBtn &&
  textToImgBtn.addEventListener("click", async () => {
    const inputText = prompt("Enter or paste text to convert into image:");
    if (!inputText) return;
    showInfo("Rendering text to image...");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const fontSize = 20;
    const lines = inputText.split("\n");
    const maxWidth = Math.max(...lines.map((l) => l.length)) * (fontSize * 0.6);
    const height = lines.length * (fontSize * 1.4) + 40;

    canvas.width = Math.min(maxWidth + 40, 2000);
    canvas.height = height;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000";
    ctx.font = `${fontSize}px Arial`;
    lines.forEach((line, i) => {
      ctx.fillText(line, 20, 30 + i * (fontSize * 1.4));
    });

    const dataURL = canvas.toDataURL("image/png");
    const blob = dataURLToBlob(dataURL);
    const card = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = `<img src="${dataURL}"><div class="meta"><b>Text → Image</b></div>
                      <div class="small">${bytesToKB(blob.size)}</div>
                      <div class="card-actions"></div>`;
    resultsEl.prepend(card);
    attachDownload(card, blob, "text_image.png");
    showInfo("Text → Image complete ✅");
  });



// ---------- EVENTS ----------
themeSwitch &&
  themeSwitch.addEventListener('change', (e) => {
    document.body.classList.toggle('dark', e.target.checked);
  });

sizeSelect.addEventListener('change', () => {
  sizeInput.style.display = sizeSelect.value === 'custom' ? 'block' : 'none';
});

fileInput.addEventListener('change', () => {
  currentFiles = Array.from(fileInput.files);
  resultsEl.innerHTML = '';
  processedFiles = [];
  downloadAllBtn.disabled = true;
  showInfo(`${currentFiles.length} file(s) selected.`);
  currentFiles.forEach((f) => {
    const card = createCard(f);
    updateCard(card, 0, `Original: ${bytesToKB(f.size)}`);
    f._card = card;
  });
});

// ---------- Compress ----------
compressBtn.addEventListener('click', async () => {
  if (!currentFiles.length) return alert('Select files first.');
  const targetBytes = getTargetBytes();
  if (!targetBytes) return alert('Enter/choose a valid size.');
  const outMime = (formatSelect && formatSelect.value) || 'image/jpeg';
  processedFiles = [];
  showInfo('Compressing images...');

  for (const f of currentFiles) {
    const card = f._card || createCard(f);
    if (!f.type.startsWith('image/')) {
      updateCard(card, 100, 'Skipped (not image)');
      continue;
    }
    updateCard(card, 10, 'Compressing...');
    const converted = await compressAndConvertImage(f, targetBytes, outMime, card, (p) => {
      updateCard(card, Math.min(98, (targetBytes / (p.bestSize || 1)) * 100), `${bytesToKB(p.bestSize)} est.`);
    });
    attachDownload(card, converted, converted.name);
    updateCard(card, 100, `Done — ${bytesToKB(converted.size)}`);
    processedFiles.push({ file: f, blob: converted });
  }

  downloadAllBtn.disabled = processedFiles.length <= 1;
  showInfo('Compression complete ✅');
});

// ---------- Image → PDF ----------
imgToPdfBtn &&
  imgToPdfBtn.addEventListener('click', async () => {
    const imgs = currentFiles.filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) return alert('Select one or more images.');
    showInfo('Creating PDF...');
    const pdfBlob = await imagesToPdf(imgs);
    if (!pdfBlob) return showInfo('Failed to create PDF.', true);
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `<div class="meta"><strong>Images → PDF</strong></div>
                      <div class="small">${imgs.length} image(s)</div>
                      <div class="card-actions"></div>`;
    resultsEl.prepend(card);
    attachDownload(card, pdfBlob, 'merged.pdf');
    updateCard(card, 100, `PDF size: ${bytesToKB(pdfBlob.size)}`);
    showInfo('PDF ready ✅');
  });

// ---------- PDF → Images ----------
pdfToImgBtn &&
  pdfToImgBtn.addEventListener('click', async () => {
    const pdfs = currentFiles.filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (!pdfs.length) return alert('Select PDF files first.');
    showInfo('Converting PDFs...');
    for (const pdf of pdfs) {
      const pages = await pdfToImages(pdf, (p) => showInfo(`Rendering page ${p}...`));
      pages.forEach((pg) => {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `<img src="${URL.createObjectURL(pg.blob)}">
                          <div class="meta"><b>${pdf.name} — page ${pg.page}</b></div>
                          <div class="small">${bytesToKB(pg.blob.size)}</div>
                          <div class="card-actions"></div>`;
        resultsEl.prepend(card);
        attachDownload(card, pg.blob, `${pdf.name.replace(/\.pdf$/i, '')}_p${pg.page}.jpg`);
      });
    }
    showInfo('PDF → Images complete ✅');
  });

// ---------- Download All ----------
downloadAllBtn.addEventListener('click', () => {
  if (!processedFiles.length) return;
  processedFiles.forEach((p, i) => {
    setTimeout(() => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(p.blob);
      a.download = p.blob.name || p.file.name;
      a.click();
      URL.revokeObjectURL(a.href);
    }, i * 300);
  });
});

// ---------- Clear ----------
clearBtn.addEventListener('click', () => {
  fileInput.value = '';
  currentFiles = [];
  processedFiles = [];
  resultsEl.innerHTML = '';
  downloadAllBtn.disabled = true;
  showInfo('Cleared.');
});

// ---------- Drag & Drop ----------
const filebox = document.querySelector('.filebox');
if (filebox) {
  ['dragenter', 'dragover'].forEach((ev) =>
    filebox.addEventListener(ev, (e) => {
      e.preventDefault();
      filebox.classList.add('drag');
    })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    filebox.addEventListener(ev, (e) => {
      e.preventDefault();
      filebox.classList.remove('drag');
    })
  );
  filebox.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length) {
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change'));
    }
  });
}

showInfo('Ready — select files to begin.');
