"use client";
import Link from "next/link";
import { useState } from "react";
import ThemeToggle from "../../../components/ThemeToggle";
import { auth, googleProvider, createUserWithEmailAndPassword } from "../../../lib/firebase";
import { signInWithPopup } from "firebase/auth";

function MainComponent() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone_number: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [emailPhoneNumber, setEmailPhoneNumber] = useState("");
  const [emailTempData, setEmailTempData] = useState(null);
  const [googlePhoneNumber, setGooglePhoneNumber] = useState("");
  const [googleTempData, setGoogleTempData] = useState(null);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const validateForm = () => {
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      return "Please fill in all required fields";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      return "Invalid email format";
    }
    if (formData.password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[!@#$%^&*]/.test(formData.password)) {
      return "Password must contain at least one special character";
    }
    if (formData.password !== formData.confirmPassword) {
      return "Passwords do not match";
    }
    return null;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    try {
      // Create user with Firebase
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const idToken = await userCredential.user.getIdToken();

      // Call backend to check if phone number is required
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          name: formData.name,
          email: formData.email.toLowerCase(),
        }),
      });
      const data = await res.json();
      console.log('Email signup response:', data); // Debug log
      if (!res.ok) throw new Error(data.message || 'Registration failed');

      // Check if phone number is required
      if (data.message.includes("Requires phone number")) {
        setEmailTempData({
          tempToken: data.tempToken,
          name: formData.name,
          email: formData.email.toLowerCase(),
        });
        setShowPhoneModal(true);
      } else {
        // Existing user or no phone number required
        localStorage.setItem('token', data.token);
        window.location.href = '/';
      }
    } catch (err) {
      console.error('Email signup error:', err.message); // Debug log
      setError(err.message || 'Failed to sign up');
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          name: result.user.displayName,
          email: result.user.email,
        }),
      });
      const data = await res.json();
      console.log('Google Sign-In response:', data); // Debug log
      if (!res.ok) throw new Error(data.message || 'Google Sign-In failed');
      
      // Check if user needs to provide phone number
      if (data.message.includes("Requires phone number")) {
        // Store temporary token and show phone number modal
        setGoogleTempData({ tempToken: data.tempToken, name: result.user.displayName, email: result.user.email });
        setShowPhoneModal(true);
      } else {
        // Existing user with phone number, proceed with login
        localStorage.setItem('token', data.token);
        window.location.href = '/';
      }
    } catch (err) {
      console.error('Google Sign-In error:', err.message); // Debug log
      setError(err.message);
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const phoneNumber = emailTempData ? emailPhoneNumber : googlePhoneNumber;
    const tempData = emailTempData || googleTempData;
    const endpoint = emailTempData ? '/auth/email-signup/complete' : '/auth/google/complete';

    // Validate phone number
    if (!/^\d{10}$/.test(phoneNumber)) {
      setError("Phone number must be 10 digits");
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tempToken: tempData.tempToken,
          phone_number: phoneNumber,
        }),
      });
      const data = await res.json();
      console.log('Phone submission response:', data); // Debug log
      if (!res.ok) throw new Error(data.message || 'Failed to complete registration');
      
      // Registration completed successfully, store token and redirect
      localStorage.setItem('token', data.token);
      setShowPhoneModal(false);
      window.location.href = '/';
    } catch (err) {
      console.error('Phone submission error:', err.message); // Debug log
      setError(err.message);
    }
  };

  const togglePasswordVisibility = (field) => {
    if (field === "password") {
      setPasswordVisible(!passwordVisible);
    } else if (field === "confirmPassword") {
      setConfirmPasswordVisible(!confirmPasswordVisible);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background-light dark:bg-background-dark p-4">
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <h1 className="mb-8 text-center text-3xl font-bold text-text-light dark:text-text-dark">
            Create Account
          </h1>

          <form onSubmit={onSubmit} className="space-y-6">
            <div>
              <input
                type="text"
                name="name"
                placeholder="Full Name"
                onChange={handleInputChange}
                className="w-full rounded-full border border-border-light dark:border-border-dark px-4 py-3 text-text-light dark:text-text-light focus:border-primary-light dark:focus:border-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-light dark:focus:ring-primary-dark focus:ring-offset-2 transition-colors"
              />
            </div>
            <div>
              <input
                type="email"
                name="email"
                placeholder="Email"
                onChange={handleInputChange}
                className="w-full rounded-full border border-border-light dark:border-border-dark px-4 py-3 text-text-light dark:text-text-light focus:border-primary-light dark:focus:border-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-light dark:focus:ring-primary-dark focus:ring-offset-2 transition-colors"
              />
            </div>
            <div className="relative">
              <input
                type={passwordVisible ? "text" : "password"}
                name="password"
                placeholder="Password"
                onChange={handleInputChange}
                className="w-full rounded-full border border-border-light dark:border-border-dark px-4 py-3 text-text-light dark:text-text-light focus:border-primary-light dark:focus:border-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-light dark:focus:ring-primary-dark focus:ring-offset-2 transition-colors"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility("password")}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-text-light dark:text-text-dark"
              >
                {passwordVisible ? "🙈" : "👁️"}
              </button>
            </div>
            <div className="relative">
              <input
                type={confirmPasswordVisible ? "text" : "password"}
                name="confirmPassword"
                placeholder="Confirm Password"
                onChange={handleInputChange}
                className="w-full rounded-full border border-border-light dark:border-border-dark px-4 py-3 text-text-light dark:text-text-light focus:border-primary-light dark:focus:border-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-light dark:focus:ring-primary-dark focus:ring-offset-2 transition-colors"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility("confirmPassword")}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-text-light dark:text-text-dark"
              >
                {confirmPasswordVisible ? "🙈" : "👁️"}
              </button>
            </div>
            {error && (
              <div className="rounded-full bg-warning-light dark:bg-warning-dark p-3 text-sm text-warning-light dark:text-warning-dark">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-primary-light dark:bg-primary-dark px-4 py-3 text-base font-medium text-text-light dark:text-text-dark transition-colors hover:bg-primary-light dark:hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-light dark:focus:ring-primary-dark focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Sign up"}
            </button>
          </form>
          <div className="my-8 flex items-center">
            <div className="flex-1 border-t border-border-light dark:border-border-dark"></div>
            <span className="px-4 text-text-light dark:text-text-dark text-sm">Or</span>
            <div className="flex-1 border-t border-border-light dark:border-border-dark"></div>
          </div>
          <div className="space-y-4">
            <button
              onClick={handleGoogleSignIn}
              className="w-full rounded-full border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 py-3 text-base font-medium text-text-light dark:text-text-dark transition-colors hover:bg-backgroundSCD-light dark:hover:bg-backgroundSCD-dark focus:outline-none focus:ring-2 focus:ring-primary-light dark:focus:ring-primary-dark focus:ring-offset-2"
            >
              <i className="fab fa-google mr-2"></i>
              Continue with Google
            </button>
            <button className="w-full rounded-full border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 py-3 text-base font-medium text-text-light dark:text-text-dark transition-colors hover:bg-backgroundSCD-light dark:hover:bg-backgroundSCD-dark focus:outline-none focus:ring-2 focus:ring-primary-light dark:focus:ring-primary-dark focus:ring-offset-2">
              <i className="fab fa-apple mr-2"></i>
              Continue with Apple
            </button>
          </div>
          <p className="mt-8 text-center text-sm text-text-light dark:text-text-dark">
            Already have an account?{" "}
            <Link href="/auth/signin" className="font-medium text-primary-light dark:text-primary-dark hover:text-primary-dark">
              Sign in
            </Link>
          </p>
        </div>
      </div>
      <div className="hidden lg:flex w-1/2 items-center justify-center bg-background-light dark:bg-background-dark p-12">
        <div className="relative">
          <img
            src="/Graphic 1.png"
            alt="Person reading a book with floating elements"
            className="w-full max-w-lg"
          />
        </div>
      </div>
      <ThemeToggle />

      {/* Phone Number Modal */}
      {showPhoneModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-background-light dark:bg-background-dark p-6 rounded-lg max-w-md w-full">
            <h2 className="text-xl font-bold text-text-light dark:text-text-dark mb-4">
              Enter Your Phone Number
            </h2>
            <p className="text-sm text-text-light dark:text-text-dark mb-4">
              A valid phone number is required to complete your registration.
            </p>
            <form onSubmit={handlePhoneSubmit}>
              <input
                type="tel"
                value={emailTempData ? emailPhoneNumber : googlePhoneNumber}
                onChange={(e) => (emailTempData ? setEmailPhoneNumber(e.target.value) : setGooglePhoneNumber(e.target.value))}
                placeholder="Phone Number (10 digits)"
                className="w-full rounded-full border border-border-light dark:border-border-dark px-4 py-3 text-text-light dark:text-text-light focus:border-primary-light dark:focus:border-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-light dark:focus:ring-primary-dark focus:ring-offset-2 transition-colors mb-4"
              />
              {error && (
                <div className="rounded-full bg-warning-light dark:bg-warning-dark p-3 text-sm text-warning-light dark:text-warning-dark mb-4">
                  {error}
                </div>
              )}
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowPhoneModal(false)}
                  className="rounded-full border border-border-light dark:border-border-dark px-4 py-2 text-text-light dark:text-text-dark"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-primary-light dark:bg-primary-dark px-4 py-2 text-text-light dark:text-text-dark"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MainComponent;