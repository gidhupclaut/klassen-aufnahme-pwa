// Perspektivische Entzerrung: aus einem schräg fotografierten Foto plus 4
// vom Nutzer gezogenen Eckpunkten (TL, TR, BR, BL) ein gerades, auf das
// Blatt zugeschnittenes Bild berechnen - das macht aus "ein Foto" wirklich
// einen "Scan". Reine Canvas-/Mathe-Lösung, keine externe Bibliothek nötig.
const Warp = (() => {
  // Bildet das Einheitsquadrat [0,1]x[0,1] auf das Viereck p0..p3 (TL,TR,BR,BL)
  // ab - Standardverfahren fuer "Quadrat zu allgemeinem Viereck" (projektive
  // Abbildung). Numerisch gegen eine unabhaengige DLT-Homographie-Loesung
  // verifiziert.
  function squareToQuadMatrix(p0, p1, p2, p3) {
    const dx1 = p1.x - p2.x, dy1 = p1.y - p2.y;
    const dx2 = p3.x - p2.x, dy2 = p3.y - p2.y;
    const sx = p0.x - p1.x + p2.x - p3.x;
    const sy = p0.y - p1.y + p2.y - p3.y;

    const denom = dx1 * dy2 - dx2 * dy1;
    let g = 0;
    let h = 0;
    if (Math.abs(denom) > 1e-10) {
      g = (sx * dy2 - dx2 * sy) / denom;
      h = (dx1 * sy - sx * dy1) / denom;
    }
    const a = p1.x - p0.x + g * p1.x;
    const b = p3.x - p0.x + h * p3.x;
    const c = p0.x;
    const d = p1.y - p0.y + g * p1.y;
    const e = p3.y - p0.y + h * p3.y;
    const f = p0.y;
    return { a, b, c, d, e, f, g, h };
  }

  function mapUV(M, u, v) {
    const denom = M.g * u + M.h * v + 1;
    return {
      x: (M.a * u + M.b * v + M.c) / denom,
      y: (M.d * u + M.e * v + M.f) / denom,
    };
  }

  function dist(p, q) {
    return Math.hypot(q.x - p.x, q.y - p.y);
  }

  function outputSizeForQuad(quad) {
    const [tl, tr, br, bl] = quad;
    const widthTop = dist(tl, tr);
    const widthBottom = dist(bl, br);
    const heightLeft = dist(tl, bl);
    const heightRight = dist(tr, br);
    let w = Math.round((widthTop + widthBottom) / 2);
    let h = Math.round((heightLeft + heightRight) / 2);
    const MAX_DIM = 2000;
    const MIN_DIM = 300;
    const scaleDown = Math.min(1, MAX_DIM / Math.max(w, h, 1));
    w = Math.max(MIN_DIM, Math.round(w * scaleDown));
    h = Math.max(MIN_DIM, Math.round(h * scaleDown));
    return { w, h };
  }

  function bilinearSample(data, width, height, x, y) {
    x = Math.max(0, Math.min(width - 1.001, x));
    y = Math.max(0, Math.min(height - 1.001, y));
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const fx = x - x0;
    const fy = y - y0;
    const idx = (xx, yy) => (yy * width + xx) * 4;
    const out = [0, 0, 0, 0];
    for (let c = 0; c < 4; c++) {
      const i00 = data[idx(x0, y0) + c];
      const i10 = data[idx(x1, y0) + c];
      const i01 = data[idx(x0, y1) + c];
      const i11 = data[idx(x1, y1) + c];
      const top = i00 * (1 - fx) + i10 * fx;
      const bottom = i01 * (1 - fx) + i11 * fx;
      out[c] = top * (1 - fy) + bottom * fy;
    }
    return out;
  }

  // sourceCanvas: Canvas mit dem Originalfoto in voller Aufloesung.
  // quad: [{x,y} TL, TR, BR, BL] in den Pixelkoordinaten dieses Canvas.
  // Liefert ein neues Canvas mit der entzerrten, zugeschnittenen Seite.
  function warpToCanvas(sourceCanvas, quad) {
    const sw = sourceCanvas.width;
    const sh = sourceCanvas.height;
    const srcCtx = sourceCanvas.getContext("2d");
    const srcData = srcCtx.getImageData(0, 0, sw, sh).data;

    const { w: outW, h: outH } = outputSizeForQuad(quad);
    const M = squareToQuadMatrix(quad[0], quad[1], quad[2], quad[3]);

    const outCanvas = document.createElement("canvas");
    outCanvas.width = outW;
    outCanvas.height = outH;
    const outCtx = outCanvas.getContext("2d");
    const outImageData = outCtx.createImageData(outW, outH);
    const outData = outImageData.data;

    for (let oy = 0; oy < outH; oy++) {
      const v = (oy + 0.5) / outH;
      for (let ox = 0; ox < outW; ox++) {
        const u = (ox + 0.5) / outW;
        const src = mapUV(M, u, v);
        const sample = bilinearSample(srcData, sw, sh, src.x, src.y);
        const di = (oy * outW + ox) * 4;
        outData[di] = sample[0];
        outData[di + 1] = sample[1];
        outData[di + 2] = sample[2];
        outData[di + 3] = 255;
      }
    }
    outCtx.putImageData(outImageData, 0, 0);
    return outCanvas;
  }

  return { warpToCanvas };
})();
