/**
 * Fuzzy search utilities for matching location names
 * Helps with mispronunciations, accents, and typos
 */

/**
 * Calculate Levenshtein distance between two strings
 * This measures how many single-character edits are needed to change one word into another
 */
function levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return matrix[len1][len2];
}

/**
 * Normalize text for better matching
 * - Convert to lowercase
 * - Remove accents and special characters
 * - Normalize common variations
 */
export function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/ß/g, 'ss')              // German ß -> ss
        .replace(/ä/g, 'ae')              // ä -> ae
        .replace(/ö/g, 'oe')              // ö -> oe
        .replace(/ü/g, 'ue')              // ü -> ue
        .replace(/[^a-z0-9\s]/g, '')      // Remove special chars
        .replace(/\s+/g, ' ')             // Normalize spaces
        .trim();
}

/**
 * Calculate similarity score between two strings (0-1, higher is better)
 */
export function calculateSimilarity(str1: string, str2: string): number {
    const normalized1 = normalizeText(str1);
    const normalized2 = normalizeText(str2);

    // Exact match after normalization
    if (normalized1 === normalized2) {
        return 1.0;
    }

    // Check if one contains the other
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
        return 0.9;
    }

    // Calculate Levenshtein distance
    const distance = levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);

    // Convert distance to similarity score (0-1)
    const similarity = 1 - (distance / maxLength);

    // Boost score if words start the same way (common with mispronunciations)
    const minLength = Math.min(normalized1.length, normalized2.length);
    let commonPrefixLength = 0;
    for (let i = 0; i < minLength; i++) {
        if (normalized1[i] === normalized2[i]) {
            commonPrefixLength++;
        } else {
            break;
        }
    }

    const prefixBonus = (commonPrefixLength / maxLength) * 0.2;

    return Math.min(1.0, similarity + prefixBonus);
}

/**
 * Find best matches from a list of options
 */
export function findBestMatches<T>(
    query: string,
    options: T[],
    getTextFn: (item: T) => string,
    threshold: number = 0.5,
    maxResults: number = 5
): Array<{ item: T; score: number }> {
    const scoredOptions = options.map(item => ({
        item,
        score: calculateSimilarity(query, getTextFn(item))
    }));

    return scoredOptions
        .filter(({ score }) => score >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);
}

/**
 * Check if query matches any word in the target string
 * Useful for multi-word location names
 */
export function matchesAnyWord(query: string, target: string, threshold: number = 0.7): boolean {
    const normalizedQuery = normalizeText(query);
    const words = normalizeText(target).split(' ');

    return words.some(word => {
        const similarity = calculateSimilarity(normalizedQuery, word);
        return similarity >= threshold;
    });
}

/**
 * Apply phonetic corrections for common German pronunciation mistakes
 * This helps users who might mispronounce German sounds due to their native language
 */
export function applyPhoneticCorrections(query: string): string[] {
    const normalized = normalizeText(query);
    const variations: string[] = [query]; // Always include original

    // Common pronunciation mistakes:

    // 1. W/V confusion (very common in many languages)
    if (normalized.includes('w')) {
        variations.push(query.replace(/w/gi, 'v'));
    }
    if (normalized.includes('v')) {
        variations.push(query.replace(/v/gi, 'w'));
    }

    // 2. CH sounds (often mispronounced as 'sh', 'k', or 'tsch')
    if (normalized.includes('ch')) {
        variations.push(query.replace(/ch/gi, 'sch'));
        variations.push(query.replace(/ch/gi, 'k'));
    }
    if (normalized.includes('sch')) {
        variations.push(query.replace(/sch/gi, 'ch'));
    }

    // 3. Z/TS confusion
    if (normalized.includes('z')) {
        variations.push(query.replace(/z/gi, 'ts'));
    }
    if (normalized.includes('ts')) {
        variations.push(query.replace(/ts/gi, 'z'));
    }

    // 4. Umlaut variations (ä, ö, ü)
    if (normalized.includes('a')) {
        variations.push(query.replace(/a/gi, 'ä'));
    }
    if (normalized.includes('o')) {
        variations.push(query.replace(/o/gi, 'ö'));
    }
    if (normalized.includes('u')) {
        variations.push(query.replace(/u/gi, 'ü'));
    }

    // 5. Double consonants (often dropped or added incorrectly)
    // Remove double consonants
    variations.push(query.replace(/([bcdfghjklmnpqrstvwxz])\1/gi, '$1'));

    // 6. Final 'e' (often dropped in speech)
    if (normalized.endsWith('e')) {
        variations.push(query.slice(0, -1));
    } else {
        variations.push(query + 'e');
    }

    // 7. 'ei' vs 'ai' confusion
    if (normalized.includes('ei')) {
        variations.push(query.replace(/ei/gi, 'ai'));
    }
    if (normalized.includes('ai')) {
        variations.push(query.replace(/ai/gi, 'ei'));
    }

    // Return unique variations
    return Array.from(new Set(variations));
}
