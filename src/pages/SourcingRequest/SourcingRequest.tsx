import { useEffect, useState, useCallback, useMemo } from "react";

import {
  Search,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  User,
  Mail,
  Building2,
  Calendar,
  Inbox,
  ChevronDown,
  Paperclip,
  ZoomIn,
  ImageOff,
} from "lucide-react";

import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import {
  GetAllSourcingRequestsAPI,
  UpdateSourcingRequestStatusAPI,
} from "@/services/Api/SourcingRequestApi";

import "./SourcingRequests.scss";

const ITEMS_PER_PAGE = 100;

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REJECTED", label: "Rejected" },
  { value: "COMPLETED", label: "Completed" },
];

const getInitials = (name?: string) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  return (parts[0]?.[0] || "").concat(parts[1]?.[0] || "").toUpperCase();
};

// Small thumbnail with its own loading/error state, so a slow-loading
// image (large AVIF, cold CDN cache, etc.) shows a shimmer instead of a
// blank tile, and a failed load shows a clear broken-image indicator
// instead of the browser's default icon.
const AttachmentThumb: React.FC<{
  fileUri: string;
  fileName?: string;
  isPrimary?: boolean;
  onClick: () => void;
}> = ({ fileUri, fileName, isPrimary, onClick }) => {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );

  return (
    <button
      className="attachment-thumb"
      onClick={onClick}
      title={fileName}
      disabled={status === "error"}
    >
      {status === "loading" && <span className="thumb-shimmer" />}
      {status === "error" ? (
        <span className="thumb-error">
          <ImageOff size={16} />
        </span>
      ) : (
        <img
          src={fileUri}
          alt={fileName || ""}
          style={{ opacity: status === "loaded" ? 1 : 0 }}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
      )}
      {status === "loaded" && (
        <span className="attachment-thumb-zoom">
          <ZoomIn size={16} />
        </span>
      )}
      {isPrimary && status === "loaded" && (
        <span className="attachment-primary-tag">Primary</span>
      )}
    </button>
  );
};

const SourcingRequests = () => {

  const [allRequests, setAllRequests] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [viewModal, setViewModal] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxLoaded, setLightboxLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusChange, setStatusChange] = useState<{
    id: number;
    from: string;
    to: string;
  } | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await GetAllSourcingRequestsAPI();
      setAllRequests(res.data.data?.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to Load", { description: "Failed to load sourcing requests." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allRequests;

    return allRequests.filter(
      (request) =>
        request.name?.toLowerCase().includes(q) ||
        request.email?.toLowerCase().includes(q) ||
        request.company?.toLowerCase().includes(q) ||
        request.requested_name?.toLowerCase().includes(q),
    );
  }, [allRequests, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRequests.length / ITEMS_PER_PAGE),
  );

  const pagedRequests = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredRequests.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRequests, page]);

  const formatDate = (date: string) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const updateStatus = async (id: number, status: string, note: string) => {
    try {
      setUpdatingStatus(true);

      // Status + note go in one call — the backend sends the status-change
      // email using this note, so there's no separate "edit notes" endpoint.
      await UpdateSourcingRequestStatusAPI(
        id,
        status as "PENDING" | "IN_REVIEW" | "ACCEPTED" | "REJECTED" | "COMPLETED",
        note,
      );

      setAllRequests((prev) =>
        prev.map((request) =>
          request.id === id
            ? { ...request, status, admin_notes: note }
            : request,
        ),
      );

      setSelectedRequest((prev: any) =>
        prev?.id === id ? { ...prev, status, admin_notes: note } : prev,
      );

      toast.success("Status Updated", { description: "Status updated and the customer has been notified." });

      setStatusChange(null);
      setStatusNote("");
    } catch (err: any) {
      console.error(err);
      toast.error("Update Failed", { description: err.response?.data?.message || "Failed to update sourcing request status." });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const openLightbox = (uri: string) => {
    setLightboxLoaded(false);
    setLightboxImage(uri);
  };

  const closeLightbox = () => {
    setLightboxImage(null);
    setLightboxLoaded(false);
  };

  // Esc closes the lightbox too, as a second way out besides the button.
  useEffect(() => {
    if (!lightboxImage) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxImage]);

  return (
    <div className="sourcing-page">
      <div className="sourcing-header">
        <div>
          <h1>Sourcing Requests</h1>
          <p>Manage customer brand and product requests</p>
        </div>

        <div className="header-actions">
          <div className="search-box">
            <Search size={17} />
            <input
              type="text"
              placeholder="Search by name, email, company or request..."
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
            <p>Loading sourcing requests...</p>
          </div>
        ) : pagedRequests.length === 0 ? (
          <div className="empty-state">
            <Inbox size={38} strokeWidth={1.5} />
            <p>No sourcing requests found</p>
          </div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer</th>
                  <th>Company</th>
                  <th>Request</th>
                  <th className="status-column">Status</th>
                  <th className="date-column">Date</th>
                  <th className="actions-column">Actions</th>
                </tr>
              </thead>

              <tbody>
                {pagedRequests.map((request, idx) => (
                  <tr key={request.id}>
                    <td className="index-cell">
                      {(page - 1) * ITEMS_PER_PAGE + idx + 1}
                    </td>

                    <td>
                      <div className="customer-cell">
                        <div className="avatar">{getInitials(request.name)}</div>
                        <div className="customer-meta">
                          <span className="customer-name">{request.name}</span>
                          <span className="customer-email">{request.email}</span>
                        </div>
                      </div>
                    </td>

                    <td>{request.company || "—"}</td>

                    <td>
                      <span className="requested-name">
                        {request.requested_name}
                      </span>
                      {request.attachments?.length > 0 && (
                        <span
                          className="attachment-indicator"
                          title={`${request.attachments.length} attachment${request.attachments.length === 1 ? "" : "s"}`}
                        >
                          <Paperclip size={11} />
                          {request.attachments.length}
                        </span>
                      )}
                    </td>

                    <td>
                      <div className="status-select-wrapper">
                        <select
                          className={`status-select status-${request.status?.toLowerCase()}`}
                          value={request.status}
                          onChange={(e) =>
                            setStatusChange({
                              id: request.id,
                              from: request.status,
                              to: e.target.value,
                            })
                          }
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="status-select-chevron" />
                      </div>
                    </td>

                    <td className="date-cell">{formatDate(request.created_at)}</td>

                    <td>
                      <div className="action-buttons">
                        <button
                          className="view-btn"
                          onClick={() => {
                            setSelectedRequest(request);
                            setViewModal(true);
                          }}
                        >
                          <Eye size={17} strokeWidth={2.25} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pagination">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
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

      {viewModal && selectedRequest && (
        <div className="modal-overlay" onClick={() => setViewModal(false)}>
          <Card className="view-card" onClick={(e) => e.stopPropagation()}>
            <div className="view-card-header">
              <div>
                <h2>Sourcing Request</h2>
                <span className="request-id">Request #{selectedRequest.id}</span>
              </div>
              <button className="icon-close-btn" onClick={() => setViewModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="view-card-body">
              <div className="request-summary">
                <span
                  className={`status-badge status-${selectedRequest.status?.toLowerCase()}`}
                >
                  {selectedRequest.status?.replace("_", " ")}
                </span>

                <h3>{selectedRequest.requested_name}</h3>
              </div>

              <Separator />

              <div className="detail-item">
                <User className="detail-icon" />
                <div>
                  <p className="detail-label">Name</p>
                  <p className="detail-value">{selectedRequest.name}</p>
                </div>
              </div>

              <Separator />

              <div className="detail-item">
                <Mail className="detail-icon" />
                <div>
                  <p className="detail-label">Email</p>
                  <p className="detail-value">{selectedRequest.email}</p>
                </div>
              </div>

              <Separator />

              <div className="detail-item">
                <Building2 className="detail-icon" />
                <div>
                  <p className="detail-label">Company</p>
                  <p className="detail-value">{selectedRequest.company || "—"}</p>
                </div>
              </div>

              <Separator />

              <div className="detail-item">
                <Calendar className="detail-icon" />
                <div>
                  <p className="detail-label">Received</p>
                  <p className="detail-value">
                    {formatDate(selectedRequest.created_at)}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="message-section">
                <p className="detail-label">Customer Details</p>
                <div className="message-box">
                  {selectedRequest.details || "No additional details provided."}
                </div>
              </div>

              {selectedRequest.attachments?.length > 0 && (
                <>
                  <Separator />
                  <div className="message-section">
                    <p className="detail-label">
                      Attachments ({selectedRequest.attachments.length})
                    </p>
                    <div className="attachment-grid">
                      {selectedRequest.attachments.map((att: any) => (
                        <AttachmentThumb
                          key={att.id}
                          fileUri={att.file_uri}
                          fileName={att.file_name}
                          isPrimary={att.is_primary}
                          onClick={() => openLightbox(att.file_uri)}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {selectedRequest.admin_notes && (
                <>
                  <Separator />
                  <div className="message-section">
                    <p className="detail-label">Admin Notes</p>
                    <div className="message-box admin-notes-box">
                      {selectedRequest.admin_notes}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="view-card-footer">
              <button className="cancel-btn" onClick={() => setViewModal(false)}>
                Close
              </button>
            </div>
          </Card>
        </div>
      )}

      {lightboxImage && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <button
            className="lightbox-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              closeLightbox();
            }}
            aria-label="Close"
          >
            <X size={20} />
          </button>

          {!lightboxLoaded && (
            <div className="lightbox-spinner" onClick={(e) => e.stopPropagation()} />
          )}

          <img
            src={lightboxImage}
            alt=""
            className="lightbox-image"
            style={{ opacity: lightboxLoaded ? 1 : 0 }}
            onLoad={() => setLightboxLoaded(true)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {statusChange && (
        <div
          className="modal-overlay"
          onClick={() => {
            setStatusChange(null);
            setStatusNote("");
          }}
        >
          <div
            className="status-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Update Status</h3>
            <p>
              Changing status to{" "}
              <span
                className={`status-badge status-${statusChange.to.toLowerCase()}`}
              >
                {statusChange.to.replace("_", " ")}
              </span>
              . This note will be included in the email sent to the customer.
            </p>

            <textarea
              className="notes-textarea"
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              placeholder="Add a note for the customer..."
              rows={4}
              autoFocus
            />

            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => {
                  setStatusChange(null);
                  setStatusNote("");
                }}
                disabled={updatingStatus}
              >
                Cancel
              </button>

              <button
                className="confirm-status-btn"
                onClick={() =>
                  updateStatus(statusChange.id, statusChange.to, statusNote)
                }
                disabled={updatingStatus}
              >
                {updatingStatus ? "Updating..." : "Update & Notify"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SourcingRequests;