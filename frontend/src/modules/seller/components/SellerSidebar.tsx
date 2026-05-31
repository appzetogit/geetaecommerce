import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { canStaffAccessPath, getStaffSession } from "../../../utils/staffSession";

interface SubMenuItem {
  label: string;
  path: string;
  icon: JSX.Element;
  hasSubmenu?: boolean;
  submenuItems?: SubMenuItem[];
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
      {
        label: "Purchase Report",
        path: "/seller/purchase/report",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        ),
      },
      {
        label: "POS Quotations",
        path: "/seller/pos/quotations",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M16 13H8"></path><path d="M16 17H8"></path><path d="M10 9H9"></path></svg>
        ),
      },
      {
        label: "Supplier Ledger",
        path: "/seller/pos/suppliers",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
        ),
      },
    ],
  },
  {
    label: "Manage Staff",
    path: "/seller/manage-staff",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round">
        <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13"></path>
        <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88"></path>
      </svg>
    ),
  },
  {
    label: "Staff Bill Report",
    path: "/seller/staff-bill-report",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="8" y1="13" x2="16" y2="13"></line>
        <line x1="8" y1="17" x2="13" y2="17"></line>
      </svg>
    ),
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
    label: "Variation Setup",
    path: "/seller/product/variation-setup",
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
        label: "Order Report",
        path: "/seller/reports/order",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        ),
      },
      {
        label: "Invoice Report",
        path: "/seller/reports/invoice",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M12 18v-6"></path><path d="M8 15h8"></path></svg>
        ),
      },
      {
        label: "GST Sales Report",
        path: "/seller/reports/gst-sales",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
        ),
      },
      {
        label: "Custom GST Report",
        path: "/seller/reports/gst-register",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 10h18"></path><path d="M9 4v16"></path><path d="M15 14h3"></path><path d="M15 17h3"></path></svg>
        ),
      },
      {
        label: "Payment Report",
        path: "/seller/reports/payment",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
        ),
      },
      {
        label: "Sales Reports",
        path: "/seller/reports/sales",
        hasSubmenu: true,
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
        ),
        submenuItems: [
          {
            label: "Sales Summary",
            path: "/seller/reports/sales/summary",
            icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            )
          },
          {
            label: "Return and Exchange summary",
            path: "/seller/reports/sales/return-exchange",
            icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            )
          },
          {
            label: "Stock Sales Summary",
            path: "/seller/reports/sales/stock-sales",
            icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            )
          },
          {
            label: "Due Summary",
            path: "/seller/reports/sales/due-summary",
            icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            )
          },
        ]
      },
      {
        label: "Product Inventory Reports",
        path: "/seller/inventory-reports",
        hasSubmenu: true,
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
        ),
        submenuItems: [
          {
            label: "Stock Summary",
            path: "/seller/inventory-reports/stock-summary",
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            ),
          },
          {
            label: "Stock Balance",
            path: "/seller/inventory-reports/stock-balance",
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            ),
          },
          {
            label: "Low Stock",
            path: "/seller/inventory-reports/low-stock",
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            ),
          },
          {
            label: "Out of Stock",
            path: "/seller/inventory-reports/out-of-stock",
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
            ),
          },
          {
            label: "Loss Summary",
            path: "/seller/inventory-reports/loss-summary",
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
            ),
          },
        ],
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
    label: "Brand Settings",
    path: "/seller/account-settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l9-4 9 4-9 4-9-4z"></path><path d="M3 17l9 4 9-4"></path><path d="M3 12l9 4 9-4"></path></svg>
    ),
  },
  {
    label: "Delivery Settings",
    path: "/seller/account-settings?section=delivery",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
    ),
  },
  {
    label: "Payment List",
    path: "/seller/reports/payment",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
    ),
  },
  {
    label: "Other Configurations",
    path: "/seller/app-settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
    ),
  },
  {
    label: "Shiprocket Integration",
    path: "/seller/app-settings?tab=shiprocket",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v4H3z"></path><path d="M8 21h8"></path><path d="M12 7v14"></path></svg>
    ),
  },
  {
    label: "SMS Gateway",
    path: "/seller/sms-gateway",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
    ),
  },
  {
    label: "Product Settings",
    path: "/seller/product-display-settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
    ),
  },
  {
    label: "Bill Settings",
    path: "/seller/bill-settings",
    icon: (
       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
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
  const staffSession = getStaffSession("seller");
  const isStaffMode = !!staffSession;

  const filterVisibleSubItems = (items: SubMenuItem[]): SubMenuItem[] => {
    if (!isStaffMode) return items;

    return items.reduce<SubMenuItem[]>((acc, item) => {
      const filteredNested = item.submenuItems
        ? filterVisibleSubItems(item.submenuItems)
        : undefined;
      const selfAllowed = canStaffAccessPath("seller", item.path, staffSession?.permissions);
      const hasVisibleNested = !!(filteredNested && filteredNested.length > 0);

      if (!selfAllowed && !hasVisibleNested) {
        return acc;
      }

       const nextHasSubmenu = !!filteredNested && filteredNested.length > 0;

      acc.push({
        ...item,
        hasSubmenu: nextHasSubmenu,
        submenuItems: nextHasSubmenu ? filteredNested : undefined,
      });
      return acc;
    }, []);
  };

  const visibleMenuItems = isStaffMode
    ? menuItems.reduce<MenuItem[]>((acc, item) => {
        const filteredSubmenu = item.submenuItems
          ? filterVisibleSubItems(item.submenuItems)
          : undefined;
        const selfAllowed = canStaffAccessPath("seller", item.path, staffSession?.permissions);
        const hasVisibleChildren = !!(filteredSubmenu && filteredSubmenu.length > 0);

        if (!selfAllowed && !hasVisibleChildren) {
          return acc;
        }

        const nextHasSubmenu = !!filteredSubmenu && filteredSubmenu.length > 0;

        acc.push({
          ...item,
          hasSubmenu: nextHasSubmenu,
          submenuItems: nextHasSubmenu ? filteredSubmenu : undefined,
        });
        return acc;
      }, [])
    : menuItems;

  const isActive = (path: string) => {
    const normalizedPath = path.split("?")[0].split("#")[0];
    if (path === "/seller") {
      return (
        location.pathname === "/seller" || location.pathname === "/seller/"
      );
    }

    if (
      normalizedPath === "/seller/app-settings" ||
      normalizedPath === "/seller/sms-gateway"
    ) {
      return location.pathname.startsWith("/seller/account-settings");
    }

    return location.pathname.startsWith(normalizedPath);
  };

  const isSubmenuActive = (submenuItems?: SubMenuItem[]): boolean => {
    if (!submenuItems) return false;
    return submenuItems.some((item) => {
      if (item.submenuItems) {
        return isSubmenuActive(item.submenuItems);
      }
      return (
        location.pathname === item.path ||
        location.pathname.startsWith(item.path + "/")
      );
    });
  };

  const handleNavigation = (path: string) => {
    if (path.startsWith("/seller/app-settings") || path === "/seller/sms-gateway") {
      navigate("/seller/account-settings");
    } else {
      navigate(path);
    }
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
        visibleMenuItems.find((item) => item.path === path)?.submenuItems
      )
    );
  };

  return (
    <aside className="w-64 h-screen flex flex-col shadow-xl relative overflow-hidden" style={{ backgroundColor: 'var(--sidebar-color, var(--primary-color))' }}>
      {/* Decorative background element for premium feel (matching AdminSidebar) */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-32 h-32 bg-black/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Close button - only show on mobile */}
      <div className="relative flex flex-col h-full z-10">
      <div className="flex justify-end p-4 border-b border-white/10 lg:hidden">
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-white hover:text-white transition-colors"
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
          {visibleMenuItems.map((item) => {
            const expanded = isExpanded(item.path);
            const active =
              isActive(item.path) || isSubmenuActive(item.submenuItems);

            return (
              <li key={item.path}>
                <button
                  type="button"
                  onClick={() => {
                    if (item.hasSubmenu && item.submenuItems) {
                      toggleMenu(item.path);
                    } else {
                      handleNavigation(item.path);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-left transition-colors ${active
                    ? "bg-black/20 text-[var(--sidebar-text-color,white)]"
                    : "text-[var(--sidebar-text-color,white)] opacity-80 hover:bg-black/10 hover:opacity-100 hover:text-[var(--sidebar-text-color,white)]"
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
                      className={`transition-transform ${expanded ? "rotate-90" : ""} ${
                        active ? "text-[var(--sidebar-text-color,white)]" : "text-[var(--sidebar-text-color,white)] opacity-60"
                      }`}>
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
                      if (subItem.submenuItems) {
                        const expanded = isExpanded(subItem.path);
                        const active =
                          isSubmenuActive(subItem.submenuItems) ||
                          isActive(subItem.path);

                        return (
                          <li key={subItem.path}>
                            <button
                              type="button"
                              onClick={() => toggleMenu(subItem.path)}
                              className={`w-full flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-left transition-colors ${
                                active
                                  ? "bg-black/20 text-[var(--sidebar-text-color,white)]"
                                  : "text-[var(--sidebar-text-color,white)] opacity-80 hover:bg-black/10 hover:opacity-100 hover:text-[var(--sidebar-text-color,white)]"
                              }`}>
                              <div className="flex items-center gap-2">
                                <span className="flex-shrink-0">
                                  {subItem.icon}
                                </span>
                                <span className="text-xs sm:text-sm font-medium">
                                  {subItem.label}
                                </span>
                              </div>
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className={`transition-transform ${expanded ? "rotate-90" : ""} ${
                                  active ? "text-[var(--sidebar-text-color,white)]" : "text-[var(--sidebar-text-color,white)] opacity-60"
                                }`}>
                                <path
                                  d="M6 9L12 15L18 9"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                            {expanded && (
                              <ul className="mt-1 space-y-1 ml-4 border-l border-white/20 pl-2">
                                {subItem.submenuItems.map((nestedItem) => {
                                  const nestedActive =
                                    location.pathname === nestedItem.path ||
                                    location.pathname.startsWith(
                                      nestedItem.path + "/"
                                    );
                                  return (
                                    <li key={nestedItem.path}>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleNavigation(nestedItem.path)
                                        }
                                        className={`w-full flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2 rounded-lg text-left transition-colors ${
                                          nestedActive
                                            ? "bg-white/20 text-[var(--sidebar-text-color,white)]"
                                            : "text-[var(--sidebar-text-color,white)] opacity-80 hover:bg-black/10 hover:opacity-100"
                                        }`}>
                                        <span className="flex-shrink-0 scale-75">
                                          {nestedItem.icon}
                                        </span>
                                        <span className="text-xs sm:text-sm font-medium">
                                          {nestedItem.label}
                                        </span>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </li>
                        );
                      }

                      const subActive =
                        location.pathname === subItem.path ||
                        location.pathname.startsWith(subItem.path + "/");
                      return (
                        <li key={subItem.path}>
                          <button
                            type="button"
                            onClick={() => handleNavigation(subItem.path)}
                            className={`w-full flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-left transition-colors ${
                              subActive
                                ? "bg-white/20 text-[var(--sidebar-text-color,white)]"
                                : "text-[var(--sidebar-text-color,white)] opacity-80 hover:bg-black/10 hover:opacity-100"
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
      </div>
    </aside>
  );
}
