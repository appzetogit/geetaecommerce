import { ProductWritePolicy } from "./types";

export const adminProductPolicy: ProductWritePolicy = {
  role: "admin",
  defaultPublish: true,
  allowSellerAssignment: true,
  createInventoryRecord: false,
};

export const sellerProductPolicy = (sellerId: string): ProductWritePolicy => ({
  role: "seller",
  sellerId,
  defaultPublish: false,
  allowSellerAssignment: false,
  createInventoryRecord: false,
});
