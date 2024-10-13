// commands/config.js

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../models/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Configure the verification settings')
        // Required options first
        .addRoleOption(option =>
            option.setName('role1')
                .setDescription('The first role to assign upon verification')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('panelmessage')
                .setDescription('The message to display on the verification panel')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('timer')
                .setDescription('CAPTCHA expiration time in minutes')
                .setRequired(true))
        // Optional options after required ones
        .addRoleOption(option =>
            option.setName('role2')
                .setDescription('An additional role to assign upon verification')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('role3')
                .setDescription('An additional role to assign upon verification')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('role4')
                .setDescription('An additional role to assign upon verification')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('role5')
                .setDescription('An additional role to assign upon verification')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        // Check for Administrator permission
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            return;
        }

        // Get the role options
        const role1 = interaction.options.getRole('role1');
        const role2 = interaction.options.getRole('role2');
        const role3 = interaction.options.getRole('role3');
        const role4 = interaction.options.getRole('role4');
        const role5 = interaction.options.getRole('role5');

        const panelMessage = interaction.options.getString('panelmessage');
        const timer = interaction.options.getInteger('timer');

        // Collect all the role IDs into an array
        const roles = [role1, role2, role3, role4, role5].filter(Boolean);
        const roleIds = roles.map(role => role.id);

        // Update the GuildConfig in the database
        await GuildConfig.findOneAndUpdate(
            { guildId: interaction.guild.id },
            {
                verifiedRoleIds: roleIds,
                panelMessage,
                timer,
            },
            { upsert: true }
        );

        await interaction.reply({ content: 'Configuration has been updated.', ephemeral: true });
    },
};
