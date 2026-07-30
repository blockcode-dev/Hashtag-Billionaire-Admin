/** @format */

import { useEffect, useState, useCallback } from "react";
import { Table, Input, Empty, Select, Modal, Tabs } from "antd";
import { SearchOutlined, EyeOutlined } from "@ant-design/icons";
import "./Order.scss";
import { GetAdminOrdersAPI } from "@/services/Api/OrderApi";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface PricingRow {
  type: string;
  location?: string;
  quantity: number;
  price_per_item: number;
  total: number;

  customization_type?: "AUTO" | "MANUAL";
  print_method?: string;
  custom_text?: string;
}

interface PricingBreakdown {
  actual_product_price: number;
  supplier_markup: number;
  final_product_price: number;
  customization_price: number;
  setup_fee: number;
  final_price_per_item: number;
  final_total: number;
  pricing_table: PricingRow[];
}

interface OrderItem {
  product_id: number;
  product_name: string;
  variant_id: number;
  sku: string;
  color: string;
  size: string;
  original_image: string;
  customized_image: string;
  price: number;
  quantity: number;
  total: number;
  customization_config: {
    type: "AUTO" | "MANUAL";
    print_method: string;
    locations: { id: string }[];
    quantity: number;
    custom_text: string;
  };
  pricing_breakdown: PricingBreakdown;
}

interface Order {
  id: number;
  order_number: string;
  created_at: string;
  subtotal_amount: number;
  shipping_amount: number;
  total_amount: number;
  status: string;
  payment_status: string;
  shipment_status: string;
  payment_method: string;
  carrier: string;
  tracking_number: string;
  tracking_url: string;
  label_url: string;
  user: { id: number; name: string; email: string };
  preview: {
    product_name: string;
    original_image: string;
    customized_image: string;
    total_items: number;
    customization_type: "AUTO" | "MANUAL";
    print_method: string;
    custom_text?: string;
    customization_summary: PricingRow[];
  };
  items: OrderItem[];
}

// ─────────────────────────────────────────────
// Status / Payment configs
// ─────────────────────────────────────────────
const ORDER_STATUS: Record<
  string,
  { color: string; bg: string; dot: string; label: string; desc: string }
> = {
  PENDING: {
    color: "#92400e",
    bg: "#fef3c7",
    dot: "#f59e0b",
    label: "Pending",
    desc: "Received but not yet processed. Payment may still be confirming.",
  },
  SUCCESS: {
    color: "#065f46",
    bg: "#d1fae5",
    dot: "#10b981",
    label: "Success",
    desc: "Order completed successfully end-to-end.",
  },
  SHIPPED: {
    color: "#1e40af",
    bg: "#dbeafe",
    dot: "#3b82f6",
    label: "Shipped",
    desc: "Label created and package handed to carrier.",
  },
  FAILED: {
    color: "#991b1b",
    bg: "#fee2e2",
    dot: "#ef4444",
    label: "Failed",
    desc: "Could not be fulfilled. Check payment or supplier errors.",
  },
  CANCELLED: {
    color: "#4b5563",
    bg: "#f3f4f6",
    dot: "#9ca3af",
    label: "Cancelled",
    desc: "Cancelled by customer or admin before fulfilment.",
  },
  IN_TRANSIT: {
    color: "#1e40af",
    bg: "#dbeafe",
    dot: "#3b82f6",
    label: "In Transit",
    desc: "Moving through the carrier network toward destination.",
  },
  OUT_FOR_DELIVERY: {
    color: "#5b21b6",
    bg: "#ede9fe",
    dot: "#8b5cf6",
    label: "Out for Delivery",
    desc: "On the delivery vehicle — expected today.",
  },
  DELIVERED: {
    color: "#065f46",
    bg: "#d1fae5",
    dot: "#10b981",
    label: "Delivered",
    desc: "Confirmed delivered to the recipient.",
  },
  RETURNED: {
    color: "#92400e",
    bg: "#ffedd5",
    dot: "#f97316",
    label: "Returned",
    desc: "Package returning to origin. Refund or reship needed.",
  },
  EXCEPTION: {
    color: "#7f1d1d",
    bg: "#fee2e2",
    dot: "#dc2626",
    label: "Exception",
    desc: "Delivery issue — bad address, customs hold, or missed delivery.",
  },
};

const PAYMENT_STATUS: Record<
  string,
  { color: string; bg: string; dot: string; label: string }
> = {
  SUCCESS: { color: "#065f46", bg: "#d1fae5", dot: "#10b981", label: "Paid" },
  PAID: { color: "#065f46", bg: "#d1fae5", dot: "#10b981", label: "Paid" },
  paid: { color: "#065f46", bg: "#d1fae5", dot: "#10b981", label: "Paid" },
  UNPAID: { color: "#92400e", bg: "#fef3c7", dot: "#f59e0b", label: "Unpaid" },
  unpaid: { color: "#92400e", bg: "#fef3c7", dot: "#f59e0b", label: "Unpaid" },
  PENDING: {
    color: "#1e40af",
    bg: "#dbeafe",
    dot: "#3b82f6",
    label: "Pending",
  },
  pending: {
    color: "#1e40af",
    bg: "#dbeafe",
    dot: "#3b82f6",
    label: "Pending",
  },
  FAILED: { color: "#991b1b", bg: "#fee2e2", dot: "#ef4444", label: "Failed" },
  failed: { color: "#991b1b", bg: "#fee2e2", dot: "#ef4444", label: "Failed" },
};

// ─────────────────────────────────────────────
// Lightbox component
// ─────────────────────────────────────────────
interface LightboxProps {
  src: string | null;
  label?: string;
  onClose: () => void;
}

const Lightbox = ({ src, label, onClose }: LightboxProps) => {
  // Close on Escape key
  useEffect(() => {
    if (!src) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button
        className="lightbox-close"
        onClick={onClose}
        aria-label="Close image preview"
      >
        ✕
      </button>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={label || "Preview"} className="lightbox-img" />
        {label && <div className="lightbox-label">{label}</div>}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Clickable image block — shows zoom cursor + opens lightbox
// ─────────────────────────────────────────────
interface ClickableImgProps {
  src: string;
  caption: string;
  small?: boolean;
  onOpen: (src: string, label: string) => void;
}

const ClickableImg = ({ src, caption, small, onOpen }: ClickableImgProps) => (
  <div className="img-block-wrap">
    <div
      className={`img-block${small ? " sm" : ""} clickable-img`}
      onClick={() => onOpen(src, caption)}
      title={`Click to enlarge — ${caption}`}
    >
      <img
        src={src}
        alt={caption}
        onError={(e) => (e.currentTarget.style.display = "none")}
      />
      <div className="img-zoom-hint">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </div>
    </div>
    <span className="img-caption">{caption}</span>
  </div>
);

// ─────────────────────────────────────────────
// Reusable badge
// ─────────────────────────────────────────────
const StatusBadge = ({
  value,
  map,
}: {
  value: string;
  map: Record<string, any>;
}) => {
  const cfg = map[value] ||
    map[value?.toUpperCase()] || {
      color: "#374151",
      bg: "#f3f4f6",
      dot: "#9ca3af",
      label: value,
    };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: cfg.bg,
        color: cfg.color,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: cfg.dot,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      {cfg.label || value?.replace(/_/g, " ")}
    </span>
  );
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const fmt$ = (n: number | undefined) => `$${Number(n || 0).toFixed(2)}`;

const fmtDate = (date: string) => {
  if (!date) return "--";
  const d = new Date(date);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const initials = (name: string) =>
  (name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

// ─────────────────────────────────────────────
// Order Detail Modal
// ─────────────────────────────────────────────
const OrderDetailModal = ({
  order,
  open,
  onClose,
}: {
  order: Order | null;
  open: boolean;
  onClose: () => void;
}) => {
  // ── Lightbox state lives here so it works across ALL tabs ──
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxLabel, setLightboxLabel] = useState<string>("");

  const openLightbox = useCallback((src: string, label: string) => {
    setLightboxSrc(src);
    setLightboxLabel(label);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxSrc(null);
    setLightboxLabel("");
  }, []);

  if (!order) return null;
  const o = order;

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        width={860}
        className="order-modal"
        title={null}
        closable
        destroyOnClose
      >
        {/* ── Hero banner ── */}
        <div className="om-hero">
          <div className="om-hero-left">
            <div className="om-order-num">{o.order_number}</div>
            <div className="om-date">{fmtDate(o.created_at)}</div>
            <div className="om-badges">
              <StatusBadge value={o.status} map={ORDER_STATUS} />
              <StatusBadge value={o.payment_status} map={PAYMENT_STATUS} />
              {/* {o.shipment_status && (
                <span className="om-extra-badge">
                  Shipment: <StatusBadge value={o.shipment_status} map={PAYMENT_STATUS} />
                </span>
              )} */}
            </div>
          </div>
          <div className="om-hero-right">
            <div className="om-total">{fmt$(o.total_amount)}</div>
            <div className="om-total-label">Grand Total</div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="om-body">
          <Tabs
            defaultActiveKey="overview"
            className="om-tabs"
            items={[
              {
                key: "overview",
                label: "Overview",
                children: <TabOverview order={o} onImageClick={openLightbox} />,
              },
              {
                key: "items",
                label: `Items (${o.items?.length || 0})`,
                children: <TabItems order={o} onImageClick={openLightbox} />,
              },
              {
                key: "pricing",
                label: "Pricing",
                children: <TabPricing order={o} />,
              },
              {
                key: "shipping",
                label: "Shipping",
                children: <TabShipping order={o} />,
              },
            ]}
          />
        </div>
      </Modal>

      {/* ── Lightbox renders OUTSIDE the modal so it covers everything ── */}
      <Lightbox
        src={lightboxSrc}
        label={lightboxLabel}
        onClose={closeLightbox}
      />
    </>
  );
};

// ─────────────────────────────────────────────
// Shared prop type for image click handler
// ─────────────────────────────────────────────
interface WithImageClick {
  onImageClick: (src: string, label: string) => void;
}

// ── Tab: Overview ────────────────────────────
const TabOverview = ({
  order: o,
  onImageClick,
}: { order: Order } & WithImageClick) => (
  <div className="tab-content">
    {/* Product preview */}
    <div className="section-card">
      <div className="section-title">Product Preview</div>
      <div className="product-preview-row">
        <div className="img-pair">
          <ClickableImg
            src={o.preview?.original_image}
            caption="Original"
            onOpen={onImageClick}
          />
          {o.preview?.customized_image && (
            <ClickableImg
              src={o.preview?.customized_image}
              caption={
                o.preview?.customization_type === "AUTO" ? "Logo" : "Customized"
              }
              onOpen={onImageClick}
            />
          )}
        </div>
        <div className="product-text">
          <div className="product-name">{o.preview?.product_name}</div>
          <div className="product-chips">
            <span className="chip">{o.preview?.total_items} items</span>

            {o.preview?.print_method && (
              <span className="chip">{o.preview?.print_method}</span>
            )}

            {o.preview?.customization_type && (
              <span className="chip">{o.preview?.customization_type}</span>
            )}

            {o.preview?.custom_text && (
              <span className="chip">"{o.preview?.custom_text}"</span>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Customer */}
    <div className="section-card">
      <div className="section-title">Customer</div>
      <div className="customer-row">
        <div className="avatar">{initials(o.user?.name)}</div>
        <div>
          <div className="cust-name">{o.user?.name || "--"}</div>
          <div className="cust-email">{o.user?.email || "--"}</div>
          {/* <div className="cust-id">ID: #{o.user?.id}</div> */}
        </div>
      </div>
    </div>

    {/* Order meta */}
    <div className="section-card">
      <div className="section-title">Order Details</div>
      <div className="kv-grid">
        <KV label="Order Number" value={o.order_number} mono />
        <KV label="Order Date" value={fmtDate(o.created_at)} />
        <KV
          label="Payment Method"
          value={o.payment_method?.replace(/_/g, " ") || "--"}
        />
        <KV label="Carrier" value={o.carrier?.toUpperCase() || "--"} />
      </div>
    </div>
  </div>
);

// ── Tab: Items ───────────────────────────────
const TabItems = ({
  order: o,
  onImageClick,
}: { order: Order } & WithImageClick) => (
  <div className="tab-content">
    {(o.items || []).map((item, i) => (
      <div className="section-card item-card" key={i}>
        <div className="item-header">
          <div className="img-pair">
            <ClickableImg
              src={item.original_image}
              caption="Original"
              small
              onOpen={onImageClick}
            />
            {item.customized_image && (
              <ClickableImg
                src={item.customized_image}
                caption={
                  item.customization_config?.type === "AUTO"
                    ? "Logo"
                    : "Customized"
                }
                small
                onOpen={onImageClick}
              />
            )}
          </div>
          <div className="item-meta">
            <div className="product-name">{item.product_name}</div>
            <div className="product-chips">
              <span className="chip">SKU: {item.sku}</span>
              <span className="chip">Variant: {item.variant_id}</span>
              <span className="chip">{item.color}</span>
              <span className="chip">Size: {item.size}</span>
            </div>
          </div>
          <div className="item-price-block">
            <div className="item-total">{fmt$(item.total)}</div>
            <div className="item-qty">
              {item.quantity} × {fmt$(item.price)}
            </div>
          </div>
        </div>

        {/* Customization config */}

        <div className="kv-grid">
          <KV
            label="Customization Type"
            value={item.customization_config?.type || "--"}
          />

          <KV
            label="Print Method"
            value={item.customization_config?.print_method || "--"}
          />

          <KV label="Quantity" value={String(item.quantity || 0)} />

          <KV
            label="Locations"
            value={
              item.customization_config?.locations
                ?.map((l: any) => l.location)
                .join(", ") || "--"
            }
          />

          <KV
            label="Custom Text"
            value={
              item.customization_config?.custom_text
                ? `"${item.customization_config?.custom_text}"`
                : "--"
            }
          />
        </div>

        {/* Customization pricing table */}
        {item.pricing_breakdown?.pricing_table?.length > 0 && (
          <>
            <div className="item-section-title" style={{ marginTop: 14 }}>
              Customization Pricing
            </div>
            <div className="pricing-table-wrap">
              <table className="pricing-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Location</th>
                    <th>Qty</th>
                    <th>Per Item</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {item.pricing_breakdown.pricing_table.map((row, ri) => (
                    <tr key={ri}>
                      <td>{row.print_method || row.type}</td>

                      <td>{row.location || "--"}</td>

                      <td>{row.quantity}</td>

                      <td>{fmt$(row.price_per_item)}</td>

                      <td className="td-bold">{fmt$(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    ))}
  </div>
);

// ── Tab: Pricing ─────────────────────────────
const TabPricing = ({ order: o }: { order: Order }) => {
  const item = o.items?.[0];
  const pb = item?.pricing_breakdown;

  return (
    <div className="tab-content">
      {pb && (
        <div className="section-card">
          <div className="section-title">Per-Item Breakdown</div>
          <div className="price-breakdown-list">
            <PriceRow
              label="Actual product price (supplier)"
              value={pb.actual_product_price}
              muted
            />
            <PriceRow
              label="Supplier markup"
              value={pb.supplier_markup}
              muted
            />
            <PriceRow
              label="Final product price"
              value={pb.final_product_price}
              bold
            />
            <PriceRow
              label={`Customization (${item?.customization_config?.print_method || "DTF"})`}
              value={pb.customization_price}
              muted
            />
            <PriceRow label="Setup fee" value={pb.setup_fee} muted />
            <div className="price-divider" />
            <PriceRow
              label="Price per item"
              value={pb.final_price_per_item}
              total
            />
          </div>
        </div>
      )}

      <div className="section-card">
        <div className="section-title">Order Totals</div>
        <div className="price-breakdown-list">
          <PriceRow
            label={`Subtotal (${o.preview?.total_items || 0} items × ${fmt$(item?.price)})`}
            value={o.subtotal_amount}
            muted
          />
          <PriceRow label="Shipping" value={o.shipping_amount} muted />
          {o.preview?.customization_summary?.map((cs, i) => (
            <PriceRow
              key={i}
              label={`Customization — ${cs.print_method || cs.type} ${cs.location ? `(${cs.location})` : ""} (${cs.quantity} × ${fmt$(cs.price_per_item)})`}
              value={cs.total}
              muted
            />
          ))}
          <div className="price-divider" />
          <PriceRow label="Grand Total" value={o.total_amount} total />
        </div>
      </div>
    </div>
  );
};

// ── Tab: Shipping ────────────────────────────
const TabShipping = ({ order: o }: { order: Order }) => (
  <div className="tab-content">
    <div className="section-card">
      <div className="section-title">Tracking</div>
      <div className="kv-grid">
        <KV label="Carrier" value={o.carrier?.toUpperCase() || "--"} />
        <KV label="Tracking Number" value={o.tracking_number || "--"} mono />
        <KV label="Shipment Status">
          <StatusBadge value={o.shipment_status || "--"} map={ORDER_STATUS} />
        </KV>
      </div>
      <div className="tracking-actions">
        {o.tracking_url && (
          <a
            href={o.tracking_url}
            target="_blank"
            rel="noreferrer"
            className="track-btn"
          >
            Track Shipment →
          </a>
        )}
        {o.label_url && (
          <a
            href={o.label_url}
            target="_blank"
            rel="noreferrer"
            className="track-btn secondary"
          >
            Download Label ↓
          </a>
        )}
      </div>
    </div>

    <div className="section-card">
      <div className="section-title">Status Reference Guide</div>
      <div className="status-guide-grid">
        {Object.entries(ORDER_STATUS).map(([key, cfg]) => (
          <div className="status-guide-item" key={key}>
            <StatusBadge value={key} map={ORDER_STATUS} />
            <div className="status-guide-desc">{cfg.desc}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ── Small reusable pieces ───────────────────
const KV = ({
  label,
  value,
  mono,
  children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  children?: React.ReactNode;
}) => (
  <div className="kv-item">
    <div className="kv-label">{label}</div>
    {children ? (
      <div className="kv-value">{children}</div>
    ) : (
      <div className={`kv-value${mono ? " mono" : ""}`}>{value || "--"}</div>
    )}
  </div>
);

const PriceRow = ({
  label,
  value,
  muted,
  bold,
  total,
}: {
  label: string;
  value: number;
  muted?: boolean;
  bold?: boolean;
  total?: boolean;
}) => (
  <div
    className={`price-row${total ? " price-row-total" : bold ? " price-row-bold" : ""}`}
  >
    <span className={`price-label${muted ? " muted" : ""}`}>{label}</span>
    <span className="price-val">{fmt$(value)}</span>
  </div>
);

// ─────────────────────────────────────────────
// Main Orders Page
// ─────────────────────────────────────────────
const OrdersPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await GetAdminOrdersAPI({
        page,
        limit,
        search,
        status: statusFilter,
      });
      const payload = res.data.data;
      setOrders(payload.data || []);
      setTotal(payload.pagination?.total || 0);
    } catch (err) {
      console.error("Failed to load orders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [page, limit, search, statusFilter]);

  const openOrder = (row: Order) => {
    setSelectedOrder(row);
    setModalOpen(true);
  };

  const columns = [
    {
      title: "#",
      width: 52,
      render: (_: any, __: any, index: number) => (
        <span className="row-index">{(page - 1) * limit + index + 1}</span>
      ),
    },
    {
      title: "Customer",
      width: 220,
      render: (_: any, row: Order) => (
        <div className="cell-customer">
          <div className="cell-avatar">{initials(row.user?.name)}</div>
          <div>
            <div className="cell-name">{row.user?.name || "--"}</div>
            <div className="cell-email">{row.user?.email || "--"}</div>
          </div>
        </div>
      ),
    },
    {
      title: "Order",
      width: 210,
      render: (_: any, row: Order) => (
        <div>
          <div className="cell-order-num">{row.order_number}</div>
          <div className="cell-product-name">{row.preview?.product_name}</div>
        </div>
      ),
    },
    {
      title: "Items",
      width: 70,
      render: (_: any, row: Order) => (
        <span className="cell-items">{row.preview?.total_items || 0}</span>
      ),
    },
    {
      title: "Customization",
      width: 130,

      render: (_: any, row: Order) => {
        const type = row.preview?.customization_type || "MANUAL";

        const isAuto = type === "AUTO";

        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",

              padding: "5px 12px",

              borderRadius: 999,

              fontSize: 12,
              fontWeight: 700,

              background: isAuto ? "#dcfce7" : "#dbeafe",

              color: isAuto ? "#166534" : "#1d4ed8",

              border: `1px solid ${isAuto ? "#86efac" : "#93c5fd"}`,
            }}
          >
            {type}
          </span>
        );
      },
    },
    {
      title: "Amount",
      width: 120,
      render: (_: any, row: Order) => (
        <span className="cell-amount">{fmt$(row.total_amount)}</span>
      ),
    },
    {
      title: "Payment",
      width: 110,
      render: (_: any, row: Order) => (
        <StatusBadge value={row.payment_status} map={PAYMENT_STATUS} />
      ),
    },
    {
      title: "Status",
      width: 150,
      render: (_: any, row: Order) => (
        <StatusBadge value={row.status} map={ORDER_STATUS} />
      ),
    },
    {
      title: "Date",
      width: 105,
      render: (_: any, row: Order) => (
        <span className="cell-date">
          {new Date(row.created_at).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
      ),
    },
    {
      title: "",
      width: 80,
      render: (_: any, row: Order) => (
        <button
          className="view-btn"
          onClick={(e) => {
            e.stopPropagation();
            openOrder(row);
          }}
        >
          <EyeOutlined style={{ fontSize: 12 }} /> View
        </button>
      ),
    },
  ];

  return (
    <div className="orders-page">
      {/* Header */}
      <div className="orders-header">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">
            Manage and monitor all customer orders
          </p>
        </div>
        <div className="header-stat">
          <span className="stat-num">{total.toLocaleString()}</span>
          <span className="stat-label">Total Orders</span>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-row">
        <Input
          allowClear
          size="large"
          placeholder="Search by order number, customer, tracking…"
          prefix={<SearchOutlined style={{ color: "#9ca3af" }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <Select
          size="large"
          placeholder="Order Status"
          style={{ width: 190 }}
          allowClear
          value={statusFilter || undefined}
          onChange={(v) => setStatusFilter(v || "")}
          options={Object.entries(ORDER_STATUS).map(([value, cfg]) => ({
            label: cfg.label,
            value,
          }))}
        />
      </div>

      {/* Table */}
      <div className="orders-card">
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={orders}
          scroll={{ x: 1120 }}
          rowClassName="order-row"
          onRow={(row) => ({ onClick: () => openOrder(row) })}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            pageSizeOptions: ["10", "25", "50", "100"],
            showTotal: (t) => `${t.toLocaleString()} orders`,
            onChange: (current, pageSize) => {
              setPage(current);
              setLimit(pageSize);
            },
          }}
          locale={{ emptyText: <Empty description="No Orders Found" /> }}
        />
      </div>

      {/* Detail Modal */}
      <OrderDetailModal
        order={selectedOrder}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
};

export default OrdersPage;
