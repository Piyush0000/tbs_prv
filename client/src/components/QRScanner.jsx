// File: src/components/QRScanner.jsx

"use client";
import jsQR from "jsqr";
import { useCallback, useEffect, useRef } from "react";

function QRScanner({ onScanned }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const isScanningRef = useRef(true);

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      isScanningRef.current = false;
      let tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const scanFrame = useCallback(() => {
    if (!isScanningRef.current || !videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended) {
        return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qrCode = jsQR(imageData.data, imageData.width, imageData.height);

      if (qrCode?.data) {
        isScanningRef.current = false; // Stop scanning
        onScanned({ firstCode: qrCode.data }); // Send the single code back
        stopCamera();
        return; // Exit the loop
      }
    }
    requestAnimationFrame(scanFrame);
  }, [onScanned]);

  const requestCameraPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        isScanningRef.current = true;
        requestAnimationFrame(scanFrame);
      }
    } catch (err) {
      console.error("Camera permission denied:", err);
    }
  }, [scanFrame]);

  useEffect(() => {
    requestCameraPermission();
    return () => stopCamera();
  }, [requestCameraPermission]);

  return (
    <div className="relative w-full aspect-square">
      <video
        ref={videoRef}
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      <canvas ref={canvasRef} className="hidden"></canvas>
    </div>
  );
}

export default QRScanner;