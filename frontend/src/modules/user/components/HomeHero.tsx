import { useNavigate } from 'react-router-dom';
import { useLayoutEffect, useRef, useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getTheme } from '../../../utils/themes';
import { useLocation } from '../../../hooks/useLocation';
import { getCategories } from '../../../services/api/customerProductService';
import { Category } from '../../../types/domain';
import { getHeaderCategoriesPublic } from '../../../services/api/headerCategoryService';
import { getIconByName } from '../../../utils/iconLibrary';

gsap.registerPlugin(ScrollTrigger);

interface HomeHeroProps {
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const ALL_TAB: Tab = {
  id: 'all',
  label: 'All',
  icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 22V12H15V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

interface LanguageDropdownProps {
  language: string;
  setLanguage: (lang: string) => void;
  isSticky: boolean;
  activeTab: string;
}

const LanguageDropdown = ({ language, setLanguage, isSticky, activeTab }: LanguageDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const theme = getTheme(activeTab || 'all');

  // Extract primary color for active state
  // Theme usually returns colors like '#HEX' or 'rgb(...)'.
  // We'll use a fallback or try to use the theme's primary color.
  const activeColor = theme.primary && theme.primary[0] ? theme.primary[0] : '#0d9488'; // Defaulting to teal-like if fail

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const options = [
    { value: 'EN', label: 'English' },
    { value: 'HI', label: 'Hindi' }
  ];

  return (
    <div
      ref={dropdownRef}
      className="relative flex items-center h-full"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 outline-none transition-colors border-r border-gray-300 mr-2 h-5"
      >
        <span
          className="text-xs font-bold leading-none"
          style={{ color: isSticky ? '#6b7280' : '#4b5563' }}
        >
          {language}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isSticky ? "#9ca3af" : "#6b7280"}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-32 bg-white rounded-lg shadow-xl border border-neutral-100 overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-200 origin-top-right">
          <div className="py-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setLanguage(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors hover:bg-neutral-50 flex items-center justify-between group`}
                style={{
                  color: language === opt.value ? activeColor : '#374151',
                  backgroundColor: language === opt.value ? 'rgba(0,0,0,0.02)' : 'transparent'
                }}
              >
                <span>{opt.label}</span>
                {language === opt.value && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function HomeHero({ activeTab = 'all', onTabChange }: HomeHeroProps) {
  const [tabs, setTabs] = useState<Tab[]>([ALL_TAB]);

  useEffect(() => {
    const fetchHeaderCategories = async () => {
      try {
        const cats = await getHeaderCategoriesPublic();
        if (cats && cats.length > 0) {
          const mapped = cats.map(c => ({
            id: c.slug,
            label: c.name,
            icon: c.image ? (
                <img src={c.image} alt={c.name} className="w-full h-full object-contain" />
            ) : (
                getIconByName(c.iconName)
            )
          }));
          setTabs([ALL_TAB, ...mapped]);
        }
      } catch (error) {
        console.error('Failed to fetch header categories', error);
      }
    };
    fetchHeaderCategories();
  }, []);

  const navigate = useNavigate();
  const { location: userLocation } = useLocation();
  const heroRef = useRef<HTMLDivElement>(null);
  const topSectionRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [isSticky, setIsSticky] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [language, setLanguage] = useState('EN');

  // Format location display text
  const locationDisplayText = useMemo(() => {
    if (userLocation) {
      if (userLocation.address) {
        return userLocation.address;
      } else if (userLocation.city && userLocation.state) {
        return `${userLocation.city}, ${userLocation.state}`;
      } else if (userLocation.city) {
        return userLocation.city;
      }
      return '';
    }
    return '';
  }, [userLocation]);

  const [categories, setCategories] = useState<Category[]>([]);

  // Fetch categories for search suggestions
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await getCategories();
        if (response.success && response.data) {
          setCategories(response.data.map((c: any) => ({
            ...c,
            id: c._id || c.id
          })));
        }
      } catch (error) {
        console.error("Error fetching categories for suggestions:", error);
      }
    };
    fetchCategories();
  }, []);

  // Search suggestions
  const searchSuggestions = useMemo(() => {
    if (activeTab === 'all' && categories.length > 0) {
      return categories.slice(0, 8).map(c => c.name.toLowerCase());
    }
    switch (activeTab) {
      case 'wedding': return ['gift packs', 'dry fruits', 'sweets', 'decorative items', 'wedding cards', 'return gifts'];
      case 'winter': return ['woolen clothes', 'caps', 'gloves', 'blankets', 'heater', 'winter wear'];
      case 'electronics': return ['chargers', 'cables', 'power banks', 'earphones', 'phone cases', 'screen guards'];
      case 'beauty': return ['lipstick', 'makeup', 'skincare', 'kajal', 'face wash', 'moisturizer'];
      case 'grocery': return ['atta', 'milk', 'dal', 'rice', 'oil', 'vegetables'];
      case 'fashion': return ['clothing', 'shoes', 'accessories', 'watches', 'bags', 'jewelry'];
      case 'sports': return ['cricket bat', 'football', 'badminton', 'fitness equipment', 'sports shoes', 'gym wear'];
      default: return ['atta', 'milk', 'dal', 'coke', 'bread', 'eggs', 'rice', 'oil'];
    }
  }, [activeTab, categories]);

  useLayoutEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(hero, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' });
    }, hero);
    return () => ctx.revert();
  }, []);

  // Animate search suggestions
  useEffect(() => {
    setCurrentSearchIndex(0);
    const interval = setInterval(() => {
      setCurrentSearchIndex((prev) => (prev + 1) % searchSuggestions.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [searchSuggestions.length, activeTab]);

  // Handle scroll for sticky behavior using Intersection detection via BoundingRect
  useEffect(() => {
    const handleScroll = () => {
      if (topSectionRef.current) {
        // We check the bottom position of the top section (Logo).
        // When it moves out of view (becomes <= 0 or small offset), we stick the header.
        const topSectionBottom = topSectionRef.current.getBoundingClientRect().bottom;
        // e.g. if section height is ~60px, transition as it scrolls
        const threshold = 10; // slightly before full exit

        setIsSticky(topSectionBottom <= threshold);

        // Optional: Progress logic if you want gradient transition
        const topSectionHeight = topSectionRef.current.offsetHeight || 60;
        const p = Math.min(Math.max(1 - (topSectionBottom / topSectionHeight), 0), 1);
        setScrollProgress(p);
      }
    };

    // Attach to MAIN container because that is what scrolls
    const main = document.querySelector('main');
    if (main) {
      main.addEventListener('scroll', handleScroll, { passive: true });
    }
    // Also attach to window just in case usage changes
    window.addEventListener('scroll', handleScroll, { passive: true });

    handleScroll(); // Initial check

    return () => {
      if (main) main.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Update sliding indicator
  useEffect(() => {
    const updateIndicator = (shouldScroll = true) => {
      const activeTabButton = tabRefs.current.get(activeTab);
      const container = tabsContainerRef.current;
      if (activeTabButton && container) {
        try {
          const left = activeTabButton.offsetLeft;
          const width = activeTabButton.offsetWidth;
          if (width > 0) setIndicatorStyle({ left, width });

          if (shouldScroll) {
            const containerScrollLeft = container.scrollLeft;
            const containerWidth = container.offsetWidth;
            const buttonRight = left + width;
            const scrollPadding = 20;
            let targetScrollLeft = containerScrollLeft;

            if (left < containerScrollLeft + scrollPadding) {
              targetScrollLeft = left - scrollPadding;
            } else if (buttonRight > containerScrollLeft + containerWidth - scrollPadding) {
              targetScrollLeft = buttonRight - containerWidth + scrollPadding;
            }

            if (targetScrollLeft !== containerScrollLeft) {
              container.scrollTo({ left: Math.max(0, targetScrollLeft), behavior: 'smooth' });
            }
          }
        } catch (error) { console.warn(error); }
      }
    };
    updateIndicator(true);
    const t1 = setTimeout(() => updateIndicator(true), 50);
    const t2 = setTimeout(() => updateIndicator(true), 150);
    const t3 = setTimeout(() => updateIndicator(false), 300);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [activeTab]);

  const handleTabClick = (tabId: string) => { onTabChange?.(tabId); };

  const theme = getTheme(activeTab || 'all');
  const heroGradient = `linear-gradient(to bottom right, ${theme.primary[0]}, ${theme.primary[1]}, ${theme.primary[2]})`;

  // Render the sticky content (Search + Tabs)
  const renderStickyContent = () => (
    <div
      ref={stickyRef}
      className={isSticky ? 'fixed top-0 left-0 right-0 z-[9999] bg-[#fff7ed] shadow-md animate-fade-in' : 'relative z-50 bg-transparent'}
      style={{
        transition: 'background-color 0.3s ease',
      }}
    >
      <div className="px-4 md:px-6 lg:px-8 pt-2 md:pt-2 pb-2 md:pb-2">
        {/* Search Bar */}
        <div
          onClick={() => navigate('/search')}
          className={`w-full md:w-auto md:max-w-xl md:mx-auto rounded-xl shadow-lg px-3 ${isSticky ? 'py-3 md:py-2.5' : 'py-2 md:py-1.5'} flex items-center gap-2 cursor-pointer hover:shadow-xl transition-all duration-300 mb-2 md:mb-1.5 bg-white relative z-50`}
          style={{
            backgroundColor: isSticky ? `rgba(249, 250, 251, 1)` : 'white',
            border: isSticky ? `1px solid rgba(229, 231, 235, 1)` : 'none',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 md:w-4 md:h-4">
            <circle cx="11" cy="11" r="8" stroke={isSticky ? "#9ca3af" : "#6b7280"} strokeWidth="2" />
            <path d="m21 21-4.35-4.35" stroke={isSticky ? "#9ca3af" : "#6b7280"} strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div className="flex-1 relative h-4 md:h-4 overflow-hidden">
            {searchSuggestions.map((suggestion, index) => {
              const isActive = index === currentSearchIndex;
              const prevIndex = (currentSearchIndex - 1 + searchSuggestions.length) % searchSuggestions.length;
              const isPrev = index === prevIndex;
              return (
                <div
                  key={suggestion}
                  className={`absolute inset-0 flex items-center transition-all duration-500 ${isActive ? 'translate-y-0 opacity-100' : isPrev ? '-translate-y-full opacity-0' : 'translate-y-full opacity-0'}`}
                >
                  <span className={`text-xs md:text-xs`} style={{ color: isSticky ? '#9ca3af' : '#6b7280' }}>
                    {language === 'HI' ? 'खोजें' : 'Search'} &apos;{suggestion}&apos;
                  </span>
                </div>
              );
            })}
          </div>

          <LanguageDropdown
            language={language}
            setLanguage={setLanguage}
            isSticky={isSticky}
            activeTab={activeTab || 'all'}
          />
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 md:w-4 md:h-4">
            <path d="M12 1C13.1 1 14 1.9 14 3C14 4.1 13.1 5 12 5C10.9 5 10 4.1 10 3C10 1.9 10.9 1 12 1Z" fill={isSticky ? "#9ca3af" : "#6b7280"} />
            <path d="M19 10V17C19 18.1 18.1 19 17 19H7C5.9 19 5 18.1 5 17V10" stroke={isSticky ? "#9ca3af" : "#6b7280"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 11V17" stroke={isSticky ? "#9ca3af" : "#6b7280"} strokeWidth="2" strokeLinecap="round" />
            <path d="M8 11V17" stroke={isSticky ? "#9ca3af" : "#6b7280"} strokeWidth="2" strokeLinecap="round" />
            <path d="M16 11V17" stroke={isSticky ? "#9ca3af" : "#6b7280"} strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="border-b border-neutral-400/40 w-full" style={{ paddingBottom: 0 }}>
        <div
          ref={tabsContainerRef}
          className="relative flex md:justify-center gap-2 md:gap-3 overflow-x-auto scrollbar-hide -mx-4 md:mx-0 px-4 md:px-6 lg:px-8 scroll-smooth"
          style={{ paddingBottom: '12px' }}
          data-padding-bottom="md:8px"
        >
          {indicatorStyle.width > 0 && (
            <div
              className="absolute bottom-0 h-1 bg-neutral-900 rounded-t-md transition-all duration-300 ease-out pointer-events-none"
              style={{ left: `${indicatorStyle.left}px`, width: `${indicatorStyle.width}px`, transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1)', zIndex: 0 }}
            />
          )}

          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const tabColor = isActive ? 'text-neutral-900' : isSticky ? 'text-neutral-600' : 'text-neutral-800';
            return (
              <button
                key={tab.id}
                ref={(el) => { if (el) tabRefs.current.set(tab.id, el); else tabRefs.current.delete(tab.id); }}
                onClick={() => handleTabClick(tab.id)}
                className={`flex-shrink-0 flex flex-col items-center justify-center w-auto min-w-[60px] md:w-auto md:min-w-[80px] md:px-3 py-1 md:py-1.5 relative ${tabColor} z-10`}
                style={{ transition: 'color 0.3s ease-out' }}
                type="button"
              >
                <div className={`mb-0.5 w-5 h-5 md:w-6 md:h-6 flex items-center justify-center ${tabColor}`} style={{ transition: 'color 0.3s ease-out, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)', transform: isActive ? 'scale(1.1)' : 'scale(1)' }}>
                  {tab.icon}
                </div>
                <span className={`text-[10px] md:text-xs md:whitespace-nowrap ${isActive ? 'font-semibold' : 'font-medium'}`} style={{ transition: 'font-weight 0.3s ease-out' }}>
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div
      ref={heroRef}
      className="relative z-20"
      style={{ background: heroGradient, paddingBottom: 0, marginBottom: 0 }}
    >
      {/* Top section with logo - NOT sticky */}
      <div>
        <div ref={topSectionRef} className="px-4 md:px-6 lg:px-8 pt-3 md:pt-4 pb-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-shrink-0">
              <img src="/assets/geetastoreslogo.png" alt="Geeta Stores" className="h-10 md:h-12 w-auto object-contain" />
            </div>
            {locationDisplayText && (
              <div className="flex items-center gap-1 text-neutral-700 text-xs md:text-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="line-clamp-1 font-medium" title={locationDisplayText}>{locationDisplayText}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>

      {isSticky ? (
        <>
          <div style={{ height: '110px' }} />
          {createPortal(renderStickyContent(), document.body)}
        </>
      ) : (
        renderStickyContent()
      )}
    </div>
  );
}
