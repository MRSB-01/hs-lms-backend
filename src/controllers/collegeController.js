const College = require('../models/College');

exports.requestAccess = async (req, res) => {
    try {
        const { name, contactEmail, contactPhone, address } = req.body;
        
        // Check if college already exists
        const exists = await College.findOne({ contactEmail });
        if (exists) return res.status(400).json({ success: false, message: 'Request already submitted for this email' });

        const college = await College.create({
            collegeName: name,
            contactEmail,
            contactPhone,
            address,
            code: 'REQ-' + Math.random().toString(36).substring(2, 8).toUpperCase()
        });

        res.status(201).json({ 
            success: true, 
            message: 'Request submitted successfully. Super Admin will review it.', 
            data: college 
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getRequestStatus = async (req, res) => {
    try {
        const { email } = req.query;
        const college = await College.findOne({ contactEmail: email });
        if (!college) return res.status(404).json({ success: false, message: 'Request not found' });
        res.json({ success: true, status: college.status });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
