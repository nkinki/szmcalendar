// src/utils/imageCompressor.js
// Intelligens képtömörítés a böngészőben (Canvas alapú).
// A nagyfelbontású kameraképeket optimalizált, prémium nyomdai felbontásra (max 2500px, 92% minőség)
// skálázza, megőrizve a 300 DPI élességet A4-es méretben is, miközben a fájlméret ésszerű marad.

export function fileToCompressedDataUrl(file, maxWidth = 2500, maxHeight = 2500, quality = 0.92) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    if (!file.type || !file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Ha PNG volt az eredeti, MEG KELL ŐRIZNI A PNG FORMÁTUMOT és transzparenciát, soha nem szabad JPEG-re alakítani!
        const isPng = file.type === 'image/png';
        const mimeType = isPng ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(mimeType, isPng ? undefined : quality));
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function compressDataUrlIfNeeded(dataUrl, maxWidth = 2500, maxHeight = 2500, quality = 0.92) {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      return resolve(dataUrl);
    }
    // Ha már 600 KB alatt van (karakterszám ~800000), nem szükséges újratömöríteni
    if (dataUrl.length < 800000) {
      return resolve(dataUrl);
    }

    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // PNG esetén TILOS JPEG-re konvertálni, mert elveszik az átlátszóság és fekete lesz a háttér!
      const isPng = dataUrl.startsWith('data:image/png');
      const mime = isPng ? 'image/png' : 'image/jpeg';
      resolve(canvas.toDataURL(mime, isPng ? undefined : quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function compressBookDataImages(bookData) {
  if (!bookData) return bookData;
  const clone = JSON.parse(JSON.stringify(bookData));

  if (clone.schoolLogo) clone.schoolLogo = await compressDataUrlIfNeeded(clone.schoolLogo);
  if (clone.principalPhoto) clone.principalPhoto = await compressDataUrlIfNeeded(clone.principalPhoto);

  if (Array.isArray(clone.graduationPages)) {
    for (const g of clone.graduationPages) {
      if (g.image) g.image = await compressDataUrlIfNeeded(g.image);
    }
  }

  if (Array.isArray(clone.teachers)) {
    for (const t of clone.teachers) {
      if (t.photo) t.photo = await compressDataUrlIfNeeded(t.photo);
    }
  }

  if (Array.isArray(clone.classes)) {
    for (const c of clone.classes) {
      if (c.groupPhoto) c.groupPhoto = await compressDataUrlIfNeeded(c.groupPhoto);
      if (c.classTeacherPhoto) c.classTeacherPhoto = await compressDataUrlIfNeeded(c.classTeacherPhoto);
    }
  }

  if (clone.pageLayouts && typeof clone.pageLayouts === 'object') {
    for (const pageId of Object.keys(clone.pageLayouts)) {
      const pageLayout = clone.pageLayouts[pageId];
      if (Array.isArray(pageLayout?.customElements)) {
        for (const elem of pageLayout.customElements) {
          if (elem.src) elem.src = await compressDataUrlIfNeeded(elem.src);
        }
      }
    }
  }

  if (Array.isArray(clone.events)) {
    for (const ev of clone.events) {
      if (Array.isArray(ev.images)) {
        for (const img of ev.images) {
          if (typeof img === 'string') {
            // string url
          } else if (img && img.url) {
            img.url = await compressDataUrlIfNeeded(img.url);
          }
        }
      }
    }
  }

  return clone;
}

/**
 * Logó feltöltéséhez optimalizált függvény:
 * - Automatikus kör alakú kivágás és sötét fekete margók levágása
 * - Mindig tiszta, átlátszó hátterű PNG-ként menti el (soha nem lesz fekete doboz a háttérben!)
 */
export function fileToLogoDataUrl(file, targetSize = 600) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          // 1) Elemző canvas a kép vizsgálatához (fekete/sötét margók felderítése)
          const scanCanvas = document.createElement('canvas');
          scanCanvas.width = img.width;
          scanCanvas.height = img.height;
          const scanCtx = scanCanvas.getContext('2d');
          scanCtx.drawImage(img, 0, 0);

          const imgData = scanCtx.getImageData(0, 0, img.width, img.height);
          const data = imgData.data;

          // Megkeressük a nem fekete/nem átlátszó terület határait
          let minX = img.width, maxX = 0, minY = img.height, maxY = 0;
          for (let y = 0; y < img.height; y += 4) {
            for (let x = 0; x < img.width; x += 4) {
              const idx = (y * img.width + x) * 4;
              const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
              // Ha a pixel látható és nem sötét fekete
              if (a > 30 && (r > 18 || g > 18 || b > 18)) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }

          let srcX = 0, srcY = 0, srcW = img.width, srcH = img.height;
          if (maxX > minX && maxY > minY) {
            const cx = (minX + maxX) / 2;
            const cy = (minY + maxY) / 2;
            const size = Math.min(maxX - minX, maxY - minY);
            // 3 pixel behúzás a biztos tisztaságért, fekete szegély kizárására
            const safeSize = Math.max(10, size - 6);
            srcX = cx - safeSize / 2;
            srcY = cy - safeSize / 2;
            srcW = safeSize;
            srcH = safeSize;
          }

          // 2) Céleredmény canvas transzparens kör maszkkal
          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext('2d');

          ctx.clearRect(0, 0, targetSize, targetSize);

          ctx.save();
          ctx.beginPath();
          const r = targetSize / 2;
          ctx.arc(r, r, r - 1, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();

          // Kép kirajzolása a körön belülre
          ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, targetSize, targetSize);
          ctx.restore();

          resolve(canvas.toDataURL('image/png'));
        } catch (err) {
          console.warn('Canvas logo processing fallback:', err);
          resolve(e.target.result);
        }
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
