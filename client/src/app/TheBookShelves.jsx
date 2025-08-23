"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Book from "../components/book";
import CafeExpansion from "../components/cafe";
import Carousel from "../components/carousel";
import Footer from "../components/footer";
import Header from "../components/header";
import ThemeToggle from "../components/ThemeToggle";
import { useAuth } from './Hooks/AuthContext'; // Import the useAuth hook

function TheBookShelves() {
  const { user, isLoggedIn, loading } = useAuth(); // Get user data from useAuth
  const [currentSlide, setCurrentSlide] = useState(0);
  const [books, setBooks] = useState([]);
  const [cafes, setCafes] = useState([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [loadingCafes, setLoadingCafes] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Carousel auto-slide
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 3);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
  // Check if user authentication state has changed
  if (user) {
    console.log('User authenticated:', user);
  } else if (!loading) {
    console.log('User not authenticated');
  }
}, [user, loading]);

  const fetchBooks = async (query = "") => {
    setLoadingBooks(true);
    try {
      const queryParams = new URLSearchParams({ available: true });
      if (query) queryParams.append("name", encodeURIComponent(query));
      const url = `${
        process.env.NEXT_PUBLIC_API_URL
      }/books?${queryParams.toString()}`;
      const res = await fetch(url);
      if (!res.ok)
        throw new Error((await res.json()).error || "Failed to fetch books");
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
        pdfUrl: book.pdf_url,
        ratings: book.ratings || "N/A",
        language: book.language,
        available: book.available,
        is_free: book.is_free,
      }));
      setBooks(mappedBooks);
    } catch (err) {
      console.error("Error fetching books:", err.message);
      setError(err.message);
    } finally {
      setLoadingBooks(false);
    }
  };

  const fetchCafes = async (query = "") => {
    setLoadingCafes(true);
    try {
      let url = `${process.env.NEXT_PUBLIC_API_URL}/cafes`;
      if (query) url += `?name=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      if (!res.ok)
        throw new Error((await res.json()).error || "Failed to fetch cafes");
      const data = await res.json();
      const mappedCafes = data.map((cafe) => ({
        id: cafe.cafe_id,
        name: cafe.name,
        image: cafe.image_url || "https://picsum.photos/200",
        distance: cafe.distance || "N/A",
        location: cafe.location,
        area: cafe.area || "N/A",
        city: cafe.city || "N/A",
        googlemap: cafe.gmap_url || "https://www.google.com/maps",
        audioSummary: cafe.audio_url,
        specialties: cafe.specials,
        discounts: cafe.discount,
        priceRange: `₹${cafe.average_bill}`,
        description: cafe.description || "No description available",
        rating: cafe.ratings || "N/A",
      }));
      setCafes(mappedCafes);
    } catch (err) {
      console.error("Error fetching cafes:", err.message);
      setError(err.message);
    } finally {
      setLoadingCafes(false);
    }
  };

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    fetchBooks(query);
    fetchCafes(query);
  };

  useEffect(() => {
    fetchBooks();
    fetchCafes();
  }, []);

  const carouselSlides = [
    {
      id: 1,
      title: "Borrow Books While You Sip Coffee at Kolkata’s Cosiest Cafés",
      description:
        "Join The Bookshelves — India’s first café-based book borrowing service. For just ₹49, read unlimited books in your favourite coffee spots.",
      images: ["/book1.png", "/book2.png", "/book3.png"],
      buttonText: "Lets Get Started",
    },
    {
      id: 2,
      title: "Explore Cafes near you",
      description:
        "Whether you're in Salt Lake, Gariahat, or Park Street, a shelf full of stories is just around the corner.",
      images: ["/book2.png", "/book3.png", "/book5.png"],
      buttonText: "Discover Now",
    },
    {
      id: 3,
      title: "Read the book your friends are talking about",
      description:
        "Genres range from thrillers to business to romance. Choose your favourite, sip your coffee, and enjoy real reading time.",
      images: ["/book5.png", "/book6.png", "/book1.png"],
      buttonText: "Read Now",
    },
  ];

  const faqs = [
    {
      question: "How much does it cost to subscribe?",
      answer: "₹49 for 1 month + ₹300 refundable deposit.",
    },
    {
      question: "Can I return the book to a different café?",
      answer: "Yes! Flexibility is our thing.",
    },
    {
      question: "What if I lose a book?",
      answer: "You can replace it or pay the book’s cost. That’s all.",
    },
    {
      question: "Is it only for Kolkata?",
      answer: "For now, yes. But we’re expanding soon!",
    },
  ];

  // Loading state from MainPage.jsx
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-light dark:border-primary-dark mx-auto mb-4"></div>
          <p className="text-text-light dark:text-text-dark">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  // If not logged in, show the public page with a login button
  // If logged in, show the public page but with user name and logout button in header
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark">
      <Header
        user={user} // Pass the user object to the Header
        location="New Town, Kolkata"
        onLocationChange={() => {}}
        onSearch={handleSearch}

        
      />
      <main className="px-4 sm:px-4 md:px-6 py-8 w-full sm:w-[80%] mx-auto">
        {!searchQuery && (
          <section id="Carousel" className="mb-12 w-full">
            <div className="relative w-full h-[600px] sm:h-[500px] md:h-[400px] overflow-hidden">
              <div className="relative w-full h-full bg-[url('/cafe-background.jpg')] bg-cover bg-center">
                {carouselSlides.map((slide, index) => (
                  <div
                    key={slide.id}
                    className={`absolute inset-0 transition-opacity duration-500 ${
                      currentSlide === index ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <Carousel
                      title={slide.title}
                      description={slide.description}
                      buttonText={slide.buttonText}
                      images={slide.images}
                    />
                  </div>
                ))}
              </div>
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
                {carouselSlides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`w-3 h-3 rounded-full transition-colors ${
                      currentSlide === index
                        ? "bg-primary-light dark:bg-primary-dark"
                        : "bg-secondary-light dark:bg-secondary-dark"
                    }`}
                  />
                ))}
              </div>
            </div>
          </section>
        )}
        {/* How It Works Section */}
        {!searchQuery && (
          <section
            id="how-it-works"
            className="bg-background-light dark:bg-background-dark py-16 px-6"
          >
            <div className="max-w-6xl mx-auto text-center mb-12">
              <h2 className="text-2xl sm:text-4xl text-primary-light dark:text-primary-dark font-bold mb-4">
                How It Works
              </h2>
              <p className="text-xl sm:text-2xl text-text-light dark:text-text-dark">
                Your reading journey in 4 simple steps
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {[
                {
                  title: "Step 1 – Subscribe in 1 Minute",
                  description:
                    "Pay ₹49 for a month + ₹300 security deposit (100% refundable after your subscription ends).",
                },
                {
                  title: "Step 2 – Visit Any Partner Café",
                  description:
                    "Walk into any TBS café and spot our bookshelf. Enjoy special discounts too!",
                },
                {
                  title: "Step 3 – Borrow a Book You Love",
                  description: "Scan the QR, log your pick, and START READING!",
                },
                {
                  title: "Step 4 – Return Anywhere, Anytime",
                  description:
                    "Drop your book at any partner café — no rush, no fines.",
                },
              ].map((step, index) => (
                <div
                  key={index}
                  className="bg-backgroundSCD-light dark:bg-backgroundSCD-dark rounded-2xl shadow-md p-6 hover:bg-gray-200 transition duration-300 text-center"
                >
                  <div className="text-2xl text-text-light dark:text-text-dark font-semibold mb-2">
                    {step.title}
                  </div>
                  <p className="text-text-light dark:text-text-dark text-sm">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
        {/* Books Section */}
        <section id="Book Section" className="mb-12 mt-8">
          <h2 className="text-2xl sm:text-4xl text-center font-bold font-header text-primary-light dark:text-primary-dark mb-4 sm:mb-6">
            New Books Every Month!
          </h2>
          <p className="text-xl sm:text-2xl text-center font-body text-text-light dark:text-text-dark mb-2">
            From thrillers to romance, business to true crime.
          </p>
          <p className="text-xl sm:text-2xl text-center font-body text-text-light dark:text-text-dark mb-6 sm:mb-8">
            We have something for all your reading needs
          </p>
          {loadingBooks ? (
            <div className="text-gray-600">Loading books...</div>
          ) : books.length === 0 ? (
            <div className="text-gray-600">No books available.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6 md:gap-8">
                {books.slice(0, 10).map((book) => (
                  <Book key={book.book_id} book={book} />
                ))}
              </div>
              <div className="flex justify-center mt-6">
                <Link href="/discover">
                  <button className="px-6 py-2 rounded-full bg-primary-light dark:bg-primary-dark text-text-light dark:text-text-dark font-button hover:bg-primary-light/80 dark:hover:bg-primary-dark/80 transition-colors">
                    Explore The Bookshelf
                  </button>
                </Link>
              </div>
            </>
          )}
        </section>
        {/* Cafes Section */}
        <section id="Cafe Section" className="mb-12 mt-8">
          <h2 className="text-2xl sm:text-4xl text-center font-bold font-header text-primary-light dark:text-primary-dark mb-4 sm:mb-6">
            Find Bookshelves Near You!
          </h2>
          <p className="text-xl sm:text-2xl text-center font-body text-text-light dark:text-text-dark mb-6">
            Your next favorite cafe and story all in one place.
          </p>
          {loadingCafes ? (
            <div className="text-gray-600">Loading cafes...</div>
          ) : cafes.length === 0 ? (
            <div className="text-gray-600">No cafes available.</div>
          ) : (
            <>
              <div className="w-full mt-6">
                <CafeExpansion cafes={cafes.slice(0, 8)} />
              </div>
              <div className="flex justify-center mt-6">
                <Link href="/discover">
                  <button className="px-6 py-2 rounded-full bg-primary-light dark:bg-primary-dark text-text-light dark:text-text-dark font-button hover:bg-primary-light/80 dark:hover:bg-primary-dark/80 transition-colors">
                    View All Cafes
                  </button>
                </Link>
              </div>
            </>
          )}
        </section>
        {!searchQuery && <ThemeToggle />}
      </main>
      {!searchQuery && (
        <div className="flex justify-center mb-12 md:hidden">
          <Link href="/discover">
            <button className="px-6 py-2 bg-primary-light dark:bg-primary-dark text-text-light dark:text-text-dark rounded-full font-button hover:bg-primary-light/80 dark:hover:bg-primary-dark/80 transition-colors">
              Discover All
            </button>
          </Link>
        </div>
      )}
      {!searchQuery && (
        <section className="bg-background-light dark:bg-background-dark py-16 px-4 mt-8">
          <div className="w-[80%] mx-auto text-left">
            <h2 className="text-3xl font-header font-semibold text-text-light dark:text-text-dark mb-10">
              FAQs
            </h2>
            <div className="space-y-8">
              {faqs.map((faq, index) => (
                <div key={index}>
                  <h3 className="text-xl font-header text-textscd-light dark:text-textscd-dark mb-2">
                    Q: {faq.question}
                  </h3>
                  <p className="text-base font-body text-text-light dark:text-text-dark">
                    A: {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      {!searchQuery && <Footer />}
    </div>
  );
}

export default TheBookShelves;