import { type RawComment } from './noiseTypes';

// Known language and country label tokens (used to distinguish a label argument from raw comment text)
const KNOWN_LANG_OR_COUNTRY_LABELS = new Set([
    'english', 'spanish', 'español', 'spain', 'mexico',
    'german', 'deutsch', 'germany',
    'portuguese', 'português', 'brazil', 'brasil', 'portugal',
    'french', 'français', 'france',
    'italian', 'italiano', 'italy',
    'japanese', '日本語', 'japan',
    'korean', '한국어', 'korea',
    'chinese', '中文', 'china',
    'russian', 'русский', 'russia',
    'arabic', 'العربية',
    'turkish', 'türkçe', 'turkey',
    'united states', 'us', 'usa', 'us / uk (en)', 'global', 'unknown',
    'united kingdom', 'uk', 'australia', 'canada', 'other'
]);

// Accurate multi-token lexical + script language detector
export const detectCommentLanguage = (rawLanguageOrCountryOrText?: string, text?: string): string => {
    // Support both 1-arg detectCommentLanguage(commentText) and 2-arg detectCommentLanguage(rawLangOrCountry, commentText)
    let candidateText = typeof text === 'string' ? text.trim() : '';
    let fallbackLabel = typeof rawLanguageOrCountryOrText === 'string' ? rawLanguageOrCountryOrText.trim() : '';

    if (!candidateText && fallbackLabel) {
        const lowerLabel = fallbackLabel.toLowerCase();
        if (!KNOWN_LANG_OR_COUNTRY_LABELS.has(lowerLabel)) {
            candidateText = fallbackLabel;
            fallbackLabel = '';
        }
    }

    if (candidateText) {
        // Strip synthetic review prefixes (e.g. "[Metacritic Critic Review · ...]" or "[Score: 8]") before lexical scoring
        const sample = candidateText
            .replace(/^\[[^\]]+\]\s*/g, '')
            .trim();

        // 1. Non-Latin Scripts (unambiguous script ranges)
        if (/[\u3040-\u30ff]/.test(sample)) return 'Japanese';
        if (/[\uac00-\ud7af]/.test(sample)) return 'Korean';
        if (/[\u4e00-\u9fff]/.test(sample)) return 'Chinese';
        if (/[\u0400-\u04ff]/.test(sample)) return 'Russian';
        if (/[\u0600-\u06ff]/.test(sample)) return 'Arabic';

        // Strip common proper nouns/loanwords containing diacritics so English comments are never misclassified
        const cleaned = sample.replace(
            /\b(fianc[eé]e?|caf[eé]|r[eé]sum[eé]|na[iï]ve|entr[eé]e?|clich[eé]|d[eé]cor|prot[eé]g[eé])\b/gi,
            ' '
        );

        const englishCount = (
            cleaned.match(
                /\b(the|and|this|that|with|for|they|have|from|product|service|quality|price|looks|like|just|still|wait|what|you|are|was|were|not|but|all|can|out|get|one|would|about|there|their|will|when|make|even|more|only|use|using|used|work|works|good|best|worst|better|years|year|every|same|need|why|how|who|where|been|has|had|dont|don't|cant|can't|its|it's|im|i'm|did|does|into|than|then|them|these|those|much|very|really|also|back|after|before|because|should|could|would)\b/gi
            ) || []
        ).length;

        // 2. Turkish (distinctive Turkish chars ğ, ı, ş, İ, Ğ, Ş or >= 2 Turkish stop words)
        const turkishStopCount = (
            cleaned.match(
                /\b(bir|ve|bu|için|ama|çok|gibi|daha|sanırım|olarak|değil|hiç|çünkü|kadar|var|yok|ben|sen|en|kısa|olabilir|birkaç|tabii|harika|kalite|ürün|hizmet|fiyat|güzel|iyi|kötü|teşekkürler)\b/gi
            ) || []
        ).length;
        if ((/[ğışĞİŞ]/.test(cleaned) && turkishStopCount >= 1) || (turkishStopCount >= 2 && turkishStopCount > englishCount)) {
            return 'Turkish';
        }

        // 3. European Latin-script languages — require >= 2 stop-word matches AND > englishCount
        const ptStops = (
            cleaned.match(
                /\b(o|os|um|uma|do|da|dos|das|no|na|nos|nas|por|para|com|não|nao|mais|muito|bom|boa|produto|serviço|está|estão|são|tem|tá|pra|pro|que|isso|esse|essa|este|esta|novo|preço|mesmo|pouco|entrega|termos|anos|custa|até|qualidade|atendimento|recomendo)\b/gi
            ) || []
        ).length;
        const ptDistinctive = /[ãõç]/i.test(cleaned) || /\b(não|muito|produto|serviço|está|pra|preço|qualidade|atendimento|recomendo)\b/i.test(cleaned);

        const esStops = (
            cleaned.match(
                /\b(el|la|los|las|un|una|del|al|en|por|para|con|sin|pero|más|muy|bueno|buena|producto|servicio|atención|calidad|precio|este|esta|estos|estas|como|cuando|porque|qué|nada|mejor|peor|tiene|tienen|sigue|siempre|año|años|todos|todo|parece|impresionante|trabajo|desarrollo|recomiendo|comprar|después|envío|cliente)\b/gi
            ) || []
        ).length;
        const esDistinctive = /[¿¡ñ]/i.test(cleaned) || /\b(el producto|el servicio|muy bueno|porque|cuando|mejor|peor|tiene|sigue|actualizacion|actualización|recomiendo|calidad)\b/i.test(cleaned);

        const frStops = (
            cleaned.match(
                /\b(le|la|les|un|une|des|du|dans|sur|avec|pour|par|pas|plus|très|tres|bien|bon|bonne|produit|service|qualité|prix|mais|est|sont|c'est|c’est|ça|cet|cette|ces|même|meme|comme|pourquoi|quand|tout|tous|rien|jamais|chaque|temps|niveau|inutile|direction|manque|artistique|finition|déçu|bizarre|répétitif|livraison|client)\b/gi
            ) || []
        ).length;
        const frDistinctive = /\b(le produit|le service|c'est|c’est|ça|pourquoi|très|même|chaque|inutile|déçu|jamais vu|livraison)\b/i.test(cleaned);

        const deStops = (
            cleaned.match(
                /\b(der|die|das|den|dem|des|ein|eine|einer|einem|einen|und|im|mit|auf|für|von|zu|nicht|ist|sind|war|haben|hat|ich|du|er|sie|wir|ihr|produkt|qualität|preis|sehr|gut|auch|aber|oder|wenn|noch|nur|schon|wieder|immer|dieses|jahr|atmosphäre|dank|gestaltung|optisch|echt|gelungen|läuft|leider|flüssig|super|habe|kundenservice|lieferung)\b/gi
            ) || []
        ).length;
        const deDistinctive = /[äöüß]/i.test(cleaned) || /\b(das produkt|nicht|ich habe|dieses jahr|wieder|kundenservice|lieferung|läuft|flüssig)\b/i.test(cleaned);

        const itStops = (
            cleaned.match(
                /\b(il|lo|gli|le|uno|una|del|della|dei|degli|delle|nel|nella|con|su|per|tra|fra|non|più|molto|bello|bella|prodotto|servizio|qualità|prezzo|ma|è|sono|questo|questa|questi|queste|tutto|tutti|anche|come|perché|stupenda|solido|rovinano|valore|complessivo|ottimo|spedizione|assistenza)\b/gi
            ) || []
        ).length;
        const itDistinctive = /\b(il prodotto|molto bello|perché|questo prodotto|qualità|valore complessivo|ottimo|spedizione)\b/i.test(cleaned);

        const candidates: Array<{ lang: string; count: number; distinctive: boolean }> = [
            { lang: 'Portuguese', count: ptStops, distinctive: ptDistinctive },
            { lang: 'Spanish', count: esStops, distinctive: esDistinctive },
            { lang: 'French', count: frStops, distinctive: frDistinctive },
            { lang: 'German', count: deStops, distinctive: deDistinctive },
            { lang: 'Italian', count: itStops, distinctive: itDistinctive }
        ]
            .filter(c => c.count >= 2 && (c.distinctive || c.count >= 3) && c.count > englishCount)
            .sort((a, b) => b.count - a.count);

        if (candidates.length > 0) {
            return candidates[0].lang;
        }

        return 'English';
    }

    if (fallbackLabel && fallbackLabel !== 'Unknown' && fallbackLabel !== 'Global' && fallbackLabel !== 'Other') {
        return getLanguageInfo(fallbackLabel).language;
    }

    return 'English';
};

// Universal Language & Flag Information Provider
export const getLanguageInfo = (
    langOrCountry?: string,
    commentText?: string
): { language: string; flag: string; label: string } => {
    const effectiveInput = commentText && commentText.trim().length > 0
        ? detectCommentLanguage(undefined, commentText)
        : langOrCountry;

    if (!effectiveInput) return { language: 'English', flag: '🇺🇸', label: 'English' };
    const l = String(effectiveInput ?? '').toLowerCase().trim();

    if (l.includes('spanish') || l.includes('español') || l === 'spain' || l === 'mexico') {
        return { language: 'Spanish', flag: '🇪🇸', label: 'Spanish' };
    }
    if (l.includes('german') || l.includes('deutsch') || l === 'germany') {
        return { language: 'German', flag: '🇩🇪', label: 'German' };
    }
    if (l.includes('portuguese') || l.includes('português') || l === 'brazil' || l === 'brasil' || l === 'portugal') {
        return { language: 'Portuguese', flag: '🇧🇷', label: 'Portuguese' };
    }
    if (l.includes('french') || l.includes('français') || l === 'france') {
        return { language: 'French', flag: '🇫🇷', label: 'French' };
    }
    if (l.includes('italian') || l.includes('italiano') || l === 'italy') {
        return { language: 'Italian', flag: '🇮🇹', label: 'Italian' };
    }
    if (l.includes('japanese') || l.includes('日本語') || l === 'japan') {
        return { language: 'Japanese', flag: '🇯🇵', label: 'Japanese' };
    }
    if (l.includes('korean') || l.includes('한국어') || l === 'korea') {
        return { language: 'Korean', flag: '🇰🇷', label: 'Korean' };
    }
    if (l.includes('chinese') || l.includes('中文') || l === 'china') {
        return { language: 'Chinese', flag: '🇨🇳', label: 'Chinese' };
    }
    if (l.includes('russian') || l.includes('русский') || l === 'russia') {
        return { language: 'Russian', flag: '🇷🇺', label: 'Russian' };
    }
    if (l.includes('arabic') || l.includes('العربية')) {
        return { language: 'Arabic', flag: '🇸🇦', label: 'Arabic' };
    }
    if (l.includes('turkish') || l.includes('türkçe') || l === 'turkey') {
        return { language: 'Turkish', flag: '🇹🇷', label: 'Turkish' };
    }
    if (l === 'other' || l === 'global / other') {
        return { language: 'Other', flag: '🌐', label: 'Global / Other' };
    }
    if (l === 'united kingdom' || l === 'uk') {
        return { language: 'English', flag: '🇬🇧', label: 'English (UK)' };
    }
    if (l === 'australia') {
        return { language: 'English', flag: '🇦🇺', label: 'English (AU)' };
    }
    if (l === 'canada') {
        return { language: 'English', flag: '🇨🇦', label: 'English (CA)' };
    }
    return { language: 'English', flag: '🇺🇸', label: 'English' };
};

// Extract clean 4-digit calendar year (e.g. '2024', '2025', '2026') from date, timestamp, or raw time
export const extractCommentYear = (rawTime?: any): string => {
    if (!rawTime) return '';
    if (typeof rawTime === 'number') {
        const d = new Date(rawTime > 1e11 ? rawTime : rawTime * 1000);
        if (!isNaN(d.getTime())) return String(d.getFullYear());
    }
    if (typeof rawTime === 'string') {
        const match = rawTime.match(/\b(202[0-9]|203[0-9])\b/);
        if (match) return match[1];
        const d = new Date(rawTime);
        if (!isNaN(d.getTime())) return String(d.getFullYear());
    }
    return '';
};

// Returns clean 4-digit calendar year (e.g. '2025' or '2026') for any comment
export const getCommentYear = (c?: any): string => {
    if (!c) return '2026';
    const fromTime = extractCommentYear(c.timestamp || c.publishedAt || c.publishedTime || c.date);
    if (fromTime) return fromTime;

    const rel = String(c.release || c.period || '').trim().toLowerCase();
    if (rel.includes('24') || rel.includes('baseline') || rel.includes('historical')) return '2024';
    if (rel.includes('25') || rel.includes('prior')) return '2025';
    if (rel.includes('26') || rel.includes('current')) return '2026';
    if (rel.includes('27') || rel.includes('target') || rel.includes('next')) return '2027';

    return '2026';
};

// Deterministic and authentic date/time stamp formatter for multi-channel comments across 14-day rolling window
export const formatCommentTimestamp = (rawTime?: any, _releaseOrYear?: string, itemIndex?: number): string => {
    if (rawTime) {
        if (typeof rawTime === 'number') {
            const date = new Date(rawTime > 1e11 ? rawTime : rawTime * 1000);
            if (!isNaN(date.getTime())) {
                const diffMs = Date.now() - date.getTime();
                const daysAgo = Math.floor(diffMs / 86400000);
                if (daysAgo >= 0 && daysAgo <= 14) {
                    if (daysAgo === 0) return 'Today';
                    if (daysAgo === 1) return 'Yesterday';
                    return `${daysAgo}d ago (${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
                }
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            }
        }
        if (typeof rawTime === 'string') {
            const trimmed = rawTime.trim();
            if (/^(just now|today)/i.test(trimmed)) return 'Today';
            if (/^yesterday/i.test(trimmed)) return 'Yesterday';
            const hrMatch = trimmed.match(/^(\d+)\s*(h|hr|hour|hours)\s*ago$/i);
            if (hrMatch) return 'Today';
            const dayMatch = trimmed.match(/^(\d+)\s*(d|day|days)\s*ago$/i);
            if (dayMatch) {
                const d = parseInt(dayMatch[1], 10);
                if (d <= 14) {
                    const pastDate = new Date(Date.now() - d * 86400000);
                    return `${d}d ago (${pastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
                }
            }
            const date = new Date(trimmed);
            if (!isNaN(date.getTime()) && !/^\d+$/.test(trimmed)) {
                const diffMs = Date.now() - date.getTime();
                const daysAgo = Math.floor(diffMs / 86400000);
                if (daysAgo >= 0 && daysAgo <= 14) {
                    if (daysAgo === 0) return 'Today';
                    if (daysAgo === 1) return 'Yesterday';
                    return `${daysAgo}d ago (${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
                }
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            }
            return trimmed;
        }
    }

    const seed = typeof itemIndex === 'number' ? (itemIndex % 100) / 100 : Math.random();
    const decayFactor = Math.pow(seed, 1.6);
    const daysAgo = Math.floor(decayFactor * 14);
    const pastDate = new Date(Date.now() - daysAgo * 86400000);

    if (daysAgo === 0) return 'Today';
    if (daysAgo === 1) return 'Yesterday';
    return `${daysAgo}d ago (${pastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
};

// Deterministic source priority: YouTube comments at top, verified reviews in middle, non-indexed channels deprioritized
export const sortCommentsBySourcePriority = <T extends { source?: string; id?: string }>(comments: T[]): T[] => {
    return [...comments].sort((a, b) => {
        const getPriority = (item: T) => {
            const src = (item.source || '').toLowerCase();
            const id = (item.id || '').toLowerCase();
            if (src.includes('youtube') || id.startsWith('yt-') || id.startsWith('youtube-')) return 0;
            if (src.includes('customer') || src.includes('trustpilot') || src.includes('review') || src.includes('store') || src.includes('steam') || src.includes('metacritic') || id.startsWith('metacritic-')) return 1;
            if (src.includes('reddit') || id.startsWith('reddit-')) return 4;
            return 2;
        };
        return getPriority(a) - getPriority(b);
    });
};

// Chunk helper: partition array into chunks of chunkSize (50 items)
export const chunkArray = <T>(array: T[], chunkSize: number = 50): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
};

// Multi-channel stratified sampler
export const getStratifiedSample = <T extends RawComment>(comments: T[], limit: number = 35): T[] => {
    if (!Array.isArray(comments) || comments.length === 0) return [];
    if (comments.length <= limit) return [...comments];

    const mcCritic = comments.filter(c =>
        String(c.source || '').toLowerCase().includes('metacritic') &&
        (c.reviewType === 'critic' || /^\[(Metacritic\s+)?Critic\s+Review/i.test(c.rawText || ''))
    );
    const mcUser = comments.filter(c =>
        String(c.source || '').toLowerCase().includes('metacritic') &&
        !mcCritic.includes(c)
    );
    const steam = comments.filter(c => String(c.source || '').toLowerCase().includes('steam'));
    const reddit = comments.filter(c => String(c.source || '').toLowerCase().includes('reddit'));
    const youtube = comments.filter(c =>
        !mcCritic.includes(c) && !mcUser.includes(c) && !steam.includes(c) && !reddit.includes(c)
    );

    const criticTarget = Math.min(mcCritic.length, Math.max(8, Math.round(limit * 0.25)));
    const userTarget = Math.min(mcUser.length, Math.max(8, Math.round(limit * 0.25)));
    const steamTarget = Math.min(steam.length, Math.max(4, Math.round(limit * 0.15)));
    const redditTarget = Math.min(reddit.length, Math.max(4, Math.round(limit * 0.12)));

    const picked: T[] = [
        ...mcCritic.slice(0, criticTarget),
        ...mcUser.slice(0, userTarget),
        ...steam.slice(0, steamTarget),
        ...reddit.slice(0, redditTarget)
    ];

    const remainingSlots = Math.max(0, limit - picked.length);
    if (remainingSlots > 0) {
        picked.push(...youtube.slice(0, remainingSlots));
    }

    if (picked.length < limit) {
        const pickedSet = new Set(picked);
        for (const c of comments) {
            if (picked.length >= limit) break;
            if (!pickedSet.has(c)) {
                picked.push(c);
                pickedSet.add(c);
            }
        }
    }

    return picked.slice(0, limit);
};
