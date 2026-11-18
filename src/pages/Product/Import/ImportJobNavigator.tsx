/** @format */

import { useEffect } from "react";
import { useNavigate } from "react-router";

import { IMPORT_PATH, registerImportPageOpener } from "./importJob";

// Lets the CSV import's message in the corner open the import page from any page.
// Mounted once, inside the router.
export function ImportJobNavigator() {
  const navigate = useNavigate();

  useEffect(() => {
    registerImportPageOpener(() => navigate(IMPORT_PATH));
    return () => registerImportPageOpener(null);
  }, [navigate]);

  return null;
}
