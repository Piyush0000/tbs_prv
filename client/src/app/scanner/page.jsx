"use client";
import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState } from "react";

function QRScanner({ onScanned }) {
  const [firstCode, setFirstCode] = useState(null);
  const [secondCode, setSecondCode] = useState(null);
  const [isScanning, setIsScanning] = useState(true);
  const [waitingForSecond, setWaitingForSecond] = useState(false);
  const [error, setError] = useState(null);
  const [hasPermission, setHasPermission] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const firstCodeRef = useRef(null);

  useEffect(() => {
    requestCameraPermission();
    return () => stopCamera();
  }, []);

  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setHasPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      startScanning();
    } catch (err) {
      setError("Please allow camera access to use the QR scanner");
      setHasPermission(false);
    }
  };

  const startScanning = () => {
    setIsScanning(true);
    requestAnimationFrame(scanFrame);
  };

  const stopScanning = () => {
    setIsScanning(false);
  };

  const scanFrame = useCallback(() => {
    if (!isScanning || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true }); // Optimize canvas performance

    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(scanFrame);
      return;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const qrCode = jsQR(imageData.data, imageData.width, imageData.height);

    if (qrCode?.data) {
      handleScan(qrCode.data);
    }

    if (isScanning) {
      requestAnimationFrame(scanFrame);
    }
  }, [isScanning]);

  useEffect(() => {
    if (isScanning) {
      requestAnimationFrame(scanFrame);
    }
  }, [isScanning, scanFrame]);

  const handleScan = useCallback(
    (data) => {
      if (!data || !isScanning) return;

      if (!firstCodeRef.current) {
        console.log("First QR Code:", data);
        firstCodeRef.current = data;
        setFirstCode(data);
        setWaitingForSecond(true);
        stopScanning();

        setTimeout(() => {
          setWaitingForSecond(false);
          startScanning();
        }, 2000);
      } else if (!secondCode && data !== firstCodeRef.current) {
        console.log("Second QR Code:", data);
        setSecondCode(data);
        stopScanning(); // Stop scanning immediately
        onScanned({
          firstCode: firstCodeRef.current,
          secondCode: data,
        });
      }
    },
    [secondCode, onScanned, isScanning]
  );

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      let tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const resetScanner = () => {
    setFirstCode(null);
    firstCodeRef.current = null;
    setSecondCode(null);
    setWaitingForSecond(false);
    setError(null);
    requestCameraPermission();
  };

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">QR Code Scanner</h1>

        <div className="bg-gray-50 rounded-2xl p-6 mb-6">
          <div className="relative aspect-square w-full mb-6">
            {hasPermission === null && (
              <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
                <p className="text-gray-600">Requesting camera permission...</p>
              </div>
            )}

            {hasPermission === false && (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 rounded-lg p-4">
                <p className="text-red-600 mb-4 text-center">Camera access denied</p>
                <button
                  onClick={requestCameraPermission}
                  className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700"
                >
                  Allow Camera Access
                </button>
              </div>
            )}

            {hasPermission && (
              <div className="relative w-full h-full">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="absolute top-0 left-0 w-full h-full object-cover rounded-lg"
                />
              </div>
            )}

            <canvas ref={canvasRef} className="hidden"></canvas>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div
                className={`w-3 h-3 rounded-full ${firstCode ? "bg-green-500" : "bg-gray-300"}`}
              ></div>
              <span className="text-gray-700">Scan user QR</span>
            </div>
            <div className="flex items-center space-x-3">
              <div
                className={`w-3 h-3 rounded-full ${secondCode ? "bg-green-500" : "bg-gray-300"}`}
              ></div>
              <span className="text-gray-700">Scan book QR</span>
            </div>
          </div>
        </div>

        <div className="text-center space-y-4">
          {!firstCode && <p className="text-gray-600">Please scan the first QR code</p>}
          {waitingForSecond && <p className="text-gray-600">Now scan the second QR code...</p>}
          {firstCode && !secondCode && !waitingForSecond && (
            <p className="text-gray-600">Ready to scan the second QR code</p>
          )}
          {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>}
          <button
            onClick={resetScanner}
            className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
          >
            Scan Again
          </button>
        </div>
      </div>
    </div>
  );
}

export default QRScanner;