/** @format */

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Spinner } from "@/components/common/Spinner";
import { toast } from "sonner";
import {
  ArrowLeft,
  ExternalLink,
  DownloadCloud,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  GetSageProductDetailsAPI,
  ImportSelectedSageProductsAPI,
} from "@/services/Api/SageApi";
import { toastApiError } from "@/lib/api-errors";
import { sageImportOutcome, sageStockLabel } from "@/lib/sage";
import { buildSageColorTable } from "@/lib/sageColors";
import "./Sageproductview.scss";
import { sanitizeHtml } from "@/lib/sanitize";

type TabKey = "original" | "imported";

function formatMoney(v: any): string | null {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || isNaN(n) || n <= 0) return null;
  return `$${n.toFixed(2)}`;
}

// Several SAGE numeric fields (carton dimensions, weight, units per carton)
// use "0" to mean "not provided" rather than an actual zero — same pattern
// formatMoney already handles for prices. Without this, a product with no
// packaging data on file renders a misleading "0 × 0 × 0" instead of "—".
function formatQty(v: any): string | null {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || isNaN(n) || n <= 0) return null;
  return String(n);
}

function buildTierRows(prc: any[] = [], net: any[] = [], qty: any[] = []) {
  const rows: { qty: string; price: string; net: string | null }[] = [];
  for (let i = 0; i < prc.length; i++) {
    const p = Number(prc[i]);
    if (!p || p <= 0) continue;
    rows.push({
      qty: qty[i] ? `${qty[i]}+` : "—",
      price: `$${p.toFixed(2)}`,
      net: formatMoney(net[i]),
    });
  }
  return rows;
}

const FLAG_LABELS: { key: string; label: string }[] = [
  { key: "recyclable", label: "Recyclable" },
  { key: "newProduct", label: "New Product" },
  { key: "envFriendly", label: "Eco-Friendly" },
  { key: "food", label: "Food Item" },
  { key: "clothing", label: "Clothing" },
];

const SageProductView = () => {
  const { prodEId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("original");
  const [importing, setImporting] = useState(false);

  const load = async () => {
    if (!prodEId) return;
    try {
      setLoading(true);
      const res = await GetSageProductDetailsAPI(Number(prodEId));
      setData(res?.data?.data || null);
    } catch (err) {
      console.error(err);
      toastApiError("Failed to load SAGE product data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prodEId]);

  const handleImport = async () => {
    if (!prodEId) return;
    try {
      setImporting(true);
      const res = await ImportSelectedSageProductsAPI([Number(prodEId)]);
      if (res?.data?.data?.success > 0) {
        toast.success("Imported successfully");
        await load();
        setTab("imported");
      } else {
        toast.error(sageImportOutcome(0, 1).message);
      }
    } catch (err) {
      console.error(err);
      toastApiError("Import failed", err);
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="spv-loading">
        <Spinner size="large" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="spv-loading">
        <p>Couldn't load this product from SAGE.</p>
      </div>
    );
  }

  const {
    prName,
    itemNum,
    spc,
    description,
    category,
    prc = [],
    net = [],
    qty = [],
    pics = [],
    dimensions,
    prodTime,
    themes,
    keywords,
    discontinued,
    supplier,
    imported,
    importedProductId,
    variantCount,
    variants = [],
    options = [],
    imprintArea,
    imprintLoc,
    secondImprintArea,
    secondImprintLoc,
    decorationMethod,
    setupChg,
    screenChg,
    plateChg,
    dieChg,
    addClrChg,
    priceIncludes,
    package: packageType,
    weightPerCarton,
    unitsPerCarton,
    cartonL,
    cartonW,
    cartonH,
    shipPointCountry,
    shipPointZip,
    madeInCountry,
    assembledInCountry,
    decoratedInCountry,
    productCompliance,
    warningLbl,
    expDate,
    comment,
  } = data;

  const tierRows = buildTierRows(prc, net, qty);
  const colorTable = buildSageColorTable(data);
  const generalImages = pics.filter((p: any) => !p.caption);
  const activeFlags = FLAG_LABELS.filter((f) => !!data[f.key]);

  const chargeRows = [
    { label: "Setup Charge", value: formatMoney(setupChg) },
    { label: "Screen Charge", value: formatMoney(screenChg) },
    { label: "Plate Charge", value: formatMoney(plateChg) },
    { label: "Die Charge", value: formatMoney(dieChg) },
    { label: "Additional Color Charge", value: formatMoney(addClrChg) },
  ].filter((r) => r.value);

  return (
    <div className="spv-root">
      <div className="spv-topbar">
        <button className="spv-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          Back to SAGE Live Catalog
        </button>
      </div>

      <div className="spv-header">
        <div className="spv-header-left">
          <h1>{prName || "Untitled"}</h1>
          <div className="spv-header-meta">
            <span className="spv-mono">SAGE ID: {prodEId}</span>
            {itemNum && <span className="spv-mono">Item #: {itemNum}</span>}
            {spc && <span className="spv-mono">SPC: {spc}</span>}
            {discontinued ? (
              <span className="spv-badge spv-badge--discontinued">
                Discontinued by supplier
              </span>
            ) : (
              <span className="spv-badge spv-badge--active">
                Active on supplier
              </span>
            )}
            {expDate && (
              <span className="spv-badge spv-badge--neutral">
                Catalog expires {expDate}
              </span>
            )}
          </div>
        </div>

        <div className="spv-header-right">
          {imported && importedProductId ? (
            <button
              className="spv-primary-btn spv-primary-btn--stored"
              onClick={() => navigate(`/products/${importedProductId}`)}
            >
              <ExternalLink size={15} />
              Open Stored Product
            </button>
          ) : (
            <button
              className="spv-primary-btn spv-primary-btn--import"
              onClick={handleImport}
              disabled={importing}
            >
              {importing ? (
                <Loader2 size={15} className="spv-spin" />
              ) : (
                <DownloadCloud size={15} />
              )}
              {importing ? "Importing…" : "Import This Product"}
            </button>
          )}
        </div>
      </div>

      <div className="spv-tabs">
        <button
          className={`spv-tab ${tab === "original" ? "active" : ""}`}
          onClick={() => setTab("original")}
        >
          Original (SAGE)
        </button>
        <button
          className={`spv-tab ${tab === "imported" ? "active" : ""}`}
          onClick={() => setTab("imported")}
        >
          Imported (Our Data)
          {imported && <CheckCircle2 size={13} className="spv-tab-check" />}
        </button>
      </div>

      {tab === "original" ? (
        <div className="spv-panel">
          {/* OVERVIEW */}
          <div className="spv-card">
            <label>Overview</label>
            <div className="spv-info-grid">
              <div>
                <span>Supplier Company</span>
                <strong>{supplier?.coName || "—"}</strong>
              </div>
              <div>
                <span>Supplier ID</span>
                <strong>{supplier?.suppId || "—"}</strong>
              </div>
              <div>
                <span>Supplier Category</span>
                <strong>{category || "—"}</strong>
              </div>
              <div>
                <span>Dimensions</span>
                <strong>{dimensions || "—"}</strong>
              </div>
              <div>
                <span>Production Time</span>
                <strong>{prodTime || "—"}</strong>
              </div>
              <div>
                <span>Themes</span>
                <strong>{themes || "—"}</strong>
              </div>
              {keywords && (
                <div className="spv-info-grid-wide">
                  <span>Keywords</span>
                  <strong>{keywords}</strong>
                </div>
              )}
            </div>
          </div>

          {description && (
            <div className="spv-card">
              <label>Description</label>
              <p className="spv-description">{description}</p>
            </div>
          )}

          {/* PRICING */}
          <div className="spv-card">
            <label>Pricing (as supplied by SAGE)</label>
            {tierRows.length ? (
              <>
                <table className="spv-table">
                  <thead>
                    <tr>
                      <th>Qty</th>
                      <th>List Price</th>
                      <th>Net Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tierRows.map((t, i) => (
                      <tr key={i}>
                        <td>{t.qty}</td>
                        <td>{t.price}</td>
                        <td>{t.net || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="spv-note">
                  Price is the same across all colors — SAGE doesn't provide
                  per-color pricing, only per-quantity tiers.
                </p>
              </>
            ) : (
              <span className="spv-empty">No pricing tiers provided</span>
            )}
          </div>

          {/* VARIANT / STOCK DATA — the colours the import makes variants
              for, as the backend works them out from SAGE's stock list
              (`skus`, with per-colour stock) and its shortened colour text,
              then the text entries it leaves out. See src/lib/sageColors.ts. */}
          <div className="spv-card">
            <label>Variant Data — Color &amp; Stock ({colorTable.count})</label>
            {colorTable.note && (
              <p className="spv-note spv-note--above">{colorTable.note}</p>
            )}
            {colorTable.rows.length ? (
              <table className="spv-table spv-variant-table">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Color</th>
                    <th>In Stock</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {colorTable.rows.map((v) => (
                    <tr key={v.key}>
                      <td>
                        {v.image ? (
                          <div className="spv-variant-thumb">
                            <img src={v.image} alt={v.name} loading="lazy" />
                          </div>
                        ) : (
                          <div className="spv-variant-thumb spv-variant-thumb--empty">
                            —
                          </div>
                        )}
                      </td>
                      <td>
                        {v.name}
                        {v.listedAs && (
                          <span className="spv-variant-listed-as">
                            {`In colour text as "${v.listedAs}"`}
                          </span>
                        )}
                        {v.stockListAs && (
                          <span className="spv-variant-listed-as">
                            {`In stock list as "${v.stockListAs}"`}
                          </span>
                        )}
                      </td>
                      <td>{v.stock}</td>
                      <td>
                        <span
                          className={`spv-badge spv-badge--${v.badge.tone}`}
                          title={v.badge.hint}
                        >
                          {v.badge.label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <span className="spv-empty">No variant data provided</span>
            )}
          </div>

          {/* IMPRINT OPTIONS */}
          {options.length > 0 && (
            <div className="spv-card">
              <label>Imprint / Customization Options</label>
              {options.map((o: any, i: number) => (
                <div key={i} className="spv-option-group">
                  <span className="spv-option-name">{o.name}</span>
                  <div className="spv-chip-row">
                    {(o.values || []).map((v: any, j: number) => (
                      <span className="spv-chip" key={j}>
                        {v.value}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* IMPRINT & DECORATION */}
          <div className="spv-card">
            <label>Imprint &amp; Decoration</label>
            <div className="spv-info-grid">
              <div>
                <span>Method</span>
                <strong>{decorationMethod || "—"}</strong>
              </div>
              <div>
                <span>Primary Location</span>
                <strong>{imprintLoc || "—"}</strong>
              </div>
              <div>
                <span>Primary Area</span>
                <strong>{imprintArea || "—"}</strong>
              </div>
              {secondImprintLoc && (
                <div>
                  <span>Second Location</span>
                  <strong>{secondImprintLoc}</strong>
                </div>
              )}
              {secondImprintArea && (
                <div>
                  <span>Second Area</span>
                  <strong>{secondImprintArea}</strong>
                </div>
              )}
              {priceIncludes && (
                <div className="spv-info-grid-wide">
                  <span>Price Includes</span>
                  <strong>{priceIncludes}</strong>
                </div>
              )}
            </div>
            {chargeRows.length > 0 && (
              <table className="spv-table" style={{ marginTop: 14 }}>
                <thead>
                  <tr>
                    <th>Charge Type</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {chargeRows.map((c) => (
                    <tr key={c.label}>
                      <td>{c.label}</td>
                      <td>{c.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* PACKAGING & SHIPPING */}
          <div className="spv-card">
            <label>Packaging &amp; Shipping</label>
            <div className="spv-info-grid">
              <div>
                <span>Package Type</span>
                <strong>{packageType || "—"}</strong>
              </div>
              <div>
                <span>Units per Carton</span>
                <strong>{formatQty(unitsPerCarton) || "—"}</strong>
              </div>
              <div>
                <span>Weight per Carton</span>
                <strong>
                  {formatQty(weightPerCarton)
                    ? `${formatQty(weightPerCarton)} lb`
                    : "—"}
                </strong>
              </div>
              <div>
                <span>Carton Dimensions</span>
                <strong>
                  {formatQty(cartonL) && formatQty(cartonW) && formatQty(cartonH)
                    ? `${cartonL} × ${cartonW} × ${cartonH}`
                    : "—"}
                </strong>
              </div>
              <div>
                <span>Ships From</span>
                <strong>
                  {shipPointCountry
                    ? `${shipPointCountry} ${shipPointZip || ""}`.trim()
                    : "—"}
                </strong>
              </div>
              <div>
                <span>Made In</span>
                <strong>{madeInCountry || "—"}</strong>
              </div>
              <div>
                <span>Assembled In</span>
                <strong>{assembledInCountry || "—"}</strong>
              </div>
              <div>
                <span>Decorated In</span>
                <strong>{decoratedInCountry || "—"}</strong>
              </div>
            </div>
          </div>

          {/* SUPPLIER NOTES — the free-text `comment` field often carries
              real operational info (extra fees, holding charges, handling
              minimums) that isn't captured in any structured field above.
              Easy to miss entirely if it's not surfaced explicitly. */}
          {comment && (
            <div className="spv-card">
              <label>Supplier Notes</label>
              <p className="spv-description spv-comment">{comment}</p>
            </div>
          )}

          {/* COMPLIANCE */}
          {(productCompliance || warningLbl || activeFlags.length > 0) && (
            <div className="spv-card">
              <label>Compliance</label>
              {activeFlags.length > 0 && (
                <div className="spv-chip-row" style={{ marginBottom: 12 }}>
                  {activeFlags.map((f) => (
                    <span className="spv-chip spv-chip--flag" key={f.key}>
                      {f.label}
                    </span>
                  ))}
                </div>
              )}
              {productCompliance && (
                <p className="spv-note">
                  <strong>{productCompliance}</strong>
                </p>
              )}
              {warningLbl && (
                <div className="spv-warning-box">
                  <AlertTriangle size={15} />
                  <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(warningLbl) }} />
                </div>
              )}
            </div>
          )}

          {/* SUPPLIER POLICIES */}
          {supplier?.generalInfo && (
            <div className="spv-card">
              <label>Supplier Policies</label>
              <div className="spv-info-grid">
                <div>
                  <span>Imprint Methods</span>
                  <strong>{supplier.generalInfo.imprintMethods || "—"}</strong>
                </div>
                <div>
                  <span>Imprint Colors</span>
                  <strong>{supplier.generalInfo.imprintColors || "—"}</strong>
                </div>
                <div>
                  <span>Proof Provided</span>
                  <strong>{supplier.generalInfo.proofInfo || "—"}</strong>
                </div>
                <div>
                  <span>Less-Than-Minimum Orders</span>
                  <strong>{supplier.generalInfo.lessMinInfo || "—"}</strong>
                </div>
                <div>
                  <span>Shipping Options</span>
                  <strong>{supplier.generalInfo.shipInfo || "—"}</strong>
                </div>
                <div>
                  <span>Warranty</span>
                  <strong>{supplier.generalInfo.warrantyInfo || "—"}</strong>
                </div>
                <div>
                  <span>Returns</span>
                  <strong>{supplier.generalInfo.returnsInfo || "—"}</strong>
                </div>
                <div>
                  <span>Art File Requirements</span>
                  <strong>{supplier.generalInfo.artInfo || "—"}</strong>
                </div>
              </div>
              <div className="spv-supplier-contact">
                {supplier.contactName && <span>{supplier.contactName}</span>}
                {supplier.email && <span>{supplier.email}</span>}
                {supplier.tel && <span>{supplier.tel}</span>}
                {supplier.web && (
                  <a href={`https://${supplier.web}`} target="_blank" rel="noreferrer">
                    {supplier.web}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* IMAGES */}
          <div className="spv-card">
            <label>Product Images ({generalImages.length})</label>
            {generalImages.length ? (
              <div className="spv-image-grid">
                {generalImages.map((p: any, i: number) => (
                  <div className="spv-image-cell" key={i}>
                    <img src={p.url} alt="" loading="lazy" />
                  </div>
                ))}
              </div>
            ) : (
              <span className="spv-empty">None provided</span>
            )}
          </div>
        </div>
      ) : (
        <div className="spv-panel">
          {imported ? (
            <div className="spv-card spv-imported-summary">
              <div className="spv-imported-summary-icon">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <strong>This product is imported into your catalog.</strong>
                <p>
                  {variantCount} variant{variantCount === 1 ? "" : "s"}{" "}
                  currently stored.
                </p>
              </div>
              <button
                className="spv-primary-btn spv-primary-btn--stored"
                onClick={() => navigate(`/products/${importedProductId}`)}
              >
                <ExternalLink size={15} />
                Open Full Stored Product Page
              </button>
            </div>
          ) : (
            <div className="spv-card spv-imported-summary spv-imported-summary--empty">
              <div className="spv-imported-summary-icon spv-imported-summary-icon--empty">
                <XCircle size={22} />
              </div>
              <div>
                <strong>Not imported yet.</strong>
                <p>Import it to see your stored version here.</p>
              </div>
              <button
                className="spv-primary-btn spv-primary-btn--import"
                onClick={handleImport}
                disabled={importing}
              >
                {importing ? (
                  <Loader2 size={15} className="spv-spin" />
                ) : (
                  <DownloadCloud size={15} />
                )}
                {importing ? "Importing…" : "Import Now"}
              </button>
            </div>
          )}

          {imported && variants.length > 0 && (
            <div className="spv-card">
              <label>Stored Variants ({variants.length})</label>
              <table className="spv-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Color</th>
                    <th>Stock</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v: any) => (
                    <tr key={v.id}>
                      <td className="spv-mono">{v.sku}</td>
                      <td>{v.color || "—"}</td>
                      <td>{sageStockLabel(v)}</td>
                      <td>{formatMoney(v.price) || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SageProductView;