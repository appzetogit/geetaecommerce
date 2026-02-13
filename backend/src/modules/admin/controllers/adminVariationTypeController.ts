import { Request, Response } from "express";
import VariationType from "../../../models/VariationType";

export const createVariationType = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Name is required" });

    const variationType = new VariationType({ name, createdBy: "Admin" });
    await variationType.save();
    res.status(201).json({ success: true, data: variationType });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getVariationTypes = async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    let query: any = { createdBy: "Admin" };
    if (search) {
      query = { ...query, name: { $regex: search, $options: "i" } };
    }
    const variationTypes = await VariationType.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: variationTypes });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateVariationType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const variationType = await VariationType.findOneAndUpdate(
      { _id: id, createdBy: "Admin" },
      { name },
      { new: true }
    );
    if (!variationType) return res.status(404).json({ success: false, message: "Variation Type not found" });
    res.status(200).json({ success: true, data: variationType });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteVariationType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await VariationType.findOneAndDelete({ _id: id, createdBy: "Admin" });
    res.status(200).json({ success: true, message: "Variation Type deleted" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
