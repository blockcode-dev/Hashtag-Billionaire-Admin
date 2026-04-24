import { useState } from "react";
import SageImportBySupplierTab from "./Supplier/SageImportBySupplierTab";
import SageImportTab from "./Category/SageImportTab";
import "./Sageimporttab.scss";

const SageTabWrapper = () => {
  const [mode, setMode] = useState<"category" | "supplier">("category");

  return (
    <div className="sage-wrapper">
      <div className="sage-subtabs">
        <button
          className={`sage-subtab ${mode === "category" ? "sage-subtab--active" : ""}`}
          onClick={() => setMode("category")}
        >
          By Category
        </button>
        <button
          className={`sage-subtab ${mode === "supplier" ? "sage-subtab--active" : ""}`}
          onClick={() => setMode("supplier")}
        >
          By Supplier
        </button>
      </div>

      <div className="sage-subtab-content">
        {mode === "category" && <SageImportTab />}
        {mode === "supplier" && <SageImportBySupplierTab />}
      </div>
    </div>
  );
};

export default SageTabWrapper;