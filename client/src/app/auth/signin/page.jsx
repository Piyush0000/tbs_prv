"use client";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "../../Hooks/AuthContext"; // Fixed path
import ThemeToggle from "../../../components/ThemeToggle"; // Adjust this path as needed

function MainComponent() {
    const { login } = useAuth(); // Get login function from context
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordVisible, setPasswordVisible] = useState(false);

    // Forgot password states remain the same
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetStep, setResetStep] = useState(1);
    const [resetEmail, setResetEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    
    // Google Sign-in states remain the same
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [googlePhoneNumber, setGooglePhoneNumber] = useState("");
    const [googleTempData, setGoogleTempData] = useState(null);

    const clearMessages = () => {
        setError(null);
        setSuccess(null);
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        clearMessages();

        if (!email || !password) {
            setError("Please fill in all fields");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/signin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.toLowerCase(), password }),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Login failed');
            }

            // Use the login function from AuthContext instead of manually setting localStorage
            login(data.token, data.user);
            
            console.log('Login successful, user data:', data.user);
            
            // Redirect based on user role
            if (data.user.role === 'admin') {
                window.location.href = '/AdminDashboard';
            } else if (data.user.role === 'cafe') {
                window.location.href = '/CafeDashboard';
            } else {
                window.location.href = '/';
            }
        } catch (err) {
            console.error('Sign-in error:', err.message);
            setError(err.message || 'Failed to sign in');
            setLoading(false);
        }
    };

    // ... rest of your existing functions (handleForgotPassword, handleResetPassword, etc.) remain the same ...

    const handleForgotPassword = async () => {
        clearMessages();
        if (!resetEmail) {
            setError("Please enter your email to reset password");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: resetEmail.toLowerCase() }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message);
            
            setSuccess(data.message);
            setResetStep(2);

        } catch (err) {
            setError(err.message || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };
    
    const handleResetPassword = async () => {
        clearMessages();
        if (!otp || !newPassword) {
            setError("Please fill in the OTP and your new password.");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: resetEmail.toLowerCase(), otp, newPassword }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message);

            setSuccess(data.message);
            setTimeout(() => {
                setShowResetModal(false);
                setResetStep(1);
                setResetEmail("");
                setOtp("");
                setNewPassword("");
                clearMessages();
            }, 3000);

        } catch (err) {
            setError(err.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    const togglePasswordVisibility = () => {
        setPasswordVisible(!passwordVisible);
    };

    // ... rest of your JSX remains exactly the same ...
    
    return (
        <div className="flex min-h-screen bg-background-light dark:bg-background-dark">
            <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
                <div className="w-full max-w-md">
                    <h1 className="text-4xl font-bold text-text-light dark:text-text-dark mb-8 font-ibm-plex-sans">
                        Hello Reader!
                    </h1>

                    <form onSubmit={onSubmit} className="space-y-6">
                        <div>
                            <input
                                type="email"
                                name="email"
                                placeholder="Username or Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-6 py-3 rounded-full border border-border-light dark:border-border-dark focus:border-primary-light dark:focus:border-primary-dark focus:ring-1 focus:ring-primary-light dark:focus:ring-primary-dark transition-colors"
                            />
                        </div>

                        <div className="relative">
                            <input
                                type={passwordVisible ? "text" : "password"}
                                name="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-6 py-3 rounded-full border border-border-light dark:border-border-dark focus:border-primary-light dark:focus:border-primary-dark focus:ring-1 focus:ring-primary-light dark:focus:ring-primary-dark transition-colors"
                            />
                            <button
                                type="button"
                                onClick={togglePasswordVisibility}
                                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-600 dark:text-gray-400"
                            >
                                {passwordVisible ? "🙈" : "👁️"}
                            </button>
                        </div>

                        <div className="text-right">
                            <button
                                type="button"
                                onClick={() => setShowResetModal(true)}
                                className="text-sm text-primary-light dark:text-primary-dark hover:underline"
                            >
                                Forgot Password?
                            </button>
                        </div>

                        {error && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-full relative" role="alert">
                                <span className="block sm:inline">{error}</span>
                            </div>
                        )}
                        {success && (
                             <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-full relative" role="alert">
                                <span className="block sm:inline">{success}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary-light dark:bg-primary-dark text-white dark:text-black px-6 py-3 rounded-full hover:bg-opacity-90 transition-colors disabled:opacity-50"
                        >
                            {loading ? "Signing in..." : "Log In"}
                        </button>
                    </form>

                    <div className="my-8 flex items-center">
                        <div className="flex-1 border-t border-border-light dark:border-border-dark"></div>
                        <span className="px-4 text-gray-500 dark:text-gray-400 text-sm">Or</span>
                        <div className="flex-1 border-t border-border-light dark:border-border-dark"></div>
                    </div>

                    <div className="space-y-4">
                        {/* Google and Apple buttons remain the same */}
                    </div>

                    <p className="mt-8 text-center text-gray-600 dark:text-gray-400 text-sm">
                        New here?{" "}
                        <Link href="/auth/signup" className="text-text-light dark:text-text-dark hover:underline">
                            Sign up instead
                        </Link>
                    </p>
                </div>
            </div>

            <div className="hidden lg:flex w-1/2 items-center justify-center bg-gradient-to-br from-backgroundSCD-light to-backgroundSCD-light dark:from-backgroundSCD-dark dark:to-backgroundSCD-dark p-12">
                <div className="relative">
                    <img
                        src="/Graphic 1.png"
                        alt="Person reading a book"
                        className="w-full max-w-lg"
                    />
                </div>
            </div>

            <ThemeToggle />
            
            {/* Forgot Password Modal - remains the same */}
            {showResetModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-background-light dark:bg-background-dark p-6 rounded-lg max-w-md w-full">
                        <h2 className="text-xl font-bold text-text-light dark:text-text-dark mb-4">
                            Reset Your Password
                        </h2>
                        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
                        {success && <p className="text-sm text-green-500 mb-4">{success}</p>}
                        
                        {resetStep === 1 && (
                            <div className="space-y-4">
                                <p className="text-sm text-text-light dark:text-text-dark">
                                    Enter your email address and we will send you an OTP to reset your password.
                                </p>
                                <input
                                    type="email"
                                    value={resetEmail}
                                    onChange={(e) => setResetEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    className="w-full rounded-full border border-border-light dark:border-border-dark px-4 py-3"
                                />
                            </div>
                        )}

                        {resetStep === 2 && (
                            <div className="space-y-4">
                                <input
                                    type="text"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    placeholder="Enter OTP"
                                    className="w-full rounded-full border border-border-light dark:border-border-dark px-4 py-3"
                                />
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    className="w-full rounded-full border border-border-light dark:border-border-dark px-4 py-3"
                                />
                            </div>
                        )}
                        
                        <div className="flex justify-end space-x-4 mt-6">
                            <button
                                type="button"
                                onClick={() => { setShowResetModal(false); clearMessages(); setResetStep(1); }}
                                className="rounded-full border border-border-light dark:border-border-dark px-4 py-2"
                            >
                                Cancel
                            </button>
                            {resetStep === 1 && (
                                <button
                                    type="button"
                                    onClick={handleForgotPassword}
                                    disabled={loading}
                                    className="rounded-full bg-primary-light dark:bg-primary-dark px-4 py-2 text-white dark:text-black disabled:opacity-50"
                                >
                                    {loading ? "Sending..." : "Send OTP"}
                                </button>
                            )}
                            {resetStep === 2 && (
                                 <button
                                    type="button"
                                    onClick={handleResetPassword}
                                    disabled={loading}
                                    className="rounded-full bg-primary-light dark:bg-primary-dark px-4 py-2 text-white dark:text-black disabled:opacity-50"
                                >
                                    {loading ? "Resetting..." : "Reset Password"}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MainComponent;