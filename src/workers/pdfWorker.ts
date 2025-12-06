// @ts-nocheck
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

self.onmessage = async (e) => {
  const data = e.data;

  try {
    if (data.type === 'text') {
      await handleTextExtraction(data.buffer, data.minLength ?? 10, data.textOption ?? 'fullText');
    } else if (data.type === 'image') {
      await preparePdfForImageConversion(data.buffer, data.scale ?? 1.5, data.quality ?? 0.92);
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'PDF 처리 실패',
    });
  }
};

async function handleTextExtraction(buffer, minLength, textOption) {
  const loadingTask = pdfjsLib.getDocument({
    data: buffer,
    cMapUrl: 'https://unpkg.com/pdfjs-dist@${version}/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@${version}/standard_fonts/',
  });
  const pdf = await loadingTask.promise;

  const textPages = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const pageText = textContent.items
      .map((item) => {
        if ('str' in item) {
          const textItem = item;
          return textItem.str + (textItem.hasEOL ? '\\n' : '');
        }
        return '';
      })
      .join('');

    textPages.push(pageText);
  }

  switch (textOption) {
    case 'fullText':
      const fullText = textPages
        .join('\\n')
        .trim()
        .replace(/\\n{2,}/g, '\\n');
      self.postMessage({
        type: 'text-result',
        ok: fullText.length >= minLength,
        length: fullText.length,
        sample: fullText,
      });
      break;
    case 'page':
      self.postMessage({
        type: 'text-result',
        ok: textPages.join('').length >= minLength,
        length: textPages.join('').length,
        sample: textPages,
      });
      break;
    default:
      throw new Error('Invalid text option');
  }
}

async function preparePdfForImageConversion(buffer, scale, quality) {
  const loadingTask = pdfjsLib.getDocument({
    data: buffer,
    cMapUrl: 'https://unpkg.com/pdfjs-dist@${version}/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@${version}/standard_fonts/',
  });
  const pdf = await loadingTask.promise;

  self.postMessage({
    type: 'image-ready',
    totalPages: pdf.numPages,
    scale,
    quality,
  });
}