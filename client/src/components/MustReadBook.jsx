// src/components/MustReadBook.jsx
"use client";
import { useState, useEffect } from 'react';

function MustReadBook() {
  const [featuredBook, setFeaturedBook] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeaturedBook();
  }, []);

  const fetchFeaturedBook = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/featured`);
      if (response.ok) {
        const data = await response.json();
        setFeaturedBook(data.book);
      }
    } catch (err) {
      console.error('Error fetching featured book:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-backgroundSCD-light dark:bg-backgroundSCD-dark rounded-2xl p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-300 rounded w-1/2 mb-4"></div>
          <div className="h-72 bg-gray-300 rounded-xl mb-4"></div>
          <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2 mb-3"></div>
        </div>
      </div>
    );
  }

  if (!featuredBook) {
    return (
      <div className="bg-backgroundSCD-light dark:bg-backgroundSCD-dark rounded-2xl p-6">
        <h2 className="text-2xl font-header font-semibold mb-4">Must Read Book</h2>
        <div className="text-center py-8 text-text-light dark:text-text-dark">
          No featured book available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-backgroundSCD-light dark:bg-backgroundSCD-dark rounded-2xl p-6">
      <h2 className="text-2xl font-header font-semibold mb-4">Must Read Book</h2>
      <div className="relative h-72 mb-4">
        <img
          src={featuredBook.image_url || "/book-placeholder.png"}
          alt={featuredBook.name}
          className="w-full h-full object-cover rounded-xl"
          loading="lazy"
        />
        <div className="absolute top-4 right-4 bg-tertiary-light dark:bg-tertiary-dark text-background-light dark:text-background-dark px-3 py-1 rounded-full text-sm font-medium">
          Featured
        </div>
      </div>
      <h3 className="text-xl font-header font-semibold mb-2 truncate">
        {featuredBook.name}
      </h3>
      <p className="text-text-light dark:text-text-dark mb-3">By {featuredBook.author}</p>
      <div className="flex items-center gap-4 text-sm text-text-light dark:text-text-dark">
        
        
      </div>
    </div>
  );
}

export default MustReadBook;