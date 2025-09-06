import React, { useState, useEffect, useRef } from "react";

// The 'onLogout' prop is added to handle the logout action
function Header({ user, onSearch, onLogout }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Check if user is authenticated
  const isAuthenticated = user && user.user_id;

  // Use standard <a> tags instead of Next.js <Link>
  const Link = ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>;

  // Close user dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userMenuRef]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark">
      <div className="container flex h-16 items-center justify-between px-4 sm:px-6 space-x-4">
        {/* Logo */}
        <div className="flex-shrink-0">
          <Link href="/" className="flex items-center space-x-2">
            <img
              src="/Logo-Lightmode.png"
              alt="The Book Shelves Logo"
              className="h-8 w-auto dark:hidden"
              onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/100x32/ffffff/000000?text=Logo'; }}
            />
            <img
              src="/Logo-Darkmode.png"
              alt="The Book Shelves Logo"
              className="h-8 w-auto hidden dark:block"
              onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/100x32/000000/ffffff?text=Logo'; }}
            />
          </Link>
        </div>

        {/* Search Bar - Desktop */}
        <div className="hidden md:flex flex-1 max-w-lg mx-auto">
            <div className="relative w-full">
                 <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                 </div>
                <input
                    type="text"
                    placeholder="Search books, authors, or cafes..."
                    onChange={onSearch}
                    className="w-full py-2 pl-10 pr-4 rounded-full border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-light dark:focus:ring-primary-dark"
                />
            </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          <Link
            href="/how-it-works"
            className="text-text-light dark:text-text-dark hover:text-primary-light dark:hover:text-primary-dark transition-colors font-medium"
          >
            How it works?
          </Link>
          <Link
            href="/about"
            className="text-text-light dark:text-text-dark hover:text-primary-light dark:hover:text-primary-dark transition-colors font-medium"
          >
            About
          </Link>
          <Link
            href="/discover"
            className="text-text-light dark:text-text-dark hover:text-primary-light dark:hover:text-primary-dark transition-colors font-medium"
          >
            Discover
          </Link>
          
          {/* User Authentication Section */}
          {isAuthenticated ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-2 px-4 py-2 rounded-full bg-primary-light dark:bg-primary-dark text-white font-medium hover:bg-primary-light/80 dark:hover:bg-primary-dark/80 transition-colors"
              >
                {/* User Avatar */}
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-xs font-semibold">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </span>
                </div>
                <span>{user.name || 'User'}</span>
                <svg 
                  className={`h-4 w-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-md shadow-lg py-1 z-50">
                  {/* User Info Section */}
                  <div className="px-4 py-2 border-b border-border-light dark:border-border-dark">
                    <p className="font-medium text-text-light dark:text-text-dark text-sm">
                      {user.name || 'User'}
                    </p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <Link 
                    href="/profile" 
                    className="block px-4 py-2 text-sm text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  <Link 
                    href="/my-books" 
                    className="block px-4 py-2 text-sm text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    My Books
                  </Link>
                  <button 
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onLogout();
                    }} 
                    className="w-full text-left block px-4 py-2 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/auth/signin"
              className="inline-flex items-center px-6 py-2 rounded-full bg-primary-light dark:bg-primary-dark text-white font-medium hover:bg-primary-light/80 dark:hover:bg-primary-dark/80 transition-colors"
            >
              Log in
            </Link>
          )}
        </nav>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 text-text-light dark:text-text-dark hover:text-primary-light dark:hover:text-primary-dark"
            aria-label="Open menu"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMenuOpen && (
        <div className="md:hidden">
            <div className="px-4 pb-4 pt-2">
                 <input
                    type="text"
                    placeholder="Search books or cafes..."
                    onChange={onSearch}
                    className="w-full px-4 py-2 rounded-full border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-light dark:focus:ring-primary-dark"
                />
            </div>
          <nav className="flex flex-col items-center space-y-2 py-4 border-t border-border-light dark:border-border-dark">
            <Link 
              href="/how-it-works" 
              className="py-2 text-text-light dark:text-text-dark hover:text-primary-light dark:hover:text-primary-dark"
              onClick={() => setIsMenuOpen(false)}
            >
              How it works?
            </Link>
            <Link 
              href="/about" 
              className="py-2 text-text-light dark:text-text-dark hover:text-primary-light dark:hover:text-primary-dark"
              onClick={() => setIsMenuOpen(false)}
            >
              About
            </Link>
            <Link 
              href="/discover" 
              className="py-2 text-text-light dark:text-text-dark hover:text-primary-light dark:hover:text-primary-dark"
              onClick={() => setIsMenuOpen(false)}
            >
              Discover
            </Link>
            
            <div className="w-full border-t border-border-light dark:border-border-dark my-2"></div>

            {/* Mobile User Authentication Section */}
            {isAuthenticated ? (
              <>
                <div className="text-center py-2 flex items-center space-x-2">
                  <div className="w-8 h-8 bg-primary-light dark:bg-primary-dark rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">
                      {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </span>
                  </div>
                  <span className="font-medium text-text-light dark:text-text-dark">
                    Hello, {user.name || 'User'}
                  </span>
                </div>
                <Link 
                  href="/profile" 
                  className="py-2 text-text-light dark:text-text-dark hover:text-primary-light dark:hover:text-primary-dark"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Profile
                </Link>
                <Link 
                  href="/my-books" 
                  className="py-2 text-text-light dark:text-text-dark hover:text-primary-light dark:hover:text-primary-dark"
                  onClick={() => setIsMenuOpen(false)}
                >
                  My Books
                </Link>
                <button 
                  onClick={() => {
                    setIsMenuOpen(false);
                    onLogout();
                  }} 
                  className="py-2 text-red-500 hover:text-red-600"
                >
                  Logout
                </button>
              </>
            ) : (
               <Link
                  href="/auth/signin"
                  className="w-3/4 text-center mt-2 px-4 py-2 rounded-full bg-primary-light dark:bg-primary-dark text-white font-medium hover:bg-primary-light/80 dark:hover:bg-primary-dark/80 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Log In
                </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

export default Header;