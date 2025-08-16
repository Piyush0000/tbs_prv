// File: src/app/admin/allot/page.js

"use client";
import { useState } from "react";
import QRScanner from "../../../components/QRScanner";

// Helper components for UI
const Spinner = () => (<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>);
const BookIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v11.494m0 0a2.494 2.494 0 01-4.988 0M12 17.747a2.494 2.494 0 004.988 0M12 17.747V6.253M3.75 6.253h16.5M3.75 17.747h16.5" /></svg>);
const UserIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>);

function BookAllotmentPage() {
    const [showScanner, setShowScanner] = useState(false);
    const [bookDetails, setBookDetails] = useState(null);
    const [username, setUsername] = useState("");
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

   // In /app/admin/allot/page.js

const handleBookScan = async (scannedData) => {
    const bookId = scannedData.firstCode;

    // --- START: ADD THIS VALIDATION ---
    // Check if the scanned data looks like a valid book ID
    if (!bookId || !bookId.startsWith('BOOK_')) { // Or whatever your book ID format is
        setError("Invalid QR Code. Please scan a valid book QR code.");
        setShowScanner(false);
        return; // Stop the function here
    }
    // --- END: ADD THIS VALIDATION ---

    setShowScanner(false);
    setIsLoading(true);
    setError(null);
    setBookDetails(null);

    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/books/details/${bookId}`);
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || "Book not found or could not be fetched.");
        }
        const data = await res.json();
        setBookDetails(data);
    } catch (err) {
        setError(err.message);
    } finally {
        setIsLoading(false);
    }
};

    const handleAllotBook = async (e) => {
        e.preventDefault();
        // ... (Your allotment logic here)
        console.log(`Allotting book ${bookDetails.book_id} to user ${username}`);
    };
    
    const resetState = () => {
        setBookDetails(null);
        setUsername("");
        setError(null);
        setSuccessMessage(null);
        setIsLoading(false);
        setShowScanner(false);
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
            <div className="w-full max-w-md mx-auto">
                <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-white">Book Allotment</h1>
                        <p className="text-gray-400 mt-2">Scan a book's QR code to assign it to a user.</p>
                    </div>

                    {isLoading && <div className="flex justify-center items-center h-40"><Spinner /></div>}
                    {error && <p className="text-red-400 bg-red-900 bg-opacity-50 p-3 rounded-lg my-4 text-center">{error}</p>}
                    {successMessage && <p className="text-green-400 bg-green-900 bg-opacity-50 p-3 rounded-lg my-4 text-center">{successMessage}</p>}

                    {!isLoading && !bookDetails && (
                        <button onClick={() => setShowScanner(true)} className="w-full flex items-center justify-center px-6 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-transform transform hover:scale-105">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Scan Book QR Code
                        </button>
                    )}

                    {bookDetails && (
                        <form onSubmit={handleAllotBook} className="space-y-6 animate-fade-in">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-300 border-b border-gray-700 pb-2 mb-4 flex items-center"><BookIcon /> Book Details</h3>
                                <div className="flex items-center space-x-4">
                                    {bookDetails.image_url && <img src={bookDetails.image_url} alt={bookDetails.name} className="w-20 h-28 object-cover rounded-md shadow-lg" />}
                                    <div className="space-y-1">
                                        <p className="text-xl font-bold text-white">{bookDetails.name}</p>
                                        <p className="text-sm text-gray-400">by {bookDetails.author}</p>
                                        <p className="text-sm text-gray-500 font-mono">{bookDetails.book_id}</p>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">Assign to User</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><UserIcon /></div>
                                    <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500" placeholder="Enter username or user ID" required />
                                </div>
                            </div>
                            <div className="flex items-center space-x-4">
                               <button type="button" onClick={resetState} className="w-full px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700">Cancel</button>
                                <button type="submit" disabled={isLoading} className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed">{isLoading ? 'Processing...' : 'Allot Book'}</button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
            
            {showScanner && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in">
                    <div className="bg-gray-800 p-4 rounded-xl shadow-2xl w-full max-w-sm">
                        <h2 className="text-xl text-center mb-4 text-white">Point Camera at Book QR Code</h2>
                        <div className="overflow-hidden rounded-lg">
                            <QRScanner onScanned={handleBookScan} />
                        </div>
                        <button onClick={() => setShowScanner(false)} className="mt-4 w-full p-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600">Close Scanner</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default BookAllotmentPage;