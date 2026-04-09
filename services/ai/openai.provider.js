const BaseAIProvider = require('./base.provider');
const axios = require('axios');

class OpenAIProvider extends BaseAIProvider {
    constructor() {
        super({
            baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL,
            apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
            model: process.env.OPENAI_COMPATIBLE_MODEL,
            timeout: parseInt(process.env.AI_TIMEOUT_MS) || 12000
        });
    }

    repairTruncatedJSON(content) {
        try {
            let cleaned = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

            // Find the issues array and extract only complete objects
            const issuesMatch = cleaned.match(/"issues"\s*:\s*\[/);
            if (!issuesMatch) return null;

            const arrayStart = cleaned.indexOf('[', issuesMatch.index);
            let depth = 0;
            let lastCompleteObject = -1;

            for (let i = arrayStart; i < cleaned.length; i++) {
                if (cleaned[i] === '{') depth++;
                if (cleaned[i] === '}') {
                    depth--;
                    if (depth === 0) lastCompleteObject = i;
                }
            }

            if (lastCompleteObject === -1) {
                return { language: "th", issues: [] };
            }

            // Rebuild with only complete objects
            const repaired = cleaned.substring(0, lastCompleteObject + 1) + ']}';
            return JSON.parse(repaired);
        } catch (err) {
            return null;
        }
    }

    buildMessages(text) {
        return [
            {
                role: "system",
                content: this.getSystemPrompt()
            },
            {
                role: "user",
                content: `ตรวจสอบข้อความนี้: "${text}"`
            }
        ];
    }

    async callAPI(messages, maxTokens) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.config.apiKey) {
            headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }

        const baseURL = this.config.baseURL.replace(/\/+$/, '');
        const endpoint = baseURL.includes('/v1') || baseURL.includes('/v1beta')
            ? `${baseURL}/chat/completions`
            : `${baseURL}/v1/chat/completions`;

        return axios.post(
            endpoint,
            {
                model: this.config.model,
                messages,
                temperature: 0.1,
                max_tokens: maxTokens,
                response_format: { type: "json_object" }
            },
            {
                headers,
                timeout: this.config.timeout
            }
        );
    }

    async checkGrammar(text, mode) {
        try {
            let response = await this.callAPI(this.buildMessages(text), 4000);

            const choice = response.data?.choices?.[0];
            const content = choice?.message?.content;
            if (!content) {
                throw new Error("No content in API response");
            }

            // If truncated (finish_reason: "length"), retry with higher max_tokens
            if (choice.finish_reason === 'length') {
                console.log("[OpenAI Provider] Response truncated, retrying with 8000 max_tokens");
                const retryResponse = await this.callAPI(this.buildMessages(text), 8000);
                const retryChoice = retryResponse.data?.choices?.[0];
                const retryContent = retryChoice?.message?.content;

                if (retryContent) {
                    return this.parseContent(retryContent, text);
                }
            }

            return this.parseContent(content, text);

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
            if (error.response?.status === 429) {
                console.warn("API Rate Limit Hit (429):", error.response?.data);
                throw new Error("AI_RATE_LIMIT");
            }
            if (error.response?.status >= 500) {
                throw new Error("AI_UPSTREAM_ERROR");
            }
            if (error.response?.status === 401 || error.response?.status === 403) {
                console.error("API Auth Error:", error.response?.data);
                throw new Error("AI_UPSTREAM_ERROR");
            }
            console.error("API Error:", error.message, error.response?.data);
            throw error;
        }
    }

    parseContent(content, text) {
        let parsedResponse;
        try {
            const cleaned = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
            parsedResponse = JSON.parse(cleaned);
        } catch (err) {
            parsedResponse = this.repairTruncatedJSON(content);
            if (!parsedResponse) {
                console.error("Failed to parse API JSON response:", content);
                throw new Error("PARSE_ERROR");
            }
            console.log("[OpenAI Provider] Repaired truncated JSON");
        }

        return this.normalizeResponse(parsedResponse, text);
    }

    async adjustTone(text, tone_type) {
        try {
            const messages = [
                {
                    role: "system",
                    content: this.getToneSystemPrompt(tone_type)
                },
                {
                    role: "user",
                    content: text
                }
            ];

            const headers = { 'Content-Type': 'application/json' };
            if (this.config.apiKey) {
                headers['Authorization'] = `Bearer ${this.config.apiKey}`;
            }

            const baseURL = this.config.baseURL.replace(/\/+$/, '');
            const endpoint = baseURL.includes('/v1') || baseURL.includes('/v1beta')
                ? `${baseURL}/chat/completions`
                : `${baseURL}/v1/chat/completions`;

            const response = await axios.post(
                endpoint,
                {
                    model: this.config.model,
                    messages,
                    temperature: 0.3,
                    max_tokens: 4000
                },
                {
                    headers,
                    timeout: this.config.timeout
                }
            );

            const content = response.data?.choices?.[0]?.message?.content;
            if (!content) {
                throw new Error("No content in API response");
            }

            // Strip markdown fences if the model wraps output
            return content.replace(/^```\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

        } catch (error) {
            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                throw new Error("AI_TIMEOUT");
            }
            if (error.code === 'ECONNREFUSED') {
                throw new Error("AI_UPSTREAM_ERROR");
            }
            if (error.response?.status === 429) {
                console.warn("API Rate Limit Hit (429):", error.response?.data);
                throw new Error("AI_RATE_LIMIT");
            }
            if (error.response?.status >= 500) {
                throw new Error("AI_UPSTREAM_ERROR");
            }
            if (error.response?.status === 401 || error.response?.status === 403) {
                console.error("API Auth Error:", error.response?.data);
                throw new Error("AI_UPSTREAM_ERROR");
            }
            console.error("API Error:", error.message, error.response?.data);
            throw error;
        }
    }
}

module.exports = OpenAIProvider;
