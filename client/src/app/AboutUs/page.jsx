"use client";
import Link from "next/link";
import Footer from "../../components/footer";
import Header from "../../components/header";

function AboutUsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <Header />

      {/* Hero Section with Real Image */}
      <div className="relative py-24 overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/about.jpg"
            alt="Coffee culture"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40"></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
          <div className="text-center">
            <h1 className="text-6xl font-bold mb-8 text-white">About Us</h1>
            <div className="max-w-4xl mx-auto bg-white/90 backdrop-blur-sm p-8 rounded-2xl shadow-xl">
              <blockquote className="text-3xl font-bold mb-6 text-[#c983c0] italic">
                "Culture shouldn't be available only to those who can afford it."
              </blockquote>
              <p className="text-xl leading-relaxed text-gray-700">
                That belief lies at the heart of The Bookshelves (TBS)—a café-based book exchange network created to bring the joy of reading back into everyday life.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-16">
        <div className="space-y-24">

          {/* Our Story Section */}
          <div className="flex flex-col md:flex-row items-center gap-10 md:gap-12">
            <div className="md:w-1/2">
              <div className="p-6 bg-white rounded-2xl shadow-xl border-l-4 border-[#c983c0]">
                <h2 className="text-3xl font-bold mb-6 text-gray-800">Our Story</h2>
                <p className="leading-relaxed mb-4 text-gray-700">
                  The story of The Bookshelves begins not with a business plan, but with a friendship. In their very first year of college, Kavya Gupta, a quiet bibliophile with a passion for cultural accessibility, met Dinky Sheth, an energetic marketing enthusiast who believed every great idea deserves a great audience.
                </p>
                <p className="leading-relaxed mb-4 text-gray-700">
                  Bonding over literature, late-night café visits, and a shared frustration with the high cost of books, the two began to dream of a world where reading wasn't a luxury, but a lifestyle.
                </p>
                <p className="leading-relaxed text-gray-700">
                  After two years of ideation, experimentation, and late-night planning sessions, The Bookshelves emerged—not just as a service, but as a movement to make books accessible, affordable, and alive in the heart of the city.
                </p>
              </div>
            </div>
            <div className="md:w-1/2">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#c983c0] to-purple-600 rounded-2xl blur opacity-30"></div>
                <div className="relative bg-white p-2 rounded-2xl shadow-xl">
                  <img
                    src="/dinky.jpeg"
                    alt="Kavya and Dinky - The founders of The Bookshelves"
                    className="w-full h-[400px] object-cover rounded-xl"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* What We Do Section */}
          <div className="flex flex-col md:flex-row-reverse items-center gap-10 md:gap-12">
            <div className="md:w-1/2">
              <div className="p-6 bg-white rounded-2xl shadow-xl border-r-4 border-[#c983c0]">
                <h2 className="text-3xl font-bold mb-6 text-gray-800">What We Do</h2>
                <p className="leading-relaxed mb-4 text-gray-700">
                  At The Bookshelves, we offer a subscription-based book exchange system hosted in partner cafés across Kolkata. For a nominal monthly fee and a refundable safety deposit, readers can borrow from a thoughtfully curated collection of books—while enjoying their favorite coffee spots.
                </p>
                <p className="leading-relaxed italic text-[#c983c0] font-medium">
                  These aren't just books—they're shared experiences, literary companions, and quiet adventures waiting to be discovered.
                </p>
              </div>
            </div>
            <div className="md:w-1/2">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#c983c0] to-purple-600 rounded-2xl blur opacity-30"></div>
                <div className="relative bg-white p-2 rounded-2xl shadow-xl">
                  <img
                    src="/what-we-do.jpg"
                    alt="Person reading in a cozy café setting"
                    className="w-full h-[400px] object-cover rounded-xl"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* The Road Ahead Section */}
          <div className="flex flex-col md:flex-row items-center gap-10 md:gap-12">
            <div className="md:w-1/2">
              <div className="p-6 bg-white rounded-2xl shadow-xl border-l-4 border-[#c983c0]">
                <h2 className="text-3xl font-bold mb-6 text-gray-800">The Road Ahead</h2>
                <p className="leading-relaxed mb-6 text-gray-700">
                  Our vision is to make every café corner a literary hub—where books circulate freely, ideas are exchanged openly, and a new reading culture blooms at the heart of urban life.
                </p>
                <p className="leading-relaxed mb-6 text-gray-700">As we grow, we aim to:</p>
                <div className="grid grid-cols-1 gap-4 mb-6">
                  {[
                    "Expand to more cities",
                    "Champion regional and local literature",
                    "Partner deeply with independent cafés and cultural spaces",
                  ].map((goal, index) => (
                    <div key={index} className="flex items-center p-3 bg-purple-50 rounded-lg">
                      <span className="text-[#c983c0] mr-3">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                          <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                      </span>
                      <span className="text-gray-700">{goal}</span>
                    </div>
                  ))}
                </div>
                <p className="leading-relaxed text-gray-700 mb-2">Because everyone deserves access to culture.</p>
                <p className="leading-relaxed italic text-[#c983c0] font-medium">
                  And every story deserves to be read.
                </p>
              </div>
            </div>
            <div className="md:w-1/2">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#c983c0] to-purple-600 rounded-2xl blur opacity-30"></div>
                <div className="relative bg-white p-2 rounded-2xl shadow-xl">
                  <img
                    src="/road-ahead.jpeg"
                    alt="Team collaboration and planning for the future"
                    className="w-full h-[400px] object-cover rounded-xl"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Meet Our Team */}
        <div className="my-24">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">Meet Our Team</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden transform hover:scale-105 transition-transform duration-300">
              <div className="h-80 overflow-hidden">
                <img src="/kavya.png" alt="Kavya Gupta - Founder" className="w-full h-full object-cover" />
              </div>
              <div className="p-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Kavya Gupta</h3>
                <p className="text-[#c983c0] font-semibold mb-3">Founder, The Bookshelves</p>
                <p className="text-gray-700 leading-relaxed">
                  A reader at heart, building bridges between culture and community.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl overflow-hidden transform hover:scale-105 transition-transform duration-300">
              <div className="h-80 overflow-hidden">
                <img
                  src="/dinky.jpeg"
                  alt="Dinky Sheth - Co-Founder"
                  className="w-full h-full object-cover object-left"
                />
              </div>
              <div className="p-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Dinky Sheth</h3>
                <p className="text-[#c983c0] font-semibold mb-3">Co-Founder, The Bookshelves</p>
                <p className="text-gray-700 leading-relaxed">
                  A storyteller and strategist, making literature accessible—one café at a time.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="my-24">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">Our Impact</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { number: "2+", label: "Years of Operation" },
              { number: "1000+", label: "Books in Circulation" },
              { number: "10+", label: "Partner Cafés" },
            ].map((stat, index) => (
              <div
                key={index}
                className="bg-white p-8 rounded-2xl shadow-xl text-center transform hover:scale-105 transition-transform duration-300"
              >
                <div className="text-5xl font-bold text-[#c983c0] mb-2">{stat.number}</div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonials */}
        <div className="my-24">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">What Our Community Says</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                quote: "The Bookshelves has completely changed how I discover new books. I love the community aspect!",
                author: "Priya M., Member since 2022",
              },
              {
                quote: "As a café owner, partnering with TBS has brought in new customers and created a wonderful atmosphere.",
                author: "Rahul S., Blue Tokai Coffee",
              },
            ].map((testimonial, index) => (
              <div key={index} className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-2xl shadow-lg">
                <div className="text-[#c983c0] text-4xl font-serif mb-4">"</div>
                <p className="text-gray-700 italic mb-4">{testimonial.quote}</p>
                <p className="text-right text-gray-600 font-medium">— {testimonial.author}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="my-24 text-center">
          <div className="bg-gradient-to-r from-[#c983c0] to-purple-600 p-12 rounded-3xl shadow-2xl">
            <h2 className="text-4xl font-bold mb-4 text-white">Join Our Literary Community</h2>
            <p className="mb-8 text-white text-lg">
              Be part of a movement that's making culture accessible to everyone, one book at a time.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/Subscription">
                <button className="bg-white text-[#c983c0] px-8 py-4 rounded-full text-lg font-semibold hover:bg-gray-100 transition shadow-lg">
                  Start Reading Today
                </button>
              </Link>
              <Link href="/contact">
                <button className="bg-transparent text-white px-8 py-4 rounded-full text-lg font-semibold border-2 border-white hover:bg-white/10 transition shadow-lg">
                  Get In Touch
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
