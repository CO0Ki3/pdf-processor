import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

type ProcessMessage =
  | {
      type: "text";
      buffer: ArrayBuffer;
      minLength?: number;
    }
  | {
      type: "image";
      buffer: ArrayBuffer;
      scale?: number;
      quality?: number;
    };

self.onmessage = async (e: MessageEvent<ProcessMessage>) => {
  const data = e.data;

  try {
    if (data.type === "text") {
      await handleTextExtraction(data.buffer, data.minLength ?? 10);
    } else if (data.type === "image") {
      await preparePdfForImageConversion(
        data.buffer,
        data.scale ?? 1.5,
        data.quality ?? 0.92
      );
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "PDF 처리 실패",
    });
  }
};

async function handleTextExtraction(buffer: ArrayBuffer, minLength: number) {
  const loadingTask = pdfjsLib.getDocument({
    data: buffer,
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
  });
  const pdf = await loadingTask.promise;

  const textPages: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const pageText = textContent.items
      .map((item: any) => {
        if ("str" in item) {
          return item.str;
        }
        return "";
      })
      .join("\n");

    textPages.push(pageText);
  }

  const fullText = textPages.join("\n").trim().replace(/\n{2,}/g, '\n');

  self.postMessage({
    type: "text-result",
    ok: fullText.length >= minLength,
    length: fullText.length,
    sample: fullText,
  });
}

async function preparePdfForImageConversion(
  buffer: ArrayBuffer,
  scale: number,
  quality: number
) {
  const loadingTask = pdfjsLib.getDocument({
    data: buffer,
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
  });
  const pdf = await loadingTask.promise;

  self.postMessage({
    type: "image-ready",
    totalPages: pdf.numPages,
    scale,
    quality,
  });
}