const CryptoJS = require('crypto-js');

const SECRET = process.env.JWT_SECRET || 'fallback-secret-key-hs-lms';

const encrypt = (text) => {
    return CryptoJS.AES.encrypt(text, SECRET).toString();
};

const decrypt = (ciphertext) => {
    if (!ciphertext) return null;
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        return null;
    }
};

module.exports = { encrypt, decrypt };
