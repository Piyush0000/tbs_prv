"use client";

import { useState } from "react";
import Link from "next/link";

// --- SVG Icon Components ---

const EyeIcon = ({ visible }) => (
  // Eye icon to toggle password visibility
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400 dark:text-gray-500">
    {visible ? (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243l-4.243-4.243" />
    ) : (
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.432 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    )}
  </svg>
);

const GoogleIcon = () => (
  // Google logo icon
  <svg className="w-5 h-5 mr-3" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.222 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.012 36.49 44 30.638 44 24c0-1.341-.138-2.65-.389-3.917z" />
  </svg>
);

const AppleIcon = () => (
  // Apple logo icon
  <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24">
    <path fill="currentColor" d="M16.213 19.368c-.64.355-1.335.533-2.05.533-1.01 0-2.02-.356-2.92-.958-1.01-.692-1.92-1.82-2.618-3.235-.747-1.503-1.12-3.13-1.12-4.882 0-1.682.39-3.18 1.17-4.49.78-1.31 1.842-2.234 3.12-2.738.64-.267 1.32-.4 2.01-.4.89 0 1.83.298 2.73.828.1.062.15.163.15.314 0 .08-.03.156-.09.228-.61.692-1.25 1.51-1.83 2.42-.3.45-.58.88-.78 1.25-.15.28-.22.56-.22.81 0 .35.13.66.4.92.27.26.58.39.93.39.43 0 .85-.14 1.28-.43.43-.28.84-.61 1.25-1l.48-.46c.11-.11.23-.16.36-.16.14 0 .26.05.36.14.07.1.11.21.11.33 0 .09-.02.18-.06.27-.4.92-.89 1.7-1.46 2.32-.57.62-1.23 1.1-1.98 1.45.1.12.18.24.25.37.07.13.13.25.18.37a.36.36 0 01-.06.39c-.11.11-.25.17-.42.17-.11 0-.23-.03-.35-.08a13.3 13.3 0 01-1.33-.58zM17.43 2.01c2.31 0 4.02 1.72 4.02 4.02 0 .9-.28 1.8-.84 2.7-.56.9-1.29 1.57-2.19 2.02-.89.45-1.8.67-2.72.67-2.31 0-4.02-1.72-4.02-4.02s1.72-4.02 4.02-4.02c.45 0 .9.08 1.34.24.44.16.85.39 1.24.69.1-.17.15-.34.15-.51 0-.28-.08-.52-.25-.71-.17-.19-.4-.28-.7-.28-.23 0-.46.06-.68.18-.22.12-.42.26-.59.43a.4.4 0 01-.48.06c-.14-.06-.21-.18-.21-.35 0-.11.04-.22.12-.33a3.5 3.5 0 012.2-.95z" />
  </svg>
);

const ThemeToggleIcon = () => (
  // Theme toggle icon (can be a sun/moon or gear)
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.438.995s.145.755.438.995l1.003.827c.48.398.668 1.03.26 1.431l-1.296 2.247a1.125 1.125 0 01-1.37.49l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.333.183-.582.495-.645.87l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.063-.374-.313-.686-.645-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.37-.49l-1.296-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.437-.995s-.145-.755-.437-.995l-1.004-.827a1.125 1.125 0 01-.26-1.431l1.296-2.247a1.125 1.125 0 011.37-.49l1.217.456c.355.133.75.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.645-.87l.213-1.281z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);


// --- Main Page Component ---

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
  const [passwordVisible, setPasswordVisible] = useState(false);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

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

  const handleDetailsSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (formData.password.length < 8 || !/[!@#$%^&*]/.test(formData.password)) {
        setError("Password must be 8+ characters and include a special character.");
        setLoading(false);
        return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to start registration.');
      
      setMessage(data.message);
      setStep('otp');
      startResendTimer();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

 // Updated handleOtpSubmit function with proper token handling

const handleOtpSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError(null);

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: formData.email.toLowerCase(), 
        otp: otp.trim() 
      }),
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.message || 'OTP verification failed.');
    }

    console.log('OTP verification response:', data); // Debug log

    // Check if the backend returns a token after verification
    if (data.token) {
      // Store the token
      localStorage.setItem('token', data.token);
      
      // If you have AuthContext, update the user state
      // setUser(data.user); // Uncomment if you have user context
      
      setMessage(data.message || "Account verified successfully! Redirecting...");
      
      // Redirect to dashboard instead of signin
      setTimeout(() => {
        window.location.href = data.redirectTo || '/dashboard';
      }, 2000);
    } else {
      // If no token is returned, redirect to signin
      setMessage(data.message || "Account verified successfully! Please sign in.");
      
      setTimeout(() => {
        window.location.href = data.redirectTo || '/auth/signin';
      }, 2000);
    }

  } catch (err) {
    console.error('OTP verification error:', err); // Debug log
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
  const handleResendOtp = async () => {
    setResendLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email.toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to resend OTP.');

      setMessage(data.message || "New OTP sent to your email");
      setOtp("");
      startResendTimer();
      
    } catch (err) {
      setError(err.message);
    } finally {
      setResendLoading(false);
    }
  };

  const inputStyles = "w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent px-4 py-3 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-colors";
  const socialButtonStyles = "w-full flex items-center justify-center rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-3 font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors";

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-white dark:bg-gray-900 p-4">
      <div className="flex w-full max-w-5xl mx-auto">
        
        {/* Form Column */}
        <div className="w-full lg:w-1/2 px-4 sm:px-12 py-12 flex items-center">
          <div className="w-full max-w-md mx-auto">
            
            {/* Form for User Details */}
            {step === 'details' && (
              <>
                <h1 className="mb-8 text-3xl font-bold text-gray-800 dark:text-gray-100">
                  Create Account
                </h1>
                <form onSubmit={handleDetailsSubmit} className="space-y-5">
                  <input type="text" name="name" placeholder="Full Name" value={formData.name} onChange={handleInputChange} required className={inputStyles} />
                  <input type="tel" name="phone_number" placeholder="Phone Number" value={formData.phone_number} pattern="\d{10}" title="Phone number must be 10 digits" onChange={handleInputChange} required className={inputStyles} />
                  <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleInputChange} required className={inputStyles} />
                  <div className="relative">
                    <input type={passwordVisible ? "text" : "password"} name="password" placeholder="Password" value={formData.password} onChange={handleInputChange} required className={inputStyles} />
                    <button type="button" onClick={() => setPasswordVisible(!passwordVisible)} className="absolute right-4 top-1/2 transform -translate-y-1/2" aria-label="Toggle password visibility">
                      <EyeIcon visible={passwordVisible} />
                    </button>
                  </div>
                  
                  {error && <div className="text-center rounded-xl bg-red-100/80 dark:bg-red-900/50 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
                  
                  <button type="submit" disabled={loading} className="w-full rounded-xl bg-purple-500 px-4 py-3 font-medium text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900">
                    {loading ? "Signing up..." : "Sign up"}
                  </button>
                </form>

                <div className="my-6 flex items-center">
                  <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                  <span className="mx-4 text-sm text-gray-400 dark:text-gray-500">Or</span>
                  <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                </div>

                
              </>
            )}

            {/* Form for OTP Verification */}
            {step === 'otp' && (
              <div className="text-center">
                <h1 className="mb-4 text-3xl font-bold text-gray-800 dark:text-gray-100">Verify Your Email</h1>
                {message && <p className="text-green-600 dark:text-green-400 mb-4 bg-green-50 dark:bg-green-900/50 p-3 rounded-lg">{message}</p>}
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Enter the 6-digit code sent to<br />
                  <strong className="text-gray-800 dark:text-gray-100">{formData.email}</strong>
                </p>
                
                <form onSubmit={handleOtpSubmit} className="space-y-5">
                  <input type="text" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength="6" required className={`${inputStyles} text-center text-2xl tracking-widest font-mono`} />
                  {error && <div className="rounded-xl bg-red-100 dark:bg-red-900/50 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
                  <button type="submit" disabled={loading || otp.length !== 6} className="w-full rounded-xl bg-purple-500 px-4 py-3 font-medium text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900">
                    {loading ? "Verifying..." : "Verify Email"}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Didn't receive the code?</p>
                  {canResend ? (
                    <button onClick={handleResendOtp} disabled={resendLoading} className="text-purple-600 hover:underline font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                      {resendLoading ? "Sending..." : "Resend OTP"}
                    </button>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Resend available in {countdown} seconds</p>
                  )}
                </div>

                <button onClick={() => { setStep('details'); setOtp(''); setError(null); setMessage(null); }} className="mt-4 w-full text-center text-sm text-gray-500 dark:text-gray-400 hover:underline">
                  ← Change email address
                </button>
              </div>
            )}

            <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Already have an account?{" "}
              <Link href="/auth/signin" className="font-medium text-purple-600 dark:text-purple-400 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Image Column */}
        <div className="hidden lg:flex w-1/2 items-center justify-center p-12">
          <div className="relative text-center">
             {/* Replace this with the illustration from your design */}
            <img src="https://thebookshelves.com/Graphic%201.png" alt="Woman reading a book illustration" className="w-full max-w-sm" />
          </div>
        </div>
      </div>

       {/* Theme Toggle Button */}
       {/* TODO: Add theme toggling logic */}
       <button className="fixed bottom-5 right-5 bg-white dark:bg-gray-800 text-purple-500 dark:text-purple-400 p-3 rounded-full shadow-lg border border-gray-200 dark:border-gray-700">
          <ThemeToggleIcon />
       </button>
    </div>
  );
}

export default SignUpPage;