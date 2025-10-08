"use client";
import { useState, useEffect } from "react";

function FeaturedSection() {
  const [featuredBook, setFeaturedBook] = useState(null);
  const [featuredCafe, setFeaturedCafe] = useState(null);
  const [books, setBooks] = useState([]);
  const [cafes, setCafes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showBookModal, setShowBookModal] = useState(false);
  const [showCafeModal, setShowCafeModal] = useState(false);

  useEffect(() => {
    fetchFeaturedItems();
    fetchBooksAndCafes();
  }, []);

  const fetchFeaturedItems = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/featured`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch featured items: ${response.status}`);
      }
      
      const data = await response.json();
      setFeaturedBook(data.book);
      setFeaturedCafe(data.cafe);
    } catch (err) {
      console.error("Error fetching featured items:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBooksAndCafes = async () => {
    try {
      const token = localStorage.getItem("token");
      
      const [booksRes, cafesRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/inventory`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/cafes`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (booksRes.ok) {
        const booksData = await booksRes.json();
        setBooks(booksData);
      } else {
        console.error('Failed to fetch books:', booksRes.status);
      }
      
      if (cafesRes.ok) {
        const cafesData = await cafesRes.json();
        setCafes(cafesData);
      } else {
        console.error('Failed to fetch cafes:', cafesRes.status);
      }
    } catch (err) {
      console.error("Error fetching books and cafes:", err);
    }
  };

  const handleSetFeaturedBook = async (bookId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/featured/book`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ book_id: bookId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to set featured book");
      }

      await fetchFeaturedItems();
      setShowBookModal(false);
      alert("Featured book updated successfully!");
    } catch (err) {
      console.error("Error setting featured book:", err);
      alert(err.message);
    }
  };

  const handleSetFeaturedCafe = async (cafeId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/featured/cafe`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cafe_id: cafeId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to set featured cafe");
      }

      await fetchFeaturedItems();
      setShowCafeModal(false);
      alert("Featured cafe updated successfully!");
    } catch (err) {
      console.error("Error setting featured cafe:", err);
      alert(err.message);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading featured items...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        Error loading featured items: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Manage Featured Items</h2>
      
      {/* Featured Book Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Must Read Book</h3>
          <button
            onClick={() => setShowBookModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Change Featured Book
          </button>
        </div>
        
        {featuredBook ? (
          <div className="flex items-start space-x-4">
            <img
              src={featuredBook.image_url || "/book-placeholder.png"}
              alt={featuredBook.name}
              className="w-32 h-48 object-cover rounded-lg"
              onError={(e) => {
                e.target.src = "/book-placeholder.png";
              }}
            />
            <div>
              <h4 className="text-lg font-semibold">{featuredBook.name}</h4>
              <p className="text-gray-600">By {featuredBook.author}</p>
              <p className="text-sm text-gray-500 mt-2">⭐ {featuredBook.ratings || 'N/A'}/5</p>
              <p className="text-sm text-gray-500">📚 {featuredBook.genre || "General"}</p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">No featured book set</p>
        )}
      </div>

      {/* Featured Cafe Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Must Visit Cafe</h3>
          <button
            onClick={() => setShowCafeModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Change Featured Cafe
          </button>
        </div>
        
        {featuredCafe ? (
          <div className="flex items-start space-x-4">
            <img
              src={featuredCafe.image_url || "/cafe-placeholder.png"}
              alt={featuredCafe.name}
              className="w-32 h-48 object-cover rounded-lg"
              onError={(e) => {
                e.target.src = "/cafe-placeholder.png";
              }}
            />
            <div>
              <h4 className="text-lg font-semibold">{featuredCafe.name}</h4>
              <p className="text-gray-600">{featuredCafe.area}, {featuredCafe.city}</p>
              <p className="text-sm text-gray-500 mt-2">⭐ {featuredCafe.ratings || 'N/A'}/5</p>
              <p className="text-sm text-gray-500">💰 ₹{featuredCafe.average_bill || 'N/A'}</p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">No featured cafe set</p>
        )}
      </div>

      {/* Book Selection Modal */}
      {showBookModal && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
          onClick={(e) => e.target === e.currentTarget && setShowBookModal(false)}
        >
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-auto">
            <h3 className="text-2xl font-bold mb-4">Select Featured Book</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {books.map((book) => (
                <div
                  key={book.id}
                  className="border rounded-lg p-4 hover:shadow-lg cursor-pointer transition-shadow"
                  onClick={() => handleSetFeaturedBook(book.id)}
                >
                  <img
                    src={book.image_url || "/book-placeholder.png"}
                    alt={book.name}
                    className="w-full h-48 object-cover rounded-lg mb-3"
                    onError={(e) => {
                      e.target.src = "/book-placeholder.png";
                    }}
                  />
                  <h4 className="font-semibold truncate">{book.name}</h4>
                  <p className="text-sm text-gray-600 truncate">By {book.author}</p>
                  <p className="text-sm text-gray-500 mt-1">⭐ {book.ratings || 'N/A'}/5</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowBookModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cafe Selection Modal */}
      {showCafeModal && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
          onClick={(e) => e.target === e.currentTarget && setShowCafeModal(false)}
        >
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-auto">
            <h3 className="text-2xl font-bold mb-4">Select Featured Cafe</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cafes.map((cafe) => (
                <div
                  key={cafe.cafe_id}
                  className="border rounded-lg p-4 hover:shadow-lg cursor-pointer transition-shadow"
                  onClick={() => handleSetFeaturedCafe(cafe.cafe_id)}
                >
                  <img
                    src={cafe.image_url || "/cafe-placeholder.png"}
                    alt={cafe.name}
                    className="w-full h-48 object-cover rounded-lg mb-3"
                    onError={(e) => {
                      e.target.src = "/cafe-placeholder.png";
                    }}
                  />
                  <h4 className="font-semibold truncate">{cafe.name}</h4>
                  <p className="text-sm text-gray-600 truncate">{cafe.area}</p>
                  <p className="text-sm text-gray-500 mt-1">⭐ {cafe.ratings || 'N/A'}/5</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowCafeModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FeaturedSection;