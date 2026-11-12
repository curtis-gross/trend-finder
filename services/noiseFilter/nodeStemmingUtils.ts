import { type GraphNode } from './noiseTypes';

export const normalizeNodeKey = (raw?: string | null): string =>
    String(raw ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

export const stripSourceMetadataPrefix = (text?: string | null): string =>
    String(text ?? '')
        .replace(/^\[(?:Metacritic|YouTube|Reddit|Steam|TikTok|Trustpilot)[^\]]*\]\s*/i, '')
        .trim();

const PLATFORM_SOURCE_BLACKLIST = new Set([
    'metacritic', 'metascore', 'metacritic review', 'metacritic reviews', 'metacritic critic', 'metacritic critics',
    'metacritic user', 'metacritic users', 'metacritic score', 'metacritic scores', 'metacritic rating',
    'critic review', 'critic reviews', 'user review', 'user reviews', 'critic score', 'user score',
    'youtube', 'youtube comments', 'youtube video', 'youtube videos', 'youtube channel', 'youtubers',
    'reddit', 'subreddit', 'reddit thread', 'reddit threads', 'reddit post', 'reddit posts', 'reddit community',
    'steam', 'steam review', 'steam reviews', 'steam community', 'steam users',
    'tiktok', 'twitter', 'x', 'twitch', 'trustpilot', 'discord', 'instagram', 'facebook',
    'forbes', 'review site', 'news outlet'
]);

const PLATFORM_TOKEN_SET = new Set([
    'metacritic', 'metascore', 'youtube', 'youtuber', 'youtubers', 'reddit', 'subreddit', 'subreddits',
    'steam', 'tiktok', 'twitter', 'twitch', 'trustpilot', 'discord'
]);

const SOURCE_META_FILLER_TOKENS = new Set([
    ...Array.from(PLATFORM_TOKEN_SET),
    'critic', 'critics', 'user', 'users', 'customer', 'customers', 'community', 'review', 'reviews',
    'reviewer', 'reviewers', 'score', 'scores', 'rating', 'ratings', 'comment', 'comments',
    'channel', 'channels', 'video', 'videos', 'thread', 'threads', 'post', 'posts', 'platform',
    'platforms', 'source', 'sources', 'media', 'press', 'outlet', 'outlets', 'publication', 'publications',
    'positive', 'negative', 'mixed', 'neutral', 'overall', 'general', 'average', 'high', 'low', 'consensus', 'reception', 'sentiment', 'feedback'
]);

export const isPlatformOrSourceNode = (raw?: string | null): boolean => {
    const norm = normalizeNodeKey(raw);
    if (!norm) return true;
    if (PLATFORM_SOURCE_BLACKLIST.has(norm)) return true;
    const tokens = norm.split(' ').filter(Boolean);
    if (tokens.some(t => PLATFORM_TOKEN_SET.has(t))) return true;
    if (tokens.length > 0 && tokens.every(t => SOURCE_META_FILLER_TOKENS.has(t))) return true;
    return false;
};

const GRAPH_STOP_WORDS = new Set([
    'the', 'and', 'for', 'with', 'from', 'into', 'over', 'under', 'about', 'after', 'before',
    'issue', 'issues', 'problem', 'problems', 'system', 'systems', 'feature', 'features',
    'experience', 'experiences', 'update', 'updates', 'change', 'changes', 'quality',
    'level', 'levels', 'general', 'overall', 'lack', 'need', 'needs', 'more', 'less', 'better',
    'worse', 'bad', 'good', 'poor', 'high', 'low', 'new', 'old', 'current', 'state', 'status',
    'product', 'products', 'service', 'services', 'user', 'users', 'customer', 'customers', 'community', 'feedback', 'complaint',
    'complaints', 'concern', 'concerns', 'request', 'requests', 'improvement', 'improvements',
    'fix', 'fixes', 'broken', 'working', 'aspect', 'aspects', 'element', 'elements',
    'metacritic', 'metascore', 'youtube', 'youtuber', 'youtubers', 'reddit', 'subreddit', 'subreddits',
    'steam', 'tiktok', 'twitter', 'twitch', 'trustpilot', 'review', 'reviews', 'reviewer', 'reviewers',
    'critic', 'critics', 'score', 'scores', 'rating', 'ratings', 'channel', 'channels', 'platform',
    'platforms', 'source', 'sources', 'comment', 'comments', 'post', 'posts', 'thread', 'threads',
    'video', 'videos'
]);

const stemDomainToken = (token?: string | null): string => {
    let w = String(token ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (w.length <= 3) return w;
    if (w.endsWith('tions')) w = w.slice(0, -5) + 't';
    else if (w.endsWith('tion')) w = w.slice(0, -4) + 't';
    else if (w.endsWith('ings')) w = w.slice(0, -4);
    else if (w.endsWith('ing') && w.length > 5) w = w.slice(0, -3);
    else if (w.endsWith('ies') && w.length > 4) w = w.slice(0, -3) + 'y';
    else if (w.endsWith('es') && w.length > 4) w = w.slice(0, -2);
    else if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) w = w.slice(0, -1);
    return w;
};

export const extractDomainStems = (phrase?: string | null): string[] => {
    const tokens = normalizeNodeKey(phrase).split(' ').filter(Boolean);
    const stems = tokens
        .filter(t => t.length >= 2 && !GRAPH_STOP_WORDS.has(t))
        .map(stemDomainToken)
        .filter(t => t.length >= 2 && !GRAPH_STOP_WORDS.has(t));
    if (stems.length === 0) {
        return tokens.map(stemDomainToken).filter(Boolean);
    }
    return Array.from(new Set(stems));
};

const GENERIC_SENTIMENT_FILLERS = new Set([
    'customer feedback', 'general feedback', 'user feedback', 'community feedback',
    'positive reception', 'negative reception', 'mixed reception', 'overall reception',
    'positive sentiment', 'negative sentiment', 'neutral sentiment', 'mixed sentiment',
    'positive feedback', 'negative feedback', 'constructive feedback', 'mixed feedback',
    'positive impression', 'negative impression', 'first impression', 'overall impression',
    'general approval', 'general satisfaction', 'high satisfaction', 'low satisfaction',
    'customer satisfaction', 'overall satisfaction',
    'product quality', 'overall quality', 'overall value',
    'positive experience', 'negative experience', 'overall experience',
    'lack of innovation', 'lack of major innovation', 'lack of visual improvement',
    'modest improvements', 'general praise', 'general criticism',
    'customer experience', 'general experience', 'user experience'
]);

const GENERIC_FILLER_REGEX = /^(positive|negative|neutral|general|overall|high|low|good|bad|great|strong|weak|mixed|solid|decent|poor)\s+(product\s+)?(reception|sentiment|feedback|impression|approval|satisfaction|enjoyment|experience|reaction|response|opinion|review|reviews|comments?|quality|improvements?|value)$/i;

export const GENERIC_EVALUATION_STEMS = new Set([
    'posit', 'negat', 'neutral', 'satisfact', 'enjoy', 'enjoyment', 'great', 'good', 'bad',
    'poor', 'awesom', 'amaz', 'terribl', 'horribl', 'worst', 'best', 'lov', 'hat', 'recept',
    'impress', 'approv', 'prais', 'critic', 'disappoint', 'frustrat', 'excit', 'solid', 'decent',
    'mediocr', 'averag', 'factor', 'full', 'pric', 'valu', 'worth',
    'failur', 'enforc', 'absenc', 'wait', 'frequent', 'heav', 'extrem', 'sever', 'unfair'
]);

const DOMAIN_STEM_SYNONYMS: Record<string, string> = {
    'latenc': 'delay', 'lag': 'delay', 'unrespons': 'delay',
    'visual': 'design', 'aesthetic': 'design', 'styl': 'design',
    'crash': 'stability', 'disconnect': 'stability', 'bug': 'stability', 'defect': 'stability',
    'support': 'service', 'refund': 'service', 'return': 'service', 'warrant': 'service',
    'pric': 'value', 'cost': 'value', 'expens': 'value', 'subscrib': 'value', 'monetiz': 'value',
    'ship': 'delivery', 'deliver': 'delivery', 'packag': 'delivery',
    'durabl': 'quality', 'craft': 'quality', 'material': 'quality'
};

export const extractCanonicalTopicStems = (rawPhrase: string): string[] => {
    const normalized = normalizeNodeKey(rawPhrase);
    const rawStems = extractDomainStems(normalized);
    return Array.from(new Set(rawStems.map(s => DOMAIN_STEM_SYNONYMS[s] || s)));
};

export const isGenericOrCategoryTopic = (
    rawKw: string | undefined,
    categoryNormSet: Set<string>,
    companyNorm: string
): boolean => {
    const norm = normalizeNodeKey(rawKw);
    if (!norm || norm.length < 3) return true;
    if (norm === companyNorm) return true;
    if (isPlatformOrSourceNode(rawKw)) return true;
    if (categoryNormSet.has(norm)) return true;
    if (GENERIC_SENTIMENT_FILLERS.has(norm)) return true;
    if (GENERIC_FILLER_REGEX.test(norm)) return true;
    const stems = extractCanonicalTopicStems(norm);
    if (stems.length === 0) return true;
    if (stems.every(s => GENERIC_EVALUATION_STEMS.has(s))) return true;
    return false;
};

export const computePairSentiment = (pos: number, neg: number): 'positive' | 'negative' | 'mixed' => {
    if (pos > 0 && neg > 0 && Math.abs(pos - neg) <= Math.ceil((pos + neg) * 0.35)) return 'mixed';
    if (pos > neg) return 'positive';
    if (neg > pos) return 'negative';
    return 'mixed';
};

export const buildNodeLookupAndProfiles = (nodes: GraphNode[]) => {
    const nodeById = new Map<string, GraphNode>();
    const normToCanonicalId = new Map<string, string>();
    const nodeProfiles = new Map<string, { node: GraphNode; normId: string; normLabel: string; stems: Set<string>; stemsArr: string[] }>();

    nodes.forEach(n => {
        if (!n || !n.id) return;
        nodeById.set(n.id, n);
        const normId = normalizeNodeKey(n.id);
        const normLabel = normalizeNodeKey(n.label);
        if (normId) normToCanonicalId.set(normId, n.id);
        if (normLabel) normToCanonicalId.set(normLabel, n.id);
        const stemsArr = extractDomainStems(`${n.label || ''} ${n.id || ''}`);
        nodeProfiles.set(n.id, { node: n, normId, normLabel, stems: new Set(stemsArr), stemsArr });
    });

    const resolveNodeId = (rawRef?: string): string | null => {
        if (!rawRef) return null;
        if (nodeById.has(rawRef)) return rawRef;
        const norm = normalizeNodeKey(rawRef);
        if (!norm) return null;
        if (normToCanonicalId.has(norm)) return normToCanonicalId.get(norm)!;
        if (norm.length >= 4) {
            for (const [candidateNorm, canonId] of normToCanonicalId.entries()) {
                if (candidateNorm.length >= 4 && (candidateNorm.includes(norm) || norm.includes(candidateNorm))) {
                    return canonId;
                }
            }
        }
        return null;
    };

    return { nodeById, nodeProfiles, resolveNodeId };
};
