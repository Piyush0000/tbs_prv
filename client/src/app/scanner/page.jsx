"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";

function QRScanner({ onScanned }) {
  const [scannedData, setScannedData] = useState({ 
    transactionId: null, 
    expectedBookId: null, 
    detectedBookName: null,
    normalizedBookName: null
  });
  const [scanMode, setScanMode] = useState(null); // 'transactionQR', 'bookCover'
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState("Select a scan mode to begin.");
  const [hasPermission, setHasPermission] = useState(null);
  const [isJsqrLoaded, setIsJsqrLoaded] = useState(false);
  const [debugLog, setDebugLog] = useState([]);
  const [verificationResult, setVerificationResult] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  
  // Configuration
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
    (typeof window !== 'undefined' && window.location ? 
      `${window.location.protocol}//${window.location.hostname}:5000/api` : 
      'http://localhost:5000/api');
  const GEMINI_API_KEY = 'AIzaSyBGGLrTRGa17t6ZSUzSF6Zn1zsXeJhH0Xk';
  
  // Function to normalize book name (remove spaces, convert to lowercase)
  const normalizeBookName = (bookName) => {
    return bookName
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, '') // Remove all non-alphanumeric characters including spaces
      .trim();
  };

  // Function to extract book base name from book_id (remove underscore and numbers)
  const extractBookBaseName = (bookId) => {
    return bookId
      .replace(/_\d+$/, '') // Remove underscore followed by numbers at the end
      .toLowerCase(); // Convert to lowercase for comparison
  };
  
  // Debug logging function
  const addDebugLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { timestamp, message, type };
    setDebugLog(prev => [...prev.slice(-4), logEntry]);
    console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
  };
  
  // Effect to load the jsQR library from a CDN
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
    script.async = true;
    script.onload = () => {
      setIsJsqrLoaded(true);
      addDebugLog("jsQR library loaded successfully");
    };
    script.onerror = () => {
      addDebugLog("Failed to load jsQR library", 'error');
    };
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
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
      addDebugLog("Requesting camera permission...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setHasPermission(true);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      addDebugLog("Camera permission granted");
      // Start the scanning loop once permission is granted
      requestAnimationFrame(scanFrame);
    } catch (err) {
      console.error("Camera permission error:", err);
      addDebugLog(`Camera error: ${err.message}`, 'error');
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
      addDebugLog("Camera stopped");
    }
    if(videoRef.current) {
        videoRef.current.srcObject = null;
    }
  };

  // Function to fetch transaction data and extract book_id
  const fetchTransactionData = async (transactionId) => {
    try {
      addDebugLog(`Fetching transaction data for ID: ${transactionId}`);
      const response = await fetch(`${API_BASE_URL}/transactions/${transactionId}`);
      
      if (!response.ok) {
        throw new Error(`Transaction API call failed with status: ${response.status}`);
      }
      
      const transactionData = await response.json();
      addDebugLog(`Transaction found: ${JSON.stringify(transactionData)}`);
      
      // The transaction contains ObjectId references, we need to get the actual book_id string
      // First try to get it directly if it's populated, otherwise fetch the book separately
      let bookId = transactionData.book_id;
      
      if (typeof bookId === 'object' && bookId.book_id) {
        // If populated, use the book_id from the populated object
        bookId = bookId.book_id;
      } else if (typeof bookId === 'string' && bookId.match(/^[0-9a-fA-F]{24}$/)) {
        // If it's an ObjectId string, we need to fetch the book separately
        addDebugLog(`Book ID is ObjectId, fetching book details: ${bookId}`);
        const bookResponse = await fetch(`${API_BASE_URL}/books/${bookId}`);
        if (bookResponse.ok) {
          const bookData = await bookResponse.json();
          bookId = bookData.book_id;
          addDebugLog(`Fetched book_id from book data: ${bookId}`);
        } else {
          throw new Error('Failed to fetch book details');
        }
      }
      
      if (!bookId) {
        throw new Error('No book_id found in transaction');
      }
      
      addDebugLog(`Final book ID extracted: ${bookId}`);
      return { transaction: transactionData, bookId };
    } catch (err) {
      addDebugLog(`Transaction fetch error: ${err.message}`, 'error');
      throw err;
    }
  };

  // Function to update transaction status to approved
  // Function to update transaction status to approved
const updateTransactionStatus = async (transactionId, bookId) => {
  try {
    addDebugLog(`Updating transaction status for ID: ${transactionId}`);
    const token = localStorage.getItem('token');
    
    // Use the correct endpoint that exists in your backend
    const response = await fetch(`${API_BASE_URL}/transactions/approve/${transactionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ book_id: bookId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to approve transaction: ${errorData.error || response.statusText}`);
    }

    const updatedTransaction = await response.json();
    addDebugLog(`Transaction approved successfully: ${JSON.stringify(updatedTransaction)}`);
    return updatedTransaction;
  } catch (err) {
    addDebugLog(`Transaction update error: ${err.message}`, 'error');
    throw err;
  }
};

  // Handles the result of a successful transaction QR code scan
  const handleTransactionQrScan = async (data) => {
    if (!data) return;
    setIsScanning(false);
    setIsLoading(true);
    setInfo(`Processing transaction QR code...`);
    addDebugLog(`Transaction QR code scanned: ${data}`);

    try {
      // Extract transaction ID from QR data
      // QR format is TXN_timestamp_hash.User_ID - we only need the transaction part
      let transactionId = data;
      
      if (data.includes('.')) {
        // Split by dot and take the first part (transaction ID)
        transactionId = data.split('.')[0];
        addDebugLog(`Extracted transaction ID from compound QR: ${transactionId}`);
      }
      
      // Ensure it starts with TXN_
      if (!transactionId.startsWith('TXN_')) {
        throw new Error('Invalid transaction QR format. Expected format: TXN_timestamp_hash');
      }
      
      // Fetch transaction data to get book_id
      const { transaction, bookId } = await fetchTransactionData(transactionId);
      
      // Update scanned data with transaction and expected book ID
      setScannedData(prev => ({ 
        ...prev, 
        transactionId: transactionId,
        expectedBookId: bookId
      }));
      
      setInfo(`Transaction scanned successfully. Expected book ID: '${bookId}'. Now scan the book cover to verify.`);
      addDebugLog(`Expected book ID set: ${bookId}`);
    } catch (err) {
      addDebugLog(`Transaction scan processing error: ${err.message}`, 'error');
      setError(err.message || `Failed to process transaction`);
    } finally {
      setIsLoading(false);
      setScanMode(null);
    }
  };

  // Enhanced book cover scan with verification against transaction book_id
  const handleBookCoverScan = async () => {
    if (!isScanning || !videoRef.current || !canvasRef.current) {
      setError("Scanner not ready. Please start the scanner first.");
      return;
    }
    
    setIsLoading(true);
    setInfo("Analyzing book cover...");
    setIsScanning(false);
    addDebugLog("Starting book cover analysis");

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64ImageData = canvas.toDataURL("image/png").split(',')[1];
    addDebugLog(`Image captured, size: ${base64ImageData.length} characters`);
    
    const prompt = "Identify the title of the book in this image. Respond with only the book title, nothing else.";

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
      if (!GEMINI_API_KEY || GEMINI_API_KEY === '') {
        throw new Error("Gemini API key is not configured.");
      }

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;
      
      addDebugLog("Making Gemini API request...");
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      addDebugLog(`Gemini API response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        addDebugLog(`Gemini API error response: ${errorText}`, 'error');
        throw new Error(`Gemini API call failed with status: ${response.status}`);
      }

      const result = await response.json();
      addDebugLog(`Gemini API result: ${JSON.stringify(result)}`);
      
      const detectedBookName = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (detectedBookName) {
        addDebugLog(`Book name detected by AI: ${detectedBookName}`);
        
        // Normalize the detected book name
        const normalizedDetectedName = normalizeBookName(detectedBookName);
        addDebugLog(`Normalized detected name: ${normalizedDetectedName}`);
        
        // Extract base name from expected book_id
        const expectedBookBaseName = extractBookBaseName(scannedData.expectedBookId);
        addDebugLog(`Expected book base name: ${expectedBookBaseName}`);
        
        // Update scanned data
        setScannedData(prev => ({
          ...prev,
          detectedBookName: detectedBookName,
          normalizedBookName: normalizedDetectedName
        }));
        
        // Compare normalized names
        const isMatch = normalizedDetectedName === expectedBookBaseName;
        
        if (isMatch) {
          // Books match - approve the transaction
          try {
            await updateTransactionStatus(scannedData.transactionId, scannedData.expectedBookId);
            
            setVerificationResult({
              isMatch: true,
              confidence: 100,
              message: "✅ Book verification successful! Transaction approved."
            });
            setInfo(`✅ Book verified and transaction approved! Detected: '${detectedBookName}' matches expected book ID: '${scannedData.expectedBookId}'`);
            addDebugLog(`Book verification successful - transaction approved`);
          } catch (updateErr) {
            setError(`Book verified but failed to update transaction: ${updateErr.message}`);
            addDebugLog(`Failed to update transaction status: ${updateErr.message}`, 'error');
          }
        } else {
          // Books don't match
          setVerificationResult({
            isMatch: false,
            confidence: 0,
            message: "❌ Book verification failed! Scanned book doesn't match expected book."
          });
          setInfo(`❌ Book mismatch! Detected '${detectedBookName}' (normalized: '${normalizedDetectedName}') doesn't match expected '${expectedBookBaseName}'`);
          addDebugLog(`Book verification failed - names don't match`);
        }
      } else {
        throw new Error("Could not identify the book title from the image.");
      }
    } catch (err) {
      addDebugLog(`Gemini API error: ${err.message}`, 'error');
      setError(err.message || "Failed to analyze book cover.");
    } finally {
      setIsLoading(false);
      setScanMode(null);
      stopCamera();
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

    // Only try to decode QR codes if in transactionQR mode
    if (scanMode === 'transactionQR') {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qrCode = window.jsQR(imageData.data, imageData.width, imageData.height);

      if (qrCode?.data) {
        handleTransactionQrScan(qrCode.data);
      }
    }

    // Continue loop if still scanning
    if (isScanning) {
      requestAnimationFrame(scanFrame);
    }
  }, [isScanning, scanMode, isJsqrLoaded]);

  // Function to set the scanning mode and start the camera
  const startScanMode = (mode) => {
    setError(null);
    setVerificationResult(null);
    setScanMode(mode);
    setIsScanning(true);
    addDebugLog(`Starting scan mode: ${mode}`);
    
    if (mode === 'bookCover') {
      setInfo("Point the camera at the book cover and press 'Scan Cover'");
    } else {
      setInfo(`Scanning for transaction QR code...`);
    }
  };

  // Reset the entire scanner state
  const resetScanner = () => {
    setScannedData({ 
      transactionId: null, 
      expectedBookId: null, 
      detectedBookName: null,
      normalizedBookName: null
    });
    setScanMode(null);
    setIsScanning(false);
    setIsLoading(false);
    setError(null);
    setInfo("Select a scan mode to begin.");
    setDebugLog([]);
    setVerificationResult(null);
    addDebugLog("Scanner reset");
    stopCamera();
  };
  
  // Effect to call the parent component's callback when verification is complete
  useEffect(() => {
    if (verificationResult && typeof onScanned === 'function') {
      const resultData = {
        transactionId: scannedData.transactionId,
        expectedBookId: scannedData.expectedBookId,
        detectedBookName: scannedData.detectedBookName,
        normalizedBookName: scannedData.normalizedBookName,
        verification: verificationResult
      };
      onScanned(resultData);
      addDebugLog("Verification completed, calling parent callback");
    }
  }, [verificationResult, onScanned, scannedData]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-lg p-6 md:p-8 space-y-6">
        <h1 className="text-3xl font-bold text-center text-gray-800">Transaction Book Verifier</h1>

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
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 mb-4"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>
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
           {isScanning && scanMode === 'transactionQR' && (
                <div className="absolute inset-0 border-8 border-white/20 rounded-lg animate-pulse"></div>
            )}
        </div>
        <canvas ref={canvasRef} className="hidden"></canvas>

        {/* Status Display */}
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

        {/* Expected Book ID Display */}
        {scannedData.expectedBookId && (
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">Expected Book from Transaction:</h3>
            <div className="bg-white rounded-lg p-3 border border-blue-200">
              <div className="font-medium text-gray-900">Book ID: {scannedData.expectedBookId}</div>
              <div className="text-sm text-gray-600">Base Name: {extractBookBaseName(scannedData.expectedBookId)}</div>
            </div>
          </div>
        )}

        {/* Verification Result */}
        {verificationResult && (
          <div className={`rounded-lg p-4 border ${
            verificationResult.isMatch 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <h3 className={`font-semibold mb-2 ${
              verificationResult.isMatch ? 'text-green-900' : 'text-red-900'
            }`}>
              Verification Result
            </h3>
            <p className={
              verificationResult.isMatch ? 'text-green-700' : 'text-red-700'
            }>
              {verificationResult.message}
            </p>
            {scannedData.detectedBookName && (
              <div className="mt-3 text-sm">
                <p><strong>Detected:</strong> {scannedData.detectedBookName}</p>
                <p><strong>Normalized:</strong> {scannedData.normalizedBookName}</p>
                <p><strong>Expected Base:</strong> {extractBookBaseName(scannedData.expectedBookId)}</p>
              </div>
            )}
          </div>
        )}

        {/* Debug Log */}
        {debugLog.length > 0 && (
          <div className="bg-gray-900 text-green-400 p-3 rounded-lg text-xs font-mono max-h-32 overflow-y-auto">
            <div className="text-gray-500 mb-1">Debug Log:</div>
            {debugLog.map((log, index) => (
              <div key={index} className={`${log.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                [{log.timestamp}] {log.message}
              </div>
            ))}
          </div>
        )}

        {/* Scan Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => startScanMode('transactionQR')}
            disabled={isScanning || isLoading || !isJsqrLoaded || scannedData.transactionId}
            className={`w-full px-4 py-3 text-white rounded-lg font-semibold transition-all flex items-center justify-center space-x-2 ${
              scannedData.transactionId 
                ? 'bg-green-600' 
                : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
            <span>{scannedData.transactionId ? '✓ Transaction Scanned' : 'Scan Transaction QR'}</span>
          </button>
          <button
            onClick={() => startScanMode('bookCover')}
            disabled={isScanning || isLoading || !scannedData.transactionId}
            className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 transition-all flex items-center justify-center space-x-2"
          >
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            <span>Scan Book Cover</span>
          </button>
        </div>
        
        {scanMode === 'bookCover' && isScanning && (
            <button
                onClick={handleBookCoverScan}
                disabled={isLoading}
                className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
            >
                Capture and Verify Book
            </button>
        )}

        {/* Results and Reset */}
        <div className="border-t pt-6 space-y-4">
            <div className="flex justify-between items-center">
                <span className="font-medium text-gray-600">Transaction ID:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${scannedData.transactionId ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-500'}`}>
                    {scannedData.transactionId || "None"}
                </span>
            </div>
             <div className="flex justify-between items-center">
                <span className="font-medium text-gray-600">Expected Book ID:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${scannedData.expectedBookId ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-200 text-gray-500'}`}>
                    {scannedData.expectedBookId || "None"}
                </span>
            </div>
            <div className="flex justify-between items-center">
                <span className="font-medium text-gray-600">Detected Book:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${scannedData.detectedBookName ? 'bg-purple-100 text-purple-800' : 'bg-gray-200 text-gray-500'}`}>
                    {scannedData.detectedBookName || "None"}
                </span>
            </div>
            {verificationResult && (
              <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-600">Status:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    verificationResult.isMatch 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                      {verificationResult.isMatch ? '✅ Approved' : '❌ Rejected'}
                  </span>
              </div>
            )}
            <button
              onClick={resetScanner}
              className="w-full px-6 py-3 mt-4 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 hover:border-gray-400 transition-colors"
            >
              Reset Scanner
            </button>
        </div>
      </div>
    </div>
  );
}

export default QRScanner;