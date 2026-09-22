const Testimonial = require("../models/Testimonial");
const HomeStat = require("../models/HomeStat");

const sortByDisplayOrder = { displayOrder: 1, createdAt: -1 };

const getPublicHomeContent = async (req, res) => {
    const [testimonials, stats] = await Promise.all([
        Testimonial.find({ isActive: true }).sort(sortByDisplayOrder).lean(),
        HomeStat.find({ isActive: true }).sort(sortByDisplayOrder).lean(),
    ]);

    res.json({ success: true, testimonials, stats });
};

const getTestimonials = async (req, res) => {
    const testimonials = await Testimonial.find().sort(sortByDisplayOrder).lean();
    res.json({ success: true, testimonials });
};

const createTestimonial = async (req, res) => {
    const { name, role, comment, initials, isActive = true, displayOrder = 0 } = req.body;

    if (!name?.trim() || !role?.trim() || !comment?.trim()) {
        return res.status(400).json({ success: false, message: "Name, role and comment are required." });
    }

    const generatedInitials = initials?.trim() || name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("");

    const testimonial = await Testimonial.create({
        name,
        role,
        comment,
        initials: generatedInitials,
        isActive,
        displayOrder,
    });

    res.status(201).json({ success: true, testimonial });
};

const updateTestimonial = async (req, res) => {
    const testimonial = await Testimonial.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });

    if (!testimonial) {
        return res.status(404).json({ success: false, message: "Testimonial not found." });
    }

    res.json({ success: true, testimonial });
};

const deleteTestimonial = async (req, res) => {
    const testimonial = await Testimonial.findByIdAndDelete(req.params.id);

    if (!testimonial) {
        return res.status(404).json({ success: false, message: "Testimonial not found." });
    }

    res.json({ success: true, message: "Testimonial deleted successfully." });
};

const getStats = async (req, res) => {
    const stats = await HomeStat.find().sort(sortByDisplayOrder).lean();
    res.json({ success: true, stats });
};

const createStat = async (req, res) => {
    const { label, value, description = "", isActive = true, displayOrder = 0 } = req.body;

    if (!label?.trim() || !value?.trim()) {
        return res.status(400).json({ success: false, message: "Label and value are required." });
    }

    const stat = await HomeStat.create({ label, value, description, isActive, displayOrder });
    res.status(201).json({ success: true, stat });
};

const updateStat = async (req, res) => {
    const stat = await HomeStat.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });

    if (!stat) {
        return res.status(404).json({ success: false, message: "Stat not found." });
    }

    res.json({ success: true, stat });
};

const deleteStat = async (req, res) => {
    const stat = await HomeStat.findByIdAndDelete(req.params.id);

    if (!stat) {
        return res.status(404).json({ success: false, message: "Stat not found." });
    }

    res.json({ success: true, message: "Stat deleted successfully." });
};

module.exports = {
    getPublicHomeContent,
    getTestimonials,
    createTestimonial,
    updateTestimonial,
    deleteTestimonial,
    getStats,
    createStat,
    updateStat,
    deleteStat,
};
