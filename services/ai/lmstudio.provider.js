const BaseAIProvider = require('./base.provider');
const axios = require('axios');

class LMStudioProvider extends BaseAIProvider {
    constructor() {
        super({
            baseURL: process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234',
            timeout: parseInt(process.env.AI_TIMEOUT_MS) || 12000
        });
    }

    async checkGrammar(text, mode) {
        try {
            const response = await axios.post(
                `${this.config.baseURL}/v1/chat/completions`,
                {
                    model: process.env.LMSTUDIO_MODEL || "local-model", // Use env var or default
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
                        'Content-Type': 'application/json'
                    },
                    timeout: this.config.timeout
                }
            );

            // Extract JSON from response
            const content = response.data?.choices?.[0]?.message?.content;
            if (!content) {
                throw new Error("No content in LM Studio response");
            }

            // Parse JSON response
            let parsedResponse;
            try {
                parsedResponse = JSON.parse(content);
            } catch (err) {
                console.error("Failed to parse LM Studio JSON response:", content);
                throw new Error("PARSE_ERROR");
            }

            // Normalize and validate response (pass original text for position calculation)
            return this.normalizeResponse(parsedResponse, text);

        } catch (error) {
            if (error.message === "PARSE_ERROR") {
                throw error;
            }
            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                throw new Error("AI_TIMEOUT");
            }
            if (error.code === 'ECONNREFUSED') {
                throw new Error("AI_UPSTREAM_ERROR");
            }
            if (error.response?.status >= 500) {
                throw new Error("AI_UPSTREAM_ERROR");
            }
            throw error;
        }
    }
}

module.exports = LMStudioProvider;