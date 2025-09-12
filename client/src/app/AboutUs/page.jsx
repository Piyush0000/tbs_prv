"use client";
import Link from "next/link";
import Footer from "../../components/footer";
import Header from "../../components/header";
import { useAuth } from '../Hooks/AuthContext';

function AboutUsPage() {
  const { user, isLoggedIn, loading, logout } = useAuth();

  const handleLogout = async () => {
    console.log('Logout initiated from header');
    const success = await logout();
    if (success) {
      console.log('Logout successful, reloading page.');
      window.location.reload();
    } else {
      console.error('Logout failed');
    }
  };

  const handleSearch = (e) => {
    console.log('Search query:', e.target.value);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-light dark:border-primary-dark mx-auto mb-4"></div>
          <p className="text-text-light dark:text-text-dark">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header 
        user={user}
        onSearch={handleSearch}
        onLogout={handleLogout}
      />

      {/* Hero Section */}
      <div className="bg-gradient-to-b from-gray-50 to-white py-20">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">About The Bookshelves</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Making literature accessible through a café-based book exchange network that connects readers with culture in everyday spaces.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-16">
        
        {/* Mission Statement */}
        <div className="text-center mb-20">
          <div className="bg-[#c983c0]/5 p-8 rounded-xl max-w-4xl mx-auto">
            <blockquote className="text-2xl text-[#c983c0] font-semibold italic mb-4">
              "Culture shouldn't be available only to those who can afford it."
            </blockquote>
            <p className="text-gray-700 text-lg">
              This principle drives our mission to democratize access to literature through innovative community-based solutions.
            </p>
          </div>
        </div>

        {/* What We Do */}
        <div className="grid md:grid-cols-2 gap-16 items-center mb-20">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">What We Do</h2>
            <p className="text-gray-700 mb-4">
              We operate a subscription-based book exchange system in partner cafés across Kolkata. Members pay a nominal monthly fee plus a refundable deposit to access our curated collection.
            </p>
            <p className="text-gray-700">
              Our model transforms cafés into literary hubs, creating spaces where books circulate freely and reading becomes a social experience.
            </p>
          </div>
          <div className="bg-gray-50 p-8 rounded-xl">
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-[#c983c0] rounded-full mr-4"></div>
                <span className="text-gray-700">Curated book collections</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-[#c983c0] rounded-full mr-4"></div>
                <span className="text-gray-700">Partner café network</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-[#c983c0] rounded-full mr-4"></div>
                <span className="text-gray-700">Affordable access model</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-[#c983c0] rounded-full mr-4"></div>
                <span className="text-gray-700">Community-driven experience</span>
              </div>
            </div>
          </div>
        </div>

        {/* Founders */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Our Founders</h2>
          <div className="grid md:grid-cols-2 gap-12 max-w-4xl mx-auto">
            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
              <div className="w-32 h-32 mx-auto mb-6 rounded-full overflow-hidden bg-gray-100">
                <img src="/kavya.png" alt="Kavya Gupta" className="w-full h-full object-cover" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-1">Kavya Gupta</h3>
                <p className="text-[#c983c0] font-medium mb-3">Founder</p>
                <p className="text-gray-600">Passionate about cultural accessibility and community building through literature.</p>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
              <div className="w-32 h-32 mx-auto mb-6 rounded-full overflow-hidden bg-gray-100">
                <img src="/dinky.jpeg" alt="Dinky Sheth" className="w-full h-full object-cover" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-1">Dinky Sheth</h3>
                <p className="text-[#c983c0] font-medium mb-3">Co-Founder</p>
                <p className="text-gray-600">Marketing strategist focused on expanding literary access across urban communities.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-20">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { number: "2+", label: "Years Operating" },
              { number: "1000+", label: "Books Available" },
              { number: "10+", label: "Partner Locations" },
            ].map((stat, index) => (
              <div key={index} className="text-center p-6 bg-gray-50 rounded-xl">
                <div className="text-4xl font-bold text-[#c983c0] mb-2">{stat.number}</div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-[#c983c0] to-purple-600 rounded-3xl"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#c983c0]/90 to-purple-600/90 rounded-3xl backdrop-blur-sm"></div>
          <div className="relative p-16 text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-full backdrop-blur-sm mb-4">
                <span className="text-4xl">🚀</span>
              </div>
            </div>
            <h2 className="text-4xl font-bold mb-6 text-white">Join Our Literary Revolution</h2>
            <p className="mb-10 text-white/90 text-xl max-w-2xl mx-auto leading-relaxed">
              Experience affordable access to quality literature in your favorite café spaces. Be part of the movement making culture accessible to everyone.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Link href="/Subscription">
                <button className="group relative bg-white text-[#c983c0] px-10 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all transform hover:scale-105 shadow-xl hover:shadow-2xl">
                  <span className="relative z-10">Start Your Journey</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-[#c983c0]/10 to-purple-600/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </button>
              </Link>
              <Link href="">
                <button className="group relative bg-transparent text-white px-10 py-4 rounded-xl font-bold text-lg border-2 border-white hover:bg-white/10 transition-all transform hover:scale-105 shadow-xl">
                  <span className="relative z-10 flex items-center">
                    Get In Touch
                    <svg className="ml-2 w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </span>
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default AboutUsPage;