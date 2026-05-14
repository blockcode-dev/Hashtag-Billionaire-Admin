/** @format */

import { useEffect, useState } from "react";

import {
  GetPricingMarkupAPI,
  UpdatePricingMarkupAPI,
} from "@/services/Api/PricingApi";

import {
  Percent,
  Save,
  Pencil,
  BadgeDollarSign,
} from "lucide-react";

import "./PricingMarkup.scss";

const PricingMarkupPage = () => {
  const [pricing, setPricing] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(
    null,
  );

  const [markup, setMarkup] = useState("");

  const load = async () => {
    try {
      setLoading(true);

      const res = await GetPricingMarkupAPI();

      setPricing(res.data.data || []);
    } catch (err) {
      console.error("Failed to load pricing", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setMarkup(item.markup_percent);
  };

  const handleSave = async (id: number) => {
    try {
      await UpdatePricingMarkupAPI(id, {
        markup_percent: Number(markup),
      });

      setPricing((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                markup_percent: Number(markup),
              }
            : p,
        ),
      );

      setEditingId(null);
    } catch (err) {
      console.error("Failed to update pricing", err);
    }
  };

  return (
    <div className="pricing-root">
      {/* HEADER */}
      <div className="pricing-header">
        <div className="left">
          <h1>Pricing Markup</h1>

          <p>
            Manage supplier markup percentages
          </p>
        </div>
      </div>

  

      {/* TABLE */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Markup %</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {pricing.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="supplier-cell">
                    <div className="icon">
                      <Percent size={16} />
                    </div>

                    <span>{item.supplier}</span>
                  </div>
                </td>

                <td>
                  {editingId === item.id ? (
                    <input
                      type="number"
                      value={markup}
                      onChange={(e) =>
                        setMarkup(e.target.value)
                      }
                      className="markup-input"
                    />
                  ) : (
                    <span className="markup-value">
                      {item.markup_percent}%
                    </span>
                  )}
                </td>

                <td>
                  {editingId === item.id ? (
                    <button
                      className="btn-save"
                      onClick={() =>
                        handleSave(item.id)
                      }
                    >
                      <Save size={14} />
                      Save
                    </button>
                  ) : (
                    <button
                      className="btn-edit"
                      onClick={() =>
                        handleEdit(item)
                      }
                    >
                      <Pencil size={14} />
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && pricing.length === 0 && (
          <p className="no-data">
            No pricing found
          </p>
        )}
      </div>
    </div>
  );
};

export default PricingMarkupPage;