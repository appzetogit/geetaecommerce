import { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { getTheme, Theme } from '../utils/themes';
import { getHeaderCategoriesPublic } from '../services/api/headerCategoryService';

interface ThemeContextType {
    activeCategory: string;
    setActiveCategory: (category: string) => void;
    currentTheme: Theme;
    themeKey: string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [activeCategory, setActiveCategory] = useState('all');
    const [headerCategories, setHeaderCategories] = useState<any[]>([]);

    useEffect(() => {
        const fetchHeaderCategories = async () => {
            try {
                const cats = await getHeaderCategoriesPublic();
                if (cats) {
                    setHeaderCategories(cats);
                }
            } catch (error) {
                console.error('Failed to fetch header categories in ThemeProvider', error);
            }
        };
        fetchHeaderCategories();
    }, []);

    const slugToThemeMap = useMemo(() => {
        const map = new Map<string, string>();
        headerCategories.forEach(cat => {
            map.set(cat.slug, cat.theme || cat.slug);
        });
        return map;
    }, [headerCategories]);

    const themeKey = useMemo(() => {
        return slugToThemeMap.get(activeCategory) || activeCategory || 'all';
    }, [activeCategory, slugToThemeMap]);

    const currentTheme = getTheme(themeKey);

    return (
        <ThemeContext.Provider value={{ activeCategory, setActiveCategory, currentTheme, themeKey }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useThemeContext() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useThemeContext must be used within a ThemeProvider');
    }
    return context;
}
