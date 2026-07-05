import { Request, Response } from 'express';
import Cart from '../../../models/Cart';
import CartItem from '../../../models/CartItem';
import Product from '../../../models/Product';
import AppSettings from '../../../models/AppSettings';
import { findSellersWithinRange } from '../../../utils/locationHelper';
import mongoose from 'mongoose';
import {
  CART_PRODUCT_SELECT,
  enrichCartItemProduct,
  resolveCartLinePricing,
} from '../../product/cartProductHelper';
import { getTotalStock, variantsFromProductDoc } from '../../product/variantHelpers';

const calculateCartTotal = async (cartId: any, nearbySellerIds: mongoose.Types.ObjectId[] = []) => {
    const items = await CartItem.find({ cart: cartId }).populate({
        path: 'product',
        select: CART_PRODUCT_SELECT,
    });

    let visibleSellerIds: string[] = [];
    try {
        const Seller = (await import("../../../models/Seller")).default;
        const visibleSellers = await Seller.find({ isEnabled: true }).select("_id");
        visibleSellerIds = visibleSellers.map(s => s._id.toString());
    } catch (e) { console.error("Error fetching visible sellers", e); }

    const settings = await AppSettings.findOne().lean();
    const inventorySection = settings?.productDisplaySettings?.find(s => s.id === 'inventory');
    const negativeStockSoldOut = inventorySection?.fields?.find(f => f.id === 'negative_stock_sold_out')?.isEnabled;

    let total = 0;
    for (const item of items) {
        const product = item.product as any;
        if (product && product.status === 'Active' && product.publish) {
            const pricing = resolveCartLinePricing(product, {
              variantId: item.variantId ? String(item.variantId) : undefined,
              variation: item.variation,
            });
            if (negativeStockSoldOut && pricing.stock <= 0) {
                continue;
            }

            const sellerId = product.seller.toString();
            const isAvailable = nearbySellerIds.some(id => id.toString() === sellerId) || visibleSellerIds.includes(sellerId);

            if (isAvailable) {
                total += pricing.unitPrice * item.quantity;
            }
        }
    }
    return total;
};

export const getCart = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { latitude, longitude } = req.query;

        const userLat = latitude ? parseFloat(latitude as string) : null;
        const userLng = longitude ? parseFloat(longitude as string) : null;

        let nearbySellerIds: mongoose.Types.ObjectId[] = [];
        let locationProvided = false;

        if (userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng)) {
             nearbySellerIds = await findSellersWithinRange(userLat, userLng);
             locationProvided = true;
        }

        let visibleSellerIds: string[] = [];
        try {
            const Seller = (await import("../../../models/Seller")).default;
            const visibleSellers = await Seller.find({ isEnabled: true }).select("_id");
            visibleSellerIds = visibleSellers.map(s => s._id.toString());
        } catch (e) { }

        const settings = await AppSettings.findOne().lean();
        const inventorySection = settings?.productDisplaySettings?.find(s => s.id === 'inventory');
        const negativeStockSoldOut = inventorySection?.fields?.find(f => f.id === 'negative_stock_sold_out')?.isEnabled;

        let cart = await Cart.findOne({ customer: userId }).populate({
            path: 'items',
            populate: {
                path: 'product',
                select: CART_PRODUCT_SELECT,
            }
        });

        if (!cart) {
            cart = await Cart.create({ customer: userId, items: [], total: 0 });
            return res.status(200).json({ success: true, data: cart });
        }

        const filteredItems = [];
        let total = 0;

        for (const item of (cart.items as any)) {
            const product = item.product;
            if (product && product.status === 'Active' && product.publish) {
                const pricing = resolveCartLinePricing(product, {
              variantId: item.variantId ? String(item.variantId) : undefined,
              variation: item.variation,
            });
                if (negativeStockSoldOut && pricing.stock <= 0) {
                    continue;
                }

                let isAvailable = true;

                if (locationProvided) {
                    const sellerId = product.seller.toString();
                    const isVisible = visibleSellerIds.includes(sellerId);
                    const isNearby = nearbySellerIds.some(id => id.toString() === sellerId);
                    isAvailable = isVisible || isNearby;
                }

                if (isAvailable) {
                    filteredItems.push(enrichCartItemProduct(product, item));
                    total += pricing.unitPrice * item.quantity;
                }
            }
        }

        if (cart.total !== total) {
            cart.total = total;
            await cart.save();
        }

        return res.status(200).json({
            success: true,
            data: {
                ...cart.toObject(),
                items: filteredItems,
                total
            }
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Error fetching cart',
            error: error.message
        });
    }
};

export const addToCart = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { productId, quantity = 1, variation, variantId } = req.body;
        const { latitude, longitude } = req.query;

        if (!productId) {
            return res.status(400).json({ success: false, message: 'Product ID is required' });
        }

        const userLat = latitude ? parseFloat(latitude as string) : null;
        const userLng = longitude ? parseFloat(longitude as string) : null;
        const locationProvided = userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng);

        const product = await Product.findOne({ _id: productId, status: 'Active', publish: true });
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found or unavailable' });
        }

        const variants = variantsFromProductDoc(product);
        const resolved = resolveCartLinePricing(product, { variantId, variation });
        if (!resolved.variant && variants.length > 1) {
            return res.status(400).json({
                success: false,
                message: 'variantId is required for products with multiple variants',
            });
        }

        const settings = await AppSettings.findOne().lean();
        const inventorySection = settings?.productDisplaySettings?.find(s => s.id === 'inventory');
        const negativeStockSoldOut = inventorySection?.fields?.find(f => f.id === 'negative_stock_sold_out')?.isEnabled;

        if (negativeStockSoldOut && resolved.stock <= 0) {
            return res.status(400).json({
                success: false,
                message: 'This product is currently sold out and cannot be added to cart'
            });
        }

        let cart = await Cart.findOne({ customer: userId });
        if (!cart) {
            cart = await Cart.create({ customer: userId, items: [], total: 0 });
        }

        const resolvedVariantId = resolved.variantId;
        const variationLabel = resolved.variationLabel;

        let cartItem = await CartItem.findOne({
            cart: cart._id,
            product: productId,
            ...(resolvedVariantId
              ? { variantId: resolvedVariantId }
              : { variation: variationLabel || null }),
        });

        if (cartItem) {
            cartItem.quantity += quantity;
            await cartItem.save();
        } else {
            cartItem = await CartItem.create({
                cart: cart._id,
                product: productId,
                quantity,
                variation: variationLabel,
                variantId: resolvedVariantId,
            });
            cart.items.push(cartItem._id as any);
        }

        let nearbySellerIds: mongoose.Types.ObjectId[] = [];
        if (userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng)) {
             nearbySellerIds = await findSellersWithinRange(userLat, userLng);
        }

        cart.total = await calculateCartTotal(cart._id, nearbySellerIds);
        await cart.save();

        const updatedCart = await Cart.findById(cart._id).populate({
            path: 'items',
            populate: {
                path: 'product',
                select: CART_PRODUCT_SELECT,
            }
        });

        let visibleSellerIds: string[] = [];
        try {
            const Seller = (await import("../../../models/Seller")).default;
            const visibleSellers = await Seller.find({ isEnabled: true }).select("_id");
            visibleSellerIds = visibleSellers.map(s => s._id.toString());
        } catch (e) { }

        const filteredItems = (updatedCart?.items as any[] || [])
          .filter(item => {
            const prod = item.product;
            const sellerId = prod?.seller?.toString();
            if (nearbySellerIds.length === 0 && !locationProvided) {
                return true;
            }
            return prod && (nearbySellerIds.some(id => id.toString() === sellerId) || visibleSellerIds.includes(sellerId));
          })
          .map((item) => enrichCartItemProduct(item.product, item));

        return res.status(200).json({
            success: true,
            message: 'Item added to cart',
            data: {
                ...updatedCart?.toObject(),
                items: filteredItems,
                total: cart.total
            }
        });

    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Error adding to cart',
            error: error.message
        });
    }
};

export const updateCartItem = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { itemId } = req.params;
        const { quantity } = req.body;
        const { latitude, longitude } = req.query;

        if (quantity < 1) {
            return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
        }

        const userLat = latitude ? parseFloat(latitude as string) : null;
        const userLng = longitude ? parseFloat(longitude as string) : null;
        const locationProvided = userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng);

        let nearbySellerIds: mongoose.Types.ObjectId[] = [];
        if (locationProvided) {
            nearbySellerIds = await findSellersWithinRange(userLat!, userLng!);
        }

        const cart = await Cart.findOne({ customer: userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        const cartItem = await CartItem.findOne({ _id: itemId, cart: cart._id }).populate('product');
        if (!cartItem) {
            return res.status(404).json({ success: false, message: 'Item not found in cart' });
        }

        cartItem.quantity = quantity;
        await cartItem.save();

        cart.total = await calculateCartTotal(cart._id, nearbySellerIds);
        await cart.save();

        const updatedCart = await Cart.findById(cart._id).populate({
            path: 'items',
            populate: {
                path: 'product',
                select: CART_PRODUCT_SELECT,
            }
        });

        let visibleSellerIds: string[] = [];
        try {
            const Seller = (await import("../../../models/Seller")).default;
            const visibleSellers = await Seller.find({ isEnabled: true }).select("_id");
            visibleSellerIds = visibleSellers.map(s => s._id.toString());
        } catch (e) { }

        const filteredItems = (updatedCart?.items as any[] || [])
          .filter(item => {
            const prod = item.product;
            const sellerId = prod?.seller?.toString();
            if (!locationProvided) return true;
            return prod && (nearbySellerIds.some(id => id.toString() === sellerId) || visibleSellerIds.includes(sellerId));
          })
          .map((item) => enrichCartItemProduct(item.product, item));

        return res.status(200).json({
            success: true,
            message: 'Cart updated',
            data: {
                ...updatedCart?.toObject(),
                items: filteredItems,
                total: cart.total
            }
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Error updating cart item',
            error: error.message
        });
    }
};

export const removeFromCart = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { itemId } = req.params;
        const { latitude, longitude } = req.query;

        const userLat = latitude ? parseFloat(latitude as string) : null;
        const userLng = longitude ? parseFloat(longitude as string) : null;

        const cart = await Cart.findOne({ customer: userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        await CartItem.findOneAndDelete({ _id: itemId, cart: cart._id });
        cart.items = cart.items.filter(id => id.toString() !== itemId);

        let nearbySellerIds: mongoose.Types.ObjectId[] = [];
        if (userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng)) {
            nearbySellerIds = await findSellersWithinRange(userLat, userLng);
        }

        cart.total = await calculateCartTotal(cart._id, nearbySellerIds);
        await cart.save();

        const updatedCart = await Cart.findById(cart._id).populate({
            path: 'items',
            populate: {
                path: 'product',
                select: CART_PRODUCT_SELECT,
            }
        });

        const filteredItems = (updatedCart?.items as any[] || [])
          .filter(item => {
            const prod = item.product;
            if (nearbySellerIds.length > 0) {
                return prod && nearbySellerIds.some(id => id.toString() === prod.seller.toString());
            }
            return true;
          })
          .map((item) => enrichCartItemProduct(item.product, item));

        return res.status(200).json({
            success: true,
            message: 'Item removed from cart',
            data: {
                ...updatedCart?.toObject(),
                items: filteredItems,
                total: cart.total
            }
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Error removing from cart',
            error: error.message
        });
    }
};

export const clearCart = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const cart = await Cart.findOne({ customer: userId });

        if (cart) {
            await CartItem.deleteMany({ cart: cart._id });
            cart.items = [];
            cart.total = 0;
            await cart.save();
        }

        return res.status(200).json({
            success: true,
            message: 'Cart cleared',
            data: { items: [], total: 0 }
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Error clearing cart',
            error: error.message
        });
    }
};
