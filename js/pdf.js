// Baut aus mehreren JPEG-Seiten ein einzelnes PDF, ganz ohne externe
// Bibliothek (nur so viel PDF-Syntax wie noetig: Catalog, Pages, pro Seite
// ein Image-XObject mit Filter DCTDecode + ein Content-Stream, der es
// passend skaliert und zentriert auf die Seite zeichnet).
const PDF = (() => {
  function strToBytes(str) {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0xff;
    return bytes;
  }

  function concatBytes(arrays) {
    let total = 0;
    for (const a of arrays) total += a.length;
    const out = new Uint8Array(total);
    let offset = 0;
    for (const a of arrays) {
      out.set(a, offset);
      offset += a.length;
    }
    return out;
  }

  // A4 bei 72dpi; Querformat, wenn das Foto breiter als hoch ist.
  function pageSizeFor(imgW, imgH) {
    const portrait = imgH >= imgW;
    return portrait ? { w: 595.28, h: 841.89 } : { w: 841.89, h: 595.28 };
  }

  const PAGE_MARGIN = 24;

  async function buildPdfFromImages(pages) {
    // pages: [{ bytes: Uint8Array (JPEG-Rohdaten), width, height }]
    const chunks = [];
    let offset = 0;
    const offsets = [];

    function push(strOrBytes) {
      const bytes = typeof strOrBytes === "string" ? strToBytes(strOrBytes) : strOrBytes;
      chunks.push(bytes);
      offset += bytes.length;
    }
    function beginObj(num) {
      offsets[num] = offset;
      push(`${num} 0 obj\n`);
    }
    function endObj() {
      push("endobj\n");
    }

    push("%PDF-1.4\n");

    const n = pages.length;
    const catalogNum = 1;
    const pagesNum = 2;
    let nextNum = 3;
    const pageObjNums = [];
    const imageObjNums = [];
    const contentObjNums = [];
    for (let i = 0; i < n; i++) {
      pageObjNums.push(nextNum++);
      imageObjNums.push(nextNum++);
      contentObjNums.push(nextNum++);
    }
    const totalObjs = nextNum - 1;

    beginObj(catalogNum);
    push(`<< /Type /Catalog /Pages ${pagesNum} 0 R >>\n`);
    endObj();

    beginObj(pagesNum);
    const kids = pageObjNums.map((num) => `${num} 0 R`).join(" ");
    push(`<< /Type /Pages /Kids [ ${kids} ] /Count ${n} >>\n`);
    endObj();

    for (let i = 0; i < n; i++) {
      const p = pages[i];
      const { w: pageW, h: pageH } = pageSizeFor(p.width, p.height);
      const usableW = pageW - PAGE_MARGIN * 2;
      const usableH = pageH - PAGE_MARGIN * 2;
      const scale = Math.min(usableW / p.width, usableH / p.height);
      const drawW = p.width * scale;
      const drawH = p.height * scale;
      const tx = (pageW - drawW) / 2;
      const ty = (pageH - drawH) / 2;

      const contentStr = `q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${tx.toFixed(2)} ${ty.toFixed(2)} cm /Im${i} Do Q`;
      const contentBytes = strToBytes(contentStr);

      beginObj(pageObjNums[i]);
      push(
        `<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}] ` +
          `/Resources << /XObject << /Im${i} ${imageObjNums[i]} 0 R >> >> /Contents ${contentObjNums[i]} 0 R >>\n`
      );
      endObj();

      beginObj(imageObjNums[i]);
      push(
        `<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`
      );
      push(p.bytes);
      push("\nendstream\n");
      endObj();

      beginObj(contentObjNums[i]);
      push(`<< /Length ${contentBytes.length} >>\nstream\n`);
      push(contentBytes);
      push("\nendstream\n");
      endObj();
    }

    const xrefOffset = offset;
    push(`xref\n0 ${totalObjs + 1}\n`);
    push("0000000000 65535 f \n");
    for (let num = 1; num <= totalObjs; num++) {
      const off = offsets[num] || 0;
      push(`${String(off).padStart(10, "0")} 00000 n \n`);
    }
    push(`trailer\n<< /Size ${totalObjs + 1} /Root ${catalogNum} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

    const all = concatBytes(chunks);
    return new Blob([all], { type: "application/pdf" });
  }

  return { buildPdfFromImages };
})();
