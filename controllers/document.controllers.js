const Document = require("../models/document.model.js");

// Create new document
const createDocument = async (req, res) => {
    const { title, content } = req.body;

    try {
        const document = new Document({
            ownerId: req.user._id,
            title: title || "เอกสารไม่มีชื่อ",
            content: content || ""
        });

        await document.save();

        return res.status(201).json({
            message: "Document created successfully",
            document: {
                id: document._id,
                title: document.title,
                content: document.content,
                createdAt: document.createdAt,
                updatedAt: document.updatedAt
            }
        });
    } catch (error) {
        console.log(error);
        if (error.name === "ValidationError") {
            return res.status(400).json({ message: error.message, code: "VALIDATION_ERROR" });
        }
        return res.status(500).json({ message: "Internal server error", code: "INTERNAL_ERROR" });
    }
};

// List user's documents
const getDocuments = async (req, res) => {
    const { page = 1, limit = 20, sort = "-updatedAt" } = req.query;

    try {
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const documents = await Document.find({ ownerId: req.user._id })
            .select("title content updatedAt")
            .sort(sort)
            .skip(skip)
            .limit(limitNum);

        const total = await Document.countDocuments({ ownerId: req.user._id });

        const items = documents.map(doc => ({
            id: doc._id,
            title: doc.title,
            snippet: doc.content.substring(0, 120).replace(/\n/g, " "),
            updatedAt: doc.updatedAt
        }));

        return res.status(200).json({
            message: "Documents retrieved successfully",
            items,
            page: pageNum,
            limit: limitNum,
            total
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal server error", code: "INTERNAL_ERROR" });
    }
};

// Get single document
const getDocument = async (req, res) => {
    const { id } = req.params;

    try {
        const document = await Document.findById(id);

        if (!document) {
            return res.status(404).json({ message: "Document not found", code: "NOT_FOUND" });
        }

        // Check ownership
        if (document.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
        }

        return res.status(200).json({
            message: "Document retrieved successfully",
            document: {
                id: document._id,
                title: document.title,
                content: document.content,
                createdAt: document.createdAt,
                updatedAt: document.updatedAt
            }
        });
    } catch (error) {
        console.log(error);
        if (error.name === "CastError") {
            return res.status(404).json({ message: "Document not found", code: "NOT_FOUND" });
        }
        return res.status(500).json({ message: "Internal server error", code: "INTERNAL_ERROR" });
    }
};

// Update document
const updateDocument = async (req, res) => {
    const { id } = req.params;
    const { title, content } = req.body;

    // Validate: title cannot be empty string if provided
    if (title !== undefined && title.trim() === "") {
        return res.status(400).json({ message: "Title cannot be empty", code: "VALIDATION_ERROR" });
    }

    try {
        const document = await Document.findById(id);

        if (!document) {
            return res.status(404).json({ message: "Document not found", code: "NOT_FOUND" });
        }

        // Check ownership
        if (document.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
        }

        // Update fields
        if (title !== undefined) document.title = title;
        if (content !== undefined) document.content = content;

        await document.save();

        return res.status(200).json({
            message: "Document updated successfully",
            document: {
                id: document._id,
                title: document.title,
                content: document.content,
                createdAt: document.createdAt,
                updatedAt: document.updatedAt
            }
        });
    } catch (error) {
        console.log(error);
        if (error.name === "CastError") {
            return res.status(404).json({ message: "Document not found", code: "NOT_FOUND" });
        }
        if (error.name === "ValidationError") {
            return res.status(400).json({ message: error.message, code: "VALIDATION_ERROR" });
        }
        return res.status(500).json({ message: "Internal server error", code: "INTERNAL_ERROR" });
    }
};

// Delete document
const deleteDocument = async (req, res) => {
    const { id } = req.params;

    try {
        const document = await Document.findById(id);

        if (!document) {
            return res.status(404).json({ message: "Document not found", code: "NOT_FOUND" });
        }

        // Check ownership
        if (document.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
        }

        await Document.findByIdAndDelete(id);

        return res.status(200).json({ message: "Document deleted successfully" });
    } catch (error) {
        console.log(error);
        if (error.name === "CastError") {
            return res.status(404).json({ message: "Document not found", code: "NOT_FOUND" });
        }
        return res.status(500).json({ message: "Internal server error", code: "INTERNAL_ERROR" });
    }
};

module.exports = {
    createDocument,
    getDocuments,
    getDocument,
    updateDocument,
    deleteDocument
};
