import { Request, Response } from "express";
import Attribute from "../../../models/Attribute";

export const createAttribute = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Name is required" });

    const attribute = new Attribute({ name });
    await attribute.save();
    res.status(201).json({ success: true, data: attribute });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAttributes = async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search) {
      query = { name: { $regex: search, $options: "i" } };
    }
    const attributes = await Attribute.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: attributes });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAttribute = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const attribute = await Attribute.findByIdAndUpdate(id, { name }, { new: true });
    if (!attribute) return res.status(404).json({ success: false, message: "Attribute not found" });
    res.status(200).json({ success: true, data: attribute });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAttribute = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await Attribute.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "Attribute deleted" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
