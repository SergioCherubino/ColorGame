// grid.js
let gridCanvas, gctx;
let matrix, palette;
let paintedMask = [];
const gridSize = 50; // em pixels "originais" da matriz
let scale = 1; // escala para desenhar tela (cada pixel original vira scale px)

async function initGrid() {
  gridCanvas = document.getElementById("gridCanvas");
  gctx = gridCanvas.getContext("2d");

  matrix = await fetch("matrix.json").then(r => r.json());
  palette = await fetch("palette.json").then(r => r.json());

  // recuperar paintedMask (se houver)
  const storedMask = localStorage.getItem("paintedMask");
  if (storedMask) paintedMask = JSON.parse(storedMask);
  else paintedMask = Array.from({ length: matrix.length }, () =>
    new Array(matrix[0].length).fill(false)
  );

  // dimensiona canvas para caber (escalando se necessário)
  const W = matrix[0].length;
  const H = matrix.length;
  const maxW = Math.min(window.innerWidth - 40, 1000);
  const maxH = Math.min(window.innerHeight - 140, 800);
  scale = Math.min(1, Math.min(maxW / W, maxH / H)) || 1;

  // se a matriz for muito pequena, podemos ampliar para melhorar visual:
  if (W < 400 && H < 400) {
    scale = Math.max(scale, 1.5);
  }

  gridCanvas.width = Math.round(W * scale);
  gridCanvas.height = Math.round(H * scale);

  drawFullImageWithGrid();

  // clique na célula
  gridCanvas.addEventListener("click", e => {
    const rect = gridCanvas.getBoundingClientRect();
    const cx = Math.floor((e.clientX - rect.left) / scale);
    const cy = Math.floor((e.clientY - rect.top) / scale);

    const cellX = Math.floor(cx / gridSize);
    const cellY = Math.floor(cy / gridSize);

    // salvar seleção e garantir estado salvo
    localStorage.setItem("selectedSquare", JSON.stringify({ x: cellX, y: cellY }));
    localStorage.setItem("paintedMask", JSON.stringify(paintedMask));

    // abre a página pixel art
    window.location.href = "pixel.html";
  });
}

function drawFullImageWithGrid() {
  // primeiro desenha a imagem (pixels pintados aparecem coloridos; não pintados ficam com cor base)
  const W = matrix[0].length;
  const H = matrix.length;

  // desenhar um ImageData para performance
  const img = gctx.createImageData(W, H);
  const data = img.data;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = matrix[y][x];
      const [r,g,b] = palette[idx];
      const i = (y * W + x) * 4;

      const paintedValue = paintedMask[y]?.[x]; // valor salvo no localStorage

      if (paintedValue && paintedValue > 0) {
        // paintedValue é index+1 → precisa subtrair 1 ao acessar a paleta
        const rgb = palette[paintedValue - 1] || [220, 220, 220];
        data[i] = rgb[0];
        data[i + 1] = rgb[1];
        data[i + 2] = rgb[2];
        data[i + 3] = 255;
      } else {
        // pixel ainda não pintado — cor base (cinza claro)
        data[i] = 220;
        data[i + 1] = 220;
        data[i + 2] = 220;
        data[i + 3] = 255;
      }

    }
  }

  // colocar ImageData em um canvas temporário e escalonar
  const temp = document.createElement("canvas");
  temp.width = W; temp.height = H;
  const tctx = temp.getContext("2d");
  tctx.putImageData(img, 0, 0);

  // desenha no canvas de exibição escalando para 'scale'
  gctx.imageSmoothingEnabled = false;
  gctx.clearRect(0,0,gridCanvas.width,gridCanvas.height);
  gctx.drawImage(temp, 0, 0, temp.width, temp.height, 0, 0, temp.width * scale, temp.height * scale);

  // desenhar linhas de grade com base em gridSize * scale
  gctx.strokeStyle = "rgba(0,0,0,0.6)";
  gctx.lineWidth = 1;
  for (let y = 0; y <= H; y += gridSize) {
    gctx.beginPath();
    gctx.moveTo(0, y * scale);
    gctx.lineTo(W * scale, y * scale);
    gctx.stroke();
  }
  for (let x = 0; x <= W; x += gridSize) {
    gctx.beginPath();
    gctx.moveTo(x * scale, 0);
    gctx.lineTo(x * scale, H * scale);
    gctx.stroke();
  }
}

function voltar() {
  window.location.href = "index.html";
}

window.onload = initGrid;
