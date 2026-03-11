
import { Router } from "express";
import {
    createPOSOrder,
    initiatePOSOnlineOrder,
    verifyPOSPayment,
    getPOSReport,
    getPOSStockLedger,
    getPOSProducts
} from "../modules/seller/controllers/sellerPOSController";
import { updateStockLedgerEntry } from "../modules/admin/controllers/updateStockLedgerController";
import { createCustomer, getAllCustomers } from "../modules/admin/controllers/adminCustomerController";
import { authenticate, requireUserType, checkEnabled } from "../middleware/auth";

const router = Router();

router.use(authenticate);
router.use(requireUserType("Seller"));
router.use(checkEnabled);

router.get("/customers", getAllCustomers);
router.post("/customers", createCustomer);
router.post("/orders", createPOSOrder);
router.post("/orders/online", initiatePOSOnlineOrder);
router.post("/orders/verify", verifyPOSPayment);
router.get("/report", getPOSReport);
router.get("/stock-ledger", getPOSStockLedger);
router.put("/stock-ledger/:id", updateStockLedgerEntry);

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
