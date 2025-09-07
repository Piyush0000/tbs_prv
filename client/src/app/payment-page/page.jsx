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
  const planTier = searchParams.get("plan") || "standard";
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [depositPaid, setDepositPaid] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [isCodeApplied, setIsCodeApplied] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [subscriptionDetails, setSubscriptionDetails] = useState(null);
  const [couponDetails, setCouponDetails] = useState(null);
  
  const { data: user, loading: userLoading, refetch: refetchUser } = useUser();
  const { refreshToken } = useAuth();

  useEffect(() => {
    if (user) {
      setDepositPaid(user.deposit_status === "deposited");
      fetchSubscriptionDetails();
    }
  }, [user]);

  // Fetch subscription details
  const fetchSubscriptionDetails = async () => {
    try {
      let token = localStorage.getItem("token");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/subscription-details`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.status === 401) {
        token = await refreshToken();
        if (!token) return;
        localStorage.setItem("token", token);
        
        const retryResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/users/subscription-details`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (retryResponse.ok) {
          const data = await retryResponse.json();
          setSubscriptionDetails(data);
        }
      } else if (response.ok) {
        const data = await response.json();
        setSubscriptionDetails(data);
      }
    } catch (err) {
      console.error("Error fetching subscription details:", err);
    }
  };

  // Fetch payment configuration from backend
  useEffect(() => {
    const fetchPaymentConfig = async () => {
      try {
        let token = localStorage.getItem("token");
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/users/payment-config`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          token = await refreshToken();
          if (!token) {
            setError("Please log in to continue.");
            return;
          }
          localStorage.setItem("token", token);
          const retryResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/users/payment-config`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          if (!retryResponse.ok) throw new Error("Failed to fetch payment config");
          const config = await retryResponse.json();
          setPaymentConfig(config);
        } else {
          if (!response.ok) throw new Error("Failed to fetch payment config");
          const config = await response.json();
          setPaymentConfig(config);
        }
      } catch (err) {
        console.error("Error fetching payment config:", err);
        setError("Failed to load payment configuration");
      }
    };

    fetchPaymentConfig();
  }, [refreshToken]);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const showToast = (message, type = "info") => {
    if (type === "error") {
      setError(message);
      setSuccess(null);
    } else {
      setSuccess(message);
      setError(null);
    }
    setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 5000);
  };

  const handleApplyCode = async () => {
    if (!code.trim()) {
      setMessage("Please enter a coupon code");
      setIsCodeApplied(false);
      return;
    }

    setValidatingCoupon(true);
    setMessage("");
    setIsCodeApplied(false);

    try {
      let token = localStorage.getItem("token");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/validate-coupon`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            couponCode: code.trim(),
          }),
        }
      );

      if (response.status === 401) {
        token = await refreshToken();
        if (!token) {
          setError("Please log in again.");
          return;
        }
        localStorage.setItem("token", token);
        const retryResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/users/validate-coupon`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              couponCode: code.trim(),
            }),
          }
        );
        const data = await retryResponse.json();
        handleCouponValidationResponse(retryResponse, data);
      } else {
        const data = await response.json();
        handleCouponValidationResponse(response, data);
      }
    } catch (err) {
      console.error("Error validating coupon:", err);
      setMessage("Error validating coupon code");
      setIsCodeApplied(false);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleCouponValidationResponse = (response, data) => {
    if (response.ok && data.valid) {
      setMessage(data.message);
      setIsCodeApplied(true);
      setCouponDetails({
        code: code.trim(),
        isNewUserCoupon: data.isNewUserCoupon,
        discount: data.isNewUserCoupon ? "First month for ₹1" : "Valid coupon applied"
      });
    } else {
      setMessage(data.message || "Invalid coupon code");
      setIsCodeApplied(false);
      setCouponDetails(null);
    }
  };

  const handleDepositPayment = async () => {
    if (isProcessingPayment) return;
    
    try {
      setIsProcessingPayment(true);
      setError(null);

      if (!user) {
        setError("Please log in to proceed.");
        return;
      }

      if (!paymentConfig) {
        setError("Payment configuration not loaded.");
        return;
      }

      // Check if deposit already paid
      if (user.deposit_status === "deposited") {
        setError("Deposit already paid.");
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
          body: JSON.stringify({}),
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
            body: JSON.stringify({}),
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
    } finally {
      setIsProcessingPayment(false);
    }
  };

 const handleSubscriptionPayment = async () => {
  if (isProcessingPayment) return;
  
  try {
    setIsProcessingPayment(true);
    setError(null);

    if (!user || user.deposit_status !== "deposited") {
      setError("Please pay the deposit first.");
      return;
    }

    if (!paymentConfig) {
      setError("Payment configuration not loaded.");
      return;
    }

    // Check if user already has active subscription
    if (subscriptionDetails?.activeSubscription && 
        ['active', 'auto_setup_pending'].includes(subscriptionDetails.activeSubscription.subscription_status)) {
      setError("You already have an active subscription.");
      return;
    }

    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setError("Failed to load Razorpay SDK. Please try again.");
      return;
    }

    let token = localStorage.getItem("token");
    const requestBody = {
      tier: planTier,
    };

    // Only include couponCode if it's applied
    if (isCodeApplied && code.trim()) {
      requestBody.couponCode = code.trim();
    }

    console.log('Sending subscription request:', requestBody);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/users/create-subscription`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    await handleSubscriptionResponse(response, requestBody);
  } catch (err) {
    console.error("Error initiating subscription payment:", err.message);
    setError(err.message);
  } finally {
    setIsProcessingPayment(false);
  }
};

const handleSubscriptionResponse = async (response, requestBody) => {
  if (response.status === 401) {
    const token = await refreshToken();
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
        body: JSON.stringify(requestBody),
      }
    );
    if (!retryResponse.ok) {
      const errorData = await retryResponse.json();
      throw new Error(errorData.error || "Failed to create subscription after token refresh");
    }
    const orderData = await retryResponse.json();
    console.log('Subscription order data (retry):', orderData);
    initiatePayment(orderData, orderData.useAutoPay ? "subscription" : "order");
  } else {
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Subscription creation failed:', errorData);
      throw new Error(errorData.error || "Failed to create subscription");
    }
    const orderData = await response.json();
    console.log('Subscription order data:', orderData);
    initiatePayment(orderData, orderData.useAutoPay ? "subscription" : "order");
  }
};

const initiatePayment = async (orderData, type) => {
  console.log('Initiating payment with order data:', orderData, 'type:', type);
  
  if (!orderData.orderId) {
    setError('Invalid order data received from server');
    return;
  }

  const isAutoPay = type === "subscription";
  const paymentDescription = isAutoPay 
    ? `AutoPay Setup for ${planTier} Plan (First Month ₹${orderData.amount / 100})`
    : type === "deposit" 
    ? "Security Deposit"
    : `${planTier} Plan Monthly Payment (₹${orderData.amount / 100})`;

  const options = {
    key: orderData.key,
    amount: orderData.amount,
    currency: orderData.currency,
    name: "TheBookShelves Subscription",
    description: paymentDescription,
    order_id: type === "deposit" || type === "order" ? orderData.orderId : undefined,
    subscription_id: type === "subscription" ? orderData.orderId : undefined,
    handler: async (response) => {
      try {
        console.log('Razorpay handler response:', response);
        await verifyPayment(response, type, orderData);
      } catch (err) {
        console.error(`Error in payment handler:`, err.message);
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
    modal: {
      ondismiss: function() {
        setIsProcessingPayment(false);
      }
    }
  };

  console.log('Razorpay options:', options);
  
  const paymentObject = new window.Razorpay(options);
  paymentObject.on("payment.failed", (response) => {
    console.error('Payment failed:', response);
    setError(`Payment failed: ${response.error.description}`);
    setIsProcessingPayment(false);
  });
  paymentObject.open();
};

const verifyPayment = async (response, type, orderData) => {
  let token = localStorage.getItem("token");
  const endpoint = type === "deposit" ? "verify-deposit-payment" : "verify-subscription-payment";
  const payload = {
    razorpay_payment_id: response.razorpay_payment_id,
    razorpay_signature: response.razorpay_signature,
  };

  if (type !== "deposit") {
    payload.tier = planTier;
    payload.useAutoPay = type === "subscription";
    
    // Only include couponCode if it was applied
    if (isCodeApplied && code.trim()) {
      payload.couponCode = code.trim();
    }
  }

  if (type === "deposit") {
    payload.razorpay_order_id = response.razorpay_order_id;
  } else if (type === "order") {
    payload.razorpay_order_id = response.razorpay_order_id;
  } else if (type === "subscription") {
    payload.razorpay_subscription_id = response.razorpay_subscription_id;
  }

  console.log('Verification payload:', payload);

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
    handlePaymentSuccess(verifyData, type, orderData);
  } else {
    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.json();
      console.error('Payment verification failed:', errorData);
      throw new Error(errorData.error || `Failed to verify ${type} payment`);
    }
    const verifyData = await verifyResponse.json();
    console.log('Payment verification success:', verifyData);
    handlePaymentSuccess(verifyData, type, orderData);
  }
};

const handlePaymentSuccess = (verifyData, type, orderData) => {
  console.log('Payment success:', verifyData, type, orderData);
  
  showToast(verifyData.message, "success");
  refetchUser();
  fetchSubscriptionDetails();
  
  if (type === "deposit") {
    setDepositPaid(true);
    showToast("Deposit payment successful! You can now set up your subscription.", "success");
  } else if (type === "subscription") {
    // AutoPay subscription
    setTimeout(() => {
      const regularAmount = verifyData.regularAmount || 49;
      showToast(`AutoPay activated! You paid ₹${verifyData.actualAmountPaid} for the first month. Regular billing of ₹${regularAmount}/month will start next month.`, "success");
    }, 1000);
  } else if (type === "order") {
    // Regular one-time payment
    setTimeout(() => {
      showToast(`Payment successful! You've paid ₹${verifyData.actualAmountPaid} for this month's subscription.`, "success");
    }, 1000);
  }
  
  // Clear coupon after successful payment
  if (isCodeApplied) {
    clearCoupon();
  }
  
  setTimeout(() => {
    window.location.href = "/profile";
  }, 3000);
};

  const clearCoupon = () => {
    setCode("");
    setMessage("");
    setIsCodeApplied(false);
    setCouponDetails(null);
  };

  if (userLoading || !paymentConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-text-light dark:text-text-dark">Loading payment configuration...</p>
        </div>
      </div>
    );
  }

  if (error && !paymentConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="text-center p-6">
          <div className="text-red-500 mb-4 text-xl">⚠️ Error</div>
          <p className="text-text-light dark:text-text-dark mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-primary-light dark:bg-primary-dark text-white px-6 py-2 rounded-md hover:opacity-80"
          >
            Retry
          </button>
        </div>
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

  const isSubscribed = user?.subscription_type !== "basic" && 
                     subscriptionDetails?.activeSubscription?.subscription_status === 'active';
  const isFreeTrialActive = user?.freeTrialUsed && user?.freeTrialEndDate && new Date(user.freeTrialEndDate) > new Date();
  const hasActiveSubscription = subscriptionDetails?.activeSubscription && 
                               ['active', 'auto_setup_pending'].includes(subscriptionDetails.activeSubscription.subscription_status);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-header font-bold mb-4">
            Complete Your Subscription
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Follow the two-step process to activate your {planTier} plan.
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="max-w-md mx-auto mb-8">
          <div className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
              depositPaid ? 'bg-green-500' : 'bg-blue-500'
            } text-white text-sm font-medium`}>
              {depositPaid ? '✓' : '1'}
            </div>
            <div className={`flex-1 h-1 mx-4 ${depositPaid ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
              hasActiveSubscription ? 'bg-green-500' : depositPaid ? 'bg-blue-500' : 'bg-gray-300'
            } text-white text-sm font-medium`}>
              {hasActiveSubscription ? '✓' : '2'}
            </div>
          </div>
          <div className="flex justify-between mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span>Deposit</span>
            <span>Subscription</span>
          </div>
        </div>

        {/* Payment Cards */}
        <div className="flex justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg max-w-lg w-full overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Payment Setup
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Secure payment powered by Razorpay
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Current Subscription Status */}
              {subscriptionDetails?.activeSubscription && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                    Current Subscription Status
                  </h3>
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    <p>Plan: <strong>{subscriptionDetails.activeSubscription.subscription_type}</strong></p>
                    <p>Status: <strong>{subscriptionDetails.activeSubscription.subscription_status}</strong></p>
                    <p>Valid until: <strong>{new Date(subscriptionDetails.activeSubscription.validity).toLocaleDateString()}</strong></p>
                    {subscriptionDetails.activeSubscription.is_autopay && (
                      <p className="text-green-600 dark:text-green-400 mt-1">✓ AutoPay Active</p>
                    )}
                  </div>
                </div>
              )}

              {/* Deposit Payment Section */}
              <div className={`border-2 ${
                depositPaid 
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                  : 'border-gray-200 dark:border-gray-700'
              } rounded-lg p-6 transition-all duration-200`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Step 1: Security Deposit
                    </h3>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                      ₹{paymentConfig.depositFee}
                    </p>
                  </div>
                  {depositPaid && (
                    <div className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-3 py-1 rounded-full text-sm font-medium">
                      ✓ Paid
                    </div>
                  )}
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  This amount will be 100% refunded when your subscription ends
                </p>
                <button
                  onClick={handleDepositPayment}
                  disabled={depositPaid || isProcessingPayment}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                    depositPaid
                      ? "bg-green-500 text-white cursor-not-allowed opacity-75"
                      : isProcessingPayment
                      ? "bg-gray-400 text-white cursor-not-allowed opacity-75"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl"
                  }`}
                >
                  {isProcessingPayment ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </span>
                  ) : depositPaid ? (
                    "Payment Complete"
                  ) : (
                    "Pay Security Deposit"
                  )}
                </button>
              </div>

              {/* Subscription Setup Section */}
              <div className={`border-2 ${
                !depositPaid 
                  ? 'border-gray-200 dark:border-gray-700 opacity-60' 
                  : hasActiveSubscription 
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                  : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              } rounded-lg p-6 transition-all duration-200`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Step 2: Monthly Subscription
                    </h3>
                    <div className="mt-1">
                      {isCodeApplied ? (
                        <div className="space-y-1">
                          <p className="text-2xl font-bold text-green-600">₹1 first month</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Regular price: <span className="line-through">₹{paymentConfig.planFee}</span>
                          </p>
                          <p className="text-xs text-green-600 font-medium">
                            Then ₹{paymentConfig.planFee}/month from next month
                          </p>
                        </div>
                      ) : (
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          ₹{paymentConfig.planFee}/month
                        </p>
                      )}
                    </div>
                  </div>
                  {hasActiveSubscription && (
                    <div className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-3 py-1 rounded-full text-sm font-medium">
                      ✓ Active
                    </div>
                  )}
                </div>

                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  {isCodeApplied
                    ? "Pay just ₹1 for first month with coupon! Regular auto-pay (₹49/month) starts next month."
                    : "Set up your monthly subscription payment"}
                </p>

                {/* Coupon Input - Only show if not subscribed */}
                {!hasActiveSubscription && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Coupon Code (Optional)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="Enter coupon code"
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                        disabled={!depositPaid || validatingCoupon}
                      />
                      <button
                        onClick={handleApplyCode}
                        disabled={!depositPaid || validatingCoupon || !code.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200 font-medium disabled:cursor-not-allowed"
                      >
                        {validatingCoupon ? "..." : "Apply"}
                      </button>
                    </div>

                    {/* Coupon Message */}
                    {message && (
                      <div className={`mt-2 p-3 rounded-lg text-sm ${
                        isCodeApplied 
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700' 
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span>
                            {isCodeApplied ? 
                              `${message} Pay just ₹1 for first month!` : 
                              message
                            }
                          </span>
                          {isCodeApplied && (
                            <button
                              onClick={clearCoupon}
                              className="ml-2 text-red-500 hover:text-red-700 font-medium"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Available Coupons Hint */}
                    {!isCodeApplied && paymentConfig?.newUserCoupons && (
                      <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded text-xs text-blue-600 dark:text-blue-400">
                        New user? Try: {paymentConfig.newUserCoupons.join(', ')}
                      </div>
                    )}
                  </div>
                )}

                {/* Subscription Button */}
                <button
                  onClick={handleSubscriptionPayment}
                  disabled={!depositPaid || isProcessingPayment || hasActiveSubscription}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                    !depositPaid
                      ? "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                      : hasActiveSubscription
                      ? "bg-green-500 text-white cursor-not-allowed opacity-75"
                      : isProcessingPayment
                      ? "bg-gray-400 text-white cursor-not-allowed opacity-75"
                      : isCodeApplied
                      ? "bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl"
                  }`}
                >
                  {isProcessingPayment ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Setting up...
                    </span>
                  ) : hasActiveSubscription ? (
                    `Subscribed (${subscriptionDetails?.activeSubscription?.subscription_type})`
                  ) : !depositPaid ? (
                    "Complete Deposit First"
                  ) : isCodeApplied ? (
                    "Pay ₹1 & Setup Auto-Pay"
                  ) : (
                    "Pay ₹49 & Setup Subscription"
                  )}
                </button>

                {/* Free Trial Info */}
                {isFreeTrialActive && (
                  <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      Free trial active until: {new Date(user.freeTrialEndDate).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {/* Subscription Details */}
                {subscriptionDetails?.activeSubscription && (
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Subscription Details</h4>
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <p>Amount Paid: ₹{subscriptionDetails.activeSubscription.amount}</p>
                      <p>Valid Until: {new Date(subscriptionDetails.activeSubscription.validity).toLocaleDateString()}</p>
                      {subscriptionDetails.activeSubscription.razorpay_subscription_id && (
                        <p className="text-green-600 dark:text-green-400">AutoPay: Active</p>
                      )}
                      {subscriptionDetails.activeSubscription.couponCode && (
                        <p>Coupon Used: {subscriptionDetails.activeSubscription.couponCode}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Security Info */}
            <div className="px-6 pb-6">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center justify-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center">
                    <div className="w-4 h-4 mr-2">🔒</div>
                    <span>SSL Secured</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 mr-2">💳</div>
                    <span>Razorpay Protected</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 mr-2">✅</div>
                    <span>100% Refundable</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div className="max-w-lg mx-auto mt-8 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Need help? Contact our support team
          </p>
          <div className="flex justify-center space-x-4 text-sm">
            <a href="mailto:support@thebookshelves.com" className="text-blue-600 hover:text-blue-700">
              Email Support
            </a>
            <span className="text-gray-300">•</span>
            <a href="tel:+1234567890" className="text-blue-600 hover:text-blue-700">
              Call Us
            </a>
          </div>
        </div>

        {/* Subscription History */}
        {subscriptionDetails?.subscriptionHistory && subscriptionDetails.subscriptionHistory.length > 1 && (
          <div className="max-w-4xl mx-auto mt-12">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Payment History</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Plan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Validity
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {subscriptionDetails.subscriptionHistory.slice(0, 5).map((payment, index) => (
                      <tr key={payment._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {new Date(payment.transaction_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {payment.subscription_type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          ₹{payment.amount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            payment.subscription_status === 'active' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : payment.subscription_status === 'cancelled'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                          }`}>
                            {payment.subscription_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {new Date(payment.validity).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer
        description={footerData.description}
        subtext={footerData.subtext}
        linksLeft={footerData.linksLeft}
        linksRight={footerData.linksRight}
      />
      <ThemeToggle />

      {/* Toast Messages */}
      {error && (
        <div className="fixed bottom-4 right-4 max-w-sm bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg z-50">
          <div className="flex items-start">
            <div className="flex-shrink-0 mr-2 mt-0.5">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="flex-shrink-0 ml-2 text-red-400 hover:text-red-600"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="fixed bottom-4 left-4 max-w-sm bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg z-50">
          <div className="flex items-start">
            <div className="flex-shrink-0 mr-2 mt-0.5">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Success</p>
              <p className="text-sm">{success}</p>
            </div>
            <button
              onClick={() => setSuccess(null)}
              className="flex-shrink-0 ml-2 text-green-400 hover:text-green-600"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isProcessingPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center max-w-sm mx-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Processing Payment
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Please wait while we process your payment securely...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default PaymentPage;