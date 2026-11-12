import {
    GraphNode,
    GraphLink,
    NoiseFilterResult,
    CrossReleaseEvolution
} from '../../services/noiseFilterService';

export const detectAccurateCommentLanguage = (text?: string, rawLang?: string): string => {
    const cleanText = String(text || '').trim();
    if (cleanText.length > 0) {
        if (/[\u3040-\u30ff]/.test(cleanText)) return 'Japanese';
        if (/[\uac00-\ud7af\u1100-\u11ff]/.test(cleanText)) return 'Korean';
        if (/[\u4e00-\u9fff]/.test(cleanText)) return 'Chinese';
        if (/[\u0400-\u04ff]/.test(cleanText)) return 'Russian';
        if (/[\u0600-\u06ff]/.test(cleanText)) return 'Arabic';

        const enScore = (cleanText.match(/\b(the|and|is|are|was|were|this|that|with|for|not|have|has|had|but|you|your|they|their|from|product|service|experience|customer|support|feature|design|pricing|value|delivery|platform|update|system|performance|quality|still|just|like|good|great|best|worst|bad|need|needs|feel|feels|make|makes|when|what|where|why|how|about|would|should|could|will|can|very|more|much|many|some|all|any|out|into|over|after|before|year|years)\b/gi) || []).length;

        const esScore = (cleanText.match(/\b(el|la|los|las|del|una|unos|unas|este|esta|estos|estas|producto|servicio|calidad|precio|cliente|clientes|experiencia|compra|muy|bueno|malo|porque|pero|como|para|con|sin|más|está|están|son|hay|tiene|hacer|mejor|peor)\b/gi) || []).length + (/[¿¡ñ]/i.test(cleanText) ? 2 : 0);
        const ptScore = (cleanText.match(/\b(o|os|as|um|uma|uns|umas|produto|serviço|qualidade|preço|cliente|clientes|experiência|compra|muito|bom|ruim|não|sim|porque|mas|para|com|sem|está|estão|são|tem|fazer|melhor|pior)\b/gi) || []).length + (/[ãõç]/i.test(cleanText) ? 2 : 0);
        const frScore = (cleanText.match(/\b(le|la|les|des|une|produit|service|qualité|prix|client|clients|expérience|achat|très|bon|mauvais|pourquoi|mais|pour|avec|sans|dans|est|sont|c'est|j'ai|faire|meilleur|pire)\b/gi) || []).length + (/[œæèêëàâùûîï]/i.test(cleanText) ? 2 : 0);
        const deScore = (cleanText.match(/\b(das|der|die|den|dem|ein|eine|einer|produkt|service|qualität|preis|kunde|kunden|erfahrung|nicht|gut|schlecht|warum|aber|für|mit|ohne|ist|sind|ich|habe|machen|besser|schlechter|immer|noch|auch|oder|und|wir|sie)\b/gi) || []).length + (/[äöüß]/i.test(cleanText) ? 2 : 0);
        const itScore = (cleanText.match(/\b(il|lo|gli|le|del|della|un|una|prodotto|servizio|qualità|prezzo|cliente|clienti|esperienza|acquisto|molto|buono|bello|perché|ma|per|con|senza|nel|nella|è|sono|questo|questa|fare|migliore|peggiore)\b/gi) || []).length;
        const trScore = (cleanText.match(/\b(bir|ve|bu|için|çok|iyi|kötü|ürün|hizmet|kalite|fiyat|müşteri|deneyim|ama|değil|var|yok|gibi|daha|en|kadar)\b/gi) || []).length + (/[ğış]/i.test(cleanText) ? 2 : 0);

        const candidates = [
            { lang: 'Spanish', score: esScore },
            { lang: 'Portuguese', score: ptScore },
            { lang: 'French', score: frScore },
            { lang: 'German', score: deScore },
            { lang: 'Italian', score: itScore },
            { lang: 'Turkish', score: trScore }
        ].sort((a, b) => b.score - a.score);

        if (candidates[0].score >= 3 && candidates[0].score > enScore) {
            return candidates[0].lang;
        }
        return 'English';
    }

    const raw = String(rawLang || '').toLowerCase().trim();
    if (raw === 'spanish' || raw === 'español') return 'Spanish';
    if (raw === 'german' || raw === 'deutsch') return 'German';
    if (raw === 'portuguese' || raw === 'português') return 'Portuguese';
    if (raw === 'french' || raw === 'français') return 'French';
    if (raw === 'italian' || raw === 'italiano') return 'Italian';
    if (raw === 'turkish' || raw === 'türkçe') return 'Turkish';
    if (raw === 'japanese' || raw === '日本語') return 'Japanese';
    if (raw === 'korean' || raw === '한국어') return 'Korean';
    if (raw === 'chinese' || raw === '中文') return 'Chinese';
    if (raw === 'russian' || raw === 'русский') return 'Russian';
    if (raw === 'arabic' || raw === 'العربية') return 'Arabic';
    return 'English';
};

export const getCountryFlag = (langOrCountry?: string, text?: string): { language: string; flag: string; label: string } => {
    const lang = detectAccurateCommentLanguage(text, langOrCountry);
    switch (lang) {
        case 'Spanish': return { language: 'Spanish', flag: '🇪🇸', label: 'Spanish' };
        case 'German': return { language: 'German', flag: '🇩🇪', label: 'German' };
        case 'Portuguese': return { language: 'Portuguese', flag: '🇧🇷', label: 'Portuguese' };
        case 'French': return { language: 'French', flag: '🇫🇷', label: 'French' };
        case 'Italian': return { language: 'Italian', flag: '🇮🇹', label: 'Italian' };
        case 'Turkish': return { language: 'Turkish', flag: '🇹🇷', label: 'Turkish' };
        case 'Japanese': return { language: 'Japanese', flag: '🇯🇵', label: 'Japanese' };
        case 'Korean': return { language: 'Korean', flag: '🇰🇷', label: 'Korean' };
        case 'Chinese': return { language: 'Chinese', flag: '🇨🇳', label: 'Chinese' };
        case 'Russian': return { language: 'Russian', flag: '🇷🇺', label: 'Russian' };
        case 'Arabic': return { language: 'Arabic', flag: '🇸🇦', label: 'Arabic' };
        default: return { language: 'English', flag: '🇺🇸', label: 'English' };
    }
};

export const isPlatformOrSourceKeyword = (rawLabel: string): boolean => {
    const clean = String(rawLabel || '').toLowerCase().replace(/^#/, '').trim();
    if (!clean) return true;
    return (
        clean === 'metacritic' ||
        clean.startsWith('metacritic ') ||
        clean.includes('critic review') ||
        clean.includes('user review') ||
        clean.includes('player review') ||
        clean.includes('critic consensus') ||
        clean.includes('/critic-reviews/') ||
        clean.includes('/user-reviews/') ||
        clean === 'critic score' ||
        clean === 'user score' ||
        clean === 'youtube' ||
        clean === 'reddit' ||
        clean === 'steam' ||
        clean === 'trustpilot'
    );
};

export const normalizeCategoryName = (rawCat: string): string => {
    const trimmed = String(rawCat || '').trim();
    if (!trimmed) return 'Core Product & Customer Experience';
    return trimmed.replace(/&([A-Za-z])/g, '& $1').replace(/\s+/g, ' ');
};

export const GRAPH_NODE_STOP_WORDS = new Set([
    'and', 'for', 'the', 'with', 'from', 'into', 'over', 'under', 'about', 'after', 'before',
    'online', 'value', 'system', 'systems', 'overall', 'level', 'levels', 'edition', 'update',
    'updates', 'new', 'day', 'one', 'loop', 'factor', 'praise', 'logic', 'depth', 'content',
    'feel', 'mark', 'base', 'full', 'total', 'in', 'on', 'of', 'to', 'vs', 'lack', 'high',
    'low', 'good', 'bad', 'great', 'poor'
]);

export const computeHybridNodeScore = (
    pos: number,
    neg: number,
    neu: number,
    priorRatio?: number,
    nodeSentimentHint?: string
): { positiveRatio: number; sentiment: 'positive' | 'mixed' | 'negative' } => {
    const tot = pos + neg + neu;
    const pol = pos + neg;
    const hasValidPrior = typeof priorRatio === 'number' && !Number.isNaN(priorRatio) && priorRatio >= 1 && priorRatio <= 99;
    const effectivePrior = hasValidPrior
        ? priorRatio
        : nodeSentimentHint === 'positive'
        ? 68
        : nodeSentimentHint === 'mixed'
        ? 45
        : nodeSentimentHint === 'negative'
        ? 25
        : undefined;

    let positiveRatio = 50;
    if (tot > 0) {
        const empConst = ((pos + 0.5 * neu) / tot) * 100;
        const empPol = pol > 0 ? (pos / pol) * 100 : empConst;
        const isPositiveHint = (typeof effectivePrior === 'number' && effectivePrior >= 50) || nodeSentimentHint === 'positive';
        const isMixedHint = nodeSentimentHint === 'mixed' || (typeof effectivePrior === 'number' && effectivePrior >= 40 && effectivePrior < 55);
        const empRatio = isPositiveHint
            ? Math.max(empConst, empPol)
            : isMixedHint
            ? Math.max(empConst, empPol, 32)
            : empConst;

        if (typeof effectivePrior === 'number') {
            const k = 25;
            const maxEmpWeight = isMixedHint ? 12 : 18;
            const w = Math.min(tot, maxEmpWeight);
            positiveRatio = Math.round(((w * empRatio) + (k * effectivePrior)) / (w + k));
        } else {
            positiveRatio = Math.round(empRatio);
        }
    } else if (typeof effectivePrior === 'number') {
        positiveRatio = Math.round(effectivePrior);
    }

    positiveRatio = Math.max(0, Math.min(100, positiveRatio));
    const sentiment: 'positive' | 'mixed' | 'negative' =
        positiveRatio >= 50 ? 'positive' : positiveRatio >= 36 ? 'mixed' : 'negative';
    return { positiveRatio, sentiment };
};

export const ensureAllCategoryHubs = (nodes: GraphNode[], totalMentions: number = 1000): GraphNode[] => {
    if (!Array.isArray(nodes) || nodes.length === 0) return nodes || [];
    const seenLabels = new Set<string>();
    const result: GraphNode[] = [];

    nodes.forEach(n => {
        if (!n || isPlatformOrSourceKeyword(n.label)) return;
        const copy = { ...n };
        if (copy.category) copy.category = normalizeCategoryName(copy.category);
        if (copy.type === 'category' || copy.type === 'release') {
            copy.label = normalizeCategoryName(copy.label);
        }
        const normKey = `${copy.type === 'category' || copy.type === 'release' ? 'hub' : 'feat'}::${String(copy.label || '').toLowerCase().trim()}`;
        if (seenLabels.has(normKey)) return;
        seenLabels.add(normKey);
        result.push(copy);
    });

    const existingIds = new Set(result.map(n => n.id));
    const hubNodes = result.filter(n => n.type === 'category' || n.type === 'release');
    if (hubNodes.length > 0) {
        return result.map(n => {
            if (n.type === 'category' || n.type === 'release') {
                const copy = { ...n };
                const catFeatureNodes = result.filter(
                    fn => fn.type !== 'category' && fn.type !== 'release' &&
                    normalizeCategoryName(fn.category || '').toLowerCase() === normalizeCategoryName(copy.label || copy.category || '').toLowerCase()
                );
                if (typeof copy.positiveRatio !== 'number' || Number.isNaN(copy.positiveRatio)) {
                    const validChildRatios = catFeatureNodes.filter(fn => typeof fn.positiveRatio === 'number' && !Number.isNaN(fn.positiveRatio));
                    const avgChild = validChildRatios.length > 0
                        ? Math.round(validChildRatios.reduce((acc, fn) => acc + (fn.positiveRatio as number), 0) / validChildRatios.length)
                        : 50;
                    copy.positiveRatio = copy.sentiment === 'positive' ? Math.max(avgChild, 55) : avgChild;
                } else {
                    copy.positiveRatio = Math.max(0, Math.min(100, Math.round(copy.positiveRatio)));
                }
                copy.sentiment = copy.positiveRatio >= 50 ? 'positive' : copy.positiveRatio >= 36 ? 'mixed' : 'negative';
                if (!copy.mentionCount || copy.mentionCount >= totalMentions) {
                    const childMentions = catFeatureNodes.reduce((acc, fn) => acc + (fn.mentionCount || 0), 0);
                    copy.mentionCount = childMentions > 0 && childMentions < totalMentions
                        ? childMentions
                        : Math.max(25, Math.round(totalMentions * (0.35 / (hubNodes.length || 1))));
                }
                return copy;
            }
            return n;
        });
    }

    const discoveredCategories = new Set<string>();
    result.forEach(n => {
        if (n.category && n.category.trim()) discoveredCategories.add(normalizeCategoryName(n.category));
    });

    discoveredCategories.forEach(cat => {
        const catId = `cat_${String(cat || '').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
        if (!existingIds.has(catId)) {
            const catFeatureNodes = result.filter(n => normalizeCategoryName(n.category || '').toLowerCase() === cat.toLowerCase());
            const totalCatMentions = catFeatureNodes.reduce((acc, fn) => acc + (fn.mentionCount || 20), 0);
            const validChildRatios = catFeatureNodes.filter(fn => typeof fn.positiveRatio === 'number' && !Number.isNaN(fn.positiveRatio));
            const avgPosRatio = validChildRatios.length > 0
                ? Math.round(validChildRatios.reduce((acc, fn) => acc + (fn.positiveRatio as number), 0) / validChildRatios.length)
                : 50;

            result.unshift({
                id: catId,
                label: cat,
                type: 'category',
                category: cat,
                size: 32,
                mentionCount: totalCatMentions > 0 && totalCatMentions < totalMentions ? totalCatMentions : Math.round(totalMentions / Math.max(discoveredCategories.size, 1)),
                positiveRatio: avgPosRatio,
                sentiment: avgPosRatio >= 50 ? 'positive' : avgPosRatio >= 36 ? 'mixed' : 'negative'
            });
            existingIds.add(catId);
        }
    });
    return result;
};

export const extractCleanYtId = (raw: string): string => {
    if (!raw) return '';
    const trimmed = raw.trim();
    const ytMatch = trimmed.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i);
    if (ytMatch && ytMatch[1]) return ytMatch[1];
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed) && !trimmed.startsWith('http')) return trimmed;
    return '';
};

export const computeAbcdScorePct = (result: any): number => {
    if (!result) return 85;
    if (typeof result.overallScorePercent === 'number') return Math.round(result.overallScorePercent);
    const s = result.abcd_scores || result.scores;
    if (s) {
        const a = Number(s.attract?.score ?? s.attract ?? 8.5);
        const b = Number(s.brand?.score ?? s.brand ?? 8.5);
        const c = Number(s.connect?.score ?? s.connect ?? 8.0);
        const d = Number(s.direct?.score ?? s.direct ?? 8.0);
        const avg10 = (a + b + c + d) / 4;
        return Math.round(avg10 <= 10 ? avg10 * 10 : avg10);
    }
    if (typeof result.overallScore === 'number') {
        return Math.round(result.overallScore <= 10 ? result.overallScore * 10 : result.overallScore);
    }
    return 85;
};

export const saveGraphCheckpointToGCS = async (
    companyName: string,
    graphPayload: Partial<NoiseFilterResult> & { nodes: GraphNode[]; links: GraphLink[] },
    alsoSyncMasterRun: boolean = true
) => {
    const cleanNodes = (graphPayload.nodes || []).filter(n => !isPlatformOrSourceKeyword(n?.label));
    const cleanLinks = graphPayload.links || [];
    const dedicatedGraphData = {
        nodes: cleanNodes,
        links: cleanLinks,
        graphNodes: cleanNodes,
        graphLinks: cleanLinks,
        featureClusters: graphPayload.featureClusters || [],
        totalHarvested: graphPayload.totalHarvested || 0,
        signalCount: graphPayload.signalCount || 0,
        noiseCount: graphPayload.noiseCount || 0,
        savedAt: new Date().toISOString()
    };

    try {
        (window as any).__dmlGraphCache = (window as any).__dmlGraphCache || {};
        (window as any).__dmlGraphCache[companyName] = dedicatedGraphData;
        localStorage.setItem(`dml_graph_cache_${companyName}`, JSON.stringify(dedicatedGraphData));
    } catch {}

    await Promise.all([
        fetch('/api/save-run/noise_filter_graph', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyName, data: dedicatedGraphData })
        }).catch(() => null),
        ...(alsoSyncMasterRun
            ? [
                  fetch('/api/save-run/noise_filter', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          companyName,
                          data: {
                              ...graphPayload,
                              nodes: cleanNodes,
                              links: cleanLinks,
                              graphNodes: cleanNodes,
                              graphLinks: cleanLinks
                          }
                      })
                  }).catch(() => null)
              ]
            : [])
    ]);
};

export const normalizeTrajectoryPillarsList = (rawPillars: any): CrossReleaseEvolution[] | null => {
    if (!Array.isArray(rawPillars)) return null;
    return rawPillars.map((p: any) => {
        const trendStr = String(p?.trajectory || p?.trend || 'stable').toLowerCase();
        const base = Number(p?.year2024Sentiment ?? p?.scores?.['2024'] ?? p?.baselineSentiment ?? 70);
        const prior = Number(p?.year2025Sentiment ?? p?.scores?.['2025'] ?? p?.priorSentiment ?? 75);
        const curr = Number(p?.year2026Sentiment ?? p?.scores?.['2026'] ?? p?.currentSentiment ?? 82);
        const delta = curr - prior;
        const trajectory: CrossReleaseEvolution['trajectory'] =
            delta >= 2 ? (trendStr.includes('emerg') ? 'emerging' : 'improving') : delta <= -2 ? 'critical' : 'stable';
        const multiYearDelta = (curr - base) / 2;
        const effectiveSlope = Math.round((delta * 0.6) + (multiYearDelta * 0.4));
        const predicted2027 = Math.max(15, Math.min(95, Math.round(curr + (effectiveSlope * 0.8))));
        let rawTarget = Number(p?.year2027Sentiment ?? p?.scores?.['2027'] ?? p?.targetSentiment ?? predicted2027);
        if (isNaN(rawTarget) || (curr < 50 && rawTarget >= 68) || (delta < 0 && rawTarget > curr + 5) || (rawTarget - curr > 14)) {
            rawTarget = predicted2027;
        }
        return {
            ...p,
            feature: String(p?.feature || p?.pillar || 'Core Experience'),
            category: String(p?.category || p?.pillar || 'Core Experience'),
            year2022Sentiment: Number(p?.year2022Sentiment ?? p?.scores?.['2022'] ?? 60),
            year2023Sentiment: Number(p?.year2023Sentiment ?? p?.scores?.['2023'] ?? 65),
            year2024Sentiment: base,
            year2025Sentiment: prior,
            year2026Sentiment: curr,
            year2027Sentiment: rawTarget,
            targetSentiment: rawTarget,
            trajectory,
            keyDrivers: Array.isArray(p?.keyDrivers) ? p.keyDrivers : [],
            actionableMandate: p?.actionableMandate || p?.summary || '',
            summary: p?.summary || ''
        };
    });
};
