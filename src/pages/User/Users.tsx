/** @format */

import { useEffect, useState, useCallback, useMemo } from "react";

import {
  Search,
  Trash2,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import {
  GetAllUsersAPI,
  DeleteUserAPI,
} from "@/services/Api/UserApi";

import "./Users.scss";

const ITEMS_PER_PAGE = 100;

const UsersPage = () => {
  const navigate = useNavigate();

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [deleteModal, setDeleteModal] =
    useState(false);

  const [selectedUserId, setSelectedUserId] =
    useState<number | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const res = await GetAllUsersAPI({
        page: 1,
        limit: 10000,
      });

      const payload = res.data.data;

      setAllUsers(payload.rows || []);
    } catch (err) {
      console.error("Failed to load users", err);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return allUsers;

    return allUsers.filter(
      (u) =>
        u.user_profile?.name
          ?.toLowerCase()
          .includes(q) ||
        u.email?.toLowerCase().includes(q),
    );
  }, [allUsers, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredUsers.length / ITEMS_PER_PAGE,
    ),
  );

  const pagedUsers = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;

    return filteredUsers.slice(
      start,
      start + ITEMS_PER_PAGE,
    );
  }, [filteredUsers, page]);

  const handleDelete = async () => {
    if (!selectedUserId) return;

    try {
      await DeleteUserAPI([selectedUserId]);

      setAllUsers((prev) =>
        prev.filter(
          (u) => u.id !== selectedUserId,
        ),
      );

      setDeleteModal(false);
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const formatDate = (date: string) => {
    if (!date) return "—";

    return new Date(date).toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      },
    );
  };

  return (
    <div className="users-page">
      <div className="users-header">
        <div>
          <h1>Users</h1>
          <p>Manage platform users</p>
        </div>

        <div className="header-actions">
          <div className="search-box">
            <Search size={18} />

            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />

            {search && (
              <button
                className="clear-btn"
                onClick={() => setSearch("")}
              >
                <X size={15} />
              </button>
            )}
          </div>

          <button
            className="add-btn"
            onClick={() =>
              navigate("/users/add")
            }
          >
            <Plus size={18} />
            Add User
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Email</th>
              <th>Mobile</th>
              <th>Status</th>
              <th>Joined</th>
              <th className="actions-column">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {pagedUsers.map((u, idx) => (
              <tr key={u.id}>
                <td>
                  {(page - 1) *
                    ITEMS_PER_PAGE +
                    idx +
                    1}
                </td>

                <td>
                  {u.user_profile?.name ||
                    "Unnamed User"}
                </td>

                <td>{u.email}</td>

                <td>
                  {u.user_profile?.mobile ||
                    "—"}
                </td>

                <td>
                  <span
                    className={`status-badge ${
                      u.status?.toLowerCase() ===
                      "accepted"
                        ? "success"
                        : u.status?.toLowerCase() ===
                          "rejected"
                        ? "danger"
                        : "neutral"
                    }`}
                  >
                    {u.status || "Pending"}
                  </span>
                </td>

                <td>
                  {formatDate(
                    u.user_profile?.created_at,
                  )}
                </td>

                <td>
                  <div className="action-buttons">
                    <button
                      className="delete-btn"
                      onClick={() => {
                        setSelectedUserId(
                          u.id,
                        );

                        setDeleteModal(true);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pagination">
          <button
            disabled={page === 1}
            onClick={() =>
              setPage((p) => p - 1)
            }
          >
            <ChevronLeft size={16} />
          </button>

          <span>
            {page} / {totalPages}
          </span>

          <button
            disabled={page === totalPages}
            onClick={() =>
              setPage((p) => p + 1)
            }
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {deleteModal && (
        <div
          className="modal-overlay"
          onClick={() =>
            setDeleteModal(false)
          }
        >
          <div
            className="modal-content"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <h3>Delete User</h3>

            <p>
              Are you sure you want to delete
              this user?
            </p>

            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() =>
                  setDeleteModal(false)
                }
              >
                Cancel
              </button>

              <button
                className="confirm-btn"
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;