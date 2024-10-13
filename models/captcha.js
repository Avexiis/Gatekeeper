const mongoose = require('mongoose');

const captchaSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    captchaText: { type: String, required: true },
    expirationTime: { type: Number, required: true },
    captchaPath: { type: String, required: true },
});

module.exports = mongoose.model('Captcha', captchaSchema);
