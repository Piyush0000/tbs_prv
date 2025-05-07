import { useRef, useState, useEffect } from "react"; // Add useEffect to the imports
import { useAuth } from "../Hooks/useAuth";

function CafesSection({ data, setData, onEdit }) {
    const { refreshToken } = useAuth();
    const [searchQuery, setSearchQuery] = useState("");
    const [filter, setFilter] = useState({
        area: "",
        city: "",
        location: "",
        average_bill: "",
        ratings: "",
    });
    const [filterOptions, setFilterOptions] = useState({
        areas: [],
        cities: [],
        locations: [],
        average_bills: [],
        ratings: [],
    });
    const [loading, setLoading] = useState(false);

    const scrollRef = useRef(null);
    const isDown = useRef(false);
    const startX = useRef(0);
    const scrollLeft = useRef(0);

    // Fetch filter options on mount
    useEffect(() => {
        const abortController = new AbortController();
        const fetchFilters = async () => {
            if (loading) return;
            setLoading(true);
            try {
                const token = localStorage.getItem('token');
                let res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cafes/filters`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: abortController.signal,
                });
                if (!res.ok) {
                    if (res.status === 401) {
                        const newToken = await refreshToken();
                        if (!newToken) {
                            throw new Error('Failed to refresh token');
                        }
                        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cafes/filters`, {
                            headers: { Authorization: `Bearer ${newToken}` },
                            signal: abortController.signal,
                        });
                        if (!res.ok) throw new Error('Failed to fetch filters');
                    } else {
                        throw new Error('Failed to fetch filters');
                    }
                }
                const data = await res.json();
                setFilterOptions(data);
            } catch (err) {
                if (err.name === 'AbortError') {
                    console.log('Fetch aborted');
                    return;
                }
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchFilters();

        return () => {
            abortController.abort();
        };
    }, []);

    const handleMouseDown = (e) => {
        isDown.current = true;
        scrollRef.current.style.userSelect = "none";
        startX.current = e.pageX - scrollRef.current.offsetLeft;
        scrollLeft.current = scrollRef.current.scrollLeft;
    };

    const handleMouseLeave = () => {
        isDown.current = false;
        scrollRef.current.style.userSelect = "auto";
    };

    const handleMouseUp = () => {
        isDown.current = false;
        scrollRef.current.style.userSelect = "auto";
    };

    const handleMouseMove = (e) => {
        if (!isDown.current) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX.current) * 2;
        scrollRef.current.scrollLeft = scrollLeft.current - walk;
    };

    const filteredData = data.filter((cafe) => {
        const searchLower = searchQuery.toLowerCase();
        return (
            (cafe.name.toLowerCase().includes(searchLower) ||
                cafe.cafe_id.toLowerCase().includes(searchLower)) &&
            (filter.location === "" || cafe.location.toLowerCase() === filter.location.toLowerCase()) &&
            (filter.city === "" || cafe.city.toLowerCase() === filter.city.toLowerCase()) &&
            (filter.area === "" || cafe.area.toLowerCase() === filter.area.toLowerCase()) &&
            (filter.average_bill === "" || cafe.average_bill.toString() === filter.average_bill) &&
            (filter.ratings === "" || cafe.ratings.toString() === filter.ratings)
        );
    });

    const handleDelete = async (cafeId) => {
        if (!window.confirm(`Are you sure you want to delete the cafe with ID ${cafeId}?`)) {
            return;
        }

        if (loading) return;
        setLoading(true);

        try {
            let token = localStorage.getItem('token');
            let res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cafes/${cafeId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.status === 401) {
                token = await refreshToken();
                if (!token) {
                    throw new Error('Failed to refresh token');
                }
                res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cafes/${cafeId}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                });
            }

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(`Failed to delete cafe: ${errorData.error || res.statusText}`);
            }

            setData(data.filter(cafe => cafe.cafe_id !== cafeId));
            alert('Cafe deleted successfully!');
        } catch (err) {
            console.error('Error in handleDelete:', err);
            alert(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div>Loading filters...</div>;
    }

    return (
        <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
            <div className="flex gap-4 flex-wrap mb-4">
                <div className="flex-1 min-w-[200px]">
                    <input
                        type="text"
                        placeholder="Search cafes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg"
                    />
                </div>
                <select
                    className="px-4 py-2 border rounded-lg"
                    value={filter.location}
                    onChange={(e) => setFilter({ ...filter, location: e.target.value })}
                >
                    <option value="">Filter by Location</option>
                    {filterOptions.locations.map((location, idx) => (
                        <option key={idx} value={location}>{location}</option>
                    ))}
                </select>
                <select
                    className="px-4 py-2 border rounded-lg"
                    value={filter.city}
                    onChange={(e) => setFilter({ ...filter, city: e.target.value })}
                >
                    <option value="">Filter by City</option>
                    {filterOptions.cities.map((city, idx) => (
                        <option key={idx} value={city}>{city}</option>
                    ))}
                </select>
                <select
                    className="px-4 py-2 border rounded-lg"
                    value={filter.area}
                    onChange={(e) => setFilter({ ...filter, area: e.target.value })}
                >
                    <option value="">Filter by Area</option>
                    {filterOptions.areas.map((area, idx) => (
                        <option key={idx} value={area}>{area}</option>
                    ))}
                </select>
                <select
                    className="px-4 py-2 border rounded-lg"
                    value={filter.average_bill}
                    onChange={(e) => setFilter({ ...filter, average_bill: e.target.value })}
                >
                    <option value="">Filter by Avg Bill</option>
                    {filterOptions.average_bills.map((bill, idx) => (
                        <option key={idx} value={bill}>₹{bill}</option>
                    ))}
                </select>
                <select
                    className="px-4 py-2 border rounded-lg"
                    value={filter.ratings}
                    onChange={(e) => setFilter({ ...filter, ratings: e.target.value })}
                >
                    <option value="">Filter by Rating</option>
                    {filterOptions.ratings.map((rating, idx) => (
                        <option key={idx} value={rating}>{rating}</option>
                    ))}
                </select>
            </div>

            <div
                className="overflow-x-auto cursor-grab"
                ref={scrollRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
            >
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 whitespace-nowrap">
                            <th className="px-4 py-3 text-left">Cafe ID</th>
                            <th className="px-4 py-3 text-left">Name</th>
                            <th className="px-4 py-3 text-left">Area</th>
                            <th className="px-4 py-3 text-left">City</th>
                            <th className="px-4 py-3 text-left">Location</th>
                            <th className="px-4 py-3 text-left">Image URL</th>
                            <th className="px-4 py-3 text-left">Audio URL</th>
                            <th className="px-4 py-3 text-left">gmap URL</th>
                            <th className="px-4 py-3 text-left">Avg Bill</th>
                            <th className="px-4 py-3 text-left">Discount</th>
                            <th className="px-4 py-3 text-left">Ratings</th>
                            <th className="px-4 py-3 text-left">Specials</th>
                            <th className="px-4 py-3 text-left">Cafe Owner ID</th>
                            <th className="px-4 py-3 text-left">Created At</th>
                            <th className="px-4 py-3 text-left">Updated At</th>
                            <th className="px-4 py-3 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.map((cafe, idx) => (
                            <tr key={idx} className="border-t whitespace-nowrap">
                                <td className="px-4 py-3">{cafe.cafe_id}</td>
                                <td className="px-4 py-3">{cafe.name}</td>
                                <td className="px-4 py-3">{cafe.city || 'N/A'}</td>
                                <td className="px-4 py-3">{cafe.area || 'N/A'}</td>
                                <td className="px-4 py-3">{cafe.location}</td>
                                <td className="px-4 py-3 truncate max-w-xs">
                                {cafe.image_url ? (
                                    <a
                                    href={cafe.image_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                    >
                                    View
                                    </a>
                                    ) : (
                                        "N/A"
                                    )}
                                    </td>
                                    <td className="px-4 py-3 truncate max-w-xs">
                                    {cafe.audio_url ? (
                                        <a
                                        href={cafe.audio_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline"
                                        >
                                        Listen
                                        </a>
                                    ) : (
                                        "N/A"
                                    )}
                                    </td>
                                <td className="px-4 py-3 truncate max-w-xs">₹{cafe.gmap_url}</td>
                                <td className="px-4 py-3">₹{cafe.average_bill}</td>
                                <td className="px-4 py-3">{cafe.discount}%</td>
                                <td className="px-4 py-3">{cafe.ratings}</td>
                                <td className="px-4 py-3">{cafe.specials || 'N/A'}</td>
                                <td className="px-4 py-3">{cafe.cafe_owner_id || 'N/A'}</td>
                                <td className="px-4 py-3">
                                    {new Date(cafe.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3">
                                    {new Date(cafe.updatedAt).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3">
                                    <button
                                        onClick={() => onEdit(cafe)}
                                        className="text-blue-600 hover:text-blue-800 mr-2"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(cafe.cafe_id)}
                                        className="text-red-600 hover:text-red-800"
                                        disabled={loading}
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default CafesSection;