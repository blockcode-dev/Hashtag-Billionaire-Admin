import { useEffect, useState } from "react";

import {
  Search,
  Trash2,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  User,
  Mail,
  Phone,
  MessageSquare,
  Calendar,
  Inbox,
} from "lucide-react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

import {
  GetAllContactUsAPI,
  DeleteContactUsAPI,
  UpdateContactUsStatusAPI,
  type ContactUsStatus,
} from "@/services/Api/ContactUsApi";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Combobox } from "@/components/common/Combobox";

import "./ContactUs.scss";

// Paged, searched and filtered by the backend (at most 100 a page).
const ITEMS_PER_PAGE = 50;

const STATUS_OPTIONS: { value: ContactUsStatus; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "CLOSED", label: "Closed" },
];

const getInitials = (name?: string) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  return (parts[0]?.[0] || "").concat(parts[1]?.[0] || "").toUpperCase();
};

const ContactUsPage = () => {

  const [contacts, setContacts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContactUsStatus | "">("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [viewModal, setViewModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // The request the table last finished; it's loading until the current one has.
  const requestKey = `${page}|${debouncedSearch}|${statusFilter}|${reloadKey}`;
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const loading = settledKey !== requestKey;

  // Search once typing pauses, from the first page.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    const key = `${page}|${debouncedSearch}|${statusFilter}|${reloadKey}`;
    GetAllContactUsAPI({
      page,
      limit: ITEMS_PER_PAGE,
      search: debouncedSearch || undefined,
      status: statusFilter || undefined,
    })
      .then((res) => {
        if (!active) return;
        const payload = res.data?.data ?? {};
        setContacts(payload.data || []);
        setTotal(payload.pagination?.total ?? 0);
        setTotalPages(Math.max(1, payload.pagination?.totalPages ?? 1));
      })
      .catch((err: any) => {
        if (!active) return;
        setContacts([]);
        toast.error("Couldn't load inquiries", {
          description: err.response?.data?.message || "Try again in a moment.",
        });
      })
      .finally(() => {
        if (active) setSettledKey(key);
      });
    return () => {
      active = false;
    };
  }, [page, debouncedSearch, statusFilter, reloadKey]);

  const formatDate = (date: string) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      await UpdateContactUsStatusAPI(id, status as ContactUsStatus);

      setContacts((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status } : c)),
      );

      toast.success("Status Updated", { description: "Inquiry status updated successfully." });
    } catch (err: any) {
      console.error(err);

      toast.error("Update Failed", { description: err.response?.data?.message || "Failed to update inquiry status." });
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;

    try {
      await DeleteContactUsAPI(selectedId);

      setDeleteModal(false);
      // Reload so the page refills; step back if that was its last inquiry.
      if (contacts.length === 1 && page > 1) setPage((p) => p - 1);
      else setReloadKey((k) => k + 1);

      toast.success("Inquiry Deleted", { description: "The contact inquiry has been deleted successfully." });
    } catch (err: any) {
      console.error(err);

      toast.error("Delete Failed", { description: err.response?.data?.message || "Unable to delete inquiry." });
    }
  };

  return (
    <div className="contact-page">
      <div className="users-header">
        <div>
          <h1>Contact Us</h1>
          <p>Manage customer inquiries</p>
        </div>

        <div className="header-actions">
          <Combobox
            searchable={false}
            allowClear
            placeholder="All statuses"
            style={{ width: 170, height: 44 }}
            value={statusFilter || undefined}
            onChange={(value) => {
              setStatusFilter(value ?? "");
              setPage(1);
            }}
            options={STATUS_OPTIONS}
          />

          <div className="search-box">
            <Search size={17} />

            <input
              type="text"
              aria-label="Search inquiries"
              placeholder="Search name, email, reason or message..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {search && (
              <button className="clear-btn" onClick={() => setSearch("")}>
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        {loading ? (
          <div className="empty-state">
            <p>Loading inquiries...</p>
          </div>
        ) : contacts.length === 0 ? (
          <div className="empty-state">
            <Inbox size={38} strokeWidth={1.5} />
            <p>
              {debouncedSearch || statusFilter
                ? "No inquiries match these filters"
                : "No inquiries yet"}
            </p>
          </div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Contact</th>
                  <th>Mobile</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th className="actions-column">Actions</th>
                </tr>
              </thead>

              <tbody>
                {contacts.map((c, idx) => (
                  <tr key={c.id}>
                    <td className="index-cell">
                      {(page - 1) * ITEMS_PER_PAGE + idx + 1}
                    </td>

                    <td>
                      <div className="contact-cell">
                        <div className="avatar">{getInitials(c.name)}</div>
                        <div className="contact-meta">
                          <span className="contact-name">{c.name}</span>
                          <span className="contact-email">{c.email}</span>
                        </div>
                      </div>
                    </td>

                    <td>{c.mobile || "—"}</td>

                    <td>
                      <span className="reason-text">{c.reason}</span>
                    </td>

                    <td>
                      <div className="status-select-wrapper">
                        <select
                          className={`status-select status-${c.status?.toLowerCase()}`}
                          value={c.status}
                          onChange={(e) => updateStatus(c.id, e.target.value)}
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={14}
                          className="status-select-chevron"
                        />
                      </div>
                    </td>

                    <td>{formatDate(c.created_at)}</td>

                    <td>
                      <div className="action-buttons">
                        <button
                          className="view-btn"
                          onClick={() => {
                            setSelectedContact(c);
                            setViewModal(true);
                          }}
                        >
                          <Eye size={22} strokeWidth={2.25} />
                        </button>

                        <button
                          className="delete-btn"
                          onClick={() => {
                            setSelectedId(c.id);
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
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={16} />
              </button>

              <span>
                {page} / {totalPages} · {total.toLocaleString()}{" "}
                {total === 1 ? "inquiry" : "inquiries"}
              </span>

              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}
      </div>

      {viewModal && selectedContact && (
        <div className="modal-overlay" onClick={() => setViewModal(false)}>
          <Card className="view-card" onClick={(e) => e.stopPropagation()}>
            <div className="view-card-header">
              <h2>Contact Inquiry</h2>
              <button
                className="icon-close-btn"
                onClick={() => setViewModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="view-card-body">
              <div className="detail-item">
                <User className="detail-icon" />
                <div>
                  <p className="detail-label">Name</p>
                  <p className="detail-value">{selectedContact.name}</p>
                </div>
              </div>

              <Separator />

              <div className="detail-item">
                <Mail className="detail-icon" />
                <div>
                  <p className="detail-label">Email</p>
                  <p className="detail-value">{selectedContact.email}</p>
                </div>
              </div>

              <Separator />

              <div className="detail-item">
                <Phone className="detail-icon" />
                <div>
                  <p className="detail-label">Mobile</p>
                  <p className="detail-value">
                    {selectedContact.mobile || "—"}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="detail-item">
                <MessageSquare className="detail-icon" />
                <div>
                  <p className="detail-label">Reason</p>
                  <p className="detail-value">{selectedContact.reason}</p>
                </div>
              </div>

              <Separator />

              <div className="detail-item">
                <Calendar className="detail-icon" />
                <div>
                  <p className="detail-label">Received</p>
                  <p className="detail-value">
                    {formatDate(selectedContact.created_at)}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="message-section">
                <p className="detail-label">Customer Message</p>
                <div className="message-box">{selectedContact.message}</div>
              </div>
            </div>

            <div className="view-card-footer">
              <button
                className="cancel-btn"
                onClick={() => setViewModal(false)}
              >
                Close
              </button>
            </div>
          </Card>
        </div>
      )}

      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Inquiry</h3>
            <p>
              Are you sure you want to delete this inquiry? This action cannot
              be undone.
            </p>

            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setDeleteModal(false)}
              >
                Cancel
              </button>

              <button className="confirm-btn" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactUsPage;
