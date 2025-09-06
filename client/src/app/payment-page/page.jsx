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
  
  // State management
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [depositPaid, setDepositPaid] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [validCoupon, setValidCoupon] = useState(null);
  const [debugMode] = useState(process.env.NODE_ENV === 'development');

  // Hooks
  const { data: user, loading: userLoading, refetch: refetchUser } = useUser();
  const { refreshToken } = useAuth();

  // Constants
  const DEPOSIT_FEE = 299;
  const PLAN_FEE = 49;

  // Debug logging function
  const debugLog = (message, data = {}) => {
    if (debugMode) {
      console.log(`[PAYMENT DEBUG] ${message}`, data);
    }
  };

  // Initialize component state
  useEffect(() => {
    debugLog('Component mounted', { planTier, user: user?.user_id });
    
    if (user) {
      setDepositPaid(user.deposit_status === "deposited");
      debugLog('User state updated', { 
        depositStatus: user.deposit_status, 
        subscriptionType: user.subscription_type 
      });
    }
  }, [user, debugMode]);

  // Razorpay script loader
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        debugLog('Razorpay script already loaded');
        resolve(true);
        return;
      }
      
      debugLog('Loading Razorpay script');
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => {
        debugLog('Razorpay script loaded successfully');
        resolve(true);
      };
      script.onerror = () => {
        debugLog('Razorpay script failed to load');
        resolve(false);
      };
      document.body.appendChild(script);
    });
  };

  // Enhanced authenticated request handler
  const makeAuthenticatedRequest = async (url, options = {}) => {
    debugLog('Making authenticated request', { url, method: options.method });
    
    // Validate API URL
    if (!process.env.NEXT_PUBLIC_API_URL) {
      throw new Error("API URL not configured");
    }

    let token = localStorage.getItem("token");
    if (!token) {
      throw new Error("No authentication token found");
    }
    
    const makeRequest = async (authToken) => {
      const requestOptions = {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
          ...options.headers,
        },
      };
      
      debugLog('Request details', {
        url,
        method: requestOptions.method,
        hasBody: !!options.body,
        tokenLength: authToken?.length || 0
      });
      
      const response = await fetch(url, requestOptions);
      debugLog('Response received', { 
        status: response.status, 
        ok: response.ok,
        statusText: response.statusText 
      });
      
      return response;
    };

    try {
      let response = await makeRequest(token);

      // Handle token refresh if needed
      if (response.status === 401) {
        debugLog('Token expired, attempting refresh');
        
        try {
          token = await refreshToken();
          if (!token) {
            throw new Error("Failed to refresh token");
          }
          
          localStorage.setItem("token", token);
          debugLog('Token refreshed successfully');
          response = await makeRequest(token);
        } catch (refreshError) {
          debugLog('Token refresh failed', { error: refreshError.message });
          setError("Session expired. Please log in again.");
          setTimeout(() => {
            window.location.href = "/auth/signin";
          }, 2000);
          return null;
        }
      }

      return response;
    } catch (networkError) {
      debugLog('Network error occurred', { error: networkError.message });
      throw new Error(`Network error: ${networkError.message}`);
    }
  };

  // Parse API error response
  const parseApiError = async (response) => {
    let errorMessage = `Server error (${response.status})`;
    
    try {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const errorData = await response.json();
        debugLog('API error data', errorData);
        
        if (errorData.error) {
          errorMessage = errorData.error;
        }
        if (errorData.details) {
          errorMessage += ` - ${errorData.details}`;
        }
        if (errorData.errors && Array.isArray(errorData.errors)) {
          errorMessage += ` - ${errorData.errors.map(e => e.msg || e.message).join(', ')}`;
        }
      } else {
        const textError = await response.text();
        if (textError) {
          errorMessage = textError;
        }
      }
    } catch (parseError) {
      debugLog('Failed to parse error response', { error: parseError.message });
    }
    
    return errorMessage;
  };

  // Coupon validation handler
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponMessage("Please enter a coupon code");
      return;
    }

    setLoading(true);
    setCouponMessage("");
    setValidCoupon(null);

    try {
      debugLog('Validating coupon', { code: couponCode.trim() });
      
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_API_URL}/payments/validate-coupon`,
        {
          method: "POST",
          body: JSON.stringify({ code: couponCode.trim().toUpperCase() }),
        }
      );

      if (!response) return;

      if (response.ok) {
        const data = await response.json();
        debugLog('Coupon validation successful', data);
        
        if (data.valid) {
          setValidCoupon(data.coupon);
          setCouponMessage(`Coupon applied! ${data.coupon.description}`);
        } else {
          setCouponMessage("Invalid coupon code");
        }
      } else {
        const errorMessage = await parseApiError(response);
        setCouponMessage(errorMessage);
      }
    } catch (err) {
      debugLog('Coupon validation error', { error: err.message });
      setCouponMessage("Error validating coupon. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Deposit payment handler
  const handleDepositPayment = async () => {
    setLoading(true);
    setError(null);
    
    debugLog('Starting deposit payment', {
      user: user?.user_id,
      depositStatus: user?.deposit_status,
      amount: DEPOSIT_FEE
    });

    try {
      // Validation checks
      if (!user) {
        throw new Error("Please log in to proceed");
      }

      if (user.deposit_status === "deposited") {
        throw new Error("Deposit already paid");
      }

      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Failed to load payment gateway");
      }

      // Create deposit order
      debugLog('Creating deposit order');
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_API_URL}/payments/create-deposit-order`,
        {
          method: "POST",
          body: JSON.stringify({ amount: DEPOSIT_FEE }),
        }
      );

      if (!response) return;

      if (!response.ok) {
        const errorMessage = await parseApiError(response);
        throw new Error(errorMessage);
      }

      const orderData = await response.json();
      debugLog('Deposit order created', { orderId: orderData.orderId });
      
      await initiateDepositPayment(orderData);

    } catch (err) {
      debugLog('Deposit payment error', { error: err.message });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Initialize Razorpay deposit payment
  const initiateDepositPayment = async (orderData) => {
    return new Promise((resolve, reject) => {
      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "TheBookShelves",
        description: "Security Deposit - 100% Refundable",
        order_id: orderData.orderId,
        handler: async (response) => {
          debugLog('Deposit payment successful', { paymentId: response.razorpay_payment_id });
          await verifyDepositPayment(response);
          resolve();
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
          ondismiss: () => {
            debugLog('Payment modal dismissed');
            reject(new Error("Payment cancelled"));
          }
        }
      };

      const paymentObject = new window.Razorpay(options);
      
      paymentObject.on("payment.failed", (response) => {
        debugLog('Payment failed', response.error);
        reject(new Error(`Payment failed: ${response.error.description}`));
      });
      
      paymentObject.open();
    });
  };

  // Verify deposit payment
  const verifyDepositPayment = async (razorpayResponse) => {
    setLoading(true);
    
    try {
      debugLog('Verifying deposit payment', { 
        paymentId: razorpayResponse.razorpay_payment_id 
      });
      
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_API_URL}/payments/verify-deposit-payment`,
        {
          method: "POST",
          body: JSON.stringify({
            razorpay_payment_id: razorpayResponse.razorpay_payment_id,
            razorpay_order_id: razorpayResponse.razorpay_order_id,
            razorpay_signature: razorpayResponse.razorpay_signature,
            amount: DEPOSIT_FEE,
          }),
        }
      );

      if (!response) return;

      if (!response.ok) {
        const errorMessage = await parseApiError(response);
        throw new Error(errorMessage);
      }

      const verifyData = await response.json();
      debugLog('Deposit payment verified', verifyData);
      
      setDepositPaid(true);
      await refetchUser();
      
      // Show success message
      setError(null);
      alert("Deposit payment successful!");

    } catch (err) {
      debugLog('Deposit verification error', { error: err.message });
      setError(`Verification failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Subscription setup handler
  const handleSubscriptionSetup = async () => {
    setLoading(true);
    setError(null);
    
    debugLog('Starting subscription setup', {
      user: user?.user_id,
      tier: planTier,
      validCoupon: validCoupon?.code
    });

    try {
      // Validation checks
      if (!user || user.deposit_status !== "deposited") {
        throw new Error("Please complete deposit payment first");
      }

      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Failed to load payment gateway");
      }

      // Create subscription order
      const requestBody = {
        tier: planTier || "standard",
        amount: PLAN_FEE,
      };

      if (validCoupon) {
        requestBody.coupon_code = validCoupon.code;
      }

      debugLog('Creating subscription order', requestBody);
      
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_API_URL}/payments/create-subscription-order`,
        {
          method: "POST",
          body: JSON.stringify(requestBody),
        }
      );

      if (!response) return;

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || "Failed to create subscription";
        throw new Error(errorMessage);
      }

      // Handle free subscription case
      if (data.message && data.message.includes('Free subscription')) {
        debugLog('Free subscription activated', data);
        await refetchUser();
        alert(data.message);
        window.location.href = "/profile";
        return;
      }

      debugLog('Subscription order created', { subscriptionId: data.subscriptionId });
      await initiateSubscriptionPayment(data);

    } catch (err) {
      debugLog('Subscription setup error', { error: err.message });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Initialize Razorpay subscription payment
  const initiateSubscriptionPayment = async (orderData) => {
    return new Promise((resolve, reject) => {
      const options = {
        key: orderData.key,
        subscription_id: orderData.subscriptionId,
        name: "TheBookShelves",
        description: `${(planTier || "standard").charAt(0).toUpperCase() + (planTier || "standard").slice(1)} Plan Subscription`,
        handler: async (response) => {
          debugLog('Subscription payment successful', { 
            paymentId: response.razorpay_payment_id 
          });
          await verifySubscriptionPayment(response);
          resolve();
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
          ondismiss: () => {
            debugLog('Subscription payment modal dismissed');
            reject(new Error("Payment cancelled"));
          }
        }
      };

      const paymentObject = new window.Razorpay(options);
      
      paymentObject.on("payment.failed", (response) => {
        debugLog('Subscription payment failed', response.error);
        reject(new Error(`Payment failed: ${response.error.description}`));
      });
      
      paymentObject.open();
    });
  };

  // Verify subscription payment
  const verifySubscriptionPayment = async (razorpayResponse) => {
    setLoading(true);
    
    try {
      debugLog('Verifying subscription payment', {
        paymentId: razorpayResponse.razorpay_payment_id
      });
      
      const requestBody = {
        razorpay_payment_id: razorpayResponse.razorpay_payment_id,
        razorpay_subscription_id: razorpayResponse.razorpay_subscription_id,
        razorpay_signature: razorpayResponse.razorpay_signature,
        tier: planTier || "standard",
        amount: getDiscountedAmount(),
      };

      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_API_URL}/payments/verify-subscription-payment`,
        {
          method: "POST",
          body: JSON.stringify(requestBody),
        }
      );

      if (!response) return;

      if (!response.ok) {
        const errorMessage = await parseApiError(response);
        throw new Error(errorMessage);
      }

      const verifyData = await response.json();
      debugLog('Subscription payment verified', verifyData);
      
      await refetchUser();
      alert("Subscription activated successfully!");
      window.location.href = "/profile";

    } catch (err) {
      debugLog('Subscription verification error', { error: err.message });
      setError(`Verification failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Calculate discounted amount
  const getDiscountedAmount = () => {
    if (!validCoupon) return PLAN_FEE;
    
    if (validCoupon.discount_type === 'percentage') {
      return Math.max(0, PLAN_FEE * (1 - validCoupon.discount_value / 100));
    } else {
      return Math.max(0, PLAN_FEE - validCoupon.discount_value);
    }
  };

  // Loading states
  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-light dark:border-primary-dark mx-auto mb-4"></div>
          <p className="text-text-light dark:text-text-dark">Loading user data...</p>
        </div>
      </div>
    );
  }

  if (!user && !userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-text-light dark:text-text-dark mb-4">
            Please Log In
          </h2>
          <p className="text-text-light dark:text-text-dark mb-6">
            You need to be logged in to access the payment page.
          </p>
          <button
            onClick={() => window.location.href = "/auth/signin"}
            className="px-6 py-2 bg-primary-light dark:bg-primary-dark text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Footer data
  const footerData = {
    description: "Dive into a world where books and coffee create magic. At TheBookShelves, we're more than just a collection of paperbacks at your favorite cafes—our community thrives on the love for stories and the joy of shared experiences.",
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
      
      <main className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-header font-bold mb-4">
            Complete Your Subscription
          </h1>
          <p className="text-text-light dark:text-text-dark max-w-2xl mx-auto">
            Follow the two-step process to activate your {planTier || "standard"} plan.
          </p>
        </div>
        
        {/* Payment Form */}
        <div className="flex justify-center">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6 text-text-light dark:text-text-dark">
              Payment Process
            </h2>
            
            <div className="space-y-6">
              {/* Step 1: Deposit */}
              <div className="border border-border-light dark:border-border-dark p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold">
                    1. Security Deposit
                  </h3>
                  <span className="text-lg font-bold text-primary-light dark:text-primary-dark">
                    ₹{DEPOSIT_FEE}
                  </span>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  This amount will be 100% refunded when your subscription ends
                </p>
                
                <button
                  onClick={handleDepositPayment}
                  disabled={depositPaid || loading}
                  className={`w-full py-3 px-4 rounded-full font-medium transition-all duration-200 ${
                    depositPaid
                      ? "bg-green-500 text-white cursor-not-allowed"
                      : loading
                      ? "bg-gray-400 text-white cursor-not-allowed"
                      : "bg-primary-light dark:bg-primary-dark text-white hover:opacity-90 transform hover:scale-105"
                  }`}
                >
                  {loading && !depositPaid ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Processing...
                    </span>
                  ) : depositPaid ? (
                    "✓ Deposit Paid"
                  ) : (
                    "Pay Security Deposit"
                  )}
                </button>
                
                <div className="mt-3 text-sm text-center">
                  Status: {depositPaid ? (
                    <span className="text-green-600 font-medium">✓ Completed</span>
                  ) : (
                    <span className="text-red-500">Pending</span>
                  )}
                </div>
              </div>

              {/* Step 2: Subscription */}
              <div className="border border-border-light dark:border-border-dark p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold">
                    2. Monthly Plan
                  </h3>
                  <span className="text-lg font-bold text-primary-light dark:text-primary-dark">
                    ₹{validCoupon ? getDiscountedAmount() : PLAN_FEE}
                  </span>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {validCoupon && getDiscountedAmount() === 0
                    ? "First month free with coupon!"
                    : "Start your reading journey today!"}
                </p>

                {/* Coupon Code Section */}
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <label className="block text-sm font-medium mb-2">
                    Have a coupon code?
                  </label>
                  
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Enter coupon code"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-light dark:focus:ring-primary-dark focus:border-transparent"
                      disabled={!depositPaid || loading}
                    />
                    <button
                      onClick={handleApplyCoupon}
                      disabled={!depositPaid || loading || !couponCode.trim()}
                      className={`px-4 py-2 rounded-md font-medium transition-colors ${
                        !depositPaid || loading || !couponCode.trim()
                          ? "bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed"
                          : "bg-blue-500 hover:bg-blue-600 text-white"
                      }`}
                    >
                      {loading ? "..." : "Apply"}
                    </button>
                  </div>
                  
                  {couponMessage && (
                    <div className={`text-sm mt-2 ${
                      validCoupon ? "text-green-600" : "text-red-500"
                    }`}>
                      {couponMessage}
                    </div>
                  )}
                </div>

                {/* Price Breakdown */}
                {validCoupon && (
                  <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span>Original Price:</span>
                        <span className="line-through text-gray-500">₹{PLAN_FEE}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Discount:</span>
                        <span className="text-green-600">
                          -{validCoupon.discount_type === 'percentage' 
                            ? `${validCoupon.discount_value}%` 
                            : `₹${validCoupon.discount_value}`}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold border-t pt-2 border-green-200 dark:border-green-700">
                        <span>Final Price:</span>
                        <span className="text-green-600">₹{getDiscountedAmount()}</span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleSubscriptionSetup}
                  disabled={!depositPaid || loading}
                  className={`w-full py-3 px-4 rounded-full font-medium transition-all duration-200 ${
                    !depositPaid
                      ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                      : loading
                      ? "bg-gray-400 text-white cursor-not-allowed"
                      : "bg-primary-light dark:bg-primary-dark text-white hover:opacity-90 transform hover:scale-105"
                  }`}
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Processing...
                    </span>
                  ) : !depositPaid ? (
                    "Complete Deposit First"
                  ) : validCoupon && getDiscountedAmount() === 0 ? (
                    "Activate Free Subscription"
                  ) : (
                    "Setup Monthly Subscription"
                  )}
                </button>

                <div className="mt-3 text-sm text-center">
                  Status: {user?.subscription_type === (planTier || "standard") ? (
                    <span className="text-green-600 font-medium">✓ Active</span>
                  ) : (
                    <span className="text-red-500">Not Active</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Debug Information (Development only) */}
        {debugMode && (
          <div className="mt-8 max-w-md mx-auto">
            <details className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
              <summary className="cursor-pointer font-medium">Debug Info</summary>
              <div className="mt-2 text-sm space-y-1">
                <div>API URL: {process.env.NEXT_PUBLIC_API_URL || 'Not set'}</div>
                <div>User ID: {user?.user_id || 'Not found'}</div>
                <div>Plan Tier: {planTier || 'Not specified'}</div>
                <div>Deposit Status: {user?.deposit_status || 'Unknown'}</div>
                <div>Subscription Type: {user?.subscription_type || 'None'}</div>
                <div>Valid Coupon: {validCoupon?.code || 'None'}</div>
              </div>
            </details>
          </div>
        )}
      </main>
      
      <Footer
        description={footerData.description}
        subtext={footerData.subtext}
        linksLeft={footerData.linksLeft}
        linksRight={footerData.linksRight}
      />
      
      <ThemeToggle />
      
      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg max-w-sm z-50">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h4 className="font-medium">Payment Error</h4>
              <p className="text-sm mt-1">{error}</p>
            </div>
            <button 
              onClick={() => setError(null)}
              className="ml-2 text-white hover:text-gray-200 text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}
      
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg text-center max-w-sm">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-light dark:border-primary-dark mx-auto mb-4"></div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Processing Payment
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Please do not close this window...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default PaymentPage;