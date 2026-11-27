/** @format */

// The Products page keeps its search, supplier tab, filters and page in the session (under
// PRODUCTS_LIST_STATE_KEY), so they're still there after opening a product and coming back. They
// last only while you stay on Products and the pages its buttons open: going anywhere else, or
// clicking any item in the menu, starts the list fresh (AdminLayout and AdminSidebar).

export const PRODUCTS_LIST_STATE_KEY = "products-list";

// Products and the pages its buttons open: a product's page, Edit, Edit (manual), Duplicate, a
// variant's page, Add product and Import from CSV.
const PRODUCT_PAGES = [
  /^\/products(\/[^/]+(\/(edit|edit-manual|duplicate))?)?\/?$/,
  /^\/variant\/[^/]+\/?$/,
  /^\/create-product\/?$/,
  /^\/import-products\/?$/,
];

export const isProductsPage = (pathname: string) => PRODUCT_PAGES.some((page) => page.test(pathname));

export const forgetProductsList = () => {
  try {
    sessionStorage.removeItem(PRODUCTS_LIST_STATE_KEY);
  } catch {
    // Storage is off: nothing was kept.
  }
};
