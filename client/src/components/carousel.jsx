"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const Carousel = ({ title, description, buttonText, images }) => {
  const [isMobile, setIsMobile] = useState(false);

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
          href={
            buttonText === "Lets Get Started" ? "/auth/signup" : //For the logged in user lets go to discover
            buttonText === "Explore Classics" ? "/discover" :
            buttonText === "Find Location" ? "/cafes" : "#"
          }
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