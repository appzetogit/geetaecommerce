import { useParams } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import ProductFormPage from "../../shared/product-form/ProductFormPage";
import {
  createProductSeller,
  updateProductSeller,
  getProductSeller,
} from "../../../services/api/product/productApi";

export default function SellerAddProduct() {
  const { id } = useParams();
  const { user } = useAuth();

  return (
    <ProductFormPage
      productId={id}
      config={{
        role: "seller",
        defaultPublish: "No",
        submitDisabled: user?.isEnabled === false,
        createProduct: createProductSeller,
        updateProduct: updateProductSeller,
        getProduct: getProductSeller,
      }}
    />
  );
}
