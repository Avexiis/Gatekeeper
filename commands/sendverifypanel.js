const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const GuildConfig = require('../models/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sendverifypanel')
        .setDescription('Send the verification panel to a specified channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send the verification panel')
                .setRequired(true)),
    async execute(interaction) {
        // Check if the user has permission to manage the server
        if (!interaction.member.permissions.has('Administrator')) {
            await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            return;
        }

        const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
        if (!guildConfig) {
            await interaction.reply({ content: 'Please configure the bot using `/config` command before sending the verification panel.', ephemeral: true });
            return;
        }

        const channel = interaction.options.getChannel('channel');

        const embed = new EmbedBuilder()
            .setTitle('Verification')
            .setDescription(guildConfig.panelMessage)
            .setColor('Red');

        const button = new ButtonBuilder()
            .setCustomId(`verify_button_${guildConfig.timer}`)
            .setLabel('Verify')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        await channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: 'Verification panel has been set up.', ephemeral: true });
    },
};
