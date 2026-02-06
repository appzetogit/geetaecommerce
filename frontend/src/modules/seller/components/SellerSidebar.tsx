import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

interface SubMenuItem {
  label: string;
  path: string;
  icon: JSX.Element;
}

interface MenuItem {
  label: string;
  path: string;
  hasSubmenu?: boolean;
  submenuItems?: SubMenuItem[];
  icon?: JSX.Element;
}

interface SellerSidebarProps {
  onClose?: () => void;
}

const menuItems: MenuItem[] = [
  { label: "Dashboard", path: "/seller" },
  {
    label: "Orders",
    path: "/seller/orders",
    hasSubmenu: true,
    submenuItems: [
      {
        label: "All",
        path: "/seller/orders/all",
        icon: (
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        ),
      },
      {
        label: "Pending",
        path: "/seller/orders/pending",
        icon: (
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ),
      },
      {
        label: "Received",
        path: "/seller/orders/received",
        icon: (
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        ),
      },
      {
        label: "Processed",
        path: "/seller/orders/processed",
        icon: (
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
        ),
      },
      {
        label: "Shipped",
        path: "/seller/orders/shipped",
        icon: (
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        ),
      },
      {
        label: "Out For Delivery",
        path: "/seller/orders/out-for-delivery",
        icon: (
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        ),
      },
       {
        label: "Delivered",
        path: "/seller/orders/delivered",
        icon: (
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        ),
      },
       {
        label: "Cancelled",
        path: "/seller/orders/cancelled",
        icon: (
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        ),
      },
    ],
  },
  {
    label: "Requests",
    path: "/seller/requests",
    hasSubmenu: true,
    submenuItems: [
      {
        label: "Return Requests",
        path: "/seller/return-requests",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
        ),
      },
      {
        label: "Replace Requests",
        path: "/seller/replace-requests",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        ),
      },
    ],
  },
  {
    label: "POS System",
    path: "/seller/pos",
    hasSubmenu: true,
    submenuItems: [
      {
        label: "POS Orders",
        path: "/seller/pos/orders",
        icon: (
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
        ),
      },
      {
        label: "POS Report",
        path: "/seller/pos/report",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>
        ),
      },
    ],
  },
  { label: "Category", path: "/seller/category" },
  { label: "SubCategory", path: "/seller/subcategory" },
  {
    label: "Attribute Setup",
    path: "/seller/product/attribute-setup",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M12 18v-6"></path><path d="M8 15h8"></path></svg>
    ),
  },
  {
    label: "Product",
    path: "/seller/product",
    hasSubmenu: true,
    submenuItems: [
      {
        label: "Add new Product",
        path: "/seller/product/add",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line><line x1="16" y1="12" x2="8" y2="12"></line><line x1="12" y1="16" x2="12" y2="8"></line></svg>
        ),
      },
      {
        label: "Taxes",
        path: "/seller/product/taxes",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="18" rx="4" ry="2"></ellipse><ellipse cx="12" cy="14" rx="3.5" ry="1.8"></ellipse><ellipse cx="12" cy="10" rx="3" ry="1.5"></ellipse><circle cx="9" cy="9" r="1" fill="currentColor"></circle><line x1="7" y1="7" x2="11" y2="11" strokeWidth="2"></line><circle cx="15" cy="11" r="1" fill="currentColor"></circle></svg>
        ),
      },
      {
        label: "Product List",
        path: "/seller/product/list",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><polyline points="9 12 11 14 15 10"></polyline><polyline points="9 16 11 18 15 14"></polyline></svg>
        ),
      },
      {
        label: "Stock Management",
        path: "/seller/product/stock",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
        ),
      },
    ],
  },
  {
    label: "Reports",
    path: "/seller/reports",
    hasSubmenu: true,
    submenuItems: [
      {
        label: "Sales Report",
        path: "/seller/reports/sales",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
        ),
      },
      {
        label: "Sales Summary",
        path: "/seller/sales-summary",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        ),
      },
    ],
  },
  {
    label: "Wallet",
    path: "/seller/wallet",
    hasSubmenu: true,
    submenuItems: [
      {
        label: "Wallet Transactions",
        path: "/seller/wallet/transactions",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
        ),
      },
      {
        label: "Withdrawal Requests",
        path: "/seller/wallet/withdrawals",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        ),
      },
    ],
  },
  {
    label: "Product Settings",
    path: "/seller/product-display-settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
    ),
  },
  {
    label: "Barcode Settings",
    path: "/seller/barcode-settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="2" height="16"></rect><rect x="7" y="4" width="1" height="16"></rect><rect x="11" y="4" width="2" height="16"></rect><rect x="15" y="4" width="1" height="16"></rect><rect x="19" y="4" width="2" height="16"></rect></svg>
    ),
  },
];

export default function SellerSidebar({ onClose }: SellerSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

  const isActive = (path: string) => {
    if (path === "/seller") {
      return (
        location.pathname === "/seller" || location.pathname === "/seller/"
      );
    }
    return location.pathname.startsWith(path);
  };

  const isSubmenuActive = (submenuItems?: SubMenuItem[]) => {
    if (!submenuItems) return false;
    return submenuItems.some(
      (item) =>
        location.pathname === item.path ||
        location.pathname.startsWith(item.path + "/")
    );
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    // Close sidebar on mobile after navigation
    if (onClose && window.innerWidth < 1024) {
      onClose();
    }
  };

  const toggleMenu = (path: string) => {
    setExpandedMenus((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const isExpanded = (path: string) => {
    return (
      expandedMenus.has(path) ||
      isSubmenuActive(
        menuItems.find((item) => item.path === path)?.submenuItems
      )
    );
  };

  return (
    <aside className="w-64 bg-[#f187b5] h-screen flex flex-col">
      {/* Close button - only show on mobile */}
      <div className="flex justify-end p-4 border-b border-[#e076a5] lg:hidden">
        <button
          onClick={onClose}
          className="p-2 text-pink-50 hover:text-white transition-colors"
          aria-label="Close menu">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg">
            <path
              d="M18 6L6 18M6 6L18 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <nav className="flex-1 py-4 sm:py-6 overflow-y-auto">
        <ul className="space-y-1 px-2 sm:px-4">
          {menuItems.map((item) => {
            const expanded = isExpanded(item.path);
            const active =
              isActive(item.path) || isSubmenuActive(item.submenuItems);

            return (
              <li key={item.path}>
                <button
                  onClick={() => {
                    if (item.hasSubmenu && item.submenuItems) {
                      toggleMenu(item.path);
                    } else {
                      handleNavigation(item.path);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-left transition-colors ${active
                    ? "bg-[#e076a5] text-white"
                    : "text-pink-100 hover:bg-[#e076a5]/50 hover:text-white"
                    }`}>
                  <div className="flex items-center gap-2">
                    {item.icon && (
                      <span className="flex-shrink-0">{item.icon}</span>
                    )}
                    <span className="text-xs sm:text-sm font-medium">
                      {item.label}
                    </span>
                  </div>
                  {item.hasSubmenu && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className={`transition-transform ${expanded ? "rotate-180" : ""
                        } ${active ? "text-white" : "text-pink-200"}`}>
                      <path
                        d="M6 9L12 15L18 9"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
                {item.hasSubmenu && item.submenuItems && expanded && (
                  <ul className="mt-1 space-y-1 ml-4">
                    {item.submenuItems.map((subItem) => {
                      const subActive =
                        location.pathname === subItem.path ||
                        location.pathname.startsWith(subItem.path + "/");
                      return (
                        <li key={subItem.path}>
                          <button
                            onClick={() => handleNavigation(subItem.path)}
                            className={`w-full flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-left transition-colors ${subActive
                              ? "bg-[#cf6594] text-white"
                              : "text-pink-100 hover:bg-[#e076a5]/50 hover:text-white"
                              }`}>
                            <span className="flex-shrink-0">
                              {subItem.icon}
                            </span>
                            <span className="text-xs sm:text-sm font-medium">
                              {subItem.label}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
