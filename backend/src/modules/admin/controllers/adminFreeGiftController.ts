import { Request, Response } from 'express';
import FreeGiftRule from '../../../models/FreeGiftRule';
import {
  calculateCartRuleDiscount,
  serializeFreeGiftRule,
} from '../../../services/cartRuleService';

function validateRulePayload(body: any): string | null {
  const minCartValue = Number(body.minCartValue);
  if (!Number.isFinite(minCartValue) || minCartValue <= 0) {
    return 'Minimum cart value must be greater than 0';
  }

  const ruleType = body.ruleType === 'discount' ? 'discount' : 'free_gift';

  if (ruleType === 'free_gift') {
    if (!body.giftProductId) {
      return 'Please select a gift product';
    }
    return null;
  }

  const discountType = body.discountType;
  const discountValue = Number(body.discountValue);
  if (discountType !== 'fixed' && discountType !== 'percentage') {
    return 'Please select a valid discount type';
  }
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    return 'Discount value must be greater than 0';
  }
  if (discountType === 'percentage' && discountValue > 100) {
    return 'Percentage discount cannot exceed 100%';
  }

  return null;
}

function buildRulePayload(body: any) {
  const ruleType = body.ruleType === 'discount' ? 'discount' : 'free_gift';
  const payload: Record<string, unknown> = {
    minCartValue: Number(body.minCartValue),
    ruleType,
    status: body.status === 'Inactive' ? 'Inactive' : 'Active',
  };

  if (ruleType === 'free_gift') {
    payload.giftProductId = body.giftProductId;
    payload.discountType = undefined;
    payload.discountValue = undefined;
  } else {
    payload.giftProductId = undefined;
    payload.discountType = body.discountType;
    payload.discountValue = Number(body.discountValue);
  }

  return payload;
}

export const createFreeGiftRule = async (req: Request, res: Response) => {
  try {
    const validationError = validateRulePayload(req.body);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const rule = new FreeGiftRule(buildRulePayload(req.body));
    await rule.save();
    const populatedRule = await rule.populate('giftProductId');

    res.status(201).json({ success: true, data: serializeFreeGiftRule(populatedRule) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFreeGiftRules = async (_req: Request, res: Response) => {
  try {
    const rules = await FreeGiftRule.find().populate('giftProductId').sort({ minCartValue: 1 });
    res.status(200).json({
      success: true,
      data: rules.map(serializeFreeGiftRule),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateFreeGiftRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validationError = validateRulePayload(req.body);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const rule = await FreeGiftRule.findByIdAndUpdate(id, buildRulePayload(req.body), {
      new: true,
    }).populate('giftProductId');

    if (!rule) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }

    res.status(200).json({ success: true, data: serializeFreeGiftRule(rule) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteFreeGiftRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await FreeGiftRule.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Rule deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export { calculateCartRuleDiscount };
