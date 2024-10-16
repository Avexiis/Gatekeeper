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

            // Mark the user as actively verifying
            activeVerification[userId] = true;

            if (interaction.customId.startsWith('verify_button')) {
                const member = interaction.member;
                const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });

                if (!guildConfig) {
                    await interaction.reply({ content: 'Configuration not found. Please contact an administrator.', ephemeral: true });
                    delete activeVerification[userId]; // End session if configuration fails
                    return;
                }

                const timer = guildConfig.timer;

                // Generate CAPTCHA
                const captchaText = await generateCaptchaText(6);
                const captchaPath = await generateCaptchaImage(captchaText);

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

                await showCaptchaModalWithRetry(interaction, modal);
            }

            // Handle retry button
            else if (interaction.customId === 'retry_captcha') {
                const modal = new ModalBuilder()
                    .setCustomId('captcha_modal')
                    .setTitle('CAPTCHA Verification');

                // Trigger the CAPTCHA modal again with retry logic
                await showCaptchaModalWithRetry(interaction, modal);
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
                delete activeVerification[interaction.user.id]; // Stop verification if CAPTCHA expired
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

                // Assign roles and mark the user as verified
                await interaction.member.roles.add(guildConfig.verifiedRoleIds);
                isVerified = true;
                await interaction.reply({ content: 'You have been verified!', ephemeral: true });
                delete activeVerification[interaction.user.id]; // End active verification

                // Log the verification event
                const verificationLog = new VerificationLog({
                    userId: interaction.user.id,
                    username: interaction.user.username,
                    discriminator: interaction.user.discriminator,
                    guildId: interaction.guild.id,
                    guildName: interaction.guild.name,
                });
                await verificationLog.save();
            } else {
                await interaction.reply({ content: 'Incorrect CAPTCHA. Please try again.', ephemeral: true });
            }
        }
    },
};
