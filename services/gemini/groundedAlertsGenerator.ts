/**
 * Grounded 14-Day (2-Week) Keyword Trend Alerts Generator.
 */
import { runGroundedResearchAndStructure } from "./tiktokAndMultiChannelSocial";

export const generateKeywordGroundedAlerts = async (
    keyword: string,
    companyName: string = "test-company"
): Promise<any> => {
    const activeCompany = companyName || "test-company";
    try {
        console.log(`\n======================================================`);
        console.log(`🛰️ [GOOGLE GROUNDING] Searching 14-Day (2-Week) News & Community Trends: "${keyword}" (${activeCompany})`);
        console.log(`======================================================\n`);

        const researchPrompt = `
        You are a Real-Time Sentiment & Anomaly Detection Intelligence Agent for ${activeCompany}.
        Search live real-world news, customer reviews, social commentary, Reddit discussions, and community reactions from the LAST 14 DAYS (PAST 2 WEEKS) for the topic/keyword: "${keyword}" (${activeCompany}).
        
        SEARCH OPERATORS:
        - "${keyword}" "${activeCompany}" (news OR review OR quality OR delivery OR customer OR return)
        - "${keyword}" site:reddit.com OR site:trustpilot.com OR site:consumeraffairs.com OR site:betterbusinessbureau.org
        
        IDENTIFY:
        1. Positive trends & customer praise from the past 14 days / 2-week window (e.g. design quality, durability, smooth delivery, customer service).
        2. Critical friction points & customer complaints from the past 14 days / 2-week window (e.g. delivery delays, care issues, customer service hold times, packaging).
        3. Neutral / informational announcements, new collection launches, or updates.
        `;

        const schemaPrompt = `
        Transform the research into a valid JSON object matching this schema:
        {
            "monitoredKeyword": "${keyword}",
            "generatedAt": "${new Date().toISOString()}",
            "alerts": [
                {
                    "id": "alert-1",
                    "title": "Clear 6-10 word alert headline",
                    "summary": "1-2 sentence description of the emerging trend or customer friction point",
                    "severity": "critical",
                    "source": "Reddit / Trustpilot / Newsroom",
                    "tag": "Delivery & Logistics",
                    "url": "VERIFIED_URL_FROM_SOURCES"
                },
                {
                    "id": "alert-2",
                    "title": "Positive headline of community praise",
                    "summary": "1-2 sentence description of positive customer feedback",
                    "severity": "favorable",
                    "source": "YouTube / Reddit / News",
                    "tag": "Community Reception",
                    "url": "VERIFIED_URL_FROM_SOURCES"
                }
            ],
            "trendingTopics": ["Topic 1", "Topic 2", "Topic 3"],
            "summary": "High-level 1-sentence executive overview of 14-day (2-week) discourse"
        }
        `;

        const { data: parsed, searchQueries, rawGroundedLinks, rawResearchText } = await runGroundedResearchAndStructure({
            researchPrompt,
            schemaPrompt,
            fallbackValue: { alerts: [], trendingTopics: [], summary: "" },
            agentName: 'Grounded 14-Day Alerts Agent'
        });

        let alertsList = Array.isArray(parsed?.alerts) ? parsed.alerts : [];

        if (alertsList.length === 0 && rawResearchText) {
            console.log("Building structured alerts from raw grounded research text & links...");
            const paragraphs = rawResearchText.split(/\n\n+/).filter(p => p.trim().length > 30);
            
            alertsList = paragraphs.slice(0, 4).map((p, idx) => {
                const isCrit = p.toLowerCase().includes('issue') || p.toLowerCase().includes('bug') || p.toLowerCase().includes('complaint') || p.toLowerCase().includes('criticism');
                const isFav = p.toLowerCase().includes('praise') || p.toLowerCase().includes('improved') || p.toLowerCase().includes('great') || p.toLowerCase().includes('positive') || p.toLowerCase().includes('love');
                const link = rawGroundedLinks[idx] || rawGroundedLinks[0];

                return {
                    id: `grounded-alert-${idx + 1}`,
                    title: link?.title || `${keyword} 14-Day Market Trend #${idx + 1}`,
                    summary: p.slice(0, 180) + (p.length > 180 ? '...' : ''),
                    severity: isCrit ? 'critical' : (isFav ? 'favorable' : 'warning'),
                    source: link?.title ? 'Google News / Web' : 'Google Search Grounding',
                    tag: 'Market Intelligence',
                    url: link?.uri || ''
                };
            });
        }

        if (alertsList.length === 0 && !String(rawResearchText || '').trim() && !String(parsed?.summary || '').trim()) {
            throw new Error(`Google Search grounding returned empty output for "${keyword}".`);
        }

        alertsList = alertsList.map((a, i) => {
            let verifiedUrl = typeof a.url === 'string' ? a.url.trim() : '';
            if (!verifiedUrl || verifiedUrl === 'VERIFIED_URL_FROM_SOURCES' || !/^https?:\/\//i.test(verifiedUrl)) {
                verifiedUrl = rawGroundedLinks[i]?.uri || rawGroundedLinks[0]?.uri || '';
            }
            return {
                ...a,
                url: verifiedUrl,
                source: a.source || rawGroundedLinks[i]?.title || 'Google Grounding'
            };
        });

        return {
            monitoredKeyword: keyword,
            alerts: alertsList,
            trendingTopics: Array.isArray(parsed?.trendingTopics) ? parsed.trendingTopics : [],
            summary: parsed?.summary || '',
            searchQueries,
            rawGroundedLinks,
            timestamp: new Date().toISOString()
        };
    } catch (e) {
        console.error("Grounded keyword alerts error:", e);
        throw e instanceof Error ? e : new Error(String(e));
    }
};
