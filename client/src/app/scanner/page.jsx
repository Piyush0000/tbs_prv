"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";

function QRScanner({ onScanned }) {
  const [scannedData, setScannedData] = useState({ user: null, book: null, expectedBook: null });
  const [scanMode, setScanMode] = useState(null); // 'userQR', 'bookCover'
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState("Select a scan mode to begin.");
  const [hasPermission, setHasPermission] = useState(null);
  const [isJsqrLoaded, setIsJsqrLoaded] = useState(false);
  const [debugLog, setDebugLog] = useState([]);
  
  // States for book suggestions and verification
  const [bookSuggestions, setBookSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [identifiedTitle, setIdentifiedTitle] = useState("");
  const [bookVerificationResult, setBookVerificationResult] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  
  // Configuration - Update these with your actual values
  const API_BASE_URL = typeof window !== 'undefined' && window.location ? 
    `${window.location.protocol}//${window.location.hostname}:5000/api` : 
    'http://localhost:5000/api';
  const GEMINI_API_KEY = 'AIzaSyBGGLrTRGa17t6ZSUzSF6Zn1zsXeJhH0Xk';
  
  // Parse QR data to determine type and extract relevant information
  const parseQRData = (qrData) => {
    console.log(`Parsing QR data: ${qrData}`);
    
    // Check if it's a transaction QR (format: TXN_timestamp_hash.User_ID.Book_ID)
    if (qrData.startsWith('TXN_')) {
      const parts = qrData.split('.');
      if (parts.length >= 2) {
        const userId = parts[1]; // Extract User_038
        const bookId = parts.length > 2 ? parts[2] : null; // Extract Book_ID if present
        const transactionId = parts[0]; // Extract TXN_1757178592907_vhxwu1
        console.log(`Extracted User ID: ${userId}, Book ID: ${bookId}, Transaction ID: ${transactionId}`);
        return {
          type: 'transaction',
          userId: userId,
          bookId: bookId,
          transactionId: transactionId,
          fullData: qrData
        };
      }
    }
    
    // Check if it's a compound QR (User_ID.Book_ID)
    if (qrData.includes('.')) {
      const parts = qrData.split('.');
      if (parts.length === 2) {
        return {
          type: 'compound',
          userId: parts[0],
          bookId: parts[1],
          transactionId: null,
          fullData: qrData
        };
      }
    }
    
    // Check if it's a simple user ID (User_XXX or just the ID)
    if (qrData.startsWith('User_') || /^[a-zA-Z0-9]+$/.test(qrData)) {
      return {
        type: 'user',
        userId: qrData,
        bookId: null,
        transactionId: null,
        fullData: qrData
      };
    }
    
    return {
      type: 'unknown',
      userId: qrData,
      bookId: null,
      transactionId: null,
      fullData: qrData
    };
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

  // Function to fetch book data from the API
  const fetchBookData = async (bookId) => {
    try {
      addDebugLog(`Fetching book data for ID: ${bookId}`);
      const response = await fetch(`${API_BASE_URL}/books/${bookId}`);
      
      if (!response.ok) {
        throw new Error(`Book API call failed with status: ${response.status}`);
      }
      
      const bookData = await response.json();
      addDebugLog(`Book found: ${bookData.name || bookData.title}`);
      return bookData;
    } catch (err) {
      addDebugLog(`Book fetch error: ${err.message}`, 'error');
      throw err;
    }
  };

  // Function to fetch user data from MongoDB with QR parsing and book details
  const fetchUserData = async (qrData) => {
    try {
      console.log(`=== FETCHUSERDATA DEBUG ===`);
      console.log(`Raw QR data: ${qrData}`);
      
      if (typeof parseQRData !== 'function') {
        console.error('parseQRData function is not available!');
        throw new Error('parseQRData function is not defined');
      }
      
      const parsed = parseQRData(qrData);
      console.log(`Parsed result:`, parsed);
      
      const userId = parsed.userId;
      const bookId = parsed.bookId;
      console.log(`Using User ID: ${userId}, Book ID: ${bookId}`);
      
      // Fetch user data
      addDebugLog(`Fetching user data for ID: ${userId}`);
      const userResponse = await fetch(`${API_BASE_URL}/users/${userId}`);
      
      if (!userResponse.ok) {
        throw new Error(`User API call failed with status: ${userResponse.status}`);
      }
      
      const userData = await userResponse.json();
      addDebugLog(`User found: ${userData.name || userData.username}`);
      
      // If bookId is present, fetch book data as well
      let expectedBookData = null;
      if (bookId) {
        try {
          expectedBookData = await fetchBookData(bookId);
          addDebugLog(`Expected book: ${expectedBookData.name || expectedBookData.title}`);
        } catch (bookErr) {
          addDebugLog(`Failed to fetch expected book: ${bookErr.message}`, 'error');
          // Continue without book data - user scan still successful
        }
      }
      
      return {
        user: userData,
        expectedBook: expectedBookData,
        qrInfo: parsed
      };
    } catch (err) {
      console.log(`=== FETCHUSERDATA ERROR ===`, err);
      addDebugLog(`User fetch error: ${err.message}`, 'error');
      throw err;
    }
  };

  // Enhanced function to search book in database with suggestions
  const searchBookWithSuggestions = async (bookTitle) => {
    try {
      addDebugLog(`Searching for book with title: "${bookTitle}"`);
      
      // Get all books from database
      const response = await fetch(`${API_BASE_URL}/books`);
      
      if (!response.ok) {
        throw new Error(`Books API call failed with status: ${response.status}`);
      }
      
      const allBooks = await response.json();
      
      if (!allBooks || allBooks.length === 0) {
        throw new Error('No books found in database');
      }

      const searchTerm = bookTitle.toLowerCase().trim();
      const searchWords = searchTerm.split(' ').filter(word => word.length > 2);
      
      // Calculate similarity scores for all books
      const scoredBooks = allBooks.map(book => {
        const bookName = (book.name || book.title || '').toLowerCase();
        const bookAuthor = (book.author || '').toLowerCase();
        const bookWords = bookName.split(' ').concat(bookAuthor.split(' '));
        
        let score = 0;
        
        // Exact match bonus
        if (bookName === searchTerm) {
          score += 100;
        }
        
        // Partial match scoring
        searchWords.forEach(searchWord => {
          if (bookName.includes(searchWord)) {
            score += searchWord.length * 2; // Longer words get more weight
          }
          if (bookAuthor.includes(searchWord)) {
            score += searchWord.length; // Author match gets some weight
          }
          // Word boundary matches
          bookWords.forEach(bookWord => {
            if (bookWord.includes(searchWord)) {
              score += 1;
            }
          });
        });
        
        // Length similarity bonus (books with similar title length might be more relevant)
        const lengthDiff = Math.abs(bookName.length - searchTerm.length);
        if (lengthDiff < 5) {
          score += 5;
        }
        
        return { ...book, score };
      });
      
      // Sort by score and filter out very low scores
      const suggestions = scoredBooks
        .filter(book => book.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // Top 5 suggestions
      
      addDebugLog(`Found ${suggestions.length} potential matches`);
      
      return {
        exactMatch: suggestions.length > 0 && suggestions[0].score >= 100 ? suggestions[0] : null,
        suggestions: suggestions
      };
      
    } catch (err) {
      addDebugLog(`Book search error: ${err.message}`, 'error');
      throw err;
    }
  };

  // Function to verify if scanned book matches expected book
  const verifyBookMatch = (scannedBookTitle, expectedBook) => {
    if (!expectedBook) {
      return { isMatch: false, reason: "No expected book to compare with" };
    }
    
    const expectedTitle = (expectedBook.name || expectedBook.title || '').toLowerCase().trim();
    const scannedTitle = scannedBookTitle.toLowerCase().trim();
    
    // Exact match
    if (expectedTitle === scannedTitle) {
      return { isMatch: true, confidence: 100 };
    }
    
    // Word-based matching
    const expectedWords = expectedTitle.split(' ').filter(word => word.length > 2);
    const scannedWords = scannedTitle.split(' ').filter(word => word.length > 2);
    
    let matchingWords = 0;
    let totalWords = Math.max(expectedWords.length, scannedWords.length);
    
    expectedWords.forEach(expectedWord => {
      if (scannedWords.some(scannedWord => 
          scannedWord.includes(expectedWord) || expectedWord.includes(scannedWord)
      )) {
        matchingWords++;
      }
    });
    
    const confidence = totalWords > 0 ? (matchingWords / totalWords) * 100 : 0;
    
    return {
      isMatch: confidence >= 60, // Consider it a match if 60% of words match
      confidence: Math.round(confidence),
      reason: confidence >= 60 ? 
        `Strong match with ${confidence}% word similarity` : 
        `Weak match with only ${confidence}% word similarity`
    };
  };

  // Handles the result of a successful QR code scan
  const handleQrScan = async (data) => {
    if (!data) return;
    setIsScanning(false); // Stop scanning after a successful read
    setIsLoading(true);
    setInfo(`Processing user and book information...`);
    addDebugLog(`QR code scanned: ${data}`);

    try {
      const { user, expectedBook, qrInfo } = await fetchUserData(data);
      const userName = user.name || user.username || 'Unknown User';
      
      // Update scanned data with user and expected book information
      setScannedData(prev => ({ 
        ...prev, 
        user: userName,
        expectedBook: expectedBook
      }));
      
      if (expectedBook) {
        const expectedBookTitle = expectedBook.name || expectedBook.title || 'Unknown Book';
        setInfo(`User '${userName}' scanned successfully. Expected book: '${expectedBookTitle}'. Now scan the book cover to verify.`);
        addDebugLog(`Expected book set: ${expectedBookTitle}`);
      } else {
        setInfo(`User '${userName}' scanned successfully. Now scan any book cover.`);
        addDebugLog("No expected book found in QR code");
      }
    } catch (err) {
      addDebugLog(`Scan processing error: ${err.message}`, 'error');
      setError(err.message || `Failed to process user`);
    } finally {
      setIsLoading(false);
      setScanMode(null); // Reset mode after scan
    }
  };

  // Enhanced book cover scan with verification
  const handleBookCoverScan = async () => {
    if (!isScanning || !videoRef.current || !canvasRef.current) {
      setError("Scanner not ready. Please start the scanner first.");
      return;
    }
    
    setIsLoading(true);
    setInfo("Analyzing book cover...");
    setIsScanning(false); // Pause scanning during analysis
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
        throw new Error("Gemini API key is not configured. Please set NEXT_PUBLIC_GEMINI_API_KEY in your environment variables.");
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
        throw new Error(`Gemini API call failed with status: ${response.status}. ${errorText}`);
      }

      const result = await response.json();
      addDebugLog(`Gemini API result: ${JSON.stringify(result)}`);
      
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        const bookTitle = text.trim();
        setIdentifiedTitle(bookTitle);
        addDebugLog(`Book title identified by AI: ${bookTitle}`);
        
        // Check if we have an expected book to verify against
        if (scannedData.expectedBook) {
          const verification = verifyBookMatch(bookTitle, scannedData.expectedBook);
          setBookVerificationResult(verification);
          
          if (verification.isMatch) {
            const expectedBookTitle = scannedData.expectedBook.name || scannedData.expectedBook.title;
            setScannedData(prev => ({ ...prev, book: expectedBookTitle }));
            setInfo(`✅ Book verified! Scanned book matches expected book '${expectedBookTitle}' (${verification.confidence}% confidence).`);
            addDebugLog(`Book verification successful: ${verification.confidence}% confidence`);
          } else {
            setInfo(`❌ Book mismatch! Scanned '${bookTitle}' but expected '${scannedData.expectedBook.name || scannedData.expectedBook.title}'. ${verification.reason}`);
            addDebugLog(`Book verification failed: ${verification.reason}`);
            // Still show suggestions for the scanned book
            try {
              const { exactMatch, suggestions } = await searchBookWithSuggestions(bookTitle);
              if (suggestions.length > 0) {
                setBookSuggestions(suggestions);
                setShowSuggestions(true);
              }
            } catch (searchErr) {
              addDebugLog(`Database search error: ${searchErr.message}`, 'error');
            }
          }
        } else {
          // No expected book - proceed with normal book identification
          try {
            const { exactMatch, suggestions } = await searchBookWithSuggestions(bookTitle);
            
            if (exactMatch) {
              // Exact match found
              const finalBookTitle = exactMatch.name || exactMatch.title || bookTitle;
              setScannedData(prev => ({ ...prev, book: finalBookTitle }));
              setInfo(`Book '${finalBookTitle}' found in database!`);
              addDebugLog(`Exact match found: ${finalBookTitle}`);
              setShowSuggestions(false);
            } else if (suggestions.length > 0) {
              // Show suggestions
              setBookSuggestions(suggestions);
              setShowSuggestions(true);
              setInfo(`Book identified as '${bookTitle}'. Found ${suggestions.length} similar books in database:`);
              addDebugLog(`No exact match, showing ${suggestions.length} suggestions`);
            } else {
              // No matches found
              setInfo(`Book '${bookTitle}' identified but not found in library database.`);
              setShowSuggestions(false);
              addDebugLog("No matches found in database");
            }
          } catch (searchErr) {
            addDebugLog(`Database search error: ${searchErr.message}`, 'error');
            setInfo(`Book '${bookTitle}' identified (database search failed)`);
            setShowSuggestions(false);
          }
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

  // Handle selecting a book from suggestions
  const handleSelectSuggestion = (book) => {
    const bookTitle = book.name || book.title || 'Unknown Book';
    setScannedData(prev => ({ ...prev, book: bookTitle }));
    setInfo(`Selected '${bookTitle}' from suggestions.`);
    setShowSuggestions(false);
    setBookSuggestions([]);
    addDebugLog(`User selected suggestion: ${bookTitle}`);
  };

  // Handle using the AI-identified title even if not in database
  const handleUseIdentifiedTitle = () => {
    setScannedData(prev => ({ ...prev, book: identifiedTitle }));
    setInfo(`Using identified title '${identifiedTitle}' (not in database).`);
    setShowSuggestions(false);
    setBookSuggestions([]);
    addDebugLog(`User chose to use AI-identified title: ${identifiedTitle}`);
  };

  // Handle manual verification override
  const handleManualVerification = (accept) => {
    if (accept) {
      setScannedData(prev => ({ ...prev, book: identifiedTitle }));
      setInfo(`✅ Manual verification: Using '${identifiedTitle}' as the correct book.`);
    } else {
      setInfo(`❌ Manual verification: Book mismatch confirmed. Please scan the correct book.`);
    }
    setBookVerificationResult(null);
    addDebugLog(`Manual verification: ${accept ? 'accepted' : 'rejected'}`);
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

    // Only try to decode QR codes if in userQR mode
    if (scanMode === 'userQR') {
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

  // Function to set the scanning mode and start the camera
  const startScanMode = (mode) => {
    setError(null);
    setShowSuggestions(false);
    setBookSuggestions([]);
    setBookVerificationResult(null);
    setScanMode(mode);
    setIsScanning(true);
    addDebugLog(`Starting scan mode: ${mode}`);
    
    if (mode === 'bookCover') {
      setInfo("Point the camera at the book cover and press 'Scan Cover'");
    } else {
      setInfo(`Scanning for a QR code (User or Book)...`);
    }
  };

  // Reset the entire scanner state
  const resetScanner = () => {
    setScannedData({ user: null, book: null, expectedBook: null });
    setScanMode(null);
    setIsScanning(false);
    setIsLoading(false);
    setError(null);
    setInfo("Select a scan mode to begin.");
    setDebugLog([]);
    setShowSuggestions(false);
    setBookSuggestions([]);
    setIdentifiedTitle("");
    setBookVerificationResult(null);
    addDebugLog("Scanner reset");
    stopCamera();
  };
  
  // Effect to call the parent component's callback when both items are scanned
  useEffect(() => {
    if (scannedData.user && scannedData.book && typeof onScanned === 'function') {
      const resultData = {
        user: scannedData.user,
        book: scannedData.book,
        expectedBook: scannedData.expectedBook,
        verification: bookVerificationResult
      };
      onScanned(resultData);
      setInfo("User and Book successfully scanned! Ready to reset.");
      addDebugLog("Both user and book scanned successfully");
    }
  }, [scannedData, onScanned, bookVerificationResult]);

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
           {isScanning && scanMode === 'userQR' && (
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

        {/* --- Expected Book Display --- */}
        {scannedData.expectedBook && (
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">Expected Book from QR:</h3>
            <div className="bg-white rounded-lg p-3 border border-blue-200">
              <div className="font-medium text-gray-900">{scannedData.expectedBook.name || scannedData.expectedBook.title}</div>
              {scannedData.expectedBook.author && (
                <div className="text-sm text-gray-600">by {scannedData.expectedBook.author}</div>
              )}
              {scannedData.expectedBook.genre && (
                <div className="text-xs text-gray-500">{scannedData.expectedBook.genre}</div>
              )}
            </div>
          </div>
        )}

        {/* --- Book Verification Result --- */}
        {bookVerificationResult && !bookVerificationResult.isMatch && (
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <h3 className="font-semibold text-red-900 mb-2">Book Verification Failed</h3>
            <p className="text-red-700 mb-3">{bookVerificationResult.reason}</p>
            <p className="text-sm text-red-600 mb-3">
              Expected: <strong>{scannedData.expectedBook?.name || scannedData.expectedBook?.title}</strong><br/>
              Scanned: <strong>{identifiedTitle}</strong>
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => handleManualVerification(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                Use Anyway
              </button>
              <button
                onClick={() => handleManualVerification(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
              >
                Scan Correct Book
              </button>
            </div>
          </div>
        )}

        {/* --- Book Suggestions --- */}
        {showSuggestions && bookSuggestions.length > 0 && (
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-3">Select a book from suggestions:</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {bookSuggestions.map((book, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectSuggestion(book)}
                  className="w-full text-left p-3 bg-white rounded-lg border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-colors"
                >
                  <div className="font-medium text-gray-900">{book.name || book.title}</div>
                  {book.author && (
                    <div className="text-sm text-gray-600">by {book.author}</div>
                  )}
                  {book.genre && (
                    <div className="text-xs text-gray-500">{book.genre}</div>
                  )}
                  <div className="text-xs text-blue-600 mt-1">Match score: {book.score}</div>
                </button>
              ))}
            </div>
            {identifiedTitle && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <button
                  onClick={handleUseIdentifiedTitle}
                  className="w-full p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                >
                  Use "{identifiedTitle}" (not in database)
                </button>
              </div>
            )}
          </div>
        )}

        {/* --- Debug Log --- */}
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

        {/* --- Scan Controls --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => startScanMode('userQR')}
            disabled={isScanning || isLoading || !isJsqrLoaded}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition-all flex items-center justify-center space-x-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            <span>Scan User QR</span>
          </button>
          <button
            onClick={() => startScanMode('bookCover')}
            disabled={isScanning || isLoading}
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
            {scannedData.expectedBook && (
              <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-600">Expected Book:</span>
                  <span className="px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800">
                      {scannedData.expectedBook.name || scannedData.expectedBook.title || "Unknown"}
                  </span>
              </div>
            )}
            {bookVerificationResult && (
              <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-600">Verification:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    bookVerificationResult.isMatch 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                      {bookVerificationResult.isMatch ? '✅ Match' : '❌ Mismatch'}
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