const GlobalAnnouncement = require('../models/GlobalAnnouncement');

// Get active global announcement (Public)
exports.getActiveAnnouncement = async (req, res) => {
    try {
        const announcement = await GlobalAnnouncement.findOne({ isActive: true }).sort({ updatedAt: -1 });
        res.json({ success: true, data: announcement });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Create/Update global announcement (Super Admin)
exports.updateGlobalAnnouncement = async (req, res) => {
    try {
        const { title, description, thumbnail, link, type, refId, isActive } = req.body;

        // If this one is being set to active, deactivate all others
        if (isActive) {
            await GlobalAnnouncement.updateMany({}, { isActive: false });
        }

        // We only keep one main global announcement record for simplicity, or create new ones
        // For now, let's just update the single active one or create if none exists
        let announcement = await GlobalAnnouncement.findOne();
        
        if (announcement) {
            announcement.title = title;
            announcement.description = description;
            announcement.thumbnail = thumbnail;
            announcement.link = link;
            announcement.type = type;
            announcement.refId = refId;
            announcement.isActive = isActive;
            await announcement.save();
        } else {
            announcement = await GlobalAnnouncement.create({
                title, description, thumbnail, link, type, refId, isActive
            });
        }

        res.json({ success: true, data: announcement, message: 'Global announcement updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Toggle announcement status
exports.toggleAnnouncementStatus = async (req, res) => {
    try {
        const announcement = await GlobalAnnouncement.findOne();
        if (!announcement) return res.status(404).json({ success: false, message: 'No announcement found' });

        announcement.isActive = !announcement.isActive;
        await announcement.save();

        res.json({ success: true, message: `Announcement ${announcement.isActive ? 'activated' : 'deactivated'}` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
