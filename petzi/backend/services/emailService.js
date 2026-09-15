const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

/**
 * emailService.js
 * Comprehensive email delivery system for Petzi Notifications & Reminders.
 * Supports:
 *  1. Live Gmail SMTP delivery via 16-character Google App Passwords
 *  2. Free Ethereal Test Mailbox mode for instant testing with live email preview URLs
 *  3. Dynamic configuration updates via API & .env persistence
 */

const envPath = path.join(__dirname, "..", ".env");
let cachedEtherealTransporter = null;
let cachedEtherealAccount = null;

// Helper to update key in .env file
function updateEnvFile(key, value) {
    try {
        if (!fs.existsSync(envPath)) return;
        let content = fs.readFileSync(envPath, "utf8");
        const regex = new RegExp(`^${key}=.*$`, "m");
        if (regex.test(content)) {
            content = content.replace(regex, `${key}=${value}`);
        } else {
            content += `\n${key}=${value}`;
        }
        fs.writeFileSync(envPath, content, "utf8");
    } catch (err) {
        console.error("[EmailService] Error updating .env file:", err.message);
    }
}

/**
 * Get current configuration details
 */
function getEmailConfig() {
    const email = process.env.PETZI_EMAIL || "petzioff1@gmail.com";
    const rawPass = (process.env.PETZI_EMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
    const mode = process.env.EMAIL_MODE || (rawPass && rawPass.length === 16 ? "gmail" : "ethereal");

    return {
        mode: mode,
        sender_email: email,
        has_password: Boolean(rawPass && rawPass.length >= 8),
        app_password_masked: rawPass ? `${rawPass.substring(0, 4)}••••••••${rawPass.substring(rawPass.length - 4)}` : "",
        ethereal_account: cachedEtherealAccount ? cachedEtherealAccount.user : null
    };
}

/**
 * Update email configuration dynamically and persist to .env
 */
async function updateEmailConfig({ mode, email, appPassword }) {
    if (mode) {
        process.env.EMAIL_MODE = mode;
        updateEnvFile("EMAIL_MODE", mode);
    }
    if (email) {
        const cleanEmail = email.trim();
        process.env.PETZI_EMAIL = cleanEmail;
        process.env.EMAIL_FROM = `Petzi <${cleanEmail}>`;
        updateEnvFile("PETZI_EMAIL", cleanEmail);
        updateEnvFile("EMAIL_FROM", `Petzi <${cleanEmail}>`);
    }
    if (appPassword !== undefined) {
        const cleanPass = appPassword.replace(/\s+/g, "");
        process.env.PETZI_EMAIL_APP_PASSWORD = cleanPass;
        updateEnvFile("PETZI_EMAIL_APP_PASSWORD", cleanPass);
    }

    return await verifySmtpConnection();
}

/**
 * Create or reuse an Ethereal test mailbox transporter
 */
async function getEtherealTransporter() {
    if (cachedEtherealTransporter) {
        return cachedEtherealTransporter;
    }

    try {
        const testAccount = await nodemailer.createTestAccount();
        cachedEtherealAccount = testAccount;
        cachedEtherealTransporter = nodemailer.createTransport({
            host: testAccount.smtp.host,
            port: testAccount.smtp.port,
            secure: testAccount.smtp.secure,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });
        console.log(`[EmailService] Created Ethereal Test Mailbox: ${testAccount.user}`);
        return cachedEtherealTransporter;
    } catch (err) {
        console.error("[EmailService] Failed to create Ethereal test account:", err.message);
        return null;
    }
}

/**
 * Helper to build a Gmail nodemailer transporter
 */
function createGmailTransporter(user, pass, forceDirect = false) {
    if (!forceDirect && (!process.env.SMTP_HOST || process.env.SMTP_HOST === "smtp.gmail.com")) {
        return nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: user,
                pass: pass
            },
            tls: {
                rejectUnauthorized: false
            },
            connectionTimeout: 15000,
            greetingTimeout: 10000,
            socketTimeout: 20000
        });
    }

    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = parseInt(process.env.SMTP_PORT || "465", 10);
    const secure = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === "true" : port === 465;

    return nodemailer.createTransport({
        host: host,
        port: port,
        secure: secure,
        auth: {
            user: user,
            pass: pass
        },
        tls: {
            rejectUnauthorized: false
        },
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 20000
    });
}

/**
 * Returns the active transporter based on configured mode
 */
async function getTransporter() {
    const config = getEmailConfig();

    if (config.mode === "ethereal") {
        return await getEtherealTransporter();
    }

    // Gmail SMTP Mode
    const user = process.env.PETZI_EMAIL || "petzioff1@gmail.com";
    const pass = (process.env.PETZI_EMAIL_APP_PASSWORD || "").replace(/\s+/g, "");

    if (user && pass && pass.length >= 8) {
        return createGmailTransporter(user, pass);
    }

    // If Gmail credentials are incomplete, fallback to Ethereal
    return await getEtherealTransporter();
}

/**
 * Verifies the SMTP transporter connection and credentials
 */
async function verifySmtpConnection() {
    const config = getEmailConfig();

    if (config.mode === "ethereal") {
        const transporter = await getEtherealTransporter();
        if (transporter) {
            return {
                configured: true,
                mode: "ethereal",
                status: "connected",
                sender: cachedEtherealAccount ? cachedEtherealAccount.user : "Ethereal Test Mailbox",
                message: `Ethereal Test Mailbox active! Reminders will generate instant live preview links.`
            };
        }
    }

    const user = process.env.PETZI_EMAIL || "petzioff1@gmail.com";
    const pass = (process.env.PETZI_EMAIL_APP_PASSWORD || "").replace(/\s+/g, "");

    if (!pass || pass.length < 8) {
        return {
            configured: false,
            mode: "gmail",
            status: "unconfigured",
            sender: user,
            message: "No Gmail App Password provided.",
            hint: "Please generate a 16-character App Password at https://myaccount.google.com/apppasswords or switch to 'Test Mailbox' mode."
        };
    }

    let transporter = createGmailTransporter(user, pass, false);

    try {
        await transporter.verify();
        return {
            configured: true,
            mode: "gmail",
            status: "connected",
            sender: user,
            message: `Connected successfully to Gmail (${user})!`
        };
    } catch (firstErr) {
        // Attempt direct port 465 fallback
        try {
            const fallbackTransporter = createGmailTransporter(user, pass, true);
            await fallbackTransporter.verify();
            return {
                configured: true,
                mode: "gmail",
                status: "connected",
                sender: user,
                message: `Connected successfully to Gmail (${user})!`
            };
        } catch (err) {
            let hint = "Please verify your Gmail App Password.";
            if (err.message && (err.message.includes("535") || err.message.includes("BadCredentials") || err.code === "EAUTH")) {
                hint = "Google rejected the password. Please ensure 2-Step Verification is active on petziofficial8@gmail.com, then unlock access at https://accounts.google.com/DisplayUnlockCaptcha or generate a fresh 16-letter App Password at https://myaccount.google.com/apppasswords.";
            }

            return {
                configured: false,
                mode: "gmail",
                status: "error",
                sender: user,
                code: err.code || "AUTH_FAILED",
                message: err.message,
                hint: hint
            };
        }
    }
}

/**
 * Generates an HTML email with responsive Petzi branding
 */
function generateEmailTemplate({ toEmail, userName, title, message, reminderType, details = [], actionUrl, actionText }) {
    const APP_URL = process.env.APP_URL || "http://localhost:5500";
    const safeName = userName || "Pet Parent";
    const typeBadgeColors = {
        appointment: { bg: "#4A2B1A", text: "#FFF3E4", label: "Appointment Reminder" },
        medication: { bg: "#A56A3E", text: "#FFF3E4", label: "Medication Reminder" },
        vaccination: { bg: "#1B5E20", text: "#E8F5E9", label: "Vaccination Reminder" },
        grooming: { bg: "#7B1FA2", text: "#F3E5F5", label: "Grooming Reminder" },
        supply: { bg: "#E65100", text: "#FFF3E0", label: "Supply Alert" },
        test: { bg: "#2563EB", text: "#EFF6FF", label: "Test Notification" },
        general: { bg: "#374151", text: "#F3F4F6", label: "Pet Care Reminder" }
    };

    const badge = typeBadgeColors[reminderType] || typeBadgeColors.general;
    const buttonUrl = actionUrl ? (actionUrl.startsWith("http") ? actionUrl : `${APP_URL}/${actionUrl.replace(/^\//, '')}`) : `${APP_URL}/dashboard`;
    const buttonLabel = actionText || "Open Petzi";

    let detailsRowsHtml = "";
    if (Array.isArray(details) && details.length > 0) {
        detailsRowsHtml = `
            <table style="width: 100%; border-collapse: collapse; margin: 18px 0; background: #FFF8F0; border-radius: 8px; border: 1px solid #EAD8C3;">
                ${details.map(d => `
                    <tr>
                        <td style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #4A2B1A; border-bottom: 1px solid #F0E2D2; width: 35%; text-transform: uppercase; letter-spacing: 0.5px;">${d.label}</td>
                        <td style="padding: 10px 14px; font-size: 14px; color: #333333; border-bottom: 1px solid #F0E2D2;">${d.value}</td>
                    </tr>
                `).join('')}
            </table>
        `;
    }

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #F7EFE5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333333; line-height: 1.6;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F7EFE5; padding: 30px 15px;">
            <tr>
                <td align="center">
                    <table role="presentation" width="100%" style="max-width: 600px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(74, 43, 26, 0.08); border: 1px solid #EAD8C3;">
                        
                        <!-- Header Banner -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #4A2B1A 0%, #683C24 100%); padding: 28px 30px; text-align: center;">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td align="center">
                                            <div style="display: inline-block; background: #D7A46D; color: #4A2B1A; font-size: 20px; font-weight: 800; border-radius: 12px; padding: 6px 14px; letter-spacing: -0.5px;">
                                                🐾 Petzi
                                            </div>
                                            <h1 style="color: #FFF3E4; font-size: 20px; font-weight: 700; margin: 12px 0 0 0; letter-spacing: -0.2px;">Care Log & Reminders</h1>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Body Content -->
                        <tr>
                            <td style="padding: 32px 30px 24px 30px;">
                                
                                <!-- Badge -->
                                <div style="display: inline-block; background-color: ${badge.bg}; color: ${badge.text}; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; padding: 4px 10px; border-radius: 999px; margin-bottom: 14px;">
                                    ${badge.label}
                                </div>

                                <h2 style="font-size: 20px; font-weight: 800; color: #4A2B1A; margin: 0 0 12px 0; line-height: 1.3;">
                                    ${title}
                                </h2>

                                <p style="font-size: 15px; color: #4B5563; margin: 0 0 16px 0;">
                                    Hello <strong>${safeName}</strong>,
                                </p>

                                <div style="background: #FFFDF9; border-left: 4px solid #D7A46D; padding: 14px 16px; border-radius: 0 8px 8px 0; margin-bottom: 16px;">
                                    <p style="font-size: 15px; color: #2D3748; margin: 0; line-height: 1.5;">
                                        ${message}
                                    </p>
                                </div>

                                ${detailsRowsHtml}

                                <!-- Call to Action Button -->
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0 14px 0;">
                                    <tr>
                                        <td align="center">
                                            <a href="${buttonUrl}" style="display: inline-block; background-color: #4A2B1A; color: #FFF3E4; font-size: 15px; font-weight: 700; text-decoration: none; padding: 13px 32px; border-radius: 999px; box-shadow: 0 4px 14px rgba(74, 43, 26, 0.25); border: 1.5px solid #D7A46D;">
                                                ${buttonLabel} &rarr;
                                            </a>
                                        </td>
                                    </tr>
                                </table>

                                <p style="font-size: 12px; color: #9CA3AF; text-align: center; margin: 20px 0 0 0;">
                                    You can view and manage all your notifications directly in your Petzi dashboard.
                                </p>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #FAF4EB; padding: 20px 30px; border-top: 1px solid #EAD8C3; text-align: center;">
                                <p style="font-size: 12px; color: #78716C; margin: 0 0 4px 0;">
                                    &copy; ${new Date().getFullYear()} Petzi Care Log. All rights reserved.
                                </p>
                                <p style="font-size: 11px; color: #A8A29E; margin: 0;">
                                    Sent from: <strong>Petzi (${process.env.PETZI_EMAIL || 'petzioff1@gmail.com'})</strong> to: <strong>${toEmail || safeName}</strong>.
                                </p>
                            </td>
                        </tr>

                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
}

/**
 * Send a reminder email
 */
async function sendReminderEmail({ toEmail, userName, title, message, reminderType, details, actionUrl, actionText }) {
    const APP_URL = process.env.APP_URL || "http://localhost:5500";
    const senderEmail = process.env.PETZI_EMAIL || "petzioff1@gmail.com";
    const emailFrom = process.env.EMAIL_FROM || `Petzi <${senderEmail}>`;

    if (!toEmail) {
        console.warn("[EmailService] No recipient email address provided.");
        return { success: false, reason: "No recipient email address" };
    }

    const htmlContent = generateEmailTemplate({
        toEmail,
        userName,
        title,
        message,
        reminderType,
        details,
        actionUrl,
        actionText
    });

    const plainText = `Hello ${userName || "Pet Parent"},\n\n${title}\n\n${message}\n\nView details: ${APP_URL}/${actionUrl ? actionUrl.replace(/^\//, '') : 'dashboard'}\n\n- Petzi Team (${senderEmail})`;

    const transporter = await getTransporter();

    if (!transporter) {
        return { success: false, simulated: true, reason: "No active email transport available" };
    }

    try {
        const info = await transporter.sendMail({
            from: emailFrom,
            to: toEmail,
            subject: `[Petzi Reminder] ${title}`,
            text: plainText,
            html: htmlContent
        });

        // If Ethereal test mailbox was used, generate the preview URL
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
            console.log(`[EmailService] ✓ Ethereal Test Email sent! Preview URL: ${previewUrl}`);
            return {
                success: true,
                messageId: info.messageId,
                previewUrl: previewUrl,
                isTestMailbox: true
            };
        }

        console.log(`[EmailService] ✓ Real email delivered from ${emailFrom} to ${toEmail}. MessageId: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (err) {
        console.error(`[EmailService] Failed to send email from ${emailFrom} to ${toEmail}:`, err.message);
        let hint = "Please verify your SMTP credentials.";
        if (err.message && (err.message.includes("535") || err.message.includes("BadCredentials") || err.code === "EAUTH")) {
            hint = "Google rejected the password. Please update your 16-character App Password in Settings or switch to Test Mailbox mode.";
        }
        return { success: false, error: err.message, hint: hint, code: err.code };
    }
}

module.exports = {
    sendReminderEmail,
    generateEmailTemplate,
    verifySmtpConnection,
    getEmailConfig,
    updateEmailConfig,
    getTransporter
};
