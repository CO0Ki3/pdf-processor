import { usePdfProcessor } from "./hooks/usePdfProcessor";
import { useState } from "react";

export default function App() {
  const [mode, setMode] = useState<"text" | "image">("text");
  const [scale, setScale] = useState(1.5);
  const [textOption, setTextOption] = useState<"fullText" | "page">("fullText");
  const extractor = usePdfProcessor({
    type: mode,
    scale: mode === "image" ? scale : undefined,
    textOption: textOption,
  });

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h2>PDF 처리 도구</h2>
      <p>PDF 파일을 업로드하여 텍스트 추출 또는 이미지 변환을 할 수 있습니다.</p>

      {/* 모드 선택 */}
      <div style={{ marginBottom: "1rem" }}>
        <label style={{ marginRight: "1rem" }}>
          <input
            type="radio"
            value="text"
            checked={mode === "text"}
            onChange={(e) => setMode(e.target.value as "text")}
            disabled={extractor.isWorking}
          />
          <span style={{ marginLeft: "0.5rem" }}>텍스트 추출</span>
        </label>
        <label style={{ marginRight: "1rem" }}>
          <input
            type="radio"
            value="image"
            checked={mode === "image"}
            onChange={(e) => setMode(e.target.value as "image")}
            disabled={extractor.isWorking}
          />
          <span style={{ marginLeft: "0.5rem" }}>이미지 변환</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={textOption === "page"}
            onChange={(e) => setTextOption(e.target.checked ? "page" : "fullText")}
            disabled={extractor.isWorking}
          />
          <span style={{ marginLeft: "0.5rem" }}>페이지 별 텍스트 추출 (기본: 전체 텍스트)</span>
        </label>
      </div>

      {/* 이미지 모드일 때만 scale 옵션 표시 */}
      {mode === "image" && (
        <div style={{ marginBottom: "1rem" }}>
          <label>
            <span style={{ marginRight: "0.5rem" }}>이미지 해상도 (Scale):</span>
            <input
              type="number"
              min="0.5"
              max="3"
              step="0.1"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              disabled={extractor.isWorking}
              style={{ width: "80px", padding: "0.25rem" }}
            />
          </label>
        </div>
      )}

      {/* 파일 업로드 */}
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) extractor.handleFile(f);
        }}
        disabled={extractor.isWorking}
        style={{ marginTop: "1rem", marginBottom: "1rem" }}
      />

      {/* 작업 중 표시 */}
      {extractor.isWorking && (
        <div
          style={{
            padding: "1rem",
            background: "#f0f0f0",
            borderRadius: "8px",
            color: "#000",
            marginBottom: "1rem",
          }}
        >
          {mode === "text" ? "텍스트 추출 중..." : "이미지 변환 중..."}
          {extractor.progress && (
            <div style={{ marginTop: "0.5rem" }}>
              진행률: {extractor.progress.current} / {extractor.progress.total}{" "}
              페이지
            </div>
          )}
        </div>
      )}

      {/* 텍스트 추출 결과 */}
      {extractor.text && !extractor.isWorking && (
        <div
          style={{
            padding: "1rem",
            border: "2px solid #4CAF50",
            borderRadius: "8px",
            background: "#f9f9f9",
            color: "#000",
            marginBottom: "1rem",
          }}
        >
          <h3 style={{ color: "#000" }}>텍스트 추출 결과</h3>
          <div style={{ marginBottom: "0.5rem", color: "#000" }}>
            <strong>10자 이상 여부:</strong>{" "}
            {extractor.text.ok ? "10자 이상" : "10자 미만"}
          </div>
          <div style={{ marginBottom: "0.5rem", color: "#000" }}>
            <strong>추출된 텍스트 길이:</strong> {extractor.text.length}자
          </div>
          {extractor.text.sample && (
            <div style={{ marginTop: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <strong style={{ color: "#000" }}>샘플 텍스트:</strong>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(extractor.text?.sample));
                  }}
                  style={{
                    padding: "0.25rem 0.75rem",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                  }}
                >
                  복사하기
                </button>
              </div>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  background: "#fff",
                  padding: "1rem",
                  borderRadius: "4px",
                  border: "1px solid #000",
                  marginTop: "0.5rem",
                  color: "#000",
                  maxHeight: "300px",
                  overflow: "auto",
                }}
              >
                {JSON.stringify(extractor.text.sample)}
              </pre>
            </div>
            
          )}
        </div>
      )}

      {/* 이미지 변환 결과 */}
      {extractor.images.length > 0 && !extractor.isWorking && (
        <div
          style={{
            padding: "1rem",
            border: "2px solid #2196F3",
            borderRadius: "8px",
            background: "#f9f9f9",
            color: "#000",
          }}
        >
          <h3 style={{ color: "#000" }}>
            이미지 변환 결과 ({extractor.images.length}페이지)
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "1rem",
              marginTop: "1rem",
            }}
          >
            {extractor.images.map((img) => (
              <div
                key={img.pageNumber}
                style={{
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  padding: "0.5rem",
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    marginBottom: "0.5rem",
                    color: "#000",
                    fontWeight: "bold",
                  }}
                >
                  페이지 {img.pageNumber}
                </div>
                <img
                  src={img.dataUrl}
                  alt={`Page ${img.pageNumber}`}
                  style={{
                    width: "100%",
                    height: "auto",
                    border: "1px solid #ddd",
                  }}
                />
                <div
                  style={{
                    marginTop: "0.5rem",
                    fontSize: "0.875rem",
                    color: "#666",
                  }}
                >
                  크기: {img.width} x {img.height}px
                </div>
                <a
                  href={img.dataUrl}
                  download={`page-${img.pageNumber}.png`}
                  style={{
                    display: "inline-block",
                    marginTop: "0.5rem",
                    padding: "0.25rem 0.5rem",
                    background: "#2196F3",
                    color: "white",
                    textDecoration: "none",
                    borderRadius: "4px",
                    fontSize: "0.875rem",
                  }}
                >
                  다운로드
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 에러 표시 */}
      {extractor.error && !extractor.isWorking && (
        <div
          style={{
            padding: "1rem",
            border: "2px solid #f44336",
            borderRadius: "8px",
            background: "#ffebee",
            color: "#c62828",
          }}
        >
          <strong>오류:</strong> {extractor.error}
        </div>
      )}
    </div>
  );
}