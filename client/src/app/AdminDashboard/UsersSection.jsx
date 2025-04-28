import { useEffect, useRef, useState } from "react";

function UsersSection({ data, setData, onEdit }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [filter, setFilter] = useState({
        subscription_type: "",
        role: "",
    });
    const [filterOptions, setFilterOptions] = useState({
        subscription_types: [],
        roles: [],
    });

    const scrollRef = useRef(null);
    const isDown = useRef(false);
    const startX = useRef(0);
    const scrollLeft = useRef(0);

    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/filters`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) throw new Error('Failed to fetch user filters');
                const data = await res.json();
                setFilterOptions(data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchFilters();
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

    const filteredData = data.filter((user) => {
        const searchLower = searchQuery.toLowerCase();
        // Add defensive checks for undefined properties
        const userName = user.name || "";
        const userId = user.user_id || "";
        const userSubscriptionType = user.subscription_type || "";
        const userRole = user.role || "";
        const filterSubscriptionType = filter.subscription_type || "";
        const filterRole = filter.role || "";

        return (
            (userName.toLowerCase().includes(searchLower) ||
            userId.toLowerCase().includes(searchLower)) &&
            (filterSubscriptionType === "" ||
                userSubscriptionType.toLowerCase() === filterSubscriptionType.toLowerCase()) &&
            (filterRole === "" || userRole.toLowerCase() === filterRole.toLowerCase())
        );
    });

    const handleDelete = async (userId) => {
        const confirmed = window.confirm("Are you sure you want to delete this user?");
        if (!confirmed) return;
    
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to delete user');
            setData(data.filter(user => user.user_id !== userId));
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
            <div className="flex gap-4 flex-wrap mb-4">
                <div className="flex-1 min-w-[200px]">
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg"
                    />
                </div>
                <select
                    className="px-4 py-2 border rounded-lg"
                    value={filter.subscription_type}
                    onChange={(e) =>
                        setFilter({ ...filter, subscription_type: e.target.value })
                    }
                >
                    <option value="">Filter by Subscription</option>
                    {filterOptions.subscription_types.map((type, idx) => (
                        <option key={idx} value={type}>{type}</option>
                    ))}
                </select>
                <select
                    className="px-4 py-2 border rounded-lg"
                    value={filter.role}
                    onChange={(e) =>
                        setFilter({ ...filter, role: e.target.value })
                    }
                >
                    <option value="">Filter by Role</option>
                    {filterOptions.roles.map((role, idx) => (
                        <option key={idx} value={role}>{role}</option>
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
                            <th className="px-4 py-3 text-left">User ID</th>
                            <th className="px-4 py-3 text-left">Name</th>
                            <th className="px-4 py-3 text-left">Phone</th>
                            <th className="px-4 py-3 text-left">Email</th>
                            <th className="px-4 py-3 text-left">Subscription Validity</th>
                            <th className="px-4 py-3 text-left">Subscription Type</th>
                            <th className="px-4 py-3 text-left">Book ID</th>
                            <th className="px-4 py-3 text-left">Role</th>
                            <th className="px-4 py-3 text-left">Created At</th>
                            <th className="px-4 py-3 text-left">Updated At</th>
                            <th className="px-4 py-3 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.map((user, idx) => (
                            <tr key={idx} className="border-t whitespace-nowrap">
                                <td className="px-4 py-3">{user.user_id}</td>
                                <td className="px-4 py-3">{user.name}</td>
                                <td className="px-4 py-3">{user.phone_number}</td>
                                <td className="px-4 py-3">{user.email}</td>
                                <td className="px-4 py-3">
                                    {user.subscription_validity
                                        ? new Date(user.subscription_validity).toLocaleDateString()
                                        : "N/A"}
                                </td>
                                <td className="px-4 py-3">{user.subscription_type}</td>
                                <td className="px-4 py-3">{user.book_id || "N/A"}</td>
                                <td className="px-4 py-3">{user.role}</td>
                                <td className="px-4 py-3">
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3">
                                    {new Date(user.updatedAt).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3">
                                    <button
                                        onClick={() => onEdit(user)}
                                        className="text-blue-600 hover:text-blue-800 mr-2"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(user.user_id)}
                                        className="text-red-600 hover:text-red-800"
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

export default UsersSection;