"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ThemeToggle from "../../components/ThemeToggle";

// New component to handle useSearchParams logic
function DropOffContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookId = searchParams.get("book_id");
  const [cafes, setCafes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentBook, setCurrentBook] = useState(null);

  useEffect(() => {
    if (!bookId) {
      setError("No book selected for drop-off");
      return;
    }
    fetchCafes();
    fetchCurrentBook();
  }, [bookId]);

  const fetchCafes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found. Please sign in.");
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cafes`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Unauthorized: Please sign in again.");
        }
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch cafes");
      }

      const data = await res.json();
      const mappedCafes = data.map((cafe) => ({
        id: cafe.cafe_id,
        name: cafe.name,
        image: cafe.image_url || "https://picsum.photos/300/200",
        distance: cafe.distance || "N/A",
        priceRange: `₹${cafe.average_bill}`,
        rating: cafe.ratings,
        location: cafe.location,
        specialties: cafe.specials,
        discounts: cafe.discount,
        description: cafe.description || "No description available",
      }));
      setCafes(mappedCafes);
    } catch (err) {
      console.error("Error fetching cafes:", err.message);
      setError(err.message);
      if (err.message.includes("Unauthorized")) {
        localStorage.removeItem("token");
        router.push("/auth/signin");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentBook = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found.");
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/books/${bookId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Unauthorized: Please sign in again.");
        }
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch book");
      }

      const bookData = await res.json();
      setCurrentBook(bookData);
    } catch (err) {
      console.error("Error fetching current book:", err.message);
      setError(err.message);
    }
  };

  const handleConfirmDropOff = async (cafeId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token || !bookId) {
        throw new Error("Not authenticated or no book selected");
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/transactions/drop-off/${bookId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            cafe_id: cafeId,
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to initiate drop-off");
      }

      router.push("/profile");
    } catch (err) {
      console.error("Error initiating drop-off:", err.message);
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-light dark:border-primary-dark"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-header font-bold text-text-light dark:text-text-dark mb-8 text-center">
          Select a Cafe to Drop Off Your Book
        </h1>

        {currentBook && (
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-header font-semibold text-text-light dark:text-text-dark">
              Dropping Off: {currentBook.name} by {currentBook.author}
            </h2>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {cafes.map((cafe) => (
            <div
              key={cafe.id}
              className="bg-white dark:bg-backgroundSCD-dark rounded-lg shadow-lg overflow-hidden transform transition-all hover:scale-105 hover:shadow-xl"
            >
              <img
                src={cafe.image}
                alt={cafe.name}
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                <h3 className="text-xl font-header font-semibold text-text-light dark:text-text-dark">
                  {cafe.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {cafe.location}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Distance: {cafe.distance}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Price Range: {cafe.priceRange}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Rating: {cafe.rating} / 5
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Specialties: {cafe.specialties}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Discount: {cafe.discounts}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
                  {cafe.description}
                </p>
                <button
                  onClick={() => handleConfirmDropOff(cafe.id)}
                  className="mt-4 w-full px-4 py-2 bg-primary-light dark:bg-primary-dark text-text-light dark:text-text-dark rounded-full font-button hover:bg-opacity-90 transition-colors"
                >
                  Confirm Drop Off
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ThemeToggle />
    </div>
  );
}

// Main page component with Suspense boundary
export default function DropOffPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DropOffContent />
    </Suspense>
  );
}