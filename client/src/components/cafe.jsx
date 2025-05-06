import { useEffect, useState } from "react";
import Book from "./book";

export function CafeCard({ cafe, onExpand }) {
  return (
    <div
      className="relative cursor-pointer transform transition-transform hover:scale-105"
      onClick={() => onExpand(cafe)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onExpand(cafe)}
    >
      <div className="relative w-full h-48 sm:h-64 rounded-lg overflow-hidden">
        <img
          src={cafe.image}
          alt={`Image of ${cafe.name}`}
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-2 right-2 bg-white dark:bg-black text-black dark:text-white px-2 py-1 rounded-full shadow-md text-xs sm:text-sm">
          ⭐{cafe.rating}/5
        </div>
      </div>
      <h3 className="text-sm sm:text-lg font-header font-bold mt-2 text-text-light dark:text-text-dark line-clamp-1">
        {cafe.name}
      </h3>
      <p className="text-xs sm:text-sm text-text-light dark:text-text-dark line-clamp-1">
        {cafe.area}, {cafe.city}
      </p>
    </div>
  );
}

export function CafeExpanded({ cafe, onClose }) {
  const [books, setBooks] = useState([]);
  const [filteredBooks, setFilteredBooks] = useState([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (cafe) {
      fetchBooksForCafe();
    }
  }, [cafe]);

  const fetchBooksForCafe = async () => {
    setLoadingBooks(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/books?keeper_id=${cafe.id}&available=true`
      );

      if (!res.ok) {
        throw new Error("Failed to fetch books for cafe");
      }

      const data = await res.json();
      const mappedBooks = data.map((book) => ({
        book_id: book.book_id,
        title: book.name,
        cover: book.image_url || "https://picsum.photos/150",
        genre: book.genre,
        author: book.author,
        publisher: book.publisher,
        description: book.description,
        audioSummary: book.audio_url,
        ratings: book.ratings || "N/A",
        language: book.language,
        available: book.available,
        is_free: book.is_free,
      }));
      setBooks(mappedBooks);
      setFilteredBooks(mappedBooks);
    } catch (err) {
      console.error("Error fetching books for cafe:", err.message);
    } finally {
      setLoadingBooks(false);
    }
  };

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    const filtered = books.filter((book) =>
      book.title.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredBooks(filtered);
  };

  if (!cafe) return null;

  return (
    <div
      className="fixed inset-0 bg-background-dark bg-opacity-50 backdrop-blur-md flex justify-center items-center z-50 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="bg-background-light dark:bg-background-dark p-4 rounded-2xl w-[95vw] max-w-2xl mx-auto my-4 shadow-xl relative font-body max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-4 right-4 text-lg sm:text-xl text-text-light dark:text-text-dark"
          onClick={onClose}
        >
          ✖
        </button>
        <div className="flex flex-col items-center">
          {/* Cafe Details */}
          <div className="w-full max-w-[240px] sm:max-w-[300px] mb-4">
            <div className="relative">
              <img
                src={cafe.image}
                alt={cafe.name}
                className="w-full h-64 sm:h-72 object-cover rounded-lg"
                loading="lazy"
              />
              <div className="absolute bottom-2 left-2 bg-white dark:bg-black text-black dark:text-white px-2 py-1 rounded-full shadow-md text-xs sm:text-sm">
                ⭐{cafe.rating}/5
              </div>
            </div>
          </div>
          <div className="w-full text-center sm:text-left">
            <h2 className="text-xl sm:text-2xl font-header font-bold mb-2 text-text-light dark:text-text-dark">
              {cafe.name}
            </h2>
            <p className="text-xs sm:text-sm text-text-light dark:text-text-dark mb-2">
              <strong>Location:</strong> {cafe.location}
            </p>
           {/* <p className="text-xs sm:text-sm text-text-light dark:text-text-dark mb-2">
              <strong>Distance:</strong> {cafe.distance} km
            </p>*/}
            <p className="text-xs sm:text-sm text-text-light dark:text-text-dark mb-2">
              <strong>View Map:</strong> {cafe.googlemap}
            </p>
            <p className="text-xs sm:text-sm text-text-light dark:text-text-dark mb-2">
              <strong>Specialties:</strong> {cafe.specialties || "N/A"}
            </p>
            <p className="text-xs sm:text-sm text-text-light dark:text-text-dark mb-2">
              <strong>Special Discounts:</strong> {cafe.discounts}
            </p>
            <p className="text-xs sm:text-sm text-text-light dark:text-text-dark mb-2">
              <strong>Price Range:</strong> {cafe.priceRange}
            </p>
            <p className="text-xs sm:text-sm text-text-light dark:text-text-dark mb-4">
              {cafe.description}
            </p>
            {cafe.audioSummary && (
              <audio controls className="w-full mb-4">
                <source src={cafe.audioSummary} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
            )}
          </div>

          {/* Available Books Section */}
          <div className="w-full mt-6">
            <h3 className="text-lg sm:text-xl font-header font-bold mb-4 text-text-light dark:text-text-dark text-center sm:text-left">
              Available Books
            </h3>
            {/* Search Bar */}
            <div className="mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Search books by name..."
                className="w-full p-2 border rounded-lg text-text-light dark:text-text-dark bg-background-light dark:bg-background-dark focus:outline-none focus:ring-2 focus:ring-primary-light dark:focus:ring-primary-dark text-sm sm:text-base"
              />
            </div>
            {loadingBooks ? (
              <div className="text-text-light dark:text-text-dark text-center">
                Loading books...
              </div>
            ) : filteredBooks.length === 0 ? (
              <div className="text-text-light dark:text-text-dark text-center">
                No available books found at this cafe.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
                {filteredBooks.map((book) => (
                  <Book key={book.book_id} book={book} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CafeExpansion({ cafes }) {
  const [selectedCafe, setSelectedCafe] = useState(null);

  if (!Array.isArray(cafes)) {
    return <div>No cafes available to display.</div>;
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {cafes.map((cafe) => (
          <CafeCard key={cafe.id} cafe={cafe} onExpand={setSelectedCafe} />
        ))}
      </div>
      {selectedCafe && <CafeExpanded cafe={selectedCafe} onClose={() => setSelectedCafe(null)} />}
    </div>
  );
}

export default CafeExpansion;