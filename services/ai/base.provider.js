// Base provider interface
class BaseAIProvider {
    constructor(config) {
        this.config = config;
    }

    /**
     * Check grammar/spelling issues in text
     * @param {string} text - Text to check
     * @param {string} mode - "spelling" or "grammar"
     * @returns {Promise<Object>} Normalized result
     */
    async checkGrammar(text, mode) {
        throw new Error("checkGrammar must be implemented by subclass");
    }

    /**
     * Build the system prompt for Thai grammar/typo detection
     * @returns {string}
     */
    getSystemPrompt() {
        return `You are a Thai language grammar and spelling checker. Analyze the given Thai text and return ONLY valid JSON.

Rules:
1. Identify ONLY clear typos and grammar errors in Thai text
2. Return at most 20 issues
3. Each issue must have:
   - start: Character position where the error starts (0-based index)
   - end: Character position where the error ends (0-based index)
   - span: The exact problematic text (1-16 chars, single word/token, no spaces)
   - replacement: The correction (1-24 chars, no extra whitespace)
   - reason: Short explanation in Thai (max 50 chars)
4. Character positions must be accurate - count each character including spaces
5. Do NOT rewrite the entire text
6. Focus on minimal corrections only
7. Return JSON in this exact format:

{
  "language": "th",
  "issues": [
    {"start": 12, "end": 15, "span": "ไท", "replacement": "ไทย", "reason": "สะกดผิด ต้องใช้ 'ไทย'"}
  ]
}

Example: For text "ผมชอบกินอาหารไท" the word "ไท" is at positions 12-14 (0-based).

If no issues found, return: {"language": "th", "issues": []}
RESPOND WITH ONLY THE JSON, NO MARKDOWN, NO EXPLANATION.`;
    }

    /**
     * Validate and normalize AI response
     * @param {Object} response - Raw AI response
     * @param {string} originalText - Original text for position calculation fallback
     * @returns {Object} Normalized issues array
     */
    normalizeResponse(response, originalText = '') {
        const normalized = {
            language: "th",
            issues: []
        };

        try {
            // Validate structure
            if (!response || typeof response !== 'object') {
                return normalized;
            }

            // Extract issues array
            const issues = Array.isArray(response.issues) ? response.issues : [];

            // Validate and filter issues
            normalized.issues = issues
                .filter(issue => {
                    return issue &&
                           typeof issue.span === 'string' &&
                           typeof issue.replacement === 'string' &&
                           typeof issue.reason === 'string' &&
                           issue.span.length >= 1 && issue.span.length <= 16 &&
                           issue.replacement.length >= 1 && issue.replacement.length <= 24 &&
                           issue.reason.length > 0 && issue.reason.length <= 50;
                })
                .slice(0, process.env.AI_MAX_ISSUES || 20)
                .map(issue => {
                    const normalizedIssue = {
                        span: issue.span.trim(),
                        replacement: issue.replacement.trim(),
                        reason: issue.reason.trim()
                    };

                    // Include start/end positions if provided by AI
                    if (typeof issue.start === 'number' && typeof issue.end === 'number') {
                        normalizedIssue.start = issue.start;
                        normalizedIssue.end = issue.end;
                    } else if (originalText) {
                        // Fallback: calculate positions if not provided
                        const position = originalText.indexOf(issue.span);
                        if (position !== -1) {
                            normalizedIssue.start = position;
                            normalizedIssue.end = position + issue.span.length;
                        }
                    }

                    return normalizedIssue;
                });

        } catch (err) {
            console.error("Error normalizing AI response:", err);
        }

        return normalized;
    }
}

module.exports = BaseAIProvider;