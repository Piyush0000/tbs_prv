"use client";
import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState } from "react";

function EnhancedQRScanner({ onUserScanned, onBookScanned, onBookImageCaptured, mode = "user" }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const isScanningRef = useRef(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanningStatus, setScanningStatus] = useState("Initializing camera...");

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      isScanningRef.current = false;
      let tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) {
      setError("Camera not ready");
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    return canvas.toDataURL("image/jpeg", 0.8);
  };

  const processBookImage = async () => {
    setIsLoading(true);
    setScanningStatus("Analyzing book image...");
    
    try {
      const imageData = captureImage();
      if (imageData && onBookImageCaptured) {
        // Extract base64 data (remove data:image/jpeg;base64, prefix)
        const base64Data = imageData.split(',')[1];
        await onBookImageCaptured(base64Data);
        setScanningStatus("Book image processed successfully!");
      }
    } catch (error) {
      setError("Failed to process book image: " + error.message);
      setScanningStatus("Ready to scan");
    } finally {
      setIsLoading(false);
    }
  };

  const scanFrame = useCallback(() => {
    if (!isScanningRef.current || !videoRef.current || !canvasRef.current || 
        videoRef.current.paused || videoRef.current.ended || isLoading) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Only scan for QR codes in QR mode, not in image capture mode
      if (mode !== "book-image") {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height);

        if (qrCode?.data) {
          isScanningRef.current = false;
          
          if (mode === "user" && onUserScanned) {
            onUserScanned(qrCode.data);
          } else if (mode === "book-qr" && onBookScanned) {
            onBookScanned(qrCode.data);
          }
          
          setScanningStatus("QR Code scanned successfully!");
          stopCamera();
          return;
        }
      }
    }
    
    requestAnimationFrame(scanFrame);
  }, [onUserScanned, onBookScanned, mode, isLoading]);

  const requestCameraPermission = useCallback(async () => {
    try {
      setScanningStatus("Requesting camera permission...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        isScanningRef.current = true;
        
        if (mode === "book-image") {
          setScanningStatus("Point camera at book cover and click capture");
        } else {
          setScanningStatus(`Scanning for ${mode === "user" ? "user" : "book"} QR code...`);
          requestAnimationFrame(scanFrame);
        }
      }
    } catch (err) {
      console.error("Camera permission denied:", err);
      setError("Camera permission denied. Please allow camera access.");
      setScanningStatus("Camera access denied");
    }
  }, [scanFrame, mode]);

  useEffect(() => {
    requestCameraPermission();
    return () => stopCamera();
  }, [requestCameraPermission]);

  return (
    <div className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4">
        <h3 className="text-lg font-semibold">
          {mode === "user" && "Scan User QR Code"}
          {mode === "book-qr" && "Scan Book QR Code"}
          {mode === "book-image" && "Capture Book Image"}
        </h3>
        <p className="text-sm opacity-90">{scanningStatus}</p>
      </div>

      {/* Camera View */}
      <div className="relative aspect-square bg-black">
        <video
          ref={videoRef}
          playsInline
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }} // Mirror effect
        />
        
        {/* Scanning Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {/* QR Code Scanner Overlay */}
          {(mode === "user" || mode === "book-qr") && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-64 h-64 border-2 border-white rounded-lg relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl-lg"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr-lg"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl-lg"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br-lg"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-white text-sm bg-black bg-opacity-50 px-2 py-1 rounded">
                    Align QR Code here
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Book Image Capture Overlay */}
          {mode === "book-image" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-80 h-96 border-2 border-white rounded-lg relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-white text-sm bg-black bg-opacity-50 px-2 py-1 rounded text-center">
                    Position book cover<br />within frame
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-2"></div>
              <p>Processing...</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 space-y-3">
        {mode === "book-image" && (
          <button
            onClick={processBookImage}
            disabled={isLoading}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              isLoading
                ? "bg-gray-300 dark:bg-gray-600 cursor-not-allowed text-gray-500"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {isLoading ? "Processing..." : "Capture Book Image"}
          </button>
        )}
        
        {/* Instructions */}
        <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
          {mode === "user" && (
            <>
              <p>• Position the user's QR code in the center frame</p>
              <p>• Ensure good lighting for best results</p>
              <p>• Hold steady until scan completes</p>
            </>
          )}
          {mode === "book-qr" && (
            <>
              <p>• Scan the transaction QR code from the app</p>
              <p>• Make sure the QR code is clearly visible</p>
              <p>• This verifies the book transaction</p>
            </>
          )}
          {mode === "book-image" && (
            <>
              <p>• Position book cover clearly in frame</p>
              <p>• Ensure title and author are readable</p>
              <p>• Good lighting improves recognition</p>
            </>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-3">
            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} className="hidden"></canvas>
    </div>
  );
}

export default EnhancedQRScanner;




