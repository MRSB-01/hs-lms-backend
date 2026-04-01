const mongoose = require('mongoose');
const User = require('./src/models/User');
require('dotenv').config();

async function listAdmins() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const admins = await User.find({ role: { $in: ['administrator', 'super_admin'] } });
        console.log('Admins found:', JSON.stringify(admins, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

listAdmins();
