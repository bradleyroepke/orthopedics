"use client";

import { useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  documentId: string;
  filename: string;
}

export function PDFViewer({ documentId, filename }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const pdfUrl = `/api/pdf/${documentId}`;

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
      setLoading(false);
      setError(null);
    },
    []
  );

  const onDocumentLoadError = useCallback((error: Error) => {
    setError("Failed to load PDF. The file may be corrupted or inaccessible.");
    setLoading(false);
    console.error("PDF load error:", error);
  }, []);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= numPages) {
      setPageNumber(page);
    }
  };

  const zoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  const rotate = () => setRotation((r) => (r + 90) % 360);

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const page = parseInt(e.target.value);
    if (!isNaN(page)) {
      goToPage(page);
    }
  };

  const downloadPdf = () => {
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = filename;
    link.click();
  };

  return (
    <div className="flex flex-col h-full bg-muted/30 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 p-2 border-b bg-background">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goToPage(pageNumber - 1)}
            disabled={pageNumber <= 1}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1 text-sm">
            <Input
              type="number"
              value={pageNumber}
              onChange={handlePageInput}
              min={1}
              max={numPages}
              className="h-8 w-14 text-center"
            />
            <span className="text-muted-foreground">/ {numPages || "?"}</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => goToPage(pageNumber + 1)}
            disabled={pageNumber >= numPages}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="h-8 w-8"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>

          <span className="text-sm text-muted-foreground min-w-[4ch] text-center">
            {Math.round(scale * 100)}%
          </span>

          <Button
            variant="ghost"
            size="icon"
            onClick={zoomIn}
            disabled={scale >= 3}
            className="h-8 w-8"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          <Button
            variant="ghost"
            size="icon"
            onClick={rotate}
            className="h-8 w-8"
            title="Rotate"
          >
            <RotateCw className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={downloadPdf}
            className="h-8 w-8"
            title="Download"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto p-4 flex justify-center">
        {error ? (
          <div className="flex flex-col items-center justify-center text-center p-8">
            <p className="text-destructive font-medium">{error}</p>
            <Button variant="outline" className="mt-4" onClick={downloadPdf}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF instead
            </Button>
          </div>
        ) : (
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex items-center justify-center p-8">
                <Skeleton className="w-[600px] h-[800px]" />
              </div>
            }
            className="flex justify-center"
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              rotate={rotation}
              loading={
                <Skeleton
                  className="rounded-lg"
                  style={{ width: 600 * scale, height: 800 * scale }}
                />
              }
              className="shadow-lg"
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />
          </Document>
        )}
      </div>
    </div>
  );
}
