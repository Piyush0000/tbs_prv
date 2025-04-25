"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../app/Hooks/useAuth";

const Carousel = ({ title, description, buttonText, images }) => {
  const [isMobile, setIsMobile] = useState(false);
  const { isLoggedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const maxRightShift = isMobile ? 0 : 20;
  let dynamicRightShift = 0;
  if (!isMobile) {
    dynamicRightShift =
      images.length === 1
        ? maxRightShift
        : (maxRightShift / images.length) * 1.7;
  }

  const handleLinkClick = (e, href) => {
    console.log(`Link clicked: href=${href}, isLoggedIn=${isLoggedIn}`);
    // Prevent default only for anchor links on the same page
    if (href.startsWith("/discover#") && window.location.pathname === "/discover") {
      e.preventDefault();
      const sectionId = href.split("#")[1]; // e.g., "books" or "cafes"
      const element = document.getElementById(sectionId);
      if (element) {
        const headerHeight = document.querySelector("header")?.offsetHeight || 80;
        const yOffset = -headerHeight;
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: "smooth" });
        // Update URL without reloading
        window.history.pushState(null, "", href);
      } else {
        console.warn(`Section with id="${sectionId}" not found`);
        router.push(href); // Fallback to full navigation
      }
    } else {
      // Let Link handle navigation for different pages
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

  return (
    <div className="flex flex-col md:flex-row items-center justify-between">
      <div className="w-full md:w-[70%] pr-0 md:pr-32 mb-2 md:mb-0 relative z-10">
        <h1 className="text-4xl md:text-5xl font-header text-text-light dark:text-text-dark mb-4">
          {title}
        </h1>
        <p className="text-textscd-light dark:text-textscd-dark font-body mb-6">
          {description}
        </p>
        <Link
          href={href}
          onClick={(e) => handleLinkClick(e, href)}
          className="inline-block bg-primary-light dark:bg-primary-dark text-background-light dark:text-background-dark font-button font-bold px-6 py-2 rounded-md hover:bg-secondary-light dark:hover:bg-secondary-dark transition-colors"
        >
          {buttonText}
        </Link>
      </div>

      <div
        className="relative w-full md:w-[30%] h-[300px] md:h-[400px] flex items-center mt-8 md:mt-0"
        style={{
          transform: isMobile ? "none" : `translateX(${-dynamicRightShift}px)`,
        }}
      >
        {isMobile ? (
          <div
            className="relative"
            style={{
              width: `${220 + (images.length - 1) * (50 - 30)}px`,
              margin: "0 auto",
              height: "300px",
            }}
          >
            {images.map((image, index) => {
              const baseWidth = 220;
              const widthReduction = 30;
              const leftShift = 50;
              const verticalShift = 15;

              const width = baseWidth - index * widthReduction;
              const left = index * leftShift;
              const top = index * verticalShift;

              return (
                <img
                  key={index}
                  src={image}
                  alt={`Book cover ${index + 1}`}
                  className="absolute rounded-lg shadow-lg pointer-events-none"
                  style={{
                    width: `${width}px`,
                    left: `${left}px`,
                    top: `${top}px`,
                    zIndex: images.length - index,
                  }}
                />
              );
            })}
          </div>
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