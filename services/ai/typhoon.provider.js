const BaseAIProvider = require('./base.provider');
const axios = require('axios');

class TyphoonProvider extends BaseAIProvider {
    constructor() {
        super({
            baseURL: process.env.TYPHOON_BASE_URL,
            apiKey: process.env.TYPHOON_API_KEY,
            timeout: parseInt(process.env.AI_TIMEOUT_MS)
        });
    }

    async checkGrammar(text, mode) {
        try {
            const response = await axios.post(
                `${this.config.baseURL}/v1/chat/completions`,
                {
                    model: process.env.TYPHOON_MODEL,
                    messages: [
                        {
                            role: "system",
                            content: this.getSystemPrompt()
                        },
                        {
                            role: "user",
                            content: `ตรวจสอบข้อความนี้: "${text}"`
                        }
                    ],
                    temperature: 0.1,
                    max_tokens: 2000,
                    response_format: { type: "json_object" }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: this.config.timeout
                }
            );

            const content = response.data?.choices?.[0]?.message?.content;
            if (!content) {
                throw new Error("No content in Typhoon response");
            }

            let parsedResponse;
            try {
                parsedResponse = JSON.parse(content);
            } catch (err) {
                console.error("Failed to parse Typhoon JSON response:", content);
                throw new Error("PARSE_ERROR");
            }

            return this.normalizeResponse(parsedResponse, text);

        } catch (error) {
            if (error.message === "PARSE_ERROR") {
                throw error;
            }
            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                throw new Error("AI_TIMEOUT");
            }
            if (error.response?.status >= 500) {
                throw new Error("AI_UPSTREAM_ERROR");
            }
            if (error.response?.status === 400) {
                console.error("Typhoon API 400 Error:", JSON.stringify(error.response.data, null, 2));
                throw new Error("AI_UPSTREAM_ERROR");
            }
            console.error("Typhoon API Error:", error.message, error.response?.data);
            throw error;
        }
    }
}

module.exports = TyphoonProvider;