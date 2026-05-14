/** @format */

import { useEffect, useState, useCallback, useMemo } from "react";
import { Search, Eye, Trash2, Plus, Users, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GetAllUsersAPI, DeleteUserAPI } from "@/services/Api/UserApi";

import "./Users.scss";

const ITEMS_PER_PAGE = 100;

const UsersPage = () => {
  const navigate = useNavigate();
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await GetAllUsersAPI({
        page: 1,
        limit: 10000, // fetch all for frontend search/pagination
      });

      const payload = res.data.data;
      setAllUsers(payload.rows || []);
    } catch (err) {
      console.error("Failed to load users", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Frontend search filter
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allUsers;
    return allUsers.filter(
      (u) =>
        u.user_profile?.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    );
  }, [allUsers, search]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE));

  const pagedUsers = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, page]);

  const handleDelete = async () => {
    if (!selectedUserId) return;
    try {
      await DeleteUserAPI([selectedUserId]);
      setAllUsers((prev) => prev.filter((u) => u.id !== selectedUserId));
      setDeleteModal(false);
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleClearSearch = () => {
    setSearch("");
    setPage(1);
  };

  const formatDate = (date: string) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Smart pagination: show limited page buttons
  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("...");
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  const startIndex = (page - 1) * ITEMS_PER_PAGE;

  return (
    <div className="users-container">
      <header className="users-header">
        <div className="title-section">
          <div className="title-row">
            <Users size={28} className="title-icon" />
            <h1>Users List</h1>
          </div>
          <p>
            {loading
              ? "Loading members..."
              : `${filteredUsers.length.toLocaleString()} member${filteredUsers.length !== 1 ? "s" : ""}${search ? " found" : " total"}`}
          </p>
        </div>

        <div className="action-bar">
          <div className={`search-wrapper ${search ? "has-value" : ""}`}>
            <Search className="search-icon" size={17} />
            <input
              type="text"
              placeholder="Search name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="clear-search" onClick={handleClearSearch} title="Clear search">
                <X size={15} />
              </button>
            )}
          </div>

          <button className="add-user-btn" onClick={() => navigate("/users/add")}>
            <Plus size={18} />
            <span>Add User</span>
          </button>
        </div>
      </header>

      <div className="table-card">
        {loading && <div className="loading-bar"><div className="loading-bar-inner" /></div>}

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th style={{ width: 60 }}>SR.</th>
                <th>USER</th>
                <th>CONTACT INFO</th>
                <th>STATUS</th>
                <th>JOINED DATE</th>
                <th className="text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="skeleton-row">
                    <td><div className="skeleton skeleton-sm" /></td>
                    <td>
                      <div className="user-profile-cell">
                        <div className="skeleton skeleton-avatar" />
                        <div>
                          <div className="skeleton skeleton-text" />
                          <div className="skeleton skeleton-text-sm" />
                        </div>
                      </div>
                    </td>
                    <td><div className="skeleton skeleton-text" /><div className="skeleton skeleton-text-sm" /></td>
                    <td><div className="skeleton skeleton-badge" /></td>
                    <td><div className="skeleton skeleton-text-sm" /></td>
                    <td><div className="skeleton skeleton-actions" /></td>
                  </tr>
                ))
              ) : pagedUsers.length > 0 ? (
                pagedUsers.map((u, idx) => (
                  <tr key={u.id}>
                    <td>
                      <span className="sr-no">{startIndex + idx + 1}</span>
                    </td>
                    <td>
                      <div className="user-profile-cell">
                        <div className="avatar-square">
                          {u.user_profile?.name?.charAt(0)?.toUpperCase() || <Users size={15} />}
                        </div>
                        <div className="user-info">
                          <span className="user-name">{u.user_profile?.name || "Unnamed User"}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="contact-info">
                        <span className="email">{u.email}</span>
                        <span className="phone">{u.user_profile?.mobile || "—"}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          u.status?.toLowerCase() === "accepted"
                            ? "badge-success"
                            : u.status?.toLowerCase() === "rejected"
                            ? "badge-danger"
                            : "badge-neutral"
                        }`}
                      >
                        {u.status || "Pending"}
                      </span>
                    </td>
                    <td className="date-cell">{formatDate(u.user_profile?.created_at)}</td>
                    <td>
                      <div >
                        {/* <button
                          className="icon-btn view"
                          title="View Details"
                          onClick={() => navigate(`/users/view/${u.id}`)}
                        >
                          <Eye size={16} />
                        </button> */}
                        <button
                          className="icon-btn delete"
                          title="Delete User"
                          onClick={() => {
                            setSelectedUserId(u.id);
                            setDeleteModal(true);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="empty-state">
                    <div className="empty-inner">
                      <Users size={40} />
                      <p>No users found{search ? ` for "${search}"` : ""}.</p>
                      {search && (
                        <button className="clear-link" onClick={handleClearSearch}>
                          Clear search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredUsers.length > 0 && (
          <footer className="table-footer">
            <p className="results-count">
              Showing {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, filteredUsers.length)} of{" "}
              {filteredUsers.length.toLocaleString()}
            </p>
            <div className="pagination-controls">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="pag-btn">
                <ChevronLeft size={16} />
              </button>
              {getPageNumbers().map((p, i) =>
                p === "..." ? (
                  <span key={`ellipsis-${i}`} className="ellipsis">…</span>
                ) : (
                  <button
                    key={p}
                    className={`pag-num ${page === p ? "active" : ""}`}
                    onClick={() => setPage(p as number)}
                  >
                    {p}
                  </button>
                )
              )}
              <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="pag-btn">
                <ChevronRight size={16} />
              </button>
            </div>
          </footer>
        )}
      </div>

      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-warning-icon">
              <Trash2 size={22} />
            </div>
            <h3>Remove User</h3>
            <p>This action is permanent. All data associated with this user will be removed from the system.</p>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setDeleteModal(false)}>
                Cancel
              </button>
              <button className="btn-danger" onClick={handleDelete}>
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;