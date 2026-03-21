// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { getProducts, getProductById, getSellerPOSProducts as getPOSProducts, Product, updateProduct, createProduct } from '../../../services/api/productService';
import { createPOSOrder, initiatePOSOnlineOrder, verifyPOSPayment, getSellerOrderById as getOrderById } from '../../../services/api/orderService';
import { updateOrderItems } from '../../../services/api/admin/adminOrderService';
import { getAllCustomers, createCustomer } from '../../../services/api/seller/sellerCustomerService';
import { getAppSettings, AppSettings } from '../../../services/api/admin/adminSettingsService';
import { getCategories } from '../../../services/api/categoryService';
import { getBrands } from '../../../services/api/brandService';
import { useToast } from '../../../context/ToastContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { useAppContext } from '../../../context/AppContext';
import { appendPOSStaffBill, getStaffSession } from '../../../utils/staffSession';
import {
  getSellerPurchaseEntries as apiGetSellerPurchaseEntries,
  upsertSellerPurchaseEntry as apiUpsertSellerPurchaseEntry,
  getSellerPOSState as apiGetSellerPOSState,
  updateSellerPOSState as apiUpdateSellerPOSState
} from '../../../services/api/seller/sellerPurchaseService';
import { getAllSuppliers } from '../../../services/api/seller/supplierService';

// Interface for Cart Item extending Product
export interface CartItem extends Product {
  qty: number;
  customPrice?: number; // For edited selling price
  variationId?: string;
  isVariation?: boolean;
  originalProductId?: string | null;
  warrantyType?: "None" | "Warranty" | "Guarantee";
  warrantyDuration?: string;
}

interface Seller {
  _id: string;
  sellerName: string;
  storeName: string;
}
type Customer = any;

interface Bill {
  id: string;
  name: string;
  cart: CartItem[];
  selectedCustomer: Customer | null;
  customerSearch: string;
  paymentMethod: string;
  orderType: 'Retail' | 'Wholesale';
  createdAt: number;
}

interface PurchaseSupplier {
  name: string;
  phone: string;
  address: string;
  notes: string;
  gstNumber: string;
  openingBalance: string;
  openingBalanceType: "Payment" | "Receive";
}

export interface PurchaseItem {
  id: string;
  productId: string;
  baseProductId: string;
  productName: string;
  isVariant?: boolean;
  variationId?: string;
  image?: string;
  mrp: number;
  retailPrice: number;
  wholesalePrice: number;
  purchasePrice: number;
  qty: number;
  currentQty: number;
  includingGST: boolean;
  billDiscount: number;
  billDiscountType: "%" | "₹";
  gstPercent: number;
  barcode: string;
  mfgDate: string;
  expiry: string;
  hsn: string;
  batch: string;
  packOf: number;
  additionalOpen: boolean;
}

export interface PurchaseEntryRecord {
  id: string;
  type: 'purchase' | 'quotation';
  supplier: PurchaseSupplier | null;
  paymentMode: 'Cash' | 'Credit' | 'Online';
  date: string;
  items: PurchaseItem[];
  totals: {
    grossAmount: number;
    discountAmount: number;
    taxAmount: number;
    roundOff: number;
    netAmount: number;
  };
  createdAt: string;
  billAttachment?: string;
}

const SellerPOSOrders = () => {
   const [searchParams] = useSearchParams();
   const editOrderId = searchParams.get('edit');
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { config, refreshConfig } = useAppContext();
  const activeStaffSession = getStaffSession('seller');

  useEffect(() => {
    refreshConfig();
  }, []);

  const [selectedSeller] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchQuery('');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Multi-Bill State
  const [bills, setBills] = useState<Bill[]>(() => {
    try {
      const savedBills = localStorage.getItem('pos_bills');
      if (savedBills) {
        const parsed = JSON.parse(savedBills);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (parsed.length === 1) {
             // Normalize single remaining bill's name to "Bill 1"
             parsed[0] = { ...parsed[0], name: 'Bill 1' };
          }
          return parsed;
        }
      }
    } catch (e) {
      console.error("Failed to load bills", e);
    }
    return [{
      id: '1',
      name: 'Bill 1',
      cart: [],
      selectedCustomer: null,
      customerSearch: '',
      paymentMethod: 'Cash',
      orderType: 'Retail',
      createdAt: Date.now()
    }];
  });

  const [activeBillId, setActiveBillId] = useState<string>(() => {
    return localStorage.getItem('pos_active_bill') || '1';
  });
  const posStateSyncTimeoutRef = useRef<any>(null);
  const posStateLoadedRef = useRef(false);

  // Ensure we find the correct bill, or default safely (though createNewBill sets ID correctly)
  const activeBill = bills.find(b => b.id === activeBillId) || {
      id: 'temp',
      name: 'Loading...',
      cart: [],
      selectedCustomer: null,
      customerSearch: '',
      paymentMethod: 'Cash',
      orderType: 'Retail',
      createdAt: Date.now()
  };

  // Helper to update active bill state
  const updateActiveBill = (updates: Partial<Bill>) => {
    setBills(prev => {
      const newBills = prev.map(b => b.id === activeBillId ? { ...b, ...updates } : b);
      localStorage.setItem('pos_bills', JSON.stringify(newBills));
      return newBills;
    });
  };

  const createNewBill = (reset: boolean = false) => {
    const newId = Date.now().toString() + Math.floor(Math.random() * 1000).toString();

    // Determine name: if resetting, try to keep the same name, otherwise increment
    let billName = `Bill ${bills.length + 1}`;
    if (reset) {
         const current = bills.find(b => b.id === activeBillId);
         if (current) billName = current.name;
         else billName = `Bill 1`; // Fallback for full reset scenario
    }

    const newBill: Bill = {
      id: newId,
      name: billName,
      cart: [],
      selectedCustomer: null,
      customerSearch: '',
      paymentMethod: 'Cash',
      orderType: 'Retail',
      createdAt: Date.now()
    };

    setBills(prev => {
      let updated;
      if (reset) {
          // If resetting, replace ONLY the active bill with the new empty one
          if (prev.some(b => b.id === activeBillId)) {
               updated = prev.map(b => b.id === activeBillId ? newBill : b);
          } else {
               // Fallback if active bill not found, though unlikely
               updated = [newBill];
          }
      } else {
          updated = [...prev, newBill];
      }

      localStorage.setItem('pos_bills', JSON.stringify(updated));
      return updated;
    });

    // Slight delay to ensure state propagation? No, React batches updates.
    setActiveBillId(newId);
    localStorage.setItem('pos_active_bill', newId);
  };

  const closeBill = (billId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (bills.length <= 1) {
      showToast("At least one bill must remain open", "error");
      return;
    }

    setBills(prev => {
      let updated = prev.filter(b => b.id !== billId);
      // If only one bill remains, ensure its name is "Bill 1"
      if (updated.length === 1) {
        updated = [{ ...updated[0], name: 'Bill 1' }];
      }
      localStorage.setItem('pos_bills', JSON.stringify(updated));

      // If closing active bill, switch to the last available one
      if (billId === activeBillId) {
        const nextBill = updated[updated.length - 1];
        setActiveBillId(nextBill.id);
        localStorage.setItem('pos_active_bill', nextBill.id);
      }
      return updated;
    });
  };

  // Derived State (Proxies for existing logic)
  const cart = activeBill.cart;
  const selectedCustomer = activeBill.selectedCustomer;
  const customerSearch = activeBill.customerSearch;
  const paymentMethod = activeBill.paymentMethod;

  const setCart = (action: React.SetStateAction<CartItem[]>) => {
    setBills(prev => {
        const index = prev.findIndex(b => b.id === activeBillIdRef.current);
        if (index === -1) return prev;

        const currentCart = prev[index].cart;
        let newCart;
        if (typeof action === 'function') {
            newCart = action(currentCart);
        } else {
            newCart = action;
        }

        const updated = [...prev];
        updated[index] = { ...updated[index], cart: newCart };
        localStorage.setItem('pos_bills', JSON.stringify(updated));
        return updated;
    });
  };

  const setPaymentMethod = (method: string) => {
      updateActiveBill({ paymentMethod: method });
      setShowPaymentDropdown(false);
  };

  const setOrderType = (type: 'Retail' | 'Wholesale') => {
      updateActiveBill({ orderType: type });
  };

  const setCustomerSearch = (search: string) => {
      updateActiveBill({ customerSearch: search });
  };

  const setSelectedCustomer = (customer: Customer | null) => {
      updateActiveBill({ selectedCustomer: customer });
  };

  // Derived state for new controls
  const orderType = activeBill.orderType || 'Retail';

  useEffect(() => {
    const loadPOSState = async () => {
      try {
        const res = await apiGetSellerPOSState();
        if (res.success && res.data) {
          const serverBills = Array.isArray(res.data.bills) ? res.data.bills : [];
          const serverActiveBillId = res.data.activeBillId || '1';
          if (serverBills.length > 0) {
            setBills(serverBills as Bill[]);
            setActiveBillId(serverActiveBillId);
            localStorage.setItem('pos_bills', JSON.stringify(serverBills));
            localStorage.setItem('pos_active_bill', serverActiveBillId);
          }
        }
      } catch {
        // keep existing local fallback behavior
      } finally {
        posStateLoadedRef.current = true;
      }
    };

    void loadPOSState();
  }, []);

  useEffect(() => {
    localStorage.setItem('pos_bills', JSON.stringify(bills));
    localStorage.setItem('pos_active_bill', activeBillId);

    if (!posStateLoadedRef.current) return;

    if (posStateSyncTimeoutRef.current) {
      clearTimeout(posStateSyncTimeoutRef.current);
    }
    posStateSyncTimeoutRef.current = setTimeout(async () => {
      try {
        await apiUpdateSellerPOSState({ bills, activeBillId });
      } catch {
        // keep UI flow uninterrupted if sync fails
      }
    }, 300);

    return () => {
      if (posStateSyncTimeoutRef.current) {
        clearTimeout(posStateSyncTimeoutRef.current);
      }
    };
  }, [bills, activeBillId]);

  useEffect(() => {
    localStorage.setItem('pos_active_bill', activeBillId);
  }, [activeBillId]);

  // Sync activeBillId if it refers to a non-existent bill (e.g. stale state)
  useEffect(() => {
    if (bills.length > 0 && !bills.some(b => b.id === activeBillId)) {
        setActiveBillId(bills[0].id);
    }
  }, [bills, activeBillId]);

  // Handle Edit Order Mode
  useEffect(() => {
    const loadEditOrder = async () => {
      if (!editOrderId) return;

      const billId = `edit_${editOrderId}`;
      const existingBill = bills.find(b => b.id === billId);

      if (existingBill) {
        setActiveBillId(billId);
        return;
      }

      setLoading(true);
      try {
        const res = await getOrderById(editOrderId);
        if (res.success && res.data) {
          const order = res.data;

          // Map Order Items to CartItems
          const mappedCart: CartItem[] = (order.items as any[]).map(item => {
             const resolvedProductId =
               item.productId ||
               item.product?._id ||
               item.product?.id ||
               (typeof item.product === 'string' && /^[a-f\d]{24}$/i.test(item.product) ? item.product : '') ||
               '';
             const resolvedVariationId = item.variationId || item.variation;

             return {
               _id: resolvedProductId || item._id,
               productName: item.productName || item.product?.productName || item.product || 'Unknown Product',
               // If we have custom unitPrice, use it as customPrice
               price: item.unitPrice,
               customPrice: item.unitPrice,
               qty: item.quantity,
               mainImage: item.productImage || item.product?.mainImage,
               originalProductId: resolvedProductId || null,
               variationId: resolvedVariationId,
               isVariation: !!resolvedVariationId,
               // Add extra fields as needed by CartItem interface (mocking some defaults if missing)
               stock: 9999, // Assume available for edit or fetch fresh?
               description: '',
               sku: item.sku || '',
               compareAtPrice: item.unitPrice * 1.2, // Mock if missing
               purchasePrice: 0,
               wholesalePrice: 0,
               category: 'uncategorized', // Mock
               seller: '', // Mock
               galleryImages: [],
               publish: true,
               popular: false,
               dealOfDay: false,
               status: 'Active',
               isReturnable: true,
               tags: [],
               requiresApproval: false,
               totalAllowedQuantity: 0,
               galleryImageUrls: [],
               variations: []
             };
          });

          const newBill: Bill = {
             id: billId,
             name: `Edit #${order.orderNumber}`,
             cart: mappedCart,
             selectedCustomer: typeof order.customer === 'object' ? order.customer as Customer : null,
             customerSearch: order.customerName || '',
             paymentMethod: order.paymentMethod,
             orderType: 'Retail', // Default or infer?
             createdAt: Date.now()
          };

          setBills(prev => {
             // Prevent duplicate tabs for same order
             if (prev.some(b => b.id === billId)) return prev;
             return [...prev, newBill];
          });
          setActiveBillId(billId);

          // Optionally populate selectedCustomer if it matches schema
          // Note: The 'customer' field in order might differ slightly from 'Customer' interface
        }
      } catch (e) {
        console.error("Failed to load order for editing", e);
        showToast("Failed to load order details", "error");
      } finally {
        setLoading(false);
      }
    };

    loadEditOrder();
  }, [editOrderId]);

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Modals
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [editingPurchaseItem, setEditingPurchaseItem] = useState<PurchaseItem | null>(null);

  // Quick Add Form
  const [quickForm, setQuickForm] = useState({ barcode: '', name: '', price: '', qty: '1', mrp: '', purchasePrice: '', wholesalePrice: '', categoryId: '', brandId: '', addToInventory: false, warrantyType: 'None' as "None" | "Warranty" | "Guarantee", warrantyDuration: '' });
  // Edit Item Form
  const [editForm, setEditForm] = useState({ name: '', price: '', qty: '', mrp: '', purchasePrice: '', wholesalePrice: '', warrantyType: 'None' as "None" | "Warranty" | "Guarantee", warrantyDuration: '' });
  const [purchaseEditForm, setPurchaseEditForm] = useState({ name: '', price: '', qty: '', mrp: '', purchasePrice: '', wholesalePrice: '', warrantyType: 'None' as "None" | "Warranty" | "Guarantee", warrantyDuration: '' });

  // New UI States
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);
  const [showProfit, setShowProfit] = useState(false);

  // Customer Search State
  // const [customerSearch, setCustomerSearch] = useState(''); // Removed global
  const [customers, setCustomers] = useState<Customer[]>([]);
  // const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null); // Removed global
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Fetch Settings, Sellers, Categories & Brands
    useEffect(() => {
    const fetchData = async () => {
      try {
        const [settingsRes, categoriesRes, brandsRes] = await Promise.all([
            getAppSettings(),
            getCategories(),
            getBrands()
        ]);
        if (settingsRes.success) setSettings(settingsRes.data);
        if (categoriesRes.success) setCategories(categoriesRes.data);
        if (brandsRes.success) setBrands(brandsRes.data);
      } catch (e) {
        console.error("Failed to fetch initial data", e);
      }
    };
    fetchData();
  }, []);

  // Success/Print Modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showModalBreakdown, setShowModalBreakdown] = useState(false);
  const [lastBillDetails, setLastBillDetails] = useState<{total: number, invoiceNum: string, date: string, time: string, cart: CartItem[], isPaid: boolean, isQuotation?: boolean, quotationEntry?: PurchaseEntryRecord, paymentMethod?: string} | null>(null);

  // Add Customer Modal State
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomerLoading, setNewCustomerLoading] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gst: ''
  });

  // Scanner State
  const [showScanner, setShowScanner] = useState(false);
  const [scanTarget, setScanTarget] = useState<'inventory' | 'quick-add' | 'purchase' | 'purchase-barcode'>('inventory');
  const [scannerKey, setScannerKey] = useState(0); // Force re-render of scanner
  const lastScanRef = useRef({ code: '', time: 0 });
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const addToCartRef = useRef<any>(null);
  const activeBillIdRef = useRef<string>(activeBillId);

  useEffect(() => {
    activeBillIdRef.current = activeBillId;
  }, [activeBillId]);

  // Mobile Search Modal State
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const [mobileCartView, setMobileCartView] = useState<'list' | 'grid'>('list');
  const [showPurchaseSheet, setShowPurchaseSheet] = useState(false);
  const [showPurchaseEntry, setShowPurchaseEntry] = useState(false);
  const [showPurchaseSearch, setShowPurchaseSearch] = useState(false);
  const [purchaseSearchQuery, setPurchaseSearchQuery] = useState('');
  const [purchaseMode, setPurchaseMode] = useState<'Purchase' | 'Quotation'>('Purchase');
  const [reduceStockOnQuotation, setReduceStockOnQuotation] = useState(false);
  const [purchasePaymentMethod, setPurchasePaymentMethod] = useState<'Cash' | 'Credit' | 'Online'>('Cash');
  const [showPurchasePaymentDropdown, setShowPurchasePaymentDropdown] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [purchaseItemsStore, setPurchaseItemsStore] = useState<PurchaseItem[]>([]);
  const [quotationItemsStore, setQuotationItemsStore] = useState<PurchaseItem[]>([]);

  const POS_ENTRY_DRAFT_KEY = 'seller_pos_purchase_entry_draft_v1';
  const prevShowPurchaseEntryRef = useRef<boolean>(false);

  const purchaseItems = purchaseMode === 'Purchase' ? purchaseItemsStore : quotationItemsStore;

  const setPurchaseItems = (action: React.SetStateAction<PurchaseItem[]>) => {
    if (purchaseMode === 'Purchase') {
      setPurchaseItemsStore(action);
    } else {
      setQuotationItemsStore(action);
    }
  };
  const [purchaseBarcodeScanItemId, setPurchaseBarcodeScanItemId] = useState<string | null>(null);
  const [purchaseSearchLoading, setPurchaseSearchLoading] = useState(false);
  const [purchaseSearchResults, setPurchaseSearchResults] = useState<Product[]>([]);
  const [purchaseSupplier, setPurchaseSupplier] = useState<PurchaseSupplier | null>(null);
  const [purchaseSupplierForm, setPurchaseSupplierForm] = useState<PurchaseSupplier>({
    name: '',
    phone: '',
    address: '',
    notes: '',
    gstNumber: '',
    openingBalance: '',
    openingBalanceType: 'Payment',
  });
  const [supplierSearch, setSupplierSearch] = useState('');
  const [allSuppliers, setAllSuppliers] = useState<any[]>([]);
  const [showSupplierResults, setShowSupplierResults] = useState(false);

  useEffect(() => {
    if (showSupplierModal) {
      setSupplierSearch('');
      setShowSupplierResults(false);
      const fetchSuppliers = async () => {
        try {
          const res = await getAllSuppliers();
          if (res.success) setAllSuppliers(res.data);
        } catch (e) {
          console.error("Failed to fetch suppliers", e);
        }
      };
      fetchSuppliers();
    }
  }, [showSupplierModal]);

  useEffect(() => {
    if (showPurchaseSearch) {
      setPurchaseSearchQuery('');
    }
  }, [showPurchaseSearch]);
  const [purchaseDate, setPurchaseDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [showVariantPicker, setShowVariantPicker] = useState(false);
  const [variantPickerItem, setVariantPickerItem] = useState<PurchaseItem | null>(null);
  const [billAttachment, setBillAttachment] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingQuotationId, setEditingQuotationId] = useState<string | null>(null);
  const [savedPurchaseEntries, setSavedPurchaseEntries] = useState<PurchaseEntryRecord[]>([]);

  useEffect(() => {
    try {
      // Only clear draft when user explicitly closes the entry screen (true -> false),
      // never on first mount (otherwise refresh would lose the draft before restore).
      const prev = prevShowPurchaseEntryRef.current;
      prevShowPurchaseEntryRef.current = showPurchaseEntry;
      if (prev && !showPurchaseEntry) {
        localStorage.removeItem(POS_ENTRY_DRAFT_KEY);
        return;
      }
      if (!showPurchaseEntry) return;

      const draft = {
        showPurchaseEntry,
        purchaseMode,
        purchaseItemsStore,
        quotationItemsStore,
        purchaseSupplier,
        purchaseDate,
        purchasePaymentMethod,
        reduceStockOnQuotation,
        editingQuotationId,
      };
      localStorage.setItem(POS_ENTRY_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore draft persistence failures
    }
  }, [
    showPurchaseEntry,
    purchaseMode,
    purchaseItemsStore,
    quotationItemsStore,
    purchaseSupplier,
    purchaseDate,
    purchasePaymentMethod,
    reduceStockOnQuotation,
    editingQuotationId,
  ]);

  const normalizePurchaseEntries = (list: any[]): PurchaseEntryRecord[] =>
    Array.isArray(list)
      ? list.map((q: any) => ({
          ...q,
          totals: {
            grossAmount: q.totals?.grossAmount ?? q.totals?.gross ?? 0,
            discountAmount: q.totals?.discountAmount ?? q.totals?.discount ?? 0,
            taxAmount: q.totals?.taxAmount ?? q.totals?.tax ?? 0,
            roundOff: q.totals?.roundOff ?? 0,
            netAmount: q.totals?.netAmount ?? q.totals?.net ?? 0,
          },
        }))
      : [];

  useEffect(() => {
    const loadSavedPurchaseEntries = async () => {
      try {
        const res = await apiGetSellerPurchaseEntries();
        if (res.success && Array.isArray(res.data)) {
          const normalized = normalizePurchaseEntries(res.data);
          setSavedPurchaseEntries(normalized);
          localStorage.setItem('seller_pos_purchase_entries', JSON.stringify(normalized));
          localStorage.setItem('admin_pos_purchase_entries', JSON.stringify(normalized));
          return;
        }
      } catch {
        // fallback to local cache
      }

      try {
        const raw =
          localStorage.getItem('seller_pos_purchase_entries') ||
          localStorage.getItem('admin_pos_purchase_entries');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        setSavedPurchaseEntries(normalizePurchaseEntries(parsed));
      } catch {
        setSavedPurchaseEntries([]);
      }
    };

    void loadSavedPurchaseEntries();
  }, []);

  // Handle Barcode Scan from Camera
  const onScanSuccess = async (decodedText: string, decodedResult: any) => {
      // Cooldown for same barcode to avoid double scans (2 seconds)
      const now = Date.now();
      if (decodedText === lastScanRef.current.code && (now - lastScanRef.current.time < 2000)) {
          return;
      }
      lastScanRef.current = { code: decodedText, time: now };

      // Don't process if loading to prevent spam
      if (loading) return;

      console.log(`Scan result (${scanTarget}): ${decodedText}`, decodedResult);

      // Special case: assign scanned barcode directly to a PurchaseItem's barcode field
      if (scanTarget === 'purchase-barcode') {
          if (purchaseBarcodeScanItemId) {
              setPurchaseItems(prev =>
                  prev.map(item =>
                      item.id === purchaseBarcodeScanItemId ? { ...item, barcode: decodedText } : item
                  )
              );
          }
          setShowScanner(false);
          return;
      }

      if (scanTarget === 'quick-add') {
          setQuickForm(prev => ({ ...prev, barcode: decodedText }));
          setShowScanner(false);
          showToast("Barcode added to form", "success");
          return;
      }

      // Default: Inventory search and add to cart
      try {
          // Play beep
          // const audio = new Audio('/assets/beep.mp3'); audio.play().catch(e=>{});

          // Use POS Search for optimized results
          const res = await getPOSProducts({ search: decodedText });
          if (res.success && res.data && res.data.length > 0) {
             const productsFound = res.data;
             // Try to find exact match on Barcode or SKU
             let match = productsFound.find((p: any) => {
               const barcodes = Array.isArray(p.barcode) ? p.barcode : (p.barcode ? [p.barcode] : []);
               return barcodes.some((b: string) => String(b).toLowerCase() === decodedText.toLowerCase()) ||
                      (p.sku && String(p.sku).toLowerCase() === decodedText.toLowerCase());
             });

             // If not found in product root, check variations
             let variationMatch: any = null;
              if (!match) {
                for (const p of productsFound) {
                  if (p.variations) {
                    const v = p.variations.find((varItem: any) => {
                      const barcodes = Array.isArray(varItem.barcode) ? varItem.barcode : (varItem.barcode ? [varItem.barcode] : []);
                      return barcodes.some((b: string) => String(b).toLowerCase() === decodedText.toLowerCase()) ||
                             (varItem.sku && String(varItem.sku).toLowerCase() === decodedText.toLowerCase());
                    });
                    if (v) {
                      match = p;
                      variationMatch = v;
                      break;
                    }
                  }
                }
              }

             if (!match) match = productsFound[0];

             if (scanTarget === 'purchase') {
                 if (variationMatch) {
                     const variationId = String(variationMatch?._id || variationMatch?.id || variationMatch?.variationId || variationMatch?.title || variationMatch?.name || Date.now());
                     const variantLabel = String(variationMatch?.title || variationMatch?.name || variationMatch?.variationName || 'Variant');
                     const variantProductId = `${match._id}-${variationId}`;

                     setPurchaseItems((prev) => {
                         const existing = prev.find((p) => p.productId === variantProductId);
                         if (existing) {
                             return prev.map((p) => (p.productId === variantProductId ? { ...p, qty: p.qty + 1 } : p));
                         }
                         const next: PurchaseItem = {
                             id: `purchase_var_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
                             productId: variantProductId,
                             baseProductId: match._id,
                             productName: `${match.productName} - ${variantLabel}`,
                             isVariant: true,
                             variationId,
                             image: match.mainImage,
                             mrp: Number(variationMatch?.compareAtPrice ?? match.compareAtPrice ?? match.price ?? 0),
                             retailPrice: Number(variationMatch?.price ?? match.price ?? 0),
                             wholesalePrice: Number(variationMatch?.wholesalePrice ?? match.wholesalePrice ?? 0),
                             purchasePrice: Number(variationMatch?.purchasePrice ?? match.purchasePrice ?? match.price ?? 0),
                             qty: 1,
                             currentQty: Number(variationMatch?.stock ?? 0),
                             includingGST: true,
                             billDiscount: 0,
                             billDiscountType: '%',
                             gstPercent: 18,
                             barcode: Array.isArray(variationMatch?.barcode) ? String(variationMatch.barcode[0] || '') : String(variationMatch?.barcode || ''),
                             mfgDate: '',
                             expiry: '',
                             hsn: '',
                             batch: '',
                             packOf: 1,
                             additionalOpen: true,
                         };
                         return [next, ...prev];
                     });
                 } else {
                     addProductToPurchase(match);
                 }
                 showToast(`Added to ${purchaseMode}: ${match.productName}`, "success");
                 setShowScanner(false);
                 return;
              }

             // Prepare Cart Item
             let itemToAdd: any = { ...match };

             if (variationMatch) {
                // Formatting variation as CartItem
                 itemToAdd = {
                     ...itemToAdd,
                     variationId: variationMatch._id,
                     _id: `${itemToAdd._id}-${variationMatch._id}`, // Consistent variation ID
                     isVariation: true,
                     stock: variationMatch.stock // Use variation stock
                 };
             } else {
                 itemToAdd.originalProductId = itemToAdd._id;
             }

             // Check Stock before adding
             if (itemToAdd.stock <= 0) {
                 showToast(`Item "${itemToAdd.productName}" is Out of Stock!`, "error");
             } else {
                 if (addToCartRef.current) {
                     addToCartRef.current({ ...itemToAdd, qty: 1 } as CartItem);
                 }
                 showToast(`Added: ${itemToAdd.productName}`, "success");
             }

             // Close scanner after successful add
             setShowScanner(false);
          } else {
             showToast(`Product not found: ${decodedText}`, "error");
          }
      } catch (e) {
         console.error("Scan Error", e);
         showToast("Error processing scan", "error");
      }
  };

  // Handle Quotation Edit/Convert from search params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');

    if (mode === 'edit_quotation') {
      const raw = sessionStorage.getItem('edit_quotation_data');
      if (raw) {
        try {
          const quote: PurchaseEntryRecord = JSON.parse(raw);
          setQuotationItemsStore(quote.items);
          setPurchaseSupplier(quote.supplier);
          setPurchaseMode('Quotation');
          setEditingQuotationId(quote.id);
          setPurchaseDate(quote.date);
          setPurchasePaymentMethod(quote.paymentMode);
          setShowPurchaseEntry(true);
          sessionStorage.removeItem('edit_quotation_data');
        } catch (e) {
          console.error("Failed to parse edit_quotation_data", e);
        }
      }
    } else if (mode === 'convert_quotation') {
      const raw = sessionStorage.getItem('convert_quotation_data');
      if (raw) {
        try {
          const quote: PurchaseEntryRecord = JSON.parse(raw);
          // Convert PurchaseItem to CartItem
          const cartItems: CartItem[] = quote.items.map(item => ({
            ...item,
            _id: item.isVariant ? `${item.productId}-${item.variationId}` : item.productId,
            productName: item.productName,
            price: item.retailPrice,
            mrp: item.mrp || item.retailPrice,
            qty: item.qty,
            stock: 999, // Dummy stock for checkout
            image: item.image,
            purchasePrice: item.purchasePrice,
            wholesalePrice: item.wholesalePrice || 0,
            gstPercent: item.gstPercent || 0,
            billDiscount: item.billDiscount || 0,
            originalProductId: item.productId,
            variationId: item.variationId,
            isVariation: item.isVariant
          } as any));
          setCart(cartItems);
          if (quote.supplier) {
            // Try to find matching customer
            const matchingCustomer = customers.find(c => c.phone === quote.supplier?.phone);
            if (matchingCustomer) {
                setSelectedCustomer(matchingCustomer);
            }
          }
          setShowPurchaseEntry(false);
          sessionStorage.removeItem('convert_quotation_data');
          showToast("Quotation loaded into cart. Proceed to checkout.", "success");
        } catch (e) {
          console.error("Failed to parse convert_quotation_data", e);
        }
      }
    } else if (mode === 'new_quotation') {
      setPurchaseMode('Quotation');
      setQuotationItemsStore([]);
      setPurchaseSupplier(null);
      setEditingQuotationId(null);
      setShowPurchaseEntry(true);
    } else if (mode === 'edit_purchase') {
      const raw = sessionStorage.getItem('edit_purchase_data');
      if (raw) {
        try {
          const purchase: any = JSON.parse(raw);
          setPurchaseItemsStore(purchase.items);
          setPurchaseSupplier(purchase.supplier);
          setPurchaseMode('Purchase');
          setEditingQuotationId(purchase.id);
          setPurchaseDate(purchase.date);
          setPurchasePaymentMethod(purchase.paymentMode);
          setShowPurchaseEntry(true);
          sessionStorage.removeItem('edit_purchase_data');
        } catch (e) {
          console.error("Failed to parse edit_purchase_data", e);
        }
      }
    } else if (!mode) {
      // No explicit mode in URL -> restore draft (refresh-safe)
      try {
        const raw = localStorage.getItem(POS_ENTRY_DRAFT_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (!draft || typeof draft !== 'object') return;
        if (!draft.showPurchaseEntry) return;

        if (draft.purchaseMode === 'Quotation' || draft.purchaseMode === 'Purchase') {
          setPurchaseMode(draft.purchaseMode);
        }
        if (Array.isArray(draft.purchaseItemsStore)) setPurchaseItemsStore(draft.purchaseItemsStore);
        if (Array.isArray(draft.quotationItemsStore)) setQuotationItemsStore(draft.quotationItemsStore);
        setPurchaseSupplier(draft.purchaseSupplier ?? null);
        if (typeof draft.purchaseDate === 'string' && draft.purchaseDate) setPurchaseDate(draft.purchaseDate);
        if (draft.purchasePaymentMethod === 'Cash' || draft.purchasePaymentMethod === 'Credit' || draft.purchasePaymentMethod === 'Online') {
          setPurchasePaymentMethod(draft.purchasePaymentMethod);
        }
        if (typeof draft.reduceStockOnQuotation === 'boolean') setReduceStockOnQuotation(draft.reduceStockOnQuotation);
        setEditingQuotationId(typeof draft.editingQuotationId === 'string' ? draft.editingQuotationId : null);
        setShowPurchaseEntry(true);
      } catch {
        // ignore restore failures
      }
    }
  }, [customers]);

  useEffect(() => {
    const startScanner = async () => {
        if (!showScanner) return;

        // Give a little time for the modal and DOM to mount
        await new Promise(r => setTimeout(r, 300));
        const element = document.getElementById('reader');
        if (!element) return;

        try {
            // If there's an existing instance, try to stop it first
            if (html5QrCodeRef.current) {
                try {
                    if (html5QrCodeRef.current.isScanning) {
                        await html5QrCodeRef.current.stop();
                    }
                    html5QrCodeRef.current.clear();
                } catch (e) {
                    console.warn("Error stopping previous scanner", e);
                }
            }

            // Create new instance
            const scanner = new Html5Qrcode("reader", {
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.CODE_93,
                    Html5QrcodeSupportedFormats.ITF,
                    Html5QrcodeSupportedFormats.CODABAR,
                    Html5QrcodeSupportedFormats.QR_CODE,
                ],
                useBarCodeDetectorIfSupported: true,
            });
            html5QrCodeRef.current = scanner;

            const boxWidth = Math.min(Math.max(element.clientWidth - 24, 220), 420);
            const boxHeight = Math.max(200, Math.floor(boxWidth * 0.45));
            const config: any = {
                fps: 20,
                qrbox: { width: boxWidth, height: boxHeight },
                disableFlip: true
            };

            await scanner.start(
                { facingMode: "environment" },
                config,
                onScanSuccess,
                () => {} // Ignore errors per frame
            );
        } catch (err) {
            console.error("Scanner Start Error:", err);
            showToast("Failed to start camera. Please check permissions and ensure you are on HTTPS.", "error");
            setShowScanner(false);
        }
    };

    if (showScanner) {
        startScanner();
    }

    return () => {
        const cleanup = async () => {
            if (html5QrCodeRef.current) {
                try {
                    if (html5QrCodeRef.current.isScanning) {
                        await html5QrCodeRef.current.stop();
                    }
                    html5QrCodeRef.current.clear();
                } catch (e) {
                    console.error("Scanner Cleanup Error:", e);
                }
            }
        };
        cleanup();
    };
  }, [showScanner, scannerKey]);

  // Search Customers
  useEffect(() => {
    // If we have a selected customer and the search matches their name, don't search again
    if (selectedCustomer && customerSearch.includes(selectedCustomer.name)) return;

    if (!customerSearch || customerSearch.length < 2) {
        setCustomers([]);
        setShowCustomerDropdown(false);
        return;
    }
    const timer = setTimeout(async () => {
        try {
            const res = await getAllCustomers({ search: customerSearch, limit: 5 });
            if (res.success && res.data) {
                setCustomers(res.data);
                setShowCustomerDropdown(true);
            }
        } catch (e) {
            console.error(e);
        }
    }, 400);
    return () => clearTimeout(timer);
  }, [customerSearch, selectedCustomer]);

  const selectCustomer = (c: Customer) => {
      // setSelectedCustomer(c);
      // const displayName = c.phone ? `${c.name} (${c.phone})` : c.name;
      // setCustomerSearch(displayName);
      const displayName = c.phone ? `${c.name} (${c.phone})` : c.name;
      updateActiveBill({ selectedCustomer: c, customerSearch: displayName });
      setShowCustomerDropdown(false);
  };

  const clearCustomer = () => {
      // setSelectedCustomer(null);
      // setCustomerSearch('');
      updateActiveBill({ selectedCustomer: null, customerSearch: '' });
      setCustomers([]);
  };

  const submitAddCustomer = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newCustomer.name || !newCustomer.phone) {
          showToast("Name and Phone are required", "error");
          return;
      }

      if (newCustomer.phone.length !== 10) {
          showToast("Phone number must be 10 digits", "error");
          return;
      }

      setNewCustomerLoading(true);
      try {
          const res = await createCustomer({
              ...newCustomer,
              email: newCustomer.email || `${newCustomer.phone}@placeholder.com` // Backend requires email
          });

          if (res.success && res.data) {
              const customer = res.data;
              showToast("Customer added successfully", "success");

              const displayName = customer.phone ? `${customer.name} (${customer.phone})` : customer.name;

              // Update bill state atomically
              updateActiveBill({
                  selectedCustomer: customer,
                  customerSearch: displayName,
                  paymentMethod: "Credit"
              });

              // Also update the local customers list used for the search dropdown
              setCustomers([customer]);
              setShowCustomerDropdown(false);

              setShowAddCustomerModal(false);
              setNewCustomer({
                  name: '',
                  phone: '',
                  email: '',
                  address: '',
                  city: '',
                  state: '',
                  pincode: '',
                  gst: ''
              });
          } else {
              showToast(res.message || "Failed to add customer", "error");
          }
      } catch (err: any) {
          console.error("Error adding customer", err);
          showToast(err.response?.data?.message || "Failed to add customer", "error");
      } finally {
          setNewCustomerLoading(false);
      }
  };

  const handleCustomerSearchChange = (val: string) => {
    updateActiveBill({ customerSearch: val });
  };

  // Fetch Products
  useEffect(() => {
    const fetchProducts = async () => {
      const activeSearch = (showMobileSearch ? mobileSearchQuery : searchQuery).trim();
      if (!activeSearch) {
        setProducts([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await getProducts({
          search: activeSearch,
          category: !showMobileSearch ? (selectedCategory || undefined) : undefined,
          brand: !showMobileSearch ? (selectedBrand || undefined) : undefined,
        });
        if (response.success && response.data) {
          // Expand Variations
          const expandedProducts: any[] = []; // Relax type to allow adding originalProductId

          response.data.forEach((product: any) => {
             if (product.variations && product.variations.length > 0) {
                 product.variations.forEach((variation: any) => {
                     expandedProducts.push({
                         ...product,
                         _id: `${product._id}-${variation._id}`, // Consistent ID for variations
                         originalProductId: product._id, // Store parent ID
                         productName: `${product.productName} - ${variation.title || variation.name || variation.variationName || 'Variation'}`,
                         price: variation.price,
                         compareAtPrice: variation.compareAtPrice || product.compareAtPrice, // Fallback to product MRP if variation doesn't have one
                         purchasePrice: variation.purchasePrice || product.purchasePrice, // Fallback to product PP
                         stock: variation.stock,
                         sku: variation.sku || product.sku, // Use variation SKU
                         isVariation: true,
                         variationId: variation._id,
                         wholesalePrice: Number(product.wholesalePrice || 0)
                     });
                 });
             } else {
                 expandedProducts.push({
                     ...product,
                     originalProductId: product._id,
                     wholesalePrice: product.wholesalePrice || 0
                 });
             }
          });

          setProducts(expandedProducts);
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        showToast("Failed to load products", "error");
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(() => {
        fetchProducts();
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, mobileSearchQuery, selectedCategory, selectedBrand, showMobileSearch]);

  useEffect(() => {
    if (!showPurchaseSearch) return;

    let isActive = true;
    const fetchPurchaseProducts = async () => {
      setPurchaseSearchLoading(true);
      try {
        const response = await getPOSProducts(purchaseSearchQuery.trim() ? { search: purchaseSearchQuery.trim() } : {});
        if (isActive && response.success) {
          setPurchaseSearchResults(response.data || []);
        }
      } catch {
        if (isActive) {
          setPurchaseSearchResults([]);
        }
      } finally {
        if (isActive) {
          setPurchaseSearchLoading(false);
        }
      }
    };

    const timer = setTimeout(fetchPurchaseProducts, 250);
    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [showPurchaseSearch, purchaseSearchQuery]);

  // Barcode Scanner Handler
  const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();

        // Helper to check for match
        const findMatch = (list: any[]) => list.find(p => {
            const barcodes = Array.isArray(p.barcode) ? p.barcode : (p.barcode ? [p.barcode] : []);
            return barcodes.some((b: string) => String(b).toLowerCase() === query) ||
                   (p.sku && String(p.sku).toLowerCase() === query) ||
                   (p.itemCode && String(p.itemCode).toLowerCase() === query);
        });

        let exactMatch = findMatch(products);

        if (exactMatch) {
            e.preventDefault();
            addToCart(exactMatch as CartItem);
            setSearchQuery(''); // Clear for next scan
            return;
        }

        // If not found in current products (maybe due to debounce or filter), fetch immediately
        try {
            const res = await getPOSProducts({ search: searchQuery.trim() });
            if (res.success && res.data && res.data.length > 0) {
                const expanded: any[] = [];
                res.data.forEach((product: any) => {
                    if (product.variations && product.variations.length > 0) {
                        product.variations.forEach((variation: any) => {
                            expanded.push({
                                ...product,
                                _id: `${product._id}-${variation._id}`,
                                originalProductId: product._id,
                                productName: `${product.productName} - ${variation.title || variation.name || variation.variationName || 'Variation'}`,
                                price: variation.price,
                                compareAtPrice: variation.compareAtPrice || product.compareAtPrice,
                                purchasePrice: variation.purchasePrice || product.purchasePrice,
                                stock: variation.stock,
                                sku: variation.sku || product.sku,
                                isVariation: true,
                                variationId: variation._id,
                                wholesalePrice: Number(product.wholesalePrice || 0)
                            });
                        });
                    } else {
                        expanded.push({
                            ...product,
                            originalProductId: product._id,
                            wholesalePrice: product.wholesalePrice || 0
                        });
                    }
                });

                exactMatch = findMatch(expanded);
                if (exactMatch) {
                    e.preventDefault();
                    if (addToCartRef.current) addToCartRef.current(exactMatch as CartItem);
                    setSearchQuery('');
                }
            }
        } catch (err) {
            console.error("Direct barcode search failed", err);
        }
    }
  };

  // --- Cart Logic ---
  const addToCart = (product: Product | CartItem) => {
    // Check Stock
    if (product.stock <= 0) {
        showToast(`Item "${product.productName}" is Out of Stock!`, "error");
        return;
    }

    setCart(prev => {
      const existing = prev.find(item => item._id === product._id);
      if (existing) {
        if (existing.qty >= product.stock) {
            showToast("Cannot add more than available stock", "error");
            return prev;
        }
        return prev.map(item => item._id === product._id ? { ...item, qty: item.qty + 1 } : item);
      }

      const price = (orderType === 'Wholesale' && product.wholesalePrice) ? product.wholesalePrice : product.price;
      const newItem = { ...(product as CartItem), qty: 1 };
      if (orderType === 'Wholesale' && product.wholesalePrice) {
          newItem.customPrice = product.wholesalePrice;
      }

      return [...prev, newItem];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item._id !== id));
  };

  const updateQuantity = (id: string, diff: number) => {
    setCart(prev => prev.map(item => {
      if (item._id === id) {
        const newQty = Math.max(1, item.qty + diff);
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const updateItemDetails = (id: string, updates: any) => {
    setCart(prev => prev.map(item => {
        if (item._id === id) {
            return { ...item, ...updates };
        }
        return item;
    }));
  };

  /*
   * Helper to get effective price based on Order Type
   * Retail -> item.price
   * Wholesale -> item.wholesalePrice (if > 0) else item.price
   */
  const getEffectivePrice = (item: CartItem & { isPurchaseItem?: boolean }) => {
      if (item.isPurchaseItem) return item.price;
      if (item.customPrice !== undefined) return item.customPrice;

      if (orderType === 'Wholesale' && item.wholesalePrice && item.wholesalePrice > 0) {
          return item.wholesalePrice;
      }
      return item.price;
  };

  const calculateTotal = () => {
    return cart.reduce((acc, item) => {
        const price = getEffectivePrice(item);
        return acc + (price * item.qty);
    }, 0);
  };

  const calculatePurchaseTotal = () => {
    return purchaseItems.reduce((sum, item) => {
      const gross = item.purchasePrice * item.qty;
      const discount = item.billDiscountType === '%' ? (gross * item.billDiscount) / 100 : item.billDiscount;
      const taxable = Math.max(gross - discount, 0);
      const gstAmount = item.includingGST ? 0 : (taxable * item.gstPercent) / 100;
      return sum + taxable + gstAmount;
    }, 0);
  };

  const handleAttachBill = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBillAttachment(reader.result as string);
        showToast('Bill attached successfully', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const calculatePurchaseBreakdown = () => {
    const gross = purchaseItems.reduce((sum, item) => sum + item.purchasePrice * item.qty, 0);
    const discount = purchaseItems.reduce((sum, item) => {
      const lineGross = item.purchasePrice * item.qty;
      return sum + (item.billDiscountType === '%' ? (lineGross * item.billDiscount) / 100 : item.billDiscount);
    }, 0);
    const tax = purchaseItems.reduce((sum, item) => {
      const lineGross = item.purchasePrice * item.qty;
      const lineDiscount = item.billDiscountType === '%' ? (lineGross * item.billDiscount) / 100 : item.billDiscount;
      const taxable = Math.max(lineGross - lineDiscount, 0);
      return sum + (item.includingGST ? 0 : (taxable * item.gstPercent) / 100);
    }, 0);
    const preRounded = gross - discount + tax;
    const net = Math.round(preRounded);
    const roundOff = Number((net - preRounded).toFixed(2));
    return {
      grossAmount: Number(gross.toFixed(2)),
      discountAmount: Number(discount.toFixed(2)),
      taxAmount: Number(tax.toFixed(2)),
      roundOff,
      netAmount: Number(net.toFixed(2)),
    };
  };

  const printPurchaseInvoice = (entry: PurchaseEntryRecord) => {
    const printWindow = window.open('', '_blank', 'width=980,height=760');
    if (!printWindow) {
      showToast('Please allow popups to print invoice.', 'error');
      return;
    }

    const billNoPrefix = entry.type === 'quotation' ? 'QTN' : 'BILL';
    const billNo = `${billNoPrefix}/${new Date(entry.createdAt).getFullYear()}/${entry.id.slice(-5)}`;
    const supplierName = entry.supplier?.name || 'Walk-in Supplier';
    const supplierAddress = entry.supplier?.address || '-';
    const supplierPhone = entry.supplier?.phone || '-';
    const supplierGst = entry.supplier?.gstNumber || '-';
    const taxable = (entry.totals.grossAmount - entry.totals.discountAmount).toFixed(2);
    const cgst = (entry.totals.taxAmount / 2).toFixed(2);
    const sgst = (entry.totals.taxAmount / 2).toFixed(2);

    const rows = entry.items.map((item, idx) => {
      const gross = item.purchasePrice * item.qty;
      const discount = item.billDiscountType === '%' ? (gross * item.billDiscount) / 100 : item.billDiscount;
      const taxableLine = Math.max(gross - discount, 0);
      const lineTax = item.includingGST ? 0 : (taxableLine * item.gstPercent) / 100;
      const lineNet = taxableLine + lineTax;
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${item.productName}</td>
          <td>${item.hsn || '-'}</td>
          <td>${item.mrp.toFixed(2)}</td>
          <td>${item.qty.toFixed(2)}</td>
          <td>${item.purchasePrice.toFixed(2)}</td>
          <td>${item.billDiscount.toFixed(2)}${item.billDiscountType}</td>
          <td>${(item.gstPercent / 2).toFixed(2)}</td>
          <td>${(item.gstPercent / 2).toFixed(2)}</td>
          <td>${lineNet.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <html>
        <head>
          <title>${entry.type === 'quotation' ? 'Quotation' : 'Retail Invoice'} - ${billNo}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 22px; color: #111; }
            h1, h2, h3, p { margin: 0; }
            .top { text-align: center; margin-bottom: 10px; }
            .top h1 { font-size: 34px; letter-spacing: 1px; }
            .top p { font-size: 18px; margin-top: 3px; }
            .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 12px 0; font-size: 16px; }
            .meta .box { border: 1px solid #d9d9d9; padding: 10px; min-height: 90px; }
            .meta .line { display: flex; justify-content: space-between; margin: 2px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #d9d9d9; padding: 7px 6px; font-size: 14px; text-align: left; }
            th { background: #f6f6f6; font-weight: 700; }
            td:last-child, th:last-child { text-align: right; }
            .summary-wrap { display: grid; grid-template-columns: 1fr 320px; gap: 16px; margin-top: 12px; }
            .gst-box, .totals-box { border: 1px solid #d9d9d9; padding: 8px; }
            .totals-row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 15px; }
            .net { font-size: 20px; font-weight: 800; margin-top: 6px; border-top: 1px dashed #999; padding-top: 6px; }
            .footer { margin-top: 18px; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="top">
            <h1 style="font-size: 28px; font-weight: 800; margin-bottom: 4px;">GEETA</h1>
            <p style="font-size: 14px; line-height: 1.4;">Q7WM+92M, Q7WM+92M, , Indore Division,<br>Nagda, Madhya Pradesh, India - 454001<br>7898111456<br>FSSAI: 583545736</p>
          </div>

          <div class="meta">
            <div class="box">
              <h3 style="margin-bottom:6px;">Supplier Details</h3>
              <div class="line"><span>Name</span><strong>${supplierName}</strong></div>
              <div class="line"><span>Address</span><span>${supplierAddress}</span></div>
              <div class="line"><span>Phone</span><span>${supplierPhone}</span></div>
              <div class="line"><span>GSTIN</span><span>${supplierGst}</span></div>
            </div>
            <div class="box">
              <h3 style="margin-bottom:6px;">${entry.type === 'quotation' ? 'Quotation' : 'Retail Invoice'}</h3>
              <div class="line"><span>Type</span><strong>${entry.type.toUpperCase()}</strong></div>
              <div class="line"><span>Bill No</span><span>${billNo}</span></div>
              <div class="line"><span>Date</span><span>${entry.date}</span></div>
              <div class="line"><span>Payment</span><span>${entry.paymentMode}</span></div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>S No</th>
                <th>Item Name</th>
                <th>HSN Code</th>
                <th>MRP</th>
                <th>Quantity</th>
                <th>Rate/P</th>
                <th>Disc</th>
                <th>CGST %</th>
                <th>SGST %</th>
                <th>Net Amt.</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div class="summary-wrap">
            <div class="gst-box">
              <h3 style="margin-bottom:6px;">GST Summary</h3>
              <table>
                <thead>
                  <tr><th>Type of Tax</th><th>%</th><th>Taxable</th><th>Tax Amount</th></tr>
                </thead>
                <tbody>
                  <tr><td>CGST</td><td>-</td><td>${taxable}</td><td>${cgst}</td></tr>
                  <tr><td>SGST</td><td>-</td><td>${taxable}</td><td>${sgst}</td></tr>
                </tbody>
              </table>
            </div>
            <div class="totals-box">
              <div class="totals-row"><span>Gross Amt.</span><strong>${entry.totals.grossAmount.toFixed(2)}</strong></div>
              <div class="totals-row"><span>Total Deduction</span><strong>${entry.totals.discountAmount.toFixed(2)}</strong></div>
              <div class="totals-row"><span>GST Amt.</span><strong>${entry.totals.taxAmount.toFixed(2)}</strong></div>
              <div class="totals-row"><span>Round Off</span><strong>${entry.totals.roundOff.toFixed(2)}</strong></div>
              <div class="totals-row net-total"><span>Total Amount</span><strong>${entry.totals.netAmount.toFixed(2)}</strong></div>
            </div>
          </div>

          <p>Amt in words: ${entry.totals.netAmount.toFixed(2)} only</p>
          <p>${entry.type === 'quotation' ? 'Quotation is valid for limited period.' : 'Payment must be paid within agreed days.'}</p>
          <p style="margin-top: 24px; text-align:right;">Authorised Signature</p>

          <script>
            setTimeout(function() { window.print(); }, 400);
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleSavePurchaseEntry = async () => {
    if (!purchaseSupplier) {
      showToast('Please add/select supplier first.', 'error');
      return;
    }
    if (purchaseItems.length === 0) {
      showToast('Please add at least one product.', 'error');
      return;
    }

    const totals = calculatePurchaseBreakdown();
    const entry: PurchaseEntryRecord = {
      id: editingQuotationId || `pur_${Date.now()}`,
      type: purchaseMode === 'Purchase' ? 'purchase' : 'quotation',
      supplier: purchaseSupplier,
      paymentMode: purchasePaymentMethod,
      date: purchaseDate,
      items: purchaseItems,
      totals,
      createdAt: new Date().toISOString(),
      billAttachment: billAttachment || undefined,
    };
    console.log('purchase_payload', entry);

    let nextEntries;
    if (editingQuotationId) {
       nextEntries = savedPurchaseEntries.map(e => e.id === editingQuotationId ? entry : e);
       setEditingQuotationId(null);
    } else {
       nextEntries = [entry, ...savedPurchaseEntries];
    }
    setSavedPurchaseEntries(nextEntries);
    localStorage.setItem('seller_pos_purchase_entries', JSON.stringify(nextEntries));
    localStorage.setItem('admin_pos_purchase_entries', JSON.stringify(nextEntries));
    try {
      await apiUpsertSellerPurchaseEntry(entry);
    } catch {
      // keep existing local behavior if API fails
    }

    if (purchaseMode === 'Purchase') {
      setPurchaseItems((prev) => prev.map((item) => ({ ...item, currentQty: item.currentQty + item.qty })));
      showToast('Purchase saved & inventory updated', 'success');
      printPurchaseInvoice(entry);
    } else {
      // Stock deduction logic if toggled
      if (reduceStockOnQuotation) {
        for (const item of purchaseItems) {
            try {
                const productId = item.baseProductId || item.productId;
                if (item.isVariant && item.variationId) {
                    const res = await getProductById(productId);
                    if (res.success && res.data) {
                        const product = res.data;
                        const updatedVariations = product.variations?.map((v: any) => {
                            if (v._id === item.variationId) {
                                return { ...v, stock: Math.max(0, (v.stock || 0) - item.qty) };
                            }
                            return v;
                        });
                        await updateProduct(productId, { variations: updatedVariations });
                    }
                } else {
                    const res = await getProductById(productId);
                    if (res.success && res.data) {
                        const product = res.data;
                        await updateProduct(productId, { stock: Math.max(0, (product.stock || 0) - item.qty) });
                    }
                }
            } catch (err) {
                console.error("Failed to deduct stock for quotation:", err);
            }
        }
      }

      const currentTotals = calculatePurchaseBreakdown();
      setLastBillDetails({
        total: currentTotals.netAmount,
        invoiceNum: entry.id.replace('pur_', '').toUpperCase(),
        date: new Date().toLocaleDateString('en-IN'),
        time: new Date().toLocaleTimeString('en-US', { hour12: true }),
        cart: entry.items.map(it => ({
          _id: it.id,
          productName: it.productName,
          price: it.retailPrice,
          qty: it.qty,
          isPurchaseItem: true,
          retailPrice: it.retailPrice,
          purchasePrice: it.purchasePrice
        } as any)),
        isPaid: false,
        isQuotation: true,
        quotationEntry: entry,
        paymentMethod: purchasePaymentMethod
      });
      setShowSuccessModal(true);
      showToast('Quotation saved successfully', 'success');
    }
  };

  const addProductToPurchase = (product: Product) => {
    setPurchaseItems((prev) => {
      const existing = prev.find((p) => p.productId === product._id);
      if (existing) {
        return prev.map((p) =>
          p.productId === product._id ? { ...p, qty: p.qty + 1 } : p
        );
      }
      const next: PurchaseItem = {
        id: `purchase_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
        productId: product._id,
        baseProductId: product._id,
        productName: product.productName,
        isVariant: false,
        image: product.mainImage,
        mrp: Number(product.compareAtPrice || product.price || 0),
        retailPrice: Number(product.price || 0),
        wholesalePrice: Number(product.wholesalePrice || 0),
        purchasePrice: Number(product.purchasePrice || product.price || 0),
        qty: 1,
        currentQty: Number(product.stock || 0),
        includingGST: true,
        billDiscount: 0,
        billDiscountType: '%',
        gstPercent: 18,
        barcode: Array.isArray(product.barcode) ? String(product.barcode[0] || '') : String(product.barcode || ''),
        mfgDate: '',
        expiry: '',
        hsn: '',
        batch: '',
        packOf: 1,
        additionalOpen: true,
      };
      return [next, ...prev];
    });
  };

  const updatePurchaseItem = (id: string, updates: Partial<PurchaseItem>) => {
    setPurchaseItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const removePurchaseItem = (id: string) => {
    setPurchaseItems((prev) => prev.filter((item) => item.id !== id));
  };

  const decreasePurchaseQtyByProductId = (productId: string) => {
    setPurchaseItems((prev) => {
      const match = prev.find((item) => item.productId === productId);
      if (!match) return prev;
      if (match.qty <= 1) {
        return prev.filter((item) => item.productId !== productId);
      }
      return prev.map((item) =>
        item.productId === productId ? { ...item, qty: item.qty - 1 } : item
      );
    });
  };

  const formatPurchaseDate = (value: string) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const generatePurchaseBarcode = () => {
    const timestampPart = Date.now().toString().slice(-8);
    const randomPart = Math.floor(1000 + Math.random() * 9000).toString();
    return `${timestampPart}${randomPart}`;
  };

  const handleAutoGeneratePurchaseBarcode = (itemId: string) => {
    const barcode = generatePurchaseBarcode();
    updatePurchaseItem(itemId, { barcode });
    showToast('Barcode generated successfully.', 'success');
  };

  const openVariantPicker = (item: PurchaseItem) => {
    setVariantPickerItem(item);
    setShowVariantPicker(true);
  };

  const addVariantToPurchase = (baseItem: PurchaseItem, variation: any) => {
    const variationId = String(variation?._id || variation?.id || variation?.variationId || variation?.title || variation?.name || Date.now());
    const variantLabel = String(variation?.title || variation?.name || variation?.variationName || 'Variant');
    const variantProductId = `${baseItem.baseProductId}-${variationId}`;

    setPurchaseItems((prev) => {
      const existing = prev.find((p) => p.productId === variantProductId);
      if (existing) {
        return prev.map((p) => (p.productId === variantProductId ? { ...p, qty: p.qty + 1 } : p));
      }

      const next: PurchaseItem = {
        id: `purchase_var_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
        productId: variantProductId,
        baseProductId: baseItem.baseProductId,
        productName: `${baseItem.productName} - ${variantLabel}`,
        isVariant: true,
        variationId,
        image: baseItem.image,
        mrp: Number(variation?.compareAtPrice ?? baseItem.mrp ?? 0),
        retailPrice: Number(variation?.price ?? baseItem.retailPrice ?? 0),
        wholesalePrice: Number(variation?.wholesalePrice ?? baseItem.wholesalePrice ?? 0),
        purchasePrice: Number(variation?.purchasePrice ?? baseItem.purchasePrice ?? 0),
        qty: 1,
        currentQty: Number(variation?.stock ?? 0),
        includingGST: true,
        billDiscount: 0,
        billDiscountType: '%',
        gstPercent: 18,
        barcode: Array.isArray(variation?.barcode) ? String(variation.barcode[0] || '') : String(variation?.barcode || ''),
        mfgDate: '',
        expiry: '',
        hsn: '',
        batch: '',
        packOf: 1,
        additionalOpen: true,
      };
      return [next, ...prev];
    });

    setShowVariantPicker(false);
    setVariantPickerItem(null);
    showToast('Variant added to purchase entry.', 'success');
  };

  const handlePrintPurchaseBarcode = (item: PurchaseItem) => {
    const value = (item.barcode || '').trim();
    if (!value) {
      showToast('Please add barcode number first.', 'error');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to print barcodes");
      return;
    }

    const savedSize = localStorage.getItem('barcode_print_size') || 'medium';
    const customSettingsRaw = localStorage.getItem('barcode_printer_settings');
    const customSettings = customSettingsRaw ? JSON.parse(customSettingsRaw) : null;

    let containerWidth = 250;
    let barcodeHeight = 55;
    let fontSize = 14;
    let productNameSize = 14;
    let showName = true;
    let showPrice = true;
    let isCustom = false;

    if (customSettings) {
      isCustom = true;
      barcodeHeight = customSettings.barcodeHeight;
      fontSize = customSettings.fontSize;
      productNameSize = customSettings.productNameSize;
      showName = customSettings.showName ?? true;
      showPrice = customSettings.showPrice ?? true;
    }

    if (!isCustom) {
      if (savedSize === 'small') {
        containerWidth = 200;
        barcodeHeight = 40;
        fontSize = 12;
        productNameSize = 12;
      } else if (savedSize === 'large') {
        containerWidth = 320;
        barcodeHeight = 75;
        fontSize = 16;
        productNameSize = 16;
      }
    }

    let styleContent = '';
    if (isCustom && customSettings) {
      styleContent = `
        @page {
          size: ${customSettings.width}mm ${customSettings.height}mm;
          margin: 0;
        }
        body {
          margin: 0;
          padding: 0;
          width: ${customSettings.width}mm;
        }
        .barcode-container {
          width: ${customSettings.width}mm;
          height: ${customSettings.height}mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          overflow: hidden;
          page-break-after: always;
          box-sizing: border-box;
          padding: 2px;
        }
      `;
    } else {
      styleContent = `
        body { font-family: 'Inter', sans-serif; padding: 20px; }
        .barcode-grid { display: flex; flex-wrap: wrap; gap: 20px; justify-content: flex-start; }
        .barcode-container {
          text-align: center;
          border: 1px solid #ccc;
          padding: 10px;
          page-break-inside: avoid;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: ${containerWidth}px;
          height: auto;
          background: white;
          box-sizing: border-box;
          border-radius: 8px;
        }
      `;
    }

    const safeName = item.productName.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeBarcode = value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const mrp = Number(item.mrp || 0);
    const sp = Number(item.retailPrice || 0);

    const htmlContent = `
      <html>
        <head>
          <title>Print Barcode</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
            body { font-family: 'Inter', sans-serif; }
            ${styleContent}
            .product-name {
              font-size: ${productNameSize}px;
              font-weight: 600;
              margin-bottom: 2px;
              color: #000;
              line-height: 1.1;
              text-transform: capitalize;
              max-width: 100%;
              word-wrap: break-word;
              display: ${showName ? 'block' : 'none'};
            }
            .price-row {
              display: ${showPrice ? 'flex' : 'none'};
              gap: 15px;
              margin-top: 4px;
              font-size: ${fontSize}px;
              font-weight: 800;
              color: #000;
              justify-content: center;
              align-items: center;
              white-space: nowrap;
            }
            svg.barcode {
              width: 100%;
              height: ${barcodeHeight}px;
              max-width: 100%;
              display: block;
            }
          </style>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        </head>
        <body>
          <div class="${isCustom ? '' : 'barcode-grid'}">
            <div class="barcode-container">
              <div class="product-name">${safeName}</div>
              <svg class="barcode"
                jsbarcode-format="CODE128"
                jsbarcode-value="${safeBarcode}"
                jsbarcode-width="2"
                jsbarcode-height="${barcodeHeight}"
                jsbarcode-textmargin="0"
                jsbarcode-fontoptions="bold"
                jsbarcode-displayValue="true"
                jsbarcode-fontSize="${fontSize}"
                jsbarcode-marginBottom="2"
                jsbarcode-marginTop="2">
              </svg>
              <div class="price-row">
                ${customSettings?.mrpLabel ? `<div class="price-item">${customSettings.mrpLabel}:${mrp}</div>` : mrp ? `<div class="price-item">MRP:${mrp}</div>` : ''}
                ${customSettings?.spLabel ? `<div class="price-item">${customSettings.spLabel}:${sp}</div>` : sp ? `<div class="price-item">SP:${sp}</div>` : ''}
              </div>
            </div>
          </div>
          <script>
            JsBarcode(".barcode").init();
            setTimeout(() => {
              window.print();
              window.close();
            }, 800);
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // --- Handlers ---
  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let productId = 'quick-' + Date.now();
    let finalProductData: any = null;

    if (quickForm.addToInventory) {
        setLoading(true);
        try {
            const res = await createProduct({
                productName: quickForm.name,
                barcode: quickForm.barcode ? [quickForm.barcode] : [],
                price: parseFloat(quickForm.price) || 0,
                compareAtPrice: parseFloat(quickForm.mrp) || 0,
                purchasePrice: parseFloat(quickForm.purchasePrice) || 0,
                wholesalePrice: parseFloat(quickForm.wholesalePrice) || 0,
                stock: parseInt(quickForm.qty) || 0,
                category: quickForm.categoryId,
                brand: quickForm.brandId,
                warrantyType: quickForm.warrantyType as "None" | "Warranty" | "Guarantee",
                warrantyDuration: quickForm.warrantyDuration,
                publish: true
            });

            if (res.success && res.data) {
                productId = res.data._id;
                finalProductData = res.data;
                showToast("Product created and added to cart", "success");
            } else {
                showToast(res.message || "Failed to create product in inventory", "error");
                setLoading(false);
                return;
            }
        } catch (err) {
            console.error(err);
            showToast("Error creating product", "error");
            setLoading(false);
            return;
        } finally {
            setLoading(false);
        }
    }

    // Quick Add creates a temporary mock product
    if (showPurchaseEntry) {
        const newItemPurchase: PurchaseItem = {
            id: productId,
            productId: finalProductData?._id || productId,
            baseProductId: finalProductData?._id || productId,
            productName: quickForm.name,
            isVariant: false,
            variationId: '',
            image: finalProductData?.mainImage || '',
            mrp: parseFloat(quickForm.mrp) || 0,
            retailPrice: parseFloat(quickForm.price) || 0,
            wholesalePrice: parseFloat(quickForm.wholesalePrice) || 0,
            purchasePrice: parseFloat(quickForm.purchasePrice) || parseFloat(quickForm.price) || 0,
            qty: parseInt(quickForm.qty) || 1,
            currentQty: finalProductData?.stock || 0,
            includingGST: true,
            billDiscount: 0,
            billDiscountType: '₹',
            gstPercent: finalProductData?.gstPercent || 0,
            barcode: quickForm.barcode || '',
            mfgDate: '',
            expiry: '',
            hsn: '',
            batch: '',
            packOf: 1,
            additionalOpen: false
        };
        setPurchaseItems(prev => [...prev, newItemPurchase]);
        showToast(`Added to ${purchaseMode}: ${quickForm.name}`, "success");
    } else {
        const newItem: any = finalProductData ? {
            ...finalProductData,
            qty: parseInt(quickForm.qty) || 1,
            originalProductId: finalProductData._id
        } : {
          _id: productId,
          productName: quickForm.name,
          price: parseFloat(quickForm.price) || 0,
          compareAtPrice: parseFloat(quickForm.mrp) || 0,
          wholesalePrice: parseFloat(quickForm.wholesalePrice) || 0,
          purchasePrice: parseFloat(quickForm.purchasePrice) || 0,
          qty: parseInt(quickForm.qty) || 1,
          warrantyType: quickForm.warrantyType,
          warrantyDuration: quickForm.warrantyDuration,
          mainImage: '', // Placeholder
          originalProductId: null,
          addToInventory: quickForm.addToInventory // Store flag
        };
        setCart(prev => [...prev, newItem]);
        showToast("Added to cart", "success");
    }

    setShowQuickAdd(false);
    setQuickForm({
        barcode: '',
        name: '', price: '', qty: '1', mrp: '',
        purchasePrice: '', wholesalePrice: '',
        categoryId: '', brandId: '', addToInventory: false,
        warrantyType: 'None',
        warrantyDuration: ''
    });
  };

  const openEditModal = (item: CartItem) => {
    setEditingItem(item);
    const currentPrice = item.customPrice !== undefined ? item.customPrice : item.price;
    setEditForm({
      name: item.productName,
      price: currentPrice.toString(),
      qty: item.qty.toString(),
      mrp: (item.compareAtPrice || 0).toString(),
      purchasePrice: (item.purchasePrice || 0).toString(),
      wholesalePrice: (item.wholesalePrice || 0).toString(),
      warrantyType: (item as any).warrantyType || 'None',
      warrantyDuration: (item as any).warrantyDuration || ''
    });
  };

  // Fetch fresh product details when editing an item
  useEffect(() => {
    const fetchProductDetails = async () => {
      // Ensure we have a valid item and it's not a temporary quick-add item (unless added to inventory)
      if (!editingItem || !editingItem.originalProductId) return;

      try {
        const res = await getProductById(editingItem.originalProductId);
        if (res.success && res.data) {
          const product = res.data;
          let mrp = product.compareAtPrice || 0;
          let purchasePrice = product.purchasePrice || 0;
          let wholesalePrice = product.wholesalePrice || 0;

          // If it's a variation, try to find the specific variation's details
          if (editingItem.isVariation && editingItem.variationId) {
             const variation = product.variations?.find((v: any) => v._id === editingItem.variationId) as any;
             if (variation) {
                 mrp = variation.compareAtPrice || mrp;
                 purchasePrice = variation.purchasePrice || purchasePrice;
                 wholesalePrice = variation.wholesalePrice || wholesalePrice;
             }
          }

          // Update the form with the fetched values
          setEditForm(prev => ({
              ...prev,
              mrp: (mrp || 0).toString(),
              purchasePrice: (purchasePrice || 0).toString(),
              wholesalePrice: (wholesalePrice || 0).toString(),
              warrantyType: product.warrantyType || 'None',
              warrantyDuration: product.warrantyDuration || ''
          }));
        }
      } catch (err) {
        console.error("Failed to fetch product details", err);
      }
    };

    fetchProductDetails();
  }, [editingItem]);

  const handleEditItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setCart(prev => prev.map(item => {
      if (item._id === editingItem._id) {
        const updatedItem = {
          ...item,
          productName: editForm.name,
          customPrice: parseFloat(editForm.price) || 0,
          compareAtPrice: parseFloat(editForm.mrp) || 0,
          purchasePrice: parseFloat(editForm.purchasePrice) || 0,
          wholesalePrice: parseFloat(editForm.wholesalePrice) || 0,
          qty: parseInt(editForm.qty) || 1,
          warrantyType: editForm.warrantyType,
          warrantyDuration: editForm.warrantyDuration,
          updateInventory: (document.getElementById('updateInventory') as HTMLInputElement)?.checked || false
        };

        // If updateInventory is checked and it's not a quick-add item, update the actual product
        if (updatedItem.updateInventory && !item._id.toString().startsWith('quick-')) {
            const productId = item.originalProductId || item._id;
            updateProduct(productId, {
                price: updatedItem.customPrice,
                compareAtPrice: updatedItem.compareAtPrice,
                purchasePrice: updatedItem.purchasePrice,
                wholesalePrice: updatedItem.wholesalePrice,
                warrantyType: updatedItem.warrantyType as "None" | "Warranty" | "Guarantee",
                warrantyDuration: updatedItem.warrantyDuration,
                // We don't update stock here as stock is handled during checkout,
                // but we update the display info.
            }).catch(console.error);
        }

        return updatedItem;
      }
      return item;
    }));
    setEditingItem(null);
  };

  const openPurchaseEditModal = (item: PurchaseItem) => {
    setEditingPurchaseItem(item);
    setPurchaseEditForm({
      name: item.productName,
      price: item.retailPrice.toString(),
      qty: item.qty.toString(),
      mrp: item.mrp.toString(),
      purchasePrice: item.purchasePrice.toString(),
      wholesalePrice: item.wholesalePrice.toString(),
      warrantyType: 'None',
      warrantyDuration: ''
    });
  };

  const handlePurchaseEditItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPurchaseItem) return;

    updatePurchaseItem(editingPurchaseItem.id, {
      productName: purchaseEditForm.name,
      retailPrice: parseFloat(purchaseEditForm.price) || 0,
      mrp: parseFloat(purchaseEditForm.mrp) || 0,
      purchasePrice: parseFloat(purchaseEditForm.purchasePrice) || 0,
      wholesalePrice: parseFloat(purchaseEditForm.wholesalePrice) || 0,
      qty: parseInt(purchaseEditForm.qty) || 1,
    });
    setEditingPurchaseItem(null);
  };

  /*
   * PDF Generation (Kept for 'Share' or background use)
   * Renamed from handleGenerateBill to downloadPDF
   */
   const downloadPDF = () => {
    if (lastBillDetails?.isQuotation && lastBillDetails.quotationEntry) {
      const entry = lastBillDetails.quotationEntry;
      const doc = new jsPDF();

      const billNoPrefix = entry.type === 'quotation' ? 'QTN' : 'BILL';
      const billNo = `${billNoPrefix}/${new Date(entry.createdAt).getFullYear()}/${entry.id.slice(-5)}`;
      const supplierName = entry.supplier?.name || 'Walk-in Supplier';
      const supplierAddress = entry.supplier?.address || '-';
      const supplierPhone = entry.supplier?.phone || '-';
      const supplierGst = entry.supplier?.gstNumber || '-';
      const taxable = (entry.totals.grossAmount - entry.totals.discountAmount).toFixed(2);
      const cgst = (entry.totals.taxAmount / 2).toFixed(2);
      const sgst = (entry.totals.taxAmount / 2).toFixed(2);
      const invoiceNum = lastBillDetails?.invoiceNum || entry.id.slice(-5);

      // --- Header (Image 4 Style) ---
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("GEETA", 14, 20);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Q7WM+92M, Q7WM+92M, , Indore Division,", 14, 26);
      doc.text("Nagda, Madhya Pradesh, India - 454001", 14, 31);
      doc.text("7898111456", 14, 36);
      doc.text("FSSAI: 583545736", 14, 41);

      // Meta Boxes (Image 3 Style)
      doc.setDrawColor(200, 200, 200);
      doc.rect(14, 48, 90, 35); // Supplier box
      doc.rect(106, 48, 90, 35); // Information box

      doc.setFont("helvetica", "bold");
      doc.text("Supplier Details", 18, 54);
      doc.text(entry.type === 'quotation' ? 'Quotation' : 'Retail Invoice', 110, 54);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      // Supplier info rows
      doc.text("Name", 18, 60); doc.text(supplierName, 55, 60);
      doc.text("Address", 18, 65); doc.text(supplierAddress, 55, 65);
      doc.text("Phone", 18, 70); doc.text(supplierPhone, 55, 70);
      doc.text("GSTIN", 18, 75); doc.text(supplierGst, 55, 75);

      // Invoice info rows
      doc.text("Type", 110, 60); doc.text(entry.type.toUpperCase(), 145, 60);
      doc.text("Bill No", 110, 65); doc.text(billNo, 145, 65);
      doc.text("Date", 110, 70); doc.text(entry.date, 145, 70);
      doc.text("Payment", 110, 75); doc.text(entry.paymentMode, 145, 75);

      // Main Table
      const tableData = entry.items.map((item, idx) => {
        const gross = item.purchasePrice * item.qty;
        const discount = item.billDiscountType === '%' ? (gross * item.billDiscount) / 100 : item.billDiscount;
        const taxableLine = Math.max(gross - discount, 0);
        const lineTax = item.includingGST ? 0 : (taxableLine * item.gstPercent) / 100;
        const lineNet = taxableLine + lineTax;
        return [
          idx + 1,
          item.productName,
          item.hsn || '-',
          item.mrp.toFixed(2),
          item.qty.toFixed(2),
          item.purchasePrice.toFixed(2),
          `${item.billDiscount.toFixed(2)}${item.billDiscountType}`,
          (item.gstPercent / 2).toFixed(2),
          (item.gstPercent / 2).toFixed(2),
          lineNet.toFixed(2)
        ];
      });

      autoTable(doc, {
        head: [['S No', 'Item Name', 'HSN Code', 'MRP', 'Quantity', 'Rate/P', 'Disc', 'CGST %', 'SGST %', 'Net Amt.']],
        body: tableData,
        startY: 88,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1 },
        bodyStyles: { lineWidth: 0.1, textColor: [50, 50, 50] }
      });

      let finalY = (doc as any).lastAutoTable.finalY + 10;
      if (finalY > 230) { doc.addPage(); finalY = 20; }

      // GST Summary & Totals sections
      doc.rect(14, finalY, 100, 32);
      doc.rect(116, finalY, 80, 40);

      doc.setFont("helvetica", "bold");
      doc.text("GST Summary", 18, finalY + 6);

      autoTable(doc, {
        head: [['Type of Tax', '%', 'Taxable', 'Tax Amount']],
        body: [
          ['CGST', '-', taxable, cgst],
          ['SGST', '-', taxable, sgst]
        ],
        startY: finalY + 8,
        margin: { left: 16 },
        tableWidth: 92,
        styles: { fontSize: 7, cellPadding: 1 },
        headStyles: { fillColor: [250, 250, 250], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1 },
        bodyStyles: { lineWidth: 0.1 }
      });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Gross Amt.", 118, finalY + 6); doc.text(entry.totals.grossAmount.toFixed(2), 194, finalY + 6, { align: 'right' });
      doc.text("Total Deduction", 118, finalY + 12); doc.text(entry.totals.discountAmount.toFixed(2), 194, finalY + 12, { align: 'right' });
      doc.text("GST Amt.", 118, finalY + 18); doc.text(entry.totals.taxAmount.toFixed(2), 194, finalY + 18, { align: 'right' });
      doc.text("Round Off", 118, finalY + 24); doc.text(entry.totals.roundOff.toFixed(2), 194, finalY + 24, { align: 'right' });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.line(116, finalY + 28, 196, finalY + 28);
      doc.text("Total Amount", 118, finalY + 34); doc.text(entry.totals.netAmount.toFixed(2), 194, finalY + 34, { align: 'right' });

      finalY += 48;
      if (finalY > 270) { doc.addPage(); finalY = 20; }

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Amt in words: ${entry.totals.netAmount.toFixed(2)} only`, 14, finalY);
      doc.text(entry.type === 'quotation' ? 'Quotation is valid for limited period.' : 'Payment must be paid within agreed days.', 14, finalY + 5);

      doc.setFont("helvetica", "bold");
      doc.text("Authorised Signature", 196, finalY + 15, { align: 'right' });

      doc.save(`${entry.type === 'quotation' ? 'Quotation' : 'Invoice'}_${invoiceNum}.pdf`);
      return;
    }

    const dataToUse = cart.length > 0 ? cart : (lastBillDetails?.cart || []);
    if (dataToUse.length === 0) return;

    const doc = new jsPDF();
    const invoiceNum = lastBillDetails?.invoiceNum || Math.floor(10000 + Math.random() * 90000).toString();
    const dateStr = lastBillDetails?.date || new Date().toLocaleDateString();
    const timeStr = lastBillDetails?.time || new Date().toLocaleTimeString();

    // --- Header ---
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("GEETA", 14, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    let address = "Q7WM+92M, Q7WM+92M, , Indore Division,\nNagda, Madhya Pradesh, India - 454001\n7898111456";
    if (config?.invoiceSettings?.gst?.enabled && config?.invoiceSettings?.gst?.text) {
        address += `\nGST: ${config.invoiceSettings.gst.text}`;
    }
    if (config?.invoiceSettings?.fssai?.enabled && config?.invoiceSettings?.fssai?.text) {
        address += `\nFSSAI: ${config.invoiceSettings.fssai.text}`;
    }
    doc.text(address, 14, 26);

    // Dynamic Y positioning based on address lines
    const addressLines = address.split('\n').length;
    // Base Y (26) + (lines * 5mm spacing)
    let currentY = 26 + (addressLines * 5) + 2;

    doc.line(14, currentY, 196, currentY);
    currentY += 8;

    // --- Invoice Details ---
    doc.setFont("helvetica", "bold");
    doc.text(lastBillDetails?.isQuotation ? "Quotation Number:" : "Invoice Number:", 14, currentY);
    doc.text(lastBillDetails?.isQuotation ? "Quotation Date:" : "Invoice Date:", 14, currentY + 5);
    doc.text("Status:", 14, currentY + 10);

    doc.setFont("helvetica", "normal");
    doc.text(invoiceNum, 196, currentY, { align: 'right' });
    doc.text(`${dateStr} ${timeStr}`, 196, currentY + 5, { align: 'right' });
    doc.text(lastBillDetails?.isQuotation ? 'QUOTATION' : (lastBillDetails?.isPaid ? 'PAID' : 'PENDING'), 196, currentY + 10, { align: 'right' });

    currentY += 15;
    doc.setLineWidth(0.5);
    doc.line(14, currentY, 196, currentY);
    currentY += 5;

    // --- Table Header ---
    doc.setFont("helvetica", "bold");
    doc.text("Estimated Bill", 105, currentY, { align: 'center' });

    let y = currentY + 6;
    doc.setFontSize(10);
    doc.text("Item-name", 14, y);
    doc.text("Qty", 100, y);
    doc.text("MRP", 125, y);
    doc.text("Sp.", 155, y);
    doc.text("Total", 196, y, { align: 'right' });
    y += 4;

    // --- Table Body ---
    doc.setFont("helvetica", "normal");
    let totalQty = 0;
    let totalMRP = 0;
    let totalBillAmount = 0;

    dataToUse.forEach((item, index) => {
        const qty = item.qty;
        const sp = item.customPrice !== undefined ? item.customPrice : item.price;
        const itemMrp = item.compareAtPrice && item.compareAtPrice > sp ? item.compareAtPrice : sp;
        const rowTotal = sp * qty;
        const rowMrpTotal = itemMrp * qty;

        totalQty += qty;
        totalMRP += rowMrpTotal;
        totalBillAmount += rowTotal;

        y += 6;
        if (y > 280) { doc.addPage(); y = 20; }

        const name = `(${index + 1}) ${item.productName}`;
        const truncatedName = name.length > 40 ? name.substring(0, 37) + "..." : name;

        doc.text(truncatedName, 14, y);
        if ((item as any).warrantyType && (item as any).warrantyType !== 'None') {
            y += 4;
            const text = `${(item as any).warrantyType}: ${(item as any).warrantyDuration}`;
            const oldFontSize = doc.getFontSize();
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "bold");

            // Draw a light background highlight
            const textWidth = doc.getTextWidth(text);
            doc.setFillColor(248, 248, 248);
            doc.rect(17, y - 3, textWidth + 2, 4, 'F');
            doc.setDrawColor(200, 200, 200);
            doc.line(17, y - 3, 17, y + 1); // Small left accent line

            doc.text(text, 18, y);
            doc.setFontSize(oldFontSize);
            doc.setFont("helvetica", "normal");
        }
        doc.text(qty.toString(), 100, y);
        doc.text(itemMrp.toString(), 125, y);
        doc.text(sp.toString(), 155, y);
        doc.text(rowTotal.toString(), 196, y, { align: 'right' });
    });

    y += 8;
    doc.line(14, y, 196, y);
    y += 6;

    // --- Summary ---
    doc.setFont("helvetica", "normal");
    doc.text(`Total Qty.: ${totalQty}`, 14, y);
    doc.text(`Total MRP: Rs ${totalMRP}`, 196, y, { align: 'right' });
    y += 4;

    const savings = totalMRP - totalBillAmount;
    if (savings > 0) {
        doc.setFillColor(200, 200, 200);
        doc.rect(14, y, 182, 8, 'F');
        const savingPercent = ((savings / totalMRP) * 100).toFixed(1);
        doc.setFont("helvetica", "bold");
        doc.text(`You Saved ${savingPercent} %`, 16, y + 5.5);
        doc.text(savings.toString(), 194, y + 5.5, { align: 'right' });
    }

    y += 12;
    doc.setLineWidth(0.3);
    doc.line(14, y, 196, y);
    y += 6;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Total bill amount:", 14, y);
    doc.text(totalBillAmount.toString(), 196, y, { align: 'right' });
    y += 2;
    doc.line(14, y + 2, 196, y + 2);

    // --- Notes & Terms (from Admin Settings) ---
    // Access config from closure (we need to make sure config is available in scope)
    // Note: Since downloadPDF is inside the component, we can use 'config' from component scope (if we destructure it).

    // We need to fetch config inside AdminPOSOrders component first.
    // Assuming config is available as 'config' variable.

    y += 10;
    if (config?.invoiceSettings) {
        // Notes
        if (config.invoiceSettings.notes?.enabled && config.invoiceSettings.notes?.text) {
             if (y > 270) { doc.addPage(); y = 20; }
             doc.setFontSize(10);
             doc.setFont("helvetica", "bold");
             doc.text("Note:", 14, y);
             y += 5;
             doc.setFont("helvetica", "normal");
             doc.setFontSize(9);
             const splitNotes = doc.splitTextToSize(config.invoiceSettings.notes.text, 180);
             doc.text(splitNotes, 14, y);
             y += (splitNotes.length * 4) + 8;
        }

        // Terms
        if (config.invoiceSettings.terms?.enabled && config.invoiceSettings.terms?.text) {
             if (y > 270) { doc.addPage(); y = 20; }
             doc.setFontSize(10);
             doc.setFont("helvetica", "bold");
             doc.text("Terms and Conditions:", 14, y);
             y += 5;
             doc.setFont("helvetica", "normal");
             doc.setFontSize(8);
             const splitTerms = doc.splitTextToSize(config.invoiceSettings.terms.text, 180);
             doc.text(splitTerms, 14, y);
        }
    }

    doc.save(`Invoice_${invoiceNum}.pdf`);
  };

  const handleGenerateBill = async () => {
    if (cart.length === 0) {
        showToast("Cart is empty", "error");
        return;
    }

    const currentTotal = calculateTotal();
    const currentCart = [...cart]; // Snapshot of cart
    let isPaid = false;

    if (paymentMethod === 'Cash') {
       const success = await performCashCheckout();
       if (!success) return;
       isPaid = true;
    }

    // Set bill details for display and printing
    setLastBillDetails({
        total: currentTotal,
        invoiceNum: Math.floor(10000 + Math.random() * 90000).toString(),
        date: new Date().toLocaleDateString('en-IN'),
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        cart: currentCart,
        isPaid: isPaid,
        paymentMethod: paymentMethod
    });

    setShowModalBreakdown(false);
    setShowSuccessModal(true);
  };

  const handlePrintBill = () => {
     window.print();
  };

  const handleAccessPayment = () => {
    if (cart.length === 0) {
        showToast("Cart is empty", "error");
        return;
    }

    // Customer check removed to allow guest checkout
    setShowPaymentModal(true);
  };

  const loadScript = (src: string) => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePaymentSelection = async (method: string) => {
    setShowPaymentModal(false);

    if (method === 'Cash') {
       await performCashCheckout();
       return;
    }

    if (method === 'Credit') {
        performCreditCheckout();
        return;
    }

    setLoading(true);
    try {
        const orderData = {
            customerId: selectedCustomer ? selectedCustomer._id : "walk-in-customer",
            items: cart.map(item => ({
                productId: item.originalProductId || item._id, // Send PARENT ID if available
                name: item.productName,
                quantity: item.qty,
                price: getEffectivePrice(item),
                variationId: item.variationId
            })),
            gateway: method,
            createdBy: activeStaffSession?.id,
            staffName: activeStaffSession?.name
        };

        const response = await initiatePOSOnlineOrder(orderData);

        if (response.success) {
            const { gateway, orderId, amount, key, razorpayOrderId, paymentSessionId, isSandbox } = response.data;

            if (gateway === 'Razorpay') {
                const res = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
                if (!res) {
                    showToast("Razorpay SDK failed to load", "error");
                    setLoading(false);
                    return;
                }

                const options = {
                    key: key,
                    amount: Math.round(amount * 100),
                    currency: "INR",
                    name: "Geeta Stores",
                    description: "POS Payment",
                    order_id: razorpayOrderId,
                    handler: async function (response: any) {
                        await handleVerifyPayment(orderId, response.razorpay_payment_id);
                    },
                    prefill: {
                        name: selectedCustomer?.name || "Walk-in Customer",
                        contact: selectedCustomer?.phone || undefined,
                        email: selectedCustomer?.email || undefined
                    },
                    theme: {
                        color: "#3399cc"
                    }
                };
                const rzp1 = new (window as any).Razorpay(options);
                rzp1.open();
                setLoading(false); // Modal is open, we can stop spinner
            } else if (gateway === 'Cashfree') {
                const res = await loadScript("https://sdk.cashfree.com/js/v3/cashfree.js");
                if (!res) {
                    showToast("Cashfree SDK failed to load", "error");
                    setLoading(false);
                    return;
                }
                const cashfree = new (window as any).Cashfree({
                    mode: isSandbox ? "sandbox" : "production"
                });
                cashfree.checkout({
                    paymentSessionId: paymentSessionId,
                    redirectTarget: "_modal",
                }).then((result: any) => {
                     // Optimistic verification or rely on backend webhook.
                     // For POS, we'll try to verify if we get a cue, but Cashfree JS promise resolves on close/completion.
                     // We'll Trigger verify
                     handleVerifyPayment(orderId, "CF_References_Checked_Backend");
                });
                setLoading(false);
            }
        } else {
             showToast(response.message || "Failed to initiate payment", "error");
             setLoading(false);
        }
    } catch (error) {
        console.error("Payment Init Error", error);
        showToast("Error initiating payment", "error");
        setLoading(false);
    }
  };

  const handleVerifyPayment = async (orderId: string, paymentId: string) => {
      setLoading(true);
      try {
          const response = await verifyPOSPayment({ orderId, paymentId, status: 'success' });
          if (response.success) {
              if (activeStaffSession) {
                appendPOSStaffBill('seller', {
                  billNumber: response?.data?.orderNumber || `POS-${Date.now()}`,
                  orderId: response?.data?._id || response?.data?.id || orderId,
                  createdBy: activeStaffSession.id,
                  staffName: activeStaffSession.name,
                  paymentMode: 'Online',
                  totalAmount: calculateTotal(),
                  numberOfProducts: cart.reduce((sum, item) => sum + (item.qty || 0), 0),
                  createdAt: new Date().toISOString(),
                  items: cart.map((item) => ({
                    productName: item.productName,
                    qty: item.qty,
                    price: getEffectivePrice(item),
                  })),
                });
              }
              showToast("Payment Successful & Order Placed!", "success");
              setCart([]);
          } else {
              showToast("Payment Verification Failed", "error");
          }
      } catch (error) {
          console.error("Verify Error", error);
          showToast("Error verifying payment", "error");
      } finally {
          setLoading(false);
      }
  };

  const performCashCheckout = async (): Promise<boolean> => {
    setLoading(true);
    try {
        const orderData = {
            customerId: selectedCustomer ? selectedCustomer._id : "walk-in-customer",
            items: cart.map(item => ({
                productId: item.originalProductId || item._id, // Use valid ID or custom
                name: item.productName,
                quantity: item.qty,
                price: getEffectivePrice(item),
                variationId: item.variationId
            })),
            paymentMethod: 'Cash',
            paymentStatus: "Paid" as const,
            createdBy: activeStaffSession?.id,
            staffName: activeStaffSession?.name
        };

        const response = await createPOSOrder(orderData);
        if (response.success) {
            if (activeStaffSession) {
              appendPOSStaffBill('seller', {
                billNumber: response?.data?.orderNumber || `POS-${Date.now()}`,
                orderId: response?.data?._id || response?.data?.id,
                createdBy: activeStaffSession.id,
                staffName: activeStaffSession.name,
                paymentMode: 'Cash',
                totalAmount: calculateTotal(),
                numberOfProducts: cart.reduce((sum, item) => sum + (item.qty || 0), 0),
                createdAt: new Date().toISOString(),
                items: cart.map((item) => ({
                  productName: item.productName,
                  qty: item.qty,
                  price: getEffectivePrice(item),
                })),
              });
            }
            showToast("Order placed successfully!", "success");
            setCart([]);
            return true;
        } else {
            showToast("Failed to place order", "error");
            return false;
        }
    } catch (error) {
        console.error("Order error:", error);
        showToast("Error processing order", "error");
        return false;
    } finally {
        setLoading(false);
    }
  };

  const performCreditCheckout = async () => {
      if (!selectedCustomer) {
          showToast("Customer selection is mandatory for Credit orders", "error");
          return;
      }

      setLoading(true);
      try {
           const orderData = {
                customerId: selectedCustomer._id,
                items: cart.map(item => ({
                    productId: item.originalProductId || item._id, // Use valid ID
                    name: item.productName,
                    quantity: item.qty,
                    price: getEffectivePrice(item),
                    variationId: item.variationId
                })),
                paymentMethod: 'Credit',
                paymentStatus: "Pending" as const,
                createdBy: activeStaffSession?.id,
                staffName: activeStaffSession?.name
            };

            const response = await createPOSOrder(orderData);

            if (response.success) {
                if (activeStaffSession) {
                  appendPOSStaffBill('seller', {
                    billNumber: response?.data?.orderNumber || `POS-${Date.now()}`,
                    orderId: response?.data?._id || response?.data?.id,
                    createdBy: activeStaffSession.id,
                    staffName: activeStaffSession.name,
                    paymentMode: 'Credit',
                    totalAmount: calculateTotal(),
                    numberOfProducts: cart.reduce((sum, item) => sum + (item.qty || 0), 0),
                    createdAt: new Date().toISOString(),
                    items: cart.map((item) => ({
                      productName: item.productName,
                      qty: item.qty,
                      price: getEffectivePrice(item),
                    })),
                  });
                }
                showToast(`Credit Order Placed! Balance updated for ${selectedCustomer.name}`, "success");
                setCart([]);
                // Navigate to REAL customer credit page
                navigate(`/seller/pos/customers/${selectedCustomer._id}`);
            } else {
                showToast(response.message || "Failed to create credit order", "error");
            }

      } catch (error) {
          console.error(error);
          showToast("Error processing credit order", "error");
      } finally {
          setLoading(false);
      }
  };

  const handleUpdateOrder = async () => {
      if (!editOrderId) return;
      setLoading(true);
      try {
          const items = cart.map(item => ({
              productId: (item.originalProductId || item._id)?.match?.(/^[a-f\d]{24}$/i) ? (item.originalProductId || item._id) : undefined,
              variationId: item.variationId,
              quantity: item.qty,
              unitPrice: getEffectivePrice(item),
              sku: item.sku,
              productName: item.productName,
              productImage: item.mainImage || (item as any).image || ''
          }));

          const res = await updateOrderItems(editOrderId, items);
          if (res.success) {
              showToast("Order updated successfully", "success");

              // Set bill details for the success modal so user can print/share
              setLastBillDetails({
                  total: calculateTotal(),
                  invoiceNum: res.data?.orderNumber || `UPD-${editOrderId}`,
                  date: new Date().toLocaleDateString('en-IN'),
                  time: new Date().toLocaleTimeString('en-US', { hour12: false }),
                  cart: [...cart],
                  isPaid: res.data?.paymentStatus === 'Paid' || true // Updates usually imply paid or credit handled
              });

              setShowSuccessModal(true);

              // Close the edit tab logic
              closeBill(`edit_${editOrderId}`, { stopPropagation: () => {} } as React.MouseEvent);
          } else {
              showToast(res.message || "Failed to update order", "error");
          }
      } catch (e: any) {
          console.error(e);
          showToast(`Error updating order: ${e.response?.data?.message || e.message}`, "error");
      } finally {
          setLoading(false);
      }
  };

  // Sync addToCart ref for scanner
  useEffect(() => {
      addToCartRef.current = addToCart;
  }, [addToCart]);

  return (
      <div className="bg-gray-50 h-full w-full flex flex-col font-sans overflow-hidden md:min-h-screen md:h-auto md:block md:overflow-visible md:px-4 md:pb-2 md:pt-0">
        {/* Header / Breadcrumb */}
          <div className="flex-none flex justify-between items-center px-3 pt-1 pb-1 md:hidden">
          <div className="hidden">
             <h1 className="text-sm md:text-base font-bold text-gray-800">POS System</h1>
             <div className="text-[10px] md:text-[11px] text-gray-500">
              <span className="text-blue-600">Dashboard</span> / POS
             </div>
          </div>

        <div className="flex items-center gap-1.5 md:hidden flex-nowrap overflow-x-auto no-scrollbar">
            <button
              onClick={() => setShowAddCustomerModal(true)}
              className="px-2.5 py-1.5 bg-[#f187b5] text-white rounded-lg text-[11px] font-bold hover:bg-[#e076a5] transition-colors flex items-center gap-1 border border-[#f187b5] shrink-0"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Add Cust.
            </button>

            <button
              onClick={() => navigate('/seller/pos/customers')}
              className="px-2.5 py-1.5 bg-[#f187b5] text-white border border-[#f187b5] rounded-lg text-[11px] font-bold hover:bg-[#e076a5] transition-colors flex items-center gap-1 shrink-0"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Credit
            </button>
            <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg border border-gray-200 shrink-0">
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Profit</span>
                <button
                  onClick={() => setShowProfit(!showProfit)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${showProfit ? 'bg-[#f187b5]' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${showProfit ? 'translate-x-4.5' : 'translate-x-1'}`} />
                </button>
            </div>
            <button
              onClick={() => setShowPurchaseSheet(true)}
              className="px-2.5 py-1.5 bg-white border border-[#f187b5]/40 text-[#cf6594] rounded-lg text-[11px] font-bold hover:bg-[#fce8f1] transition-colors flex items-center gap-1 shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1 5h12M9 21a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z" />
              </svg>
              Purchase
            </button>
        </div>
      </div>


      <div className="flex-1 flex flex-col min-h-0 w-full md:max-w-6xl md:mx-auto md:pb-8 md:h-auto md:block md:overflow-visible">
        <div className="bg-white flex flex-col flex-1 h-full min-h-0 w-full relative transition-all duration-300 md:rounded-2xl md:shadow-xl md:border md:border-gray-200 md:min-h-[85vh] md:h-auto md:overflow-visible">

          {/* Top Header Section */}
          <div className="flex-none px-3 py-1.5 md:px-6 md:py-2 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center bg-white md:rounded-t-2xl gap-2 md:gap-4">
             <div className="flex items-center gap-2.5 md:gap-4">
                 <h2 className="hidden md:block text-base md:text-lg font-bold text-gray-800 tracking-tight">Billing & POS</h2>
                <div className="hidden md:flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg border border-gray-200">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Profit</span>
                    <button
                      onClick={() => setShowProfit(!showProfit)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${showProfit ? 'bg-[#f187b5]' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${showProfit ? 'translate-x-4.5' : 'translate-x-1'}`} />
                    </button>
                 </div>
                <button
                  onClick={() => setShowPurchaseSheet(true)}
                  className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#f187b5]/30 bg-[#f187b5]/10 text-[#cf6594] text-xs font-bold hover:bg-[#f187b5]/20 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1 5h12M9 21a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z" />
                  </svg>
                  Purchase/Returns
                </button>
             </div>

             <div className="hidden">
                 <button
                    onClick={() => setShowPurchaseSheet(true)}
                    className="flex-1 md:flex-none bg-white border border-[#f187b5]/40 text-[#cf6594] text-[11px] px-2.5 py-1.5 rounded-lg font-bold hover:bg-[#fce8f1] transition-all active:scale-95 flex items-center justify-center gap-1.5"
                 >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1 5h12M9 21a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z" />
                    </svg>
                    Purchase
                 </button>
                  <button
                     onClick={() => setShowQuickAdd(true)}
                     className="hidden"
                  >
                     <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                     Quick Add
                  </button>
             </div>
          </div>

          {/* Search Bar Section */}
          {/* Search Bar Section - Visible only on Desktop */}
          <div className="hidden lg:block px-6 py-2 bg-gray-50/50 border-b border-gray-100 relative z-30">
             <div ref={searchRef} className="relative max-w-4xl mx-auto">
                 <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                     <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                     </svg>
                 </div>
                 <input
                     type="text"
                     className="block w-full pl-11 pr-12 py-2 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f187b5] focus:border-[#f187b5] text-base transition-shadow shadow-sm"
                     placeholder="Search products by name, barcode, or SKU (SHIFT + S)"
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     onKeyDown={handleSearchKeyDown}
                     autoFocus
                 />
                 <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
                     {searchQuery && (
                         <button onClick={() => setSearchQuery('')} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                             <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                         </button>
                     )}
                     <button
                        onClick={() => setShowScanner(true)}
                        className="p-2.5 text-gray-500 hover:text-[#f187b5] rounded-xl hover:bg-[#f187b5]/10 transition-colors group"
                        title="Scan Barcode"
                     >
                        <svg className="w-6 h-6 transform group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5v2a2 2 0 002 2h2m10 0h2a2 2 0 002-2V5M3 19v-2a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m-6-13h-4m4 4h-4m4 4h-4m4 4h-4"/></svg>
                     </button>
                 </div>

                 {/* Search Dropdown Results */}
                 {searchQuery && (
                     <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-[60vh] overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2 duration-200 p-2 scrollbar-thin scrollbar-thumb-gray-200">
                        {loading ? (
                             <div className="py-12 text-center text-gray-500">
                                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f187b5] mx-auto mb-3"></div>
                                 <p className="text-sm font-medium">Searching inventory...</p>
                             </div>
                        ) : products.length > 0 ? (
                             <div className="flex flex-col gap-1">
                                 {products.map((product) => {
                                     const cartItem = cart.find(c => c._id === product._id);
                                     const qtyInCart = cartItem ? cartItem.qty : 0;
                                     return (
                                     <div
                                         key={product._id}
                                         onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              addToCart(product);
                                              // setSearchQuery(''); // Kept open for multiple selection
                                         }}
                                         className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-all border border-transparent hover:border-[#f187b5]/30 group"
                                     >
                                         <div className="w-14 h-14 bg-white rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-200 shadow-sm group-hover:shadow transition-shadow relative">
                                             {product.mainImage ? (
                                                 <img src={product.mainImage} alt="" className="w-full h-full object-cover" />
                                             ) : (
                                                 <span className="text-[10px] text-gray-400 font-bold">IMG</span>
                                             )}
                                             {qtyInCart > 0 && (
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                    <span className="text-white font-bold text-xs">x{qtyInCart}</span>
                                                </div>
                                             )}
                                         </div>
                                         <div className="flex-1 min-w-0">
                                             <div className="flex justify-between items-start mb-1">
                                                 <div className="flex items-center gap-2 pr-2">
                                                     <h4 className="text-sm font-bold text-gray-800 truncate group-hover:text-[#f187b5] transition-colors">{product.productName}</h4>
                                                     {qtyInCart > 0 && <span className="text-[10px] bg-[#f187b5] text-white px-1.5 py-0.5 rounded-full font-bold">In Cart</span>}
                                                 </div>
                                                 <div className="text-right flex-shrink-0">
                                                     <span className="block text-sm font-bold text-[#f187b5]">₹{orderType === 'Wholesale' && product.wholesalePrice ? product.wholesalePrice : product.price}</span>
                                                     {(product.compareAtPrice || 0) > (orderType === 'Wholesale' && product.wholesalePrice ? product.wholesalePrice : product.price) && (
                                                         <span className="block text-[10px] text-gray-400 line-through">₹{product.compareAtPrice}</span>
                                                     )}
                                                 </div>
                                             </div>
                                             <div className="flex justify-between items-center">
                                                 <div className="flex items-center gap-3 text-xs text-gray-500">
                                                     <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${product.stock > 0 ? 'bg-teal-50 text-teal-700 border border-teal-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                                         {product.stock > 0 ? `Stock: ${product.stock}` : 'Out of Stock'}
                                                     </span>
                                                     {product.sku && <span className="hidden sm:inline bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">SKU: {product.sku}</span>}
                                                     {orderType === 'Wholesale' && product.wholesalePrice && <span className="text-xs text-blue-600 font-medium">Wholesale</span>}
                                                 </div>
                                                 <button className="text-xs bg-[#f187b5] hover:bg-[#e076a5] text-white px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all font-bold shadow-sm transform translate-x-2 group-hover:translate-x-0">
                                                     Add +
                                                 </button>
                                             </div>
                                         </div>
                                     </div>
                                 )})}
                             </div>
                        ) : (
                             <div className="py-12 text-center">
                                 <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                                     <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                 </div>
                                 <p className="text-gray-600 font-medium">No products found</p>
                                 <p className="text-xs text-gray-400 mt-1">Try searching with a different name</p>
                             </div>
                        )}
                     </div>
                 )}
             </div>
          </div>

          {/* Bill Tabs */}

            <div className="flex-none flex items-center gap-2 px-2 pt-2 overflow-x-auto border-b border-gray-200 bg-gray-50">
              {bills.map(bill => (
                <div
                  key={bill.id}
                  onClick={() => setActiveBillId(bill.id)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-t-lg cursor-pointer border-t border-l border-r transition-all min-w-[100px] justify-between select-none text-xs font-medium
                    ${activeBillId === bill.id
                      ? 'bg-white border-b-transparent text-[#f187b5] relative -mb-[1px] z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.02)]'
                      : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200/50'}
                  `}
                >
                  <span className="truncate max-w-[80px]">{bill.name}</span>
                  <button
                    onClick={(e) => closeBill(bill.id, e)}
                    className="hover:bg-red-100 text-gray-400 hover:text-red-500 rounded-full p-0.5 transition-colors"
                    title="Close Bill"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
              ))}

              <button
                onClick={() => createNewBill()}
                className="flex items-center justify-center w-6 h-6 rounded-full bg-[#f187b5]/10 text-[#f187b5] hover:bg-[#f187b5]/20 transition-colors ml-1 flex-shrink-0"
                title="New Bill"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              </button>
            </div>

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden md:overflow-visible md:h-auto md:min-h-0">

              {/* Payment Method & Order Type Controls */}
              <div className="flex-none px-4 pt-2 pb-1 md:hidden">
                   {/* Payment Method + View Toggle (Mobile Row) */}
                   <div className="flex items-center gap-2 mb-2">
                       <div className="relative flex-[0_0_58%]">
                           <button
                               onClick={() => setShowPaymentDropdown(!showPaymentDropdown)}
                               className="w-full flex items-center justify-between bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#E91E63]"
                           >
                               <span className="font-medium truncate">{paymentMethod || 'Cash'}</span>
                               <svg className={`w-4 h-4 text-gray-400 transition-transform ${showPaymentDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                           </button>

                           {showPaymentDropdown && (
                               <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                                   {['Cash', 'Razorpay', 'Cashfree', 'Credit'].map((method) => (
                                       <div
                                           key={method}
                                           onClick={() => setPaymentMethod(method)}
                                           className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                                       >
                                           <span className="text-sm font-medium text-gray-700">{method === 'Credit' ? 'Credit (Udhaar)' : method}</span>
                                           <span className="text-gray-300">→</span>
                                       </div>
                                   ))}
                               </div>
                           )}
                       </div>

                       <div className="flex-1 flex justify-end">
                           <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
                               <button
                                 onClick={() => setMobileCartView('list')}
                                 className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                                   mobileCartView === 'list' ? 'bg-[#f187b5] text-white' : 'text-gray-600'
                                 }`}
                               >
                                 List
                               </button>
                               <button
                                 onClick={() => setMobileCartView('grid')}
                                 className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                                   mobileCartView === 'grid' ? 'bg-[#f187b5] text-white' : 'text-gray-600'
                                 }`}
                               >
                                 Grid
                               </button>
                           </div>
                       </div>
                   </div>

                   {/* Retail / Wholesale Toggle */}
                   <div className="bg-gray-100 p-1 rounded-lg flex relative">
                        {/* Sliding Background */}
                        <div
                            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#f187b5] rounded-md transition-all duration-300 ease-in-out shadow-sm ${orderType === 'Wholesale' ? 'left-[calc(50%+2px)]' : 'left-1'}`}
                        ></div>

                        <button
                            onClick={() => setOrderType('Retail')}
                            className={`flex-1 relative z-10 text-center text-xs font-medium py-1 transition-colors duration-300 ${orderType === 'Retail' ? 'text-white' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Retail
                        </button>
                        <button
                            onClick={() => setOrderType('Wholesale')}
                            className={`flex-1 relative z-10 text-center text-xs font-medium py-1 transition-colors duration-300 ${orderType === 'Wholesale' ? 'text-white' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Wholesale
                        </button>
                   </div>
              </div>

              {/* Customer Selection */}
              <div className="flex-none px-4 pb-2 border-b border-gray-100 md:hidden">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Search Customer / Mobile..."
                        className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#f187b5] bg-gray-50 focus:bg-white transition-colors"
                        value={customerSearch}
                        onChange={(e) => {
                            setCustomerSearch(e.target.value);
                            // Reset selection if user modifies the text
                            if (selectedCustomer) {
                                const expected = selectedCustomer.phone ? `${selectedCustomer.name} (${selectedCustomer.phone})` : selectedCustomer.name;
                                if (e.target.value !== expected) {
                                  setSelectedCustomer(null);
                                }
                            }
                        }}
                        onFocus={() => {
                            if (customerSearch.length >= 2) setShowCustomerDropdown(true);
                        }}
                        onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                      />
                      {selectedCustomer && (
                          <button onClick={clearCustomer} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500">
                              ✕
                          </button>
                      )}

                      {/* Search Results Dropdown */}
                      {showCustomerDropdown && customers.length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {customers.map(c => (
                                  <div
                                     key={c._id}
                                     onMouseDown={(e) => {
                                         e.preventDefault(); // Prevent input blur
                                         selectCustomer(c);
                                     }}
                                     onClick={() => selectCustomer(c)}
                                     className="p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                                   >
                                      <div className="font-medium text-sm text-gray-800">{c.name}</div>
                                      <div className="text-xs text-gray-500">{c.phone} | {c.email}</div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
                  <button
                    onClick={() => setShowAddCustomerModal(true)}
                    className="bg-[#f187b5] text-white px-2.5 rounded hover:bg-[#e076a5] transition-colors flex items-center justify-center shadow-sm active:scale-95 transform transition-transform"
                    title="Add New Customer"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                  </button>

                  <button
                    onClick={() => setShowScanner(true)}
                    className="bg-[#f187b5] text-white px-2.5 rounded hover:bg-[#e076a5] transition-colors flex items-center justify-center shadow-sm active:scale-95 transform transition-transform"
                    title="Scan Product"
                  >
                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5v2a2 2 0 002 2h2m10 0h2a2 2 0 002-2V5M3 19v-2a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m-6-13h-4m4 4h-4m4 4h-4m4 4h-4"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Cart Items */}
              <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative">
                  {/* Cart Items List Wrapper */}
                  <div className="flex-1 min-h-0 overflow-hidden w-full flex flex-col">
                      {/* Scrollable Product Container */}
                      <div className="flex-1 min-h-0 overflow-y-auto p-4 pb-40 md:p-0 md:pb-0 md:overflow-visible custom-pos-scroll">
                          <div className={mobileCartView === 'grid'
                              ? 'grid grid-cols-2 gap-2 md:flex md:flex-col'
                              : 'space-y-2 flex flex-col'
                          }>
                              {/* Desktop Header Row */}
                              <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-bold text-gray-400 pb-2 border-b border-gray-100 px-2 sticky top-0 bg-white z-10">
                                  <div className="col-span-1 text-center">Sr.no</div>
                                  <div className="col-span-1 text-center">Edit</div>
                                  <div className="col-span-1 text-center">Image</div>
                                  <div className="col-span-3">Name</div>
                                  <div className="col-span-1 text-center">MRP</div>
                                  <div className="col-span-2 text-center">Quantity</div>
                                  <div className="col-span-1 text-center">Retail Price</div>
                                  <div className="col-span-1 text-center">Sub Total</div>
                                  <div className="col-span-1 text-center">Delete</div>
                              </div>

                              {cart.length === 0 ? (
                                  <div className="flex-1 flex flex-col items-center justify-center text-gray-400 min-h-[200px]">
                                      <svg className="w-12 h-12 mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                      <span className="text-sm">Cart is empty</span>
                                  </div>
                              ) : (
                                  cart.map((item, index) => {
                                      const sp = getEffectivePrice(item);
                                      const mrp = item.compareAtPrice || sp;
                                      const purchasePrice = item.purchasePrice || 0;
                                      const profit = sp - purchasePrice;
                                      const profitPercent = purchasePrice > 0 ? ((profit / purchasePrice) * 100).toFixed(2) : '0.00';

                                      return (
                                      <React.Fragment key={index}>
                                          {/* --- MOBILE VIEW (Card Style) --- */}
                                          <div className={`${mobileCartView === 'list' ? 'block' : 'hidden'} md:hidden bg-white border border-gray-200 rounded-xl p-3 shadow-sm mb-3 relative overflow-hidden group shrink-0`}>
                                              {/* Top Row: Rank, Title, Price */}
                                              <div className="flex justify-between items-start mb-2">
                                                  <div className="flex items-start gap-2 max-w-[70%]">
                                                       <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">#{index + 1}</span>
                                                       <div>
                                                            <h4 className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2">{item.productName}</h4>
                                                            {(item as any).warrantyType && (item as any).warrantyType !== 'None' && (
                                                                <div className="text-[10px] text-[#f187b5] font-bold mt-0.5">
                                                                    {(item as any).warrantyType}: {(item as any).warrantyDuration}
                                                                </div>
                                                            )}
                                                        </div>
                                                  </div>
                                                  <div className="font-bold text-gray-900 text-base">₹{sp * item.qty}</div>
                                              </div>

                                              {/* Middle Row: Image & Pricing Details */}
                                              <div className="flex items-center gap-3 mb-3">
                                                  <div className="w-12 h-12 flex-shrink-0 bg-white rounded-lg border border-gray-100 flex items-center justify-center p-1 overflow-hidden">
                                                       {item.mainImage ? (
                                                           <img src={item.mainImage} alt="" className="w-full h-full object-contain" />
                                                       ) : (
                                                           <span className="text-xs text-gray-300">Img</span>
                                                       )}
                                                  </div>
                                                  <div className="flex flex-col text-xs">
                                                       <span className="text-gray-500 mb-0.5">MRP: <span className="line-through decoration-gray-400">₹{mrp}</span> <span className="font-bold text-[#f187b5] ml-1">SP: ₹{sp}</span></span>

                                                       {showProfit && (
                                                            <span className={`${parseFloat(profitPercent) >= 0 ? 'text-green-600' : 'text-red-500'} font-medium`}>
                                                                Profit: {profitPercent}%
                                                            </span>
                                                       )}
                                                  </div>
                                              </div>

                                              {/* Bottom Row: Actions & Quantity */}
                                              <div className="flex items-center justify-between">
                                                  <div className="flex items-center gap-2">
                                                      <button
                                                         onClick={() => removeFromCart(item._id)}
                                                         className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors border border-red-100"
                                                      >
                                                         <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                      </button>
                                                      <button
                                                         onClick={() => openEditModal(item)}
                                                         className="px-3 py-1.5 flex items-center gap-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                                                      >
                                                          <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                          Edit
                                                      </button>
                                                  </div>

                                                  {/* Quantity Control */}
                                                  <div className="flex items-center bg-gray-50 rounded-lg p-0.5 border border-gray-200">
                                                       <button
                                                         onClick={() => updateQuantity(item._id, -1)}
                                                         className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-white hover:shadow-sm rounded transition-all font-bold text-lg"
                                                       >−</button>
                                                       <div className="w-8 flex items-center justify-center text-sm font-bold text-gray-800">
                                                           {item.qty}
                                                       </div>
                                                       <button
                                                         onClick={() => updateQuantity(item._id, 1)}
                                                         className="w-7 h-7 flex items-center justify-center text-[#f187b5] hover:bg-white hover:shadow-sm rounded transition-all font-bold text-lg"
                                                       >+</button>
                                                  </div>
                                              </div>
                                          </div>

                                          {mobileCartView === 'grid' && (
                                              <div className="block md:hidden bg-white border border-gray-200 rounded-xl p-2 shadow-sm relative overflow-hidden">
                                                  <div className="flex items-start justify-between gap-2 mb-1.5">
                                                      <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0">#{index + 1}</span>
                                                      <div className="text-xs font-bold text-gray-900">₹{sp * item.qty}</div>
                                                  </div>

                                                  <div className="flex items-center gap-2 mb-2">
                                                      <div className="w-10 h-10 flex-shrink-0 bg-white rounded-lg border border-gray-100 flex items-center justify-center p-1 overflow-hidden">
                                                          {item.mainImage ? (
                                                              <img src={item.mainImage} alt="" className="w-full h-full object-contain" />
                                                          ) : (
                                                              <span className="text-[10px] text-gray-300">Img</span>
                                                          )}
                                                      </div>
                                                      <h4 className="text-xs font-semibold text-gray-800 leading-tight line-clamp-2">{item.productName}</h4>
                                                  </div>

                                                  <div className="flex items-center justify-between gap-1.5">
                                                      <button
                                                        onClick={() => removeFromCart(item._id)}
                                                        className="w-7 h-7 flex items-center justify-center bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors border border-red-100"
                                                      >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                      </button>
                                                      <div className="flex items-center bg-gray-50 rounded-lg p-0.5 border border-gray-200">
                                                          <button
                                                            onClick={() => updateQuantity(item._id, -1)}
                                                            className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-white hover:shadow-sm rounded transition-all font-bold text-base"
                                                          >−</button>
                                                          <div className="w-6 flex items-center justify-center text-xs font-bold text-gray-800">
                                                              {item.qty}
                                                          </div>
                                                          <button
                                                            onClick={() => updateQuantity(item._id, 1)}
                                                            className="w-6 h-6 flex items-center justify-center text-[#f187b5] hover:bg-white hover:shadow-sm rounded transition-all font-bold text-base"
                                                          >+</button>
                                                      </div>
                                                      <button
                                                        onClick={() => openEditModal(item)}
                                                        className="px-2 py-1 flex items-center gap-1 bg-white border border-gray-300 rounded-lg text-[11px] font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                                                      >
                                                        Edit
                                                      </button>
                                                  </div>
                                              </div>
                                          )}

                                          {/* --- DESKTOP VIEW (Table Row Style) --- */}
                                          <div className="hidden md:grid grid-cols-12 gap-2 items-center p-2 border-b border-gray-50 hover:bg-gray-50/80 transition-all even:bg-gray-50/20">
                                               {/* Sr No */}
                                               <div className="col-span-1 text-center text-gray-400 text-xs font-bold">
                                                   {index + 1}
                                               </div>

                                               {/* Edit Button */}
                                               <div className="col-span-1 text-center">
                                                   <button
                                                      onClick={() => openEditModal(item)}
                                                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex"
                                                   >
                                                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                   </button>
                                               </div>

                                               {/* Image */}
                                               <div className="col-span-1 flex justify-center">
                                                   <div className="w-10 h-10 bg-white rounded border border-gray-200 flex items-center justify-center p-0.5 overflow-hidden shadow-sm">
                                                       {item.mainImage ? (
                                                           <img src={item.mainImage} alt="" className="w-full h-full object-contain" />
                                                       ) : (
                                                           <span className="text-[8px] text-gray-300 font-bold">IMG</span>
                                                       )}
                                                   </div>
                                               </div>

                                               {/* Name */}
                                                <div className="col-span-3 min-w-0">
                                                    <h4 className="text-sm font-semibold text-gray-800 truncate" title={item.productName}>{item.productName}</h4>
                                                    {(item as any).warrantyType && (item as any).warrantyType !== 'None' && (
                                                        <div className="text-[10px] text-[#f187b5] font-bold mt-0.5">
                                                            {(item as any).warrantyType}: {(item as any).warrantyDuration}
                                                        </div>
                                                    )}
                                                   {showProfit && (
                                                       <span className={`text-[10px] ${parseFloat(profitPercent) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                           Profit: {profitPercent}%
                                                       </span>
                                                   )}
                                               </div>

                                               {/* MRP Input */}
                                               <div className="col-span-1">
                                                     <input
                                                         type="number"
                                                         value={mrp}
                                                         onChange={(e) => updateItemDetails(item._id, { compareAtPrice: parseFloat(e.target.value) || 0 })}
                                                         className="w-full text-center text-sm border border-transparent hover:border-gray-200 focus:border-[#f187b5] bg-transparent focus:bg-white rounded px-1 py-1 outline-none transition-all"
                                                     />
                                                </div>

                                               {/* Quantity */}
                                               <div className="col-span-2 flex justify-center">
                                                   <div className="flex items-center bg-white border border-gray-200 rounded h-7 w-20 shadow-sm">
                                                        <button
                                                          onClick={() => updateQuantity(item._id, -1)}
                                                          className="w-6 h-full flex items-center justify-center text-gray-500 hover:text-red-500 hover:bg-gray-50 rounded-l transition-colors"
                                                        >−</button>
                                                        <div className="flex-1 h-full flex items-center justify-center text-sm font-bold text-gray-700 border-x border-gray-100 bg-gray-50/50">
                                                            {item.qty}
                                                        </div>
                                                        <button
                                                          onClick={() => updateQuantity(item._id, 1)}
                                                          className="w-6 h-full flex items-center justify-center text-[#f187b5] hover:bg-gray-50 rounded-r transition-colors font-bold"
                                                        >+</button>
                                                   </div>
                                               </div>

                                               {/* Retail Price (SP) Input */}
                                               <div className="col-span-1">
                                                    <input
                                                         type="number"
                                                         value={sp}
                                                         onChange={(e) => updateItemDetails(item._id, { customPrice: parseFloat(e.target.value) || 0 })}
                                                         className="w-full text-center text-sm font-bold text-gray-900 border border-green-200 bg-green-50/30 focus:bg-white focus:border-[#f187b5] rounded px-1 py-1 outline-none transition-all"
                                                     />
                                                </div>

                                               {/* Sub Total */}
                                               <div className="col-span-1 text-center font-bold text-gray-900 text-sm">
                                                   ₹{sp * item.qty}
                                               </div>

                                               {/* Delete */}
                                               <div className="col-span-1 text-center">
                                                   <button
                                                      onClick={() => removeFromCart(item._id)}
                                                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors inline-flex"
                                                      title="Remove Item"
                                                   >
                                                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                   </button>
                                               </div>
                                          </div>
                                      </React.Fragment>
                                  );
                              })
                          )}
                          </div>
                      </div>
                  </div>
              {/* Footer Summary */}

                   {/* Desktop Sidebar (New Two-Column Layout) */}
                    <div className="hidden md:flex w-[320px] bg-gray-50 border-l border-gray-200 flex-col p-3 shadow-[inset_4px_0_24px_-12px_rgba(0,0,0,0.1)] z-20 overflow-hidden">
                        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 pr-1">

                      {/* --- QUICK ACTIONS --- */}
                        <div className="mb-3">
                            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">Quick Actions</h3>
                            <div className="grid grid-cols-2 gap-1.5">
                                <button
                                  onClick={() => setShowQuickAdd(true)}
                                  className="flex items-center gap-2 p-1.5 bg-white border border-gray-200 rounded-xl hover:border-[#f187b5] hover:shadow-md transition-all group"
                                >
                                    <div className="w-7 h-7 bg-[#f187b5]/10 text-[#f187b5] rounded-lg flex items-center justify-center group-hover:bg-[#f187b5] group-hover:text-white transition-colors">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[11px] font-bold text-gray-800">Quick Add</p>
                                    </div>
                                </button>

                                <button
                                  onClick={() => setShowAddCustomerModal(true)}
                                  className="flex items-center gap-2 p-1.5 bg-white border border-gray-200 rounded-xl hover:border-teal-500 hover:shadow-md transition-all group"
                                >
                                    <div className="w-7 h-7 bg-teal-50 text-teal-600 rounded-lg flex items-center justify-center group-hover:bg-teal-500 group-hover:text-white transition-colors">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[11px] font-bold text-gray-800">Add Cust.</p>
                                    </div>
                                </button>

                                <button
                                  onClick={() => navigate('/seller/pos/customers')}
                                  className="flex items-center gap-2 p-1.5 bg-white border border-gray-200 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all group col-span-2"
                                >
                                    <div className="w-7 h-7 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[11px] font-bold text-gray-800">Customer Credit (Udhaar)</p>
                                    </div>
                                </button>
                            </div>
                        </div>

                      {/* --- CUSTOMER SELECTION --- */}
                        <div className="mb-3 p-2.5 bg-white border border-gray-200 rounded-2xl shadow-sm">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1.5">Customer Selection</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search Customer..."
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#f187b5]/20 focus:border-[#f187b5] transition-all"
                                    value={customerSearch}
                                    onChange={(e) => {
                                      setCustomerSearch(e.target.value);
                                      if (selectedCustomer) {
                                          const expected = selectedCustomer.phone ? `${selectedCustomer.name} (${selectedCustomer.phone})` : selectedCustomer.name;
                                          if (e.target.value !== expected) setSelectedCustomer(null);
                                      }
                                  }}
                                  onFocus={() => customerSearch.length >= 2 && setShowCustomerDropdown(true)}
                                  onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                              />
                              {selectedCustomer && (
                                  <button onClick={clearCustomer} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500">✕</button>
                              )}
                              {showCustomerDropdown && customers.length > 0 && (
                                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto p-1">
                                      {customers.map(c => (
                                          <div
                                              key={c._id}
                                              onMouseDown={(e) => { e.preventDefault(); selectCustomer(c); }}
                                              className="p-2 hover:bg-gray-50 cursor-pointer rounded-lg border-b border-gray-50 last:border-0"
                                          >
                                              <div className="font-bold text-[11px] text-gray-800">{c.name}</div>
                                              <div className="text-[10px] text-gray-500">{c.phone}</div>
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </div>
                      </div>

                      {/* --- ORDER TYPE --- */}
                        <div className="mb-3">
                           <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1.5">Order Type</label>
                            <div className="bg-gray-200 p-1 rounded-xl flex relative h-8">
                              <div
                                  className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#f187b5] rounded-lg transition-all duration-300 ease-in-out shadow-sm ${orderType === 'Wholesale' ? 'left-[calc(50%+2px)]' : 'left-1'}`}
                              ></div>
                              <button onClick={() => setOrderType('Retail')} className={`flex-1 relative z-10 text-center text-[11px] font-bold transition-colors ${orderType === 'Retail' ? 'text-white' : 'text-gray-500'}`}>Retail</button>
                              <button onClick={() => setOrderType('Wholesale')} className={`flex-1 relative z-10 text-center text-[11px] font-bold transition-colors ${orderType === 'Wholesale' ? 'text-white' : 'text-gray-500'}`}>Wholesale</button>
                          </div>
                      </div>

                      {/* --- PAYMENT METHOD --- */}
                        <div className="mb-3">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1.5">Payment Method</label>
                            <div className="relative">
                                <button
                                    onClick={() => setShowPaymentDropdown(!showPaymentDropdown)}
                                    className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-700 hover:border-[#f187b5] transition-all shadow-sm"
                              >
                                  <span>{paymentMethod || 'Cash'}</span>
                                  <svg className={`w-3 h-3 text-gray-400 transition-transform ${showPaymentDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                              </button>
                              {showPaymentDropdown && (
                                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden p-1">
                                      {['Cash', 'Razorpay', 'Cashfree', 'Credit'].map((method) => (
                                          <div
                                              key={method}
                                              onClick={() => { setPaymentMethod(method); setShowPaymentDropdown(false); }}
                                              className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 cursor-pointer rounded-lg text-[11px] font-medium text-gray-700"
                                          >
                                              <span>{method === 'Credit' ? 'Credit (Udhaar)' : method}</span>
                                              <span className="text-gray-300 text-[10px]">→</span>
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </div>
                      </div>

                        </div>

                        {/* --- SUMMARY & ACTIONS --- */}
                        <div className="flex-none space-y-2 pt-3 border-t border-gray-200 bg-gray-50">
                            <div className="bg-[#162a43] text-white p-2 rounded-[1rem] shadow-lg">
                              <div className="flex justify-between items-center mb-0.5">
                                 <span className="text-white text-[8px] uppercase tracking-widest">Subtotal</span>
                                 <span className="font-bold text-[12px]">₹{calculateTotal().toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between items-center mb-1">
                                 <span className="text-white text-[8px] uppercase tracking-widest">Qty. Items</span>
                                 <span className="font-bold text-[12px]">{cart.reduce((a, c) => a + c.qty, 0)}</span>
                              </div>
                              <div className="border-t border-white/10 pt-2 flex justify-between items-center">
                                 <div className="flex flex-col">
                                      <span className="text-white text-[7px] font-bold uppercase tracking-widest">Total Payable</span>
                                     <span className="text-base font-black">₹{calculateTotal().toLocaleString()}</span>
                                 </div>
                              </div>
                          </div>

                          <div className="space-y-2">
                               {!activeBillId.startsWith('edit_') && (
                                 <button
                                    onClick={handleGenerateBill}
                                    disabled={cart.length === 0}
                                    className="w-full bg-[#162a43] border-2 border-[#162a43] text-white hover:bg-[#162a43] hover:text-white font-black py-2 px-4 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group text-xs"
                                  >
                                    <svg className="w-4 h-4 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    <span>GENERATE BILL</span>
                                 </button>
                               )}

                               <button
                                  onClick={activeBillId.startsWith('edit_') ? handleUpdateOrder : handleAccessPayment}
                                  disabled={loading || cart.length === 0}
                                    className={`w-full ${activeBillId.startsWith('edit_') ? 'bg-[#162a43] hover:bg-[#162a43]' : 'bg-[#162a43] hover:bg-[#162a43]'} text-white font-black py-2.5 px-4 rounded-xl shadow-lg shadow-[#162a43]/30 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-xs`}
                                >
                                  {loading ? (
                                     <>
                                         <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                                         <span>{activeBillId.startsWith('edit_') ? 'UPDATING...' : 'PROCESSING...'}</span>
                                     </>
                                  ) : (
                                     <>
                                         <span className="tracking-widest">{activeBillId.startsWith('edit_') ? 'UPDATE ORDER' : 'COMPLETE TRANSACTION'}</span>
                                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={activeBillId.startsWith('edit_') ? "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" : "M14 5l7 7m0 0l-7 7m7-7H3"}></path></svg>
                                     </>
                                  )}
                               </button>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Mobile Footer */}
              <div className="flex-none md:hidden bg-gray-50/95 p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] border-t border-gray-100 backdrop-blur-sm fixed bottom-0 left-0 right-0 z-30">
                  {/* Desktop Footer Row */}
                  <div className="hidden md:flex flex-row items-center justify-between gap-4">
                      {/* Left Side: Total */}
                      <div className="flex items-center gap-4">
                          <p className="text-gray-500 text-sm font-medium">Subtotal</p>
                          <p className="text-3xl font-bold text-gray-800">₹{calculateTotal()}</p>
                      </div>

                      {/* Right Side: Buttons */}
                      <div className="flex items-center gap-3">
                           {!activeBillId.startsWith('edit_') && (
                             <button
                               onClick={handleGenerateBill}
                               disabled={cart.length === 0}
                               className="bg-white border-2 border-[#f187b5] text-[#f187b5] hover:bg-[#f187b5] hover:text-white font-bold py-2.5 px-6 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group text-sm"
                             >
                                <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                <span>Generate Bill</span>
                             </button>
                           )}

                           <button
                             onClick={activeBillId.startsWith('edit_') ? handleUpdateOrder : handleAccessPayment}
                             disabled={loading}
                             className={`${activeBillId.startsWith('edit_') ? 'bg-[#f187b5] hover:bg-[#e076a5]' : 'bg-gray-900 hover:bg-black'} text-white font-bold py-2.5 px-6 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98] text-sm min-w-[140px]`}
                           >
                              {loading ? (
                                 <>
                                     <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                                     <span>{activeBillId.startsWith('edit_') ? 'Updating...' : 'Processing...'}</span>
                                 </>
                              ) : (
                                 <>
                                     <span>{activeBillId.startsWith('edit_') ? 'Update Order' : 'Pay & Save'}</span>
                                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={activeBillId.startsWith('edit_') ? "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" : "M14 5l7 7m0 0l-7 7m7-7H3"}></path></svg>
                                 </>
                              )}
                           </button>
                       </div>
                  </div>

                  {/* Mobile Footer Actions - POS */}
                  <div className="lg:hidden space-y-2 mt-1.5">
                      <div className="flex justify-between items-center px-1">
                          <span className="text-gray-600 font-medium text-xs">Subtotal</span>
                          <span className="text-lg font-bold text-gray-900">₹{calculateTotal().toLocaleString()}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => setShowQuickAdd(true)}
                            className="rounded-2xl bg-[#f7d8e7] text-[#b34f7e] py-2.5 font-semibold border border-[#f3c7dc] active:scale-[0.98]"
                          >
                            Quick add +
                          </button>

                          <button
                            onClick={activeBillId.startsWith('edit_') ? handleUpdateOrder : handleAccessPayment}
                            disabled={loading || cart.length === 0}
                            className="rounded-2xl bg-[#f187b5] hover:bg-[#e076a5] text-white font-semibold py-2.5 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                          >
                            {loading ? (activeBillId.startsWith('edit_') ? 'Updating...' : 'Paying...') : (activeBillId.startsWith('edit_') ? 'Update' : 'Pay')}
                          </button>

                          {!activeBillId.startsWith('edit_') && (
                            <button
                              onClick={handleGenerateBill}
                              disabled={cart.length === 0}
                              className="rounded-2xl bg-[#f187b5] hover:bg-[#e076a5] text-white font-semibold py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Bill
                            </button>
                          )}
                      </div>

                      <div className="grid grid-cols-[1fr_110px] gap-2">
                        <button
                          onClick={() => setShowMobileSearch(true)}
                          className="w-full rounded-xl border border-[#f3c7dc] px-4 py-2.5 text-left text-gray-500 bg-[#fffafd] flex items-center gap-2"
                        >
                          <svg className="w-5 h-5 text-[#f187b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                          </svg>
                          <span className="font-semibold text-sm">Search Items</span>
                        </button>
                        <button
                          onClick={() => { setScanTarget('inventory'); setShowScanner(true); }}
                          className="rounded-xl border border-[#f3c7dc] px-3 py-2.5 font-semibold text-gray-700 bg-white flex items-center justify-center gap-2"
                        >
                          <span className="font-semibold text-sm">Scan</span>
                          <svg className="w-5 h-5 text-[#f187b5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                             <path strokeLinecap="round" strokeLinejoin="round" d="M3 5v2a2 2 0 002 2h2m10 0h2a2 2 0 002-2V5M3 19v-2a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m-6-13h-4m4 4h-4m4 4h-4m4 4h-4"/>
                          </svg>
                        </button>
                      </div>
                  </div>
              </div>
            </div>
        </div>
      </div>

      {/* --- PURCHASE ACTION SHEET --- */}
      {showPurchaseSheet && (
        <div className="fixed inset-0 bg-black/40 z-[70] flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setShowPurchaseSheet(false)}>
          <div
            className="bg-white w-full max-w-xl rounded-t-3xl md:rounded-2xl p-5 md:p-6 space-y-3 shadow-2xl border border-transparent md:border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-1"></div>
            <div className="text-center pb-1">
              <h3 className="text-base md:text-lg font-bold text-gray-800">Purchase Options</h3>
              <p className="text-xs text-gray-500 mt-1">Start a new purchase entry</p>
            </div>
            <button
              onClick={() => {
                setShowPurchaseSheet(false);
                setShowPurchaseEntry(true);
              }}
              className="w-full text-left px-3 py-3.5 rounded-xl hover:bg-gray-50 border border-gray-200/80 hover:border-[#f3c7dc] flex items-center gap-3 text-gray-800 transition-colors"
            >
              <svg className="w-5 h-5 text-[#f187b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1 5h12M9 21a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z" />
              </svg>
              <span className="font-semibold">Create purchase entry</span>
            </button>
          </div>
        </div>
      )}

      {/* --- PURCHASE ENTRY UI (FRONTEND ONLY) --- */}
      {showPurchaseEntry && (
        <div className="fixed inset-0 z-[75] bg-[#fff7fb] flex flex-col overflow-hidden md:p-3 md:bg-gray-50">
          <div className="px-4 py-3 bg-white border-b border-[#f3c7dc] md:max-w-[1450px] md:mx-auto md:w-full md:rounded-xl md:border md:shadow-sm md:mb-2 md:py-2.5">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => {
                  setShowPurchaseEntry(false);
                  setEditingQuotationId(null);
                  setPurchaseItems([]);
                  setPurchaseSupplier(null);
                  setBillAttachment(null);
                }}
                className="w-9 h-9 rounded-full border border-[#f3c7dc] bg-white flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-lg md:text-base font-bold text-gray-800">
                {purchaseMode === 'Quotation' ? 'Billing & POS' : 'Create Purchase Entry'}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={() => setPurchaseMode('Purchase')}
                className={`rounded-xl py-2 text-sm font-bold border ${
                  purchaseMode === 'Purchase'
                    ? 'bg-[#f187b5] text-white border-[#f187b5]'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                Purchase
              </button>
              <button
                onClick={() => setPurchaseMode('Quotation')}
                className={`rounded-xl py-2 text-sm font-bold border ${
                  purchaseMode === 'Quotation'
                    ? 'bg-[#f187b5] text-white border-[#f187b5]'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                Quotation
              </button>
            </div>
            <div className="mb-2">
              <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold ${
                purchaseMode === 'Purchase' ? 'bg-[#fce5f0] text-[#c95288]' : 'bg-[#fdeff6] text-[#c95288]'
              }`}>
                {purchaseMode === 'Purchase' ? 'PURCHASE MODE' : 'QUOTATION MODE'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowSupplierModal(true)}
                className="flex items-center gap-2 justify-center rounded-xl border border-[#f187b5]/30 text-[#cf6594] bg-[#f187b5]/10 py-2.5 text-sm font-semibold md:py-2 md:text-[13px]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3M4 11h16M5 21h14a1 1 0 001-1V8a1 1 0 00-1-1H5a1 1 0 00-1 1v12a1 1 0 001 1z" />
                </svg>
                {purchaseSupplier ? purchaseSupplier.name : 'Add Supplier'}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleAttachBill}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`rounded-xl py-2.5 text-sm font-semibold transition-colors md:py-2 md:text-[13px] border ${
                  billAttachment
                    ? 'bg-green-500 text-white border-green-500'
                    : 'bg-[#f187b5] text-white border-[#f187b5] hover:bg-[#e076a5]'
                }`}
              >
                {billAttachment ? '✓ Bill Attached' : '+Attach Bills'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="relative">
                <button
                  onClick={() => setShowPurchasePaymentDropdown((v) => !v)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 flex items-center justify-between text-sm md:h-10 md:py-2 md:text-[13px]"
                >
                  <span>{purchasePaymentMethod}</span>
                  <svg className={`w-4 h-4 transition-transform ${showPurchasePaymentDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showPurchasePaymentDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10">
                    {(['Cash', 'Credit', 'Online'] as const).map((method) => (
                      <button
                        key={method}
                        onClick={() => {
                          setPurchasePaymentMethod(method);
                          setShowPurchasePaymentDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 text-sm md:py-2 md:text-[13px]"
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-sm md:h-10 md:py-2 md:text-[13px]"
              />
            </div>

            <div className="hidden md:flex items-center gap-2 mt-2">
              <button
                onClick={() => setShowPurchaseSearch(true)}
                className="flex-1 flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 h-10 text-left text-gray-500 hover:border-[#f187b5]/40 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
                <span className="text-[15px]">Search products by name, barcode...</span>
              </button>
              <button
                onClick={() => { setScanTarget('purchase'); setShowScanner(true); }}
                className="w-12 h-10 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-[#f187b5] hover:border-[#f187b5]/40 transition-colors flex items-center justify-center"
                title="Scan"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5v2a2 2 0 002 2h2m10 0h2a2 2 0 002-2V5M3 19v-2a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m-6-13h-4m4 4h-4m4 4h-4m4 4h-4"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pb-5 md:max-w-[1450px] md:mx-auto md:w-full md:p-2">
            {purchaseMode === 'Purchase' && (
              <div className="bg-gradient-to-r from-[#f187b5] to-[#e076a5] text-white rounded-xl p-3 md:p-3 mb-3 md:mb-2 md:shadow-sm">
                <div className="text-xs text-white/80">Tap to add discount.</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-sm text-white/80">Total</span>
                  <span className="text-2xl md:text-xl font-black">₹{calculatePurchaseTotal().toFixed(2)}</span>
                </div>
                <div className="text-[11px] text-white/70 mt-1">Date: {formatPurchaseDate(purchaseDate)}</div>
              </div>
            )}

            {purchaseItems.length === 0 ? (
              <div className="min-h-[45vh] flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-[#f3c7dc]">
                <div className="w-16 h-16 rounded-2xl bg-gray-200 flex items-center justify-center mb-3">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1 5h12" />
                  </svg>
                </div>
                <p className="text-2xl md:text-2xl font-semibold text-gray-700">No items added yet</p>
                <p className="text-gray-500 mt-2">Search and add products to start your purchase entry</p>
              </div>
            ) : (
              <div className="space-y-4 md:space-y-3">
                {purchaseItems.map((item, index) => {
                  const subtotal = item.purchasePrice * item.qty;
                  const afterPurchaseQty = item.currentQty + item.qty;
                  const discountAmount = item.billDiscountType === '%' ? (subtotal * item.billDiscount) / 100 : item.billDiscount;

                  if (purchaseMode === 'Quotation') {
                    return (
                      <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm mb-3 relative overflow-hidden group shrink-0">
                        {/* Top Row: Rank, Title, Price */}
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-start gap-2 max-w-[70%]">
                            <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">#{index + 1}</span>
                            <div>
                              <h4 className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2">{item.productName}</h4>
                            </div>
                          </div>
                          <div className="font-bold text-gray-900 text-base">₹{Math.max(subtotal - discountAmount, 0).toFixed(2)}</div>
                        </div>

                        {/* Middle Row: Image & Pricing Details */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 flex-shrink-0 bg-white rounded-lg border border-gray-100 flex items-center justify-center p-1 overflow-hidden">
                            {item.image ? (
                              <img src={item.image} alt={item.productName} className="w-full h-full object-contain" />
                            ) : (
                              <span className="text-xs text-gray-300">Img</span>
                            )}
                          </div>
                          <div className="flex flex-col text-xs">
                            <span className="text-gray-500">
                              MRP: <span className="line-through decoration-gray-400">₹{item.mrp}</span>{' '}
                              <span className="font-bold text-[#f187b5] ml-1">SP: ₹{item.retailPrice}</span>
                            </span>
                          </div>
                        </div>

                        {/* Bottom Row: Actions & Quantity */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => removePurchaseItem(item.id)}
                              className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors border border-red-100"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                            <button
                              onClick={() => openPurchaseEditModal(item)}
                              className="px-3 py-1.5 flex items-center gap-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                            >
                              <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                              Edit
                            </button>
                          </div>

                          {/* Quantity Control */}
                          <div className="flex items-center bg-gray-50 rounded-lg p-0.5 border border-gray-200">
                            <button
                              onClick={() => updatePurchaseItem(item.id, { qty: Math.max(1, item.qty - 1) })}
                              className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-white hover:shadow-sm rounded transition-all font-bold text-lg"
                            >
                              -
                            </button>
                            <div className="w-8 flex items-center justify-center text-sm font-bold text-gray-800">{item.qty}</div>
                            <button
                              onClick={() => updatePurchaseItem(item.id, { qty: item.qty + 1 })}
                              className="w-7 h-7 flex items-center justify-center text-[#f187b5] hover:bg-white hover:shadow-sm rounded transition-all font-bold text-lg"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={item.id} className="bg-white rounded-2xl border border-[#f3c7dc] shadow-sm p-3 md:p-3">
                      <div className="flex gap-3 items-start">
                        <div className="text-xl font-bold text-gray-600">#{index + 1}</div>
                        <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                          {item.image ? <img src={item.image} alt={item.productName} className="w-full h-full object-contain" /> : <span className="text-xs text-gray-400">IMG</span>}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">MRP: ₹{item.mrp} | Sp.: ₹{item.retailPrice}</p>
                          {purchaseMode === 'Purchase' && (
                            <p className="text-xs text-gray-500">Current Quantity: {item.currentQty} Piece</p>
                          )}
                          <h3 className="text-xl md:text-3xl font-bold text-gray-800 leading-tight">{item.productName}</h3>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Subtotal</div>
                          <div className="font-bold text-gray-800">₹{Math.max(subtotal - discountAmount, 0).toFixed(2)}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2 flex-wrap">
                        <button
                          onClick={() => openVariantPicker(item)}
                          className="px-3 py-1.5 rounded-full border border-gray-300 text-sm font-medium md:py-1 md:text-[13px]"
                        >
                          + Add Variant
                        </button>
                        <button className="px-3 py-1.5 rounded-full border border-[#f187b5] text-[#cf6594] text-sm font-medium md:py-1 md:text-[13px]">Edit</button>
                        <button onClick={() => removePurchaseItem(item.id)} className="px-3 py-1.5 rounded-full border border-red-200 text-red-500 text-sm font-medium md:py-1 md:text-[13px]">Remove</button>
                        <label className="ml-auto inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                          <input type="checkbox" checked={item.includingGST} onChange={(e) => updatePurchaseItem(item.id, { includingGST: e.target.checked })} />
                          Including GST
                        </label>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-3">
                        <label className="text-xs text-gray-500">Total Price
                          <input type="number" value={subtotal.toFixed(2)} readOnly className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 md:h-10 md:py-1.5 md:text-sm" />
                        </label>
                        <label className="text-xs text-gray-500">Qty
                          <input type="number" min={1} value={item.qty} onChange={(e) => updatePurchaseItem(item.id, { qty: Math.max(1, Number(e.target.value || 1)) })} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 md:h-10 md:py-1.5 md:text-sm" />
                        </label>
                        <label className="text-xs text-gray-500">Purchase Price
                          <input type="number" value={item.purchasePrice} onChange={(e) => updatePurchaseItem(item.id, { purchasePrice: Number(e.target.value || 0) })} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 md:h-10 md:py-1.5 md:text-sm" />
                        </label>
                      </div>

                      {purchaseMode === 'Purchase' && (
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          <label className="text-xs text-gray-500">Current Quantity
                            <input type="number" readOnly value={item.currentQty} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 md:h-10 md:py-1.5 md:text-sm" />
                          </label>
                          <label className="text-xs text-gray-500">Qty
                            <input type="number" min={1} value={item.qty} onChange={(e) => updatePurchaseItem(item.id, { qty: Math.max(1, Number(e.target.value || 1)) })} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 md:h-10 md:py-1.5 md:text-sm" />
                          </label>
                          <label className="text-xs text-gray-500">After Purchase
                            <input type="number" readOnly value={afterPurchaseQty} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 md:h-10 md:py-1.5 md:text-sm" />
                          </label>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="grid grid-cols-[1fr_72px] gap-2 items-end">
                          <label className="text-xs text-gray-500">Bill Discount
                            <input type="number" value={item.billDiscount} onChange={(e) => updatePurchaseItem(item.id, { billDiscount: Number(e.target.value || 0) })} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 md:h-10 md:py-1.5 md:text-sm" />
                          </label>
                          <select value={item.billDiscountType} onChange={(e) => updatePurchaseItem(item.id, { billDiscountType: e.target.value as '%' | '₹' })} className="rounded-xl border border-gray-300 px-2 py-2 h-[42px] md:h-10 md:py-1.5 md:text-sm">
                            <option value="%">%</option>
                            <option value="₹">₹</option>
                          </select>
                        </div>
                        <label className="text-xs text-gray-500">GST
                          <input type="number" value={item.gstPercent} onChange={(e) => updatePurchaseItem(item.id, { gstPercent: Number(e.target.value || 0) })} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 md:h-10 md:py-1.5 md:text-sm" />
                        </label>
                      </div>

                      <button
                        onClick={() => updatePurchaseItem(item.id, { additionalOpen: !item.additionalOpen })}
                        className="w-full mt-3 text-left px-1 py-2 font-semibold text-gray-800 flex items-center justify-between"
                      >
                        <span>Additional Details</span>
                        <span>{item.additionalOpen ? '▴' : '▾'}</span>
                      </button>
                      {item.additionalOpen && (
                        <div className="space-y-2">
                          <label className="text-xs text-gray-500 block">Enter Barcode Number</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={item.barcode}
                              onChange={(e) => updatePurchaseItem(item.id, { barcode: e.target.value })}
                              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                              placeholder="Scan or Enter"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setPurchaseBarcodeScanItemId(item.id);
                                setScanTarget('purchase-barcode');
                                setShowScanner(true);
                                setScannerKey((k) => k + 1);
                              }}
                              className="mt-1 px-3 py-2 bg-pink-50 border border-pink-200 rounded-xl hover:bg-pink-100 text-[#f187b5] flex items-center justify-center gap-1 text-xs font-semibold"
                              title="Scan Barcode"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7V5a2 2 0 012-2h2m6 0h2a2 2 0 012 2v2M5 17v2a2 2 0 002 2h2m6 0h2a2 2 0 002-2v-2M7 12h10M7 9h2m6 0h2m-4 6h2m-8 0h2" /></svg>
                              Scan
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handlePrintPurchaseBarcode(item)}
                              className="rounded-lg bg-[#f187b5] text-white py-2 text-sm font-semibold"
                            >
                              Print Barcode
                            </button>
                            <button
                              onClick={() => handleAutoGeneratePurchaseBarcode(item.id)}
                              className="rounded-lg bg-gray-100 text-gray-800 py-2 text-sm font-semibold"
                            >
                              Auto Generate Barcode
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-xs text-gray-500">MRP
                              <input type="number" value={item.mrp} onChange={(e) => updatePurchaseItem(item.id, { mrp: Number(e.target.value || 0) })} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2" />
                            </label>
                            <label className="text-xs text-gray-500">Retail Price
                              <input type="number" value={item.retailPrice} onChange={(e) => updatePurchaseItem(item.id, { retailPrice: Number(e.target.value || 0) })} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2" />
                            </label>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <label className="text-xs text-gray-500">Wholesale
                              <input type="number" value={item.wholesalePrice} onChange={(e) => updatePurchaseItem(item.id, { wholesalePrice: Number(e.target.value || 0) })} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2" />
                            </label>
                            <label className="text-xs text-gray-500">Mfg Date
                              <input type="date" value={item.mfgDate} onChange={(e) => updatePurchaseItem(item.id, { mfgDate: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2" />
                            </label>
                            <label className="text-xs text-gray-500">Expiry
                              <input type="date" value={item.expiry} onChange={(e) => updatePurchaseItem(item.id, { expiry: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2" />
                            </label>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <label className="text-xs text-gray-500">Hsn
                              <input type="text" value={item.hsn} onChange={(e) => updatePurchaseItem(item.id, { hsn: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2" />
                            </label>
                            <label className="text-xs text-gray-500">Batch
                              <input type="text" value={item.batch} onChange={(e) => updatePurchaseItem(item.id, { batch: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2" />
                            </label>
                            <label className="text-xs text-gray-500">Pack of
                              <input type="number" min={1} value={item.packOf} onChange={(e) => updatePurchaseItem(item.id, { packOf: Math.max(1, Number(e.target.value || 1)) })} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2" />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white border-t border-[#f3c7dc] p-3 space-y-2 pb-4 md:pb-2.5 md:rounded-xl md:border md:shadow-sm md:max-w-[1450px] md:mx-auto md:w-full md:pt-2.5">
            {purchaseMode === 'Quotation' && (
               <div className="flex flex-col gap-2 px-1 mb-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium text-sm">Subtotal</span>
                    <span className="text-xl font-bold text-gray-900">₹{calculatePurchaseTotal().toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="reduceStockToggle"
                      className="w-4 h-4 text-[#f187b5] border-gray-300 rounded focus:ring-[#f187b5] cursor-pointer"
                      checked={reduceStockOnQuotation}
                      onChange={(e) => setReduceStockOnQuotation(e.target.checked)}
                    />
                    <label htmlFor="reduceStockToggle" className="text-sm font-semibold text-gray-700 cursor-pointer select-none">Deduct from inventory</label>
                  </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowQuickAdd(true);
                }}
                className="rounded-2xl bg-[#f7d8e7] text-[#b34f7e] py-3 font-semibold border border-[#f3c7dc] md:py-2.5 md:text-[15px]"
              >
                Quick add +
              </button>
              <button
                onClick={handleSavePurchaseEntry}
                className="rounded-2xl bg-[#f187b5] hover:bg-[#e076a5] text-white py-3 font-semibold transition-colors md:py-2.5 md:text-[15px]"
              >
                {purchaseMode === 'Purchase'
                  ? `Total (${purchaseItems.length}) Purchase`
                  : `Create Quotation (${purchaseItems.length})`}
              </button>
            </div>
            <div className="grid grid-cols-[1fr_110px] gap-2 md:hidden">
              <button
                onClick={() => setShowPurchaseSearch(true)}
                className="w-full rounded-xl border border-[#f3c7dc] px-4 py-3.5 text-left text-gray-500 bg-[#fffafd] flex items-center gap-2"
              >
                <svg className="w-5 h-5 text-[#f187b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
                <span className="font-semibold text-sm">Search Items</span>
              </button>
              <button
                onClick={() => { setScanTarget('purchase'); setShowScanner(true); }}
                className="rounded-xl border border-[#f3c7dc] px-3 py-3 font-semibold text-gray-700 bg-white flex items-center justify-center gap-2"
              >
                <span className="font-semibold text-sm">Scan</span>
                <svg className="w-5 h-5 text-[#f187b5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M3 5v2a2 2 0 002 2h2m10 0h2a2 2 0 002-2V5M3 19v-2a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m-6-13h-4m4 4h-4m4 4h-4m4 4h-4"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- PURCHASE SUPPLIER MODAL --- */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/40 z-[80] flex items-end justify-center" onClick={() => setShowSupplierModal(false)}>
          <div className="w-full max-w-xl bg-white rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-3"></div>
            <h3 className="text-3xl font-semibold text-gray-800 mb-4">Add Supplier</h3>

            {/* Supplier Search */}
            <div className="mb-4 relative">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Search Existing Supplier</label>
              <div className="relative">
                <input
                  type="text"
                  value={supplierSearch}
                  onChange={(e) => {
                    setSupplierSearch(e.target.value);
                    setShowSupplierResults(true);
                  }}
                  onFocus={() => setShowSupplierResults(true)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 pl-10 focus:ring-2 focus:ring-[#f187b5]/20 focus:border-[#f187b5] focus:outline-none transition-all"
                  placeholder="Search by name or phone..."
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {showSupplierResults && supplierSearch.trim() && (
                <div className="absolute z-[90] left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                  {allSuppliers.filter(s =>
                    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
                    s.phone.includes(supplierSearch)
                  ).map(s => (
                    <button
                      key={s._id}
                      onClick={() => {
                        setPurchaseSupplierForm({
                          name: s.name,
                          phone: s.phone,
                          address: s.address || '',
                          notes: s.notes || '',
                          gstNumber: s.gstNumber || '',
                          openingBalance: String(s.openingBalance || '0'),
                          openingBalanceType: s.openingBalanceType || 'Payment'
                        });
                        setSupplierSearch(s.name);
                        setShowSupplierResults(false);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                    >
                      <div className="font-semibold text-gray-800">{s.name}</div>
                      <div className="text-xs text-gray-500">{s.phone} {s.gstNumber ? `| GST: ${s.gstNumber}` : ''}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">Supplier Name *
                <input value={purchaseSupplierForm.name} onChange={(e) => setPurchaseSupplierForm((p) => ({ ...p, name: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-[#f187b5]/20 focus:border-[#f187b5] focus:outline-none transition-all" placeholder="Enter supplier name" />
              </label>
              <label className="block text-sm font-semibold text-gray-700">Phone Number *
                <input value={purchaseSupplierForm.phone} onChange={(e) => setPurchaseSupplierForm((p) => ({ ...p, phone: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-[#f187b5]/20 focus:border-[#f187b5] focus:outline-none transition-all" placeholder="Enter phone number" />
              </label>
              <label className="block text-sm font-semibold text-gray-700">Address (optional)
                <textarea value={purchaseSupplierForm.address} onChange={(e) => setPurchaseSupplierForm((p) => ({ ...p, address: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-[#f187b5]/20 focus:border-[#f187b5] focus:outline-none transition-all" rows={2} placeholder="Enter supplier address" />
              </label>
              <label className="block text-sm font-semibold text-gray-700">Notes (optional)
                <textarea value={purchaseSupplierForm.notes} onChange={(e) => setPurchaseSupplierForm((p) => ({ ...p, notes: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-[#f187b5]/20 focus:border-[#f187b5] focus:outline-none transition-all" rows={2} placeholder="Enter notes or remarks" />
              </label>
              <label className="block text-sm font-semibold text-gray-700">GST Number (optional)
                <input value={purchaseSupplierForm.gstNumber} onChange={(e) => setPurchaseSupplierForm((p) => ({ ...p, gstNumber: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-[#f187b5]/20 focus:border-[#f187b5] focus:outline-none transition-all" placeholder="Enter GST number" />
              </label>
              <label className="block text-sm font-semibold text-gray-700">Opening Balance (optional)
                <div className="grid grid-cols-[1fr_120px] gap-2 mt-1">
                  <input value={purchaseSupplierForm.openingBalance} onChange={(e) => setPurchaseSupplierForm((p) => ({ ...p, openingBalance: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-[#f187b5]/20 focus:border-[#f187b5] focus:outline-none transition-all" placeholder="0.00" />
                  <select value={purchaseSupplierForm.openingBalanceType} onChange={(e) => setPurchaseSupplierForm((p) => ({ ...p, openingBalanceType: e.target.value as "Payment" | "Receive" }))} className="rounded-xl border border-gray-300 px-2 py-2.5 focus:ring-2 focus:ring-[#f187b5]/20 focus:border-[#f187b5] focus:outline-none transition-all">
                    <option value="Payment">PAYMENT</option>
                    <option value="Receive">RECEIVE</option>
                  </select>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button onClick={() => setShowSupplierModal(false)} className="rounded-xl border border-gray-300 py-3 font-semibold text-gray-700">Cancel</button>
              <button
                onClick={async () => {
                  if (!purchaseSupplierForm.name.trim() || !purchaseSupplierForm.phone.trim()) {
                    showToast('Supplier name and phone are required.', 'error');
                    return;
                  }
                  setPurchaseSupplier(purchaseSupplierForm);
                  setShowSupplierModal(false);
                  showToast('Supplier added in purchase entry.', 'success');

                  // Additionally, try to persist supplier in Seller POS Supplier Ledger (DB).
                  // This is best-effort only; failures won't affect current flow.
                  try {
                    const openingBalance = parseFloat(purchaseSupplierForm.openingBalance || '0') || 0;
                    const openingBalanceType =
                      purchaseSupplierForm.openingBalanceType === 'Receive' ||
                      purchaseSupplierForm.openingBalanceType === 'Payment'
                        ? purchaseSupplierForm.openingBalanceType
                        : 'Receive';

                    const payload: Partial<import('../../../services/api/seller/supplierService').Supplier> = {
                      name: purchaseSupplierForm.name.trim(),
                      phone: purchaseSupplierForm.phone.trim(),
                      address: purchaseSupplierForm.address || undefined,
                      gstNumber: purchaseSupplierForm.gstNumber || undefined,
                      notes: purchaseSupplierForm.notes || undefined,
                      openingBalance,
                      openingBalanceType,
                    };

                    const res = await import('../../../services/api/seller/supplierService').then(m =>
                      m.createSupplier(payload)
                    );

                    if (!res?.success) {
                      console.warn('Failed to persist supplier to ledger:', res?.message);
                    }
                  } catch (err) {
                    // Silently ignore DB errors to avoid breaking existing purchase-entry flow
                    console.error('Error creating supplier in ledger (non-blocking):', err);
                  }
                }}
                className="rounded-xl bg-[#f187b5] hover:bg-[#e076a5] text-white py-3 font-semibold transition-all"
              >
                Add Supplier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- PURCHASE SEARCH MODAL --- */}
      {showPurchaseSearch && (
        <div className="fixed inset-0 bg-white z-[85] flex flex-col">
          <div className="px-3 py-2 border-b border-gray-200 flex items-center gap-2">
            <button onClick={() => setShowPurchaseSearch(false)} className="p-2">
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <input
              value={purchaseSearchQuery}
              onChange={(e) => setPurchaseSearchQuery(e.target.value)}
              placeholder="Search by name or barcode"
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5"
              autoFocus
            />
          </div>
          <div className="flex-1 overflow-y-auto bg-gray-50 p-3">
            <div className="bg-white rounded-xl border border-gray-200 px-3 py-2 flex items-center justify-between mb-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" defaultChecked />
                Include Products from BF Inventory
              </label>
              <button className="rounded-full px-3 py-1 text-sm bg-[#f3ecff] text-[#7a6ea4]">More</button>
            </div>

            {purchaseSearchLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-[#f187b5]/30 border-t-[#f187b5] rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {purchaseSearchResults
                  .filter((product) => {
                    const q = purchaseSearchQuery.trim().toLowerCase();
                    if (!q) return true;
                    const barcodeMatch = Array.isArray(product.barcode)
                      ? product.barcode.some((b: string) => String(b).toLowerCase().includes(q))
                      : String(product.barcode || '').toLowerCase().includes(q);
                    return product.productName.toLowerCase().includes(q) || barcodeMatch;
                  })
                  .slice(0, 25)
                  .map((product) => {
                    const purchaseItem = purchaseItems.find((item) => item.productId === product._id);
                    const purchaseQty = purchaseItem?.qty || 0;

                    return (
                      <div key={product._id} className="bg-white border border-gray-200 rounded-2xl p-3">
                        <div className="flex gap-3">
                          <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                            {product.mainImage ? <img src={product.mainImage} alt="" className="w-full h-full object-contain" /> : <span className="text-xs text-gray-400">IMG</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-800 leading-tight">{product.productName}</h4>
                            <p className="text-sm text-gray-500">MRP: ₹{product.compareAtPrice || product.price} | Retail Price: ₹{product.price}</p>
                            <p className="text-sm text-gray-500">Quantity: {product.stock} Piece</p>
                          </div>
                          {purchaseQty > 0 ? (
                            <div className="self-center flex items-center gap-2 bg-[#fdf0f6] border border-[#f3c7dc] rounded-xl px-2 py-1">
                              <button
                                onClick={() => decreasePurchaseQtyByProductId(product._id)}
                                className="w-7 h-7 rounded-md border border-[#f3c7dc] text-[#cf6594] bg-white font-bold text-lg leading-none"
                              >
                                -
                              </button>
                              <span className="min-w-[20px] text-center text-sm font-bold text-[#cf6594]">{purchaseQty}</span>
                              <button
                                onClick={() => addProductToPurchase(product)}
                                className="w-7 h-7 rounded-md bg-[#f187b5] text-white font-bold text-lg leading-none"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addProductToPurchase(product)}
                              className="self-center rounded-xl border border-gray-300 px-5 py-2 font-semibold hover:bg-gray-50"
                            >
                              Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- PURCHASE VARIANT PICKER --- */}
      {showVariantPicker && variantPickerItem && (
        <div className="fixed inset-0 bg-black/40 z-[86] flex items-center justify-center p-4" onClick={() => { setShowVariantPicker(false); setVariantPickerItem(null); }}>
          <div className="w-full max-w-xl bg-white rounded-2xl border border-[#f3c7dc] shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-[#f3c7dc] bg-[#fff7fb] flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-800">Select Variant</h3>
              <button onClick={() => { setShowVariantPicker(false); setVariantPickerItem(null); }} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto p-3 space-y-2">
              {(() => {
                const sourceProduct: any =
                  purchaseSearchResults.find((p: any) => p._id === variantPickerItem.baseProductId) ||
                  products.find((p: any) => p._id === variantPickerItem.baseProductId);
                const variations: any[] = Array.isArray(sourceProduct?.variations) ? sourceProduct.variations : [];

                if (!variations.length) {
                  return (
                    <div className="text-center py-10 text-gray-500">
                      No variants available for this product.
                    </div>
                  );
                }

                return variations.map((variation: any) => {
                  const variationId = String(variation?._id || variation?.id || variation?.variationId || variation?.title || variation?.name);
                  const variantLabel = String(variation?.title || variation?.name || variation?.variationName || 'Variant');
                  const variantProductId = `${variantPickerItem.baseProductId}-${variationId}`;
                  const inPurchase = purchaseItems.some((p) => p.productId === variantProductId);

                  return (
                    <div key={variationId} className="border border-gray-200 rounded-xl p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{variantLabel}</p>
                        <p className="text-xs text-gray-500">
                          MRP: ₹{variation?.compareAtPrice ?? variantPickerItem.mrp} | Price: ₹{variation?.price ?? variantPickerItem.retailPrice} | Qty: {variation?.stock ?? 0}
                        </p>
                      </div>
                      <button
                        onClick={() => addVariantToPurchase(variantPickerItem, variation)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold border ${inPurchase ? 'bg-[#f187b5] text-white border-[#f187b5]' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                      >
                        {inPurchase ? 'Add More' : 'Add'}
                      </button>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* --- QUICK ADD MODAL --- */}
      {showQuickAdd && (
        <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="bg-[#f187b5] px-6 py-4 text-white flex justify-between items-center">
                    <h3 className="font-semibold text-lg">Quick Add Item</h3>
                    <button onClick={() => setShowQuickAdd(false)} className="text-white/80 hover:text-white">✕</button>
                </div>
                <form onSubmit={handleQuickAddSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                        <div className="relative">
                            <input
                               type="text"
                               value={quickForm.barcode} onChange={e => setQuickForm({...quickForm, barcode: e.target.value})}
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-[#f187b5] focus:outline-none"
                               placeholder="Enter or scan barcode"
                            />
                             <button
                                type="button"
                                onClick={() => {
                                    setScanTarget('quick-add');
                                    setShowScanner(true);
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#f187b5]"
                                title="Scan Barcode"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5v2a2 2 0 002 2h2m10 0h2a2 2 0 002-2V5M3 19v-2a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m-6-13h-4m4 4h-4m4 4h-4m4 4h-4"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                        <input
                           type="text" required
                           value={quickForm.name} onChange={e => setQuickForm({...quickForm, name: e.target.value})}
                           className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#f187b5] focus:outline-none"
                           placeholder="Enter item name"
                           // autoFocus // Removed autoFocus to prioritize Barcode if needed, or keep it on Name?
                           // User screenshot shows Barcode first. I'll let user decide focus or default to Name if they want, but typically Barcode is first.
                           // Actually I'll remove autoFocus from Name.
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">MRP (₹)</label>
                            <input
                               type="number" min="0" step="0.01"
                               value={quickForm.mrp} onChange={e => setQuickForm({...quickForm, mrp: e.target.value})}
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#f187b5] focus:outline-none"
                               placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (₹)</label>
                            <input
                               type="number" required min="0" step="0.01"
                               value={quickForm.price} onChange={e => setQuickForm({...quickForm, price: e.target.value})}
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#E91E63] focus:outline-none"
                               placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Wholesale Price (₹)</label>
                            <input
                               type="number" min="0" step="0.01"
                               value={quickForm.wholesalePrice} onChange={e => setQuickForm({...quickForm, wholesalePrice: e.target.value})}
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#f187b5] focus:outline-none"
                               placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price (₹)</label>
                            <input
                               type="number" min="0" step="0.01"
                               value={quickForm.purchasePrice} onChange={e => setQuickForm({...quickForm, purchasePrice: e.target.value})}
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#f187b5] focus:outline-none"
                               placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                            <input
                               type="number" required min="1"
                               value={quickForm.qty} onChange={e => setQuickForm({...quickForm, qty: e.target.value})}
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#f187b5] focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Warranty / Guarantee</label>
                            <select
                                value={quickForm.warrantyType}
                                onChange={e => setQuickForm({...quickForm, warrantyType: e.target.value as any})}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#f187b5] focus:outline-none"
                            >
                                <option value="None">None</option>
                                <option value="Warranty">Warranty</option>
                                <option value="Guarantee">Guarantee</option>
                            </select>
                        </div>
                        {quickForm.warrantyType !== 'None' && (
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">{quickForm.warrantyType} Duration</label>
                                <input
                                    type="text"
                                    value={quickForm.warrantyDuration}
                                    onChange={e => setQuickForm({...quickForm, warrantyDuration: e.target.value})}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#f187b5] focus:outline-none"
                                    placeholder="Enter duration (e.g. 6 Months / 1 Year)"
                                />
                            </div>
                        )}
                    </div>

                     {/* Add to Inventory Checkbox */}
                    <div className="flex items-center p-3 border border-gray-200 rounded-lg bg-gray-50/50">
                        <label className="flex items-center gap-3 cursor-pointer w-full">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${quickForm.addToInventory ? 'bg-[#f187b5] border-[#f187b5]' : 'bg-white border-gray-300'}`}>
                                {quickForm.addToInventory && (
                                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                )}
                            </div>
                            <input
                               type="checkbox"
                               className="hidden"
                               checked={quickForm.addToInventory}
                               onChange={(e) => setQuickForm({...quickForm, addToInventory: e.target.checked})}
                            />
                            <span className="text-sm font-medium text-gray-700">Add to Inventory</span>
                        </label>
                    </div>

                    <button type="submit" className="w-full bg-[#f187b5] hover:bg-[#e076a5] text-white font-medium py-2.5 rounded-lg transition-colors mt-2">
                        Add to Cart
                    </button>
                </form>
            </div>
        </div>
      )}

      {/* --- EDIT ITEM MODAL --- */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="bg-[#f187b5] px-6 py-4 text-white flex justify-between items-center">
                    <h3 className="font-semibold text-lg">Edit Item</h3>
                    <button onClick={() => setEditingItem(null)} className="text-white/80 hover:text-white">✕</button>
                </div>
                <form onSubmit={handleEditItemSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                        <input
                           type="text" required
                           value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})}
                           className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-900 focus:outline-none"
                           placeholder="Enter item name"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">New MRP/Piece</label>
                            <input
                               type="number" min="0" step="0.01"
                               value={editForm.mrp} onChange={e => setEditForm({...editForm, mrp: e.target.value})}
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-900 focus:outline-none"
                               placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">New Price/Piece</label>
                            <input
                               type="number" required min="0" step="0.01"
                               value={editForm.price} onChange={e => setEditForm({...editForm, price: e.target.value})}
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-900 focus:outline-none"
                               placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">New Purchase Price/Piece</label>
                            <input
                               type="number" min="0" step="0.01"
                               value={editForm.purchasePrice} onChange={e => setEditForm({...editForm, purchasePrice: e.target.value})}
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-900 focus:outline-none"
                               placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">New Wholesale Price/Piece</label>
                            <input
                               type="number" min="0" step="0.01"
                               value={editForm.wholesalePrice} onChange={e => setEditForm({...editForm, wholesalePrice: e.target.value})}
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-900 focus:outline-none"
                               placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                            <input
                               type="number" required min="1"
                               value={editForm.qty} onChange={e => setEditForm({...editForm, qty: e.target.value})}
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-900 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Warranty / Guarantee</label>
                            <select
                                value={editForm.warrantyType}
                                onChange={e => setEditForm({...editForm, warrantyType: e.target.value as any})}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-900 focus:outline-none"
                            >
                                <option value="None">None</option>
                                <option value="Warranty">Warranty</option>
                                <option value="Guarantee">Guarantee</option>
                            </select>
                        </div>
                        {editForm.warrantyType !== 'None' && (
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">{editForm.warrantyType} Duration</label>
                                <input
                                    type="text"
                                    value={editForm.warrantyDuration}
                                    onChange={e => setEditForm({...editForm, warrantyDuration: e.target.value})}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-900 focus:outline-none"
                                    placeholder="Enter duration (e.g. 6 Months / 1 Year)"
                                />
                            </div>
                        )}
                    </div>
                     <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="updateInventory"
                            className="rounded border-gray-300 text-blue-900 focus:ring-blue-900 cursor-pointer"
                        />
                        <label htmlFor="updateInventory" className="text-sm text-gray-700 font-medium cursor-pointer">Update product details in inventory</label>
                    </div>
                    <button type="submit" className="w-full bg-[#f187b5] hover:bg-[#e076a5] text-white font-medium py-2.5 rounded-lg transition-colors mt-2">
                        Update Item
                    </button>
                </form>
            </div>
        </div>
      )}

      {/* --- EDIT PURCHASE ITEM MODAL --- */}
      {editingPurchaseItem && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="bg-[#f187b5] px-6 py-4 text-white flex justify-between items-center">
                    <h3 className="font-semibold text-lg">Edit Item</h3>
                    <button onClick={() => setEditingPurchaseItem(null)} className="text-white/80 hover:text-white">✕</button>
                </div>
                <form onSubmit={handlePurchaseEditItemSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                        <input
                           type="text" required
                           value={purchaseEditForm.name} onChange={e => setPurchaseEditForm({...purchaseEditForm, name: e.target.value})}
                           className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#f187b5] focus:outline-none"
                           placeholder="Enter item name"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">New MRP/Piece</label>
                            <input
                               type="number" min="0" step="0.01"
                               value={purchaseEditForm.mrp} onChange={e => setPurchaseEditForm({...purchaseEditForm, mrp: e.target.value})}
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#f187b5] focus:outline-none"
                               placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">New Price/Piece</label>
                            <input
                               type="number" required min="0" step="0.01"
                               value={purchaseEditForm.price} onChange={e => setPurchaseEditForm({...purchaseEditForm, price: e.target.value})}
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#f187b5] focus:outline-none"
                               placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">New Purchase Price/Piece</label>
                            <input
                               type="number" min="0" step="0.01"
                               value={purchaseEditForm.purchasePrice} onChange={e => setPurchaseEditForm({...purchaseEditForm, purchasePrice: e.target.value})}
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#f187b5] focus:outline-none"
                               placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">New Wholesale Price/Piece</label>
                            <input
                               type="number" min="0" step="0.01"
                               value={purchaseEditForm.wholesalePrice} onChange={e => setPurchaseEditForm({...purchaseEditForm, wholesalePrice: e.target.value})}
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#f187b5] focus:outline-none"
                               placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                            <input
                               type="number" required min="1"
                               value={purchaseEditForm.qty} onChange={e => setPurchaseEditForm({...purchaseEditForm, qty: e.target.value})}
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#f187b5] focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Warranty / Guarantee</label>
                            <select
                                value={purchaseEditForm.warrantyType}
                                onChange={e => setPurchaseEditForm({...purchaseEditForm, warrantyType: e.target.value as any})}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#f187b5] focus:outline-none"
                            >
                                <option value="None">None</option>
                                <option value="Warranty">Warranty</option>
                                <option value="Guarantee">Guarantee</option>
                            </select>
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-[#f187b5] hover:bg-[#e076a5] text-white font-medium py-2.5 rounded-lg transition-colors mt-2">
                        Update Item
                    </button>
                </form>
            </div>
        </div>
      )}

      {/* --- PAYMENT MODAL --- */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
                <div className="bg-gray-800 px-6 py-4 text-white flex justify-between items-center">
                    <h3 className="font-semibold text-lg">Select Payment Method</h3>
                    <button onClick={() => setShowPaymentModal(false)} className="text-white/80 hover:text-white">✕</button>
                </div>
                <div className="p-6 space-y-4">
                     <div className="text-center mb-6">
                         <p className="text-gray-500 text-sm mb-1">Total Amount</p>
                         <p className="text-3xl font-bold text-gray-900">₹{calculateTotal()}</p>
                     </div>

                     <div className="space-y-3">
                        <button
                          onClick={() => handlePaymentSelection('Razorpay')}
                          className="w-full group flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all"
                        >
                            <span className="font-semibold text-gray-700 group-hover:text-blue-700">Razorpay</span>
                            <span className="text-gray-300 group-hover:text-blue-500">→</span>
                        </button>

                        <button
                          onClick={() => handlePaymentSelection('Cashfree')}
                          className="w-full group flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all"
                        >
                            <span className="font-semibold text-gray-700 group-hover:text-purple-700">Cashfree</span>
                            <span className="text-gray-300 group-hover:text-purple-500">→</span>
                        </button>

                         <button
                          onClick={() => handlePaymentSelection('Credit')}
                          className="w-full group flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-red-500 hover:bg-red-50 transition-all"
                        >
                            <div className="flex flex-col items-start">
                                <span className="font-semibold text-gray-700 group-hover:text-red-700">Credit (Udhaar)</span>
                                {selectedCustomer && (
                                    <span className="text-xs text-red-500 font-medium">Due: ₹{selectedCustomer.creditBalance?.toLocaleString() || '0'}</span>
                                )}
                            </div>
                            <span className="text-gray-300 group-hover:text-red-500">→</span>
                        </button>

                         <button
                          onClick={() => handlePaymentSelection('Cash')}
                          className="w-full group flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-[#E91E63] hover:bg-[#FCE4EC] transition-all"
                        >
                            <span className="font-semibold text-gray-700 group-hover:text-[#D81B60]">Cash</span>
                            <span className="text-gray-300 group-hover:text-[#E91E63]">→</span>
                        </button>
                     </div>
                </div>
            </div>
        </div>
      )}
      {/* --- SUCCESS / PRINT MODAL --- */}
      {showSuccessModal && lastBillDetails && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
            <div className="bg-[#f3f4f6] w-full max-w-[320px] rounded-[24px] overflow-hidden shadow-2xl relative">
                {/* Header */}
                <div className="bg-[#f3f4f6] px-5 pt-5 pb-2">
                   <div className="flex justify-between items-center mb-4">
                       <h2 className="text-lg font-bold tracking-widest text-slate-800">Geeta Store</h2>
                       <button onClick={() => setShowSuccessModal(false)} className="bg-black text-white px-3 py-1 rounded-full text-[10px] font-bold">Close</button>
                   </div>

                   <div className="flex justify-center mb-4">
                        <div className="bg-[#E91E63] rounded-full p-1.5">
                           <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                       </div>
                   </div>

                   <div className="text-center mb-5">
                       <h3 className="font-bold text-slate-800 tracking-wider mb-1 text-sm">
                           {lastBillDetails.isQuotation ? 'QUOTATION COMPLETED' : (lastBillDetails.isPaid ? 'ORDER COMPLETED' : 'BILL ESTIMATE')}
                       </h3>
                       <p className="text-gray-400 text-[10px]">{new Date().toLocaleString()}</p>
                   </div>

                   <div className="text-center mb-5">
                       <p className="text-gray-500 text-[10px] font-bold tracking-widest mb-1">TOTAL AMOUNT</p>
                       <h1 className="text-4xl font-bold text-slate-900">₹{lastBillDetails.total}</h1>
                       <p className="text-gray-400 text-[10px] mt-1">Bill No: {lastBillDetails.invoiceNum}</p>
                   </div>

                   <div className="flex justify-center mb-2">
                       <button
                         onClick={() => setShowModalBreakdown(!showModalBreakdown)}
                         className="bg-white border border-gray-200 rounded-full px-4 py-1.5 text-[10px] font-bold text-gray-500 tracking-wider shadow-sm hover:bg-gray-50 mb-1"
                       >
                           [ {showModalBreakdown ? 'HIDE BREAKDOWN' : 'TAP FOR BREAKDOWN'} ]
                       </button>
                   </div>

                   {/* Breakdown List */}
                   {showModalBreakdown && (
                     <div className="mb-4 bg-white rounded-xl p-3 shadow-inner text-left max-h-32 overflow-y-auto">
                        <div className="grid grid-cols-4 gap-2 text-[10px] font-bold text-gray-400 mb-2 border-b border-gray-100 pb-1">
                            <div className="col-span-2">Item</div>
                            <div className="text-right">Qty</div>
                            <div className="text-right">Price</div>
                        </div>
                        <div className="space-y-1">
                            {(lastBillDetails?.cart || cart).map((item, idx) => {
                                const sp = getEffectivePrice(item);
                                return (
                                    <div key={idx} className="grid grid-cols-4 gap-2 text-[10px] text-gray-700">
                                        <div className="col-span-2 truncate font-medium">{item.productName}</div>
                                        <div className="text-right text-gray-500">{item.qty}</div>
                                        <div className="text-right font-bold">₹{sp * item.qty}</div>
                                    </div>
                                )
                            })}
                        </div>
                        <div className="border-t border-gray-100 mt-2 pt-2 flex justify-between text-xs font-bold text-slate-800">
                            <span>Total</span>
                            <span>₹{lastBillDetails.total}</span>
                        </div>
                     </div>
                   )}

                   <div className="text-center mb-4">
                        <button className="bg-[#f3f4f6] border border-gray-300 rounded-full px-4 py-1.5 text-[9px] font-bold text-gray-500 tracking-wider shadow-sm uppercase">
                           [ STATUS: {lastBillDetails.isQuotation ? 'QUOTATION' : (lastBillDetails.isPaid ? 'PAID' : 'PENDING')} - {lastBillDetails.paymentMethod || paymentMethod} ]
                       </button>
                   </div>
                </div>

                {/* Footer Actions */}
                <div className="bg-[#f3f4f6] px-4 pb-5 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={downloadPDF} className="bg-white border border-black text-black font-bold py-2 text-[10px] tracking-widest hover:bg-gray-50 uppercase rounded">
                            [ Share ]
                        </button>
                        <button
                            onClick={() => {
                                if (lastBillDetails.isQuotation && lastBillDetails.quotationEntry) {
                                    printPurchaseInvoice(lastBillDetails.quotationEntry);
                                } else {
                                    handlePrintBill();
                                }
                            }}
                            className="bg-black text-white font-bold py-2 text-[10px] tracking-widest hover:bg-gray-900 uppercase rounded"
                        >
                            [ Print ]
                        </button>
                    </div>

                    {!lastBillDetails.isPaid && !lastBillDetails.isQuotation && (
                         <div className="w-full">
                            <button
                                onClick={() => {
                                    setShowSuccessModal(false);
                                    setShowPaymentModal(true);
                                }}
                                className="w-full bg-[#f187b5] text-white font-bold py-3 text-[10px] tracking-widest hover:bg-[#e076a5] uppercase rounded shadow-lg animate-pulse"
                            >
                                [ PROCEED TO PAY ]
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                         <button
                            onClick={() => {
                                if (lastBillDetails.isQuotation && lastBillDetails.quotationEntry) {
                                    setPurchaseItems(lastBillDetails.quotationEntry.items);
                                    setPurchaseSupplier(lastBillDetails.quotationEntry.supplier);
                                    setEditingQuotationId(lastBillDetails.quotationEntry.id);
                                    setShowPurchaseEntry(true);
                                } else if (lastBillDetails?.cart) {
                                    setCart(lastBillDetails.cart);
                                }
                                setShowSuccessModal(false);
                            }}
                            className="bg-white border border-gray-200 text-gray-500 font-bold py-2 text-[10px] tracking-widest uppercase rounded"
                         >
                            [ Edit ]
                        </button>
                        <button
                            onClick={() => {
                                setShowSuccessModal(false);
                                if (lastBillDetails.isQuotation) {
                                    setShowPurchaseEntry(false);
                                    setPurchaseItems([]);
                                    setPurchaseSupplier(null);
                                    setEditingQuotationId(null);
                                }
                            }}
                            className="bg-white border border-gray-200 text-gray-500 font-bold py-2 text-[10px] tracking-widest uppercase rounded"
                        >
                            [ Home ]
                        </button>
                    </div>

                    {(lastBillDetails.isPaid || lastBillDetails.isQuotation) && (
                        <button
                            onClick={() => {
                                if (lastBillDetails.isQuotation) {
                                    setPurchaseItems([]);
                                    setPurchaseSupplier(null);
                                    setEditingQuotationId(null);
                                } else {
                                    createNewBill(true);
                                }
                                setShowSuccessModal(false);
                            }}
                            className="w-full bg-black text-white font-bold py-3 text-[10px] tracking-widest hover:bg-gray-900 uppercase mt-1 rounded"
                        >
                            [ + NEW BILL ]
                        </button>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* --- HIDDEN THERMAL RECEIPT (VISIBLE ONLY ON PRINT) --- */}
      <div className="hidden print:block fixed inset-0 bg-white z-[200] p-0 m-0">
          {/* We use a specific width/style for thermal printing */}
          <div className="w-[80mm] p-2 font-mono text-sm text-black mx-auto font-semibold">
              <div className="mb-2 text-left">
                  <h1 className="text-xl font-bold uppercase">GEETA</h1>
                  <p className="text-xs leading-tight font-medium">Q7WM+92M, Q7WM+92M, , Indore Division,</p>
                  <p className="text-xs leading-tight font-medium">Nagda, Madhya Pradesh, India - 454001</p>
                  <p className="text-xs font-medium">7898111456</p>

                  {/* GST & FSSAI */}
                  {config?.invoiceSettings?.gst?.enabled && config?.invoiceSettings?.gst?.text && (
                      <p className="text-xs font-bold mt-1">GST: {config.invoiceSettings.gst.text}</p>
                  )}
                  {config?.invoiceSettings?.fssai?.enabled && config?.invoiceSettings?.fssai?.text && (
                      <p className="text-xs font-bold">FSSAI: {config.invoiceSettings.fssai.text}</p>
                  )}
              </div>

              <div className="border-b border-black my-2"></div>

              <div className="flex justify-between mb-1">
                  <span>MEMO</span>
                  <span>{lastBillDetails?.time}</span>
              </div>
              <div className="flex justify-between mb-1">
                  <span>{lastBillDetails?.date}</span>
                  <span>Bill No: {lastBillDetails?.invoiceNum}</span>
              </div>

              <div className="border-b border-black border-dashed my-2"></div>

              <div className="grid grid-cols-12 gap-1 font-bold mb-1">
                  <div className="col-span-12">Item Name</div>
                  <div className="col-span-3 text-right text-xs">Qty</div>
                  <div className="col-span-3 text-right text-xs">MRP</div>
                  <div className="col-span-3 text-right text-xs">SP</div>
                  <div className="col-span-3 text-right text-xs">Amt</div>
              </div>

              <div className="border-b border-black border-dashed my-2"></div>

              <div className="space-y-1">
                  {(lastBillDetails?.cart || cart).map((item, idx) => {
                      const sp = getEffectivePrice(item);
                      const mrp = item.compareAtPrice || sp;
                      return (
                       <div key={idx}>
                           <div>{idx + 1}. {item.productName}</div>
                           {(item as any).warrantyType && (item as any).warrantyType !== 'None' && (
                               <div className="text-xs bg-gray-100 px-2 py-0.5 border-l-2 border-black font-bold mt-1 ml-4" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                   {(item as any).warrantyType}: {(item as any).warrantyDuration}
                               </div>
                           )}
                           <div className="grid grid-cols-12 gap-1">
                               <div className="col-span-12"></div> {/* Spacer for name line */}
                               <div className="col-span-3 text-right text-xs">{item.qty}PC</div>
                               <div className="col-span-3 text-right text-xs">{mrp.toFixed(2)}</div>
                               <div className="col-span-3 text-right text-xs">{sp.toFixed(2)}</div>
                               <div className="col-span-3 text-right text-xs">{(sp * item.qty).toFixed(2)}</div>
                           </div>
                       </div>
                   )})}
              </div>

              <div className="border-b border-black border-dashed my-2"></div>

              {(() => {
                  const items = lastBillDetails?.cart || cart;
                  let tQty = 0;
                  let tMRP = 0;
                  items.forEach(item => {
                      tQty += item.qty;
                      const sp = getEffectivePrice(item);
                      const itemMrp = item.compareAtPrice && item.compareAtPrice > sp ? item.compareAtPrice : sp;
                      tMRP += itemMrp * item.qty;
                  });
                  const tBill = lastBillDetails?.total || calculateTotal();
                  const tSavings = tMRP - tBill;
                  const sPercent = tMRP > 0 ? ((tSavings / tMRP) * 100).toFixed(1) : "0";

                  return (
                      <>
                          <div className="flex justify-between font-bold mb-1 text-xs">
                              <span>Total Qty.: {tQty}</span>
                              <span>Total MRP: Rs {tMRP.toFixed(2)}</span>
                          </div>
                          {tSavings > 0 && (
                              <div className="flex justify-between bg-neutral-300 px-1 py-1.5 my-1 border-y border-black border-dashed" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                  <span className="font-bold">You Saved {sPercent} %</span>
                                  <span className="font-bold">{tSavings.toFixed(2)}</span>
                              </div>
                          )}
                      </>
                  );
              })()}

              <div className="flex justify-between font-bold text-lg">
                  <span>Total Payable Amount</span>
                  <span>{lastBillDetails?.total.toFixed(2)}</span>
              </div>
               <div className="flex justify-between mt-1 font-bold">
                  <span>Cash Paid</span>
                  <span>{lastBillDetails?.total.toFixed(2)}</span>
              </div>

              <div className="border-b border-black border-dashed my-2"></div>

              <div className="text-center mt-4 text-xs font-medium">
                  {/* Notes */}
                  {config?.invoiceSettings?.notes?.enabled && config?.invoiceSettings?.notes?.text && (
                      <p className="font-bold mb-2 whitespace-pre-wrap">{config.invoiceSettings.notes.text}</p>
                  )}

                  {/* Terms & Conditions */}
                  {config?.invoiceSettings?.terms?.enabled && config?.invoiceSettings?.terms?.text && (
                      <div className="text-left mt-2 border-t border-black border-dashed pt-2">
                          <p className="font-bold mb-1">Terms & Conditions:</p>
                          <p className="whitespace-pre-wrap leading-tight">{config.invoiceSettings.terms.text}</p>
                      </div>
                  )}


              </div>
          </div>
      </div>

      {/* --- ADD CUSTOMER MODAL --- */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-[#f187b5] px-6 py-4 text-white flex justify-between items-center">
                    <h3 className="text-lg font-bold">Register New Customer</h3>
                    <button onClick={() => setShowAddCustomerModal(false)} className="text-white/80 hover:text-white transition-colors">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <form onSubmit={submitAddCustomer} className="p-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Full Name *</label>
                            <input
                                type="text"
                                required
                                value={newCustomer.name}
                                onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f187b5]/20 focus:border-[#f187b5] transition-all"
                                placeholder="Enter customer name"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Phone Number *</label>
                                <input
                                    type="tel"
                                    required
                                    maxLength={10}
                                    pattern="[0-9]{10}"
                                    value={newCustomer.phone}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, "");
                                        if (val.length <= 10) {
                                            setNewCustomer({...newCustomer, phone: val});
                                        }
                                    }}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-mono"
                                    placeholder="10 digit mobile"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email (Optional)</label>
                                <input
                                    type="email"
                                    value={newCustomer.email}
                                    onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                                    placeholder="customer@email.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Address</label>
                            <textarea
                                value={newCustomer.address}
                                onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all h-20 resize-none"
                                placeholder="Street address, building, etc."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">City</label>
                                <input
                                    type="text"
                                    value={newCustomer.city}
                                    onChange={(e) => setNewCustomer({...newCustomer, city: e.target.value})}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                                    placeholder="City"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Pincode</label>
                                <input
                                    type="text"
                                    value={newCustomer.pincode}
                                    onChange={(e) => setNewCustomer({...newCustomer, pincode: e.target.value})}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                                    placeholder="6 digit PIN"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">GST Number (Optional)</label>
                            <input
                                type="text"
                                value={newCustomer.gst}
                                maxLength={15}
                                onChange={(e) => {
                                    const gstValue = e.target.value
                                      .toUpperCase()
                                      .replace(/[^0-9A-Z]/g, '')
                                      .slice(0, 15);
                                    setNewCustomer({...newCustomer, gst: gstValue});
                                }}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f187b5]/20 focus:border-[#f187b5] transition-all"
                                placeholder="Enter GSTIN"
                            />
                        </div>
                    </div>

                    <div className="mt-8 flex gap-3">
                        <button
                            type="button"
                            onClick={() => setShowAddCustomerModal(false)}
                            className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={newCustomerLoading}
                            className="flex-1 py-3 bg-[#f187b5] text-white rounded-xl font-semibold hover:bg-[#e076a5] transition-all shadow-lg shadow-[#f187b5]/20 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {newCustomerLoading ? (
                              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    Save Customer
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* --- SCANNER MODAL --- */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/80 z-[1100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden relative animate-in zoom-in duration-200">
                <div className="bg-[#f187b5] px-5 py-4 text-white flex justify-between items-center">
                    <h3 className="font-bold text-lg">Scan Barcode</h3>
                    <button
                        onClick={() => setShowScanner(false)}
                        className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                <div className="p-4 bg-black">
                     <div id="reader" className="w-full h-[260px] sm:h-[320px] md:h-[360px] bg-black rounded-xl overflow-hidden shadow-inner"></div>
                     <p className="text-center text-white/60 text-[11px] font-medium mt-4 tracking-wide uppercase">Point camera at a barcode to scan</p>
                </div>
                {/* Removed Restart Scanner footer for compact look */}
            </div>
        </div>
      )}

      {/* --- MOBILE SEARCH MODAL --- */}
      {showMobileSearch && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col md:hidden">
          {/* Header */}
          <div className="bg-[#f187b5] px-4 py-3 flex items-center gap-3 shadow-md">
            <button
              onClick={() => {
                setShowMobileSearch(false);
                setMobileSearchQuery('');
              }}
              className="text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
              </svg>
            </button>
            <input
              type="text"
              value={mobileSearchQuery}
              onChange={(e) => setMobileSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="flex-1 px-4 py-2 rounded-lg border-none outline-none text-gray-800"
              autoFocus
            />
            <button
                onClick={() => {
                    setScanTarget('inventory');
                    setShowScanner(true);
                }}
                className="text-white p-1"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5v2a2 2 0 002 2h2m10 0h2a2 2 0 002-2V5M3 19v-2a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m-6-13h-4m4 4h-4m4 4h-4m4 4h-4"></path>
                </svg>
            </button>
          </div>

          {/* Product List */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f187b5]"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {products
                  .filter(product => {
                    if (!mobileSearchQuery) return true;
                    const query = mobileSearchQuery.toLowerCase();
                    return (
                      product.productName.toLowerCase().includes(query) ||
                      (Array.isArray(product.barcode) ? product.barcode.some((b: string) => String(b).toLowerCase().includes(query)) : (product.barcode && String(product.barcode).toLowerCase().includes(query)))
                    );
                  })
                  .slice(0, 20)
                  .map(product => {
                    const cartItem = cart.find(item => item._id === product._id);
                    const inCart = !!cartItem;

                    return (
                      <div
                        key={product._id}
                        className={`bg-white p-4 rounded-lg border shadow-sm ${
                          product.stock <= 0 ? 'opacity-60 grayscale' : ''
                        }`}
                      >
                        <div className="flex gap-3">
                          {/* Product Image */}
                          <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                            {product.mainImage ? (
                              <img src={product.mainImage} alt="" className="w-full h-full object-contain" />
                            ) : (
                              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                              </svg>
                            )}
                          </div>

                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-800 text-sm line-clamp-2 mb-1">
                              {product.productName}
                            </h4>
                            <div className="flex items-center gap-2 text-xs mb-2">
                              <span className="text-gray-500">
                                MRP: <span className="line-through">₹{product.compareAtPrice || 0}</span>
                              </span>
                              <span className="font-bold text-[#f187b5]">
                                {orderType === 'Wholesale' && (product.wholesalePrice || 0) > 0
                                  ? `WSP: ₹${product.wholesalePrice}`
                                  : `SP: ₹${product.price}`}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">
                              Quantity: {product.stock} Piece
                            </div>
                          </div>

                          {/* Add Button */}
                          <div className="flex items-center">
                            {inCart ? (
                              <div className="flex items-center gap-2 bg-[#f187b5]/10 rounded-lg px-2 py-1">
                                <button
                                  onClick={() => updateQuantity(product._id, -1)}
                                  className="w-7 h-7 flex items-center justify-center bg-white text-[#f187b5] rounded hover:bg-[#f187b5] hover:text-white transition-colors border border-[#f187b5]"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path>
                                  </svg>
                                </button>
                                <span className="font-bold text-[#f187b5] min-w-[20px] text-center">
                                  {cartItem?.qty || 0}
                                </span>
                                <button
                                  onClick={() => updateQuantity(product._id, 1)}
                                  className="w-7 h-7 flex items-center justify-center bg-[#f187b5] text-white rounded hover:bg-[#e076a5] transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  addToCart(product);
                                }}
                                disabled={product.stock <= 0}
                                className="px-4 py-2 bg-[#f187b5] text-white rounded-lg hover:bg-[#e076a5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                              >
                                Add
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {mobileSearchQuery && products.filter(p => {
                  const query = mobileSearchQuery.toLowerCase();
                  return p.productName.toLowerCase().includes(query) || (Array.isArray(p.barcode) ? (p.barcode as string[]).some(b => String(b).toLowerCase().includes(query)) : (p.barcode && String(p.barcode).toLowerCase().includes(query)));
                }).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No products found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default SellerPOSOrders;
