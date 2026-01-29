import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import AppSettings from "../../../models/AppSettings";
import axios from "axios";

/**
 * Search for product images using Unsplash API (as reliable fallback) or Gemini if configured
 * Route: POST /api/seller/tools/search-image
 */
export const searchProductImage = asyncHandler(
  async (req: Request, res: Response) => {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    // 1. Try to get keys from DB (Dynamic)
    const settings = await AppSettings.findOne().select("+geminiApiKey +googleCxId");

    // Keys priorities: Env (Explicit) > DB > Env (Gemini)
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;

    // Explicitly clean the key to avoid whitespace issues causing "Invalid Argument"
    // Prioritize GOOGLE_CUSTOM_API_KEY from env as user recently added it
    let googleApiKey = process.env.GOOGLE_CUSTOM_API_KEY || settings?.geminiApiKey || process.env.GEMINI_API_KEY;
    if (googleApiKey) googleApiKey = googleApiKey.trim();

    // Default to the user's provided CX ID if not in env (Hotfix to avoid server restart)
    const googleCxId = process.env.GOOGLE_CX_ID || settings?.googleCxId || "933cd3189f86843e3";

    let imageUrl = "";

    let debugInfo = "";

    // Strategy A: Google Custom Search
    if (googleApiKey && googleCxId) {
        try {
             const keyPrefix = googleApiKey.length > 5 ? googleApiKey.substring(0, 5) + "..." : "HIDDEN";
             console.log(`[Image Search] Using Google Custom Search. Key: ${keyPrefix} CX: ${googleCxId}`);

             const response = await axios.get(`https://www.googleapis.com/customsearch/v1`, {
                 params: {
                     key: googleApiKey,
                     cx: googleCxId,
                     // Exclude stock photo sites to get original product images
                     q: query + " product india -site:unsplash.com -site:pexels.com -site:pixabay.com",
                     searchType: "image",
                     num: 1,
                     imgSize: "large",
                     safe: "active"
                 }
             });

             if (response.data.items && response.data.items.length > 0) {
                 imageUrl = response.data.items[0].link;
                 console.log(`[Image Search] Google Found: ${imageUrl}`);
             } else {
                 console.warn(`[Image Search] Google returned 0 results.`);
                 debugInfo += ` | Google: No Results (CX: ${googleCxId})`;
             }
        } catch (error: any) {
             const errorMsg = error.response?.data?.error?.message || error.message;
             console.error("[Image Search] Google Error:", errorMsg);
             debugInfo += ` | Google Error: ${errorMsg} (Key: ...${googleApiKey ? googleApiKey.slice(-4) : 'NONE'}, CX: ${googleCxId})`;
        }
    }

    // Strategy B: Unsplash (Disabled by user request for "Original Images")
    // User explicitly requested to blocking unsplash/pexels/pixabay.

    // if (!imageUrl && unsplashKey) { ... }

    if (imageUrl) {
        return res.status(200).json({
            success: true,
            data: { imageUrl },
            message: "Image found successfully"
        });
    }

    // Return detailed error message
    return res.status(200).json({
        success: false,
        message: `No image found. ${debugInfo}`
    });
  }
);
