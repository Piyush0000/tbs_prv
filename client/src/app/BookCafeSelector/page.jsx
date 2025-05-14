"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CafeCard } from "../../components/cafe";
import { useAuth } from "../Hooks/useAuth";

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
  const [showRestrictionPopup, setShowRestrictionPopup] = useState(false);
  const [restrictionMessage, setRestrictionMessage] = useState("");

  // Check user eligibility (pending transactions, subscription validity, and book_id)
  const checkUserEligibility = async () => {
    try {
      let token = localStorage.getItem("token");
      if (!token) {
        console.log("No token found, redirecting to signin");
        window.location.href = "/auth/signin";
        return false;
      }

      // Fetch user profile to get subscription, book_id, and user_id
      console.log("Fetching user profile with token:", token.slice(0, 20) + "...");
      let userRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      let userData;
      if (userRes.status === 401) {
        console.log("Received 401, attempting to refresh token");
        token = await refreshToken();
        if (!token) {
          console.error("Failed to refresh token");
          throw new Error("Failed to refresh token");
        }
        localStorage.setItem("token", token);
        console.log("Retrying user profile fetch with new token:", token.slice(0, 20) + "...");
        const retryUserRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!retryUserRes.ok) {
          console.error("Retry failed with status:", retryUserRes.status);
          throw new Error(`Failed to fetch user profile: ${retryUserRes.statusText}`);
        }
        userData = await retryUserRes.json();
      } else if (!userRes.ok) {
        console.error("Initial fetch failed with status:", userRes.status);
        throw new Error(`Failed to fetch user profile: ${userRes.statusText}`);
      } else {
        userData = await userRes.json();
      }

      console.log("User profile fetched:", userData);

      // Validate subscription
      const currentDate = new Date();
      const subscriptionValidity = new Date(userData.subscription_validity);
      if (subscriptionValidity < currentDate || userData.deposit_status !== "deposited") {
        setRestrictionMessage("Your subscription is invalid or deposit is not paid. Please update your subscription.");
        setShowRestrictionPopup(true);
        return false;
      }

      // Fetch user's transactions using custom user_id (e.g., User_025)
      console.log("Fetching transactions for user_id:", userData.user_id);
      let transactionRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/transactions?user_id=${userData.user_id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      let transactions;
      if (transactionRes.status === 401) {
        console.log("Received 401 for transactions, attempting to refresh token");
        token = await refreshToken();
        if (!token) {
          console.error("Failed to refresh token for transactions");
          throw new Error("Failed to refresh token");
        }
        localStorage.setItem("token", token);
        console.log("Retrying transactions fetch with new token:", token.slice(0, 20) + "...");
        const retryTransactionRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/transactions?user_id=${userData.user_id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!retryTransactionRes.ok) {
          console.error("Retry transactions fetch failed with status:", retryTransactionRes.status);
          throw new Error(`Failed to fetch transactions: ${retryTransactionRes.statusText}`);
        }
        transactions = await retryTransactionRes.json();
      } else if (!transactionRes.ok) {
        console.error("Initial transactions fetch failed with status:", transactionRes.status);
        throw new Error(`Failed to fetch transactions: ${transactionRes.statusText}`);
      } else {
        transactions = await transactionRes.json();
      }

      // Log transactions for debugging
      console.log("Transactions fetched for user:", userData.user_id, transactions);

      // Check for pending transactions
      const pendingStatuses = ["pickup_pending", "picked_up", "dropoff_pending"];
      const hasPending = transactions.some((t) => pendingStatuses.includes(t.status));
      if (hasPending) {
        setRestrictionMessage("You have a pending transaction. Please complete it before requesting another book.");
        setShowRestrictionPopup(true);
        return false;
      }

      // Check if user has an active book only if there are relevant transactions
      if (userData.book_id && transactions.some((t) => t.status === "picked_up")) {
        setRestrictionMessage("You currently have a book. Please drop it off before requesting another.");
        setShowRestrictionPopup(true);
        return false;
      }

      return true;
    } catch (err) {
      console.error("Error in checkUserEligibility:", err.message);
      setError(err.message);
      return false;
    }
  };

  // Fetch book details
  const fetchBookDetails = async (bookId) => {
    try {
      let token = localStorage.getItem("token");
      if (!token) {
        console.log("No token found, redirecting to signin");
        window.location.href = "/auth/signin";
        return;
      }
      console.log("Fetching book details for bookId:", bookId);
      let res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/books/${bookId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        console.log("Received 401 for book details, attempting to refresh token");
        token = await refreshToken();
        if (!token) {
          console.error("Failed to refresh token");
          throw new Error("Failed to refresh token");
        }
        localStorage.setItem("token", token);
        console.log("Retrying book details fetch with new token:", token.slice(0, 20) + "...");
        const retryRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/books/${bookId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!retryRes.ok) {
          console.error("Retry book details fetch failed with status:", retryRes.status);
          throw new Error(`Failed to fetch book details: ${retryRes.statusText}`);
        }
        const data = await retryRes.json();
        setBookName(data.name);
      } else if (!res.ok) {
        console.error("Initial book details fetch failed with status:", res.status);
        throw new Error(`Failed to fetch book details: ${res.statusText}`);
      } else {
        const data = await res.json();
        setBookName(data.name);
      }
    } catch (err) {
      console.error("Error fetching book details:", err.message);
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
        console.log("No token found, redirecting to signin");
        window.location.href = "/auth/signin";
        return;
      }
      console.log("Fetching cafes for bookId:", bookId);
      let res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cafes/book/${bookId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        console.log("Received 401 for cafes, attempting to refresh token");
        token = await refreshToken();
        if (!token) {
          console.error("Failed to refresh token");
          throw new Error("Failed to refresh token");
        }
        localStorage.setItem("token", token);
        console.log("Retrying cafes Respondents fetch with new token:", token.slice(0, 20) + "...");
        const retryRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cafes/book/${bookId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!retryRes.ok) {
          console.error("Retry cafes fetch failed with status:", retryRes.status);
          throw new Error(`Failed to fetch cafes: ${retryRes.statusText}`);
        }
        const retryData = await retryRes.json();
        setCafes(retryData);
      } else if (!res.ok) {
        console.error("Initial cafes fetch failed with status:", res.status);
        throw new Error(`Failed to fetch cafes: ${res.statusText}`);
      } else {
        const data = await res.json();
        setCafes(data);
      }
    } catch (err) {
      console.error("Error fetching cafes:", err.message);
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
        console.log("No token found, redirecting to signin");
        window.location.href = "/auth/signin";
        return;
      }
      console.log("Creating transaction for book_id:", selectedBookId, "cafe_id:", cafeId);
      let res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions`, {
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
        console.log("Received 401 for transaction creation, attempting to refresh token");
        token = await refreshToken();
        if (!token) {
          console.error("Failed to refresh token");
          throw new Error("Failed to refresh token");
        }
        localStorage.setItem("token", token);
        console.log("Retrying transaction creation with new token:", token.slice(0, 20) + "...");
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
        if (!retryRes.ok) {
          console.error("Retry transaction creation failed with status:", retryRes.status);
          const errorData = await retryRes.json();
          throw new Error(errorData.error || `Failed to create transaction: ${retryRes.statusText}`);
        }
        alert("Book requested successfully!");
        router.push("/profile");
      } else if (!res.ok) {
        console.error("Initial transaction creation failed with status:", res.status);
        const errorData = await res.json();
        throw new Error(errorData.error || `Failed to create transaction: ${res.statusText}`);
      } else {
        alert("Book requested successfully!");
        router.push("/profile");
      }
    } catch (err) {
      console.error("Error creating transaction:", err.message);
      setError(err.message);
    } finally {
      setTransactionLoading(false);
      setShowConfirmPopup(false);
    }
  };

  // Handle "Book at this Cafe" button click
  const handleBookAtCafe = (cafe) => {
    console.log("Selected cafe for booking:", cafe.name);
    setSelectedCafe(cafe);
    setShowConfirmPopup(true);
  };

  // Load book ID and check eligibility
  useEffect(() => {
    const bookId = searchParams.get("bookId");
    if (bookId) {
      console.log("Book ID from search params:", bookId);
      setSelectedBookId(bookId);
      fetchBookDetails(bookId);
      checkUserEligibility().then((isEligible) => {
        console.log("User eligibility check result:", isEligible);
        if (isEligible) {
          fetchCafes(bookId);
        }
      });
    }
  }, [searchParams]);

  // Handle restriction popup redirect
  useEffect(() => {
    if (showRestrictionPopup) {
      console.log("Showing restriction popup with message:", restrictionMessage);
      const timer = setTimeout(() => {
        console.log("Redirecting to profile due to restriction");
        router.push("/profile");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showRestrictionPopup, router]);

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
                      area: cafe.area || "N/A",
                      city: cafe.city || "N/A",
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

        {/* Restriction Popup */}
        {showRestrictionPopup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-bold mb-4">Action Required</h2>
              <p className="mb-4">{restrictionMessage}</p>
              <p className="mb-4">Redirecting to profile...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BookCafeSelector() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BookCafeSelectorContent />
    </Suspense>
  );
}