export const emailConfig = {
    host: process.env.EMAIL_HOST || 'imap.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '993', 10),
    secure: true,
    auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASSWORD || ''
    },
    tls: {
        rejectUnauthorized: false
    },
    logger: false
} as const; 