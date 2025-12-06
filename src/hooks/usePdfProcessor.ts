import { useEffect, useRef, useState } from "react";
import PdfWorker from "../workers/pdfWorker?worker";
import * as pdfjsLib from "pdfjs-dist";

// Worker src 설정
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface TextResult {
  ok: boolean;
  length: number;
  sample: string;
}

interface ImageResult {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

interface UsePdfProcessorOptions {
  type: "text" | "image";
  scale?: number;
  textOption?: 'fullText' | 'page';
}

function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T {
  let lastCall = 0;
  return ((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  }) as T;
}

export function usePdfProcessor(options: UsePdfProcessorOptions) {
  const { type, scale, textOption } = options;

  const [text, setText] = useState<TextResult | null>(null);
  const [images, setImages] = useState<ImageResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const currentFileRef = useRef<ArrayBuffer | null>(null);

  const throttledSetProgress = useRef(
    throttle((current: number, total: number) => {
      setProgress({ current, total });
    }, 100)
  ).current;

  useEffect(() => {
    const w = new PdfWorker();
    workerRef.current = w;

    w.onmessage = async (ev: MessageEvent) => {
      const data = ev.data;
      
      if (data?.type === "text-result") {
        setIsWorking(false);
        setText({ ok: data.ok, length: data.length, sample: data.sample });
        setError(null);
      } else if (data?.type === "image-ready") {
        if (currentFileRef.current) {
          await renderPdfToImages(
            currentFileRef.current,
            data.scale,
            data.quality
          );
        }
      } else if (data?.type === "error") {
        setIsWorking(false);
        setError(data.message || "알 수 없는 오류");
        setText(null);
        setImages([]);
        setProgress(null);
      }
    };

    w.onerror = (e) => {
      setIsWorking(false);
      setError(e.message || "워커 오류");
      setText(null);
      setImages([]);
      setProgress(null);
    };

    return () => {
      w.terminate();
      workerRef.current = null;
      currentFileRef.current = null;
    };
  }, []);

  async function renderPdfToImages(
    buffer: ArrayBuffer,
    scale: number,
    quality: number
  ) {
    try {
      const loadingTask = pdfjsLib.getDocument({
        data: buffer,
        cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
      });
      const pdf = await loadingTask.promise;

      const CONCURRENT_LIMIT = 3;
      const imageResults: ImageResult[] = new Array(pdf.numPages);
      let processedCount = 0;

      for (let i = 0; i < pdf.numPages; i += CONCURRENT_LIMIT) {
        const batch = [];
        
        for (let j = 0; j < CONCURRENT_LIMIT && i + j < pdf.numPages; j++) {
          const pageNum = i + j + 1;
          batch.push(
            (async () => {
              const page = await pdf.getPage(pageNum);
              const viewport = page.getViewport({ scale });

              const canvas = document.createElement("canvas");
              const canvasContext = canvas.getContext("2d", { 
                alpha: false,
                willReadFrequently: false 
              });

              if (!canvasContext) {
                throw new Error("Canvas context를 생성할 수 없습니다.");
              }

              canvas.width = viewport.width;
              canvas.height = viewport.height;

              await page.render({
                canvas,
                canvasContext,
                viewport,
              }).promise;

              const dataUrl = canvas.toDataURL(
                "image/png",
                quality
              );

              canvas.width = 0;
              canvas.height = 0;

              return {
                pageNumber: pageNum,
                dataUrl,
                width: viewport.width,
                height: viewport.height,
              };
            })()
          );
        }

        const results = await Promise.all(batch);
        
        results.forEach(result => {
          imageResults[result.pageNumber - 1] = result;
        });

        processedCount += results.length;
        throttledSetProgress(processedCount, pdf.numPages);
      }

      setImages(imageResults);
      setIsWorking(false);
      setProgress(null);
      setError(null);
    } catch (err) {
      setIsWorking(false);
      setError(err instanceof Error ? err.message : "이미지 변환 실패");
      setImages([]);
      setProgress(null);
    }
  }

  async function handleFile(file: File) {
    setError(null);
    setText(null);
    setImages([]);
    setProgress(null);
    setIsWorking(true);

    try {
      const ab = await file.arrayBuffer();

      if (type === "text") {
        currentFileRef.current = null;
        workerRef.current?.postMessage(
          {
            type: "text",
            buffer: ab,
            minLength: 10,
            textOption,
          },
          [ab]
        );
      } else if (type === "image") {
        currentFileRef.current = ab;
        workerRef.current?.postMessage({
          type: "image",
          buffer: ab,
          scale: scale ?? 1.5,
          quality: 1,
        });
      }
    } catch (err) {
      setIsWorking(false);
      setError(err instanceof Error ? err.message : "파일 읽기 실패");
    }
  }

  return {
    text,
    images,
    error,
    isWorking,
    progress,
    handleFile,
  };
}