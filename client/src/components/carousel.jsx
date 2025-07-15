"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../app/Hooks/useAuth";

const Carousel = ({ title, description, buttonText, images }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const { isLoggedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    let timeoutId;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setIsMobile(window.innerWidth < 768), 100);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const maxRightShift = isMobile ? 0 : 20;
  const dynamicRightShift = isMobile ? 0 : Math.min(maxRightShift, images.length * 10);

  const handleLinkClick = (e, href) => {
    console.log(`Link clicked: href=${href}, isLoggedIn=${isLoggedIn}`);
    if (href.startsWith("/discover#") && window.location.pathname === "/discover") {
      e.preventDefault();
      const sectionId = href.split("#")[1];
      const element = document.getElementById(sectionId);
      if (element) {
        const headerHeight = document.querySelector("header")?.offsetHeight || 80;
        const yOffset = -headerHeight;
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: "smooth" });
        window.history.pushState(null, "", href);
      } else {
        console.warn(`Section with id="${sectionId}" not found`);
        router.push(href);
      }
    } else {
      router.push(href);
    }
  };

  const getLinkHref = () => {
    if (!isLoggedIn) return "/auth/signup";
    switch (buttonText) {
      case "Lets Get Started":
        return "/discover";
      case "Explore Classics":
        return "/discover#books";
      case "Find Location":
        return "/discover#cafes";
      default:
        return "#";
    }
  };

  const href = getLinkHref();

  const handleDotClick = (index) => {
    setCurrentIndex(index);
  };

  return (
    <div className="flex flex-col md:flex-row items-center justify-between min-h-[90vh] md:min-h-0 px-4 md:px-0">
      <div className="w-full md:w-[70%] pr-0 md:pr-32 mb-6 md:mb-0 relative z-10 text-center md:text-left">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-header text-text-light dark:text-text-dark mb-4 leading-tight">
          {title}
        </h1>
        <p className="text-textscd-light dark:text-textscd-dark font-body mb-6 text-sm sm:text-base md:text-lg">
          {description}
        </p>
        <Link
          href={href}
          onClick={(e) => handleLinkClick(e, href)}
          className="inline-block bg-primary-light dark:bg-primary-dark text-background-light dark:text-background-dark font-button font-bold px-4 sm:px-6 py-2 rounded-md hover:bg-secondary-light dark:hover:bg-secondary-dark transition-colors"
        >
          {buttonText}
        </Link>
      </div>

      <div
        className="relative w-full md:w-[30%] h-[340px] sm:h-[360px] md:h-[400px] flex flex-col items-center mt-8 md:mt-0"
        style={{
          transform: `translateX(${-dynamicRightShift}px)`,
        }}
      >
        {isMobile ? (
          <>
            <div
              className="relative w-full max-w-[240px] h-[320px] mx-auto overflow-hidden"
            >
              {images.map((image, index) => (
                <img
                  key={index}
                  src={image}
                  alt={`Book cover ${index + 1}`}
                  className={`absolute rounded-lg shadow-lg pointer-events-none object-contain transition-opacity duration-500 ease-in-out ${
                    currentIndex === index ? "opacity-100" : "opacity-0"
                  }`}
                  style={{
                    width: "100%",
                    height: "100%",
                    left: 0,
                    top: 0,
                    zIndex: images.length - index,
                  }}
                />
              ))}
            </div>
            <div className="flex justify-center mt-6 space-x-3">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => handleDotClick(index)}
                  className={`w-4 h-4 rounded-full transition-colors ${
                    currentIndex === index
                      ? "bg-primary-light dark:bg-primary-dark"
                      : "bg-border-light dark:bg-border-dark"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </>
        ) : (
          images.map((image, index) => {
            const baseWidth = 280;
            const widthReduction = 40;
            const leftShift = 80;
            const width = baseWidth - index * widthReduction;
            const left = index * leftShift;
            return (
              <img
                key={index}
                src={image}
                alt={`Book cover ${index + 1}`}
                className="absolute rounded-lg shadow-lg pointer-events-none transition-transform duration-300 hover:-translate-y-2"
                style={{
                  width: `${width}px`,
                  left: `${left}px`,
                  zIndex: images.length - index,
                }}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

export default Carousel;