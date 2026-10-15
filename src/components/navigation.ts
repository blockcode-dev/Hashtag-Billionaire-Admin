/** @format */

import {
  BadgeDollarSign,
  BriefcaseBusiness,
  CreditCard,
  FolderTree,
  Globe,
  Import,
  LayoutDashboard,
  Layers,
  Link2,
  Mail,
  Package,
  PackagePlus,
  PackageSearch,
  ShoppingBag,
  SlidersHorizontal,
  Tags,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavLeaf {
  title: string;
  url: string;
}

export interface NavItem {
  title: string;
  icon: LucideIcon;
  url?: string;
  children?: NavLeaf[];
  // Admin accounts are managed by Super Admins only.
  superAdminOnly?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "People",
    items: [
      { title: "Users", url: "/users", icon: Users },
      { title: "Admins", url: "/admins", icon: UserCog, superAdminOnly: true },
    ],
  },
  {
    label: "Catalog",
    items: [
      { title: "Products", url: "/products", icon: Package },
      { title: "Variants", url: "/variants", icon: Layers },
      { title: "Add-on Products", url: "/add-ons", icon: PackagePlus },
      { title: "Customizations", url: "/customizations", icon: SlidersHorizontal },
      {
        title: "Categories",
        icon: FolderTree,
        children: [
          { title: "Categories", url: "/grand-category" },
          { title: "Sub Categories", url: "/parent-category" },
        ],
      },
    ],
  },
  {
    label: "Commerce",
    items: [
      { title: "Orders", url: "/orders", icon: ShoppingBag },
      { title: "Payments", url: "/payments", icon: CreditCard },
      { title: "Pricing Markup", url: "/pricing-markup", icon: BadgeDollarSign },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Import", url: "/import", icon: Import },
      { title: "SAGE Live Catalog", url: "/sage-live-catalog", icon: Globe },
      { title: "Brand Management", url: "/brand-management", icon: Tags },
      { title: "Brand Assignment", url: "/brand-assignment", icon: Link2 },
      {
        title: "Industry Management",
        icon: BriefcaseBusiness,
        children: [
          { title: "Industries", url: "/industries" },
          { title: "Use Cases", url: "/use-cases" },
        ],
      },
      { title: "Contact Us", url: "/contact-us", icon: Mail },
      { title: "Sourcing Requests", url: "/sourcing-requests", icon: PackageSearch },
    ],
  },
];

// Routes that live outside the menu but belong to a menu entry.
const ALIASES: Record<string, string> = {
  "/create-product": "/products",
  "/create-brand": "/brand-management",
  "/variant": "/variants",
};

// Pages reached from the account menu rather than the sidebar.
const ACCOUNT_PAGES: Record<string, string> = {
  "/admin/profile": "Profile",
  "/change-password": "Change password",
  "/settings": "Settings",
};

const matches = (pathname: string, url: string) => pathname === url || pathname.startsWith(url + "/");

const resolve = (pathname: string) => {
  const alias = Object.keys(ALIASES).find((from) => matches(pathname, from));
  return alias ? ALIASES[alias] : pathname;
};

// True when the page at `pathname` belongs to the menu entry at `url`.
export function isNavActive(pathname: string, url: string) {
  return matches(resolve(pathname), url);
}

export interface NavLocation {
  group?: string;
  parent?: string;
  title: string;
}

// Where `pathname` sits in the menu, for the header breadcrumb.
export function findNavLocation(pathname: string): NavLocation | null {
  const account = Object.keys(ACCOUNT_PAGES).find((url) => matches(pathname, url));
  if (account) return { group: "Account", title: ACCOUNT_PAGES[account] };

  const path = resolve(pathname);
  let best: (NavLocation & { len: number }) | null = null;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      const leaves = item.children
        ? item.children.map((c) => ({ ...c, parent: item.title }))
        : item.url
          ? [{ title: item.title, url: item.url, parent: undefined }]
          : [];
      for (const leaf of leaves) {
        if (matches(path, leaf.url) && (!best || leaf.url.length > best.len)) {
          best = { group: group.label, parent: leaf.parent, title: leaf.title, len: leaf.url.length };
        }
      }
    }
  }
  if (!best) return null;
  const { len: _len, ...location } = best;
  // "Categories / Categories" reads as a mistake; keep just the page.
  if (location.parent === location.title) location.parent = undefined;
  return location;
}
