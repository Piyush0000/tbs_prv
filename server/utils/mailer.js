const nodemailer = require('nodemailer');

// Simple logging function
const log = (message, data = null) => {
    console.log(`[MAILER] ${message}`, data || '');
};

// Validate environment variables first
const validateConfig = () => {
    const missing = [];
    
    if (!process.env.EMAIL_USER) missing.push('EMAIL_USER');
    if (!process.env.EMAIL_PASS) missing.push('EMAIL_PASS');
    
    if (missing.length > 0) {
        throw new Error(`Missing environment variables: ${missing.join(', ')}`);
    }
    
    log('✅ Environment variables validated');
    log('EMAIL_USER:', process.env.EMAIL_USER);
    log('EMAIL_PASS length:', process.env.EMAIL_PASS.length);
};

// Initialize transporter immediately
let transporter = null;

// Enhanced transporter configuration for mailer.js
const initializeTransporter = () => {
    try {
        validateConfig();
        
        // More robust Gmail configuration with additional options
        transporter = nodemailer.createTransport({
            service: 'gmail', // Use service instead of manual SMTP config
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false
            },
            // Additional timeout settings
            connectionTimeout: 60000, // 60 seconds
            greetingTimeout: 30000,    // 30 seconds
            socketTimeout: 60000       // 60 seconds
        });
        
        log('✅ Transporter created successfully');
        return true;
    } catch (error) {
        log('❌ Failed to create transporter:', error.message);
        return false;
    }
};
// Initialize on module load
const initialized = initializeTransporter();
if (!initialized) {
    log('🚨 CRITICAL: Email transporter failed to initialize on startup');
}

// Test email connection with detailed error reporting
const testEmailConnection = async () => {
    try {
        if (!transporter) {
            log('❌ No transporter available');
            return false;
        }
        
        log('Testing SMTP connection...');
        await transporter.verify();
        log('✅ SMTP connection successful');
        return true;
        
    } catch (error) {
        log('❌ SMTP connection failed:', error.message);
        log('Error code:', error.code);
        log('Full error:', error);
        
        // Provide specific error solutions
        if (error.code === 'EAUTH') {
            log('💡 SOLUTION: Invalid email credentials. Steps to fix:');
            log('   1. Enable 2-factor authentication on Gmail');
            log('   2. Generate App Password in Google Account settings');
            log('   3. Use App Password (16 chars) as EMAIL_PASS, not regular password');
        } else if (error.code === 'ETIMEDOUT') {
            log('💡 SOLUTION: Connection timeout. Check your internet connection');
        } else if (error.message.includes('Missing credentials')) {
            log('💡 SOLUTION: EMAIL_USER or EMAIL_PASS not set in environment');
        } else if (error.code === 'ENOTFOUND') {
            log('💡 SOLUTION: DNS resolution failed. Check your network connection');
        }
        
        return false;
    }
};

// Send OTP email with enhanced error handling
const sendOTPEmail = async (email, otp) => {
    try {
        // Always test connection first
        const connectionOk = await testEmailConnection();
        if (!connectionOk) {
            throw new Error('SMTP connection failed - cannot send email');
        }
        
        log('Preparing to send OTP email');
        log('Recipient:', email);
        log('OTP:', otp);
        
        const mailOptions = {
            from: `"The Bookshelves" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Your OTP Code - Account Verification',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #6366f1; margin: 0;">The Bookshelves</h1>
                    </div>
                    
                    <h2 style="color: #333; text-align: center;">Account Verification</h2>
                    <p>Hello,</p>
                    <p>Thank you for signing up with The Bookshelves! Please use the following OTP to verify your email address:</p>
                    
                    <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); 
                                color: white; 
                                padding: 30px; 
                                text-align: center; 
                                margin: 30px 0; 
                                border-radius: 12px;
                                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);">
                        <h1 style="margin: 0; font-size: 48px; letter-spacing: 8px; font-weight: bold;">${otp}</h1>
                    </div>
                    
                    <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0; border-radius: 4px;">
                        <p style="margin: 0; color: #dc2626;"><strong>⏰ This OTP expires in 10 minutes</strong></p>
                    </div>
                    
                    <p>If you didn't request this verification, please ignore this email.</p>
                    
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                    <div style="text-align: center;">
                        <p style="color: #6b7280; font-size: 14px; margin: 5px 0;">
                            Visit us at <a href="https://thebookshelves.com" style="color: #6366f1;">thebookshelves.com</a>
                        </p>
                        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                            This is an automated email. Please do not reply.
                        </p>
                    </div>
                </div>
            `
        };
        
        log('Attempting to send email...');
        log('Mail options from:', mailOptions.from);
        log('Mail options to:', mailOptions.to);
        
        const result = await transporter.sendMail(mailOptions);
        log('✅ Email sent successfully');
        log('Message ID:', result.messageId);
        log('Response:', result.response);
        
        return {
            success: true,
            messageId: result.messageId,
            response: result.response
        };
        
    } catch (error) {
        log('❌ Failed to send email:', error.message);
        log('Error code:', error.code);
        log('Full error object:', error);
        
        // Provide specific error context
        if (error.code === 'EAUTH') {
            throw new Error(`Gmail authentication failed. Please check your App Password. Original error: ${error.message}`);
        } else if (error.code === 'EENVELOPE') {
            throw new Error(`Invalid email address format. Original error: ${error.message}`);
        } else if (error.code === 'ETIMEDOUT') {
            throw new Error(`Email service timeout. Please try again. Original error: ${error.message}`);
        }
        
        throw new Error(`Email sending failed: ${error.message}`);
    }
};

// Export functions
module.exports = {
    sendOTPEmail,
    testEmailConnection,
    initializeTransporter
};