
import { Router } from "express";
import {
    createPOSOrder,
    initiatePOSOnlineOrder,
    verifyPOSPayment,
    getPOSReport,
    getPOSStockLedger,
    getPOSProducts,
    getSellerPurchaseEntries,
    upsertSellerPurchaseEntry,
    deleteSellerPurchaseEntry,
    getSellerBillSettings,
    updateSellerBillSettings,
    getSellerPOSState,
    upsertSellerPOSState,
    getSellerOwnCategories,
    createSellerOwnCategory,
    updateSellerOwnCategory,
    deleteSellerOwnCategory,
    getSellerOwnSubCategories,
    createSellerOwnSubCategory
} from "../modules/seller/controllers/sellerPOSController";
import { updateStockLedgerEntry } from "../modules/admin/controllers/updateStockLedgerController";
import { createCustomer, getAllCustomers, deleteCustomer } from "../modules/admin/controllers/adminCustomerController";
import { authenticate, requireUserType, checkEnabled } from "../middleware/auth";

const router = Router();

router.use(authenticate);
router.use(requireUserType("Seller"));
router.use(checkEnabled);

router.get("/customers", getAllCustomers);
router.post("/customers", createCustomer);
router.delete("/customers/:id", deleteCustomer);
router.post("/orders", createPOSOrder);
router.post("/orders/online", initiatePOSOnlineOrder);
router.post("/orders/verify", verifyPOSPayment);
router.get("/report", getPOSReport);
router.get("/stock-ledger", getPOSStockLedger);
router.put("/stock-ledger/:id", updateStockLedgerEntry);
router.get("/purchase-entries", getSellerPurchaseEntries);
router.post("/purchase-entries", upsertSellerPurchaseEntry);
router.delete("/purchase-entries/:entryId", deleteSellerPurchaseEntry);
router.get("/bill-settings", getSellerBillSettings);
router.put("/bill-settings", updateSellerBillSettings);
router.get("/state", getSellerPOSState);
router.put("/state", upsertSellerPOSState);
router.get("/own-categories", getSellerOwnCategories);
router.post("/own-categories", createSellerOwnCategory);
router.put("/own-categories/:id", updateSellerOwnCategory);
router.delete("/own-categories/:id", deleteSellerOwnCategory);
router.get("/own-subcategories", getSellerOwnSubCategories);
router.post("/own-subcategories", createSellerOwnSubCategory);

// Dedicated POS Product Search (Global/Active Products)
router.get("/products", getPOSProducts);

// POS Credit Routes (Sellers can manage customers)
import * as creditController from "../modules/admin/controllers/adminCreditController";
router.get("/credit/customers", creditController.getCreditCustomers);
router.get("/credit/history/:customerId", creditController.getCustomerHistory);
router.post("/credit/add", creditController.addCredit);
router.post("/credit/payment", creditController.acceptPayment);
router.post("/credit/payment/initiate", creditController.initiateCreditPayment);
router.post("/credit/payment/verify", creditController.verifyCreditPayment);

// ==================== POS Supplier Ledger Routes ====================
import * as sellerSupplierController from "../modules/seller/controllers/sellerSupplierController";
router.get("/suppliers", sellerSupplierController.getAllSuppliers);
router.get("/suppliers/:id", sellerSupplierController.getSupplierById);
router.post("/suppliers", sellerSupplierController.createSupplier);
router.put("/suppliers/:id", sellerSupplierController.updateSupplier);
router.delete("/suppliers/:id", sellerSupplierController.deleteSupplier);
router.post("/suppliers/:id/debt", sellerSupplierController.addDebt);
router.post("/suppliers/:id/pay", sellerSupplierController.paySupplier);


export default router;
