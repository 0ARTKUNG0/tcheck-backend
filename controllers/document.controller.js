const Document = require("../models/document.model.js");

const MAX_CORRECTIONS = 12;

function validateCorrections(corrections) {
    if (!Array.isArray(corrections)) {
        return { valid: false, error: "corrections must be an array" };
    }

    for (let i = 0; i < corrections.length; i++) {
        const corr = corrections[i];
        if (typeof corr !== 'object' || corr === null) {
            return { valid: false, error: `correction[${i}] must be an object` };
        }
        if (typeof corr.span !== 'string' || !corr.span) {
            return { valid: false, error: `correction[${i}].span must be a non-empty string` };
        }
        if (typeof corr.replacement !== 'string' || !corr.replacement) {
            return { valid: false, error: `correction[${i}].replacement must be a non-empty string` };
        }
        if (typeof corr.reason !== 'string' || !corr.reason) {
            return { valid: false, error: `correction[${i}].reason must be a non-empty string` };
        }
    }

    return { valid: true };
}

const createDocument = async (req, res) => {
    const { title, content, corrections } = req.body;

    if (corrections !== undefined) {
        const validation = validateCorrections(corrections);
        if (!validation.valid) {
            return res.status(400).json({
                code: "VALIDATION_ERROR",
                message: validation.error
            });
        }
    }

    try {
        const document = new Document({
            ownerId: req.user._id,
            title: title || "เอกสารไม่มีชื่อ",
            content: content || "",
            corrections: (corrections || []).slice(-MAX_CORRECTIONS)
        });

        await document.save();

        return res.status(201).json({
            message: "Document created successfully",
            document: {
                id: document._id,
                title: document.title,
                content: document.content,
                corrections: document.corrections,
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

const getDocuments = async (req, res) => {
    const { page = 1, limit = 20, sort = "-updatedAt" } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json({
            code: "VALIDATION_ERROR",
            message: "page must be a positive integer"
        });
    }

    if (isNaN(limitNum) || limitNum < 1) {
        return res.status(400).json({
            code: "VALIDATION_ERROR",
            message: "limit must be a positive integer"
        });
    }

    if (limitNum > 100) {
        return res.status(400).json({
            code: "VALIDATION_ERROR",
            message: "limit cannot exceed 100"
        });
    }

    const allowedSorts = ["updatedAt", "-updatedAt", "createdAt", "-createdAt", "title", "-title"];
    if (!allowedSorts.includes(sort)) {
        return res.status(400).json({
            code: "VALIDATION_ERROR",
            message: `sort must be one of: ${allowedSorts.join(", ")}`
        });
    }

    try {
        const skip = (pageNum - 1) * limitNum;

        const documents = await Document.find({ ownerId: req.user._id })
            .select("title content corrections updatedAt")
            .sort(sort)
            .skip(skip)
            .limit(limitNum);
        const total = await Document.countDocuments({ ownerId: req.user._id });
        const items = documents.map(doc => ({
            id: doc._id,
            title: doc.title,
            snippet: doc.content.substring(0, 120).replace(/\n/g, " "),
            correctionsCount: doc.corrections.length,
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
                corrections: document.corrections,
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

const updateDocument = async (req, res) => {
    const { id } = req.params;
    const { title, content, corrections } = req.body;

    if (title !== undefined) {
        if (typeof title !== 'string') {
            return res.status(400).json({
                code: "VALIDATION_ERROR",
                message: "title must be a string"
            });
        }
        if (title.trim() === "") {
            return res.status(400).json({
                code: "VALIDATION_ERROR",
                message: "title cannot be empty"
            });
        }
    }

    if (corrections !== undefined) {
        const validation = validateCorrections(corrections);
        if (!validation.valid) {
            return res.status(400).json({
                code: "VALIDATION_ERROR",
                message: validation.error
            });
        }
    }

    try {
        const document = await Document.findById(id);
        if (!document) {
            return res.status(404).json({ code: "NOT_FOUND", message: "Document not found" });
        }

        if (document.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ code: "FORBIDDEN", message: "Access denied" });
        }

        if (title !== undefined) document.title = title;
        if (content !== undefined) document.content = content;
        if (corrections !== undefined) {
            const merged = [...document.corrections, ...corrections];
            document.corrections = merged.slice(-MAX_CORRECTIONS);
        }

        await document.save();
        return res.status(200).json({
            message: "Document updated successfully",
            document: {
                id: document._id,
                title: document.title,
                content: document.content,
                corrections: document.corrections,
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
