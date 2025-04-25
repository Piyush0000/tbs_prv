"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CafeCard } from "../../components/cafe";
import { useAuth } from "../Hooks/useAuth";

// New component to handle useSearchParams logic
function BookCafeSelectorContent() {
  const { refreshToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [bookName, setBookName] = useState("");
  const [cafes, setCafes] = useState([]);
  const [error, setError] = useState(null);
  const [loadingCafes, setLoadingCafes] = useState(false);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [selectedCafe, setSelectedCafe] = useState(null);

  // Fetch book details (to get the name)
  const fetchBookDetails = async (bookId) => {
    try {
      let token = localStorage.getItem("token");
      if (!token) {
        window.location.href = "/auth/signin";
        return;
      }
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/books/${bookId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        token = await refreshToken();
        if (!token) throw new Error("Failed to refresh token");
        localStorage.setItem("token", token);
        const retryRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/books/${bookId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!retryRes.ok) throw new Error("Failed to fetch book details");
        const data = await retryRes.json();
        setBookName(data.name);
      } else if (!res.ok) {
        throw new Error("Failed to fetch book details");
      } else {
        const data = await res.json();
        setBookName(data.name);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Fetch cafes for a specific book
  const fetchCafes = async (bookId) => {
    if (loadingCafes) return;
    setLoadingCafes(true);
    try {
      let token = localStorage.getItem("token");
      if (!token) {
        window.location.href = "/auth/signin";
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cafes/book/${bookId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        token = await refreshToken();
        if (!token) throw new Error("Failed to refresh token");
        localStorage.setItem("token", token);
        const retryRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cafes/book/${bookId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!retryRes.ok) throw new Error("Failed to fetch cafes");
        const retryData = await retryRes.json();
        setCafes(retryData);
      } else if (!res.ok) {
        throw new Error("Failed to fetch cafes");
      } else {
        const data = await res.json();
        setCafes(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingCafes(false);
    }
  };

  // Create a transaction
  const requestBook = async (cafeId) => {
    if (transactionLoading) return;
    setTransactionLoading(true);
    try {
      let token = localStorage.getItem("token");
      if (!token) {
        window.location.href = "/auth/signin";
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          book_id: selectedBookId,
          cafe_id: cafeId,
          status: "pickup_pending",
        }),
      });

      if (res.status === 401) {
        token = await refreshToken();
        if (!token) throw new Error("Failed to refresh token");
        localStorage.setItem("token", token);
        const retryRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            book_id: selectedBookId,
            cafe_id: cafeId,
            status: "pickup_pending",
          }),
        });
        if (!retryRes.ok) throw new Error("Failed to create transaction");
        alert("Book requested successfully!");
        router.push("/profile"); // Redirect to profile page
      } else if (!res.ok) {
        throw new Error("Failed to create transaction");
      } else {
        alert("Book requested successfully!");
        router.push("/profile"); // Redirect to profile page
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setTransactionLoading(false);
      setShowConfirmPopup(false);
    }
  };

  // Handle "Book at this Cafe" button click
  const handleBookAtCafe = (cafe) => {
    setSelectedCafe(cafe);
    setShowConfirmPopup(true);
  };

  // Load book ID from URL and fetch cafes
  useEffect(() => {
    const bookId = searchParams.get("bookId");
    if (bookId) {
      setSelectedBookId(bookId);
      fetchBookDetails(bookId);
      fetchCafes(bookId);
    }
  }, [searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <section id="cafes-section">
          <h1 className="text-3xl font-bold mb-6 text-gray-800">
            Cafes with Your Selected Book
          </h1>
          {loadingCafes ? (
            <div className="text-gray-600">Loading cafes...</div>
          ) : cafes.length === 0 ? (
            <div className="text-gray-600">No cafes found for this book.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {cafes.map((cafe) => (
                <div key={cafe.cafe_id}>
                  <CafeCard
                    cafe={{
                      id: cafe.cafe_id,
                      image: cafe.image_url || "https://picsum.photos/200",
                      name: cafe.name,
                      distance: cafe.distance || "N/A",
                      rating: cafe.ratings,
                      location: cafe.location,
                      specialties: cafe.specials,
                      discounts: `${cafe.discount}%`,
                      priceRange: `₹${cafe.average_bill}`,
                      description: cafe.description || "No description available",
                    }}
                    onExpand={() => {}}
                  />
                  <button
                    onClick={() => handleBookAtCafe(cafe)}
                    className="mt-2 w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
                    disabled={transactionLoading}
                  >
                    {transactionLoading ? "Booking..." : "Book at this Cafe"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Confirmation Popup */}
        {showConfirmPopup && selectedCafe && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-bold mb-4">
                Do you want to book "{bookName}" from "{selectedCafe.name}"?
              </h2>
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setShowConfirmPopup(false)}
                  className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={() => requestBook(selectedCafe.cafe_id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  disabled={transactionLoading}
                >
                  {transactionLoading ? "Confirming..." : "Confirm Transaction"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function BookCafeSelector() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BookCafeSelectorContent />
    </Suspense>
  );
}