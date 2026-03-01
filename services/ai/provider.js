const TyphoonProvider = require('./typhoon.provider');
const LMStudioProvider = require('./lmstudio.provider');

// Factory function to get the appropriate AI provider
function getAIProvider() {
    const providerType = process.env.AI_PROVIDER || 'typhoon';

    switch (providerType.toLowerCase()) {
        case 'typhoon':
            return new TyphoonProvider();
        case 'lmstudio':
            return new LMStudioProvider();
        default:
            console.warn(`Unknown AI_PROVIDER: ${providerType}, defaulting to Typhoon`);
            return new TyphoonProvider();
    }
}

module.exports = { getAIProvider };