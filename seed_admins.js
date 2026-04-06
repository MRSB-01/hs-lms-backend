require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const envConfig = require('./src/config/envConfig');

async function seedAdmins() {
    try {
        console.log('--- Connecting to:', envConfig.MONGODB_URI);
        await mongoose.connect(envConfig.MONGODB_URI);
        console.log('--- Connected to MongoDB ---');

        // Remove existing super admin if exists
        const delResult = await User.deleteOne({ email: 'super@hslms.com' });
        console.log('--- Deleted old admin (super@hslms.com):', delResult.deletedCount);
        
        // Also remove if hrutasolutions already exists to ensure fresh password
        await User.deleteOne({ email: 'hrutasolutions@gmail.com' });

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
                email: 'hrutasolutions@gmail.com',
                password: 'System@Provider@2026',
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
