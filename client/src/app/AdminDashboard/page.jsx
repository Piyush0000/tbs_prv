"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../Hooks/useAuth";
import BooksSection from "./BooksSection";
import CafesSection from "./CafesSection";
import TransactionsSection from "./TransactionsSection";
import UsersSection from "./UsersSection";

function AdminDashboard() {
  const { refreshToken } = useAuth();
  const [books, setBooks] = useState([]);
  const [cafes, setCafes] = useState([]);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState("books");
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editItemId, setEditItemId] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(null);

  const modalScrollRef = useRef(null);
  const modalIsDown = useRef(false);
  const modalStartX = useRef(0);
  const modalScrollLeft = useRef(0);

  // Enhanced fetch function with better error handling
  const safeFetch = async (url, options = {}, abortSignal = null) => {
    try {
      console.log(`Making request to: ${url}`);
      console.log(`Request options:`, options);
      
      const response = await fetch(url, {
        ...options,
        signal: abortSignal,
      });
      
      console.log(`Response status: ${response.status}`);
      console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));
      
      // Check content type before trying to parse JSON
      const contentType = response.headers.get('content-type');
      console.log(`Content-Type: ${contentType}`);
      
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.log(`Non-JSON response received:`, textResponse.substring(0, 200));
        throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}. This usually means the API endpoint doesn't exist or there's a server error.`);
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error (${response.status}): ${errorData.error || errorData.message || response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error;
      }
      console.error(`Fetch error for ${url}:`, error);
      throw error;
    }
  };

  // Fetch data on mount with enhanced error handling
  useEffect(() => {
    const abortController = new AbortController();
    
    const fetchData = async () => {
      if (loading) return;
      setLoading(true);
      setError(null);
      setDebugInfo(null);
      
      try {
        // Check if API URL is set
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        console.log('API URL:', apiUrl);
        
        if (!apiUrl) {
          throw new Error('NEXT_PUBLIC_API_URL environment variable is not set');
        }
        
        setDebugInfo(`Using API URL: ${apiUrl}`);
        
        let token = localStorage.getItem("token");
        if (!token) {
          throw new Error("No authentication token found");
        }

        console.log('Token found, length:', token.length);

        // Step 1: Verify profile and admin access
        console.log('Step 1: Checking profile...');
        const userData = await safeFetch(
          `${apiUrl}/users/profile`,
          {
            headers: { Authorization: `Bearer ${token}` }
          },
          abortController.signal
        );
        
        console.log('Profile data:', userData);
        
        if (userData.role !== "admin") {
          throw new Error("Admin access required. Current role: " + userData.role);
        }

        // Step 2: Fetch books
        console.log('Step 2: Fetching books...');
        try {
          const booksData = await safeFetch(
            `${apiUrl}/admin/inventory`,
            {
              headers: { Authorization: `Bearer ${token}` }
            },
            abortController.signal
          );
          
          const sanitizedBooks = Array.isArray(booksData)
            ? booksData.filter(
                (book) =>
                  book &&
                  typeof book === "object" &&
                  book.id &&
                  book.name &&
                  book.author
              )
            : [];
          setBooks(sanitizedBooks);
          console.log('Books loaded:', sanitizedBooks.length);
        } catch (booksError) {
          console.error('Books fetch failed:', booksError);
          setBooks([]);
        }

        // Step 3: Fetch cafes
        console.log('Step 3: Fetching cafes...');
        try {
          const cafesData = await safeFetch(
            `${apiUrl}/cafes`,
            {
              headers: { Authorization: `Bearer ${token}` }
            },
            abortController.signal
          );
          
          const sanitizedCafes = Array.isArray(cafesData)
            ? cafesData.map((cafe) => ({
                ...cafe,
                cafe_owner_id: cafe.cafe_owner_id || "",
              }))
            : [];
          setCafes(sanitizedCafes);
          console.log('Cafes loaded:', sanitizedCafes.length);
        } catch (cafesError) {
          console.error('Cafes fetch failed:', cafesError);
          setCafes([]);
        }

        // Step 4: Fetch users
        console.log('Step 4: Fetching users...');
        try {
  const usersData = await safeFetch(
    `${apiUrl}/users`,
    {
      headers: { Authorization: `Bearer ${token}` }
    },
    abortController.signal
  );
  setUsers(Array.isArray(usersData) ? usersData : []);
  console.log('Users loaded:', usersData.length);
} catch (usersError) {
  console.error('Users fetch failed:', usersError);
  setUsers([]);
}

        // Step 5: Fetch transactions
        console.log('Step 5: Fetching transactions...');
        try {
          const transactionsData = await safeFetch(
            `${apiUrl}/transactions`,
            {
              headers: { Authorization: `Bearer ${token}` }
            },
            abortController.signal
          );
          
          setTransactions(transactionsData);
          console.log('Transactions loaded:', transactionsData.length);
        } catch (transactionsError) {
          console.error('Transactions fetch failed:', transactionsError);
          setTransactions([]);
        }

      } catch (err) {
        if (err.name === "AbortError") {
          console.log("Fetch aborted");
          return;
        }
        
        console.error("Admin Dashboard Error:", err);
        setError(err.message);
        setDebugInfo(`Error details: ${err.message}`);
        
        // Handle authentication errors
        if (err.message.includes("No authentication token") || 
            err.message.includes("Admin access required") ||
            err.message.includes("401")) {
          localStorage.removeItem("token");
          window.location.href = "/auth/signin";
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      abortController.abort();
    };
  }, []);

  

  // Modal drag handlers
  const handleModalMouseDown = (e) => {
    modalIsDown.current = true;
    modalScrollRef.current.classList.add("dragging");
    modalStartX.current = e.pageX - modalScrollRef.current.offsetLeft;
    modalScrollLeft.current = modalScrollRef.current.scrollLeft;
  };

  const handleModalMouseLeave = () => {
    modalIsDown.current = false;
    modalScrollRef.current.classList.remove("dragging");
  };

  const handleModalMouseUp = () => {
    modalIsDown.current = false;
    modalScrollRef.current.classList.remove("dragging");
  };

  const handleModalMouseMove = (e) => {
    if (!modalIsDown.current) return;
    e.preventDefault();
    const x = e.pageX - modalScrollRef.current.offsetLeft;
    const walk = (x - modalStartX.current) * 2;
    modalScrollRef.current.scrollLeft = modalScrollLeft.current - walk;
  };

  // Get modal fields based on active tab
  const getModalFields = () => {
    if (activeTab === "books") {
      return [
        { name: "id", label: "Book ID", type: "text", readOnly: true },
        { name: "name", label: "Book Name *", type: "text" },
        { name: "author", label: "Author *", type: "text" },
        { name: "language", label: "Language *", type: "text" },
        { name: "publisher", label: "Publisher", type: "text" },
        { name: "genre", label: "Genre", type: "text" },
        { name: "description", label: "Description", type: "textarea" },
        { name: "image_url", label: "Image URL", type: "text" },
        { name: "audio_url", label: "Audio URL", type: "text" },
        { name: "pdf_url", label: "PDF URL", type: "text" },
        { name: "ratings", label: "Ratings (0-5)", type: "number", min: 0, max: 5 },
        { name: "available", label: "Available", type: "checkbox" },
        { name: "is_free", label: "Is Free", type: "checkbox" },
        { name: "keeper_id", label: "Keeper ID", type: "text" },
      ];
    } else if (activeTab === "cafes") {
      return [
        { name: "cafe_id", label: "Cafe ID", type: "text", readOnly: true },
        { name: "name", label: "Cafe Name *", type: "text" },
        { name: "area", label: "Area", type: "text" },
        { name: "city", label: "City", type: "text" },
        { name: "location", label: "Location *", type: "text" },
        { name: "image_url", label: "Image URL", type: "text" },
        { name: "audio_url", label: "Audio URL", type: "text" },
        { name: "gmap_url", label: "Map URL", type: "text" },
        { name: "average_bill", label: "Average Bill", type: "number", min: 0 },
        { name: "discount", label: "Discount", type: "text"},
        { name: "ratings", label: "Ratings (0-5)", type: "number", min: 0, max: 5 },
        { name: "specials", label: "Specials", type: "text" },
        { name: "cafe_owner_id", label: "Cafe Owner ID", type: "text" },
      ];
    } else if (activeTab === "users") {
      return [
        { name: "user_id", label: "User ID", type: "text", readOnly: true },
        { name: "name", label: "User Name *", type: "text" },
        { name: "email", label: "Email *", type: "email" },
        { name: "phone_number", label: "Phone Number *", type: "text" },
        { name: "password", label: `Password${isEditing ? "" : " *"}`, type: "password" },
        { name: "subscription_type", label: "Subscription Type", type: "select", options: ["basic", "standard", "premium"] },
        { name: "role", label: "Role", type: "select", options: ["user", "admin", "cafe"] },
      ];
    }
    return [];
  };

  const getModalTitle = () => {
    if (isEditing) {
      if (activeTab === "books") return "Edit Book";
      if (activeTab === "cafes") return "Edit Cafe";
      if (activeTab === "users") return "Edit User";
    } else {
      if (activeTab === "books") return "Add Book";
      if (activeTab === "cafes") return "Add Cafe";
      if (activeTab === "users") return "Add User";
    }
    return "";
  };

  // Modal handlers
  const openAddModal = () => {
    if (activeTab === "books") {
      setFormValues({
        name: "",
        author: "",
        language: "",
        available: true,
        is_free: false,
        ratings: 0,
      });
    } else if (activeTab === "cafes") {
      setFormValues({
        name: "",
        area: "",
        city: "",
        location: "",
        average_bill: 0,
        discount: "",
        ratings: 0,
        cafe_owner_id: "",
      });
    } else if (activeTab === "users") {
      setFormValues({
        name: "",
        email: "",
        phone_number: "",
        password: "",
        subscription_type: "basic",
        role: "user",
      });
    }
    setIsEditing(false);
    setEditItemId(null);
    setShowModal(true);
    setModalError(null);
  };

  const openEditModal = (item) => {
    setFormValues(item);
    setIsEditing(true);
    setEditItemId(activeTab === "books" ? item.id : activeTab === "cafes" ? item.cafe_id : item.user_id);
    setShowModal(true);
    setModalError(null);
  };

  const closeModal = () => {
    setShowModal(false);
    setIsEditing(false);
    setEditItemId(null);
    setFormValues({});
    setModalError(null);
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportFile(null);
    setImportError(null);
    setImportSuccess(null);
    setImportLoading(false);
  };

  const closeExportModal = () => {
    setShowExportModal(false);
  };

  // Import/Export handlers
  const handleImportClick = () => {
    console.log('Import button clicked!', { activeTab });
    
    if (activeTab !== 'books') {
      alert('CSV import is currently only available for books');
      return;
    }
    
    setShowImportModal(true);
    setImportError(null);
    setImportSuccess(null);
  };

  const handleExportClick = () => {
    console.log('Export button clicked!', { activeTab });
    
    let data = [];
    let filename = '';
    
    switch(activeTab) {
      case 'books':
        data = books;
        filename = 'books_export.csv';
        break;
      case 'cafes':
        data = cafes;
        filename = 'cafes_export.csv';
        break;
      case 'users':
        data = users;
        filename = 'users_export.csv';
        break;
      case 'transactions':
        data = transactions;
        filename = 'transactions_export.csv';
        break;
      default:
        console.log('Unknown activeTab:', activeTab);
        alert('Unknown tab selected');
        return;
    }

    console.log('Export data:', data);

    if (data.length === 0) {
      alert('No data to export');
      return;
    }

    try {
      // Convert data to CSV
      const headers = Object.keys(data[0]);
      console.log('CSV Headers:', headers);
      
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header];
            // Handle values that contain commas or quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
              return `"${String(value).replace(/"/g, '""')}"`;
            }
            return value !== null && value !== undefined ? value : '';
          }).join(',')
        )
      ].join('\n');

      console.log('CSV Content (first 200 chars):', csvContent.substring(0, 200));

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('File download initiated:', filename);
      setShowExportModal(true);
    } catch (error) {
      console.error('Export error:', error);
      alert('Error exporting CSV: ' + error.message);
    }
  };

  const handleFileSelect = (event) => {
    console.log('File selected:', event.target.files[0]);
    const file = event.target.files[0];
    setImportError(null);
    setImportSuccess(null);
    
    if (file) {
      // Check file type
      if (file.type !== 'text/csv' && !file.name.toLowerCase().endsWith('.csv')) {
        setImportError('Please select a valid CSV file');
        setImportFile(null);
        return;
      }
      
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setImportError('File size must be less than 5MB');
        setImportFile(null);
        return;
      }
      
      setImportFile(file);
      console.log('Valid CSV file selected:', file.name, 'Size:', file.size);
    } else {
      setImportFile(null);
    }
  };

  const handleImportCSV = async () => {
    console.log('handleImportCSV called', { importFile, activeTab });
    
    if (!importFile) {
      setImportError('Please select a file first');
      return;
    }

    // Only allow books import
    if (activeTab !== 'books') {
      setImportError('CSV import is currently only available for books');
      return;
    }

    setImportLoading(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      let token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      // Create FormData to send the CSV file
      const formData = new FormData();
      formData.append('csvFile', importFile);

      console.log('Sending CSV file to server for processing...');
      console.log('File details:', {
        name: importFile.name,
        size: importFile.size,
        type: importFile.type
      });

      // Send to the correct endpoint for books only
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/import/csv/books`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          // Don't set Content-Type header - let browser set it for FormData
        },
        body: formData,
      });

      console.log(`Response status: ${response.status}`);

      const contentType = response.headers.get('content-type');
      console.log('Response content type:', contentType);

      if (!response.ok) {
        let errorMessage = `Import failed (${response.status})`;
        
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          
          // Show detailed errors if available
          if (errorData.errors && errorData.errors.length > 0) {
            const errorDetails = errorData.errors.slice(0, 5).map(err => 
              `Row ${err.row}: ${err.error}`
            ).join('\n');
            errorMessage += `\n\nFirst ${Math.min(5, errorData.errors.length)} errors:\n${errorDetails}`;
          }
        } else {
          const textResponse = await response.text();
          console.log('Non-JSON error response:', textResponse);
          errorMessage = `Server error: ${textResponse.substring(0, 200)}`;
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Import result:', result);

      // Handle the response
      const { insertedCount, errorCount, errors, insertedData, totalProcessed } = result;

      // Build success message
      let successMessage = `Successfully processed ${totalProcessed || 0} rows.`;
      if (insertedCount > 0) {
        successMessage += ` ${insertedCount} books imported successfully.`;
      }

      setImportSuccess(successMessage);
      
      // Update local state with imported books if available
      if (insertedData && insertedData.length > 0) {
        setBooks(prev => [...prev, ...insertedData]);
        console.log(`Added ${insertedData.length} books to local state`);
      }
      
      // Show errors if any
      if (errorCount > 0 && errors && errors.length > 0) {
        const errorMessages = errors.slice(0, 5).map(err => 
          `Row ${err.row}: ${err.error}`
        ).join('\n');
        
        const errorText = `${errorCount} errors occurred during import.\n\nFirst ${Math.min(5, errors.length)} errors:\n${errorMessages}`;
        if (insertedCount === 0) {
          setImportError(errorText);
        } else {
          setImportSuccess(prev => `${prev}\n\nWarnings:\n${errorText}`);
        }
      }

      // Clear file input
      const fileInput = document.getElementById('csv-file-input');
      if (fileInput) {
        fileInput.value = '';
      }
      setImportFile(null);

    } catch (error) {
      console.error('Import error:', error);
      setImportError(`Import failed: ${error.message}`);
    } finally {
      setImportLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormValues({
      ...formValues,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleDeleteUser = async (userId) => {
  const confirmed = window.confirm("Are you sure you want to delete this user?");
  if (!confirmed) return;

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to delete user");
    setUsers(users.filter((u) => u.user_id !== userId));
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
};


  const handleFormSubmit = async (e) => {
    e.preventDefault();
    let token = localStorage.getItem("token");
    if (!token) {
      setError("No authentication token found. Please log in.");
      window.location.href = "/auth/signin";
      return;
    }

    try {
      let url;
      let method;
      let requestData;

      if (activeTab === "books") {
        url = isEditing
          ? `${process.env.NEXT_PUBLIC_API_URL}/books/${editItemId}`
          : `${process.env.NEXT_PUBLIC_API_URL}/admin/books`;
        method = isEditing ? "PUT" : "POST";
        requestData = {
          name: formValues.name,
          author: formValues.author,
          language: formValues.language,
          publisher: formValues.publisher || undefined,
          genre: formValues.genre || undefined,
          description: formValues.description || undefined,
          image_url: formValues.image_url || undefined,
          audio_url: formValues.audio_url || undefined,
          pdf_url: formValues.pdf_url || undefined,
          ratings: Number(formValues.ratings) || 0,
          is_free: formValues.is_free || false,
          available: formValues.available !== undefined ? formValues.available : true,
          keeper_id: formValues.keeper_id || undefined,
        };
      } else if (activeTab === "cafes") {
        url = isEditing
          ? `${process.env.NEXT_PUBLIC_API_URL}/cafes/${editItemId}`
          : `${process.env.NEXT_PUBLIC_API_URL}/cafes`;
        method = isEditing ? "PUT" : "POST";
        requestData = {
          name: formValues.name,
          area: formValues.area || undefined,
          city: formValues.city || undefined,
          location: formValues.location,
          image_url: formValues.image_url || undefined,
          audio_url: formValues.audio_url || undefined,
          gmap_url: formValues.gmap_url || undefined,
          average_bill: Number(formValues.average_bill) || 0,
          discount: formValues.discount || undefined,
          ratings: Number(formValues.ratings) || 0,
          specials: formValues.specials || undefined,
          cafe_owner_id: formValues.cafe_owner_id || undefined,
        };
      } else if (activeTab === "users") {
        url = isEditing
          ? `${process.env.NEXT_PUBLIC_API_URL}/users/${editItemId}`
          : `${process.env.NEXT_PUBLIC_API_URL}/users`;
        method = isEditing ? "PUT" : "POST";
        requestData = {
          name: formValues.name,
          email: formValues.email,
          phone_number: formValues.phone_number,
          password: formValues.password || undefined,
          subscription_type: formValues.subscription_type || "basic",
          role: formValues.role || "user",
        };
      }

      const responseData = await safeFetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestData),
      });

      if (isEditing) {
        if (activeTab === "books") {
          setBooks(
            books.map((book) =>
              book.id === editItemId ? { ...book, ...responseData.book } : book
            )
          );
        } else if (activeTab === "cafes") {
          setCafes(
            cafes.map((cafe) =>
              cafe.cafe_id === editItemId ? responseData.cafe : cafe
            )
          );
        } else if (activeTab === "users") {
          setUsers(
            users.map((user) =>
              user.user_id === editItemId ? responseData.user : user
            )
          );
        }
      } else {
        if (activeTab === "books") {
          setBooks([...books, responseData.book]);
        } else if (activeTab === "cafes") {
          setCafes([...cafes, responseData.cafe]);
        } else if (activeTab === "users") {
          setUsers([...users, responseData.user]);
        }
      }
      closeModal();
      setModalError(null);
    } catch (err) {
      console.error("Error in handleFormSubmit:", err);
      setModalError(err.message);
      if (err.message === "Failed to refresh token") {
        setError(err.message);
        localStorage.removeItem("token");
        window.location.href = "/auth/signin";
      }
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-800 mb-4">Error Loading Admin Dashboard</h2>
            <p className="text-red-700 mb-4">{error}</p>
            {debugInfo && (
              <div className="bg-gray-100 p-3 rounded text-sm text-gray-600 mb-4">
                <strong>Debug Info:</strong> {debugInfo}
              </div>
            )}
            <div className="space-y-2 text-sm text-red-600">
              <p><strong>Common causes:</strong></p>
              <ul className="list-disc ml-5 space-y-1">
                <li>API server is not running</li>
                <li>Wrong API URL in environment variables</li>
                <li>API endpoints don't exist</li>
                <li>CORS issues</li>
                <li>Authentication token expired</li>
              </ul>
            </div>
            <div className="mt-6 space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem("token");
                  window.location.href = "/auth/signin";
                }}
                className="px-4 py-2 border border-red-600 text-red-600 rounded hover:bg-red-50"
              >
                Sign In Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading Admin Dashboard...</div>
          {debugInfo && (
            <div className="mt-4 text-sm text-gray-500 max-w-md">
              {debugInfo}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex space-x-4">
            {["books", "cafes", "users", "transactions"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg font-medium ${
                  activeTab === tab
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex items-center space-x-3">
            {/* Import/Export Buttons */}
            <button
              onClick={handleImportClick}
              className="px-4 py-2 rounded-full bg-purple-600 text-white font-medium hover:bg-purple-700 flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              <span>Import CSV</span>
            </button>
            <button
              onClick={handleExportClick}
              className="px-4 py-2 rounded-full bg-indigo-600 text-white font-medium hover:bg-indigo-700 flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span>Export CSV</span>
            </button>
            {/* Add Button */}
            {activeTab !== "transactions" && (
              <button
                onClick={openAddModal}
                className="px-4 py-2 rounded-full bg-green-600 text-white font-medium hover:bg-green-700"
              >
                {activeTab === "books" ? "Add Book" : activeTab === "cafes" ? "Add Cafe" : "Add User"}
              </button>
            )}
          </div>
        </div>

        {activeTab === "books" && (
          <BooksSection data={books} setData={setBooks} onEdit={openEditModal} />
        )}
        {activeTab === "cafes" && (
          <CafesSection data={cafes} setData={setCafes} onEdit={openEditModal} />
        )}
        {activeTab === "users" && (
          <UsersSection
  data={users}
  onEdit={openEditModal}
  onDelete={handleDeleteUser}
/>

        )}
        {activeTab === "transactions" && (
          <TransactionsSection data={transactions} setData={setTransactions} />
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeImportModal();
            }
          }}
        >
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-auto">
            <h2 className="text-2xl font-bold mb-4">Import Books from CSV</h2>
            
            {importError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-red-700 text-sm whitespace-pre-line">{importError}</p>
              </div>
            )}
            
            {importSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <p className="text-green-700 text-sm whitespace-pre-line">{importSuccess}</p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select CSV File
              </label>
              <input
                id="csv-file-input"
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {importFile && (
                <p className="text-sm text-green-600 mt-1">Selected: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</p>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <h4 className="font-medium text-sm text-gray-700 mb-2">CSV Format Requirements for Books:</h4>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• <strong>Required columns:</strong> name, author, language</li>
                <li>• <strong>Optional columns:</strong> publisher, genre, description, image_url, audio_url, pdf_url, ratings, is_free, available, keeper_id</li>
                <li>• First row must contain column headers</li>
                <li>• Use commas as separators</li>
                <li>• Boolean fields (is_free, available): use true/false, 1/0, yes/no, or y/n</li>
                <li>• Ratings: number between 0-5</li>
                <li>• File size limit: 5MB</li>
              </ul>
            </div>

            <div className="bg-blue-50 rounded-lg p-3 mb-4">
              <h4 className="font-medium text-sm text-blue-700 mb-2">Example CSV format:</h4>
              <pre className="text-xs text-blue-600 font-mono overflow-x-auto">
{`name,author,language,publisher,genre,ratings,is_free,available
"The Great Gatsby","F. Scott Fitzgerald","English","Scribner","Fiction",4.5,false,true
"1984","George Orwell","English","Secker & Warburg","Dystopian",4.8,false,true`}
              </pre>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={closeImportModal}
                disabled={importLoading}
                className="px-4 py-2 rounded-lg border text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImportCSV}
                disabled={!importFile || importLoading}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {importLoading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                <span>{importLoading ? 'Importing...' : 'Import Books'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeExportModal();
            }
          }}
        >
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Export {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} to CSV</h2>
            
            <div className="mb-6">
              <p className="text-gray-600 mb-2">
                CSV file has been downloaded successfully! You can now open it in Excel or other spreadsheet applications.
              </p>
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-sm text-green-700">
                  <strong>Records exported:</strong> {
                    activeTab === 'books' ? books.length :
                    activeTab === 'cafes' ? cafes.length :
                    activeTab === 'users' ? users.length :
                    transactions.length
                  } items
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={closeExportModal}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[80vh] overflow-hidden">
            <h2 className="text-2xl font-bold mb-4">{getModalTitle()}</h2>
            {modalError && <div className="text-red-600 mb-4">{modalError}</div>}
            <div
              className="overflow-auto cursor-grab"
              ref={modalScrollRef}
              onMouseDown={handleModalMouseDown}
              onMouseLeave={handleModalMouseLeave}
              onMouseUp={handleModalMouseUp}
              onMouseMove={handleModalMouseMove}
              style={{ maxHeight: "60vh" }}
            >
              <form onSubmit={handleFormSubmit}>
                {getModalFields().map((field) => (
                  <div className="mb-4" key={field.name}>
                    {field.type === "checkbox" ? (
                      <div className="flex items-center space-x-2">
                        <input
                          id={field.name}
                          name={field.name}
                          type={field.type}
                          onChange={handleInputChange}
                          className="w-6 h-6"
                          checked={formValues[field.name] || false}
                        />
                        <label className="font-medium" htmlFor={field.name}>
                          {field.label}
                        </label>
                      </div>
                    ) : field.type === "select" ? (
                      <>
                        <label className="block mb-1 font-medium" htmlFor={field.name}>
                          {field.label}
                        </label>
                        <select
                          id={field.name}
                          name={field.name}
                          value={formValues[field.name] || ""}
                          onChange={handleInputChange}
                          className="w-full border px-3 py-2 rounded-lg"
                          required={field.label.includes("*")}
                        >
                          {field.options.map((option, idx) => (
                            <option key={idx} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : field.type === "textarea" ? (
                      <>
                        <label className="block mb-1 font-medium" htmlFor={field.name}>
                          {field.label}
                        </label>
                        <textarea
                          id={field.name}
                          name={field.name}
                          value={formValues[field.name] || ""}
                          onChange={handleInputChange}
                          className="w-full border px-3 py-2 rounded-lg"
                          required={field.label.includes("*")}
                        />
                      </>
                    ) : (
                      <>
                        <label className="block mb-1 font-medium" htmlFor={field.name}>
                          {field.label}
                        </label>
                        <input
                          id={field.name}
                          name={field.name}
                          type={field.type}
                          value={formValues[field.name] || ""}
                          onChange={field.readOnly ? undefined : handleInputChange}
                          className={`w-full border px-3 py-2 rounded-lg ${
                            field.readOnly ? "bg-gray-100 cursor-not-allowed" : ""
                          }`}
                          required={field.label.includes("*")}
                          min={field.min}
                          max={field.max}
                          readOnly={field.readOnly}
                        />
                      </>
                    )}
                  </div>
                ))}
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 rounded-lg border text-gray-600 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {isEditing ? "Update" : "Submit"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .dragging {
          user-select: none;
        }
      `}</style>
    </div>
  );
}

export default AdminDashboard;