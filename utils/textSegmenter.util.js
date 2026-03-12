/**
 * Thai Text Chunking Utility
 *
 * This utility provides safe text chunking for Thai language content,
 * ensuring that text is split only at proper word boundaries.
 *
 * Uses the Intl.Segmenter API to detect word boundaries in Thai text.
 */

/**
 * Splits Thai text into chunks without breaking words
 *
 * @param {string} text - The Thai text to be chunked
 * @param {number} maxLength - Maximum length of each chunk in characters
 * @returns {string[]} Array of text chunks, each respecting word boundaries
 *
 * @example
 * const chunks = chunkThaiText("สวัสดีครับ ผมชื่อจอห์น", 10);
 * // Returns: ["สวัสดีครับ", "ผมชื่อจอห์น"]
 */
function chunkThaiText(text, maxLength) {
    if (!text || typeof text !== 'string') {
        return [];
    }

    if (text.length <= maxLength) {
        return [text];
    }

    const chunks = [];
    const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
    const segments = Array.from(segmenter.segment(text));

    let currentChunk = '';

    for (const segment of segments) {
        const word = segment.segment;

        // If adding this word would exceed maxLength
        if (currentChunk.length + word.length > maxLength) {
            // If currentChunk is not empty, save it and start a new chunk
            if (currentChunk.length > 0) {
                chunks.push(currentChunk);
                currentChunk = word;
            } else {
                // If a single word is longer than maxLength, we have to break it
                // This is a rare edge case for very long words
                chunks.push(word);
                currentChunk = '';
            }
        } else {
            // Add word to current chunk
            currentChunk += word;
        }
    }

    // Don't forget the last chunk
    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }

    return chunks;
}

module.exports = {
    chunkThaiText
};
