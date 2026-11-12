/**
 * Response Text Extraction, Grounding Metadata Helpers, and Robust JSON Repair/Parsing.
 */

// --- Helper for Text Extraction ---
export const extractTextFromResponse = (response: any): string => {
    if (typeof response?.text === 'string' && response.text) return response.text; // SDK native
    const candidates = response?.candidates || response?.response?.candidates;
    if (candidates && candidates.length > 0) {
        const parts = candidates[0]?.content?.parts;
        if (parts && parts.length > 0) {
            const textParts = parts
                .filter((p: any) => !p.thought && !p.thinking)
                .map((p: any) => p.text || '')
                .join('');
            if (textParts.trim()) return textParts;
            return parts.map((p: any) => p.text || '').join('');
        }
    }
    return '';
};

// --- Helper for Grounding Web Chunks & Verified URLs Extraction ---
export const extractGroundingWebChunks = (response: any): Array<{ uri: string; title: string }> => {
    try {
        const candidates = response?.candidates || response?.response?.candidates;
        const metadata = candidates?.[0]?.groundingMetadata || response?.groundingMetadata;
        if (metadata?.groundingChunks && Array.isArray(metadata.groundingChunks)) {
            return metadata.groundingChunks
                .map((chunk: any) => chunk.web)
                .filter((web: any) => web && typeof web.uri === 'string' && web.uri.startsWith('http'));
        }
    } catch (e) {
        console.warn("Failed to extract grounding chunks:", e);
    }
    return [];
};

// --- Helper for Grounding Search Queries Extraction ---
export const extractGroundingSearchQueries = (response: any): string[] => {
    try {
        const candidates = response?.candidates || response?.response?.candidates;
        const metadata = candidates?.[0]?.groundingMetadata || response?.groundingMetadata;
        if (metadata?.webSearchQueries && Array.isArray(metadata.webSearchQueries)) {
            return metadata.webSearchQueries.filter((q: any) => typeof q === 'string');
        }
    } catch (e) {
        console.warn("Failed to extract search queries:", e);
    }
    return [];
};

// --- Helper for Robust JSON Parsing & Sanitization ---
const repairJsonSyntaxErrors = (input: string): string => {
    let s = input.replace(/```(?:json)?|```/gi, '').trim();

    // Fix orphan timestamp strings used as keys (e.g. "9:29", -> "timestamp": "9:29",)
    s = s.replace(/"(\d{1,2}:\d{2})",/g, '"timestamp": "$1",');

    // 1. Fix missing opening quote on property names at line starts or after { / , across newlines
    s = s.replace(/(^|[\n\r][ \t]*|[{,][ \t]*\r?\n[ \t]*)([a-zA-Z0-9_$-]+)"\s*:/g, '$1"$2":');

    // 2. Fix unquoted or single-quoted property names only at line starts or object key positions
    s = s.replace(/(^|[\n\r][ \t]*|[{,][ \t]*\r?\n[ \t]*)'?([a-zA-Z_][a-zA-Z0-9_$-]*)'?\s*:/g, '$1"$2":');

    // Also handle `{ key:` or `{\s*key:` at the immediate start of an inline object
    s = s.replace(/(\{\s*)'?([a-zA-Z_][a-zA-Z0-9_$-]*)'?\s*:/g, '$1"$2":');

    // 3. Fix missing closing quote on property names across newlines or line starts
    s = s.replace(/(^|[\n\r][ \t]*|[{,][ \t]*\r?\n[ \t]*)"([a-zA-Z0-9_$-]+)\s*:\s*(?=["[{0-9tfn-])/g, '$1"$2": ');

    // 4. Fix missing comma between property values and the next property key across newlines
    s = s.replace(/(["0-9}\]]|\btrue|\bfalse|\bnull)[ \t]*\r?\n([ \t]*"[a-zA-Z0-9_$-]+"\s*:)/g, '$1,\n$2');

    // 5. Remove trailing commas before closing } or ]
    s = s.replace(/,\s*([}\]])/g, '$1');

    return s;
};

const repairTruncatedJson = (jsonStr: string): string => {
    let s = repairJsonSyntaxErrors(jsonStr);

    // Remove trailing backslash at end
    s = s.replace(/\\$/, '');

    let inString = false;
    let escaped = false;
    const stack: string[] = [];

    for (let i = 0; i < s.length; i++) {
        const char = s[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === '\\') {
            escaped = true;
            continue;
        }
        if (char === '"') {
            inString = !inString;
            continue;
        }
        if (!inString) {
            if (char === '{' || char === '[') {
                stack.push(char);
            } else if (char === '}' || char === ']') {
                stack.pop();
            }
        }
    }

    // Close unterminated string
    if (inString) {
        s += '"';
    }

    // Sanitize unescaped control characters inside balanced string literals
    s = s.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (_match, p1) => {
        return `"${p1.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}"`;
    });

    // Clean dangling property colons or trailing commas at the truncated tail
    s = s.replace(/,\s*$/, '');
    s = s.replace(/:\s*$/, ': null');
    s = s.replace(/,\s*([}\]])/g, '$1');

    // Close all open braces and brackets in LIFO order
    while (stack.length > 0) {
        const openChar = stack.pop();
        s = s.replace(/,\s*$/, '');
        if (openChar === '{') {
            s = s.replace(/:\s*(?!(?:true|false|null)\b)[a-zA-Z_][a-zA-Z0-9_]*\s*$/, ': null');
            s = s.replace(/:\s*$/, ': null');
            s = s.replace(/,\s*"[^"\\]*(?:\\.[^"\\]*)*"\s*$/, '');
            s = s.replace(/,\s*[a-zA-Z0-9_$-]+"?\s*$/, '');
            s = s.replace(/\{\s*"[^"\\]*(?:\\.[^"\\]*)*"\s*$/, '{');
            s = s.replace(/\{\s*[a-zA-Z0-9_$-]+"?\s*$/, '{');
            s += '}';
        } else if (openChar === '[') {
            s = s.replace(/,\s*$/, '');
            s += ']';
        }
    }

    // Final trailing comma cleanup
    s = s.replace(/,\s*([}\]])/g, '$1');

    return s;
};

export const safeJsonParse = <T = any>(raw: string, fallback: any = null): T => {
    if (!raw || typeof raw !== 'string') return fallback;

    let clean = raw.replace(/```(?:json)?|```/gi, '').trim();

    // Extract outermost JSON structure if model prepended/appended conversational text
    const firstBrace = clean.indexOf('{');
    const firstBracket = clean.indexOf('[');
    const startIdx =
        firstBrace !== -1 && firstBracket !== -1
            ? Math.min(firstBrace, firstBracket)
            : Math.max(firstBrace, firstBracket);
    if (startIdx > 0) {
        clean = clean.slice(startIdx);
    }

    // 1. Direct JSON.parse
    try {
        return JSON.parse(clean);
    } catch (e) {
        // 2. Repair malformed property quotes, trailing commas, and unescaped newlines inside string values
        try {
            let sanitized = repairJsonSyntaxErrors(clean);
            sanitized = sanitized.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (_match, p1) => {
                return `"${p1.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}"`;
            });
            sanitized = sanitized.replace(/,\s*([}\]])/g, '$1');
            return JSON.parse(sanitized);
        } catch (e2) {
            // 3. Attempt full JSON repair for truncated output or malformed keys
            try {
                const repaired = repairTruncatedJson(clean);
                console.log("✅ Successfully repaired malformed/truncated JSON output!");
                return JSON.parse(repaired);
            } catch (e3) {
                console.error("Safe JSON parsing & repair failed. Returning fallback.", e3);
                console.log("Raw JSON text was:", clean);
                return fallback;
            }
        }
    }
};

export const resolveRedirectUrls = async (urls: string[]): Promise<Record<string, string>> => {
    const redirectUrls = urls.filter(u => u && typeof u === 'string' && (u.includes('vertexaisearch.cloud.google.com') || u.includes('google.com/url?')));
    if (redirectUrls.length === 0) return {};
    try {
        const res = await fetch('/api/resolve-urls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: redirectUrls })
        });
        if (res.ok) {
            const data = await res.json();
            return data.resolved || {};
        }
    } catch (e) {
        console.warn("Failed to batch resolve redirect URLs:", e);
    }
    return {};
};
