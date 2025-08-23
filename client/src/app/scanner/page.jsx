"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";

// --- Mock Database ---
// In a real application, you would fetch this from your backend.
const MOCK_DATABASE = {
  users: {
    "user-123-abc": { name: "Alice" },
    "user-456-def": { name: "Bob" },
  },
  books: {
    "book-789-xyz": { title: "The Great Gatsby" },
    "book-101-pqr": { title: "To Kill a Mockingbird" },
  },
};
// --- End Mock Database ---


function QRScanner({ onScanned }) {
  const [scannedData, setScannedData] = useState({ user: null, book: null });
  const [scanMode, setScanMode] = useState(null); // 'userQR', 'bookQR', 'bookCover'
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState("Select a scan mode to begin.");
  const [hasPermission, setHasPermission] = useState(null);
  const [isJsqrLoaded, setIsJsqrLoaded] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  
  // Effect to load the jsQR library from a CDN
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
    script.async = true;
    script.onload = () => setIsJsqrLoaded(true);
    document.body.appendChild(script);
    return () => {
        document.body.removeChild(script);
    };
  }, []);


  // Effect to manage camera stream based on scanning state
  useEffect(() => {
    if (isScanning) {
      requestCameraPermission();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isScanning]);

  // Function to request camera access from the user
  const requestCameraPermission = async () => {
    if (streamRef.current) return; // Already have a stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setHasPermission(true);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      // Start the scanning loop once permission is granted
      requestAnimationFrame(scanFrame);
    } catch (err) {
      console.error("Camera permission error:", err);
      setError("Please allow camera access to use the scanner.");
      setHasPermission(false);
      setIsScanning(false);
      setScanMode(null);
    }
  };

  // Function to stop the camera stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if(videoRef.current) {
        videoRef.current.srcObject = null;
    }
  };

  // Main scanning loop that runs on every frame
  const scanFrame = useCallback(() => {
    if (!isScanning || !videoRef.current || !canvasRef.current || !streamRef.current || !isJsqrLoaded) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (video.readyState !== video.HAVE_ENOUGH_DATA || video.videoWidth === 0) {
      requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Only try to decode QR codes if in a QR mode
    if (scanMode === 'userQR' || scanMode === 'bookQR') {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // Use window.jsQR as the library is loaded globally
        const qrCode = window.jsQR(imageData.data, imageData.width, imageData.height);

        if (qrCode?.data) {
            handleQrScan(qrCode.data);
        }
    }

    // Continue loop if still scanning
    if (isScanning) {
      requestAnimationFrame(scanFrame);
    }
  }, [isScanning, scanMode, isJsqrLoaded]);


  // Handles the result of a successful QR code scan
  const handleQrScan = (data) => {
    if (!data) return;
    setIsScanning(false); // Stop scanning after a successful read
    setIsLoading(true);
    setInfo(`Processing ${scanMode === 'userQR' ? 'user' : 'book'}...`);

    // Simulate a database lookup
    setTimeout(() => {
      let result = null;
      let errorMsg = null;

      if (scanMode === 'userQR') {
        result = MOCK_DATABASE.users[data];
        if (result) {
          setScannedData(prev => ({ ...prev, user: result.name }));
          setInfo(`User '${result.name}' scanned successfully.`);
        } else {
          errorMsg = "User not found in database.";
        }
      } else if (scanMode === 'bookQR') {
        result = MOCK_DATABASE.books[data];
        if (result) {
          setScannedData(prev => ({ ...prev, book: result.title }));
          setInfo(`Book '${result.title}' scanned successfully.`);
        } else {
          errorMsg = "Book not found in database.";
        }
      }

      if (errorMsg) {
        setError(errorMsg);
      }
      
      setIsLoading(false);
      setScanMode(null); // Reset mode after scan
    }, 1000); // 1-second delay to simulate network request
  };

  // Handles the book cover scan using Gemini API
  const handleBookCoverScan = async () => {
    if (!isScanning || !videoRef.current || !canvasRef.current) {
        setError("Scanner not ready. Please start the scanner first.");
        return;
    }
    
    setIsLoading(true);
    setInfo("Analyzing book cover...");
    setIsScanning(false); // Pause scanning during analysis

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64ImageData = canvas.toDataURL("image/png").split(',')[1];
    
    const prompt = "Identify the title of the book in this image. Respond with only the book title.";

    const payload = {
        contents: [
            {
                role: "user",
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: "image/png",
                            data: base64ImageData
                        }
                    }
                ]
            }
        ],
    };

    try {
        const apiKey = ""; // Leave empty, handled by environment
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`API call failed with status: ${response.status}`);
        }

        const result = await response.json();
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
            setScannedData(prev => ({ ...prev, book: text.trim() }));
            setInfo(`Book '${text.trim()}' identified.`);
        } else {
            throw new Error("Could not identify the book title from the image.");
        }
    } catch (err) {
        console.error("Gemini API error:", err);
        setError(err.message || "Failed to analyze book cover.");
    } finally {
        setIsLoading(false);
        setScanMode(null);
        stopCamera();
    }
  };

  // Function to set the scanning mode and start the camera
  const startScanMode = (mode) => {
    setError(null);
    setScanMode(mode);
    setIsScanning(true);
    if (mode === 'bookCover') {
        setInfo("Point the camera at the book cover and press 'Scan Cover'");
    } else {
        setInfo(`Scanning for a ${mode === 'userQR' ? 'user' : 'book'} QR code...`);
    }
  };

  // Reset the entire scanner state
  const resetScanner = () => {
    setScannedData({ user: null, book: null });
    setScanMode(null);
    setIsScanning(false);
    setIsLoading(false);
    setError(null);
    setInfo("Select a scan mode to begin.");
    stopCamera();
  };
  
  // Effect to call the parent component's callback when both items are scanned
  useEffect(() => {
    if (scannedData.user && scannedData.book) {
        onScanned(scannedData);
        setInfo("User and Book successfully scanned! Ready to reset.");
    }
  }, [scannedData, onScanned]);


  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-lg p-6 md:p-8 space-y-6">
        <h1 className="text-3xl font-bold text-center text-gray-800">Library Scanner</h1>

        <div className="relative aspect-video w-full bg-gray-900 rounded-lg overflow-hidden shadow-inner">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transition-opacity duration-300 ${isScanning ? 'opacity-100' : 'opacity-0'}`}
          />
          {!isScanning && hasPermission !== false && (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 mb-4"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>
                <p className="text-center text-gray-300">Camera is off. Select a scan mode.</p>
             </div>
          )}
          {hasPermission === false && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800 p-4">
              <p className="text-red-400 mb-4 text-center">Camera access is required to use the scanner.</p>
              <button
                onClick={requestCameraPermission}
                className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700"
              >
                Allow Camera
              </button>
            </div>
          )}
           {isScanning && scanMode !== 'bookCover' && (
                <div className="absolute inset-0 border-8 border-white/20 rounded-lg animate-pulse"></div>
            )}
        </div>
        <canvas ref={canvasRef} className="hidden"></canvas>

        {/* --- Status Display --- */}
        <div className="text-center p-4 bg-gray-100 rounded-lg">
            {isLoading ? (
                <div className="flex items-center justify-center space-x-2 text-gray-600">
                    <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span>{info}</span>
                </div>
            ) : error ? (
                <p className="text-red-600 font-medium">{error}</p>
            ) : (
                <p className="text-gray-700">{info}</p>
            )}
        </div>

        {/* --- Scan Controls --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => startScanMode('userQR')}
            disabled={isScanning || isLoading || !isJsqrLoaded}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition-all flex items-center justify-center space-x-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            <span>Scan User</span>
          </button>
          <button
            onClick={() => startScanMode('bookQR')}
            disabled={isScanning || isLoading || !isJsqrLoaded}
            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 transition-all flex items-center justify-center space-x-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            <span>Scan Book QR</span>
          </button>
          <button
            onClick={() => startScanMode('bookCover')}
            disabled={isScanning || isLoading}
            className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 transition-all flex items-center justify-center space-x-2"
          >
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            <span>Scan Cover</span>
          </button>
        </div>
        
        {scanMode === 'bookCover' && isScanning && (
            <button
                onClick={handleBookCoverScan}
                disabled={isLoading}
                className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
            >
                Capture and Identify Book
            </button>
        )}

        {/* --- Results and Reset --- */}
        <div className="border-t pt-6 space-y-4">
            <div className="flex justify-between items-center">
                <span className="font-medium text-gray-600">Scanned User:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${scannedData.user ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-500'}`}>
                    {scannedData.user || "None"}
                </span>
            </div>
             <div className="flex justify-between items-center">
                <span className="font-medium text-gray-600">Scanned Book:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${scannedData.book ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-500'}`}>
                    {scannedData.book || "None"}
                </span>
            </div>
            <button
              onClick={resetScanner}
              className="w-full px-6 py-3 mt-4 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 hover:border-gray-400 transition-colors"
            >
              Reset
            </button>
        </div>
      </div>
    </div>
  );
}

export default QRScanner;
