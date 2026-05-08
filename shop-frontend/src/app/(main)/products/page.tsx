'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  SlidersHorizontal, X, ChevronDown, Search, Grid3X3, LayoutList,
} from 'lucide-react';
import { Product, Pagination, Category } from '@/types';
import { ProductCard } from '@/components/products/ProductCard';
import { productApi, categoryApi } from '@/lib/api';
import { useLanguageStore } from '@/store/languageStore';
import { t } from '@/lib/i18n';

function ProductsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { language } = useLanguageStore();
  const SORT_OPTIONS = [
    { value: 'createdAt-desc', label: t(language, 'sortNewest') },
    { value: 'price-asc', label: t(language, 'sortPriceLow') },
    { value: 'price-desc', label: t(language, 'sortPriceHigh') },
    { value: 'rating-desc', label: t(language, 'sortTopRated') },
    { value: 'soldCount-desc', label: t(language, 'sortBestSellers') },
  ];

  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    sort: 'createdAt-desc',
    rating: '',
    page: 1,
    featured: searchParams.get('featured') || '',
  });

  // Sync filters when URL search params change (e.g. navbar link clicks)
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      search: searchParams.get('search') || '',
      category: searchParams.get('category') || '',
      featured: searchParams.get('featured') || '',
      page: 1,
    }));
  }, [searchParams]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const [sortField, sortOrder] = filters.sort.split('-');
      const params: Record<string, unknown> = {
        page: filters.page,
        limit: 12,
        sort: sortField,
        order: sortOrder,
        lang: language,
      };
      if (filters.search) params.search = filters.search;
      if (filters.category) params.category = filters.category;
      if (filters.minPrice) params.minPrice = filters.minPrice;
      if (filters.maxPrice) params.maxPrice = filters.maxPrice;
      if (filters.rating) params.rating = filters.rating;
      if (filters.featured) params.featured = filters.featured;

      const { data } = await productApi.getAll(params);
      setProducts(data.data || []);
      setPagination(data.pagination || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters, language]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    categoryApi.getAll().then(({ data }) => setCategories(data.data || []));
  }, []);

  const updateFilter = (key: string, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const clearFilters = () => {
    router.push('/products');
  };

  const activeFilterCount = [
    filters.category, filters.minPrice, filters.maxPrice, filters.rating, filters.search, filters.featured,
  ].filter(Boolean).length;

  return (
    <div className="page-container py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {filters.search ? `${t(language, 'productsSearchPrefix')} "${filters.search}"` :
             filters.category ? categories.find(c => c.slug === filters.category)?.name || t(language, 'productsAllProducts') :
             filters.featured ? t(language, 'productsFeaturedOnly') : t(language, 'productsAllProducts')}
          </h1>
          {pagination && (
            <p className="text-sm text-gray-500 mt-0.5">
              {pagination.total.toLocaleString()} {t(language, 'productsFound')}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Inline search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              placeholder={t(language, 'productsSearchPlaceholder')}
              className="pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl w-44 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
            />
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={filters.sort}
              onChange={(e) => updateFilter('sort', e.target.value)}
              className="pl-3 pr-8 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white cursor-pointer"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Filters toggle */}
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="relative flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors dark:text-white"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {t(language, 'productsFilters')}
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 text-xs font-bold text-white bg-primary-600 rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* View mode */}
          <div className="hidden sm:flex border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-50'}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-50'}`}
            >
              <LayoutList className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter panel */}
      {filtersOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="card p-5 mb-6 overflow-visible relative z-20"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">{t(language, 'productsFilters')}</h3>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700"
              >
                <X className="w-3.5 h-3.5" /> {t(language, 'productsClearAll')}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 overflow-visible relative z-20">
            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t(language, 'productsCategory')}</label>
              <select
                value={filters.category}
                onChange={(e) => updateFilter('category', e.target.value)}
                className="input text-sm"
              >
                <option value="">{t(language, 'productsAllCategories')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Min Price */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t(language, 'productsMinPrice')}</label>
              <input
                type="number"
                value={filters.minPrice}
                onChange={(e) => updateFilter('minPrice', e.target.value)}
                placeholder={t(language, 'productsMinPrice')}
                className="input text-sm"
              />
            </div>

            {/* Max Price */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t(language, 'productsMaxPrice')}</label>
              <input
                type="number"
                value={filters.maxPrice}
                onChange={(e) => updateFilter('maxPrice', e.target.value)}
                placeholder={t(language, 'productsMaxPrice')}
                className="input text-sm"
              />
            </div>

            {/* Rating */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t(language, 'productsMinRating')}</label>
              <select
                value={filters.rating}
                onChange={(e) => updateFilter('rating', e.target.value)}
                className="input text-sm"
              >
                <option value="">{t(language, 'productsAnyRating')}</option>
                {[4, 3, 2, 1].map((r) => (
                  <option key={r} value={r}>{r}+ {t(language, 'productsStars')}</option>
                ))}
              </select>
            </div>

            {/* Featured */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t(language, 'productsShow')}</label>
              <select
                value={filters.featured}
                onChange={(e) => updateFilter('featured', e.target.value)}
                className="input text-sm"
              >
                <option value="">{t(language, 'productsAllProducts')}</option>
                <option value="true">{t(language, 'productsFeaturedOnlyLabel')}</option>
              </select>
            </div>
          </div>
        </motion.div>
      )}

      {/* Products grid */}
      {loading ? (
        <div className={`grid gap-5 ${viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1'}`}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={`products-skeleton-${i}`} className="card animate-pulse">
              <div className="aspect-square bg-gray-200 dark:bg-gray-800" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded" />
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{t(language, 'productsNoFound')}</h3>
          <p className="text-gray-500 mb-4">{t(language, 'productsTryAdjust')}</p>
          <button onClick={clearFilters} className="btn-primary text-sm">{t(language, 'productsClearFilters')}</button>
        </div>
      ) : (
        <div className={`grid gap-5 ${viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {products.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <ProductCard product={product} />
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-10">
          <button
            onClick={() => updateFilter('page', filters.page - 1)}
            disabled={!pagination.hasPrev}
            className="btn-secondary text-sm px-4 disabled:opacity-40"
          >
            {t(language, 'productsPrevious')}
          </button>

          <div className="flex gap-1">
            {(() => {
              const windowSize = Math.min(5, pagination.totalPages);
              const start = Math.max(1, Math.min(filters.page - 2, pagination.totalPages - windowSize + 1));
              const pages = Array.from({ length: windowSize }, (_, i) => start + i);
              return pages.map((page) => (
                <button
                  key={`page-${page}`}
                  onClick={() => updateFilter('page', page)}
                  className={`w-9 h-9 text-sm font-medium rounded-xl transition-colors ${
                    page === filters.page
                      ? 'bg-primary-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {page}
                </button>
              ));
            })()}
          </div>

          <button
            onClick={() => updateFilter('page', filters.page + 1)}
            disabled={!pagination.hasNext}
            className="btn-secondary text-sm px-4 disabled:opacity-40"
          >
            {t(language, 'productsNext')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <div className="page-container py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={`products-fallback-skeleton-${i}`} className="card animate-pulse">
              <div className="aspect-square bg-gray-200 dark:bg-gray-800" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    }>
      <ProductsContent />
    </Suspense>
  );
}
