// models/guildConfig.js

const mongoose = require('mongoose');

const guildConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    verifiedRoleIds: { type: [String], required: true }, // Changed to an array of role IDs
    panelMessage: { type: String, required: true },
    timer: { type: Number, required: true },
}, { collection: 'GatekeeperGuildConfigs' });

module.exports = mongoose.model('GuildConfig', guildConfigSchema);
