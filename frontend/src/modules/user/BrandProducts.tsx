import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBrandById, Brand } from '../../services/api/brandService';
import { getProducts } from '../../services/api/customerProductService';
import ProductCard from './components/ProductCard';
import IconLoader from '../../components/loaders/IconLoader';

export default function BrandProducts() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      setLoading(true);
      try {
        // Fetch Brand Details
        const brandResponse = await getBrandById(id);
        if (brandResponse.success) {
          setBrand(brandResponse.data);
        }

        // Fetch Products for this brand
        const productsResponse = await getProducts({ brand: id });
        if (productsResponse.success) {
           // Ensure products have proper structure
           const safeProducts = Array.isArray(productsResponse.data) ? productsResponse.data.map((p: any) => ({
            ...p,
            tags: Array.isArray(p.tags) ? p.tags : [],
            nameParts: p.name ? p.name.toLowerCase().split(" ") : [],
          })) : [];
          setProducts(safeProducts);
        }
      } catch (err) {
        console.error("Error fetching brand data:", err);
        setError("Failed to load products");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><IconLoader forceShow /></div>;

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-neutral-100 shadow-sm">
        <div className="px-4 py-3 flex items-center gap-3">
            <button
                onClick={() => navigate(-1)}
                className="w-8 h-8 flex items-center justify-center hover:bg-neutral-50 rounded-full transition-colors"
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
            </button>
            <div className="flex items-center gap-2">
                {brand?.image && (
                    <img src={brand.image} alt="" className="w-8 h-8 object-contain rounded-md border border-neutral-100" />
                )}
                <h1 className="text-lg font-bold text-neutral-800">{brand?.name || 'Brand Products'}</h1>
            </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="p-4">
        {products.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                {products.map((product) => (
                    <ProductCard
                        key={product._id || product.id}
                        product={product}
                        showBadge={true}
                        showStockInfo={false}
                        categoryStyle={true}
                    />
                ))}
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
                <div className="text-4xl mb-4">🛍️</div>
                <p>No products found for this brand.</p>
            </div>
        )}
      </div>
    </div>
  );
}
