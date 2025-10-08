// src/components/MustVisitCafe.jsx
"use client";
import { useState, useEffect } from 'react';

function MustVisitCafe() {
  const [featuredCafe, setFeaturedCafe] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeaturedCafe();
  }, []);

  const fetchFeaturedCafe = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/featured`);
      if (response.ok) {
        const data = await response.json();
        setFeaturedCafe(data.cafe);
      }
    } catch (err) {
      console.error('Error fetching featured cafe:', err);
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

  if (!featuredCafe) {
    return (
      <div className="bg-backgroundSCD-light dark:bg-backgroundSCD-dark rounded-2xl p-6">
        <h2 className="text-2xl font-header font-semibold mb-4">Must Visit Cafe</h2>
        <div className="text-center py-8 text-text-light dark:text-text-dark">
          No featured cafe available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-backgroundSCD-light dark:bg-backgroundSCD-dark rounded-2xl p-6">
      <h2 className="text-2xl font-header font-semibold mb-4">Must Visit Cafe</h2>
      <div className="relative h-72 mb-4">
        <img
          src={featuredCafe.image_url || "/cafe-placeholder.png"}
          alt={featuredCafe.name}
          className="w-full h-full object-cover rounded-xl"
          loading="lazy"
        />
        <div className="absolute top-4 right-4 bg-tertiary-light dark:bg-tertiary-dark text-background-light dark:text-background-dark px-3 py-1 rounded-full text-sm font-medium">
          Featured
        </div>
      </div>
      <h3 className="text-xl font-header font-semibold mb-2">{featuredCafe.name}</h3>
      <p className="text-text-light dark:text-text-dark mb-3">
        {featuredCafe.area || 'A cozy corner with perfect lighting and endless books'}
      </p>
      <div className="flex items-center gap-4 text-sm text-text-light dark:text-text-dark">
        
      </div>
    </div>
  );
}

export default MustVisitCafe;