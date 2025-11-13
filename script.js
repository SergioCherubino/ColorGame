// script.js (tela principal)
let canvas, ctx;
let brushSize = 10;
let currentColor = "black";
let isDrawing = false;
let cursorCanvas, cursorCtx;
let selectedColorIndex = null;
let matrix, palette;

// Camada de pintura persistente (em coordenadas 1px por pixel da matriz)
let paintLayer, paintCtx;

// Contadores e máscara
let totalPixelsByColor = [];
let paintedPixelsByColor = [];
let paintedMask = [];

// Salva estado no localStorage
function saveStateToStorage() {
  try {
    localStorage.setItem("paintedMask", JSON.stringify(paintedMask));
    localStorage.setItem("paintedPixelsByColor", JSON.stringify(paintedPixelsByColor));
    localStorage.setItem("totalPixelsByColor", JSON.stringify(totalPixelsByColor));
  } catch (err) {
    console.warn("Não foi possível salvar no localStorage:", err);
  }
}

async function init() {
  canvas = document.getElementById("paintCanvas");
  ctx = canvas.getContext("2d");

  // Carregar matriz e paleta
  matrix = await fetch("matrix.json").then(r => r.json());
  palette = await fetch("palette.json").then(r => r.json());

  const numColors = palette.length;
  totalPixelsByColor = new Array(numColors).fill(0);
  paintedPixelsByColor = new Array(numColors).fill(0);

  // Tentar recuperar paintedMask do storage (se existir)
  const storedMask = localStorage.getItem("paintedMask");
  if (storedMask) {
    paintedMask = JSON.parse(storedMask);
  } else {
    paintedMask = Array.from({ length: matrix.length }, () =>
      new Array(matrix[0].length).fill(0)
    );
  }

  // Se existirem contadores no storage, recupera
  const sp = JSON.parse(localStorage.getItem("paintedPixelsByColor") || "null");
  const tp = JSON.parse(localStorage.getItem("totalPixelsByColor") || "null");
  if (Array.isArray(sp)) paintedPixelsByColor = sp;
  if (Array.isArray(tp)) totalPixelsByColor = tp;

  // Se totalPixelsByColor estiver vazio (primeira vez), conta
  if (totalPixelsByColor.every(v => v === 0)) {
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[0].length; x++) {
        totalPixelsByColor[matrix[y][x]]++;
      }
    }
  }

  // Dimensões do canvas = dimensões da matriz (1px por pixel)
  canvas.width = matrix[0].length;
  canvas.height = matrix.length;

  // Criar camada persistente
  paintLayer = document.createElement("canvas");
  paintLayer.width = canvas.width;
  paintLayer.height = canvas.height;
  paintCtx = paintLayer.getContext("2d");

  // Se já existirem pixels pintados na máscara, desenha-os na paintLayer
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[0].length; x++) {
      const colorIndex = paintedMask[y]?.[x];
      if (colorIndex && colorIndex > 0) {
        const rgb = palette[colorIndex - 1];
        paintCtx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        paintCtx.fillRect(x, y, 1, 1);
      }
    }
  }

  // Cursor overlay
  cursorCanvas = document.getElementById("cursorCanvas");
  cursorCanvas.width = canvas.width;
  cursorCanvas.height = canvas.height;
  cursorCtx = cursorCanvas.getContext("2d");

  render();
  criarPaleta();

  // Brush control
  const brushInput = document.getElementById("brushSize");
  const brushValue = document.getElementById("brushValue");
  brushInput.addEventListener("input", e => {
    brushSize = parseInt(e.target.value);
    brushValue.textContent = brushSize;
  });

  // Eventos do mouse (pintura)
  canvas.addEventListener("mousedown", startDrawing);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", stopDrawing);
  canvas.addEventListener("mouseleave", stopDrawing);
  canvas.addEventListener("mousemove", updateCursor);

  // Botão que abre o grid (nova tela)
  const toggleBtn = document.getElementById("toggleModeBtn");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      saveStateToStorage();
      window.location.href = "grid.html";
    });
  }

  // --- 🧹 Botão de reset global ---
  const resetBtn = document.getElementById("resetAllBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("Tem certeza que deseja apagar TODO o progresso (todas as pinturas)?")) {
        resetAllProgress();
      }
    });
  }

  // Salvar ao fechar/recaregar
  window.addEventListener("beforeunload", saveStateToStorage);
}

// --- Paleta ---
function criarPaleta() {
  const paletteDiv = document.getElementById("palette");
  paletteDiv.innerHTML = "";

  palette.forEach((color, index) => {
    const btn = document.createElement("button");
    btn.classList.add("color-btn");
    btn.style.backgroundColor = `rgb(${color[0]},${color[1]},${color[2]})`;

    const brightness = (color[0] * 0.299 + color[1] * 0.587 + color[2] * 0.114);
    const textColor = brightness < 128 ? "#fff" : "#000";

    btn.innerText = index;      // ← AQUI muda
    btn.style.color = textColor;

    btn.addEventListener("click", () => selectColor(index, color));

    paletteDiv.appendChild(btn);
  });
}

function selectColor(index, color) {
  currentColor = `rgb(${color[0]},${color[1]},${color[2]})`;
  selectedColorIndex = index;
  render();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(paintLayer, 0, 0);

  if (selectedColorIndex !== null) {
    let imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let data = imgData.data;

    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[0].length; x++) {
        if (matrix[y][x] === selectedColorIndex && paintedMask[y][x] === 0) {
          let i = (y * canvas.width + x) * 4;
          data[i] = 255;
          data[i + 1] = 200;
          data[i + 2] = 200;
          data[i + 3] = 255;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
    ctx.drawImage(paintLayer, 0, 0);
  }
}

// --- Pintura ---
function startDrawing(e) { isDrawing = true; paint(e); }
function draw(e) { if (isDrawing) paint(e); }
function stopDrawing() { isDrawing = false; }

function paint(e) {
  if (selectedColorIndex === null) return;

  const rect = canvas.getBoundingClientRect();
  const cx = Math.floor(e.clientX - rect.left);
  const cy = Math.floor(e.clientY - rect.top);

  const h = matrix.length;
  const w = matrix[0].length;

  let paintedSomething = false;

  for (let dy = -brushSize; dy <= brushSize; dy++) {
    for (let dx = -brushSize; dx <= brushSize; dx++) {
      const x = cx + dx;
      const y = cy + dy;

      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      if (dx*dx + dy*dy <= brushSize*brushSize) {
        if (matrix[y][x] === selectedColorIndex && paintedMask[y][x] === 0) {
          paintedMask[y][x] = selectedColorIndex + 1;
          paintedPixelsByColor[selectedColorIndex]++;
          const [r, g, b] = palette[selectedColorIndex];
          paintCtx.fillStyle = `rgb(${r},${g},${b})`;
          paintCtx.fillRect(x, y, 1, 1);
          paintedSomething = true;
        }
      }
    }
  }

  if (paintedSomething) {
    criarPaleta();
    saveStateToStorage();
  }

  render();
}

function updateCursor(e) {
  cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
  if (selectedColorIndex === null) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  cursorCtx.beginPath();
  cursorCtx.arc(x, y, brushSize, 0, Math.PI * 2);
  cursorCtx.fillStyle = currentColor;
  cursorCtx.globalAlpha = 0.4;
  cursorCtx.fill();
  cursorCtx.globalAlpha = 1.0;
}

// --- 🧹 Função Reset Global ---
function resetAllProgress() {
  localStorage.removeItem("paintedMask");
  localStorage.removeItem("paintedPixelsByColor");
  localStorage.removeItem("totalPixelsByColor");

  // Remove também os saves de seções do modo pixel
  for (let key in localStorage) {
    if (key.startsWith("paintbynumber_progress_")) {
      localStorage.removeItem(key);
    }
  }

  // Limpar memória local
  paintedMask = Array.from({ length: matrix.length }, () =>
    new Array(matrix[0].length).fill(0)
  );
  paintedPixelsByColor = new Array(palette.length).fill(0);

  // Limpar visualmente
  paintCtx.clearRect(0, 0, paintLayer.width, paintLayer.height);
  render();
  criarPaleta();

  alert("Todo o progresso foi apagado com sucesso!");
}

window.onload = init;
