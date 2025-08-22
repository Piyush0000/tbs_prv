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

// Initialize transporter with error handling
let transporter;

const initializeTransporter = () => {
    try {
        validateConfig();
        
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        
        log('✅ Transporter created successfully');
        return true;
    } catch (error) {
        log('❌ Failed to create transporter:', error.message);
        return false;
    }
};

// Test email connection
const testEmailConnection = async () => {
    try {
        if (!transporter) {
            const initialized = initializeTransporter();
            if (!initialized) {
                return false;
            }
        }
        
        log('Testing SMTP connection...');
        await transporter.verify();
        log('✅ SMTP connection successful');
        return true;
        
    } catch (error) {
        log('❌ SMTP connection failed:', error.message);
        
        // Provide specific error solutions
        if (error.code === 'EAUTH') {
            log('💡 SOLUTION: Invalid email credentials. Check your Gmail App Password');
        } else if (error.code === 'ETIMEDOUT') {
            log('💡 SOLUTION: Connection timeout. Check your internet connection');
        } else if (error.message.includes('Missing credentials')) {
            log('💡 SOLUTION: EMAIL_USER or EMAIL_PASS not set in environment');
        }
        
        return false;
    }
};

// Send OTP email
const sendOTPEmail = async (email, otp) => {
    try {
        if (!transporter) {
            const initialized = initializeTransporter();
            if (!initialized) {
                throw new Error('Failed to initialize email transporter');
            }
        }
        
        log('Preparing to send OTP email');
        log('Recipient:', email);
        log('OTP:', otp);
        
        const mailOptions = {
            from: `"Your App" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Your OTP Code - Account Verification',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #333; text-align: center;">Account Verification</h2>
                    <p>Hello,</p>
                    <p>Please use the following OTP to verify your email address:</p>
                    
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                color: white; 
                                padding: 20px; 
                                text-align: center; 
                                margin: 20px 0; 
                                border-radius: 10px;">
                        <h1 style="margin: 0; font-size: 36px; letter-spacing: 8px;">${otp}</h1>
                    </div>
                    
                    <p><strong>⏰ This OTP expires in 10 minutes</strong></p>
                    <p>If you didn't request this, please ignore this email.</p>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="color: #666; font-size: 12px; text-align: center;">
                        This is an automated email. Please do not reply.
                    </p>
                </div>
            `
        };
        
        log('Sending email...');
        const result = await transporter.sendMail(mailOptions);
        log('✅ Email sent successfully');
        log('Message ID:', result.messageId);
        
        return {
            success: true,
            messageId: result.messageId
        };
        
    } catch (error) {
        log('❌ Failed to send email:', error.message);
        throw new Error(`Email sending failed: ${error.message}`);
    }
};

// Export functions
module.exports = {
    sendOTPEmail,
    testEmailConnection,
    initializeTransporter
};