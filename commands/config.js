const { SlashCommandBuilder } = require('discord.js');
const GuildConfig = require('../models/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Configure the verification settings')
        .addRoleOption(option =>
            option.setName('verifiedrole')
                .setDescription('The role to assign upon verification')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('panelmessage')
                .setDescription('The message to display on the verification panel')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('timer')
                .setDescription('CAPTCHA expiration time in minutes')
                .setRequired(true)),
    async execute(interaction) {
        if (!interaction.member.permissions.has('Administrator')) {
            await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            return;
        }

        const verifiedRole = interaction.options.getRole('verifiedrole');
        const panelMessage = interaction.options.getString('panelmessage');
        const timer = interaction.options.getInteger('timer');

        await GuildConfig.findOneAndUpdate(
            { guildId: interaction.guild.id },
            {
                verifiedRoleId: verifiedRole.id,
                panelMessage,
                timer,
            },
            { upsert: true }
        );

        await interaction.reply({ content: 'Configuration has been updated.', ephemeral: true });
    },
};
