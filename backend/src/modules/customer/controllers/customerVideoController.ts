import { Request, Response } from "express";
import VideoFind from "../../../models/VideoFind";
import mongoose from "mongoose";

export const getVideoFinds = async (_req: Request, res: Response) => {
  try {
    const videos = await VideoFind.find().sort({ createdAt: -1 }).populate('linkedProduct');
    return res.status(200).json({ success: true, count: videos.length, data: videos });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching video finds", error: (error as Error).message });
  }
};

export const toggleLike = async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const video = await VideoFind.findById(videoId);
    if (!video) {
      return res.status(404).json({ success: false, message: "Video not found" });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const likeIndex = video.likes.findIndex(id => id.toString() === userId);

    if (likeIndex > -1) {
      // Unlike
      video.likes.splice(likeIndex, 1);
    } else {
      // Like
      video.likes.push(userObjectId);
    }

    await video.save();
    return res.status(200).json({ success: true, data: video, isLiked: likeIndex === -1 });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error toggling like", error: (error as Error).message });
  }
};

export const incrementShare = async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const video = await VideoFind.findByIdAndUpdate(
      videoId,
      { $inc: { shares: 1 } },
      { new: true }
    );

    if (!video) {
      return res.status(404).json({ success: false, message: "Video not found" });
    }

    return res.status(200).json({ success: true, data: video });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error incrementing share", error: (error as Error).message });
  }
};
