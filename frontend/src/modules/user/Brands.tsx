import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBrands, Brand } from '../../services/api/brandService';
import IconLoader from '../../components/loaders/IconLoader';

export default function Brands() {
  const navigate = useNavigate();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        setLoading(true);
        const response = await getBrands();
        if (response.success) {
          setBrands(response.data);
        } else {
          setError('Failed to load brands');
        }
      } catch (err) {
        console.error('Error fetching brands:', err);
        setError('Failed to load brands');
      } finally {
        setLoading(false);
      }
    };

    fetchBrands();
  }, []);

  // Function to generate deterministic pastel color based on string
  const getBackgroundColor = (name: string) => {
    const colors = [
      'bg-red-50', 'bg-orange-50', 'bg-amber-50', 'bg-yellow-50',
      'bg-lime-50', 'bg-green-50', 'bg-emerald-50', 'bg-teal-50',
      'bg-cyan-50', 'bg-sky-50', 'bg-blue-50', 'bg-indigo-50',
      'bg-violet-50', 'bg-purple-50', 'bg-fuchsia-50', 'bg-pink-50',
      'bg-rose-50'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  if (loading) {
     // Rely on the global loader if strictly needed, but let's show a local one for better UX if used as a page
     return <div className="min-h-screen flex items-center justify-center"><IconLoader forceShow /></div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
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
            <h1 className="text-lg font-bold text-neutral-800">Shop by Brand</h1>
        </div>
      </div>

      {/* Brands Grid */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {brands.map((brand) => (
          <div
            key={brand._id}
            onClick={() => navigate(`/brand/${brand._id}`)}
            className={`
              aspect-[3/4] rounded-xl overflow-hidden cursor-pointer
              transition-transform hover:scale-[1.02] active:scale-95
              flex flex-col shadow-sm border border-neutral-100
            `}
          >
            {/* Top Section - Logo/Name */}
            <div className={`flex-1 ${getBackgroundColor(brand.name)} flex flex-col items-center justify-center p-4 relative`}>
                 {/* Decorative cloud-like shape (CSS simulation) could be complex, sticking to simple clean design */}

                 {/* Brand Name (Top) */}
                 <div className="absolute top-2 left-0 right-0 text-center px-2">
                     <span className="text-xs sm:text-sm font-bold text-neutral-700 uppercase tracking-wide bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm">
                        {brand.name}
                     </span>
                 </div>

                 {/* Main Image (Logo/Product) */}
                 <div className="w-full h-full flex items-center justify-center p-2 mt-4">
                    {brand.image ? (
                        <img
                            src={brand.image}
                            alt={brand.name}
                            className="max-w-full max-h-full object-contain drop-shadow-md"
                        />
                    ) : (
                        <div className="text-4xl font-bold text-neutral-300 select-none">
                            {brand.name.charAt(0)}
                        </div>
                    )}
                 </div>
            </div>
          </div>
        ))}
      </div>

      {brands.length === 0 && (
          <div className="text-center py-12 text-neutral-500">
              No brands found.
          </div>
      )}
    </div>
  );
}
