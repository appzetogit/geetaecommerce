import { Request, Response } from "express";
import HomeSection from "../../../models/HomeSection";
import mongoose from "mongoose";

// Get all home sections
export const getHomeSections = async (_req: Request, res: Response) => {
    try {
        const sections = await HomeSection.find()
            .populate("categories", "name slug image")
            .populate("subCategories", "name")
            .sort({ order: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: sections,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error fetching home sections",
            error: error.message,
        });
    }
};

// Get single home section by ID
export const getHomeSectionById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid section ID",
            });
        }

        const section = await HomeSection.findById(id)
            .populate("category", "name slug image")
            .populate("subCategory", "name")
            .lean();

        if (!section) {
            return res.status(404).json({
                success: false,
                message: "Home section not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: section,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error fetching home section",
            error: error.message,
        });
    }
};

// Create new home section
export const createHomeSection = async (req: Request, res: Response) => {
    try {
        const { title, slug, categories, subCategories, displayType, columns, limit, order, isActive } = req.body;

        // Validate required fields
        if (!title || !slug || !displayType) {
            return res.status(400).json({
                success: false,
                message: "Title, slug, and display type are required",
            });
        }

        // Check if slug already exists
        const existingSection = await HomeSection.findOne({ slug });
        if (existingSection) {
            return res.status(400).json({
                success: false,
                message: "A section with this slug already exists",
            });
        }

        // If no order specified, set it to the end
        let sectionOrder = order;
        if (sectionOrder === undefined || sectionOrder === null) {
            const maxOrderSection = await HomeSection.findOne().sort({ order: -1 }).lean();
            sectionOrder = maxOrderSection ? maxOrderSection.order + 1 : 0;
        }

        const newSection = new HomeSection({
            title,
            slug,
            categories: categories || [],
            subCategories: subCategories || [],
            displayType,
            columns: columns || 4,
            limit: limit || 8,
            order: sectionOrder,
            isActive: isActive !== undefined ? isActive : true,
        });

        await newSection.save();

        const populatedSection = await HomeSection.findById(newSection._id)
            .populate("category", "name slug image")
            .populate("subCategory", "name")
            .lean();

        return res.status(201).json({
            success: true,
            message: "Home section created successfully",
            data: populatedSection,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error creating home section",
            error: error.message,
        });
    }
};

// Update home section
export const updateHomeSection = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { title, slug, categories, subCategories, displayType, columns, limit, order, isActive } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid section ID",
            });
        }

        const section = await HomeSection.findById(id);
        if (!section) {
            return res.status(404).json({
                success: false,
                message: "Home section not found",
            });
        }

        // Check if slug is being changed and if it already exists
        if (slug && slug !== section.slug) {
            const existingSection = await HomeSection.findOne({ slug });
            if (existingSection) {
                return res.status(400).json({
                    success: false,
                    message: "A section with this slug already exists",
                });
            }
        }

        // Update fields
        if (title !== undefined) section.title = title;
        if (slug !== undefined) section.slug = slug;
        if (categories !== undefined) section.categories = categories || [];
        if (subCategories !== undefined) section.subCategories = subCategories || [];
        if (displayType !== undefined) section.displayType = displayType;
        if (columns !== undefined) section.columns = columns;
        if (limit !== undefined) section.limit = limit;
        if (order !== undefined) section.order = order;
        if (isActive !== undefined) section.isActive = isActive;

        await section.save();

        const updatedSection = await HomeSection.findById(id)
            .populate("category", "name slug image")
            .populate("subCategory", "name")
            .lean();

        return res.status(200).json({
            success: true,
            message: "Home section updated successfully",
            data: updatedSection,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error updating home section",
            error: error.message,
        });
    }
};

// Delete home section
export const deleteHomeSection = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid section ID",
            });
        }

        const section = await HomeSection.findByIdAndDelete(id);
        if (!section) {
            return res.status(404).json({
                success: false,
                message: "Home section not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Home section deleted successfully",
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error deleting home section",
            error: error.message,
        });
    }
};

// Reorder home sections
export const reorderHomeSections = async (req: Request, res: Response) => {
    try {
        const { sections } = req.body; // Array of { id, order }

        if (!Array.isArray(sections)) {
            return res.status(400).json({
                success: false,
                message: "Sections must be an array",
            });
        }

        // Update order for each section
        const updatePromises = sections.map(({ id, order }) => {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw new Error(`Invalid section ID: ${id}`);
            }
            return HomeSection.findByIdAndUpdate(id, { order }, { new: true });
        });

        await Promise.all(updatePromises);

        const updatedSections = await HomeSection.find()
            .populate("category", "name slug image")
            .populate("subCategory", "name")
            .sort({ order: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            message: "Sections reordered successfully",
            data: updatedSections,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error reordering sections",
            error: error.message,
        });
    }
};
