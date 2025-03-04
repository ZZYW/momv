// Configuration settings
const config = {
    // If defined, CENTRAL_BACKEND_URL is used for station routes.
    central_backend_url: process.env.CENTRAL_BACKEND_URL,
    
    // Check production mode based on command line arguments.
    isProd: process.argv.includes("prod"),
    
    // Port settings
    PORT: process.env.PORT || 3001
};

export default config;