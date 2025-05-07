import Link from "next/link";

const Footer = () => {
  return (
    <footer className=" bg-background-dark dark:bg-background-light px-4 md:px-8 py-8 sm:py-16 mx-auto translate-y-[-10]">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* Row 1: Logo */}
        <div className="flex flex-col items-start sm:flex-row sm:justify-between">
          {/* Logo */}
          <div className="w-[200px] sm:w-[300px] mb-4 sm:mb-0">
            <img
              src="/ExpandedLogo-Lightmode.png"
              alt="The Book Shelves Logo"
              className="w-full h-auto object-contain dark:hidden"
            />
            <img
              src="/ExpandedLogo-Darkmode.png"
              alt="The Book Shelves Logo"
              className="w-full h-auto object-contain hidden dark:block"
            />
          </div>
        </div>

        {/* Row 2: Description and Contact Info */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
          {/* Description */}
          <div className="text-left w-full sm:w-[45%] mb-6 sm:mb-0">
            <p className="text-text-dark dark:text-text-light font-body text-base sm:text-lg leading-relaxed mb-4">
              Dive into a world where books and coffee create magic. At TheBookShelves, we're more than just a collection of paperbacks at your favorite cafés—our community thrives on the love for stories and the joy of shared experiences.
            </p>
            <p className="text-text-dark dark:text-text-light font-body text-base sm:text-lg">
              Sip, read, and connect with us today!
            </p>
          </div>
          {/* Contact Info (desktop only) */}
          <div className="hidden sm:block sm:text-right sm:w-[45%]">
            <div className="text-text-dark dark:text-text-light font-body text-base">
              <p>Email: info@thebookshelves.com</p>
            </div>
            <div className="flex space-x-4 mt-4 justify-end text-text-dark dark:text-text-light">
              <a
                href="https://facebook.com/thebookshelves"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary-light dark:hover:text-primary-dark transition-colors"
              >
                <span>FB</span>
              </a>
              <a
                href="https://www.instagram.com/th_bookshelves"
                target="_blank"
                rel ="noopener noreferrer"
                className="hover:text-primary-light dark:hover:text-primary-dark transition-colors"
              >
                <span>IG</span>
              </a>
              <a
                href="https://www.linkedin.com/company/th-bookshelves/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary-light dark:hover:text-primary-dark transition-colors"
              >
                <span>LI</span>
              </a>
            </div>
          </div>
        </div>

        {/* Contact Section (mobile only, below description) */}
        <div className="block sm:hidden text-left">
          <Link
            href="/contact"
            className="text-text-dark dark:text-text-light text-2xl font-header hover:text-primary-light dark:hover:text-primary-dark transition-colors"
          >
            Contact
          </Link>
          <div className="text-text-dark dark:text-text-light font-body text-sm mt-4">
            <p>Email: info@thebookshelves.com</p>
          </div>
          <div className="flex space-x-4 mt-4 text-text-dark dark:text-text-light">
            <a
              href="https://facebook.com/thebookshelves"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary-light dark:hover:text-primary-dark transition-colors"
            >
              <span>FB</span>
            </a>
            <a
              href="https://instagram.com/thebookshelves"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary-light dark:hover:text-primary-dark transition-colors"
            >
              <span>IG</span>
            </a>
            <a
              href="https://linkedin.com/company/thebookshelves"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary-light dark:hover:text-primary-dark transition-colors"
            >
              <span>LI</span>
            </a>
          </div>
        </div>

        {/* Row 3: Links */}
        <div className="flex justify-between items-center pt-8 border-t border-border-light dark:border-border-dark">
  {/* Left Links */}
  <div className="flex flex-row space-x-8 items-center">
    <Link
      href="/how-it-works"
      className="text-text-dark dark:text-text-light font-body text-sm sm:text-base hover:text-primary-light dark:hover:text-primary-dark transition-colors"
    >
      How it works?
    </Link>
    <Link
      href="#"
      className="text-text-dark dark:text-text-light font-body text-sm sm:text-base hover:text-primary-light dark:hover:text-primary-dark transition-colors"
    >
      Terms of Use
    </Link>
    <Link
      href="/Subscription"
      className="text-text-dark dark:text-text-light font-body text-sm sm:text-base hover:text-primary-light dark:hover:text-primary-dark transition-colors"
    >
      Subscription
    </Link>
  </div>
</div>
      </div>
    </footer>
  );
};

export default Footer;