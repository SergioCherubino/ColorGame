// pixel.js — modo Paint by Number com sincronização de progresso
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const paletteDiv = document.getElementById("palette");

const TILE = 20;
const SECTION_SIZE = 50;

let WIDTH, HEIGHT;
let grid = [];
let painted = [];
let palette = [];
let sectionPalette = [];
let selectedColor = null;

// Caminhos padrão
const MATRIX_PATH = localStorage.getItem("matrixPath") || "matrix.json";
const PALETTE_PATH = localStorage.getItem("palettePath") || "palette.json";

// Posição da seção selecionada
const selectedSquare = JSON.parse(localStorage.getItem("selectedSquare") || "null");

// Chave única por seção
let STORAGE_KEY = selectedSquare
  ? `paintbynumber_progress_${selectedSquare.x}_${selectedSquare.y}`
  : "paintbynumber_progress_full";

// --- Inicialização ---
async function init() {
  try {
    const [matrix, fullPalette] = await Promise.all([
      fetch(MATRIX_PATH).then(r => {
        if (!r.ok) throw new Error("Erro ao carregar matrix.json");
        return r.json();
      }),
      fetch(PALETTE_PATH).then(r => {
        if (!r.ok) throw new Error("Erro ao carregar palette.json");
        return r.json();
      })
    ]);

    // Recorte da submatriz (seção)
    const startX = selectedSquare ? selectedSquare.x * SECTION_SIZE : 0;
    const startY = selectedSquare ? selectedSquare.y * SECTION_SIZE : 0;
    grid = matrix.slice(startY, startY + SECTION_SIZE)
                 .map(row => row.slice(startX, startX + SECTION_SIZE));

    HEIGHT = grid.length;
    WIDTH = grid[0].length;
    palette = fullPalette;

    // Determinar as cores que aparecem na seção
    const colorSet = new Set();
    grid.forEach(row => row.forEach(c => colorSet.add(c)));
    sectionPalette = [...colorSet].sort((a, b) => a - b);

    // --- 🔹 NOVO: Carregar máscara global (de free painting / grid) ---
    const paintedMask = JSON.parse(localStorage.getItem("paintedMask") || "null");

    // Carregar progresso salvo (ou criar vazio)
    const saved = localStorage.getItem(STORAGE_KEY);
    painted = saved
      ? JSON.parse(saved)
      : Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(0));

    // --- 🔹 NOVO: Aplicar dados do paintedMask à seção ---
    if (paintedMask && selectedSquare) {
      for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
          const globalY = selectedSquare.y * SECTION_SIZE + y;
          const globalX = selectedSquare.x * SECTION_SIZE + x;
          const paintedVal = paintedMask[globalY]?.[globalX];
          if (paintedVal && paintedVal !== 0 && paintedVal !== false) {
            painted[y][x] = paintedVal; // guarda o número da cor
          }
        }
      }
    }

    // Configurar canvas
    canvas.width = WIDTH * TILE;
    canvas.height = HEIGHT * TILE;

    buildPalette();
    draw();

  } catch (err) {
    console.error("Erro na inicialização:", err);
    alert("Erro ao carregar dados do jogo. Veja o console para detalhes.");
  }
}

// --- Monta paleta ---
function buildPalette() {
  paletteDiv.innerHTML = "";

  sectionPalette.forEach(colorIndex => {
    const rgb = palette[colorIndex];
    const btn = document.createElement("div");
    btn.classList.add("color-button");
    btn.style.backgroundColor = `rgb(${rgb.join(",")})`;
  btn.innerText = colorIndex;

  // Detectar se a cor é clara (usar luminância)
  const [r, g, b] = rgb;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b);

// Se for clara: texto preto. Se for escura: texto branco.
btn.style.color = luminance > 150 ? "black" : "white";


    if (colorIndex === selectedColor) btn.classList.add("selected");

    btn.addEventListener("click", () => {
      document.querySelectorAll(".color-button").forEach(el => el.classList.remove("selected"));
      btn.classList.add("selected");
      selectedColor = colorIndex;
    });

    paletteDiv.appendChild(btn);
  });
}

// --- Desenha a seção ---
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const px = x * TILE;
      const py = y * TILE;
      const colorIndex = grid[y][x];
      const paintedColor = painted[y][x];

      if (paintedColor > 0) {
        // paintedColor está armazenado como (index + 1)
        const rgb = palette[paintedColor - 1];
        if (rgb) ctx.fillStyle = `rgb(${rgb.join(",")})`;
        else ctx.fillStyle = "#fff";
      } else {
        ctx.fillStyle = "#fff";
      }

      ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = "#ccc";
      ctx.strokeRect(px, py, TILE, TILE);

      ctx.fillStyle = paintedColor > 0 ? "#000" : "#666";
      ctx.font = `${Math.max(10, TILE / 2)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(colorIndex, px + TILE / 2, py + TILE / 2);
    }
  }
}

// --- Flood Fill: pinta área conectada ---
function floodFill(x, y, targetColor, paintValue) {
  if (grid[y][x] !== targetColor) return;

  const stack = [[x, y]];
  const visited = new Set();

  while (stack.length > 0) {
    const [cx, cy] = stack.pop();
    const key = `${cx},${cy}`;
    if (visited.has(key)) continue;
    visited.add(key);

    // Só pinta se ainda não pintado
    if (painted[cy][cx] === 0 && grid[cy][cx] === targetColor) {
      painted[cy][cx] = paintValue;
    }

    // Expandir para vizinhos
    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1]
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && ny >= 0 && nx < WIDTH && ny < HEIGHT) {
        if (!visited.has(`${nx},${ny}`) && grid[ny][nx] === targetColor) {
          stack.push([nx, ny]);
        }
      }
    }
  }
}

// --- Clique para pintar ---
canvas.addEventListener("click", e => {
  if (selectedColor === null) return;

  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / TILE);
  const y = Math.floor((e.clientY - rect.top) / TILE);

  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;

  if (grid[y][x] === selectedColor) {
    floodFill(x, y, selectedColor, selectedColor + 1);
    draw();
    saveProgress();
  }
});

// --- Salvar progresso ---
function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(painted));

  // Atualiza máscara global (para grid e free painting)
  const paintedMask = JSON.parse(localStorage.getItem("paintedMask") || "null") || [];
  if (selectedSquare) {
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const globalY = selectedSquare.y * SECTION_SIZE + y;
        const globalX = selectedSquare.x * SECTION_SIZE + x;

        if (!paintedMask[globalY]) paintedMask[globalY] = [];
        if (painted[y][x] > 0) {
          paintedMask[globalY][globalX] = painted[y][x]; // salva número da cor
        }
      }
    }
    localStorage.setItem("paintedMask", JSON.stringify(paintedMask));
  }
}

// --- Botões ---
document.getElementById("resetButton")?.addEventListener("click", () => {
  if (confirm("Deseja apagar o progresso desta seção?")) {
    painted = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(0));
    saveProgress();
    draw();
  }
});

document.getElementById("backButton")?.addEventListener("click", () => {
  saveProgress();
  window.location.href = "grid.html";
});

window.onload = init;
