const mongoose = require('mongoose');
const User = require('./src/models/User');
require('dotenv').config();

async function seedAdmins() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('--- Connected to MongoDB ---');

        const admins = [
            {
                name: 'System Administrator',
                email: 'manu2004@gmail.com',
                password: 'Manu@2004',
                role: 'administrator',
                isVerified: true
            },
            {
                name: 'Super Admin',
                email: 'super@hslms.com',
                password: 'Provider@2026',
                role: 'super_admin',
                isVerified: true
            }
        ];

        for (const adminData of admins) {
            const exists = await User.findOne({ email: adminData.email });
            if (exists) {
                //console.log(`User ${adminData.email} already exists. Updating...`);
                // Update password (will be hashed by pre-save hook)
                exists.name = adminData.name;
                exists.password = adminData.password;
                exists.role = adminData.role;
                exists.isVerified = true;
                await exists.save();
                //console.log(`User ${adminData.email} updated successfully.`);
            } else {
                // Create new user (password will be hashed by pre-save hook)
                await User.create(adminData);
                //console.log(`User ${adminData.email} created successfully.`);
            }
        }

        console.log('--- Admin Seeding Completed ---');
        process.exit(0);
    } catch (err) {
        console.error('Seeding Error:', err);
        process.exit(1);
    }
}

seedAdmins();
