/** @format */

import { useEffect, useState } from "react";

import {
  Table,
  Input,
  Tag,
  Card,
  Typography,
  Space,
  Empty,
  Row,
  Col,
  Modal,
  Image,
  Divider,
  Descriptions,
} from "antd";

import { SearchOutlined, EyeOutlined } from "@ant-design/icons";

import { GetAllPaymentsAPI } from "@/services/Api/PaymentApi";

import "./Payments.scss";

const { Title, Text } = Typography;

const PaymentsPage = () => {
  const [payments, setPayments] = useState<any[]>([]);

  const [filteredPayments, setFilteredPayments] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);

  const [total, setTotal] = useState(0);

  const [limit, setLimit] = useState(10);

  const [selectedPayment, setSelectedPayment] = useState<any>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);

  /*
   |--------------------------------------------------------------------------
   | LOAD
   |--------------------------------------------------------------------------
   */

  const loadPayments = async () => {
    try {
      setLoading(true);

      const res = await GetAllPaymentsAPI({
        page,
        limit,
      });

      const payload = res.data.data;

      const paymentData = payload.payments || [];

      setPayments(paymentData);

      setFilteredPayments(paymentData);

      setTotal(payload.total || 0);
    } catch (err) {
      console.error("Failed to load payments", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [page, limit]);

  /*
   |--------------------------------------------------------------------------
   | SEARCH
   |--------------------------------------------------------------------------
   */

  useEffect(() => {
    if (!search.trim()) {
      setFilteredPayments(payments);

      return;
    }

    const keyword = search.toLowerCase();

    const filtered = payments.filter((p) => {
      return (
        p.transaction_id?.toLowerCase()?.includes(keyword) ||
        p.user?.email?.toLowerCase()?.includes(keyword) ||
        p.user?.name?.toLowerCase()?.includes(keyword) ||
        p.order?.order_number?.toLowerCase()?.includes(keyword) ||
        p.payment_status?.toLowerCase()?.includes(keyword)
      );
    });

    setFilteredPayments(filtered);
  }, [search, payments]);

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

  const columns = [
    {
      title: "SR. NO.",

      width: 60,

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
              color: "#6b7280",
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

          <Text type="secondary">{row.payment_method}</Text>
        </div>
      ),
    },

    {
      title: "Order",

      width: 220,

      render: (_: any, row: any) => (
        <div>
          <div
            style={{
              fontWeight: 700,
            }}
          >
            {row.order?.order_number}
          </div>

          <Text type="secondary">{row.order?.preview?.product_name}</Text>
        </div>
      ),
    },

    {
      title: "Amount",

      width: 140,

      render: (_: any, row: any) => (
        <div
          style={{
            fontWeight: 700,
          }}
        >
          ${Number(row.amount || 0).toFixed(2)}
        </div>
      ),
    },

    {
      title: "Status",

      width: 120,

      render: (_: any, row: any) => (
        <Tag color={row.payment_status === "SUCCESS" ? "success" : "error"}>
          {row.payment_status}
        </Tag>
      ),
    },

    {
      title: "Created",

      width: 140,

      render: (_: any, row: any) => formatDate(row.created_at),
    },

    {
      title: "",

      width: 100,

      render: (_: any, row: any) => (
        <button
          className="view-btn"
          onClick={() => {
            setSelectedPayment(row);

            setDetailsOpen(true);
          }}
        >
          <EyeOutlined /> View
        </button>
      ),
    },
  ];

  return (
    <div className="payments-page">
      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <Row
        justify="space-between"
        align="middle"
        gutter={[20, 20]}
        className="payments-header"
      >
        <Col>
          <div>
            <Title level={2}>Payment History</Title>

            <Text type="secondary">
              Monitor all payment transactions across the platform
            </Text>
          </div>
        </Col>

        <Col>
          <Input
            allowClear
            size="large"
            placeholder="Search by transaction, order, customer..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="payment-search"
          />
        </Col>
      </Row>

      {/* ================================================= */}
      {/* TABLE */}
      {/* ================================================= */}

      <Card className="payments-card">
        <Table
          rowKey="payment_id"
          loading={loading}
          columns={columns}
          dataSource={filteredPayments}
          pagination={{
            current: page,

            pageSize: limit,

            total,

            showSizeChanger: true,

            showTotal: (total) => `Total ${total} payments`,

            onChange: (current, pageSize) => {
              setPage(current);

              setLimit(pageSize);
            },
          }}
          locale={{
            emptyText: <Empty description="No Payments Found" />,
          }}
        />
      </Card>

      {/* ================================================= */}
      {/* DETAILS MODAL */}
      {/* ================================================= */}

      <Modal
        title={null}
        open={detailsOpen}
        onCancel={() => setDetailsOpen(false)}
        footer={null}
        width={1000}
        centered
        bodyStyle={{ padding: 0 }} // Remove default padding for custom header
      >
        {selectedPayment && (
          <div className="payment-modal-wrapper">
            {/* 1. COMPACT HEADER */}
            <div className="modal-custom-header">
              <Row justify="space-between" align="middle">
                <Col>
                  <Text className="modal-label">TRANSACTION DETAILS</Text>
                  <Title level={3} style={{ margin: 0 }}>
                    {selectedPayment.transaction_id}
                  </Title>
                  {/* <Tag color="cyan">{selectedPayment.payment_method}</Tag> */}
                </Col>
                <Col style={{ textAlign: "right" }}>
                  <Text type="secondary">Amount Paid</Text>
                  <div className="modal-total-amount">
                    $
                    {Number(selectedPayment.amount || 0).toLocaleString(
                      undefined,
                      { minimumFractionDigits: 2 },
                    )}
                  </div>
                  <Tag
                    className="payment-tag"
                    color={
                      selectedPayment.payment_status === "SUCCESS"
                        ? "success"
                        : "error"
                    }
                  >
                    {selectedPayment.payment_status}
                  </Tag>
                </Col>
              </Row>
            </div>

            <div style={{ padding: "24px" }}>
              {/* 2. CUSTOMER & ORDER SUMMARY GRID */}
              <Row gutter={24}>
                <Col span={12}>
                  <Card
                    title="Customer Information"
                    size="small"
                    className="modal-sub-card"
                  >
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="Name">
                        <strong>{selectedPayment.user?.name}</strong>
                      </Descriptions.Item>
                      <Descriptions.Item label="Email">
                        {selectedPayment.user?.email}
                      </Descriptions.Item>
                      <Descriptions.Item label="Phone">
                        {selectedPayment.user?.mobile}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card
                    title="Order Summary"
                    size="small"
                    className="modal-sub-card"
                  >
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="Order No.">
                        <strong>{selectedPayment.order?.order_number}</strong>
                      </Descriptions.Item>
                      <Descriptions.Item label="Tracking">
                        {selectedPayment.order?.tracking_number || "N/A"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Date">
                        {formatDate(selectedPayment.created_at)}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
              </Row>

              {/* 3. ITEM LIST */}
              <Divider orientation="left">Order Items</Divider>

              {selectedPayment.order?.items?.map((item: any, index: number) => (
                <div key={index} className="modal-item-container">
                  <Row gutter={24}>
                    {/* Product Images */}
                    <Col span={8}>
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <div className="image-box">
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            ORIGINAL
                          </Text>
                          <Image
                            src={item.original_image}
                            height={120}
                            style={{ objectFit: "contain" }}
                          />
                        </div>
                        {item.customized_image && (
                          <div className="image-box">
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {item?.customization_config?.type === "AUTO"
                                ? "LOGO"
                                : "CUSTOMIZED"}
                            </Text>

                            <Image
                              src={item.customized_image}
                              height={120}
                              style={{ objectFit: "contain" }}
                            />
                          </div>
                        )}
                      </Space>
                    </Col>

                    {/* Item Info & Pricing Breakdown */}
                    <Col span={16}>
                      <div className="product-title">{item.product_name}</div>
                      <Row gutter={[16, 16]} className="item-meta-grid">
                        <Col span={8}>
                          <Text type="secondary">SKU:</Text>
                          <div>{item.sku}</div>
                        </Col>

                        <Col span={8}>
                          <Text type="secondary">Color/Size:</Text>
                          <div>
                            {item.color} / {item.size}
                          </div>
                        </Col>

                        <Col span={8}>
                          <Text type="secondary">Qty:</Text>
                          <div>{item.quantity}</div>
                        </Col>

                        <Col span={8}>
                          <Text type="secondary">Customization Type:</Text>

                          <div>
                            <Tag
                              color={
                                item?.customization_config?.type === "AUTO"
                                  ? "green"
                                  : "blue"
                              }
                            >
                              {item?.customization_config?.type || "MANUAL"}
                            </Tag>
                          </div>
                        </Col>

                        <Col span={8}>
                          <Text type="secondary">Print Method:</Text>

                          <div>
                            {item?.customization_config?.print_method || "--"}
                          </div>
                        </Col>

                        <Col span={8}>
                          <Text type="secondary">Custom Text:</Text>

                          <div>
                            {item?.customization_config?.custom_text || "--"}
                          </div>
                        </Col>
                      </Row>

                      <div className="breakdown-section">
                        <div className="breakdown-title">Pricing Details</div>

                        {/* PRODUCT PRICE */}
                        <div className="price-step">
                          <div className="left">
                            <div className="title">Actual Product Price</div>

                            <div className="subtitle">Supplier base cost</div>
                          </div>

                          <div className="right">
                            $
                            {Number(
                              item?.pricing_breakdown?.actual_product_price ||
                                0,
                            ).toFixed(2)}
                          </div>
                        </div>

                        {/* MARKUP */}
                        <div className="price-step">
                          <div className="left">
                            <div className="title">Supplier Markup</div>

                            <div className="subtitle">Platform margin</div>
                          </div>

                          <div className="right">
                            $
                            {Number(
                              item?.pricing_breakdown?.supplier_markup || 0,
                            ).toFixed(2)}
                          </div>
                        </div>

                        {/* FINAL PRODUCT */}
                        <div className="price-step highlight-row">
                          <div className="left">
                            <div className="title">Final Product Price</div>
                          </div>

                          <div className="right">
                            $
                            {Number(
                              item?.pricing_breakdown?.final_product_price || 0,
                            ).toFixed(2)}
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
  {pricing.price_per_item}

  {item?.customization_config
    ?.custom_text
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

                        {/* SETUP */}
                        <div className="price-step">
                          <div className="left">
                            <div className="title">Setup Fee</div>
                          </div>

                          <div className="right">
                            $
                            {Number(
                              item?.pricing_breakdown?.setup_fee || 0,
                            ).toFixed(2)}
                          </div>
                        </div>

                        {/* PRICE PER ITEM */}
                        <div className="price-step total-row">
                          <div className="left">
                            <div className="title">Price Per Item</div>
                          </div>

                          <div className="right">
                            $
                            {Number(
                              item?.pricing_breakdown?.final_price_per_item ||
                                0,
                            ).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* ======================================= */}
                      {/* ORDER TOTALS */}
                      {/* ======================================= */}

                      <div className="order-total-card">
                        <div className="order-total-title">Order Totals</div>

                        <div className="order-total-row">
                          <span>
                            Subtotal ({item.quantity} items × $
                            {item?.pricing_breakdown?.final_price_per_item})
                          </span>

                          <strong>
                            $
                            {Number(
                              selectedPayment.order?.subtotal_amount || 0,
                            ).toFixed(2)}
                          </strong>
                        </div>

                        <div className="order-total-row">
                          <span>Shipping</span>

                          <strong>
                            $
                            {Number(
                              selectedPayment.order?.shipping_amount || 0,
                            ).toFixed(2)}
                          </strong>
                        </div>

                        <div className="order-total-divider" />

                        <div className="order-total-row grand">
                          <span>Grand Total</span>

                          <strong>
                            $
                            {Number(
                              selectedPayment.order?.total_amount || 0,
                            ).toFixed(2)}
                          </strong>
                        </div>
                      </div>
                    </Col>
                  </Row>
                  {index < selectedPayment.order.items.length - 1 && (
                    <Divider dashed />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PaymentsPage;
