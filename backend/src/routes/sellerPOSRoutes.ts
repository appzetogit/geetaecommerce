
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
import { authenticate, requireUserType, checkEnabled } from "../middleware/auth";

const router = Router();

router.use(authenticate);
router.use(requireUserType("Seller"));
router.use(checkEnabled);

router.post("/orders", createPOSOrder);
router.post("/orders/online", initiatePOSOnlineOrder);
router.post("/orders/verify", verifyPOSPayment);
router.get("/report", getPOSReport);
router.get("/stock-ledger", getPOSStockLedger);
router.put("/stock-ledger/:id", updateStockLedgerEntry);

// Dedicated POS Product Search (Global/Active Products)
router.get("/products", getPOSProducts);

export default router;
