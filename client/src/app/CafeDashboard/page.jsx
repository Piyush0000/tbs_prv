"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../Hooks/useAuth";
import QRScanner from "../scanner/page";

function CafeDashboard() {
  const { user, setUser, refreshToken } = useAuth();
  const [cafeDetails, setCafeDetails] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [error, setError] = useState(null);

  const [editForm, setEditForm] = useState({ name: "", discount: "" });
  const [isEditing, setIsEditing] = useState(false);

  const hasFetchedUserAndCafe = useRef(false);
  const isProcessingScan = useRef(false);

  const fetchUserAndCafeData = useCallback(async () => {
    let token = localStorage.getItem("token");
    if (!token) {
      setError("No authentication token found. Please log in.");
      window.location.href = "/auth/signin";
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      let userData = user;
      if (!userData) {
        console.log("Fetching user profile...");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          token = await refreshToken();
          if (!token) {
            setError("Failed to refresh token. Please log in again.");
            window.location.href = "/auth/signin";
            setLoading(false);
            return;
          }
          localStorage.setItem("token", token);
          const retryRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!retryRes.ok) throw new Error("Failed to fetch user profile after token refresh");
          userData = await retryRes.json();
        } else {
          if (!res.ok) throw new Error("Failed to fetch user profile");
          userData = await res.json();
        }
        console.log("User profile fetched:", userData);
        setUser(userData);
      }

      if (userData.role !== "cafe") {
        setError("Access denied. Cafe owner role required.");
        setLoading(false);
        return;
      }

      console.log("Fetching cafe details for cafe_owner_id:", userData.user_id);
      const cafeRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cafes?cafe_owner_id=${userData.user_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (cafeRes.status === 401) {
        token = await refreshToken();
        if (!token) {
          setError("Failed to refresh token. Please log in again.");
          window.location.href = "/auth/signin";
          setLoading(false);
          return;
        }
        localStorage.setItem("token", token);
        const retryCafeRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cafes?cafe_owner_id=${userData.user_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!retryCafeRes.ok) {
          const errorData = await retryCafeRes.json();
          throw new Error(`Failed to fetch cafe details after token refresh: ${errorData.error || retryCafeRes.statusText}`);
        }
        const cafes = await retryCafeRes.json();
        if (cafes.length === 0) {
          setError("No cafe assigned to this owner.");
          setLoading(false);
          return;
        }
        const cafe = cafes[0];
        setCafeDetails(cafe);
        setEditForm({ name: cafe.name, discount: cafe.discount });
      } else {
        if (!cafeRes.ok) {
          const errorData = await cafeRes.json();
          throw new Error(`Failed to fetch cafe details: ${errorData.error || cafeRes.statusText}`);
        }
        const cafes = await cafeRes.json();
        if (cafes.length === 0) {
          setError("No cafe assigned to this owner.");
          setLoading(false);
          return;
        }
        const cafe = cafes[0];
        setCafeDetails(cafe);
        setEditForm({ name: cafe.name, discount: cafe.discount });
      }
    } catch (err) {
      console.error("Error in fetchUserAndCafeData:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, setUser, refreshToken]);

  useEffect(() => {
    if (hasFetchedUserAndCafe.current) return;
    hasFetchedUserAndCafe.current = true;
    fetchUserAndCafeData();
  }, [fetchUserAndCafeData]);

  const fetchTransactions = useCallback(async () => {
    if (!cafeDetails || error || loadingTransactions) return;
    let token = localStorage.getItem("token");
    try {
      setLoadingTransactions(true);
      console.log("Fetching transactions for cafe_id:", cafeDetails.cafe_id);
      const txRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cafe/${cafeDetails.cafe_id}/requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (txRes.status === 401) {
        token = await refreshToken();
        if (!token) {
          setError("Failed to refresh token. Please log in again.");
          window.location.href = "/auth/signin";
          setLoadingTransactions(false);
          return;
        }
        localStorage.setItem("token", token);
        const retryTxRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cafe/${cafeDetails.cafe_id}/requests`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!retryTxRes.ok) {
          const errorData = await retryTxRes.json();
          throw new Error(`Failed to fetch transactions after token refresh: ${errorData.error || retryTxRes.statusText}`);
        }
        const txData = await retryTxRes.json();
        setTransactions(txData);
      } else {
        if (!txRes.ok) {
          const errorData = await txRes.json();
          throw new Error(`Failed to fetch transactions: ${errorData.error || txRes.statusText}`);
        }
        const txData = await txRes.json();
        setTransactions(txData);
      }
    } catch (err) {
      console.error("Error in fetchTransactions:", err.message);
      setError(err.message);
    } finally {
      setLoadingTransactions(false);
    }
  }, [cafeDetails, error, refreshToken]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    if (!cafeDetails || error) return;

    const interval = setInterval(() => {
      if (!isProcessingScan.current) {
        fetchTransactions();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchTransactions, cafeDetails, error]);

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm({ ...editForm, [name]: value });
  };

  const handleSave = async () => {
    let token = localStorage.getItem("token");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cafes/${cafeDetails.cafe_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: editForm.name, discount: editForm.discount }),
      });
      if (res.status === 401) {
        token = await refreshToken();
        if (!token) {
          setError("Failed to refresh token. Please log in again.");
          window.location.href = "/auth/signin";
          setLoading(false);
          return;
        }
        localStorage.setItem("token", token);
        const retryRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cafes/${cafeDetails.cafe_id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: editForm.name, discount: editForm.discount }),
        });
        if (!retryRes.ok) throw new Error("Failed to update cafe after token refresh");
        const updatedCafe = await retryRes.json();
        setCafeDetails(updatedCafe.cafe);
        setIsEditing(false);
      } else {
        if (!res.ok) throw new Error("Failed to update cafe");
        const updatedCafe = await res.json();
        setCafeDetails(updatedCafe.cafe);
        setIsEditing(false);
      }
    } catch (err) {
      console.error("Error in handleSave:", err.message);
      setError(err.message);
    }
  };

  const tableRef = useRef(null);
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const handleMouseDown = (e) => {
    isDown.current = true;
    tableRef.current.classList.add("dragging");
    startX.current = e.pageX - tableRef.current.offsetLeft;
    scrollLeft.current = tableRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
    isDown.current = false;
    tableRef.current.classList.remove("dragging");
  };

  const handleMouseUp = () => {
    isDown.current = false;
    tableRef.current.classList.remove("dragging");
  };

  const handleMouseMove = (e) => {
    if (!isDown.current) return;
    e.preventDefault();
    const x = e.pageX - tableRef.current.offsetLeft;
    const walk = (x - startX.current) * 2;
    tableRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannerMessage, setScannerMessage] = useState(null);
  const [scannedCodes, setScannedCodes] = useState({ first: "", second: "" });

  const handleScanned = async ({ firstCode, secondCode }) => {
    if (isProcessingScan.current) return;
    isProcessingScan.current = true;

    setScannedCodes({ first: firstCode, second: secondCode });
    let token = localStorage.getItem("token");

    const parts = firstCode.split(".");
    if (parts.length !== 2) {
      setScannerMessage("Invalid format for first QR code. Expected transaction_id.user_id");
      isProcessingScan.current = false;
      return;
    }
    const scannedTransactionId = parts[0];
    const scannedUserId = parts[1];

    try {
      const verifyRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions/scan/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          transaction_id: scannedTransactionId,
          user_id: scannedUserId,
          book_id: secondCode,
        }),
      });

      if (verifyRes.status === 401) {
        token = await refreshToken();
        if (!token) {
          setError("Failed to refresh token. Please log in again.");
          window.location.href = "/auth/signin";
          isProcessingScan.current = false;
          return;
        }
        localStorage.setItem("token", token);
        const retryVerifyRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions/scan/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            transaction_id: scannedTransactionId,
            user_id: scannedUserId,
            book_id: secondCode,
          }),
        });
        if (!retryVerifyRes.ok) {
          const errorData = await retryVerifyRes.json();
          throw new Error(`Failed to verify QR codes after token refresh: ${errorData.error || retryVerifyRes.statusText}`);
        }
        const verifyData = await retryVerifyRes.json();
        setTransactions((prev) =>
          prev.map((tx) =>
            tx.transaction_id === scannedTransactionId
              ? { ...tx, status: verifyData.transaction.status, processed_at: new Date() }
              : tx
          )
        );
        setScannerMessage(verifyData.message);
      } else if (!verifyRes.ok) {
        const errorData = await verifyRes.json();
        throw new Error(`Failed to verify QR codes: ${errorData.error || verifyRes.statusText}`);
      } else {
        const verifyData = await verifyRes.json();
        setTransactions((prev) =>
          prev.map((tx) =>
            tx.transaction_id === scannedTransactionId
              ? { ...tx, status: verifyData.transaction.status, processed_at: new Date() }
              : tx
          )
        );
        setScannerMessage(verifyData.message);
      }

      await fetchTransactions();
    } catch (err) {
      console.error("Error in handleScanned:", err.message);
      setScannerMessage(`Error: ${err.message}`);
    } finally {
      isProcessingScan.current = false;
      setTimeout(() => {
        setShowScannerModal(false);
        setScannerMessage(null);
        setScannedCodes({ first: "", second: "" });
      }, 1500);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;
  if (!cafeDetails) return <div className="min-h-screen flex items-center justify-center">No cafe data available.</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Cafe Dashboard</h1>
          <button className="px-4 py-2 rounded-full bg-red-600 text-white font-medium hover:bg-red-700">
            <a href="/auth/logout">Log Out</a>
          </button>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">Cafe Details</h2>
          <div className="space-y-2">
            <p><span className="font-semibold">Cafe ID:</span> {cafeDetails.cafe_id}</p>
            <p><span className="font-semibold">Location:</span> {cafeDetails.location}</p>
            <p><span className="font-semibold">Average Bill:</span> ₹{cafeDetails.average_bill}</p>
            <p><span className="font-semibold">Ratings:</span> {cafeDetails.ratings}</p>
            <p><span className="font-semibold">Specials:</span> {cafeDetails.specials || "N/A"}</p>
          </div>
          <div className="mt-6 border-t pt-4">
            <div className="mb-4">
              <label htmlFor="name" className="block mb-1 font-medium">Cafe Name</label>
              <input
                id="name"
                name="name"
                type="text"
                value={editForm.name}
                onChange={handleEditChange}
                disabled={!isEditing}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="discount" className="block mb-1 font-medium">Discount</label>
              <input
                id="discount"
                name="discount"
                type="text"
                value={editForm.discount}
                onChange={handleEditChange}
                disabled={!isEditing}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            {isEditing ? (
              <div className="flex space-x-2">
                <button
                  onClick={handleSave}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-lg border text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700"
              >
                Edit Details
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Pending Transactions</h2>
            <button
              onClick={() => setShowScannerModal(true)}
              className="px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700"
            >
              Approve Transaction
            </button>
          </div>
          <div
            className="overflow-x-auto cursor-grab"
            ref={tableRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
          >
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 whitespace-nowrap">
                  <th className="px-4 py-3 text-left">Transaction ID</th>
                  <th className="px-4 py-3 text-left">Book ID</th>
                  <th className="px-4 py-3 text-left">User ID</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Created At</th>
                </tr>
              </thead>
              <tbody>
                {loadingTransactions ? (
                  <tr>
                    <td className="px-4 py-3 text-center" colSpan="5">Loading transactions...</td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td className="px-4 py-3 text-center" colSpan="5">No pending transactions.</td>
                  </tr>
                ) : (
                  transactions.map((tx, idx) => (
                    <tr key={idx} className="border-t whitespace-nowrap">
                      <td className="px-4 py-3">{tx.transaction_id}</td>
                      <td className="px-4 py-3">{tx.book_id?.book_id || tx.book_id || "N/A"}</td>
                      <td className="px-4 py-3">{tx.user_id?.user_id || tx.user_id || "N/A"}</td>
                      <td className="px-4 py-3">{tx.status.replace("_", " ")}</td>
                      <td className="px-4 py-3">{new Date(tx.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showScannerModal && (
          <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowScannerModal(false);
            }}
          >
            <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-hidden">
              <h2 className="text-2xl font-bold mb-4 text-center">Scan Transaction QR Codes</h2>
              <div className="overflow-auto" style={{ maxHeight: "60vh" }}>
                <QRScanner onScanned={handleScanned} />
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-700"><strong>First QR Code:</strong> {scannedCodes.first}</p>
                <p className="text-sm text-gray-700"><strong>Second QR Code:</strong> {scannedCodes.second}</p>
              </div>
              {scannerMessage && (
                <div className="mt-4 bg-green-50 text-green-700 p-2 rounded-lg text-center">{scannerMessage}</div>
              )}
              <button
                onClick={() => setShowScannerModal(false)}
                className="mt-4 px-4 py-2 block mx-auto rounded-full border text-gray-600 hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        )}

        <style jsx>{`
          .dragging {
            user-select: none;
          }
        `}</style>
      </div>
    </div>
  );
}

export default CafeDashboard;