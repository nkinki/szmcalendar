// src/utils/imageCompressor.js
// Intelligens képtömörítés a böngészőben (Canvas alapú).
// A nagyfelbontású (5-15MB) kameraképeket azonnal optimális (~100-150KB) méretre tömöríti,
// megakadályozva a 413 Request Entity Too Large hibát és a böngésző lassulását.

export function fileToCompressedDataUrl(file, maxWidth = 1400, maxHeight = 1400, quality = 0.8) {
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

        // Kisebb, átlátszatlan képeknél JPEG, egyébként PNG ha kicsi
        const mimeType = (file.type === 'image/png' && file.size < 350000) ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(mimeType, quality));
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function compressDataUrlIfNeeded(dataUrl, maxWidth = 1400, maxHeight = 1400, quality = 0.8) {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      return resolve(dataUrl);
    }
    // Ha már 250 KB alatt van (karakterszám ~340000), nem szükséges újratömöríteni
    if (dataUrl.length < 350000) {
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
      resolve(canvas.toDataURL('image/jpeg', quality));
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
