/**
 * Centralized environment configuration loader.
 * Automatically selects the appropriate configuration based on NODE_ENV.
 */

const env = process.env.NODE_ENV || 'development';

const config = {
    development: {
        MONGODB_URI: process.env.MONGODB_URI_DEV || 'mongodb://127.0.0.1:27017/hs_lms_dev',
        CLIENT_URL: process.env.CLIENT_URL_DEV || 'http://localhost:3000',
        PORT: process.env.PORT || 5000,
        JWT_SECRET: process.env.JWT_SECRET || 'dev_secret_key_change_in_prod',
    },
    production: {
        MONGODB_URI: process.env.MONGODB_URI, 
        CLIENT_URL: process.env.CLIENT_URL || 'https://lms.hrutasolutions.com',
        PORT: process.env.PORT || 5000,
        JWT_SECRET: process.env.JWT_SECRET,
    }
};

const currentConfig = config[env];

// Common settings that don't change between environments (if any)
currentConfig.NODE_ENV = env;

module.exports = currentConfig;
