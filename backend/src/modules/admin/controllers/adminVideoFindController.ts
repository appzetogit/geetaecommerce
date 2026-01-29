import { Request, Response } from 'express';
import VideoFind from '../../../models/VideoFind';

// Get all video finds
export const getVideoFinds = async (req: Request, res: Response) => {
  try {
    const videos = await VideoFind.find().sort({ createdAt: -1 }).populate('linkedProduct');
    res.status(200).json({ success: true, count: videos.length, data: videos });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: (error as Error).message });
  }
};

// Create a new video find
export const createVideoFind = async (req: Request, res: Response) => {
  try {
    const video = await VideoFind.create(req.body);
    res.status(201).json({ success: true, data: video });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: (error as Error).message });
  }
};

// Update a video find
export const updateVideoFind = async (req: Request, res: Response) => {
  try {
    const video = await VideoFind.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!video) {
        return res.status(404).json({ success: false, message: 'Video not found' });
    }

    res.status(200).json({ success: true, data: video });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: (error as Error).message });
  }
};

// Delete a video find
export const deleteVideoFind = async (req: Request, res: Response) => {
  try {
    const video = await VideoFind.findByIdAndDelete(req.params.id);

    if (!video) {
        return res.status(404).json({ success: false, message: 'Video not found' });
    }

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: (error as Error).message });
  }
};
