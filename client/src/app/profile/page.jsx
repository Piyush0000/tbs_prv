"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import QRCodeGenerator from "../../components/QRCodeGenerator";
import ThemeToggle from "../../components/ThemeToggle";
import { useUser } from "../Hooks/useUser";

function MainComponent() {
  const { data: user, loading, error: userError, refetch } = useUser();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showPhoneForm, setShowPhoneForm] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [previousTransactions, setPreviousTransactions] = useState([]);
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [showQR, setShowQR] = useState({});
  const [currentBook, setCurrentBook] = useState(null);
  const [loadingBook, setLoadingBook] = useState(true);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [showConfirmCancelPickup, setShowConfirmCancelPickup] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (user && !loading) {
      console.log("User object in useEffect:", user);
      console.log("User book_id:", user?.book_id);
      setEmail(user.email || "");
      setPhone(user.phone_number || "");
      fetchTransactions();
      fetchCurrentBook();
    }
  }, [user, loading]);

  const fetchTransactions = async () => {
    setLoadingTransactions(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found. Please sign in.");
      }

      if (!user || !user.user_id) {
        throw new Error("User data not available. Please sign in again.");
      }

      console.log("Fetching transactions for user:", user);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("Transactions API response status:", res.status);
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Unauthorized: Please sign in again.");
        }
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch transactions");
      }

      const transactions = await res.json();
      console.log("Transactions received:", transactions);
      const userTransactions = transactions.filter(
        (t) => t.user_id?.user_id === user.user_id
      );

      const previous = userTransactions.filter((t) =>
        ["picked_up", "dropped_off"].includes(t.status)
      );
      const pending = userTransactions.filter((t) =>
        ["pickup_pending", "dropoff_pending"].includes(t.status)
      );

      console.log("Pending Transactions:", pending);

      setPreviousTransactions(previous);
      setPendingTransactions(pending);
    } catch (err) {
      console.error("Error fetching transactions:", err.message);
      setError(err.message);
      if (err.message.includes("Unauthorized") || err.message.includes("User data not available")) {
        localStorage.removeItem("token");
        window.location.href = "/auth/signin";
      }
    } finally {
      setLoadingTransactions(false);
    }
  };

  const fetchCurrentBook = async () => {
    setLoadingBook(true);
    try {
      const token = localStorage.getItem("token");
      console.log("Fetching current book for user:", user?.user_id);
      console.log("User book_id in fetchCurrentBook:", user?.book_id);

      if (!token) {
        throw new Error("No authentication token found.");
      }

      // Explicitly check for null or undefined book_id
      if (!user?.book_id || user.book_id === null) {
        console.log("No book_id found for user. Setting currentBook to null.");
        setCurrentBook(null);
        setLoadingBook(false);
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/books/${user.book_id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Unauthorized: Please sign in again.");
        }
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch book");
      }

      const bookData = await res.json();
      setCurrentBook(bookData);
    } catch (err) {
      console.error("Error fetching current book:", err.message);
      setError(err.message);
      if (err.message.includes("Unauthorized")) {
        localStorage.removeItem("token");
        window.location.href = "/auth/signin";
      }
      setCurrentBook(null);
    } finally {
      setLoadingBook(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
        const token = localStorage.getItem("token");
        if (!token) {
            throw new Error("No authentication token found. Please sign in.");
        }

        console.log('Initiating subscription cancellation for user:', user.user_id);

        const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/users/cancel-subscription`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Subscription cancellation failed:', errorData);
            throw new Error(errorData.error || "Failed to cancel subscription");
        }

        const data = await response.json();
        console.log('Subscription cancellation response:', data);

        await refetch();
        setError(null);
        setShowConfirmCancel(false);
        alert("Subscription cancelled successfully.");
    } catch (err) {
        console.error("Error cancelling subscription:", err.message);
        if (err.message.includes("drop off")) {
            setError("Please complete your book drop-off before canceling the subscription.");
        } else if (err.message.includes("subscription payment")) {
            setError("Failed to update subscription payment. Please try again or contact support.");
        } else {
            setError(err.message);
        }
        setShowConfirmCancel(false);
    }
  };

  const handleCancelPickup = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found. Please sign in.");
      }

      const pickupTransaction = pendingTransactions.find(
        (t) =>
          t.book_id.book_id === currentBook.book_id &&
          t.status === "pickup_pending"
      );
      if (!pickupTransaction) {
        throw new Error("No pending pickup transaction found.");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/transactions/cancel/${pickupTransaction.transaction_id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to cancel pickup request");
      }

      await refetch();
      await fetchTransactions();
      await fetchCurrentBook();
      setShowConfirmCancelPickup(false);
      setError(null);
      alert("Pickup request cancelled successfully.");
    } catch (err) {
      console.error("Error cancelling pickup request:", err.message);
      setError(err.message);
      setShowConfirmCancelPickup(false);
    }
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone) => {
    const phoneRegex = /^\d{10}$/;
    return phoneRegex.test(phone);
  };

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    try {
      if (!validateEmail(email)) {
        throw new Error("Please enter a valid email address");
      }

      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found. Please sign in.");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/update-user`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ email }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.errors?.[0]?.msg || "Failed to update email");
      }

      await refetch();
      setShowEmailForm(false);
      setError(null);
    } catch (err) {
      console.error("Error updating email:", err.message);
      setError(err.message);
    }
  };

  const handleUpdatePhone = async (e) => {
    e.preventDefault();
    try {
      if (!validatePhone(phone)) {
        throw new Error("Phone number must be 10 digits");
      }

      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found. Please sign in.");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/update-user`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ phone_number: phone }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.errors?.[0]?.msg || "Failed to update phone number");
      }

      await refetch();
      setShowPhoneForm(false);
      setError(null);
    } catch (err) {
      console.error("Error updating phone number:", err.message);
      setError(err.message);
    }
  };

  const handleDropOff = () => {
    if (!currentBook) {
      setError("No book to drop off");
      return;
    }
    router.push(`/drop-off?book_id=${currentBook.book_id}`);
  };

  const toggleQR = (transactionId) => {
    setShowQR((prev) => ({
      ...prev,
      [transactionId]: !prev[transactionId],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-light dark:border-primary-dark"></div>
      </div>
    );
  }

  if (userError) {
    if (userError.includes("No token found") || userError.includes("Failed to fetch user")) {
      localStorage.removeItem("token");
      window.location.href = "/auth/signin";
      return null;
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="text-warning-light dark:text-warning-dark p-3 rounded-lg font-body">
          {userError}
        </div>
      </div>
    );
  }

  if (!user) {
    window.location.href = "/auth/signin";
    return null;
  }

  const isPickupPending = pendingTransactions.some(
    (t) =>
      t.book_id.book_id === currentBook?.book_id &&
      t.status === "pickup_pending"
  );

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute top-4 left-4">
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

      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center mb-8">
          <div className="relative inline-block">
            {user.image ? (
              <img
                src={user.image}
                alt="Profile"
                className="w-32 h-32 rounded-full object-cover border-4 border-border-light dark:border-border-dark"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-backgroundSCD-light dark:bg-backgroundSCD-dark flex items-center justify-center">
                <i className="fas fa-user text-4xl text-text-light dark:text-text-dark"></i>
              </div>
            )}
          </div>
          <h1 className="mt-4 text-3xl font-bold font-header text-text-light dark:text-text-dark">
            {user.name || "No Name Set"}
          </h1>
          <p className="mt-1 text-sm text-text-light dark:text-text-dark font-body">
            Customer ID: {user.user_id}
          </p>
        </div>
        <div className="flex items-center justify-between px-6 py-3 rounded-lg border border-border-light dark:border-border-dark hover:border-border-light dark:hover:border-border-dark transition-colors">
          <div>
            <h2 className="text-2xl font-bold font-header text-text-light dark:text-text-dark capitalize">
              {user.subscription_type?.toUpperCase() || "BASIC"} SUBSCRIPTION
            </h2>
            <p className="text-text-light dark:text-text-dark font-body">
              Valid until{" "}
              {user.subscription_validity
                ? new Date(user.subscription_validity).toLocaleDateString(
                    "en-US",
                    {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }
                  )
                : "Not set"}
            </p>
            <p className="text-text-light dark:text-text-dark font-body">
              Deposit Status: {user.deposit_status}
            </p>
          </div>
          <a
            href="/Subscription"
            className="inline-flex items-center px-6 py-2.5 bg-primary-light dark:bg-primary-dark text-text-light dark:text-text-dark font-button rounded-full hover:bg-primary-light dark:hover:bg-primary-dark transition-colors"
          >
            Upgrade Subscription
          </a>
        </div>
        <div className="space-y-4">
          {showEmailForm ? (
            <form onSubmit={handleUpdateEmail} className="space-y-3">
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border-light dark:border-border-dark px-4 py-2 font-body"
                placeholder="Enter your email"
              />
              <div className="flex space-x-2 justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-light dark:bg-primary-dark text-text-light dark:text-text-dark rounded-full font-button hover:bg-primary-light dark:hover:bg-primary-dark"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmailForm(false)}
                  className="px-4 py-2 border text-text-light dark:text-text-dark border-border-light dark:border-border-dark rounded-full font-button hover:bg-backgroundSCD-light dark:hover:bg-backgroundSCD-dark"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between px-6 py-3 rounded-lg border border-border-light dark:border-border-dark hover:border-border-light dark:hover:border-border-dark transition-colors">
              <div className="font-body text-text-light dark:text-text-dark">
                {user.email}
              </div>
            </div>
          )}
          {showPhoneForm ? (
            <form onSubmit={handleUpdatePhone} className="space-y-3">
              <input
                type="tel"
                name="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-border-light dark:border-border-dark px-4 py-2 font-body"
                placeholder="Enter your 10-digit phone number"
              />
              <div className="flex space-x-2 justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-light dark:bg-primary-dark text-text-light dark:text-text-dark rounded-full font-button hover:bg-primary-light dark:hover:bg-primary-dark"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowPhoneForm(false)}
                  className="px-4 py-2 border text-text-light dark:text-text-dark border-border-light dark:border-border-dark rounded-full font-button hover:bg-backgroundSCD-light dark:hover:bg-backgroundSCD-dark"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between px-6 py-3 rounded-lg border border-border-light dark:border-border-dark hover:border-border-light dark:hover:border-border-dark transition-colors">
              <div className="font-body text-text-light dark:text-text-dark">
                {user.phone_number || "Not set"}
              </div>
              <button
                onClick={() => setShowPhoneForm(true)}
                className="px-4 py-2 text-primary-light dark:text-primary-dark rounded-full border border-primary-light dark:border-primary-dark hover:bg-primary-light dark:hover:bg-primary-dark transition-colors font-button"
              >
                Update Phone
              </button>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <h2 className="text-2xl font-bold font-header text-text-light dark:text-text-dark">
            Current Book
          </h2>
          {loadingBook ? (
            <div className="text-text-light dark:text-text-dark">
              Loading book...
            </div>
          ) : !currentBook ? (
            <div className="px-6 py-3 rounded-lg border border-border-light dark:border-border-dark text-text shack-text-dark font-body">
              No book currently borrowed.
            </div>
          ) : (
            <div className="flex items-center justify-between px-6 py-3 rounded-lg border border-border-light dark:border-border-dark hover:border-border-light dark:hover:border-border-dark transition-colors">
              <div className="flex items-center space-x-4">
                {currentBook.image_url ? (
                  <img
                    src={currentBook.image_url}
                    alt={currentBook.name}
                    className="w-16 h-24 object-cover rounded"
                  />
                ) : (
                  <div className="w-16 h-24 bg-backgroundSCD-light dark:bg-backgroundSCD-dark rounded flex items-center justify-center">
                    <i className="fas fa-book text-2xl text-text-light dark:text-text-dark"></i>
                  </div>
                )}
                <div className="font-body text-text-light dark:text-text-dark">
                  <p>
                    <strong>Name:</strong> {currentBook.name}
                  </p>
                  <p>
                    <strong>Author:</strong> {currentBook.author}
                  </p>
                </div>
              </div>
              <button
                onClick={isPickupPending ? () => setShowConfirmCancelPickup(true) : handleDropOff}
                className="px-4 py-2 text-primary-light dark:text-primary-dark rounded-full border border-primary-light dark:border-primary-dark hover:bg-primary-light dark:hover:bg-primary-dark transition-colors font-button"
                disabled={pendingTransactions.some(
                  (t) =>
                    t.book_id.book_id === currentBook.book_id &&
                    t.status === "dropoff_pending tij"
                )}
              >
                {pendingTransactions.some(
                  (t) =>
                    t.book_id.book_id === currentBook.book_id &&
                    t.status === "dropoff_pending"
                )
                  ? "Drop-off Pending"
                  : isPickupPending
                  ? "Cancel"
                  : "Drop Off"}
              </button>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <h2 className="text-2xl font-bold font-header text-text-light dark:text-text-dark">
            Previous Transactions
          </h2>
          {loadingTransactions ? (
            <div className="text-text-light dark:text-text-dark">
              Loading transactions...
            </div>
          ) : previousTransactions.length === 0 ? (
            <div className="px-6 py-3 rounded-lg border border-border-light dark:border-border-dark text-text-light dark:text-text-dark font-body">
              No previous transactions found.
            </div>
          ) : (
            previousTransactions.map((transaction) => (
              <div
                key={transaction.transaction_id}
                className="flex items-center justify-between px-6 py-3 rounded-lg border border-border-light dark:border-border-dark hover:border-border-light dark:hover:border-border-dark transition-colors"
              >
                <div className="font-body text-text-light dark:text-text-dark">
                  <p>
                    <strong>Cafe:</strong> {transaction.cafe_id.name}
                  </p>
                  <p>
                    <strong>Book:</strong> {transaction.book_id.name}
                  </p>
                  <p>
                    <strong>Type:</strong>{" "}
                    {transaction.status === "picked_up" ? "Picked Up" : "Dropped Off"}
                  </p>
                  <p>
                    <strong>Date:</strong>{" "}
                    {new Date(transaction.processed_at || transaction.created_at).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="space-y-4">
          <h2 className="text-2xl font-bold font-header text-text-light dark:text-text-dark">
            Pending Transactions
          </h2>
          {loadingTransactions ? (
            <div className="text-text-light dark:text-text-dark">
              Loading transactions...
            </div>
          ) : pendingTransactions.length === 0 ? (
            <div className="px-6 py-3 rounded-lg border border-border-light dark:border-border-dark text-text-light dark:text-text-dark font-body">
              No pending transactions.
            </div>
          ) : (
            <div className="rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
              <table className="w-full text-left text-text-light dark:text-text-dark font-body">
                <thead>
                  <tr className="bg-backgroundSCD-light dark:bg-backgroundSCD-dark">
                    <th className="px-4 py-2">Cafe</th>
                    <th className="px-4 py-2">Book</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingTransactions.map((transaction) => (
                    <tr
                      key={transaction.transaction_id}
                      className="border-t border-border-light dark:border-border-dark hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <td className="px-4 py-2">{transaction.cafe_id.name}</td>
                      <td className="px-4 py-2">{transaction.book_id.name}</td>
                      <td className="px-4 py-2">
                        {transaction.status === "pickup_pending"
                          ? "Pickup Pending"
                          : "Drop-off Pending"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => toggleQR(transaction.transaction_id)}
                          className="px-4 py-1 text-primary-light dark:text-primary-dark rounded-full border border-primary-light dark:border-primary-dark hover:bg-primary-light dark:hover:bg-primary-dark transition-colors font-button"
                        >
                          {showQR[transaction.transaction_id]
                            ? "Hide QR"
                            : "Show QR"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {Object.keys(showQR).some((key) => showQR[key]) && (
          <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
            onClick={() => setShowQR({})}
          >
            {pendingTransactions.map((transaction) => {
              const qrData = `${transaction.transaction_id}.${user.user_id}`;
              return showQR[transaction.transaction_id] ? (
                <div
                  key={transaction.transaction_id}
                  className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col items-center relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => toggleQR(transaction.transaction_id)}
                    className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                  <h3 className="text-lg font-bold mb-4 text-text-light dark:text-text-dark">
                    QR Code for {transaction.book_id.name}
                  </h3>
                  <QRCodeGenerator
                    bookName={transaction.book_id.name}
                    bookId={qrData}
                  />
                </div>
              ) : null;
            })}
          </div>
        )}
        <div className="flex justify-center mt-8 space-x-4">
          <button
            onClick={() => setShowConfirmCancel(true)}
            disabled={
              !user.subscription_type ||
              user.subscription_type === "basic" ||
              new Date(user.subscription_validity) < new Date()
            }
            className={`px-6 py-3 rounded-full font-button transition-colors ${
              !user.subscription_type ||
              user.subscription_type === "basic" ||
              new Date(user.subscription_validity) < new Date()
                ? "bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 cursor-not-allowed"
                : "bg-warning-light dark:bg-warning-dark text-text-light dark:text-text-dark hover:bg-warning-dark dark:hover:bg-warning-light"
            }`}
          >
            Cancel Subscription
          </button>
          <a
            href="/auth/logout"
            className="px-6 py-3 text-text-light dark:text-text-dark border border-warning-light dark:border-warning-dark rounded-full hover:bg-warning-light dark:hover:bg-warning-dark transition-colors font-button"
          >
            Log Out
          </a>
        </div>
        {showConfirmCancel && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg text-center">
              <p className="mb-4 text-lg text-text-light dark:text-text-dark">
                Are you sure you want to cancel your subscription? This action
                cannot be undone.
              </p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={handleCancelSubscription}
                  className="px-4 py-2 bg-warning-light dark:bg-warning-dark text-text-light dark:text-text-dark rounded-full hover:bg-warning-dark dark:hover:bg-warning-light transition-colors font-button"
                >
                  Yes, Cancel
                </button>
                <button
                  onClick={() => setShowConfirmCancel(false)}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors font-button"
                >
                  No, Go Back
                </button>
              </div>
            </div>
          </div>
        )}
        {showConfirmCancelPickup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg text-center">
              <p className="mb-4 text-lg text-text-light dark:text-text-dark">
                Are you sure you want to cancel your pickup request for {currentBook ? currentBook.name : 'the selected book'}? This action cannot be undone.
              </p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={handleCancelPickup}
                  className="px-4 py-2 bg-warning-light dark:bg-warning-dark text-text-light dark:text-text-dark rounded-full hover:bg-warning-dark dark:hover:bg-warning-light transition-colors font-button"
                >
                  Yes, Cancel
                </button>
                <button
                  onClick={() => setShowConfirmCancelPickup(false)}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors font-button"
                >
                  No, Go Back
                </button>
              </div>
            </div>
          </div>
        )}
        {(userError || error) && (
          <div className="fixed bottom-4 right-4 bg-warning-light dark:bg-warning-dark text-text-light dark:text-text-dark p-3 rounded-lg font-body">
            {userError || error}
          </div>
        )}
      </div>
      <ThemeToggle />
    </div>
  );
}

export default MainComponent;