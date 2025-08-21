const nodemailer = require('nodemailer');
require('dotenv').config(); // make sure .env is loaded

// Debug email configuration
console.log('--- Email Configuration Debug ---');
console.log('EMAIL_USER:', process.env.EMAIL_USER ? process.env.EMAIL_USER : 'MISSING');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'Set (hidden)' : 'MISSING');
console.log('------------------------------------');

// Validate email credentials
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('FATAL: Email credentials are missing. Please check your .env file.');
    console.error('Required: EMAIL_USER and EMAIL_PASS');
    process.exit(1);
}

// ✅ Corrected transporter (was createTransporter before)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Gmail App Password
    },
    secure: true, // Use TLS
    tls: {
        rejectUnauthorized: false
    }
});

// Test the connection on startup
transporter.verify((error, success) => {
    if (error) {
        console.error('Email transporter verification failed:', error);
        console.error('Please check your EMAIL_USER and EMAIL_PASS in .env file');
    } else {
        console.log('✅ Email server is ready to send messages');
    }
});

/**
 * Sends an OTP email to a user.
 * @param {string} email - The recipient's email address.
 * @param {string} otp - The One-Time Password to send.
 */
const sendOTPEmail = async (email, otp) => {
    try {
        console.log(`Attempting to send OTP to: ${email}`);
        
        const mailOptions = {
            from: `"Your App Name" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Verify Your Email Address - OTP Inside',
            text: `Your verification code is: ${otp}. It will expire in 10 minutes. Please do not share this code with anyone.`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #333; text-align: center;">Email Verification</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
                        <p style="font-size: 16px; color: #666; margin-bottom: 20px;">
                            Your verification code is:
                        </p>
                        <div style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 8px; margin: 20px 0;">
                            ${otp}
                        </div>
                        <p style="font-size: 14px; color: #666; margin-top: 20px;">
                            This code will expire in <strong>10 minutes</strong>.<br>
                            Please do not share this code with anyone.
                        </p>
                    </div>
                    <p style="font-size: 12px; color: #999; text-align: center; margin-top: 20px;">
                        If you didn't request this verification, please ignore this email.
                    </p>
                </div>
            `,
        };

        const result = await transporter.sendMail(mailOptions);
        console.log(`OTP email sent successfully to ${email}. Message ID: ${result.messageId}`);
        return true;
        
    } catch (error) {
        console.error('Detailed email sending error:', {
            message: error.message,
            code: error.code,
            command: error.command,
            response: error.response
        });
        
        if (error.code === 'EAUTH') {
            throw new Error('Email authentication failed. Please check your Gmail App Password.');
        } else if (error.code === 'ENOTFOUND') {
            throw new Error('Email server not found. Please check your internet connection.');
        } else {
            throw new Error(`Failed to send OTP email: ${error.message}`);
        }
    }
};

const testEmailConnection = async () => {
    try {
        await transporter.verify();
        console.log('✅ Email configuration is working correctly');
        return true;
    } catch (error) {
        console.error('❌ Email configuration test failed:', error.message);
        return false;
    }
};

module.exports = { 
    sendOTPEmail, 
    testEmailConnection 
};
