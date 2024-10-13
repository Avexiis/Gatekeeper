const mongoose = require('mongoose');

const guildConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    verifiedRoleId: { type: String, required: true },
    panelMessage: { type: String, required: true },
    timer: { type: Number, required: true },
});

module.exports = mongoose.model('GuildConfig', guildConfigSchema);
