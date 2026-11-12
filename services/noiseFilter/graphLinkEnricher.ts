import {
    type EnrichedComment,
    type FilteredComment,
    type GraphLink,
    type GraphNode,
    type Stage2Output,
    type Stage3Output,
} from './noiseTypes';
import {
    buildNodeLookupAndProfiles,
    computePairSentiment,
    extractDomainStems,
    normalizeNodeKey,
} from './nodeStemmingUtils';

/**
 * Multi-Signal Topic Relationship Graph Link Builder.
 * Combines LLM-synthesized edges with deterministic signals mined from:
 * 1. Canonical ID + Label Normalization
 * 2. Category Hub-to-Spoke Pillar Links (`category_pillar`)
 * 3. Comment Co-Occurrence & Text Cross-Mention Mining (`co_mentioned` / `comment_overlap`)
 * 4. Shared Video/Post/Subreddit Thread Affinity (`shared_source`)
 * 5. Semantic Token & Cross-Category Bridges (`cross_category_bridge` / `semantic_affinity`)
 */
export const enrichGraphLinksWithCommentAndTopicSignals = (
    nodes: GraphNode[],
    existingLinks: GraphLink[],
    stage3Data?: Stage3Output | null,
    stage2Data?: Stage2Output | null
): GraphLink[] => {
    if (!Array.isArray(nodes) || nodes.length === 0) return [];

    const { nodeById, nodeProfiles, resolveNodeId } = buildNodeLookupAndProfiles(nodes);
    const getEdgeKey = (idA: string, idB: string): string => (idA < idB ? `${idA}|||${idB}` : `${idB}|||${idA}`);
    const linkMap = new Map<string, GraphLink>();
    const nodeDegree = new Map<string, number>();
    const nodeTopicToTopicDegree = new Map<string, number>();

    const incrementDegrees = (idA: string, idB: string) => {
        nodeDegree.set(idA, (nodeDegree.get(idA) || 0) + 1);
        nodeDegree.set(idB, (nodeDegree.get(idB) || 0) + 1);
        const nA = nodeById.get(idA);
        const nB = nodeById.get(idB);
        if (nA?.type !== 'category' && nA?.type !== 'release' && nB?.type !== 'category' && nB?.type !== 'release') {
            nodeTopicToTopicDegree.set(idA, (nodeTopicToTopicDegree.get(idA) || 0) + 1);
            nodeTopicToTopicDegree.set(idB, (nodeTopicToTopicDegree.get(idB) || 0) + 1);
        }
    };

    const RELATIONSHIP_PRIORITY: Record<string, number> = {
        co_mentioned: 6, cross_category_bridge: 5, comment_overlap: 4, shared_source: 3, category_pillar: 2, semantic_affinity: 1
    };

    const upsertLink = (
        rawSource: string,
        rawTarget: string,
        weight: number,
        sentiment: 'positive' | 'negative' | 'neutral' | 'mixed',
        relationship?: string,
        reason?: string,
        sharedComments?: number,
        boostExisting: boolean = false
    ) => {
        const sourceId = resolveNodeId(rawSource);
        const targetId = resolveNodeId(rawTarget);
        if (!sourceId || !targetId || sourceId === targetId) return;

        const key = getEdgeKey(sourceId, targetId);
        const cleanSent: 'positive' | 'negative' | 'neutral' | 'mixed' =
            sentiment === 'positive' || sentiment === 'negative' || sentiment === 'neutral' || sentiment === 'mixed' ? sentiment : 'mixed';

        const existing = linkMap.get(key);
        if (!existing) {
            linkMap.set(key, {
                source: sourceId,
                target: targetId,
                weight: Math.max(2, Math.min(45, Math.round(weight || 8))),
                sentiment: cleanSent,
                ...(relationship ? { relationship } : {}),
                ...(typeof sharedComments === 'number' && sharedComments > 0 ? { sharedComments } : {}),
                ...(reason ? { reason } : {})
            });
            incrementDegrees(sourceId, targetId);
        } else {
            existing.weight = boostExisting
                ? Math.min(45, existing.weight + Math.max(2, Math.round(weight * 0.45)))
                : Math.max(existing.weight, Math.min(45, Math.round(weight || 8)));
            if (typeof sharedComments === 'number' && sharedComments > 0) {
                existing.sharedComments = Math.max(existing.sharedComments || 0, sharedComments);
            }
            const existingPrio = RELATIONSHIP_PRIORITY[existing.relationship || ''] || 0;
            const incomingPrio = RELATIONSHIP_PRIORITY[relationship || ''] || 0;
            if (relationship && (!existing.relationship || incomingPrio >= existingPrio)) existing.relationship = relationship;
            if (reason && (!existing.reason || incomingPrio >= existingPrio)) existing.reason = reason;
            if (existing.sentiment === 'neutral' && cleanSent !== 'neutral') existing.sentiment = cleanSent;
        }
    };

    (existingLinks || []).forEach(l => {
        if (l) upsertLink(l.source, l.target, Number(l.weight) || 10, l.sentiment || 'mixed', l.relationship || 'semantic_affinity', l.reason, l.sharedComments, false);
    });

    const hubNodes = nodes.filter(n => n.type === 'category' || n.type === 'release');
    const topicNodes = nodes.filter(n => n.type !== 'category' && n.type !== 'release');

    // 2. Category Hub-to-Spoke Pillar Links
    if (hubNodes.length > 0) {
        const clusterKeywordToCategory = new Map<string, string>();
        (stage3Data?.featureClusters || []).forEach(fc => {
            (fc.topKeywords || []).forEach(kw => {
                const kNorm = normalizeNodeKey(kw);
                if (kNorm) clusterKeywordToCategory.set(kNorm, fc.category);
            });
        });

        topicNodes.forEach((tNode, idx) => {
            const tCatNorm = normalizeNodeKey(tNode.category);
            const tLabelNorm = normalizeNodeKey(tNode.label);
            const targetCatNorm = normalizeNodeKey(clusterKeywordToCategory.get(tLabelNorm)) || tCatNorm;

            let matchedHub = hubNodes.find(h => {
                const hIdNorm = normalizeNodeKey(h.id);
                const hLabelNorm = normalizeNodeKey(h.label);
                return Boolean(targetCatNorm && (hIdNorm === targetCatNorm || hLabelNorm === targetCatNorm || (targetCatNorm.length >= 3 && (hLabelNorm.includes(targetCatNorm) || targetCatNorm.includes(hIdNorm)))));
            });

            if (!matchedHub) {
                const tStems = nodeProfiles.get(tNode.id)?.stems || new Set<string>();
                let bestOverlap = 0;
                for (const h of hubNodes) {
                    const hStems = nodeProfiles.get(h.id)?.stems || new Set<string>();
                    let overlap = 0;
                    tStems.forEach(s => { if (hStems.has(s)) overlap++; });
                    if (overlap > bestOverlap) { bestOverlap = overlap; matchedHub = h; }
                }
            }
            if (!matchedHub) matchedHub = hubNodes[idx % hubNodes.length];
            if (!tNode.category && matchedHub) tNode.category = matchedHub.id;

            const pillarWeight = Math.max(8, Math.min(30, Math.round(Math.sqrt(tNode.mentionCount || 10) * 2.5)));
            const pillarSent: 'positive' | 'negative' | 'neutral' | 'mixed' = (tNode.sentiment as any) || (matchedHub.sentiment as any) || 'mixed';
            upsertLink(matchedHub.id, tNode.id, pillarWeight, pillarSent, 'category_pillar', `Core topic under ${matchedHub.label} (${tNode.mentionCount || 1} mentions)`, tNode.mentionCount || undefined, false);
        });
    }

    // 3. Comment Co-Occurrence & 4. Shared Source Mining
    const commentsCorpus: Array<EnrichedComment | FilteredComment> = [];
    const seenCommentIds = new Set<string>();
    (stage3Data?.enrichedComments || []).forEach(c => {
        if (c && !c.isNoise) { commentsCorpus.push(c); if (c.id) seenCommentIds.add(c.id); }
    });
    (stage2Data?.filteredComments || []).forEach(c => {
        if (c && !c.isNoise && (!c.id || !seenCommentIds.has(c.id))) { commentsCorpus.push(c); if (c.id) seenCommentIds.add(c.id); }
    });

    const pairStatsMap = new Map<string, { idA: string; idB: string; sharedComments: number; explicitCoMentions: number; pos: number; neg: number; neu: number }>();
    const interHubCommentMap = new Map<string, { hubA: string; hubB: string; count: number; pos: number; neg: number }>();
    const sourceTopicMap = new Map<string, Map<string, { count: number; pos: number; neg: number }>>();

    commentsCorpus.forEach(comment => {
        const ec = comment as EnrichedComment;
        const explicitKeywords = new Set<string>();
        [...(Array.isArray(ec.keywords) ? ec.keywords : []), ...(Array.isArray(ec.discoveredTopics) ? ec.discoveredTopics : []), ...(Array.isArray(ec.structuredKeywords) ? ec.structuredKeywords : [])].forEach(k => {
            const normK = normalizeNodeKey(k);
            if (normK) explicitKeywords.add(normK);
        });

        const fullText = `${comment.rawText || ''} ${ec.constructiveSummary || ''} ${ec.actionableSuggestion || ''}`;
        const normText = normalizeNodeKey(fullText);
        const commentStems = new Set(extractDomainStems(fullText));
        const matchedTopics: Array<{ id: string; isExplicit: boolean; specificity: number }> = [];

        for (const tNode of topicNodes) {
            const profile = nodeProfiles.get(tNode.id);
            if (!profile) continue;
            let isExplicit = explicitKeywords.has(profile.normLabel) || explicitKeywords.has(profile.normId);
            if (!isExplicit) {
                for (const ek of explicitKeywords) {
                    if (ek.length >= 4 && profile.normLabel.length >= 4 && (ek.includes(profile.normLabel) || profile.normLabel.includes(ek))) { isExplicit = true; break; }
                }
            }
            let isTextMatch = false;
            if (!isExplicit && normText) {
                if (profile.normLabel.length >= 4 && normText.includes(profile.normLabel)) {
                    isTextMatch = true;
                } else if (profile.stemsArr.length >= 2) {
                    let matchedStemCount = 0;
                    for (const st of profile.stemsArr) if (commentStems.has(st)) matchedStemCount++;
                    if (matchedStemCount >= 2 || (profile.stemsArr.length >= 3 && matchedStemCount >= Math.ceil(profile.stemsArr.length * 0.65))) isTextMatch = true;
                } else if (profile.stemsArr.length === 1 && profile.stemsArr[0].length >= 5 && commentStems.has(profile.stemsArr[0])) {
                    isTextMatch = true;
                }
            }
            if (isExplicit || isTextMatch) {
                matchedTopics.push({ id: tNode.id, isExplicit, specificity: (isExplicit ? 100 : 0) + profile.stemsArr.length * 10 + profile.normLabel.length });
            }
        }

        const topMatched = matchedTopics.sort((a, b) => b.specificity - a.specificity).slice(0, 8);
        const cSent = ec.sentiment || 'neutral';
        const isPos = cSent === 'positive' ? 1 : 0;
        const isNeg = cSent === 'negative' ? 1 : 0;
        const isNeu = cSent !== 'positive' && cSent !== 'negative' ? 1 : 0;

        for (let i = 0; i < topMatched.length; i++) {
            for (let j = i + 1; j < topMatched.length; j++) {
                const mA = topMatched[i];
                const mB = topMatched[j];
                const edgeKey = getEdgeKey(mA.id, mB.id);
                const stat = pairStatsMap.get(edgeKey) || { idA: mA.id < mB.id ? mA.id : mB.id, idB: mA.id < mB.id ? mB.id : mA.id, sharedComments: 0, explicitCoMentions: 0, pos: 0, neg: 0, neu: 0 };
                stat.sharedComments += 1;
                if (mA.isExplicit && mB.isExplicit) stat.explicitCoMentions += 1;
                stat.pos += isPos;
                stat.neg += isNeg;
                stat.neu += isNeu;
                pairStatsMap.set(edgeKey, stat);
            }
        }

        const touchedHubIds = new Set<string>();
        if (ec.featureCategory) {
            const resolvedCatHub = resolveNodeId(ec.featureCategory);
            if (resolvedCatHub && nodeById.get(resolvedCatHub)?.type === 'category') touchedHubIds.add(resolvedCatHub);
        }
        topMatched.forEach(m => {
            const tNode = nodeById.get(m.id);
            const resolvedHub = tNode?.category ? resolveNodeId(tNode.category) : null;
            if (resolvedHub && (nodeById.get(resolvedHub)?.type === 'category' || nodeById.get(resolvedHub)?.type === 'release')) touchedHubIds.add(resolvedHub);
        });
        const hubArr = Array.from(touchedHubIds);
        for (let i = 0; i < hubArr.length; i++) {
            for (let j = i + 1; j < hubArr.length; j++) {
                const hKey = getEdgeKey(hubArr[i], hubArr[j]);
                const existingHubStat = interHubCommentMap.get(hKey) || { hubA: hubArr[i] < hubArr[j] ? hubArr[i] : hubArr[j], hubB: hubArr[i] < hubArr[j] ? hubArr[j] : hubArr[i], count: 0, pos: 0, neg: 0 };
                existingHubStat.count += 1;
                existingHubStat.pos += isPos;
                existingHubStat.neg += isNeg;
                interHubCommentMap.set(hKey, existingHubStat);
            }
        }

        const sourceKey = String(comment.sourceLabel || '').trim();
        if (sourceKey && topMatched.length > 0) {
            if (!sourceTopicMap.has(sourceKey)) sourceTopicMap.set(sourceKey, new Map());
            const topicMapForSource = sourceTopicMap.get(sourceKey)!;
            topMatched.forEach(m => {
                const prev = topicMapForSource.get(m.id) || { count: 0, pos: 0, neg: 0 };
                prev.count += 1;
                prev.pos += isPos;
                prev.neg += isNeg;
                topicMapForSource.set(m.id, prev);
            });
        }
    });

    Array.from(pairStatsMap.values())
        .sort((a, b) => (b.sharedComments * 2 + b.explicitCoMentions) - (a.sharedComments * 2 + a.explicitCoMentions))
        .slice(0, 140)
        .forEach(stat => {
            const nodeA = nodeById.get(stat.idA);
            const nodeB = nodeById.get(stat.idB);
            if (!nodeA || !nodeB) return;
            const isCrossCategory = Boolean(nodeA.category && nodeB.category && normalizeNodeKey(nodeA.category) !== normalizeNodeKey(nodeB.category));
            const sentiment = computePairSentiment(stat.pos, stat.neg);
            const weight = Math.min(38, 7 + stat.sharedComments * 3 + stat.explicitCoMentions * 2);
            const relationship = stat.explicitCoMentions > 0 ? 'co_mentioned' : isCrossCategory ? 'cross_category_bridge' : 'comment_overlap';
            const reason = stat.explicitCoMentions > 0
                ? (isCrossCategory ? `Co-mentioned in ${stat.sharedComments} comment${stat.sharedComments > 1 ? 's' : ''} bridging ${nodeA.category} & ${nodeB.category}` : `Co-mentioned in ${stat.sharedComments} customer comment${stat.sharedComments > 1 ? 's' : ''}`)
                : (isCrossCategory ? `Cross-category comment overlap (${stat.sharedComments} comment${stat.sharedComments > 1 ? 's' : ''}) between ${nodeA.category} & ${nodeB.category}` : `Overlapping customer feedback across ${stat.sharedComments} comment${stat.sharedComments > 1 ? 's' : ''}`);
            upsertLink(stat.idA, stat.idB, weight, sentiment, relationship, reason, stat.sharedComments, true);
        });

    const sharedSourcePairMap = new Map<string, { idA: string; idB: string; sources: string[]; totalMentions: number; pos: number; neg: number }>();
    sourceTopicMap.forEach((topicCounts, sourceLabel) => {
        const frequentTopics = Array.from(topicCounts.entries()).filter(([_, st]) => st.count >= 1).sort((a, b) => b[1].count - a[1].count).slice(0, 12);
        for (let i = 0; i < frequentTopics.length; i++) {
            for (let j = i + 1; j < frequentTopics.length; j++) {
                const [idA, stA] = frequentTopics[i];
                const [idB, stB] = frequentTopics[j];
                if (stA.count + stB.count < 3) continue;
                const edgeKey = getEdgeKey(idA, idB);
                const entry = sharedSourcePairMap.get(edgeKey) || { idA: idA < idB ? idA : idB, idB: idA < idB ? idB : idA, sources: [], totalMentions: 0, pos: 0, neg: 0 };
                entry.sources.push(sourceLabel);
                entry.totalMentions += Math.min(stA.count, stB.count);
                entry.pos += stA.pos + stB.pos;
                entry.neg += stA.neg + stB.neg;
                sharedSourcePairMap.set(edgeKey, entry);
            }
        }
    });

    Array.from(sharedSourcePairMap.values())
        .sort((a, b) => (b.sources.length * 3 + b.totalMentions) - (a.sources.length * 3 + a.totalMentions))
        .slice(0, 60)
        .forEach(entry => {
            const extraCount = entry.sources.length - 1;
            const reason = `Co-discussed in "${entry.sources[0]}"${extraCount > 0 ? ` (+${extraCount} more source${extraCount > 1 ? 's' : ''})` : ''}`;
            upsertLink(entry.idA, entry.idB, Math.min(26, 6 + entry.sources.length * 3 + entry.totalMentions * 2), computePairSentiment(entry.pos, entry.neg), 'shared_source', reason, entry.totalMentions, true);
        });

    // 5. Semantic Token & Cross-Category Bridges
    (stage3Data?.featureClusters || []).forEach(fc => {
        const clusterNodeIds = (fc.topKeywords || []).map(kw => resolveNodeId(kw)).filter((id): id is string => Boolean(id && nodeById.get(id)?.type !== 'category'));
        for (let i = 0; i < clusterNodeIds.length; i++) {
            for (let j = i + 1; j < Math.min(clusterNodeIds.length, i + 3); j++) {
                const nA = nodeById.get(clusterNodeIds[i]);
                const nB = nodeById.get(clusterNodeIds[j]);
                if (!nA || !nB) continue;
                const sent: 'positive' | 'negative' | 'mixed' = nA.sentiment === nB.sentiment && (nA.sentiment === 'positive' || nA.sentiment === 'negative') ? nA.sentiment : 'mixed';
                upsertLink(nA.id, nB.id, 9, sent, 'semantic_affinity', `Co-ranked top topics within ${fc.category}`, undefined, false);
            }
        }
    });

    for (let i = 0; i < topicNodes.length; i++) {
        const nA = topicNodes[i];
        const profA = nodeProfiles.get(nA.id);
        if (!profA || profA.stemsArr.length === 0) continue;
        for (let j = i + 1; j < topicNodes.length; j++) {
            const nB = topicNodes[j];
            const profB = nodeProfiles.get(nB.id);
            if (!profB || profB.stemsArr.length === 0) continue;
            const sharedStems = profA.stemsArr.filter(s => profB.stems.has(s));
            if (sharedStems.length === 0) continue;
            const isCrossCat = Boolean(nA.category && nB.category && normalizeNodeKey(nA.category) !== normalizeNodeKey(nB.category));
            const sent: 'positive' | 'negative' | 'mixed' = nA.sentiment === nB.sentiment && (nA.sentiment === 'positive' || nA.sentiment === 'negative') ? nA.sentiment : 'mixed';
            upsertLink(
                nA.id, nB.id, isCrossCat ? 10 + sharedStems.length * 4 : 7 + sharedStems.length * 3, sent,
                isCrossCat ? 'cross_category_bridge' : 'semantic_affinity',
                isCrossCat ? `Cross-category bridge (${nA.category} ↔ ${nB.category}) on "${sharedStems.slice(0, 2).join(', ')}"` : `Shared domain focus on "${sharedStems.slice(0, 2).join(', ')}"`,
                undefined, false
            );
        }
    }

    interHubCommentMap.forEach(stat => {
        const hubA = nodeById.get(stat.hubA);
        const hubB = nodeById.get(stat.hubB);
        if (hubA && hubB) upsertLink(stat.hubA, stat.hubB, Math.min(34, 10 + stat.count * 2), computePairSentiment(stat.pos, stat.neg), 'cross_category_bridge', `${stat.count} comment${stat.count > 1 ? 's' : ''} bridge ${hubA.label} & ${hubB.label}`, stat.count, true);
    });

    if (hubNodes.length >= 2) {
        for (let i = 0; i < hubNodes.length; i++) {
            const hubA = hubNodes[i];
            const hubB = hubNodes[(i + 1) % hubNodes.length];
            if (!linkMap.has(getEdgeKey(hubA.id, hubB.id))) {
                upsertLink(hubA.id, hubB.id, 12, 'mixed', 'cross_category_bridge', `Cross-pillar strategic interplay between ${hubA.label} & ${hubB.label}`, undefined, false);
            }
        }
    }

    if (topicNodes.length >= 2) {
        topicNodes.forEach((tNode, idx) => {
            if ((nodeTopicToTopicDegree.get(tNode.id) || 0) > 0) return;
            const sameCatPeers = topicNodes.filter(p => p.id !== tNode.id && normalizeNodeKey(p.category) === normalizeNodeKey(tNode.category));
            const peerPool = sameCatPeers.length > 0 ? sameCatPeers : topicNodes.filter(p => p.id !== tNode.id);
            if (peerPool.length === 0) return;
            const targetPeer = peerPool[idx % peerPool.length];
            const isCrossCat = normalizeNodeKey(tNode.category) !== normalizeNodeKey(targetPeer.category);
            const sent: 'positive' | 'negative' | 'mixed' = tNode.sentiment === targetPeer.sentiment && (tNode.sentiment === 'positive' || tNode.sentiment === 'negative') ? tNode.sentiment : 'mixed';
            upsertLink(tNode.id, targetPeer.id, 8, sent, isCrossCat ? 'cross_category_bridge' : 'semantic_affinity', isCrossCat ? `Cross-category affinity (${tNode.category || 'Topic'} ↔ ${targetPeer.category || 'Topic'})` : `Related topic within ${tNode.category || 'Category'}`, undefined, false);
        });
    }

    return Array.from(linkMap.values());
};
