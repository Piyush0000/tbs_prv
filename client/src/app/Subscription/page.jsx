"use client";
import { useState, useEffect } from "react";
import Footer from "../../components/footer";
import Header from "../../components/header";
import SubscriptionPlan from "../../components/subscriptionplans";
import ThemeToggle from "../../components/ThemeToggle";
import { useAuth } from "../Hooks/useAuth";
import { useUser } from "../Hooks/useUser";

function MainComponent() {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [error, setError] = useState(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const { data: user, loading: userLoading, refetch: refetchUser } = useUser();
  const { refreshToken } = useAuth();

  // Add search state and handler
  const [searchQuery, setSearchQuery] = useState("");

  const DEPOSIT_FEE = 29900; // ₹299 in paise

  const plans = [
    {
      id: 2,
      tier: "standard",
      name: "Standard Plan",
      price: 49.0,
      image:
        "https://i.pinimg.com/564x/ed/f4/f6/edf4f6c42624c31db77d8352e6575841.jpg",
      features: [
        "☕Get access to Unlimited books(1 book at a time)",
        "☕Access to audiobooks and book summaries",
        "☕Extra discount at partner cafes",
        "☕Special invitations to book reading sessions",
      ],
    },
  ];

  const handleSelectPlan = (plan) => {
    setSelectedPlan((prevSelectedPlan) =>
      prevSelectedPlan?.id === plan.id ? null : plan
    );
  };

  // Add search handler
  const handleSearch = (query) => {
    setSearchQuery(query);
    // You can implement search logic here or navigate to search page
    console.log("Searching for:", query);
  };

  // Add logout handler
  const handleLogout = async () => {
    try {
      // Implement your logout logic here
      console.log("Logging out...");
      // Example: Clear tokens, redirect, etc.
      // await logout();
      // window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSubscribe = async () => {
    try {
      if (!user) {
        setShowLoginPrompt(true);
        return;
      }
      if (!selectedPlan) {
        setError("Please select a plan first.");
        return;
      }

      window.location.href = `/payment-page?plan=${selectedPlan.tier}`;
    } catch (err) {
      console.error("Error initiating payment:", err.message);
        setError(err.message);
    }
  };

  const handleCloseLoginPrompt = () => {
    setShowLoginPrompt(false);
  };

  const handleLoginRedirect = () => {
    window.location.href = "/auth/signin?callbackUrl=/subscriptions";
  };

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-warning-light dark:text-warning-dark">{error}</div>
      </div>
    );
  }

  const footerData = {
    description:
      "Dive into a world where books and coffee create magic. At TheBookShelves, we're more than just a collection of paperbacks at your favorite cafés—our community thrives on the love for stories and the joy of shared experiences.",
    subtext: "Sip, read, and connect with us today!",
    linksLeft: [
      { href: "/how-it-works", text: "How it works ?" },
      { href: "#", text: "Terms of Use" },
      { href: "#", text: "Sales and Refunds" },
    ],
    linksRight: [
      { href: "/Subscription", text: "Subscription" },
      { href: "#", text: "Careers" },
      { href: "#", text: "Meet the team" },
      { href: "#", text: "Contact" },
    ],
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark">
      {/* Fixed Header with all required props */}
      <Header 
        user={user} 
        onSearch={handleSearch} 
        onLogout={handleLogout} 
      />
      
      <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-header font-bold mb-4">
            Choose Your Plan
          </h1>
          <p className="text-text-light dark:text-text-dark max-w-2xl mx-auto">
            Select the perfect plan for your reading journey. Unlock access to our
            extensive collection of books and exclusive features.
          </p>
        </div>
        <div className="flex justify-center">
          <div className="grid md:grid-cols-1 gap-8 max-w-6xl mx-auto justify-center">
            {plans.map((plan) => (
              <SubscriptionPlan
                key={plan.id}
                plan={{
                  name: plan.name,
                  price: plan.price,
                  booksPerMonth: plan.features.length,
                  disabled: false,
                  cafeDiscount: 10,
                  features: plan.features,
                }}
                isSelected={selectedPlan?.id === plan.id}
                onSelect={() => handleSelectPlan(plan)}
                isCurrentPlan={user?.subscription_type === plan.tier}
              />
            ))}
          </div>
        </div>
        <div className="mt-12 text-center">
          <button
            onClick={handleSubscribe}
            disabled={!selectedPlan}
            className={`bg-primary-light dark:bg-primary-dark text-background-light dark:text-background-dark px-8 py-3 rounded-full hover:bg-primary-dark dark:hover:bg-primary-light transition-colors font-button ${!selectedPlan ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {!selectedPlan ? "Select a plan first" : "Subscribe Now"}
          </button>
        </div>
      </div>
      <Footer
        description={footerData.description}
        subtext={footerData.subtext}
        linksLeft={footerData.linksLeft}
        linksRight={footerData.linksRight}
      />
      <ThemeToggle />

      {showLoginPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg text-center">
            <p className="mb-4 text-lg text-gray-800 dark:text-gray-200">
              Log in to subscribe
            </p>
            <button
              onClick={handleLoginRedirect}
              className="bg-primary-light dark:bg-primary-dark text-background-light dark:text-background-dark px-4 py-2 rounded-full hover:bg-primary-dark dark:hover:bg-primary-light transition-colors font-button"
            >
              Sign In
            </button>
            <button
              onClick={handleCloseLoginPrompt}
              className="ml-4 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-full hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors font-button"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MainComponent;