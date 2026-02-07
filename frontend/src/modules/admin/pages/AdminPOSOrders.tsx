import React, { useState, useEffect, useRef } from 'react';
import { getProducts, getProductById, getPOSProducts, Product, getSellers, updateProduct, createProduct } from '../../../services/api/admin/adminProductService';
import { createPOSOrder, initiatePOSOnlineOrder, verifyPOSPayment, getOrderById, updateOrderItems } from '../../../services/api/admin/adminOrderService';
import { getAllCustomers, createCustomer, Customer } from '../../../services/api/admin/adminCustomerService';
import { getAppSettings, AppSettings } from '../../../services/api/admin/adminSettingsService';
import { getCategories } from '../../../services/api/categoryService';
import { getBrands } from '../../../services/api/brandService';
import { useToast } from '../../../context/ToastContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { jsPDF } from "jspdf";
import { Html5Qrcode } from "html5-qrcode";

// Interface for Cart Item extending Product
interface CartItem extends Product {
  qty: number;
  customPrice?: number; // For edited selling price
  variationId?: string;
  isVariation?: boolean;
  originalProductId?: string | null;
}

interface Seller {
  _id: string;
  sellerName: string;
  storeName: string;
}

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

const AdminPOSOrders = () => {
   const [searchParams] = useSearchParams();
   const editOrderId = searchParams.get('edit');
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [selectedSeller, setSelectedSeller] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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
    const newBill: Bill = {
      id: newId,
      name: `Bill ${reset ? 1 : bills.length + 1}`,
      cart: [],
      selectedCustomer: null,
      customerSearch: '',
      paymentMethod: 'Cash',
      orderType: 'Retail',
      createdAt: Date.now()
    };

    setBills(prev => {
      const updated = reset ? [newBill] : [...prev, newBill];
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
    let newCart;
    if (typeof action === 'function') {
      newCart = action(activeBill.cart);
    } else {
      newCart = action;
    }
    updateActiveBill({ cart: newCart });
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
          const mappedCart: CartItem[] = (order.items as any[]).map(item => ({
             _id: item.product?._id || item.product, // Handle different population levels
             productName: item.productName || item.product?.productName,
             // If we have custom unitPrice, use it as customPrice
             price: item.unitPrice,
             customPrice: item.unitPrice,
             qty: item.quantity,
             mainImage: item.productImage || item.product?.mainImage,
             originalProductId: item.product?._id || item.product,
             variationId: item.variation,
             isVariation: !!item.variation,
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
          }));

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

  // Quick Add Form
  const [quickForm, setQuickForm] = useState({ name: '', price: '', qty: '1', mrp: '', purchasePrice: '', wholesalePrice: '', categoryId: '', brandId: '', addToInventory: false });
  // Edit Item Form
  const [editForm, setEditForm] = useState({ name: '', price: '', qty: '', mrp: '', purchasePrice: '', wholesalePrice: '' });

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
        const [settingsRes, sellersRes, categoriesRes, brandsRes] = await Promise.all([
            getAppSettings(),
            getSellers(),
            getCategories(),
            getBrands()
        ]);
        if (settingsRes.success) setSettings(settingsRes.data);
        if (sellersRes.success) setSellers(sellersRes.data);
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
  const [lastBillDetails, setLastBillDetails] = useState<{total: number, invoiceNum: string, date: string, time: string, cart: CartItem[], isPaid: boolean} | null>(null);

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
    pincode: ''
  });

  // Scanner State
  const [showScanner, setShowScanner] = useState(false);
  const [scannerKey, setScannerKey] = useState(0); // Force re-render of scanner
  const lastScanRef = useRef({ code: '', time: 0 });

  // Mobile Search Modal State
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');

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

      console.log(`Scan result: ${decodedText}`, decodedResult);

      // Pause scanner briefly?
      // For now, let's process

      try {
          // Play beep
          // const audio = new Audio('/assets/beep.mp3'); audio.play().catch(e=>{});

          // Check if we have the products loaded locally first (optimistic)
          // The 'products' state only has filtered results, so we likely need to fetch specific.
          // However, user might have cleared search so 'products' is empty.
          // We'll fetch from API directly.

          const res = await getProducts({ search: decodedText });
          if (res.success && res.data && res.data.length > 0) {
             const productsFound = res.data;
             // Try to find exact match on Barcode or SKU
             let match = productsFound.find((p: any) =>
               p.barcode === decodedText ||
               p.sku === decodedText
             );

             // If not found in product root, check variations
             let variationMatch: any = null;
             if (!match) {
               for (const p of productsFound) {
                 if (p.variations) {
                   const v = p.variations.find((varItem: any) => varItem.barcode === decodedText || varItem.sku === decodedText);
                   if (v) {
                     match = p;
                     variationMatch = v;
                     break;
                   }
                 }
               }
             }

             if (!match) match = productsFound[0];

             // Prepare Cart Item
             let itemToAdd: any = { ...match };

             if (variationMatch) {
                // Formatting variation as CartItem
                 itemToAdd = {
                     ...itemToAdd,
                     variationId: variationMatch._id,
                     _id: `${itemToAdd._id}-${variationMatch._id}`, // Consistent variation ID
                     isVariation: true
                 };
             } else {
                 itemToAdd.originalProductId = itemToAdd._id;
             }

             addToCart({ ...itemToAdd, qty: 1 } as CartItem);
             showToast(`Added: ${itemToAdd.productName}`, "success");

             // Keep scanner open for faster multiple scanning
             // setShowScanner(false);
          } else {
             showToast(`Product not found: ${decodedText}`, "error");
          }
      } catch (e) {
         console.error("Scan Error", e);
         showToast("Error processing scan", "error");
      }
  };

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    if (showScanner) {
        // Only initialize if the element exists
        const initScanner = async () => {
             await new Promise(r => setTimeout(r, 100)); // Wait for Modal DOM
             if (!document.getElementById('reader')) return;

             html5QrCode = new Html5Qrcode("reader");
             const config = { fps: 10, qrbox: { width: 250, height: 250 } };

             try {
                await html5QrCode.start(
                    { facingMode: "environment" },
                    config,
                    onScanSuccess,
                    (errorMessage) => { /* ignore frame errors */ }
                );
             } catch (err) {
                 console.error("Error starting scanner", err);
                 showToast("Failed to start camera. Ensure permissions are granted.", "error");
                 setShowScanner(false);
             }
        };
        initScanner();
    }

    return () => {
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop().then(() => html5QrCode?.clear()).catch(console.error);
        }
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
                  pincode: ''
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
          seller: !showMobileSearch ? (selectedSeller || undefined) : undefined,
          category: !showMobileSearch ? (selectedCategory || undefined) : undefined,
          brand: !showMobileSearch ? (selectedBrand || undefined) : undefined,
          limit: 1000 // Fetch all for client-side pagination
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
  }, [searchQuery, mobileSearchQuery, selectedSeller, selectedCategory, selectedBrand, showMobileSearch]);

  // Barcode Scanner Handler
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        // Exact match check for Barcode/SKU/ItemCode
        const exactMatch = products.find(p =>
            (p.barcode && p.barcode.toLowerCase() === query) ||
            (p.sku && p.sku.toLowerCase() === query) ||
            ((p as any).itemCode && (p as any).itemCode.toLowerCase() === query)
        );

        if (exactMatch) {
            e.preventDefault();
            addToCart(exactMatch as CartItem);
            setSearchQuery(''); // Clear for next scan
            // showToast("Item added!", "success");
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

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item._id === id) {
        const newQty = Math.max(1, item.qty + delta);
        // Check Stock for non-quick-add items
        if (!item._id.toString().startsWith('quick-') && delta > 0) {
            if (newQty > (item.stock || 0)) {
                showToast("Reached maximum available stock", "error");
                return item;
            }
        }
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  /*
   * Helper to get effective price based on Order Type
   * Retail -> item.price
   * Wholesale -> item.wholesalePrice (if > 0) else item.price
   */
  const getEffectivePrice = (item: CartItem) => {
      // If manually edited (customPrice), prioritize it?
      // User request implies automatic switching.
      // We will allow customPrice to override ONLY if strictly needed,
      // but for "Billing" tab switching, we usually want the standard rate to apply unless specifically locked.
      // However, typical behavior: Custom Price > Mode Price.
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
                price: parseFloat(quickForm.price) || 0,
                compareAtPrice: parseFloat(quickForm.mrp) || 0,
                purchasePrice: parseFloat(quickForm.purchasePrice) || 0,
                wholesalePrice: parseFloat(quickForm.wholesalePrice) || 0,
                stock: parseInt(quickForm.qty) || 0,
                category: quickForm.categoryId,
                brand: quickForm.brandId,
                seller: selectedSeller || undefined, // Will default to Admin Store in backend if undefined
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

    // Quick Add creates a temporary mock product in cart
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
      mainImage: '', // Placeholder
      originalProductId: null,
      addToInventory: quickForm.addToInventory // Store flag
    };

    setCart(prev => [...prev, newItem]);
    setShowQuickAdd(false);
    setQuickForm({
        name: '', price: '', qty: '1', mrp: '',
        purchasePrice: '', wholesalePrice: '',
        categoryId: '', brandId: '', addToInventory: false
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
      wholesalePrice: (item.wholesalePrice || 0).toString()
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
              wholesalePrice: (wholesalePrice || 0).toString()
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

  /*
   * PDF Generation (Kept for 'Share' or background use)
   * Renamed from handleGenerateBill to downloadPDF
   */
  const downloadPDF = () => {
    if (cart.length === 0) return;

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
    const address = "Q7WM+92M, Q7WM+92M, , Indore Division,\nNagda, Madhya Pradesh, India - 454001\n7898111456";
    doc.text(address, 14, 26);

    doc.line(14, 40, 196, 40);

    // --- Invoice Details ---
    doc.setFont("helvetica", "bold");
    doc.text("Invoice Number:", 14, 48);
    doc.text("Invoice Date:", 14, 53);
    doc.text("Payment Status:", 14, 58);

    doc.setFont("helvetica", "normal");
    doc.text(invoiceNum, 196, 48, { align: 'right' });
    doc.text(`${dateStr} ${timeStr}`, 196, 53, { align: 'right' });
    doc.text(paymentMethod, 196, 58, { align: 'right' });

    doc.setLineWidth(0.5);
    doc.line(14, 63, 196, 63);

    // --- Table Header ---
    doc.setFont("helvetica", "bold");
    doc.text("Estimated Bill", 105, 68, { align: 'center' });

    let y = 74;
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

    cart.forEach((item, index) => {
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
        isPaid: isPaid
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
            gateway: method
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
            paymentStatus: "Paid" as const
        };

        const response = await createPOSOrder(orderData);
        if (response.success) {
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
                paymentStatus: "Pending" as const
            };

            const response = await createPOSOrder(orderData);

            if (response.success) {
                showToast(`Credit Order Placed! Balance updated for ${selectedCustomer.name}`, "success");
                setCart([]);
                // Navigate to REAL customer credit page
                navigate(`/admin/pos/customers/${selectedCustomer._id}`);
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
              productId: item.originalProductId || item._id,
              variationId: item.variationId,
              quantity: item.qty,
              unitPrice: getEffectivePrice(item),
              sku: item.sku
          }));

          const res = await updateOrderItems(editOrderId, items);
          if (res.success) {
              showToast("Order updated successfully", "success");
              // Close the edit tab logic handled by navigate usually, but here we can just close current bill
              closeBill(`edit_${editOrderId}`, { stopPropagation: () => {} } as React.MouseEvent);
              navigate('/admin/pos/report');
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

  return (
    <div className="p-4 bg-gray-50 min-h-screen font-sans">
      {/* Header / Breadcrumb */}
      <div className="flex justify-between items-center mb-4">
        <div>
           <h1 className="text-xl font-bold text-gray-800">POS System</h1>
           <div className="text-sm text-gray-500">
            <span className="text-blue-600">Dashboard</span> / POS
           </div>
        </div>

        <div className="flex gap-2">
            <button
              onClick={() => setShowAddCustomerModal(true)}
              className="px-4 py-2 bg-[#f187b5] text-white rounded-lg text-sm font-bold hover:bg-[#e076a5] transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Add Customer
            </button>

            <button
              onClick={() => navigate('/admin/pos/customers')}
              className="px-4 py-2 bg-[#f187b5] text-white border border-[#f187b5] rounded-lg text-sm font-bold hover:bg-[#e076a5] transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Customers (Credit)
            </button>
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* LEFT COLUMN - PRODUCTS (Hidden on Mobile) */}
        <div className="hidden lg:flex lg:col-span-7 flex-col gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col overflow-hidden">

            {/* Top Bar (Filters) - Hidden on Mobile */}
            <div className="p-4 border-b border-gray-100 hidden md:flex flex-col gap-3 bg-white z-10">
                <div className="flex flex-col sm:flex-row gap-3">
                    <select
                      className="border border-gray-300 rounded px-3 py-2 text-sm w-full sm:w-1/3 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={selectedSeller}
                      onChange={(e) => {
                          setSelectedSeller(e.target.value);
                          setCurrentPage(1); // Reset page on seller change
                      }}
                    >
                      <option value="">-- All Sellers --</option>
                      {sellers.map(s => (
                          <option key={s._id} value={s._id}>{s.sellerName} ({s.storeName})</option>
                      ))}
                    </select>

                    <select
                      className="border border-gray-300 rounded px-3 py-2 text-sm w-full sm:w-1/3 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={selectedCategory}
                      onChange={(e) => {
                          setSelectedCategory(e.target.value);
                          setCurrentPage(1);
                      }}
                    >
                      <option value="">-- All Categories --</option>
                      {categories.map(c => (
                          <option key={c._id} value={c._id}>{c.name}</option>
                      ))}
                    </select>

                    <select
                      className="border border-gray-300 rounded px-3 py-2 text-sm w-full sm:w-1/3 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={selectedBrand}
                      onChange={(e) => {
                          setSelectedBrand(e.target.value);
                          setCurrentPage(1);
                      }}
                    >
                      <option value="">-- All Brands --</option>
                      {brands.map(b => (
                          <option key={b._id} value={b._id}>{b.name}</option>
                      ))}
                    </select>
                </div>

                  <div className="hidden md:flex w-full gap-2">
                   <div className="relative flex-1">
                       <input
                       type="text"
                       placeholder="Search by name or barcode"
                       className="border border-gray-300 rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                       onKeyDown={handleSearchKeyDown}
                     />
                     <div className="absolute right-0 top-0 h-full flex items-center pr-2">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                     </div>
                   </div>
                   <button
                     onClick={() => setShowScanner(true)}
                     className="bg-white border border-gray-300 text-gray-700 px-4 rounded flex items-center gap-2 hover:bg-gray-50 transition-colors"
                   >
                     <span>Scan</span>
                     <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                       <path strokeLinecap="round" strokeLinejoin="round" d="M3 5v2a2 2 0 002 2h2m10 0h2a2 2 0 002-2V5M3 19v-2a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m-6-13h-4m4 4h-4m4 4h-4m4 4h-4"/>
                     </svg>
                   </button>
               </div>
            </div>

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30">
               {loading ? (
                   <div className="flex justify-center items-center h-40">
                       <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                   </div>
               ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {products.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(product => (
                           <div
                             key={product._id}
                             onClick={() => addToCart(product)}
                             className={`bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow-md cursor-pointer transition-all flex flex-col items-center text-center group relative ${product.stock <= 0 ? 'opacity-60 grayscale' : ''}`}
                           >
                                <div className="w-16 h-16 bg-gray-100 rounded mb-2 flex items-center justify-center overflow-hidden">
                                    {product.mainImage ? (
                                        <img src={product.mainImage} alt={product.productName} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-xs text-gray-400">IMG</span>
                                    )}
                                </div>
                                <h3 className="text-sm font-medium text-gray-800 line-clamp-2">{product.productName}</h3>
                                <div className="mt-2 text-[#f187b5] font-bold">
                                    ₹{ (orderType === 'Wholesale' && product.wholesalePrice) ? product.wholesalePrice : product.price }
                                    {orderType === 'Wholesale' && product.wholesalePrice && <span className="text-[10px] ml-1 text-gray-400 font-normal">(Wholesale)</span>}
                                </div>
                                <div className={`text-[10px] font-bold mt-1 px-2 py-0.5 rounded-full ${product.stock <= 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                                    Stock: {product.stock}
                                </div>
                                {product.stock <= 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/5 rounded-lg pointer-events-none">
                                        <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded">OUT OF STOCK</span>
                                    </div>
                                )}
                           </div>
                       ))}
                       {products.length === 0 && (
                           <div className="col-span-full py-10 text-center text-gray-400 text-sm">
                               No products found
                           </div>
                       )}
                    </div>
                )}
             </div>

             {/* Pagination */}
             {products.length > itemsPerPage && (
                <div className="p-4 border-t border-gray-100 flex justify-center items-center gap-3 bg-white rounded-b-lg">
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="w-10 h-10 flex items-center justify-center border border-[#f187b5] rounded text-[#f187b5] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f187b5]/10 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                    </button>
                    <button className="w-10 h-10 flex items-center justify-center bg-[#f187b5] text-white rounded font-bold shadow-sm">
                        {currentPage}
                    </button>
                     <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(products.length / itemsPerPage)))}
                        disabled={currentPage === Math.ceil(products.length / itemsPerPage)}
                        className="w-10 h-10 flex items-center justify-center border border-[#f187b5] rounded text-[#f187b5] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f187b5]/10 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>
                </div>
             )}
          </div>
        </div>

        {/* RIGHT COLUMN - CART */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col min-h-[calc(100vh-2rem)] sticky top-4">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-lg">
              <h2 className="text-lg font-semibold text-gray-700">Billing</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-md border border-gray-200 shadow-sm">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Profit Show</span>
                  <button
                    onClick={() => setShowProfit(!showProfit)}
                    className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none ${showProfit ? 'bg-[#f187b5]' : 'bg-gray-300'}`}
                  >
                    <span
                      className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${showProfit ? 'translate-x-4.5' : 'translate-x-1'}`}
                    />
                  </button>
                </div>
                <button
                  onClick={() => setShowQuickAdd(true)}
                  className="bg-[#f187b5] hover:bg-[#e076a5] text-white text-xs px-3 py-1.5 rounded flex items-center gap-1 font-medium transition-colors"
                >
                  + Quick Add
                </button>
              </div>
            </div>

            {/* Bill Tabs */}
            <div className="flex items-center gap-2 px-2 pt-2 overflow-x-auto border-b border-gray-200 bg-gray-50">
              {bills.map(bill => (
                <div
                  key={bill.id}
                  onClick={() => setActiveBillId(bill.id)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-t-lg cursor-pointer border-t border-l border-r transition-all min-w-[100px] justify-between select-none text-xs font-medium
                    ${activeBillId === bill.id
                      ? 'bg-white border-b-transparent text-[#E91E63] relative -mb-[1px] z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.02)]'
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
                className="flex items-center justify-center w-6 h-6 rounded-full bg-[#E91E63]/10 text-[#E91E63] hover:bg-[#E91E63]/20 transition-colors ml-1 flex-shrink-0"
                title="New Bill"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              </button>
            </div>

            <div className="flex-1 flex flex-col">

              {/* Payment Method & Order Type Controls */}
              <div className="px-4 pt-4 pb-2">
                   {/* Payment Method Dropdown */}
                   <div className="relative mb-3">
                       <button
                           onClick={() => setShowPaymentDropdown(!showPaymentDropdown)}
                           className="w-full flex items-center justify-between bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#E91E63]"
                       >
                           <span className="font-medium">{paymentMethod || 'Cash'}</span>
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

                   {/* Retail / Wholesale Toggle */}
                   <div className="bg-gray-100 p-1 rounded-lg flex relative">
                        {/* Sliding Background */}
                        <div
                            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#1e293b] rounded-md transition-all duration-300 ease-in-out shadow-sm ${orderType === 'Wholesale' ? 'left-[calc(50%+2px)]' : 'left-1'}`}
                        ></div>

                        <button
                            onClick={() => setOrderType('Retail')}
                            className={`flex-1 relative z-10 text-center text-sm font-medium py-1.5 transition-colors duration-300 ${orderType === 'Retail' ? 'text-white' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Retail
                        </button>
                        <button
                            onClick={() => setOrderType('Wholesale')}
                            className={`flex-1 relative z-10 text-center text-sm font-medium py-1.5 transition-colors duration-300 ${orderType === 'Wholesale' ? 'text-white' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Wholesale
                        </button>
                   </div>
              </div>

              {/* Customer Selection */}
              <div className="px-4 pb-4 border-b border-gray-100">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Search Customer / Mobile..."
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#E91E63] bg-gray-50 focus:bg-white transition-colors"
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
                    className="bg-[#f187b5] text-white px-3 rounded hover:bg-[#e076a5] transition-colors flex items-center justify-center shadow-sm active:scale-95 transform transition-transform"
                    title="Add New Customer"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                  </button>

                  <button
                    onClick={() => setShowScanner(true)}
                    className="bg-[#f187b5] text-white px-3 rounded hover:bg-[#e076a5] transition-colors flex items-center justify-center shadow-sm active:scale-95 transform transition-transform"
                    title="Scan Product"
                  >
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5v2a2 2 0 002 2h2m10 0h2a2 2 0 002-2V5M3 19v-2a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m-6-13h-4m4 4h-4m4 4h-4m4 4h-4"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Cart Items List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[50vh]">
                  {cart.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400">
                          <svg className="w-12 h-12 mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                          <span className="text-sm">Cart is empty</span>
                      </div>
                  ) : (
                      cart.map((item, index) => {
                          const sp = getEffectivePrice(item);
                          const mrp = item.compareAtPrice || sp; // Default to SP if no MRP
                          const purchasePrice = item.purchasePrice || 0;
                          const profit = sp - purchasePrice;
                          const profitPercent = purchasePrice > 0 ? ((profit / purchasePrice) * 100).toFixed(2) : '0.00';

                          return (
                          <div key={index} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-all mb-3 relative overflow-hidden group">
                              {/* Top Row: Rank, Title, Total */}
                              <div className="flex justify-between items-start mb-2">
                                   <div className="flex items-start gap-2 max-w-[70%]">
                                       <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">#{index + 1}</span>
                                       <h4 className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2">{item.productName}</h4>
                                   </div>
                                   <div className="text-right">
                                       <div className="font-bold text-gray-900 text-base">₹{sp * item.qty}</div>
                                       {mrp > sp && <div className="text-[10px] text-gray-400 line-through">₹{mrp * item.qty}</div>}
                                   </div>
                              </div>

                              {/* Middle Row: Image & Details */}
                              <div className="flex items-center gap-3 mb-3">
                                   <div className="w-12 h-12 flex-shrink-0 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center p-1 overflow-hidden">
                                       {item.mainImage ? (
                                           <img src={item.mainImage} alt="" className="w-full h-full object-contain" />
                                       ) : (
                                           <span className="text-xs text-gray-300">Img</span>
                                       )}
                                   </div>
                                   <div className="flex-1">
                                       <div className="flex items-center gap-2 text-xs mb-1">
                                           <span className="text-gray-500">MRP: <span className="line-through decoration-gray-400">₹{mrp}</span></span>
                                           <span className="font-bold text-[#f187b5]">
                                               {orderType === 'Wholesale' && (item.wholesalePrice || 0) > 0 ? 'WSP' : 'SP'}: ₹{sp}
                                           </span>
                                       </div>
                                       {showProfit && (
                                           purchasePrice > 0 ? (
                                               <div className={`text-xs font-medium ${parseFloat(profitPercent) >= 0 ? 'text-[#f187b5]' : 'text-red-500'}`}>
                                                   Profit: {profitPercent}%
                                               </div>
                                           ) : (
                                              <div className="text-xs text-gray-400">Profit: -</div>
                                           )
                                       )}
                                   </div>
                              </div>

                              {/* Bottom Row: Actions */}
                              <div className="flex items-center justify-between gap-2">
                                   <div className="flex items-center gap-2">
                                       <button
                                          onClick={() => removeFromCart(item._id)}
                                          className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors border border-red-100"
                                          title="Remove"
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

                                   {/* Quantity Control matches image: [-] [ Input ] [+] */}
                                   <div className="flex items-center bg-gray-50 rounded-lg p-0.5 border border-gray-200">
                                        <button
                                          onClick={() => updateQuantity(item._id, -1)}
                                          className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-white hover:shadow-sm rounded transition-all font-bold"
                                        >−</button>
                                        <div className="w-8 flex items-center justify-center text-sm font-bold text-gray-800">
                                            {item.qty}
                                        </div>

                                        <button
                                          onClick={() => updateQuantity(item._id, 1)}
                                          className="w-7 h-7 flex items-center justify-center text-[#f187b5] hover:bg-white hover:shadow-sm rounded transition-all font-bold"
                                        >+</button>
                                   </div>
                              </div>
                          </div>
                      )})
                  )}
              </div>

              {/* Footer Summary */}
              <div className="bg-gray-50 p-4 border-t border-gray-200">
                  <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm text-gray-600">
                          <span>Subtotal</span>
                          <span>₹{calculateTotal()}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold text-gray-900 border-t border-gray-200 pt-2">
                          <span>Total</span>
                          <span>₹{calculateTotal()}</span>
                      </div>
                  </div>

                  <div className="space-y-3">

                      {!activeBillId.startsWith('edit_') && (
                        <button
                          onClick={handleGenerateBill}
                          disabled={cart.length === 0}
                          className="w-full bg-[#f187b5] hover:bg-[#e076a5] text-white font-bold py-3 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                           Generate Bill
                        </button>
                      )}



                      <button
                        onClick={activeBillId.startsWith('edit_') ? handleUpdateOrder : handleAccessPayment}
                        disabled={loading}
                        className={`w-full ${activeBillId.startsWith('edit_') ? 'bg-[#E91E63] hover:bg-[#D81B60]' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold py-3 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                      >
                         {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                                <span>{activeBillId.startsWith('edit_') ? 'Updating...' : 'Processing...'}</span>
                            </>
                         ) : (
                            <>
                                <span>{activeBillId.startsWith('edit_') ? 'Update Order' : 'Access Payment'}</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={activeBillId.startsWith('edit_') ? "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" : "M14 5l7 7m0 0l-7 7m7-7H3"}></path></svg>
                            </>
                         )}
                      </button>
                  </div>

                  {/* Mobile Search and Scan Buttons - Only visible on mobile */}
                  <div className="md:hidden flex gap-2 mt-4">
                    <button
                      onClick={() => setShowMobileSearch(true)}
                      className="flex-[2] bg-white border border-gray-200 text-gray-700 px-3 py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-all shadow-sm active:scale-[0.98]"
                    >
                      <svg className="w-5 h-5 text-[#E91E63]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                      </svg>
                      <span className="font-semibold text-sm whitespace-nowrap">Search Items</span>
                    </button>
                    <button
                      onClick={() => setShowScanner(true)}
                      className="flex-1 bg-white border border-gray-200 text-gray-700 px-3 py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-all shadow-sm active:scale-[0.98]"
                    >
                      <span className="font-semibold text-sm">Scan</span>
                      <svg className="w-5 h-5 text-[#E91E63]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5v2a2 2 0 002 2h2m10 0h2a2 2 0 002-2V5M3 19v-2a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m-6-13h-4m4 4h-4m4 4h-4m4 4h-4"/>
                      </svg>
                    </button>
                  </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- QUICK ADD MODAL --- */}
      {showQuickAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="bg-[#E91E63] px-6 py-4 text-white flex justify-between items-center">
                    <h3 className="font-semibold text-lg">Quick Add Item</h3>
                    <button onClick={() => setShowQuickAdd(false)} className="text-white/80 hover:text-white">✕</button>
                </div>
                <form onSubmit={handleQuickAddSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                        <input
                           type="text" required
                           value={quickForm.name} onChange={e => setQuickForm({...quickForm, name: e.target.value})}
                           className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#E91E63] focus:outline-none"
                           placeholder="Enter item name"
                           autoFocus
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">MRP (₹)</label>
                            <input
                               type="number" min="0" step="0.01"
                               value={quickForm.mrp} onChange={e => setQuickForm({...quickForm, mrp: e.target.value})}
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#E91E63] focus:outline-none"
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
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#E91E63] focus:outline-none"
                               placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price (₹)</label>
                            <input
                               type="number" min="0" step="0.01"
                               value={quickForm.purchasePrice} onChange={e => setQuickForm({...quickForm, purchasePrice: e.target.value})}
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#E91E63] focus:outline-none"
                               placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                            <input
                               type="number" required min="1"
                               value={quickForm.qty} onChange={e => setQuickForm({...quickForm, qty: e.target.value})}
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#E91E63] focus:outline-none"
                            />
                        </div>
                    </div>

                     {/* Add to Inventory Checkbox */}
                    <div className="flex items-center p-3 border border-gray-200 rounded-lg bg-gray-50/50">
                        <label className="flex items-center gap-3 cursor-pointer w-full">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${quickForm.addToInventory ? 'bg-[#1e293b] border-[#1e293b]' : 'bg-white border-gray-300'}`}>
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

                    <button type="submit" className="w-full bg-[#E91E63] hover:bg-[#D81B60] text-white font-medium py-2.5 rounded-lg transition-colors mt-2">
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
                <div className="bg-[#1e293b] px-6 py-4 text-white flex justify-between items-center">
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
                    </div>
                     <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="updateInventory"
                            className="rounded border-gray-300 text-blue-900 focus:ring-blue-900 cursor-pointer"
                        />
                        <label htmlFor="updateInventory" className="text-sm text-gray-700 font-medium cursor-pointer">Update product details in inventory</label>
                    </div>
                    <button type="submit" className="w-full bg-[#1e293b] hover:bg-slate-800 text-white font-medium py-2.5 rounded-lg transition-colors mt-2">
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
                          className="w-full group flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-[#f187b5] hover:bg-pink-50 transition-all"
                        >
                            <span className="font-semibold text-gray-700 group-hover:text-[#e076a5]">Cash</span>
                            <span className="text-gray-300 group-hover:text-[#f187b5]">→</span>
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
                           {lastBillDetails.isPaid ? 'ORDER COMPLETED' : 'BILL ESTIMATE'}
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
                           [ STATUS: {lastBillDetails.isPaid ? 'PAID' : 'PENDING'} - {paymentMethod} ]
                       </button>
                   </div>
                </div>

                {/* Footer Actions */}
                <div className="bg-[#f3f4f6] px-4 pb-5 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={downloadPDF} className="bg-white border border-black text-black font-bold py-2 text-[10px] tracking-widest hover:bg-gray-50 uppercase rounded">
                            [ Share ]
                        </button>
                        <button onClick={handlePrintBill} className="bg-black text-white font-bold py-2 text-[10px] tracking-widest hover:bg-gray-900 uppercase rounded">
                            [ Print ]
                        </button>
                    </div>

                    {!lastBillDetails.isPaid && (
                         <div className="w-full">
                            <button
                                onClick={() => {
                                    setShowSuccessModal(false);
                                    setShowPaymentModal(true);
                                }}
                                className="w-full bg-[#E91E63] text-white font-bold py-3 text-[10px] tracking-widest hover:bg-[#D81B60] uppercase rounded shadow-lg animate-pulse"
                            >
                                [ PROCEED TO PAY ]
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                         <button onClick={() => setShowSuccessModal(false)} className="bg-white border border-gray-200 text-gray-500 font-bold py-2 text-[10px] tracking-widest uppercase rounded">
                            [ Edit ]
                        </button>
                        <button onClick={() => setShowSuccessModal(false)} className="bg-white border border-gray-200 text-gray-500 font-bold py-2 text-[10px] tracking-widest uppercase rounded">
                            [ Home ]
                        </button>
                    </div>

                    {lastBillDetails.isPaid && (
                        <button onClick={() => { createNewBill(true); setShowSuccessModal(false); }} className="w-full bg-black text-white font-bold py-3 text-[10px] tracking-widest hover:bg-gray-900 uppercase mt-1 rounded">
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
          <div className="w-[80mm] p-2 font-mono text-xs text-black mx-auto">
              <div className="mb-2 text-left">
                  <h1 className="text-sm font-bold uppercase">GEETA</h1>
                  <p className="text-[10px] leading-tight">Q7WM+92M, Q7WM+92M, , Indore Division,</p>
                  <p className="text-[10px] leading-tight">Nagda, Madhya Pradesh, India - 454001</p>
                  <p className="text-[10px]">7898111456</p>
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
                  <div className="col-span-3 text-right">Qty</div>
                  <div className="col-span-3 text-right">MRP</div>
                  <div className="col-span-3 text-right">SP</div>
                  <div className="col-span-3 text-right">Amt</div>
              </div>

              <div className="border-b border-black border-dashed my-2"></div>

              <div className="space-y-1">
                  {(lastBillDetails?.cart || cart).map((item, idx) => {
                      const sp = getEffectivePrice(item);
                      const mrp = item.compareAtPrice || sp;
                      return (
                       <div key={idx}>
                           <div>{idx + 1}. {item.productName}</div>
                           <div className="grid grid-cols-12 gap-1">
                               <div className="col-span-12"></div> {/* Spacer for name line */}
                               <div className="col-span-3 text-right">{item.qty}PC</div>
                               <div className="col-span-3 text-right">{mrp.toFixed(2)}</div>
                               <div className="col-span-3 text-right">{sp.toFixed(2)}</div>
                               <div className="col-span-3 text-right">{(sp * item.qty).toFixed(2)}</div>
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
                          <div className="flex justify-between font-bold mb-1">
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

              <div className="flex justify-between font-bold text-sm">
                  <span>Total Payable Amount</span>
                  <span>{lastBillDetails?.total.toFixed(2)}</span>
              </div>
               <div className="flex justify-between mt-1">
                  <span>Cash Paid</span>
                  <span>{lastBillDetails?.total.toFixed(2)}</span>
              </div>

              <div className="border-b border-black border-dashed my-2"></div>

              <div className="text-center mt-4">
                  <p>Thank You. Come Again!</p>
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
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden relative">
                <div className="bg-gray-800 px-4 py-3 text-white flex justify-between items-center">
                    <h3 className="font-semibold">Scan Barcode</h3>
                    <button onClick={() => setShowScanner(false)} className="text-white/80 hover:text-white">✕</button>
                </div>
                <div className="p-4 bg-black">
                     <div id="reader" className="w-full h-64 bg-black rounded overflow-hidden"></div>
                     <p className="text-center text-gray-400 text-xs mt-2">Point camera at a barcode</p>
                </div>
                <div className="p-4 bg-white flex justify-center">
                    <button
                         onClick={() => setScannerKey(prev => prev + 1)}
                         className="text-sm text-blue-600 hover:underline"
                    >
                        Restart Scanner
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- MOBILE SEARCH MODAL --- */}
      {showMobileSearch && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col md:hidden">
          {/* Header */}
          <div className="bg-[#E91E63] px-4 py-3 flex items-center gap-3 shadow-md">
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
          </div>

          {/* Product List */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E91E63]"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {products
                  .filter(product => {
                    if (!mobileSearchQuery) return true;
                    const query = mobileSearchQuery.toLowerCase();
                    return (
                      product.productName.toLowerCase().includes(query) ||
                      (product.barcode && product.barcode.toLowerCase().includes(query))
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
                              <div className="flex items-center gap-2 bg-[#E91E63]/10 rounded-lg px-2 py-1">
                                <button
                                  onClick={() => updateQuantity(product._id, -1)}
                                  className="w-7 h-7 flex items-center justify-center bg-white text-[#E91E63] rounded hover:bg-[#E91E63] hover:text-white transition-colors border border-[#E91E63]"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path>
                                  </svg>
                                </button>
                                <span className="font-bold text-[#E91E63] min-w-[20px] text-center">
                                  {cartItem?.qty || 0}
                                </span>
                                <button
                                  onClick={() => updateQuantity(product._id, 1)}
                                  className="w-7 h-7 flex items-center justify-center bg-[#E91E63] text-white rounded hover:bg-[#D81B60] transition-colors"
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
                                className="px-4 py-2 bg-[#E91E63] text-white rounded-lg hover:bg-[#D81B60] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
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
                  return p.productName.toLowerCase().includes(query) || (p.barcode && p.barcode.toLowerCase().includes(query));
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

export default AdminPOSOrders;
