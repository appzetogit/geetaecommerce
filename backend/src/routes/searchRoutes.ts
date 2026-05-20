import { NextFunction, Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import {
  getRecommendations,
  getSimilarProducts,
  getSuggestions,
  getTrending,
  semanticSearch,
  trackSearchClick,
} from "../controllers/searchController";

const router = Router();

const searchRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 90,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many search requests. Please try again shortly.",
  },
});

const validateSearchQuery = (req: Request, res: Response, next: NextFunction) => {
  const query = String(req.query.q || req.query.query || req.query.search || "").trim();
  if (!query) {
    return res.status(400).json({
      success: false,
      message: "Search query is required",
    });
  }

  if (query.length > 120) {
    return res.status(400).json({
      success: false,
      message: "Search query must be 120 characters or fewer",
    });
  }

  return next();
};

router.use(searchRateLimiter);

router.get("/", validateSearchQuery, semanticSearch);
router.get("/suggestions", getSuggestions);
router.get("/trending", getTrending);
router.get("/recommendations", getRecommendations);
router.get("/similar/:id", getSimilarProducts);
router.post("/click", trackSearchClick);

export default router;
