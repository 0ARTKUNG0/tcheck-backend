class BaseAIProvider {
    constructor(config) {
        this.config = config;
    }

    async checkGrammar(text, mode) {
        throw new Error("checkGrammar must be implemented by subclass");
    }

    getSystemPrompt() {
        return `You are an expert Thai contextual spelling checker. You MUST read and understand the ENTIRE sentence context before making any corrections.

FIND AND FIX THESE ERRORS:
- Contextual typos (CRITICAL): Typos that change the meaning or don't fit the sentence. Always choose the replacement that makes logical sense in the context (e.g., "ไปเที่ยวนันไหม" -> "ไปเที่ยวกันไหม").
- Missing characters: "ไท" -> "ไทย", "อาหร" -> "อาหาร"
- Missing tone marks: "เทียง" -> "เที่ยง"
- Wrong characters: "กิด" -> "กิน"
- Wrong tone marks: "ข่าว" -> "ข้าว"

DO NOT:
- Do NOT rewrite the entire sentence or change the core meaning.
- Do NOT choose a visually similar word if it makes no sense in the context (Context is more important than visual similarity).
- Do NOT correct or remove the string "[---PAGE_BREAK---]". It is a page separator and must remain exactly as is in the original text. 
- Rules: 0-based index, max 30 issues, order by start. If the text has "[---PAGE_BREAK---]", ignore those segments when finding errors.

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

    isValidMinimalCorrection(span, replacement) {
        if (span === replacement) return false;

        const editDistance = this.getEditDistance(span, replacement);
        const maxLength = Math.max(span.length, replacement.length);
        const maxAllowedEdits = maxLength <= 3 ? 1 : 2;

        if (editDistance > maxAllowedEdits) return false;

        const spanChars = new Set(span);
        const replacementChars = new Set(replacement);
        const intersection = new Set([...spanChars].filter(x => replacementChars.has(x)));
        const overlapRatio = intersection.size / Math.max(spanChars.size, replacementChars.size);

        return overlapRatio >= 0.5;
    }

    normalizeResponse(response, originalText = '') {
        const normalized = {
            language: "th",
            issues: []
        };

        try {
            if (!response || typeof response !== 'object') {
                return normalized;
            }

            const issues = Array.isArray(response.issues) ? response.issues : [];

            normalized.issues = issues
                .filter(issue => {
                    if (!issue ||
                        typeof issue.span !== 'string' ||
                        typeof issue.replacement !== 'string' ||
                        typeof issue.reason !== 'string' ||
                        issue.span.length < 1 || issue.span.length > 16 ||
                        issue.replacement.length < 1 || issue.replacement.length > 24 ||
                        issue.reason.length === 0 || issue.reason.length > 50) {
                        return false;
                    }

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

                    if (typeof issue.start === 'number' && typeof issue.end === 'number') {
                        normalizedIssue.start = issue.start;
                        normalizedIssue.end = issue.end;
                    } else if (originalText) {
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