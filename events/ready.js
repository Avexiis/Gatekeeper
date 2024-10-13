const { REST, Routes, ActivityType } = require('discord.js');
const fs = require('fs');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`Logged in as ${client.user.tag}`);

        const clientId = '1294923114471493643';

        // Load commands
        const commands = [];
        const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const command = require(`../commands/${file}`);
            commands.push(command.data.toJSON());
        }

        // Register slash commands
        const rest = new REST({ version: '10' }).setToken(client.token);
        try {
            console.log('Started refreshing application (/) commands.');

            await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands },
            );

            console.log('Successfully reloaded application (/) commands.');
        } catch (error) {
            console.error(error);
        }

        // Function to update the bot's status
        const updateStatus = () => {
            // Get the total number of users across all guilds
            const totalUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

            // Set the bot's activity
            client.user.setActivity(`over ${totalUsers} users`, { type: ActivityType.Watching });
        };

        // Initial status update
        updateStatus();

        // Update the status every 10 minutes (600,000 milliseconds)
        setInterval(updateStatus, 600000);
    },
};
