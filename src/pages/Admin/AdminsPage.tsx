/** @format */

import { useEffect, useState, useMemo, useCallback } from "react";

import {
  Search,
  Trash2,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Edit,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import {
  GetAllAdminsAPI,
  DeleteAdminAPI,
} from "@/services/Api/AdminApi";

import "./Admins.scss";

const ITEMS_PER_PAGE = 50;

const AdminsPage = () => {
  const navigate = useNavigate();

  const [allAdmins, setAllAdmins] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [deleteModal, setDeleteModal] =
    useState(false);

  const [selectedAdminId, setSelectedAdminId] =
    useState<number | null>(null);

  const loadAdmins = useCallback(async () => {
    try {
      const res = await GetAllAdminsAPI({
        page: 1,
        limit: 10000,
      });

      setAllAdmins(res.data.data || []);
    } catch (err) {
      console.error("Failed to load admins", err);
    }
  }, []);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const filteredAdmins = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return allAdmins;

    return allAdmins.filter(
      (a) =>
        a.name?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q),
    );
  }, [allAdmins, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAdmins.length / ITEMS_PER_PAGE),
  );

  const pagedAdmins = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;

    return filteredAdmins.slice(
      start,
      start + ITEMS_PER_PAGE,
    );
  }, [filteredAdmins, page]);

  const handleDelete = async () => {
    if (!selectedAdminId) return;

    try {
      await DeleteAdminAPI([selectedAdminId]);

      setAllAdmins((prev) =>
        prev.filter((a) => a.id !== selectedAdminId),
      );

      setDeleteModal(false);
    } catch (err) {
      console.error(err);
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
    <div className="admins-page">
      <div className="admins-header">
        <div>
          <h1>Admins</h1>
          <p>Manage platform admins</p>
        </div>

        <div className="header-actions">
          <div className="search-box">
            <Search size={18} />

            <input
              type="text"
              placeholder="Search admins..."
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
              navigate("/admins/add")
            }
          >
            <Plus size={18} />
            Add Admin
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
              <th>Role</th>
              <th>Created</th>
              <th className="actions-column">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {pagedAdmins.map((a, idx) => (
              <tr key={a.id}>
                <td>
                  {(page - 1) *
                    ITEMS_PER_PAGE +
                    idx +
                    1}
                </td>

                <td>{a.name}</td>

                <td>{a.email}</td>

                <td>
                  <span className="role-badge">
                    {a.admin_role?.name}
                  </span>
                </td>

                <td>
                  {formatDate(a.created_at)}
                </td>

                <td>
                  <div className="action-buttons">
                    <button
                      className="edit-btn"
                      onClick={() =>
                        navigate(
                          `/admins/edit/${a.id}`,
                        )
                      }
                    >
                      <Edit size={16} />
                    </button>

                    <button
                      className="delete-btn"
                      onClick={() => {
                        setSelectedAdminId(
                          a.id,
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
            <h3>Delete Admin</h3>

            <p>
              Are you sure you want to delete
              this admin?
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

export default AdminsPage;