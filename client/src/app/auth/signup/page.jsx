"use client";

import { useState } from "react";

function SignUpPage() {
  const [step, setStep] = useState('details');
  const [formData, setFormData] = useState({
    name: "",
    phone_number: "",
    email: "",
    password: "",
  });
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Client-side validation
  const validateForm = () => {
    if (!formData.name.trim()) {
      setError("Full name is required");
      return false;
    }
    if (!/^\d{10}$/.test(formData.phone_number)) {
      setError("Phone number must be exactly 10 digits");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError("Please enter a valid email address");
      return false;
    }
    if (formData.password.length < 8 || !/[!@#$%^&*]/.test(formData.password)) {
      setError("Password must be 8+ characters with at least one special character");
      return false;
    }
    return true;
  };

  // Start countdown timer for resend OTP
  const startResendTimer = () => {
    setCanResend(false);
    setCountdown(60);
    
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Step 1: Submit user details
  const handleDetailsSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    // Validate form
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          phone_number: formData.phone_number.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `Server error: ${response.status}`);
      }
      
      setMessage(data.message || 'OTP sent successfully!');
      setStep('otp');
      startResendTimer();
      
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    // Validate OTP
    const cleanOtp = otp.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/signup/verify`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          email: formData.email.trim().toLowerCase(), 
          otp: cleanOtp 
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `Verification failed: ${response.status}`);
      }

      // Store token if provided
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      }

      setMessage("Account verified successfully! Redirecting...");
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);

    } catch (err) {
      console.error('OTP verification error:', err);
      setError(err.message || 'OTP verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    setResendLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/resend-otp`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          email: formData.email.trim().toLowerCase() 
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to resend OTP');
      }

      setMessage(data.message || "New OTP sent to your email");
      setOtp("");
      startResendTimer();
      
    } catch (err) {
      console.error('Resend OTP error:', err);
      setError(err.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md">
        
        {/* Form for User Details */}
        {step === 'details' && (
          <>
            <h1 className="mb-6 text-center text-3xl font-bold text-gray-800">Create Your Account</h1>
            <form onSubmit={handleDetailsSubmit} className="space-y-4">
              <input 
                type="text" 
                name="name" 
                placeholder="Full Name" 
                value={formData.name}
                onChange={handleInputChange} 
                required 
                className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none" 
              />
              <input 
                type="tel" 
                name="phone_number" 
                placeholder="Phone Number (10 digits)" 
                value={formData.phone_number}
                onChange={(e) => {
                  // Only allow numbers
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 10) {
                    setFormData({ ...formData, phone_number: value });
                  }
                }}
                required 
                className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none" 
              />
              <input 
                type="email" 
                name="email" 
                placeholder="Email" 
                value={formData.email}
                onChange={handleInputChange} 
                required 
                className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none" 
              />
              <input 
                type="password" 
                name="password" 
                placeholder="Password (8+ chars with special character)" 
                value={formData.password}
                onChange={handleInputChange} 
                required 
                className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none" 
              />
              
              {error && (
                <div className="bg-red-100 border border-red-300 p-3 text-sm text-red-700 rounded-md">
                  {error}
                </div>
              )}
              
              {message && (
                <div className="bg-green-100 border border-green-300 p-3 text-sm text-green-700 rounded-md">
                  {message}
                </div>
              )}
              
              <button 
                type="submit"
                disabled={loading} 
                className="w-full rounded-md bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Processing..." : "Continue"}
              </button>
            </form>
          </>
        )}

        {/* Form for OTP Verification */}
        {step === 'otp' && (
          <>
            <h1 className="mb-4 text-center text-3xl font-bold text-gray-800">Verify Your Email</h1>
            {message && (
              <p className="text-center text-green-600 mb-4 bg-green-50 p-3 rounded-md">
                {message}
              </p>
            )}
            <p className="text-center text-gray-600 mb-4">
              Enter the 6-digit code sent to<br />
              <strong>{formData.email}</strong>
            </p>
            
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <input 
                type="text" 
                value={otp} 
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setOtp(value);
                }} 
                placeholder="000000" 
                maxLength="6" 
                required 
                className="w-full text-center text-xl tracking-widest rounded-md border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none font-mono" 
              />
              
              {error && (
                <div className="bg-red-100 border border-red-300 p-3 text-sm text-red-700 rounded-md">
                  {error}
                </div>
              )}
              
              <button 
                type="submit"
                disabled={loading || otp.length !== 6} 
                className="w-full rounded-md bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Verifying..." : "Verify & Sign In"}
              </button>
            </form>

            {/* Resend OTP Section */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600 mb-2">Didn't receive the code?</p>
              {canResend ? (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendLoading}
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendLoading ? "Sending..." : "Resend OTP"}
                </button>
              ) : (
                <p className="text-sm text-gray-500">
                  Resend available in {countdown} seconds
                </p>
              )}
            </div>

            {/* Go back button */}
            <button
              type="button"
              onClick={() => {
                setStep('details');
                setOtp('');
                setError(null);
                setMessage(null);
                setCanResend(false);
                setCountdown(0);
              }}
              className="mt-4 w-full text-center text-sm text-gray-600 hover:text-gray-800"
            >
              ← Change email address
            </button>
          </>
        )}

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => window.location.href = '/auth/signin'}
            className="font-medium text-blue-600 hover:underline"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}

export default SignUpPage;