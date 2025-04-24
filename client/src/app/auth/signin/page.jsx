"use client";
import Link from "next/link";
import { useState } from "react";
import ThemeToggle from "../../../components/ThemeToggle";
import { auth, googleProvider } from "../../../lib/firebase";
import { signInWithPopup } from "firebase/auth";

function MainComponent() {
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [googlePhoneNumber, setGooglePhoneNumber] = useState("");
    const [googleTempData, setGoogleTempData] = useState(null);

    const onSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (!email || !password) {
            setError(
                <span className="text-text-light dark:text-text-dark">
                    Please fill in all fields
                </span>
            );
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.toLowerCase(), password }),
            });
            const data = await res.json();
            console.log('Login response:', data); // Debug log
            if (!res.ok) throw new Error(data.error || 'Login failed');
            localStorage.setItem('token', data.token);
            console.log('Token saved:', localStorage.getItem('token')); // Debug log
            // Redirect based on user role
            if (!data.user) throw new Error('User data missing in response');
            if (data.user.role === 'admin') {
                window.location.href = '/AdminDashboard';
            } else if (data.user.role === 'cafe') {
                window.location.href = '/CafeDashboard';
            } else {
                window.location.href = '/';
            }
        } catch (err) {
            setError(err.message);
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
                // Store temporary token and user data, show phone number modal
                setGoogleTempData({
                    tempToken: data.tempToken,
                    name: result.user.displayName,
                    email: result.user.email
                });
                setShowPhoneModal(true);
            } else {
                // Existing user with phone number, proceed with login
                if (!data.user) throw new Error('User data missing in response');
                localStorage.setItem('token', data.token);
                // Redirect based on user role
                if (data.user.role === 'admin') {
                    window.location.href = '/AdminDashboard';
                } else if (data.user.role === 'cafe') {
                    window.location.href = '/CafeDashboard';
                } else {
                    window.location.href = '/';
                }
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

        // Validate phone number
        if (!/^\d{10}$/.test(googlePhoneNumber)) {
            setError("Phone number must be 10 digits");
            return;
        }

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/google/complete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tempToken: googleTempData.tempToken,
                    phone_number: googlePhoneNumber,
                }),
            });
            const data = await res.json();
            console.log('Phone submission response:', data); // Debug log
            if (!res.ok) throw new Error(data.message || 'Failed to complete registration');

            // Registration completed successfully, store token and redirect
            localStorage.setItem('token', data.token);
            setShowPhoneModal(false);
            // Redirect based on user role
            if (!data.user) throw new Error('User data missing in response');
            if (data.user.role === 'admin') {
                window.location.href = '/AdminDashboard';
            } else if (data.user.role === 'cafe') {
                window.location.href = '/CafeDashboard';
            } else {
                window.location.href = '/';
            }
        } catch (err) {
            console.error('Phone submission error:', err.message); // Debug log
            setError(err.message);
        }
    };

    const togglePasswordVisibility = () => {
        setPasswordVisible(!passwordVisible);
        setTimeout(() => setPasswordVisible(false), 15000);
    };

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

                        {error && (
                            <div className="bg-warning-light dark:bg-warning-dark text-warning-light dark:text-warning-dark p-4 rounded-full text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary-light dark:bg-primary-dark text-white dark:text-black px-6 py-3 rounded-full hover:bg-primary-light dark:hover:bg-primary-dark transition-colors disabled:opacity-50"
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
                        <button
                            onClick={handleGoogleSignIn}
                            className="w-full border border-border-light dark:border-border-dark px-6 py-3 rounded-full flex items-center justify-center space-x-2 hover:bg-backgroundSCD-light dark:hover:bg-backgroundSCD-dark transition-colors"
                        >
                            <i className="fab fa-google text-xl"></i>
                            <span className="text-text-light dark:text-text-dark">Continue with Google</span>
                        </button>

                        <button className="w-full border border-border-light dark:border-border-dark px-6 py-3 rounded-full flex items-center justify-center space-x-2 hover:bg-backgroundSCD-light dark:hover:bg-backgroundSCD-dark transition-colors">
                            <i className="fab fa-apple text-xl"></i>
                            <span className="text-text-light dark:text-text-dark">Continue with Apple</span>
                        </button>
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
                                value={googlePhoneNumber}
                                onChange={(e) => setGooglePhoneNumber(e.target.value)}
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