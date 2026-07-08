import { useParams } from "react-router-dom";
import ProductFormPage from "../../shared/product-form/ProductFormPage";
import {
  createProductAdmin,
  updateProductAdmin,
  getProductAdmin,
} from "../../../services/api/product/productApi";

export default function AdminAddProduct() {
  const { id } = useParams();

  return (
    <ProductFormPage
      productId={id}
      config={{
        role: "admin",
        defaultPublish: "Yes",
        showSellerPicker: false,
        createProduct: createProductAdmin,
        updateProduct: updateProductAdmin,
        getProduct: getProductAdmin,
      }}
    />
  );
}
