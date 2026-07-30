import { useEffect, useState, useCallback, useMemo } from "react";

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
import { useToast } from "@/hooks/use-toast";

import {
  GetAllContactUsAPI,
  DeleteContactUsAPI,
  UpdateContactUsStatusAPI,
} from "@/services/Api/ContactUsApi";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import "./ContactUs.scss";

const ITEMS_PER_PAGE = 100;

const STATUS_OPTIONS = [
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
  const { toast } = useToast();

  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [viewModal, setViewModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await GetAllContactUsAPI();
      setAllContacts(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allContacts;

    return allContacts.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.reason?.toLowerCase().includes(q),
    );
  }, [allContacts, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredContacts.length / ITEMS_PER_PAGE),
  );

  const pagedContacts = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredContacts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredContacts, page]);

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
      await UpdateContactUsStatusAPI(id, status as any);

      setAllContacts((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status } : c)),
      );

      toast({
        title: "Status Updated",
        description: "Inquiry status updated successfully.",
      });
    } catch (err: any) {
      console.error(err);

      toast({
        title: "Update Failed",
        description:
          err.response?.data?.message || "Failed to update inquiry status.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;

    try {
      await DeleteContactUsAPI(selectedId);

      setAllContacts((prev) => prev.filter((c) => c.id !== selectedId));
      setDeleteModal(false);

      toast({
        title: "Inquiry Deleted",
        description: "The contact inquiry has been deleted successfully.",
      });
    } catch (err: any) {
      console.error(err);

      toast({
        title: "Delete Failed",
        description: err.response?.data?.message || "Unable to delete inquiry.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="users-page">
      <div className="users-header">
        <div>
          <h1>Contact Us</h1>
          <p>Manage customer inquiries</p>
        </div>

        <div className="header-actions">
          <div className="search-box">
            <Search size={17} />

            <input
              type="text"
              placeholder="Search by name, email or reason..."
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
        ) : pagedContacts.length === 0 ? (
          <div className="empty-state">
            <Inbox size={38} strokeWidth={1.5} />
            <p>No inquiries found</p>
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
                {pagedContacts.map((c, idx) => (
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
                {page} / {totalPages}
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
