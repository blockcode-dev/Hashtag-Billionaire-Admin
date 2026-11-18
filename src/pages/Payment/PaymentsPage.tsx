/** @format */

import { useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/common/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
import { ImagePreview } from "@/components/common/ImagePreview";
import { SearchInput } from "@/components/common/SearchInput";
import { StatusTag } from "@/components/common/StatusTag";

import { toastApiError } from "@/lib/api-errors";
import { paymentModeLabel } from "@/lib/payments";
import { GetAllPaymentsAPI } from "@/services/Api/PaymentApi";

import "./Payments.scss";

// Payment status values from the go-live API contract: PENDING (in progress), SUCCESS, REJECTED.
const PAYMENT_TAG: Record<string, { color: string; label: string }> = {
  SUCCESS: { color: "success", label: "Paid" },
  PENDING: { color: "warning", label: "Pending" },
  REJECTED: { color: "error", label: "Failed" },
};

const paymentTag = (status?: string) =>
  PAYMENT_TAG[status?.toUpperCase() ?? ""] ?? { color: "default", label: status || "--" };

// How it was paid: CARD, GOOGLE_PAY, CASH_APP, PAYPAL… The list sends payment_method, which should
// carry the payment's payment_mode (BACKEND_QUESTIONS.md, F4); either is read.
const paymentMode = (row: any): string | null => row?.payment_method || row?.payment_mode || null;

const money = (n: unknown) =>
  `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PaymentsPage = () => {
  const [payments, setPayments] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);

  // What's typed, and what the list was last asked for (a moment later).
  const [search, setSearch] = useState("");
  const [searched, setSearched] = useState("");

  const [page, setPage] = useState(1);

  const [total, setTotal] = useState(0);

  const [limit, setLimit] = useState(50);

  const [selectedPayment, setSelectedPayment] = useState<any>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);

  /*
   |--------------------------------------------------------------------------
   | LOAD
   |--------------------------------------------------------------------------
   */

  // One page at a time; the server counts payments (F30). An answer that
  // arrives after a newer request is dropped.
  const requestRef = useRef(0);
  const loadPayments = async () => {
    const request = ++requestRef.current;
    try {
      setLoading(true);

      const res = await GetAllPaymentsAPI({
        page,
        limit,
        search: searched || undefined,
      });
      if (request !== requestRef.current) return;

      const payload = res.data.data;

      setPayments(payload.payments || []);

      setTotal(payload.total || 0);
    } catch (err) {
      if (request !== requestRef.current) return;
      console.error("Failed to load payments", err);
      toastApiError("Couldn't load the payments", err);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, searched]);

  /*
   |--------------------------------------------------------------------------
   | SEARCH
   |--------------------------------------------------------------------------
   */

  // The server matches the customer's name or email, across every payment.
  useEffect(() => {
    const timer = setTimeout(() => {
      const term = search.trim();
      if (term === searched) return;
      setSearched(term);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, searched]);

  /*
   |--------------------------------------------------------------------------
   | DATE
   |--------------------------------------------------------------------------
   */

  const formatDate = (date: string) => {
    if (!date) return "--";

    const d = new Date(date);

    return `${String(d.getDate()).padStart(2, "0")}/${String(
      d.getMonth() + 1,
    ).padStart(2, "0")}/${d.getFullYear()}`;
  };

  /*
   |--------------------------------------------------------------------------
   | TABLE
   |--------------------------------------------------------------------------
   */

  const openPayment = (row: any) => {
    setSelectedPayment(row);
    setDetailsOpen(true);
  };

  const columns = [
    {
      title: "#",

      width: 48,

      render: (_: any, __: any, index: number) =>
        (page - 1) * limit + index + 1,
    },

    {
      title: "Customer",

      width: 240,

      render: (_: any, row: any) => (
        <div>
          <div
            style={{
              fontWeight: 700,
            }}
          >
            {row.user?.name || "--"}
          </div>

          <div
            style={{
              fontSize: 12,
              color: "var(--muted-foreground)",
            }}
          >
            {row.user?.email || "--"}
          </div>
        </div>
      ),
    },

    {
      title: "Transaction",

      width: 280,

      render: (_: any, row: any) => (
        <div>
          <div
            style={{
              fontWeight: 600,
            }}
          >
            {row.transaction_id || "--"}
          </div>

          {paymentMode(row) && (
            <span className="text-sm text-muted-foreground">{paymentModeLabel(paymentMode(row))}</span>
          )}
        </div>
      ),
    },

    {
      title: "Order",

      width: 220,

      render: (_: any, row: any) => (
        <div className="min-w-0">
          <div className="font-bold whitespace-nowrap">{row.order?.order_number || "--"}</div>
          <div
            className="max-w-[200px] truncate text-sm text-muted-foreground"
            title={row.order?.preview?.product_name}
          >
            {row.order?.preview?.product_name}
          </div>
        </div>
      ),
    },

    {
      title: "Amount",

      width: 140,

      render: (_: any, row: any) => (
        <div className="font-bold whitespace-nowrap">
          $
          {Number(row.amount || 0).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      ),
    },

    {
      title: "Status",

      width: 120,

      render: (_: any, row: any) => (
        <StatusTag color={paymentTag(row.payment_status).color}>
          {paymentTag(row.payment_status).label}
        </StatusTag>
      ),
    },

    {
      title: "Created",

      width: 140,

      render: (_: any, row: any) => <span className="whitespace-nowrap">{formatDate(row.created_at)}</span>,
    },

    {
      title: <span className="sr-only">Actions</span>,

      align: "right" as const,

      render: (_: any, row: any) => (
        <button
          type="button"
          className="view-btn"
          aria-label={`View payment ${row.transaction_id || ""}`.trim()}
          title="View payment"
          onClick={(e) => {
            e.stopPropagation();
            openPayment(row);
          }}
        >
          <Eye size={15} aria-hidden />
        </button>
      ),
    },
  ];

  return (
    <div className="payments-page">
      {/* HEADER */}
      <div className="payments-header flex flex-wrap items-center justify-between gap-5">
        <div>
          <h1>Payment History</h1>
          <p className="text-muted-foreground">
            Monitor all payment transactions across the platform
          </p>
        </div>

        <SearchInput
          allowClear
          size="large"
          placeholder="Search by customer name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          wrapperClassName="payment-search"
          aria-label="Search payments"
        />
      </div>

      {/* TABLE */}
      <div className="payments-card">
        <DataTable
          rowKey="payment_id"
          loading={loading}
          columns={columns}
          dataSource={payments}
          onRowClick={openPayment}
          className="payments-table"
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            showTotal: (total) =>
              searched ? `${total} payments match "${searched}"` : `Total ${total} payments`,
            onChange: (current, pageSize) => {
              setPage(current);
              setLimit(pageSize);
            },
          }}
          emptyText={<EmptyState description="No Payments Found" />}
        />
      </div>

      {/* DETAILS MODAL */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="payment-modal max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-[1000px]">
          {selectedPayment && (
            <div className="payment-modal-wrapper">
              {/* 1. COMPACT HEADER */}
              <div className="modal-custom-header">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="modal-label">TRANSACTION DETAILS</span>
                    <DialogTitle asChild>
                      <h3>{selectedPayment.transaction_id}</h3>
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                      Payment, customer, order and item pricing details
                    </DialogDescription>
                  </div>
                  <div className="text-right">
                    <span className="modal-label">Amount</span>
                    <div className="modal-total-amount">
                      $
                      {Number(selectedPayment.amount || 0).toLocaleString(
                        undefined,
                        { minimumFractionDigits: 2 },
                      )}
                    </div>
                    <StatusTag
                      className="payment-tag"
                      color={paymentTag(selectedPayment.payment_status).color}
                    >
                      {paymentTag(selectedPayment.payment_status).label}
                    </StatusTag>
                  </div>
                </div>
              </div>

              <div style={{ padding: "24px" }}>
                {/* 2. CUSTOMER & ORDER SUMMARY GRID */}
                <div className="grid gap-6 md:grid-cols-2">
                  <section className="modal-sub-card">
                    <h4 className="sub-card-title">Customer Information</h4>
                    <dl className="sub-card-list">
                      <dt>Name</dt>
                      <dd>
                        <strong>{selectedPayment.user?.name}</strong>
                      </dd>
                      <dt>Email</dt>
                      <dd>{selectedPayment.user?.email}</dd>
                      <dt>Phone</dt>
                      <dd>{selectedPayment.user?.mobile}</dd>
                    </dl>
                  </section>
                  <section className="modal-sub-card">
                    <h4 className="sub-card-title">Order Summary</h4>
                    <dl className="sub-card-list">
                      <dt>Order No.</dt>
                      <dd>
                        <strong>{selectedPayment.order?.order_number}</strong>
                      </dd>
                      <dt>Method</dt>
                      <dd>{paymentModeLabel(paymentMode(selectedPayment))}</dd>
                      <dt>Tracking</dt>
                      <dd>{selectedPayment.order?.tracking_number || "N/A"}</dd>
                      <dt>Date</dt>
                      <dd>{formatDate(selectedPayment.created_at)}</dd>
                    </dl>
                  </section>
                </div>

                {/* 3. ITEM LIST */}
                <div className="section-divider">
                  <span>Order Items</span>
                  <Separator className="flex-1" />
                </div>

                {selectedPayment.order?.items?.map((item: any, index: number) => (
                  <div key={index} className="modal-item-container">
                    <div className="grid gap-6 md:grid-cols-3">
                      {/* Product Images */}
                      <div className="flex flex-col gap-2">
                        <div className="image-box">
                          <span className="image-box-label">ORIGINAL</span>
                          <ImagePreview
                            src={item.original_image}
                            alt="Original product"
                            height={120}
                            style={{ objectFit: "contain", height: 120, width: "100%" }}
                          />
                        </div>
                        {item.customized_image && (
                          <div className="image-box">
                            <span className="image-box-label">
                              {item?.customization_config?.type === "AUTO"
                                ? "LOGO"
                                : "CUSTOMIZED"}
                            </span>
                            <ImagePreview
                              src={item.customized_image}
                              alt="Customized product"
                              height={120}
                              style={{ objectFit: "contain", height: 120, width: "100%" }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Item Info & Pricing Breakdown */}
                      <div className="md:col-span-2">
                        <div className="product-title">{item.product_name}</div>
                        <div className="item-meta-grid grid grid-cols-2 gap-4 sm:grid-cols-3">
                          <div>
                            <span className="meta-label">SKU:</span>
                            <div>{item.sku}</div>
                          </div>
                          <div>
                            <span className="meta-label">Color/Size:</span>
                            <div>
                              {item.color} / {item.size}
                            </div>
                          </div>
                          <div>
                            <span className="meta-label">Qty:</span>
                            <div>{item.quantity}</div>
                          </div>
                          <div>
                            <span className="meta-label">Customization Type:</span>
                            <div>
                              <StatusTag
                                color={
                                  item?.customization_config?.type === "AUTO"
                                    ? "green"
                                    : "blue"
                                }
                              >
                                {item?.customization_config?.type || "MANUAL"}
                              </StatusTag>
                            </div>
                          </div>
                          <div>
                            <span className="meta-label">Print Method:</span>
                            <div>
                              {item?.customization_config?.print_method || "--"}
                            </div>
                          </div>
                          <div>
                            <span className="meta-label">Custom Text:</span>
                            <div>
                              {item?.customization_config?.custom_text || "--"}
                            </div>
                          </div>
                        </div>

                        <div className="breakdown-section">
                          <div className="breakdown-title">Pricing Details</div>

                          {/* Supplier cost: this list has no admin sign-in yet (audit C1), so the
                              backend can leave these out. A missing figure isn't $0.00. */}
                          {/* PRODUCT PRICE */}
                          {item?.pricing_breakdown?.actual_product_price != null && (
                            <div className="price-step">
                              <div className="left">
                                <div className="title">Actual Product Price</div>
                                <div className="subtitle">Supplier base cost</div>
                              </div>
                              <div className="right">
                                ${Number(item.pricing_breakdown.actual_product_price).toFixed(2)}
                              </div>
                            </div>
                          )}

                          {/* MARKUP */}
                          {item?.pricing_breakdown?.supplier_markup != null && (
                            <div className="price-step">
                              <div className="left">
                                <div className="title">Supplier Markup</div>
                                <div className="subtitle">Platform margin</div>
                              </div>
                              <div className="right">
                                ${Number(item.pricing_breakdown.supplier_markup).toFixed(2)}
                              </div>
                            </div>
                          )}

                          {/* FINAL PRODUCT */}
                          <div className="price-step highlight-row">
                            <div className="left">
                              <div className="title">Final Product Price</div>
                            </div>
                            <div className="right">
                              ${Number(item?.pricing_breakdown?.final_product_price || 0).toFixed(2)}
                            </div>
                          </div>

                          {/* CUSTOMIZATION */}
                          {item?.pricing_breakdown?.pricing_table?.map(
                            (pricing: any, idx: number) => (
                              <div className="price-step" key={idx}>
                                <div className="left">
                                  <div className="title">
                                    {pricing.print_method || pricing.type}
                                    {pricing.location
                                      ? ` (${pricing.location})`
                                      : ""}
                                  </div>
                                  <div className="subtitle">
                                    {pricing.quantity} × $
                                    {pricing.price_per_item ??
                                      pricing.final_price_per_item ??
                                      pricing.second_location_price}
                                    {item?.customization_config?.custom_text
                                      ? ` • "${item.customization_config.custom_text}"`
                                      : ""}
                                  </div>
                                </div>
                                <div className="right">
                                  ${Number(pricing.total).toFixed(2)}
                                </div>
                              </div>
                            ),
                          )}

                          {/* PRE-MADE OPTIONS */}
                          {item?.pricing_breakdown?.customization?.items?.map(
                            (line: any, idx: number) => (
                              <div className="price-step" key={idx}>
                                <div className="left">
                                  <div className="title">{line.option_name}</div>
                                  <div className="subtitle">{line.value_name}</div>
                                </div>
                                <div className="right">
                                  ${Number(line.total || 0).toFixed(2)}
                                </div>
                              </div>
                            ),
                          )}

                          {/* ADD-ONS */}
                          {item?.pricing_breakdown?.addons?.map(
                            (addon: any, idx: number) => (
                              <div className="price-step" key={idx}>
                                <div className="left">
                                  <div className="title">{addon.name}</div>
                                  <div className="subtitle">
                                    {addon.quantity} × ${Number(addon.unit_price || 0).toFixed(2)}
                                  </div>
                                </div>
                                <div className="right">
                                  ${Number(addon.total || 0).toFixed(2)}
                                </div>
                              </div>
                            ),
                          )}

                          {/* SETUP */}
                          <div className="price-step">
                            <div className="left">
                              <div className="title">Setup / Graphic Fee</div>
                            </div>
                            <div className="right">
                              ${Number(item?.pricing_breakdown?.setup_fee || 0).toFixed(2)}
                            </div>
                          </div>

                          {/* PRICE PER ITEM */}
                          <div className="price-step total-row">
                            <div className="left">
                              <div className="title">Price Per Item</div>
                            </div>
                            <div className="right">
                              ${Number(item?.pricing_breakdown?.final_price_per_item || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {index < selectedPayment.order.items.length - 1 && (
                      <hr className="my-6 border-dashed" />
                    )}
                  </div>
                ))}

                {/* ORDER TOTALS */}
                {selectedPayment.order && (
                  <div className="order-total-card">
                    <div className="order-total-title">Order Totals</div>

                    <div className="order-total-row">
                      <span>Order subtotal</span>
                      <strong>{money(selectedPayment.order.subtotal_amount)}</strong>
                    </div>

                    {Number(selectedPayment.order.handling_amount) > 0 && (
                      <div className="order-total-row">
                        <span>Handling fee</span>
                        <strong>{money(selectedPayment.order.handling_amount)}</strong>
                      </div>
                    )}

                    {selectedPayment.order.tax_amount != null && (
                      <div className="order-total-row">
                        <span>
                          Tax
                          {Number(selectedPayment.order.tax_rate) > 0 && ` (${Number(selectedPayment.order.tax_rate)}%)`}
                        </span>
                        <strong>{money(selectedPayment.order.tax_amount)}</strong>
                      </div>
                    )}

                    {/* What the customer paid for shipping; the label's cost is below. */}
                    <div className="order-total-row">
                      <span>Shipping</span>
                      <strong>{money(selectedPayment.order.shipping_amount)}</strong>
                    </div>

                    <div className="order-total-divider" />

                    <div className="order-total-row grand">
                      <span>Grand Total</span>
                      <strong>{money(selectedPayment.order.total_amount)}</strong>
                    </div>

                    {Number(selectedPayment.order.actual_shipping_cost) > 0 && (
                      <div className="order-total-row aside">
                        <span>Label cost (paid to the carrier, not part of the total)</span>
                        <strong>{money(selectedPayment.order.actual_shipping_cost)}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentsPage;
