const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');

const envContent = `
ALOR_PORTFOLIO=${process.env.ALOR_PORTFOLIO}
ALOR_REFRESH_TOKEN=${process.env.ALOR_REFRESH_TOKEN}
CTRADER_PASSWORD=${process.env.CTRADER_PASSWORD}
CTRADER_USERNAME=${process.env.CTRADER_USERNAME}
CTRADER_REDIRECT_URI=${process.env.CTRADER_REDIRECT_URI}
CTRADER_CLIENT_ID=${process.env.CTRADER_CLIENT_ID}
CTRADER_CLIENT_SECRET=${process.env.CTRADER_CLIENT_SECRET}
NODE_ENV=production
`;

fs.writeFileSync(envPath, envContent.trim());
console.log('.env file created successfully!');
