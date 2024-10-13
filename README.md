# Gatekeeper Discord Bot

A Discord bot that provides CAPTCHA-based verification for new members across multiple servers. The bot uses MongoDB for data storage, Canvas for CAPTCHA image generation, and is built with Node.js and Discord.js.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Commands](#commands)
- [License](#license)

## Features

- CAPTCHA-based verification system to prevent bots and spam accounts.
- Configurable verification panel with custom messages and timer durations.
- Assign multiple roles upon successful verification.
- Supports multiple servers with individual configurations.
- Stores data in MongoDB for scalability and reliability.
- Logs verification events with user and server details.
- Automatically deletes temporary CAPTCHA images after use or expiration.
- Displays bot status as "Watching over x users" across all servers.

## Prerequisites

Before installing the bot, ensure you have the following installed on your system:

- [Node.js](https://nodejs.org/) (v16.9.0 or newer)
- [npm](https://www.npmjs.com/get-npm) (comes with Node.js)
- [MongoDB Community Server](https://www.mongodb.com/try/download/community) (local instance)
- [Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/downloads/) (required for compiling native modules like Canvas on Windows)

## Installation

Follow these steps to install and run the Gatekeeper Discord Bot:

### 1. Clone the Repository

```bash
git clone https://github.com/Avexiis/Gatekeeper.git
cd Gatekeeper
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Install Visual Studio Build Tools 2022 (Windows Only)

For Windows users, you need to install Visual Studio Build Tools to compile native modules like Canvas.

- Download and install [Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/downloads/).
- During installation, select the **"Desktop development with C++"** workload.

### 4. Set Up MongoDB

Ensure that MongoDB is installed and running on your local machine.

- **Start the MongoDB service:**

  - **Windows:**

    ```bash
    net start MongoDB
    ```

  - **macOS/Linux:**

    ```bash
    sudo service mongod start
    ```

- The bot connects to MongoDB using the default connection string `mongodb://localhost:27017/discordbot`. If your MongoDB instance is running elsewhere or requires authentication, update the connection string in `index.js`.

### 5. Configure the Bot

Insert your bot's token and client ID into the `index.js` and `events/ready.js` files.

#### In `index.js`:

```javascript
// index.js

// Replace with your bot's token and client ID
const token = 'YOUR_BOT_TOKEN'; // Replace 'YOUR_BOT_TOKEN' with your actual bot token
const clientId = 'YOUR_CLIENT_ID'; // Replace 'YOUR_CLIENT_ID' with your actual client ID
```

#### In `events/ready.js`:

```javascript
// events/ready.js

// Replace with your client ID
const clientId = 'YOUR_CLIENT_ID'; // Replace 'YOUR_CLIENT_ID' with your actual client ID
```

- Replace `'YOUR_BOT_TOKEN'` with your actual Discord bot token.
- Replace `'YOUR_CLIENT_ID'` with your bot's client ID.

### 6. Set Up Discord Bot Permissions and Intents

In the [Discord Developer Portal](https://discord.com/developers/applications):

- Navigate to your application.
- Go to the **Bot** section.
- Enable the **Server Members Intent** under **Privileged Gateway Intents**.
- Ensure your bot has the necessary permissions, such as **Manage Roles**, **Send Messages**, **Embed Links**, and **Use Slash Commands**.

## Configuration

After installing and setting up the bot, you need to invite it to your Discord server and configure it:

### 1. Invite the Bot to Your Server

Generate an OAuth2 URL in the Developer Portal with the appropriate scopes and permissions, and use it to invite the bot to your server.

### 2. Configure the Bot in Your Server

Use the `/config` command to set up the verification settings for your server.

```bash
/config role1:@Verified panelmessage:"Please verify yourself to access the server." timer:3
```

- **`role1`**: (Required) The first role to assign upon successful verification.
- **`role2`** to **`role5`**: (Optional) Additional roles to assign upon verification.
- **`panelmessage`**: The message displayed on the verification panel.
- **`timer`**: CAPTCHA expiration time in minutes.

**Example with Multiple Roles:**

```bash
/config role1:@Member role2:@Gamer role3:@Artist panelmessage:"Welcome! Please verify to join the community." timer:5
```

### 3. Send the Verification Panel

Use the `/sendverifypanel` command to send the verification panel to a specific channel.

```bash
/sendverifypanel channel:#verification
```

- **`channel`**: The channel where the verification panel will be sent.

## Usage

The bot provides a CAPTCHA-based verification process for new members:

1. A user joins the server and sees the verification panel in the specified channel.
2. The user clicks the **"Verify"** button.
3. The bot sends an ephemeral message with a CAPTCHA image and two buttons: **"Answer"** and **"New CAPTCHA"**.
   - **"Answer"**: Opens a modal where the user can enter the CAPTCHA text.
   - **"New CAPTCHA"**: Generates a new CAPTCHA image, deletes the old one, and resets the timer.
4. The user enters the correct CAPTCHA text within the specified time limit.
5. Upon successful verification, the bot assigns the configured role(s) to the user.
6. The bot logs the verification event, including the user and server details.
7. The bot updates its status to reflect the total number of users it's watching over.

## Commands

### `/config`

Configure the verification settings for your server.

- **Usage**:

  ```bash
  /config role1:@Verified panelmessage:"Please verify yourself to access the server." timer:3
  ```

- **Parameters**:
  - `role1` (Required): The first role to assign upon verification.
  - `role2` to `role5` (Optional): Additional roles to assign upon verification.
  - `panelmessage` (Required): The message displayed on the verification panel.
  - `timer` (Required): CAPTCHA expiration time in minutes.

**Note:** All required options (`role1`, `panelmessage`, `timer`) must be placed before optional options (`role2`, `role3`, etc.) when using the command.

### `/sendverifypanel`

Send the verification panel to a specified channel.

- **Usage**:

  ```bash
  /sendverifypanel channel:#verification
  ```

- **Parameters**:
  - `channel`: The channel where the verification panel will be sent.

## License

This project is licensed under the [MIT License](LICENSE).
