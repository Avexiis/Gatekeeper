// events/interactionCreate.js

const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    InteractionType,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const { unlink } = require('fs/promises');
const Captcha = require('../models/captcha');
const GuildConfig = require('../models/guildConfig');
const VerificationLog = require('../models/verificationLog'); // Import the VerificationLog model
const { generateCaptchaText, generateCaptchaImage } = require('../utils/captchaGenerator');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (interaction.isCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'There was an error executing this command.', ephemeral: true });
            }
        }

        // Handle button click for CAPTCHA verification
        else if (interaction.isButton()) {
            if (interaction.customId.startsWith('verify_button')) {
                const member = interaction.member;
                const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });

                if (!guildConfig) {
                    await interaction.reply({ content: 'Configuration not found. Please contact an administrator.', ephemeral: true });
                    return;
                }

                // Check if the user already has the verified role
                if (member.roles.cache.has(guildConfig.verifiedRoleId)) {
                    await interaction.reply({ content: 'You are already verified.', ephemeral: true });
                    return;
                }

                const timer = guildConfig.timer;

                // Check if the user already has an active CAPTCHA
                const existingCaptcha = await Captcha.findOne({ userId: interaction.user.id });
                if (existingCaptcha && Date.now() < existingCaptcha.expirationTime) {
                    // Send the existing CAPTCHA
                    const answerButton = new ButtonBuilder()
                        .setCustomId('solve_captcha')
                        .setLabel('Answer')
                        .setStyle(ButtonStyle.Success);

                    const newCaptchaButton = new ButtonBuilder()
                        .setCustomId('new_captcha')
                        .setLabel('New CAPTCHA')
                        .setStyle(ButtonStyle.Secondary);

                    const buttonRow = new ActionRowBuilder().addComponents(answerButton, newCaptchaButton);

                    await interaction.reply({
                        content: `You already have a CAPTCHA. You have ${Math.ceil((existingCaptcha.expirationTime - Date.now()) / 60000)} minutes remaining.`,
                        files: [{ attachment: existingCaptcha.captchaPath }],
                        components: [buttonRow],
                        ephemeral: true,
                    });
                    return;
                }

                // Generate CAPTCHA
                const captchaText = await generateCaptchaText(6);
                const captchaPath = await generateCaptchaImage(captchaText);

                // Store CAPTCHA in MongoDB
                const expirationTime = Date.now() + timer * 60 * 1000;
                await Captcha.findOneAndUpdate(
                    { userId: interaction.user.id },
                    { captchaText, expirationTime, captchaPath },
                    { upsert: true }
                );

                // Set a timeout to delete the CAPTCHA after expiration
                setTimeout(async () => {
                    const expiredCaptcha = await Captcha.findOne({ userId: interaction.user.id });
                    if (expiredCaptcha && Date.now() >= expiredCaptcha.expirationTime) {
                        try {
                            await unlink(expiredCaptcha.captchaPath);
                        } catch (error) {
                            console.error(`Failed to delete expired CAPTCHA image: ${error}`);
                        }
                        await Captcha.deleteOne({ userId: interaction.user.id });
                    }
                }, timer * 60 * 1000);

                // Send CAPTCHA to user
                const answerButton = new ButtonBuilder()
                    .setCustomId('solve_captcha')
                    .setLabel('Answer')
                    .setStyle(ButtonStyle.Success);

                const newCaptchaButton = new ButtonBuilder()
                    .setCustomId('new_captcha')
                    .setLabel('New CAPTCHA')
                    .setStyle(ButtonStyle.Secondary);

                const buttonRow = new ActionRowBuilder().addComponents(answerButton, newCaptchaButton);

                await interaction.reply({
                    content: `Press **"Answer"** to enter the CAPTCHA answer or **"New CAPTCHA"** to get a new one. You have ${timer} minutes to complete the CAPTCHA.`,
                    files: [{ attachment: captchaPath }],
                    components: [buttonRow],
                    ephemeral: true,
                });
            }

            // Handle "New CAPTCHA" button
            else if (interaction.customId === 'new_captcha') {
                const existingCaptcha = await Captcha.findOne({ userId: interaction.user.id });
                const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });

                if (!guildConfig) {
                    await interaction.reply({ content: 'Configuration not found. Please contact an administrator.', ephemeral: true });
                    return;
                }

                const timer = guildConfig.timer;

                // Delete old CAPTCHA image and data
                if (existingCaptcha) {
                    try {
                        await unlink(existingCaptcha.captchaPath);
                    } catch (error) {
                        console.error(`Failed to delete old CAPTCHA image: ${error}`);
                    }
                }

                // Generate new CAPTCHA
                const captchaText = await generateCaptchaText(6);
                const captchaPath = await generateCaptchaImage(captchaText);

                // Update CAPTCHA in MongoDB
                const expirationTime = Date.now() + timer * 60 * 1000;
                await Captcha.findOneAndUpdate(
                    { userId: interaction.user.id },
                    { captchaText, expirationTime, captchaPath },
                    { upsert: true }
                );

                // Set a new timeout for the new CAPTCHA
                setTimeout(async () => {
                    const expiredCaptcha = await Captcha.findOne({ userId: interaction.user.id });
                    if (expiredCaptcha && Date.now() >= expiredCaptcha.expirationTime) {
                        try {
                            await unlink(expiredCaptcha.captchaPath);
                        } catch (error) {
                            console.error(`Failed to delete expired CAPTCHA image: ${error}`);
                        }
                        await Captcha.deleteOne({ userId: interaction.user.id });
                    }
                }, timer * 60 * 1000);

                // Send new CAPTCHA to user
                const answerButton = new ButtonBuilder()
                    .setCustomId('solve_captcha')
                    .setLabel('Answer')
                    .setStyle(ButtonStyle.Success);

                const newCaptchaButton = new ButtonBuilder()
                    .setCustomId('new_captcha')
                    .setLabel('New CAPTCHA')
                    .setStyle(ButtonStyle.Secondary);

                const buttonRow = new ActionRowBuilder().addComponents(answerButton, newCaptchaButton);

                await interaction.update({
                    content: `Here is your new CAPTCHA. You have ${timer} minutes to complete it.`,
                    files: [{ attachment: captchaPath }],
                    components: [buttonRow],
                    ephemeral: true,
                });
            }

            // Handle "Answer" button
            else if (interaction.customId === 'solve_captcha') {
                const captchaData = await Captcha.findOne({ userId: interaction.user.id });

                if (!captchaData || Date.now() > captchaData.expirationTime) {
                    await interaction.reply({ content: 'The CAPTCHA has expired. Please click the verify button again to start over.', ephemeral: true });
                    if (captchaData && captchaData.captchaPath) {
                        try {
                            await unlink(captchaData.captchaPath);
                        } catch (error) {
                            console.error(`Failed to delete CAPTCHA image: ${error}`);
                        }
                        await Captcha.deleteOne({ userId: interaction.user.id });
                    }
                    return;
                }

                const modal = new ModalBuilder()
                    .setCustomId('captcha_modal')
                    .setTitle('CAPTCHA Verification');

                const captchaInput = new TextInputBuilder()
                    .setCustomId('captcha_input')
                    .setLabel('Enter the text from the CAPTCHA image:')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const row = new ActionRowBuilder().addComponents(captchaInput);
                modal.addComponents(row);

                await interaction.showModal(modal);
            }
        }

        // Handle CAPTCHA modal submission
        else if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'captcha_modal') {
            const captchaAnswer = interaction.fields.getTextInputValue('captcha_input');
            const captchaData = await Captcha.findOne({ userId: interaction.user.id });
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });

            if (!guildConfig) {
                await interaction.reply({ content: 'Configuration not found. Please contact an administrator.', ephemeral: true });
                return;
            }

            if (!captchaData || Date.now() > captchaData.expirationTime) {
                await interaction.reply({ content: 'The CAPTCHA has expired. Please click the verify button again to start over.', ephemeral: true });
                if (captchaData && captchaData.captchaPath) {
                    try {
                        await unlink(captchaData.captchaPath);
                    } catch (error) {
                        console.error(`Failed to delete CAPTCHA image: ${error}`);
                    }
                    await Captcha.deleteOne({ userId: interaction.user.id });
                }
                return;
            }

            if (captchaAnswer === captchaData.captchaText) {
                // Remove CAPTCHA from database and delete the image
                try {
                    await unlink(captchaData.captchaPath);
                } catch (error) {
                    console.error(`Failed to delete CAPTCHA image after verification: ${error}`);
                }
                await Captcha.deleteOne({ userId: interaction.user.id });

                try {
                    await interaction.member.roles.add(guildConfig.verifiedRoleId);
                    await interaction.reply({ content: 'You have been verified!', ephemeral: true });

                    // Log the verification event
                    const verificationLog = new VerificationLog({
                        userId: interaction.user.id,
                        username: interaction.user.username,
                        discriminator: interaction.user.discriminator,
                        guildId: interaction.guild.id,
                        guildName: interaction.guild.name,
                    });
                    await verificationLog.save();

                    console.log(`User ${interaction.user.tag} has been verified in server "${interaction.guild.name}" (ID: ${interaction.guild.id})`);

                } catch (error) {
                    if (error.code === 50013) {
                        await interaction.reply({ content: 'I do not have permission to assign the verified role. Please contact a server administrator.', ephemeral: true });
                    } else {
                        console.error('Failed to assign role:', error);
                        await interaction.reply({ content: 'An error occurred while assigning your role. Please try again later.', ephemeral: true });
                    }
                }
            } else {
                await interaction.reply({ content: 'Incorrect CAPTCHA. Please try again.', ephemeral: true });
            }
        }
    },
};
