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
        return `You are a Thai spelling checker. Find ALL typos and fix them with minimal edits.

FIND THESE TYPES OF ERRORS:
- Missing characters: "ไท" -> "ไทย", "อาหร" -> "อาหาร"
- Missing tone marks: "เทียง" -> "เที่ยง"
- Wrong characters: "กิด" -> "กิน"
- Wrong tone marks: "ข่าว" -> "ข้าว"

DO NOT:
- Change to different words ("เทียง" -> "เย็น" is WRONG!)
- Rewrite sentences
- Fix must look similar to original

OUTPUT JSON:
{
  "language": "th",
  "issues": [
    {"start": 0, "end": 2, "span": "ไท", "replacement": "ไทย", "reason": "ขาดตัว ย"}
  ]
}

Rules: 0-based index, max 20 issues, order by start
If no errors: {"language":"th","issues":[]}`;
    }

    /**
     * Calculate Levenshtein edit distance between two strings
     * @param {string} a - First string
     * @param {string} b - Second string
     * @returns {number} Edit distance
     */
    getEditDistance(a, b) {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }

    /**
     * Check if replacement is a valid minimal correction
     * @param {string} span - Original text
     * @param {string} replacement - Proposed correction
     * @returns {boolean} True if valid minimal correction
     */
    isValidMinimalCorrection(span, replacement) {
        // Reject if identical
        if (span === replacement) return false;

        const editDistance = this.getEditDistance(span, replacement);
        const maxLength = Math.max(span.length, replacement.length);

        // Allow only if edit distance is small relative to length
        // For short words (1-3 chars): max 1 edit
        // For longer words: max 2 edits
        const maxAllowedEdits = maxLength <= 3 ? 1 : 2;

        if (editDistance > maxAllowedEdits) return false;

        // Calculate character overlap (how many chars are shared)
        const spanChars = new Set(span);
        const replacementChars = new Set(replacement);
        const intersection = new Set([...spanChars].filter(x => replacementChars.has(x)));
        const overlapRatio = intersection.size / Math.max(spanChars.size, replacementChars.size);

        // Require at least 50% character overlap (prevents complete word changes)
        return overlapRatio >= 0.5;
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
                    // Basic field validation
                    if (!issue ||
                        typeof issue.span !== 'string' ||
                        typeof issue.replacement !== 'string' ||
                        typeof issue.reason !== 'string' ||
                        issue.span.length < 1 || issue.span.length > 16 ||
                        issue.replacement.length < 1 || issue.replacement.length > 24 ||
                        issue.reason.length === 0 || issue.reason.length > 50) {
                        return false;
                    }

                    // CRITICAL: Validate minimal correction (reject semantic changes)
                    if (!this.isValidMinimalCorrection(issue.span, issue.replacement)) {
                        console.log(`[FILTER] Rejected semantic change: "${issue.span}" -> "${issue.replacement}"`);
                        return false;
                    }

                    return true;
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