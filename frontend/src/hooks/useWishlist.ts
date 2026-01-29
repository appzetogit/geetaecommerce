import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocation } from './useLocation'; // Import useLocation
import { useToast } from '../context/ToastContext'; // Import useToast
import { addToWishlist, removeFromWishlist, getWishlist } from '../services/api/customerWishlistService';

/**
 * Custom hook for managing wishlist state and toggle functionality
 * @param productId - The product ID to check/manage in wishlist
 * @returns Object with isWishlisted state and toggleWishlist function
 */
export function useWishlist(productId?: string) {
  const [isWishlisted, setIsWishlisted] = useState(false);
  const { isAuthenticated } = useAuth();
  const { location } = useLocation(); // Get location from context
  const { showToast } = useToast(); // Get toast function
  const navigate = useNavigate();

  useEffect(() => {
    // Only check wishlist if user is authenticated and productId is provided
    if (!isAuthenticated || !productId) {
      setIsWishlisted(false);
      return;
    }

    const checkWishlist = async () => {
      try {
        // Pass location to getWishlist
        const res = await getWishlist({
            latitude: location?.latitude,
            longitude: location?.longitude
        });
        if (res.success && res.data && res.data.products) {
          const exists = res.data.products.some(
            (p: any) => String(p._id || p.id) === String(productId)
          );
          setIsWishlisted(exists);
        }
      } catch (e) {
        // Silently fail if not logged in or error
        setIsWishlisted(false);
      }
    };
    checkWishlist();
  }, [productId, isAuthenticated, location?.latitude, location?.longitude]);

  const toggleWishlist = async (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      if ('preventDefault' in e) e.preventDefault();
      if ('stopPropagation' in e) e.stopPropagation();
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!productId) {
      console.error('Product ID is required to toggle wishlist');
      return;
    }

    const previousState = isWishlisted;

    try {
      if (isWishlisted) {
        // Optimistic update
        setIsWishlisted(false);
        await removeFromWishlist(productId);
        showToast('Removed from wishlist');
      } else {
        // Check for location availability before adding
        if (!location?.latitude || !location?.longitude) {
             showToast('Location is required to add items to wishlist', 'error');
             return;
        }

        // Optimistic update
        setIsWishlisted(true);
        await addToWishlist(productId, location.latitude, location.longitude);
        showToast('Added to wishlist');
      }
    } catch (error: any) {
      console.error('Failed to toggle wishlist:', error);
      // Revert state on error
      setIsWishlisted(previousState);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update wishlist';
      showToast(errorMessage, 'error');
    }
  };

  return { isWishlisted, toggleWishlist };
}

