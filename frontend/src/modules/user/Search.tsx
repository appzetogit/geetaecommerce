import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search as SearchIcon,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import ProductCard from "./components/ProductCard";
import {
  getSemanticSuggestions,
  getSmartRecommendations,
  getTrendingSearches,
  semanticSearch,
  SearchProduct,
  SearchSuggestion,
  trackSearchClick,
} from "../../services/api/searchService";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useLocation } from "../../hooks/useLocation";

type SortOption = "relevance" | "price_asc" | "price_desc" | "popular";

const sortLabels: Record<SortOption, string> = {
  relevance: "Relevance",
  price_asc: "Price low",
  price_desc: "Price high",
  popular: "Popular",
};

export default function Search() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { location } = useLocation();
  const initialQuery = searchParams.get("q") || "";
  const [inputValue, setInputValue] = useState(initialQuery);
  const [results, setResults] = useState<SearchProduct[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [popularSearches, setPopularSearches] = useState<string[]>([]);
  const [zeroResultSearches, setZeroResultSearches] = useState<string[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<SearchProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(Number(searchParams.get("page") || 1));
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [sort, setSort] = useState<SortOption>((searchParams.get("sort") as SortOption) || "relevance");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") || "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [selectedQuery, setSelectedQuery] = useState(initialQuery);
  const debouncedQuery = useDebouncedValue(inputValue, 300);
  const debouncedMinPrice = useDebouncedValue(minPrice, 300);
  const debouncedMaxPrice = useDebouncedValue(maxPrice, 300);
  const activeQuery = selectedQuery || debouncedQuery;
  const suggestionBoxRef = useRef<HTMLDivElement>(null);
  const inputValueRef = useRef(inputValue);
  const limit = 20;

  useEffect(() => {
    inputValueRef.current = inputValue;
  }, [inputValue]);

  useEffect(() => {
    const query = searchParams.get("q") || "";
    setInputValue(query);
    setSelectedQuery(query);
    setPage(Number(searchParams.get("page") || 1));
    setSort((searchParams.get("sort") as SortOption) || "relevance");
    setMinPrice(searchParams.get("minPrice") || "");
    setMaxPrice(searchParams.get("maxPrice") || "");
  }, [searchParams]);

  useEffect(() => {
    const controller = new AbortController();

    getTrendingSearches(10, controller.signal)
      .then((response) => {
        if (!response.success) return;
        setPopularSearches(response.data.popular.map((item) => item.query));
        setZeroResultSearches(response.data.zeroResults.map((item) => item.query));
      })
      .catch((err) => {
        if (err.name !== "CanceledError" && err.name !== "AbortError") {
          console.error("Failed to load trending searches", err);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getSmartRecommendations(
      {
        limit: 10,
        latitude: location?.latitude,
        longitude: location?.longitude,
      },
      controller.signal
    )
      .then((response) => {
        if (response.success) setRecommendedProducts(response.data || []);
      })
      .catch((err) => {
        if (err.name !== "CanceledError" && err.name !== "AbortError") {
          console.error("Failed to load recommendations", err);
        }
      });

    return () => controller.abort();
  }, [location?.latitude, location?.longitude]);

  useEffect(() => {
    const query = debouncedQuery.trim();
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    setSuggestionsLoading(true);

    getSemanticSuggestions(query, controller.signal)
      .then((response) => {
        if (response.success) {
          setSuggestions(response.data);
          setShowSuggestions(true);
          setActiveSuggestionIndex(-1);
        }
      })
      .catch((err) => {
        if (err.name !== "CanceledError" && err.name !== "AbortError") {
          console.error("Failed to load suggestions", err);
        }
      })
      .finally(() => setSuggestionsLoading(false));

    return () => controller.abort();
  }, [debouncedQuery]);

  useEffect(() => {
    const query = activeQuery.trim();

    if (!query || !inputValueRef.current.trim()) {
      setResults([]);
      setTotalPages(0);
      setTotalResults(0);
      setError(null);
      setSearchParams(prev => {
        if (prev.has("q")) {
          const next = new URLSearchParams(prev);
          next.delete("q");
          return next;
        }
        return prev;
      }, { replace: true });
      return;
    }

    const params: Record<string, string> = { q: query };
    if (page > 1) params.page = String(page);
    if (sort !== "relevance") params.sort = sort;
    if (debouncedMinPrice) params.minPrice = debouncedMinPrice;
    if (debouncedMaxPrice) params.maxPrice = debouncedMaxPrice;
    setSearchParams(params, { replace: true });

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    semanticSearch(
      {
        q: query,
        page,
        limit,
        sort,
        minPrice: debouncedMinPrice ? Number(debouncedMinPrice) : undefined,
        maxPrice: debouncedMaxPrice ? Number(debouncedMaxPrice) : undefined,
        latitude: location?.latitude,
        longitude: location?.longitude,
      },
      controller.signal
    )
      .then((response) => {
        setResults(response.data || []);
        setTotalPages(response.pagination?.pages || 0);
        setTotalResults(response.pagination?.total || 0);
      })
      .catch((err) => {
        if (err.name === "CanceledError" || err.name === "AbortError") return;
        console.error("Search failed", err);
        setResults([]);
        setTotalPages(0);
        setTotalResults(0);
        setError("Search failed. Please try again.");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [
    activeQuery,
    page,
    sort,
    debouncedMinPrice,
    debouncedMaxPrice,
    location?.latitude,
    location?.longitude,
    setSearchParams,
  ]);

  useEffect(() => {
    setPage(1);
  }, [activeQuery, sort, debouncedMinPrice, debouncedMaxPrice]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionBoxRef.current && !suggestionBoxRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const chips = useMemo(() => {
    const fallback = ["atta", "milk", "dal", "rice", "oil", "snacks", "bread", "eggs"];
    return popularSearches.length ? popularSearches.slice(0, 10) : fallback;
  }, [popularSearches]);

  const applySearch = (query: string) => {
    const nextQuery = query.trim();
    setInputValue(nextQuery);
    setSelectedQuery(nextQuery);
    setPage(1);
    setShowSuggestions(false);
    setSearchParams(nextQuery ? { q: nextQuery } : {}, { replace: false });
  };

  const handleSuggestionClick = (item: SearchSuggestion) => {
    setShowSuggestions(false);
    if (item.type === "product") {
      if (inputValue.trim()) {
        trackSearchClick(inputValue.trim(), String(item.id)).catch(() => undefined);
      }
      navigate(`/product/${item.id}`);
      return;
    }
    if (item.type === "category") {
      navigate(`/category/${item.id}`);
      return;
    }
    applySearch(item.name);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (event.key === "Enter") applySearch(inputValue);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((index) => (index + 1) % suggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const selected = suggestions[activeSuggestionIndex];
      selected ? handleSuggestionClick(selected) : applySearch(inputValue);
      return;
    }

    if (event.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const clearSearch = () => {
    setInputValue("");
    setSelectedQuery("");
    setResults([]);
    setSuggestions([]);
    setPage(1);
    setSearchParams({});
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-24 md:pb-8">
      <div className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 md:px-6">
          <div ref={suggestionBoxRef} className="relative">
            <div className="flex h-12 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 shadow-sm">
              <SearchIcon className="h-5 w-5 text-neutral-500" aria-hidden="true" />
              <input
                value={inputValue}
                onChange={(event) => {
                  setInputValue(event.target.value);
                  setSelectedQuery("");
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={handleKeyDown}
                placeholder="Search for atta, dal, coke and more"
                className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-neutral-900 outline-none placeholder:text-neutral-400 md:text-base"
                aria-label="Search products"
              />
              {suggestionsLoading && <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />}
              {inputValue && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-14 z-50 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl">
                {suggestions.map((item, index) => (
                  <button
                    key={`${item.type}-${item.id}-${item.name}`}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSuggestionClick(item)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                      activeSuggestionIndex === index ? "bg-neutral-100" : "hover:bg-neutral-50"
                    }`}
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-500">
                      {item.image ? (
                        <img src={item.image} alt="" className="h-full w-full rounded-md object-contain" />
                      ) : item.type === "trending" ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <SearchIcon className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-neutral-900">{item.name}</p>
                      <p className="text-xs capitalize text-neutral-500">{item.categoryName || item.type}</p>
                    </div>
                    {item.price !== undefined && (
                      <span className="text-sm font-bold text-[var(--customer-primary)]">
                        Rs {Number(item.price).toLocaleString("en-IN")}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-6">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => applySearch(chip)}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 shadow-sm hover:border-[var(--customer-primary)] hover:text-[var(--customer-primary)]"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              {chip}
            </button>
          ))}
        </div>

        <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
              <Sparkles className="h-4 w-4 text-[var(--customer-primary)]" />
              {activeQuery.trim()
                ? `${totalResults.toLocaleString("en-IN")} results for "${activeQuery.trim()}"`
                : "Trending searches"}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-neutral-200 px-2 py-1.5">
                <SlidersHorizontal className="h-4 w-4 text-neutral-500" />
                <input
                  value={minPrice}
                  onChange={(event) => setMinPrice(event.target.value.replace(/[^\d]/g, ""))}
                  placeholder="Min"
                  className="w-16 text-xs outline-none"
                  inputMode="numeric"
                  aria-label="Minimum price"
                />
                <span className="text-neutral-300">-</span>
                <input
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(event.target.value.replace(/[^\d]/g, ""))}
                  placeholder="Max"
                  className="w-16 text-xs outline-none"
                  inputMode="numeric"
                  aria-label="Maximum price"
                />
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-neutral-200 px-2 py-1.5">
                <ArrowDownUp className="h-4 w-4 text-neutral-500" />
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortOption)}
                  className="bg-white text-xs font-semibold text-neutral-700 outline-none"
                  aria-label="Sort results"
                >
                  {Object.entries(sortLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-9 w-9 animate-spin text-[var(--customer-primary)]" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-100 bg-white px-4 py-12 text-center text-sm font-medium text-red-600">
            {error}
          </div>
        ) : debouncedQuery.trim() && results.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {results.map((product) => (
                <div key={product.id || product._id} className="relative">
                  {product.searchScore && (
                    <div className="absolute right-2 top-2 z-20 rounded-full bg-white/95 px-2 py-1 text-[10px] font-black text-[var(--customer-primary)] shadow-sm">
                      {Math.round(product.searchScore.finalScore * 100)}%
                    </div>
                  )}
                  <ProductCard product={product} categoryStyle showBadge showPackBadge={false} showStockInfo />
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={page <= 1}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold text-neutral-700">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  disabled={page >= totalPages}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        ) : debouncedQuery.trim() ? (
          <div className="rounded-lg border border-neutral-200 bg-white px-4 py-14 text-center">
            <p className="text-base font-semibold text-neutral-900">No products found</p>
            <p className="mt-1 text-sm text-neutral-500">Try another search term.</p>
            {zeroResultSearches.length > 0 && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {zeroResultSearches.slice(0, 5).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => applySearch(item)}
                    className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
              {chips.slice(0, 10).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => applySearch(item)}
                  className="rounded-lg border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:border-[var(--customer-primary)]"
                >
                  <TrendingUp className="mb-3 h-5 w-5 text-[var(--customer-primary)]" />
                  <span className="text-sm font-bold text-neutral-900">{item}</span>
                </button>
              ))}
            </div>

            {recommendedProducts.length > 0 && (
              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-800">
                  <Sparkles className="h-4 w-4 text-[var(--customer-primary)]" />
                  Recommended For You
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {recommendedProducts.map((product) => (
                    <ProductCard
                      key={product.id || product._id}
                      product={product}
                      categoryStyle
                      showBadge
                      showPackBadge={false}
                      showStockInfo
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
