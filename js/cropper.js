// Interaktiver 4-Ecken-Zuschnitt: zeigt das aufgenommene Foto an und lässt
// die vier Ecken per Ziehen auf die tatsächlichen Blatträndern ausrichten
// (iOS bietet keine Web-API für automatische Kantenerkennung, daher manuell).
const Cropper = (() => {
  let stageEl = null;
  let imgEl = null;
  let svgEl = null;
  let scale = 1;
  let naturalW = 0;
  let naturalH = 0;
  let quad = null; // [{x,y} TL, TR, BR, BL] in Original-Pixelkoordinaten
  let dragIndex = -1;

  function init({ stage, img, svg }) {
    stageEl = stage;
    imgEl = img;
    svgEl = svg;
    svgEl.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function load(objectUrl, width, height) {
    naturalW = width;
    naturalH = height;
    return new Promise((resolve) => {
      imgEl.onload = () => {
        layout();
        resetQuad();
        render();
        resolve();
      };
      imgEl.src = objectUrl;
    });
  }

  function layout() {
    const cw = stageEl.clientWidth;
    const ch = stageEl.clientHeight;
    scale = Math.min(cw / naturalW, ch / naturalH);
    const dispW = Math.round(naturalW * scale);
    const dispH = Math.round(naturalH * scale);
    imgEl.style.width = `${dispW}px`;
    imgEl.style.height = `${dispH}px`;
    svgEl.style.width = `${dispW}px`;
    svgEl.style.height = `${dispH}px`;
    svgEl.setAttribute("viewBox", `0 0 ${dispW} ${dispH}`);
  }

  function resetQuad() {
    const insetX = naturalW * 0.07;
    const insetY = naturalH * 0.07;
    quad = [
      { x: insetX, y: insetY },
      { x: naturalW - insetX, y: insetY },
      { x: naturalW - insetX, y: naturalH - insetY },
      { x: insetX, y: naturalH - insetY },
    ];
  }

  function toDisplay(p) {
    return { x: p.x * scale, y: p.y * scale };
  }

  function render() {
    const pts = quad.map(toDisplay);
    const poly = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    svgEl.innerHTML = `
      <polygon points="${poly}" fill="rgba(56,189,248,0.18)" stroke="#38bdf8" stroke-width="2.5" />
      ${pts
        .map(
          (p, i) =>
            `<circle data-handle="${i}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="16" fill="#38bdf8" stroke="#fff" stroke-width="2.5" />`
        )
        .join("")}
    `;
  }

  function onPointerDown(e) {
    const handle = e.target.closest("[data-handle]");
    if (!handle) return;
    dragIndex = Number(handle.dataset.handle);
    svgEl.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (dragIndex === -1) return;
    const rect = svgEl.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    x = Math.max(0, Math.min(rect.width, x));
    y = Math.max(0, Math.min(rect.height, y));
    quad[dragIndex] = { x: x / scale, y: y / scale };
    render();
  }

  function onPointerUp() {
    dragIndex = -1;
  }

  function getQuad() {
    return quad.map((p) => ({ x: p.x, y: p.y }));
  }

  return { init, load, getQuad };
})();
