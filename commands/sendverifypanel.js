// commands/sendverifypanel.js

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../models/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sendverifypanel')
        .setDescription('Send the verification panel to a specified channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send the verification panel to')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Restrict to admins
    async execute(interaction) {
        // Check for Administrator permission
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            return;
        }

        const channel = interaction.options.getChannel('channel');

        // Fetch the guild configuration
        const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
        if (!guildConfig) {
            await interaction.reply({ content: 'The bot is not configured for this server. Please use the /config command first.', ephemeral: true });
            return;
        }

        // Create the verification panel
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

        const verifyButton = new ButtonBuilder()
            .setCustomId('verify_button')
            .setLabel('Verify')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(verifyButton);

        const embed = new EmbedBuilder()
            .setTitle('Verification')
            .setDescription(guildConfig.panelMessage)
            .setColor(0x00AE86);

        await channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: 'Verification panel has been sent.', ephemeral: true });
    },
};
