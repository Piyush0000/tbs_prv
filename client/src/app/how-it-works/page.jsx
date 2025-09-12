"use client";
import Link from "next/link";
import Footer from "../../components/footer";
import Header from "../../components/header";
import ThemeToggle from "../../components/ThemeToggle";
import { useAuth } from '../Hooks/AuthContext'; // Import the useAuth hook

function MainComponent() {
  const { user, isLoggedIn, loading, logout } = useAuth();

  const handleLogout = async () => {
    console.log('Logout initiated from header');
    const success = await logout();
    if (success) {
      console.log('Logout successful, reloading page.');
      window.location.reload();
    } else {
      console.error('Logout failed');
    }
  };

  const handleSearch = (e) => {
    // You can implement search functionality or leave empty for this page
    console.log('Search query:', e.target.value);
  };

  // Loading state
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

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <Header
        user={user}
        onSearch={handleSearch}
        onLogout={handleLogout}
      />
      <main className="min-h-screen bg-background-light dark:bg-background-dark">
        <div className="bg-backgroundSCD-light dark:bg-backgroundSCD-dark py-16">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-10 md:gap-[19rem]">
              <div className="md:w-1/2">
                <h1 className="text-5xl font-bold mb-4 font-ibm-plex-sans text-text-light dark:text-text-dark">
                  Welcome To the Bookshelves
                </h1>
                <p className="text-xl text-text-light dark:text-text-dark font-ibm-plex-sans">
                  A place where coffee and books blends seamlessly
                </p>
              </div>
              <div className="md:w-1/2">
                <img
                  src="/How-it-works-header-graphic.png"
                  alt="Books and coffee illustration"
                  className="w-full max-w-md h-[400px] object-contain rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-8 py-16">
          <h2 className="text-3xl font-bold font-ibm-plex-sans text-center mb-16 text-text-light dark:text-text-dark">
            How It Works
          </h2>

          <div className="space-y-16">
            <div className="flex flex-col md:flex-row items-center p-8 rounded-2xl bg-backgroundSCD-light dark:bg-backgroundSCD-dark gap-10 md:gap-[31rem]">
              <div className="md:w-1/3">
                <div className="text-6xl font-bold text-primary-light dark:text-primary-dark font-ibm-plex-sans">
                  1
                </div>
                <h3 className="text-2xl font-bold mt-4 font-ibm-plex-sans text-text-light dark:text-text-dark">
                  Sign Up & Subscribe
                </h3>
                <p className="text-text-light dark:text-text-dark mt-2 font-ibm-plex-sans">
                  Create an account and choose a subscription plan that works
                  for you.
                </p>
                <Link href="/Subscription">
                  <button className="mt-6 bg-primary-light dark:bg-primary-dark text-text-dark px-6 py-3 rounded-full hover:bg-primary-light dark:hover:bg-primary-dark transition font-ibm-plex-sans">
                    View Plans
                  </button>
                </Link>
              </div>
              <div className="md:w-2/3">
                <img
                  src="/SIgnUp.png"
                  alt="Sign up illustration"
                  className="w-full max-w-md h-full object-contain rounded-xl shadow-sm"
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row-reverse items-center gap-10 md:gap-12 p-8 rounded-2xl bg-backgroundSCD-light dark:bg-backgroundSCD-dark">
              <div className="md:w-1/3">
                <div className="text-6xl font-bold text-primary-light dark:text-primary-dark font-ibm-plex-sans">
                  2
                </div>
                <h3 className="text-2xl font-bold font-ibm-plex-sans mt-4 text-text-light dark:text-text-dark">
                  Browse & Reserve
                </h3>
                <p className="text-text-light dark:text-text-dark font-ibm-plex-sans mt-2">
                  Search for books and find them at your favorite cafés. Reserve
                  with just a click.
                </p>
                <div className="mt-6 relative">
                  <input
                    type="text"
                    placeholder="Find a book..."
                    name="book-search"
                    className="w-full px-6 py-3 rounded-full border border-border-light dark:border-border-dark focus:outline-none focus:border-primary-light dark:focus:border-primary-dark font-ibm-plex-sans"
                  />
                </div>
              </div>
              <div className="md:w-2/3">
                <img
                  src="/Browse.png"
                  alt="Illustration showing book browsing and reservation process"
                  className="w-full max-w-md h-full object-contain rounded-xl shadow-sm"
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center p-8 rounded-2xl bg-backgroundSCD-light dark:bg-backgroundSCD-dark gap-10 md:gap-[31rem]">
              <div className="md:w-1/3">
                <div className="text-6xl font-bold text-primary-light dark:text-primary-dark font-ibm-plex-sans">
                  3
                </div>
                <h3 className="text-2xl font-bold font-ibm-plex-sans mt-4 text-text-light dark:text-text-dark">
                  Pick Up & Enjoy
                </h3>
                <p className="text-text-light dark:text-text-dark font-ibm-plex-sans mt-2">
                  Visit your chosen café, show your reservation, and start
                  reading!
                </p>
                <div className="mt-6 p-4 bg-background-light dark:bg-background-dark rounded-lg border border-border-light dark:border-border-dark">
                  <p className="text-sm text-text-light dark:text-text-dark font-ibm-plex-sans">
                    Your pickup location:
                  </p>
                  <p className="font-bold font-ibm-plex-sans text-text-light dark:text-text-dark">
                    Blue Tokai Coffee Roasters
                  </p>
                </div>
              </div>
              <div className="md:w-2/3">
                <img
                  src="/PickUp.png"
                  alt="Illustration of book pickup process at a cafe"
                  className="w-full max-w-md h-full object-contain rounded-xl shadow-sm"
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row-reverse items-center gap-10 md:gap-12 p-8 rounded-2xl bg-backgroundSCD-light dark:bg-backgroundSCD-dark">
              <div className="md:w-1/3">
                <div className="text-6xl font-bold text-primary-light dark:text-primary-dark font-ibm-plex-sans">
                  4
                </div>
                <h3 className="text-2xl font-bold mt-4 font-ibm-plex-sans text-text-light dark:text-text-dark">
                  Return Anytime
                </h3>
                <p className="text-text-light dark:text-text-dark mt-2 font-ibm-plex-sans">
                  Drop off your book at any participating café when you're done.
                </p>
                <button className="mt-6 bg-backgroundSCD-light dark:bg-backgroundSCD-dark text-text-light dark:text-text-dark px-6 py-3 rounded-full hover:bg-backgroundSCD-light dark:hover:bg-backgroundSCD-dark transition font-ibm-plex-sans border border-border-dark dark:border-border-light">
                  Request Return
                </button>
              </div>
              <div className="md:w-2/3">
                <img
                  src="/Return-books.png"
                  alt="Book return"
                  className="w-full max-w-md h-full object-contain rounded-xl shadow-sm"
                />
              </div>
            </div>
          </div>

          <div className="text-center mt-16">
            <h2 className="text-3xl font-bold font-ibm-plex-sans mb-4 text-text-light dark:text-text-dark">
              Ready to start your reading journey?
            </h2>
            <p className="text-text-light dark:text-text-dark font-ibm-plex-sans mb-8">
              Join our community of book lovers and coffee enthusiasts today!
            </p>
            <Link href="/Subscription">
            <button className="bg-primary-light dark:bg-primary-dark text-text-dark px-8 py-4 rounded-full text-lg font-semibold hover:bg-primary-light dark:hover:bg-primary-dark transition font-ibm-plex-sans">
              Join Us Now
            </button>
            </Link>
          </div>
        </div>
      </main>
      <Footer/>
      <ThemeToggle />
    </div>
  );
}

export default MainComponent;