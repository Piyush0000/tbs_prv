"use client";
import React, { useState, useRef, useEffect } from "react";

function CafeDropoffScanner() {
  const [scanMode, setScanMode] = useState(null);
  const [scannedData, setScannedData] = useState({
    transactionId: null,
    userId: null,
    bookId: null,
    detectedBookName: null
  });
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState("Select what to scan");
  const [hasPermission, setHasPermission] = useState(null);
  const [isJsqrLoaded, setIsJsqrLoaded] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  const GEMINI_API_KEY = 'AIzaSyBGGLrTRGa17t6ZSUzSF6Zn1zsXeJhH0Xk';
  
  // Load jsQR library
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
    script.async = true;
    script.onload = () => setIsJsqrLoaded(true);
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);
  
  // Camera management
  useEffect(() => {
    if (isScanning) {
      requestCameraPermission();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isScanning]);
  
  const requestCameraPermission = async () => {
    if (streamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      setHasPermission(true);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      requestAnimationFrame(scanFrame);
    } catch (err) {
      setError("Please allow camera access");
      setHasPermission(false);
      setIsScanning(false);
    }
  };
  
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };
  
  // Handle compound QR code scan (Transaction + User)
  const handleCompoundQrScan = async (data) => {
    setIsScanning(false);
    setIsLoading(true);
    
    try {
      // Parse compound QR: "TXN_timestamp_hash.USER_ID"
      const parts = data.split('.');
      if (parts.length !== 2) {
        throw new Error('Invalid QR format. Expected: TXN_xxx.USER_xxx');
      }
      
      const transactionId = parts[0];
      const userId = parts[1];
      
      if (!transactionId.startsWith('TXN_') || !userId.startsWith('USER_')) {
        throw new Error('Invalid QR format');
      }
      
      // Fetch transaction details
      const response = await fetch(`${API_BASE_URL}/transactions/${transactionId}`);
      if (!response.ok) {
        throw new Error('Transaction not found');
      }
      
      const transaction = await response.json();
      
      // Verify it's a dropoff_pending transaction
      if (transaction.status !== 'dropoff_pending') {
        throw new Error(`Invalid transaction status: ${transaction.status}. Expected: dropoff_pending`);
      }
      
      setScannedData(prev => ({
        ...prev,
        transactionId: transactionId,
        userId: userId,
        bookId: transaction.book_id
      }));
      
      setInfo(`Transaction verified. Now scan the book cover to complete drop-off.`);
      setScanMode(null);
      
    } catch (err) {
      setError(err.message);
      setScanMode(null);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle book cover scan and verification
  const handleBookCoverScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsLoading(true);
    setIsScanning(false);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const base64ImageData = canvas.toDataURL("image/png").split(',')[1];
    
    try {
      // Use Gemini to identify the book
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { text: "Identify the title of the book in this image. Respond with only the book title, nothing else." },
                { inlineData: { mimeType: "image/png", data: base64ImageData } }
              ]
            }]
          })
        }
      );
      
      if (!response.ok) throw new Error('Failed to analyze book cover');
      
      const result = await response.json();
      const detectedBookName = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      
      if (detectedBookName) {
        setScannedData(prev => ({ ...prev, detectedBookName }));
        
        // Normalize names for comparison
        const normalizedDetected = detectedBookName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const expectedBaseName = scannedData.bookId.replace(/_\d+$/, '').toLowerCase();
        
        if (normalizedDetected === expectedBaseName) {
          // Complete the drop-off
          await completeDropoff();
        } else {
          setVerificationResult({
            isMatch: false,
            message: `Book mismatch! Expected: ${scannedData.bookId}, Detected: ${detectedBookName}`
          });
          setError('Book verification failed - wrong book scanned');
        }
      }
    } catch (err) {
      setError(`Failed to verify book: ${err.message}`);
    } finally {
      setIsLoading(false);
      setScanMode(null);
      stopCamera();
    }
  };
  
  // Complete the drop-off transaction
  const completeDropoff = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/transactions/complete/${scannedData.transactionId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to complete drop-off');
      }
      
      setVerificationResult({
        isMatch: true,
        message: '✅ Drop-off completed successfully!'
      });
      setInfo('Book drop-off completed and verified!');
      
    } catch (err) {
      setError(`Failed to complete drop-off: ${err.message}`);
    }
  };
  
  // Scanning loop
  const scanFrame = () => {
    if (!isScanning || !videoRef.current || !canvasRef.current || !isJsqrLoaded) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(scanFrame);
      return;
    }
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    if (scanMode === 'compoundQR') {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qrCode = window.jsQR(imageData.data, imageData.width, imageData.height);
      
      if (qrCode?.data) {
        handleCompoundQrScan(qrCode.data);
        return;
      }
    }
    
    if (isScanning) {
      requestAnimationFrame(scanFrame);
    }
  };
  
  const startScanMode = (mode) => {
    setError(null);
    setVerificationResult(null);
    setScanMode(mode);
    setIsScanning(true);
    
    if (mode === 'compoundQR') {
      setInfo('Scan the compound QR code (Transaction + User)');
    } else if (mode === 'bookCover') {
      setInfo('Point camera at book cover and press "Capture"');
    }
  };
  
  const resetScanner = () => {
    setScannedData({
      transactionId: null,
      userId: null,
      bookId: null,
      detectedBookName: null
    });
    setScanMode(null);
    setIsScanning(false);
    setIsLoading(false);
    setError(null);
    setInfo("Select what to scan");
    setVerificationResult(null);
    stopCamera();
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h1 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Cafe Drop-off Scanner
          </h1>
          <p className="text-center text-gray-600 mb-6">Verify book returns at your cafe</p>
          
          {/* Camera View */}
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden mb-6">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isScanning ? 'opacity-100' : 'opacity-0'}`}
            />
            {!isScanning && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <svg className="w-16 h-16 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-2 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  <p>Camera ready</p>
                </div>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Status Display */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                <span className="text-gray-600">Processing...</span>
              </div>
            ) : error ? (
              <p className="text-red-600 font-medium">⚠️ {error}</p>
            ) : (
              <p className="text-gray-700">{info}</p>
            )}
          </div>
          
          {/* Scanned Data Display */}
          {(scannedData.transactionId || scannedData.bookId) && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg space-y-2">
              {scannedData.transactionId && (
                <div className="flex justify-between">
                  <span className="font-medium">Transaction:</span>
                  <span className="text-sm font-mono">{scannedData.transactionId}</span>
                </div>
              )}
              {scannedData.userId && (
                <div className="flex justify-between">
                  <span className="font-medium">User:</span>
                  <span className="text-sm font-mono">{scannedData.userId}</span>
                </div>
              )}
              {scannedData.bookId && (
                <div className="flex justify-between">
                  <span className="font-medium">Expected Book:</span>
                  <span className="text-sm font-mono">{scannedData.bookId}</span>
                </div>
              )}
              {scannedData.detectedBookName && (
                <div className="flex justify-between">
                  <span className="font-medium">Detected:</span>
                  <span className="text-sm">{scannedData.detectedBookName}</span>
                </div>
              )}
            </div>
          )}
          
          {/* Verification Result */}
          {verificationResult && (
            <div className={`mb-6 p-4 rounded-lg ${
              verificationResult.isMatch 
                ? 'bg-green-50 border-2 border-green-200' 
                : 'bg-red-50 border-2 border-red-200'
            }`}>
              <p className={`font-semibold ${
                verificationResult.isMatch ? 'text-green-700' : 'text-red-700'
              }`}>
                {verificationResult.message}
              </p>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="space-y-3">
            {!scannedData.transactionId && (
              <button
                onClick={() => startScanMode('compoundQR')}
                disabled={isScanning || isLoading}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                📱 Scan Drop-off QR Code
              </button>
            )}
            
            {scannedData.transactionId && !scannedData.detectedBookName && (
              <>
                <button
                  onClick={() => startScanMode('bookCover')}
                  disabled={isScanning || isLoading}
                  className="w-full py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg font-semibold hover:shadow-lg transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  📚 Scan Book Cover
                </button>
                
                {scanMode === 'bookCover' && isScanning && (
                  <button
                    onClick={handleBookCoverScan}
                    className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    📸 Capture & Verify Book
                  </button>
                )}
              </>
            )}
            
            {(scannedData.transactionId || verificationResult) && (
              <button
                onClick={resetScanner}
                className="w-full py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                🔄 Reset Scanner
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CafeDropoffScanner;