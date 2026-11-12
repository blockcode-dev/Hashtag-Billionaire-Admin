/** @format */

import { FolderOpen, Save } from "lucide-react";

import styles from "./PricingTemplateBar.module.scss";

// Above a variant's quantity pricing: load saved pricing, or save this one.
export function PricingTemplateBar({
  onLoad,
  onSave,
}: {
  onLoad: () => void;
  onSave: () => void;
}) {
  return (
    <div className={styles.bar}>
      <div className={styles.text}>
        <strong>Pricing templates</strong>
        <span>Load pricing you saved before, or save this pricing to reuse it.</span>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={onLoad}>
          <FolderOpen size="1em" /> Load template
        </button>
        <button type="button" className={styles.button} onClick={onSave}>
          <Save size="1em" /> Save as template
        </button>
      </div>
    </div>
  );
}
