(() => {
  "use strict";

  const COLS = 100;
  const ROWS = 60;
  const EMPTY = 0;
  const BLUE = 1;
  const RED = 2;
  const COLORS = ["#111512", "#4d9ee9", "#e5554e"];

  const canvas = document.querySelector("#world");
  const context = canvas.getContext("2d", { alpha: false });
  const toggleButton = document.querySelector("#toggle");
  const stepButton = document.querySelector("#step");
  const clearButton = document.querySelector("#clear");
  const randomizeButton = document.querySelector("#randomize");
  const blueTool = document.querySelector("#blueTool");
  const redTool = document.querySelector("#redTool");
  const speedInput = document.querySelector("#speed");
  const speedValue = document.querySelector("#speedValue");
  const generationLabel = document.querySelector("#generation");
  const populationLabel = document.querySelector("#population");

  let grid = new Uint8Array(COLS * ROWS);
  let next = new Uint8Array(COLS * ROWS);
  let generation = 0;
  let running = false;
  let selectedColor = BLUE;
  let drawing = false;
  let drawValue = BLUE;
  let lastCell = null;
  let lastFrame = 0;
  let accumulator = 0;

  const index = (x, y) => y * COLS + x;

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round((rect.width * ROWS / COLS) * ratio);
    context.setTransform(canvas.width / COLS, 0, 0, canvas.height / ROWS, 0, 0);
    render();
  }

  function render() {
    context.fillStyle = COLORS[EMPTY];
    context.fillRect(0, 0, COLS, ROWS);
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] === EMPTY) continue;
      context.fillStyle = COLORS[grid[i]];
      context.fillRect(i % COLS, Math.floor(i / COLS), 1, 1);
    }
  }

  function updateStats() {
    let blue = 0;
    let red = 0;
    for (const cell of grid) {
      if (cell === BLUE) blue++;
      if (cell === RED) red++;
    }
    generationLabel.textContent = `Generation ${generation}`;
    populationLabel.textContent = `${blue + red} alive · ${blue} blue · ${red} red`;
  }

  function step() {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        let alive = 0;
        let blueNeighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
            const neighbor = grid[index(nx, ny)];
            if (neighbor !== EMPTY) {
              alive++;
              if (neighbor === BLUE) blueNeighbors++;
            }
          }
        }
        const cell = index(x, y);
        if (grid[cell] !== EMPTY) {
          next[cell] = alive === 2 || alive === 3 ? grid[cell] : EMPTY;
        } else if (alive === 3) {
          // Every Conway birth has three parents, so the color majority is always 2–1.
          next[cell] = blueNeighbors >= 2 ? BLUE : RED;
        } else {
          next[cell] = EMPTY;
        }
      }
    }
    [grid, next] = [next, grid];
    generation++;
    render();
    updateStats();
  }

  function setRunning(value) {
    running = value;
    toggleButton.textContent = running ? "Pause" : "Play";
    toggleButton.setAttribute("aria-pressed", String(running));
    lastFrame = 0;
    accumulator = 0;
  }

  function clearWorld() {
    grid.fill(EMPTY);
    next.fill(EMPTY);
    generation = 0;
    render();
    updateStats();
  }

  function randomize() {
    setRunning(false);
    clearWorld();
    for (let i = 0; i < grid.length; i++) {
      if (Math.random() < 0.24) grid[i] = Math.random() < 0.5 ? BLUE : RED;
    }
    render();
    updateStats();
  }

  function cellFromPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / rect.width * COLS);
    const y = Math.floor((event.clientY - rect.top) / rect.height * ROWS);
    return x < 0 || x >= COLS || y < 0 || y >= ROWS ? null : { x, y };
  }

  function paintLine(from, to) {
    const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
    for (let stepNumber = 0; stepNumber <= steps; stepNumber++) {
      const x = Math.round(from.x + (to.x - from.x) * stepNumber / steps);
      const y = Math.round(from.y + (to.y - from.y) * stepNumber / steps);
      grid[index(x, y)] = drawValue;
    }
  }

  function paint(event) {
    const cell = cellFromPointer(event);
    if (!cell) return;
    paintLine(lastCell || cell, cell);
    lastCell = cell;
    render();
    updateStats();
  }

  canvas.addEventListener("pointerdown", event => {
    if (event.button !== 0 && event.button !== 2) return;
    event.preventDefault();
    drawing = true;
    drawValue = event.button === 2 ? EMPTY : selectedColor;
    lastCell = null;
    canvas.setPointerCapture(event.pointerId);
    paint(event);
  });
  canvas.addEventListener("pointermove", event => { if (drawing) paint(event); });
  function stopDrawing(event) {
    drawing = false;
    lastCell = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }
  canvas.addEventListener("pointerup", stopDrawing);
  canvas.addEventListener("pointercancel", stopDrawing);
  canvas.addEventListener("contextmenu", event => event.preventDefault());

  toggleButton.addEventListener("click", () => setRunning(!running));
  stepButton.addEventListener("click", () => { setRunning(false); step(); });
  clearButton.addEventListener("click", () => { setRunning(false); clearWorld(); });
  randomizeButton.addEventListener("click", randomize);
  function chooseColor(color) {
    selectedColor = color;
    blueTool.classList.toggle("selected", color === BLUE);
    redTool.classList.toggle("selected", color === RED);
    blueTool.setAttribute("aria-pressed", String(color === BLUE));
    redTool.setAttribute("aria-pressed", String(color === RED));
  }
  blueTool.addEventListener("click", () => chooseColor(BLUE));
  redTool.addEventListener("click", () => chooseColor(RED));
  speedInput.addEventListener("input", () => { speedValue.textContent = `${speedInput.value} t/s`; });

  function animate(timestamp) {
    if (running) {
      if (lastFrame === 0) lastFrame = timestamp;
      accumulator += Math.min((timestamp - lastFrame) / 1000, 0.1);
      lastFrame = timestamp;
      const interval = 1 / Number(speedInput.value);
      let steps = 0;
      while (accumulator >= interval && steps < 5) {
        step();
        accumulator -= interval;
        steps++;
      }
    }
    requestAnimationFrame(animate);
  }

  window.addEventListener("resize", resizeCanvas);
  chooseColor(BLUE);
  resizeCanvas();
  updateStats();
  requestAnimationFrame(animate);
})();
