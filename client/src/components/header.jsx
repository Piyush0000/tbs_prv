"use client";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "../app/Hooks/useAuth";

const Header = ({ onSearch }) => {
  const { user, isLoggedIn, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleMobileLogout = () => {
    logout();
    toggleMenu();
  };

  return (
    <header className="border-b border-border-light dark:border-border-dark px-2 md:px-8 py-3 bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark">
      <div className="w-full sm:w-[80%] mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center">
          <Link href="/">
            <div className="w-10 h-10 cursor-pointer">
              <img src="/Logo-Lightmode.png" alt="The Book Shelves Logo" className="w-full h-full object-contain dark:hidden" />
              <img src="/Logo-Darkmode.png" alt="The Book Shelves Logo" className="w-full h-full object-contain hidden dark:block" />
            </div>
          </Link>
        </div>

        <div className="flex-1 md:flex hidden items-center justify-center">
          <div className="relative w-full max-w-lg lg:max-w-xl">
            <div className="flex items-center bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-full p-1.5">
              <input type="text" name="search" placeholder={isLoggedIn ? "Search books, authors, or cafes..." : "Search books or authors..."} className="flex-1 text-sm outline-none bg-transparent px-2 py-1" onChange={onSearch}/>
              <button onClick={onSearch} className="ml-1.5 p-1.5 bg-primary-light dark:bg-primary-dark rounded-full" aria-label="Search">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </button>
            </div>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/how-it-works" className="font-header">How it works?</Link>
          <Link href="/AboutUs" className="font-header">About</Link>
          <Link href="/discover" className="font-header">Discover</Link>
          {isLoggedIn && user ? (
            <div className="flex items-center gap-4">
              <Link href="/profile" className="font-semibold hover:text-primary-light">
                Hi, {user.name}
              </Link>
              <button onClick={logout} className="bg-primary-light text-white dark:bg-primary-dark dark:text-black px-4 py-1.5 rounded-full text-sm font-header hover:bg-opacity-90">
                Log out
              </button>
            </div>
          ) : (
            <Link href="/auth/signin" className="bg-primary-light text-white dark:bg-primary-dark dark:text-black px-4 py-1.5 rounded-full text-sm font-header hover:bg-opacity-90">
              Log in
            </Link>
          )}
        </nav>

        <div className="md:hidden flex items-center">
          <button onClick={toggleMenu} aria-label="Toggle menu">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="absolute top-16 right-0 w-full bg-background-light dark:bg-background-dark border-b md:hidden z-50">
          <nav className="flex flex-col p-4">
            <Link href="/how-it-works" className="py-2 font-header" onClick={toggleMenu}>How it works?</Link>
            <Link href="/AboutUs" className="py-2 font-header" onClick={toggleMenu}>About</Link>
            <Link href="/discover" className="py-2 font-header" onClick={toggleMenu}>Discover</Link>
            <hr className="my-2 border-border-light dark:border-border-dark"/>
            {isLoggedIn ? (
              <>
                <Link href="/profile" className="py-2 font-header" onClick={toggleMenu}>Profile</Link>
                <button onClick={handleMobileLogout} className="py-2 text-left text-red-500 font-header">Log out</button>
              </>
            ) : (
              <Link href="/auth/signin" className="py-2 font-header" onClick={toggleMenu}>Log in</Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;