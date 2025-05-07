"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Footer from "../../components/footer";
import Header from "../../components/header";
import ThemeToggle from "../../components/ThemeToggle";
import { useAuth } from "../Hooks/useAuth";
import { useUser } from "../Hooks/useUser";

function PaymentPage() {
  const searchParams = useSearchParams();
  const planTier = searchParams.get("plan");
  const [error, setError] = useState(null);
  const [depositPaid, setDepositPaid] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [isCodeApplied, setIsCodeApplied] = useState(false);
  const { data: user, loading: userLoading, refetch: refetchUser } = useUser();
  const { refreshToken } = useAuth();

  const codes = ["DINKY100", "KAVYA100", "LEO100", "KASIS100"];
  const DEPOSIT_FEE = 29900; // ₹299 in paise
  const PLAN_FEE = 4900; // ₹49 in paise

  useEffect(() => {
    if (user) {
      setDepositPaid(user.deposit_status === "deposited");
    }
  }, [user]);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleApplyCode = () => {
    if (codes.includes(code)) {
      setMessage("Coupon applied! First month free, auto-pay will start next month.");
      setIsCodeApplied(true);
    } else {
      setMessage("Invalid code");
      setIsCodeApplied(false);
    }
  };

  const handleDepositPayment = async () => {
    try {
      if (!user) {
        setError("Please log in to proceed.");
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setError("Failed to load Razorpay SDK. Please try again.");
        return;
      }

      let token = localStorage.getItem("token");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/create-deposit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            amount: DEPOSIT_FEE / 100,
          }),
        }
      );

      if (response.status === 401) {
        token = await refreshToken();
        if (!token) {
          setError("Failed to refresh token. Please log in again.");
          window.location.href = "/auth/signin";
          return;
        }
        localStorage.setItem("token", token);
        const retryResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/users/create-deposit`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              amount: DEPOSIT_FEE / 100,
            }),
          }
        );
        if (!retryResponse.ok) {
          const errorData = await retryResponse.json();
          throw new Error(errorData.error || "Failed to create deposit order");
        }
        const orderData = await retryResponse.json();
        initiatePayment(orderData, "deposit");
      } else {
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create deposit order");
        }
        const orderData = await response.json();
        initiatePayment(orderData, "deposit");
      }
    } catch (err) {
      console.error("Error initiating deposit payment:", err.message);
      setError(err.message);
    }
  };

  const handleAutoPaySetup = async () => {
    try {
      if (!user || user.deposit_status !== "deposited") {
        setError("Please pay the deposit first.");
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setError("Failed to load Razorpay SDK. Please try again.");
        return;
      }

      let token = localStorage.getItem("token");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/create-subscription`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            tier: planTier || "standard",
            amount: PLAN_FEE / 100,
            isCodeApplied,
          }),
        }
      );

      if (response.status === 401) {
        token = await refreshToken();
        if (!token) {
          setError("Failed to refresh token. Please log in again.");
          window.location.href = "/auth/signin";
          return;
        }
        localStorage.setItem("token", token);
        const retryResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/users/create-subscription`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              tier: planTier || "standard",
              amount: PLAN_FEE / 100,
              isCodeApplied,
            }),
          }
        );
        if (!retryResponse.ok) {
          const errorData = await retryResponse.json();
          throw new Error(
            errorData.error || "Failed to create subscription after token refresh"
          );
        }
        const orderData = await retryResponse.json();
        initiatePayment(orderData, "auto");
      } else {
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create subscription");
        }
        const orderData = await response.json();
        initiatePayment(orderData, "auto");
      }
    } catch (err) {
      console.error("Error initiating auto-pay setup:", err.message);
      setError(err.message);
    }
  };

  const initiatePayment = async (orderData, type) => {
    const options = {
      key: orderData.key,
      amount: type === "deposit" ? DEPOSIT_FEE : PLAN_FEE,
      currency: orderData.currency,
      name: "TheBookShelves Subscription",
      description: type === "deposit" ? "Security Deposit" : `Auto-Pay Setup for ${planTier || "standard"} Plan`,
      order_id: type === "deposit" ? orderData.orderId : undefined,
      subscription_id: type === "auto" ? orderData.orderId : undefined,
      handler: async (response) => {
        try {
          // Log Razorpay response for debugging
          console.log('Razorpay handler response:', response);

          let token = localStorage.getItem("token");
          const endpoint = type === "deposit" ? "verify-deposit-payment" : "verify-subscription-payment";
          const payload = {
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            tier: planTier || "standard",
            amount: (type === "deposit" ? DEPOSIT_FEE : PLAN_FEE) / 100,
            isCodeApplied,
          };

          // Add fields based on payment type
          if (type === "deposit") {
            payload.razorpay_order_id = response.razorpay_order_id;
          } else {
            payload.razorpay_subscription_id = response.razorpay_subscription_id;
          }

          const verifyResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/users/${endpoint}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(payload),
            }
          );

          if (verifyResponse.status === 401) {
            token = await refreshToken();
            if (!token) {
              setError("Failed to refresh token. Please log in again.");
              window.location.href = "/auth/signin";
              return;
            }
            localStorage.setItem("token", token);
            const retryVerifyResponse = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/users/${endpoint}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
              }
            );
            if (!retryVerifyResponse.ok) {
              const errorData = await retryVerifyResponse.json();
              throw new Error(
                errorData.error || `Failed to verify ${type} payment after token refresh`
              );
            }
            const verifyData = await retryVerifyResponse.json();
            alert(verifyData.message);
            refetchUser();
            if (type === "deposit") setDepositPaid(true);
            window.location.href = "/profile";
          } else {
            if (!verifyResponse.ok) {
              const errorData = await verifyResponse.json();
              throw new Error(errorData.error || `Failed to verify ${type} payment`);
            }
            const verifyData = await verifyResponse.json();
            alert(verifyData.message);
            refetchUser();
            if (type === "deposit") setDepositPaid(true);
            window.location.href = "/profile";
          }
        } catch (err) {
          console.error(`Error verifying ${type} payment:`, err.message);
          setError(err.message);
        }
      },
      prefill: {
        name: user?.name || "",
        email: user?.email || "",
        contact: user?.phone_number || "",
      },
      theme: {
        color: "#1D4ED8",
      },
    };

    const paymentObject = new window.Razorpay(options);
    paymentObject.on("payment.failed", (response) => {
      setError(`Payment failed: ${response.error.description}`);
      window.location.href = "/payment-page";
    });
    paymentObject.open();
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
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-header font-bold mb-4">
            Complete Your Subscription
          </h1>
          <p className="text-text-light dark:text-text-dark max-w-2xl mx-auto">
            Follow the two-step process to activate your plan.
          </p>
        </div>
        <div className="flex justify-center">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4 text-text-light dark:text-text-dark">
              Payment Options
            </h2>
            <div className="space-y-6">
              <div className="border border-border-light dark:border-border-dark p-4 rounded-lg">
                <h3 className="text-xl font-semibold mb-2">
                  1. Security Deposit (₹299)
                </h3>
                <p className="text-text-light dark:text-text-dark mb-4">
                      This amount will be 100% refunded once the subscription is over
                </p>
                <button
                  onClick={handleDepositPayment}
                  disabled={depositPaid}
                  className={`w-full py-3 px-4 rounded-full font-medium transition-colors font-button ${
                    depositPaid
                      ? "bg-green-500 text-white cursor-not-allowed"
                      : "bg-primary-light dark:bg-primary-dark text-background-light dark:text-background-dark hover:bg-primary-dark dark:hover:bg-primary-light"
                  }`}
                >
                  {depositPaid ? "Paid" : "Pay Now"}
                </button>
                <div className="mt-2 text-sm">
                  Status: {depositPaid ? (
                    <span className="text-green-500">Paid</span>
                  ) : (
                    <span className="text-red-500">Not Paid</span>
                  )}
                </div>
              </div>
              <div className="border border-border-light dark:border-border-dark p-4 rounded-lg">
                <h3 className="text-xl font-semibold mb-2">
                  2. Setup your monthly subscription (49) 
                </h3>
                <p className="text-text-light dark:text-text-dark mb-4">
                  {isCodeApplied
                    ? "First month free with coupon, auto-pay starts next month."
                    : "Auto-pay setup starts today."}
                </p>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter coupon code (optional)"
                  className="w-full px-4 py-2 border rounded-md text-text-light dark:text-text-light mb-2"
                  disabled={!depositPaid}
                />
                <button
                  onClick={handleApplyCode}
                  className="w-full py-3 px-4 rounded-full font-medium transition-colors font-button bg-primary-light dark:bg-primary-dark text-background-light dark:text-background-dark hover:bg-primary-dark dark:hover:bg-primary-light mb-2"
                  disabled={!depositPaid}
                >
                  Apply Code
                </button>
                {message && (
                  <div
                    className={`mt-2 text-sm ${
                      isCodeApplied ? "text-success" : "text-warning-light"
                    }`}
                  >
                    {message}
                  </div>
                )}
                <button
                  onClick={handleAutoPaySetup}
                  disabled={!depositPaid}
                  className={`w-full py-3 px-4 rounded-full font-medium transition-colors font-button ${
                    !depositPaid
                      ? "bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 cursor-not-allowed"
                      : "bg-primary-light dark:bg-primary-dark text-background-light dark:text-background-dark hover:bg-primary-dark dark:hover:bg-primary-light"
                  }`}
                >
                  {depositPaid ? "Setup Auto-Pay" : "Pay Deposit First"}
                </button>
                <div className="mt-2 text-sm">
                  Status: {user?.subscription_type === "standard" ? "Subscribed" : "Not Subscribed"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer
        description={footerData.description}
        subtext={footerData.subtext}
        linksLeft={footerData.linksLeft}
        linksRight={footerData.linksRight}
      />
      <ThemeToggle />
      {error && (
        <div className="fixed bottom-4 right-4 bg-warning-light dark:bg-warning-dark text-warning-light dark:text-warning-dark p-3 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}

export default PaymentPage;