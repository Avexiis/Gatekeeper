// models/verificationLog.js

const mongoose = require('mongoose');

const verificationLogSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    username: { type: String, required: true },
    discriminator: { type: String, required: true },
    guildId: { type: String, required: true },
    guildName: { type: String, required: true },
    verifiedAt: { type: Date, default: Date.now },
}, { collection: 'GatekeeperVerificationLogs' });

module.exports = mongoose.model('VerificationLog', verificationLogSchema);
