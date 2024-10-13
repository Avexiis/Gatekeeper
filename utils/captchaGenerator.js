// utils/captchaGenerator.js

const { createCanvas } = require('canvas');
const path = require('path');
const { writeFile } = require('fs/promises');
const os = require('os');

async function generateCaptchaText(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

async function generateCaptchaImage(text) {
    const canvasWidth = 250;
    const canvasHeight = 120;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Set background color
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Set a serif font for better character differentiation
    ctx.font = '40px Georgia, serif';

    // Measure the text to ensure it is centered and fully visible
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;

    // Calculate the x and y positions to center the text
    const x = (canvasWidth - textWidth) / 2;
    const y = (canvasHeight / 2) + 15;

    ctx.fillStyle = '#000';
    ctx.fillText(text, x, y);

    // Add some noise for complexity
    for (let i = 0; i < 30; i++) {
        ctx.fillStyle = '#' + ((1 << 24) * Math.random() | 0).toString(16).padStart(6, '0');
        const radius = Math.random() * 5;
        const noiseX = Math.random() * canvasWidth;
        const noiseY = Math.random() * canvasHeight;
        ctx.beginPath();
        ctx.arc(noiseX, noiseY, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // Use a temporary directory for storing the image
    const captchaPath = path.join(os.tmpdir(), `${text}.png`);
    await writeFile(captchaPath, canvas.toBuffer('image/png'));
    return captchaPath;
}

module.exports = { generateCaptchaText, generateCaptchaImage };
