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

let activeVerification = {}; // Object to track active verification sessions per user
let userRetryCount = {}; // Track retry counts for rate limiting

// Rate limit settings
const retryLimit = 5;
const retryWindow = 60000; // 1 minute in milliseconds

// Check if the user is still in the server
async function isUserInGuild(guild, userId) {
    try {
        const member = await guild.members.fetch(userId);
        return !!member;
    } catch (error) {
        return false; // User is no longer in the guild
    }
}

// Retry request logic only for API errors like 503
async function retryRequest(func, interaction, maxAttempts = 5) {
    let attempt = 0;
    const userId = interaction.user.id;
    const guild = interaction.guild;

    while (attempt < maxAttempts && activeVerification[userId]) {
        try {
            // Check if the user is still in the server before proceeding
            const isInGuild = await isUserInGuild(guild, userId);
            if (!isInGuild) {
                console.log(`User ${interaction.user.tag} left the server. Stopping verification process.`);
                delete activeVerification[userId]; // Clean up active verification
                return; // Terminate process
            }

            return await func(); // Try executing the passed function
        } catch (error) {
            // Retry only on recoverable API errors (like 503)
            if (error.status === 503) {
                attempt++;
                console.error(`API error (503) detected. Attempt ${attempt}, retrying...`);
            } else {
                throw error; // Non-retryable errors, stop retrying
            }
        }
    }

    // If max attempts exceeded, send an error message with a "Retry" button
    if (attempt >= maxAttempts) {
        console.log(`Max retries exceeded for user ${interaction.user.tag}. Sending error message and restarting process.`);

        // Delete the old CAPTCHA if it exists
        const existingCaptcha = await Captcha.findOne({ userId: userId });
        if (existingCaptcha) {
            try {
                await unlink(existingCaptcha.captchaPath);
            } catch (error) {
                console.error(`Failed to delete old CAPTCHA image: ${error}`);
            }
            await Captcha.deleteOne({ userId: userId });
        }

        // Send an ephemeral message with a "Retry" button
        await interaction.reply({
            content: 'There was an unexpected error. Please try again with a fresh CAPTCHA.',
            ephemeral: true,
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('retry_captcha')
                        .setLabel('Retry')
                        .setStyle(ButtonStyle.Primary)
                )
            ]
        });
        delete activeVerification[userId]; // Reset active verification on failure
    }
}

// Function to show CAPTCHA modal with retry logic
async function showCaptchaModal(interaction) {
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

    try {
        await interaction.showModal(modal); // Display the CAPTCHA modal
    } catch (error) {
        console.error('Failed to show CAPTCHA modal:', error);
    }
}

// Restart the CAPTCHA process when retries fail or user clicks "Retry"
async function restartCaptchaProcess(interaction) {
    const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
    if (!guildConfig) {
        await interaction.reply({
            content: 'Configuration not found. Please contact an administrator.',
            ephemeral: true,
        });
        delete activeVerification[interaction.user.id];
        return;
    }

    const timer = guildConfig.timer;

    // Generate new CAPTCHA
    const captchaText = await generateCaptchaText(6);
    const captchaPath = await generateCaptchaImage(captchaText);

    // Store CAPTCHA in MongoDB
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

    // Send the new CAPTCHA to the user
    const answerButton = new ButtonBuilder()
        .setCustomId('solve_captcha')
        .setLabel('Answer')
        .setStyle(ButtonStyle.Success);

    const newCaptchaButton = new ButtonBuilder()
        .setCustomId('new_captcha')
        .setLabel('New CAPTCHA')
        .setStyle(ButtonStyle.Secondary);

    const buttonRow = new ActionRowBuilder().addComponents(answerButton, newCaptchaButton);

    // Use interaction.editReply() instead of interaction.update() to avoid double responses
    await interaction.editReply({
        content: `Here is your new CAPTCHA. You have ${timer} minutes to complete it.`,
        files: [{ attachment: captchaPath }],
        components: [buttonRow],
        ephemeral: true,
    });
}

// Handle the "Retry" button click to restart CAPTCHA
async function handleRetryButton(interaction) {
    await restartCaptchaProcess(interaction);
}

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
            const userId = interaction.user.id;

            if (interaction.customId === 'retry_captcha') {
                await handleRetryButton(interaction); // Retry button handler
                return;
            }

            // Handle CAPTCHA process for "Answer" and "New CAPTCHA" buttons as part of the same verification session
            if (interaction.customId === 'solve_captcha') {
                // Show CAPTCHA modal directly without deferring the update
                await showCaptchaModal(interaction);
                return;
            }

            if (interaction.customId === 'new_captcha') {
                // Acknowledge interaction, delete old CAPTCHA, and send a new one
                await interaction.deferUpdate();
                await restartCaptchaProcess(interaction);
                return;
            }

            // Prevent race conditions and abuse (no multiple CAPTCHA requests)
            if (interaction.customId.startsWith('verify_button') && activeVerification[userId]) {
                return interaction.reply({
                    content: 'You already have an active verification process. Please complete it before starting another.',
                    ephemeral: true,
                });
            }

            // Mark the user as actively verifying when starting a new process
            if (interaction.customId.startsWith('verify_button')) {
                activeVerification[userId] = true;

                const member = interaction.member;
                const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });

                if (!guildConfig) {
                    await interaction.reply({ content: 'Configuration not found. Please contact an administrator.', ephemeral: true });
                    delete activeVerification[userId];
                    return;
                }

                // Check if the user already has any of the verified roles
                const hasVerifiedRole = guildConfig.verifiedRoleIds.some(roleId => member.roles.cache.has(roleId));
                if (hasVerifiedRole) {
                    await interaction.reply({ content: 'You are already verified.', ephemeral: true });
                    delete activeVerification[userId];
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
                    delete activeVerification[userId];
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
        }

        // Handle CAPTCHA modal submission
        else if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'captcha_modal') {
            const captchaAnswer = interaction.fields.getTextInputValue('captcha_input');
            const captchaData = await Captcha.findOne({ userId: interaction.user.id });
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });

            if (!guildConfig) {
                await interaction.reply({ content: 'Configuration not found. Please contact an administrator.', ephemeral: true });
                delete activeVerification[interaction.user.id]; // Stop verification if guild config is missing
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
                delete activeVerification[interaction.user.id];
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
                    // Assign all verified roles to the member
                    await interaction.member.roles.add(guildConfig.verifiedRoleIds);
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
                    console.error('Failed to assign roles:', error);
                    await interaction.reply({ content: 'An error occurred while assigning your roles. Please try again later.', ephemeral: true });
                }
            } else {
                await interaction.reply({ content: 'Incorrect CAPTCHA. Please try again.', ephemeral: true });
            }
            delete activeVerification[interaction.user.id]; // End active verification session
        }
    },
};
