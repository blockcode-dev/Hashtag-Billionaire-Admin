/** @format */

import { useEffect, useState } from "react";

import {
  Table,
  Input,
  Tag,
  Card,
  Avatar,
  Typography,
  Space,
  Empty,
  Row,
  Col,
} from "antd";

import {
  SearchOutlined,
  CreditCardOutlined,
} from "@ant-design/icons";

import { GetAllPaymentsAPI } from "@/services/Api/PaymentApi";

import "./Payments.scss";

const { Title, Text } =
  Typography;

const PaymentsPage = () => {
  const [payments, setPayments] =
    useState<any[]>([]);

  const [filteredPayments, setFilteredPayments] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [page, setPage] =
    useState(1);

  const [total, setTotal] =
    useState(0);

  const [limit, setLimit] =
    useState(10);

  const loadPayments =
    async () => {
      try {
        setLoading(true);

        const res =
          await GetAllPaymentsAPI({
            page,
            limit,
          });

        const payload =
          res.data.data;

        const paymentData =
          payload.payments || [];

        setPayments(paymentData);

        setFilteredPayments(
          paymentData,
        );

        setTotal(
          payload.total || 0,
        );
      } catch (err) {
        console.error(
          "Failed to load payments",
          err,
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    loadPayments();
  }, [page, limit]);

  // FRONTEND SEARCH
  useEffect(() => {
    if (!search.trim()) {
      setFilteredPayments(
        payments,
      );
      return;
    }

    const keyword =
      search.toLowerCase();

    const filtered =
      payments.filter((p) => {
        return (
          p.transaction_id
            ?.toLowerCase()
            ?.includes(keyword) ||
          p.user?.email
            ?.toLowerCase()
            ?.includes(keyword) ||
          p.user?.user_profile?.name
            ?.toLowerCase()
            ?.includes(keyword) ||
          p.order?.order_number
            ?.toLowerCase()
            ?.includes(keyword) ||
          p.payment_mode
            ?.toLowerCase()
            ?.includes(keyword) ||
          p.payment_status
            ?.toLowerCase()
            ?.includes(keyword)
        );
      });

    setFilteredPayments(
      filtered,
    );
  }, [search, payments]);

  const formatDate = (
    date: string,
  ) => {
    if (!date) return "--";

    const d = new Date(date);

    return `${String(
      d.getDate(),
    ).padStart(
      2,
      "0",
    )}/${String(
      d.getMonth() + 1,
    ).padStart(
      2,
      "0",
    )}/${d.getFullYear()}`;
  };

  const columns = [
    {
      title: "SR. NO.",
      width: 60,
      render: (
        _: any,
        __: any,
        index: number,
      ) =>
        (page - 1) * limit +
        index +
        1,
    },

    {
      title: "Customer",
      width: 250,
      render: (_: any, row: any) => (
        <div className="customer-cell">
          {/* <Avatar
            size={50}
            className="payment-avatar"
            icon={
              <CreditCardOutlined />
            }
          /> */}

          <div>
            <div className="customer-name">
              {row.user
                ?.user_profile
                ?.name || "--"}
            </div>

            <div className="customer-email">
              {row.user?.email ||
                "--"}
            </div>
          </div>
        </div>
      ),
    },

    {
      title: "Transaction",
      width: 300,
      render: (_: any, row: any) => (
        <div>
          <div className="transaction-id">
            {row.transaction_id ||
              "--"}
          </div>

          <Text
            type="secondary"
          >
            {row.payment_mode ||
              "--"}
          </Text>
        </div>
      ),
    },

    {
      title: "Order",
      width: 220,
      render: (_: any, row: any) => (
        <div>
          <div className="order-number">
            {row.order
              ?.order_number ||
              "--"}
          </div>
          <Text
            type="secondary"
          >
            {row.order?.status ||
              "--"}
          </Text>
        </div>
      ),
    },

    {
      title: "Amount",
      width: 120,
      render: (_: any, row: any) => (
        <div className="amount-text">
          ${row.amount || "--"}

          <span>
            {row.currency}
          </span>
        </div>
      ),
    },

    {
      title: "Status",
      width: 130,
      render: (_: any, row: any) => (
        <Tag
          className="payment-tag"
          color={
            row.payment_status ===
            "SUCCESS"
              ? "success"
              : "error"
          }
        >
          {row.payment_status ||
            "--"}
        </Tag>
      ),
    },

    {
      title: "Created",
      width: 140,
      render: (_: any, row: any) =>
        formatDate(
          row.created_at,
        ),
    },
  ];

  return (
    <div className="payments-page">
      {/* HEADER */}
      <Row
        justify="space-between"
        align="middle"
        gutter={[20, 20]}
        className="payments-header"
      >
        <Col>
          <div>
            <Title level={2}>
              Payment History
            </Title>

            <Text type="secondary">
              Monitor all payment
              transactions across
              the platform
            </Text>
          </div>
        </Col>

        <Col>
          <Input
            allowClear
            size="large"
            placeholder="Search by transaction ID, order, customer..."
            prefix={
              <SearchOutlined />
            }
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value,
              )
            }
            className="payment-search"
          />
        </Col>
      </Row>

      {/* TABLE */}
      <Card className="payments-card">
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={
            filteredPayments
          }
          pagination={{
            current: page,

            pageSize: limit,

            total,

            showSizeChanger: true,

            showTotal: (
              total,
            ) =>
              `Total ${total} payments`,

            onChange: (
              current,
              pageSize,
            ) => {
              setPage(current);

              setLimit(
                pageSize,
              );
            },
          }}
          locale={{
            emptyText: (
              <Empty description="No Payments Found" />
            ),
          }}
        />
      </Card>
    </div>
  );
};

export default PaymentsPage;