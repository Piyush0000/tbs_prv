"use client";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "../app/Hooks/useAuth";

const Header = ({ location, onLocationChange, onSearch }) => {
  const { isLoggedIn } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className="border-b border-border-light dark:border-border-dark px-2 md:px-8 py-4 bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark">
      <div className="w-full sm:w-[80%] mx-auto flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center">
          <Link href="/">
            <div className="w-12 h-12 cursor-pointer">
              <img
                src="/Logo-Lightmode.png"
                alt="The Book Shelves Logo"
                className="w-full h-full object-contain dark:hidden"
              />
              <img
                src="/Logo-Darkmode.png"
                alt="The Book Shelves Logo"
                className="w-full h-full object-contain hidden dark:block"
              />
            </div>
          </Link>
        </div>

        {/* Search Section - Desktop */}
        <div className="flex-1 md:flex hidden items-center justify-center">
          <div className="relative w-full max-w-lg lg:max-w-xl">
            <div className="flex items-center bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-full p-1.5">
              <input
                type="text"
                name="search"
                placeholder={
                  isLoggedIn
                    ? "Search with Book name, Author, Publication or Café name"
                    : "Search with name, Author or Publication"
                }
                className="flex-1 text-sm text-text-light dark:text-text-dark outline-none bg-transparent px-2 py-1"
                onChange={onSearch}
              />
              <button
                onClick={onSearch}
                className="ml-1.5 p-1.5 bg-primary-light dark:bg-primary-dark text-text-light dark:text-text-dark rounded-full hover:bg-primary-light dark:hover:bg-primary-dark transition-colors"
                aria-label="Search"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Search Section - Mobile */}
        <div className="flex-1 flex md:hidden items-center">
          <div className="flex-1 flex items-center bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-full p-2">
            <input
              type="text"
              name="search"
              placeholder="Search..."
              className="flex-1 text-sm text-text-light dark:text-text-dark outline-none bg-transparent px-3 py-1.5"
              onChange={onSearch}
            />
            <button
              onClick={onSearch}
              className="ml-2 p-2 bg-primary-light dark:bg-primary-dark text-text-light dark:text-text-dark rounded-full hover:bg-primary-light dark:hover:bg-primary-dark transition-colors"
              aria-label="Search"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <Link
            href="/how-it-works"
            className="text-text-light dark:text-text-dark hover:text-primary-light dark:hover:text-primary-dark font-header"
          >
            How it works ?
          </Link>
          <Link
            href="/discover"
            className="text-text-light dark:text-text-dark hover:text-primary-light dark:hover:text-primary-dark font-header"
          >
            Discover
          </Link>
          {isLoggedIn ? (
            <Link href="/profile">
              <button className="w-10 h-10 rounded-full border border-border-light dark:border-border-dark flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5 text-text-light dark:text-text-dark"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                  />
                </svg>
              </button>
            </Link>
          ) : (
            <Link
              href="/auth/signin"
              className="text-text-light dark:text-text-dark hover:text-primary-light dark:hover:text-primary-dark font-header"
            >
              Log in
            </Link>
          )}
        </nav>

        {/* Mobile Hamburger Menu */}
        <div className="md:hidden flex items-center">
          <button
            onClick={toggleMenu}
            className="w-8 h-10 flex items-center justify-center"
            aria-label="Toggle menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6 text-text-light dark:text-text-dark"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMenuOpen && (
          <div className="absolute top-16 left-0 w-full bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark md:hidden z-50">
            <nav className="flex flex-col p-4">
              <Link
                href="/how-it-works"
                className="py-2 text-text-light dark:text-text-dark hover:text-primary-light dark:hover:text-primary-dark font-header"
                onClick={toggleMenu}
              >
                How it works ?
              </Link>
              <Link
                href="/discover"
                className="py-2 text-text-light dark:text-text-dark hover:text-primary-light dark:hover:text-primary-dark font-header"
                onClick={toggleMenu}
              >
                Discover
              </Link>
              {isLoggedIn ? (
                <>
                  <Link
                    href="/profile"
                    className="py-2 text-text-light dark:text-text-dark hover:text-primary-light dark:hover:text-primary-dark font-header"
                    onClick={toggleMenu}
                  >
                    Profile
                  </Link>
                  <Link
                    href="/auth/logout"
                    className="py-2 text-text-light dark:text-text-dark hover:text-primary-light dark:hover:text-primary-dark font-header"
                    onClick={toggleMenu}
                  >
                    Log out
                  </Link>
                </>
              ) : (
                <Link
                  href="/auth/signin"
                  className="py-2 text-text-light dark:text-text-dark hover:text-primary-light dark:hover:text-primary-dark font-header"
                  onClick={toggleMenu}
                >
                  Log in
                </Link>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;