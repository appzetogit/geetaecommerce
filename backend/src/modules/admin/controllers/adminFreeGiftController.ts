import { Request, Response } from 'express';
import FreeGiftRule from '../../../models/FreeGiftRule';

export const createFreeGiftRule = async (req: Request, res: Response) => {
  try {
    const { minCartValue, giftProductId, status } = req.body;

    // Optional: If we want to enforce single active rule logic, we can do it here.
    // The user requirement seems to imply multi-tier "progress bar", so multiple active rules are fine.
    // e.g. 200 -> Gift A, 500 -> Gift B.

    const rule = new FreeGiftRule({
      minCartValue,
      giftProductId,
      status
    });

    await rule.save();
    const populatedRule = await rule.populate('giftProductId');

    res.status(201).json({ success: true, data: populatedRule });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFreeGiftRules = async (req: Request, res: Response) => {
  try {
    const rules = await FreeGiftRule.find().populate('giftProductId').sort({ minCartValue: 1 });
    res.status(200).json({ success: true, data: rules });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateFreeGiftRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rule = await FreeGiftRule.findByIdAndUpdate(id, req.body, { new: true }).populate('giftProductId');

    if (!rule) {
      return res.status(404).json({ success: false, message: "Rule not found" });
    }

    res.status(200).json({ success: true, data: rule });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteFreeGiftRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await FreeGiftRule.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "Rule deleted" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
