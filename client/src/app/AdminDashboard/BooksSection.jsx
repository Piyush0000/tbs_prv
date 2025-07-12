"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../Hooks/useAuth";

function BooksSection({ data, setData, onEdit }) {
  const { refreshToken } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [ratingFilter, setRatingFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("");
  const [isFreeFilter, setIsFreeFilter] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [publisherFilter, setPublisherFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [keeperIdFilter, setKeeperIdFilter] = useState("");

  const scrollRef = useRef(null);
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  // Extract unique values for filters
  const uniqueGenres = [...new Set(data.map((book) => book.genre).filter(Boolean))];
  const uniquePublishers = [...new Set(data.map((book) => book.publisher).filter(Boolean))];
  const uniqueLanguages = [...new Set(data.map((book) => book.language).filter(Boolean))];
  const uniqueAuthors = [...new Set(data.map((book) => book.author).filter(Boolean))];
  const uniqueKeeperIds = [...new Set(data.map((book) => book.keeper_id).filter(Boolean))];

  // Filter books based on search query and filters
  const filteredData = (data || []).filter((book) => {
    if (!book || typeof book !== "object") return false;

    const searchLower = searchQuery.toLowerCase();
    const bookId = book.id ? String(book.id).toLowerCase() : "";
    const name = book.name ? String(book.name).toLowerCase() : "";
    const author = book.author ? String(book.author).toLowerCase() : "";

    const matchesSearch =
      bookId.includes(searchLower) ||
      name.includes(searchLower) ||
      author.includes(searchLower);

    const matchesRating = ratingFilter ? book.ratings === Number(ratingFilter) : true;
    const matchesAvailability =
      availabilityFilter !== ""
        ? book.available === (availabilityFilter === "true")
        : true;
    const matchesIsFree =
      isFreeFilter !== "" ? book.is_free === (isFreeFilter === "true") : true;
    const matchesGenre = genreFilter ? book.genre === genreFilter : true;
    const matchesPublisher = publisherFilter ? book.publisher === publisherFilter : true;
    const matchesLanguage = languageFilter ? book.language === languageFilter : true;
    const matchesAuthor = authorFilter ? book.author === authorFilter : true;
    const matchesKeeperId = keeperIdFilter ? book.keeper_id === keeperIdFilter : true;

    return (
      matchesSearch &&
      matchesRating &&
      matchesAvailability &&
      matchesIsFree &&
      matchesGenre &&
      matchesPublisher &&
      matchesLanguage &&
      matchesAuthor &&
      matchesKeeperId
    );
  });

  const handleMouseDown = (e) => {
    isDown.current = true;
    scrollRef.current.style.userSelect = "none";
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeft.current = scrollRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
    isDown.current = false;
    scrollRef.current.style.userSelect = "auto";
  };

  const handleMouseUp = () => {
    isDown.current = false;
    scrollRef.current.style.userSelect = "auto";
  };

  const handleMouseMove = (e) => {
    if (!isDown.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 2;
    scrollRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const handleDelete = async (bookId) => {
    if (!window.confirm(`Are you sure you want to delete the book with ID ${bookId}?`)) {
      return;
    }

    if (loading) return;
    setLoading(true);

    try {
      let token = localStorage.getItem("token");
      let res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/books/${bookId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        token = await refreshToken();
        if (!token) {
          throw new Error("Failed to refresh token");
        }
        localStorage.setItem("token", token);
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/books/${bookId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(`Failed to delete book: ${errorData.error || res.statusText}`);
      }

      setData(data.filter((book) => book && book.id !== bookId));
      alert("Book deleted successfully!");
    } catch (err) {
      console.error("Error in handleDelete:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading books...</div>;
  }

  return (
    <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
      <div className="flex gap-4 flex-wrap mb-4">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search books by ID, name, or author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>
        <div className="flex-1 min-w-[150px]">
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          >
            <option value="">Filter by Rating</option>
            {[0, 1, 2, 3, 4, 5].map((rating) => (
              <option key={rating} value={rating}>
                {rating}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[150px]">
          <select
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          >
            <option value="">Filter by Availability</option>
            <option value="true">Available</option>
            <option value="false">Not Available</option>
          </select>
        </div>
        <div className="flex-1 min-w-[150px]">
          <select
            value={isFreeFilter}
            onChange={(e) => setIsFreeFilter(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          >
            <option value="">Filter by Is Free</option>
            <option value="true">Free</option>
            <option value="false">Not Free</option>
          </select>
        </div>
        <div className="flex-1 min-w-[150px]">
          <select
            value={genreFilter}
            onChange={(e) => setGenreFilter(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          >
            <option value="">Filter by Genre</option>
            {uniqueGenres.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[150px]">
          <select
            value={publisherFilter}
            onChange={(e) => setPublisherFilter(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          >
            <option value="">Filter by Publisher</option>
            {uniquePublishers.map((publisher) => (
              <option key={publisher} value={publisher}>
                {publisher}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[150px]">
          <select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          >
            <option value="">Filter by Language</option>
            {uniqueLanguages.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[150px]">
          <select
            value={authorFilter}
            onChange={(e) => setAuthorFilter(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          >
            <option value="">Filter by Author</option>
            {uniqueAuthors.map((author) => (
              <option key={author} value={author}>
                {author}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[150px]">
         <select
          value={keeperIdFilter}
           onChange={(e) => setKeeperIdFilter(e.target.value)}
           className="w-full px-4 py-2 border rounded-lg"
         >
           <option value="">Filter by Keeper ID</option>
          {uniqueKeeperIds.map((keeperId) => (
          <option key={keeperId} value={keeperId}>
            {keeperId}
          </option>
       ))}
       </select>
      </div>
      </div>

      <div
        className="overflow-x-auto cursor-grab"
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 whitespace-nowrap">
              <th className="px-4 py-3 text-left">Book ID</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Author</th>
              <th className="px-4 py-3 text-left">Language</th>
              <th className="px-4 py-3 text-left">Publisher</th>
              <th className="px-4 py-3 text-left">Genre</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-left">Image URL</th>
              <th className="px-4 py-3 text-left">Audio URL</th>
              <th className="px-4 py-3 text-left">PDF URL</th>
              <th className="px-4 py-3 text-left">Ratings</th>
              <th className="px-4 py-3 text-left">Available</th>
              <th className="px-4 py-3 text-left">Is Free</th>
              <th className="px-4 py-3 text-left">Keeper ID</th>
              <th className="px-4 py-3 text-left">Created At</th>
              <th className="px-4 py-3 text-left">Updated At</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((book, idx) => (
              <tr key={idx} className="border-t">
                <td className="px-4 py-3">{book.id}</td>
                <td className="px-4 py-3">{book.name}</td>
                <td className="px-4 py-3">{book.author}</td>
                <td className="px-4 py-3">{book.language}</td>
                <td className="px-4 py-3">{book.publisher || "N/A"}</td>
                <td className="px-4 py-3">{book.genre || "N/A"}</td>
                <td className="px-4 py-3 truncate max-w-xs">{book.description || "N/A"}</td>
                <td className="px-4 py-3 truncate max-w-xs">
                  {book.image_url ? (
                    <a
                      href={book.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View
                    </a>
                  ) : (
                    "N/A"
                  )}
                </td>
                <td className="px-4 py-3 truncate max-w-xs">
                  {book.audio_url ? (
                    <a
                      href={book.audio_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Listen
                    </a>
                  ) : (
                    "N/A"
                  )}
                </td>
                <td className="px-4 py-3 truncate max-w-xs">
                  {book.pdf_url ? (
                    <a
                      href={book.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View
                    </a>
                  ) : (
                    "N/A"
                  )}
                </td>
                <td className="px-4 py-3">{book.ratings}</td>
                <td className="px-4 py-3">{book.available ? "Yes" : "No"}</td>
                <td className="px-4 py-3">{book.is_free ? "Yes" : "No"}</td>
                <td className="px-4 py-3">{book.keeper_id || "N/A"}</td>
                <td className="px-4 py-3">{new Date(book.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">{new Date(book.updatedAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <button
                    onClick={() => onEdit(book)}
                    className="text-blue-600 hover:text-blue-800 mr-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(book.id)}
                    className="text-red-600 hover:text-red-800"
                    disabled={loading}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default BooksSection;