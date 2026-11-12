import re
from typing import Any, Dict, List, Optional


def _build_deep_metacritic_analysis(
    slug: str,
    canonical_url: str,
    json_ld_metadata: Dict[str, Any],
    normalized_reviews: List[Dict[str, Any]],
    critic_stats: Optional[Dict[str, Any]],
    user_stats: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    subject_name = json_ld_metadata.get("name") or slug.replace("-", " ").title()
    metascore = json_ld_metadata.get("metascore")
    critic_reviews = [r for r in normalized_reviews if r.get("reviewType") == "critic" or r.get("type") == "critic"]
    user_reviews = [r for r in normalized_reviews if r.get("reviewType") == "user" or r.get("type") == "user"]

    metascore_count = int(json_ld_metadata.get("metascoreCount") or len(critic_reviews))
    user_score = json_ld_metadata.get("userScore")
    user_score_count = int(json_ld_metadata.get("userScoreCount") or len(user_reviews))

    critic_pos = sum(1 for r in critic_reviews if r.get("sentiment") == "positive")
    critic_mix = sum(1 for r in critic_reviews if r.get("sentiment") in ("neutral", "mixed"))
    critic_neg = sum(1 for r in critic_reviews if r.get("sentiment") == "negative")

    user_pos = sum(1 for r in user_reviews if r.get("sentiment") == "positive")
    user_mix = sum(1 for r in user_reviews if r.get("sentiment") in ("neutral", "mixed"))
    user_neg = sum(1 for r in user_reviews if r.get("sentiment") == "negative")

    total_count = max(len(normalized_reviews), 1)
    critic_total = max(len(critic_reviews), 1)
    user_total = max(len(user_reviews), 1)

    positive_count = sum(1 for r in normalized_reviews if r.get("sentiment") == "positive")
    mixed_count = sum(1 for r in normalized_reviews if r.get("sentiment") in ("neutral", "mixed"))
    negative_count = sum(1 for r in normalized_reviews if r.get("sentiment") == "negative")

    platform_map: Dict[str, Dict[str, Any]] = {}
    for r in normalized_reviews:
        plat = str(r.get("platform") or "Web")
        info = platform_map.setdefault(plat, {"count": 0, "normScoreSum": 0.0, "scoredCount": 0, "positive": 0, "negative": 0})
        info["count"] += 1
        if r.get("sentiment") == "positive":
            info["positive"] += 1
        if r.get("sentiment") == "negative":
            info["negative"] += 1
        if isinstance(r.get("score"), (int, float)) and r.get("maxScore"):
            info["normScoreSum"] += (float(r["score"]) / float(r["maxScore"])) * 100.0
            info["scoredCount"] += 1

    platform_breakdown = {
        plat: {
            "count": info["count"],
            "avgScore100": round(info["normScoreSum"] / info["scoredCount"]) if info["scoredCount"] > 0 else None,
            "positiveCount": info["positive"],
            "negativeCount": info["negative"],
        }
        for plat, info in platform_map.items()
    }

    theme_specs = [
        {
            "id": "theme_core_quality",
            "theme": "Product Quality, Craftsmanship & Core Experience",
            "category": "Quality & Performance",
            "sentiment": "positive",
            "pattern": r"quality|craftsmanship|design|performance|polished|responsive|experience|standout|durable|excellent|impressive",
            "criticConsensus": f"Editorial reviews evaluate {subject_name}'s build quality, design execution, and core performance.",
            "playerConsensus": "Community reviews highlight day-to-day product quality and real-world experience.",
            "actionableRecommendation": "Feature verified review quotes and measurable quality proof in top-of-funnel messaging.",
        },
        {
            "id": "theme_value_pricing",
            "theme": "Pricing, Perceived Value & Total Cost",
            "category": "Pricing & Value",
            "sentiment": "negative",
            "pattern": r"price|pricing|value|cost|expensive|worth|subscription|fee|upgrade|refund|billing|overpriced|budget",
            "criticConsensus": "Reviewers weigh feature breadth against price positioning in the category.",
            "playerConsensus": "User feedback tracks whether everyday value justifies upfront and recurring costs.",
            "actionableRecommendation": "Clarify tier inclusions, bundle savings, and transparent total-cost comparisons.",
        },
        {
            "id": "theme_usability_depth",
            "theme": "Usability, Feature Depth & Versatility",
            "category": "Usability & Features",
            "sentiment": "positive",
            "pattern": r"usable|usability|intuitive|versatile|workflow|setup|onboarding|customiz|feature|option|depth|flexible",
            "criticConsensus": "Reviews assess breadth of capabilities and ease of onboarding.",
            "playerConsensus": "Customers note how flexibly the product fits varied everyday use cases.",
            "actionableRecommendation": "Publish practical customer use-case walkthroughs and quick-start guides.",
        },
        {
            "id": "theme_support_reliability",
            "theme": "Reliability, Delivery & Customer Support",
            "category": "Reliability & Support",
            "sentiment": "mixed",
            "pattern": r"support|service|shipping|delivery|reliab|bug|issue|stable|consisten|update|warranty|delay|return",
            "criticConsensus": "Evaluations note long-term consistency and post-launch updates.",
            "playerConsensus": "Users emphasize responsive customer support, reliable delivery, and issue resolution speed.",
            "actionableRecommendation": "Highlight service guarantees, proactive product updates, and support SLAs.",
        },
    ]

    key_themes = []
    for spec in theme_specs:
        rx = re.compile(spec["pattern"], flags=re.IGNORECASE)
        matched = [r for r in normalized_reviews if rx.search(str(r.get("text") or ""))]
        pool = matched if matched else [r for r in normalized_reviews if r.get("sentiment") == spec["sentiment"]]
        sample_quotes = [
            {
                "id": r.get("id"), "author": r.get("author"), "score": r.get("score"), "maxScore": r.get("maxScore"),
                "reviewType": r.get("reviewType"), "type": r.get("type"), "platform": r.get("platform"),
                "date": r.get("date"), "text": r.get("text"), "quote": r.get("text"),
            }
            for r in pool[:4]
        ]
        scored = [r for r in pool if isinstance(r.get("score"), (int, float)) and r.get("maxScore")]
        avg_score = round(sum((float(r["score"]) / float(r["maxScore"])) * 100.0 for r in scored) / len(scored)) if scored else None
        m_count = len(matched)
        key_themes.append({
            "id": spec["id"], "theme": spec["theme"], "title": spec["theme"], "name": spec["theme"],
            "category": spec["category"], "sentiment": spec["sentiment"],
            "mentionCount": m_count, "mentions": m_count, "count": m_count, "avgScore": avg_score,
            "criticConsensus": spec["criticConsensus"], "playerConsensus": spec["playerConsensus"],
            "summary": f"{spec['criticConsensus']} {spec['playerConsensus']}",
            "actionableRecommendation": spec["actionableRecommendation"], "recommendation": spec["actionableRecommendation"],
            "sampleQuotes": sample_quotes, "quotes": sample_quotes,
        })

    pos_pool = [r for r in normalized_reviews if r.get("sentiment") == "positive"]
    neg_pool = [r for r in normalized_reviews if r.get("sentiment") == "negative"]

    top_praises = [
        {
            "id": f"praise_{idx + 1}",
            "title": f"Positive Review Highlight ({r.get('author') or 'Reviewer'})",
            "point": f"Positive Review Highlight ({r.get('author') or 'Reviewer'})",
            "category": "Positive Feedback",
            "impact": "High" if idx == 0 else "Medium",
            "criticAvgScore": r.get("score"),
            "score": r.get("score"),
            "author": r.get("author") or "Verified Reviewer",
            "quote": r.get("text"),
            "description": r.get("text"),
            "detail": r.get("text"),
            "sampleQuotes": [r],
        }
        for idx, r in enumerate(pos_pool[:3])
    ]

    top_pain_points = [
        {
            "id": f"pain_{idx + 1}",
            "title": f"Customer Friction Highlight ({r.get('author') or 'Reviewer'})",
            "point": f"Customer Friction Highlight ({r.get('author') or 'Reviewer'})",
            "category": "Negative Feedback",
            "severity": "Critical" if idx == 0 else "High",
            "userAvgScore": r.get("score"),
            "score": r.get("score"),
            "author": r.get("author") or "Verified Reviewer",
            "quote": r.get("text"),
            "description": r.get("text"),
            "detail": r.get("text"),
            "mitigationStrategy": "Address recurring feedback themes in product messaging and customer support documentation.",
            "sampleQuotes": [r],
        }
        for idx, r in enumerate(neg_pool[:3])
    ]

    marketing_opportunities: List[Dict[str, Any]] = []
    if top_praises:
        marketing_opportunities.append({
            "id": "mkt_1",
            "title": "Verified Review Social Proof Campaign",
            "channel": "Paid Social & Landing Pages",
            "targetAudience": "Prospective Buyers & Category Researchers",
            "priority": "P0",
            "hook": f"{subject_name} — {metascore}/100 Editorial Rating" if metascore is not None else f"Verified Customer Reviews for {subject_name}",
            "creativeAngle": "Spotlight top verified review quotes alongside concrete product differentiators.",
            "kpiImpact": "Improves mid-funnel trust and evaluation conversion.",
            "rationale": f"Anchored in {len(pos_pool)} positive reviews across {len(normalized_reviews)} harvested entries.",
        })
    if top_pain_points:
        marketing_opportunities.append({
            "id": "mkt_2",
            "title": "Value & Friction Objection-Handling Guide",
            "channel": "Search, Email Lifecycle & Community FAQ",
            "targetAudience": "Price-Sensitive & Evaluating Customers",
            "priority": "P1",
            "hook": f"Transparent Breakdown: Getting the Most Value from {subject_name}",
            "creativeAngle": "Proactively address top user-reported friction points with clear expectations and support links.",
            "kpiImpact": "Reduces pre-purchase hesitation and post-purchase friction.",
            "rationale": f"Informed by {len(neg_pool)} negative reviews in the harvested corpus.",
        })

    critic_pos_pct = round((critic_pos / critic_total) * 100) if critic_reviews else 0
    critic_mix_pct = round((critic_mix / critic_total) * 100) if critic_reviews else 0
    critic_neg_pct = max(0, 100 - critic_pos_pct - critic_mix_pct) if critic_reviews else 0
    user_pos_pct = round((user_pos / user_total) * 100) if user_reviews else 0
    user_mix_pct = round((user_mix / user_total) * 100) if user_reviews else 0
    user_neg_pct = max(0, 100 - user_pos_pct - user_mix_pct) if user_reviews else 0

    divergence_gap = (
        round(float(metascore) - (float(user_score) * 10.0))
        if metascore is not None and user_score is not None
        else None
    )
    score_summary_parts = []
    if metascore is not None:
        score_summary_parts.append(f"{metascore}/100 editorial score ({metascore_count} critic reviews)")
    if user_score is not None:
        score_summary_parts.append(f"{user_score}/10 community score ({user_score_count} user ratings)")
    score_phrase = " versus ".join(score_summary_parts) if score_summary_parts else f"{len(normalized_reviews)} harvested reviews"

    executive_summary = (
        f"Structured Schema.org JSON-LD and review harvesting for {subject_name} ({canonical_url}) show {score_phrase}"
        + (f" ({divergence_gap}-point normalized gap across {len(normalized_reviews)} harvested reviews)." if divergence_gap is not None else ".")
    )

    headline = (
        f"Editorial Score ({metascore}/100) vs. Community Score ({user_score}/10) — {divergence_gap}pt Normalized Gap"
        if divergence_gap is not None
        else f"Review Intelligence for {subject_name} ({len(normalized_reviews)} Reviews)"
    )

    critic_vs_player_divergence = {
        "metascore": metascore, "metascoreMax": 100, "criticReviewCount": metascore_count,
        "criticSentiment": (critic_stats or {}).get("sentiment"),
        "userScore": user_score, "userScoreMax": 10, "userReviewCount": user_score_count,
        "userSentiment": (user_stats or {}).get("sentiment"),
        "divergenceGapPts": divergence_gap, "gapPoints": divergence_gap,
        "headline": headline,
        "explanation": executive_summary,
        "criticDrivers": [p["title"] for p in top_praises],
        "playerDrivers": [p["title"] for p in top_pain_points],
    }

    score_divergence = {
        **critic_vs_player_divergence,
        "criticPerspective": " • ".join(critic_vs_player_divergence["criticDrivers"]),
        "playerPerspective": " • ".join(critic_vs_player_divergence["playerDrivers"]),
        "rootCauses": [executive_summary, *critic_vs_player_divergence["playerDrivers"]],
    }

    sentiment_breakdown = {
        "totalReviews": len(normalized_reviews), "positiveCount": positive_count, "mixedCount": mixed_count, "negativeCount": negative_count,
        "positivePct": round((positive_count / total_count) * 100) if normalized_reviews else 0,
        "mixedPct": round((mixed_count / total_count) * 100) if normalized_reviews else 0,
        "negativePct": round((negative_count / total_count) * 100) if normalized_reviews else 0,
        "criticCount": len(critic_reviews), "userCount": len(user_reviews),
        "criticPositiveCount": critic_pos, "criticMixedCount": critic_mix, "criticNegativeCount": critic_neg,
        "criticPositivePct": critic_pos_pct, "criticMixedPct": critic_mix_pct, "criticNegativePct": critic_neg_pct,
        "userPositiveCount": user_pos, "userMixedCount": user_mix, "userNegativeCount": user_neg,
        "userPositivePct": user_pos_pct, "userMixedPct": user_mix_pct, "userNegativePct": user_neg_pct,
        "platformBreakdown": platform_breakdown,
    }

    sections = [
        {
            "title": "Executive Summary & Strategic Overview", "heading": "Executive Summary & Strategic Overview",
            "type": "summary", "content": executive_summary,
            "bullets": [
                f"Editorial Score: {metascore}/100 ({metascore_count} Critic Reviews)" if metascore is not None else f"Critic Reviews: {metascore_count}",
                f"Community Score: {user_score}/10 ({user_score_count} User Ratings)" if user_score is not None else f"User Reviews: {user_score_count}",
                f"Harvested Corpus: {len(normalized_reviews)} full-text reviews + Schema.org JSON-LD metadata",
            ],
        },
        {
            "title": "Editorial vs. Community Sentiment Analysis", "heading": "Editorial vs. Community Sentiment Analysis",
            "type": "divergence", "content": critic_vs_player_divergence["explanation"],
            "bullets": critic_vs_player_divergence["criticDrivers"] + critic_vs_player_divergence["playerDrivers"],
        },
    ]

    mapped_comments = [
        {**r, "comment": r.get("text"), "quote": r.get("text"), "rating": r.get("score"), "publishedAt": r.get("date"), "likes": r.get("thumbsUp") or r.get("score") or 0}
        for r in normalized_reviews
    ]

    return {
        "summary": executive_summary, "executiveSummary": executive_summary,
        "criticVsPlayerDivergence": critic_vs_player_divergence, "scoreDivergence": score_divergence,
        "sentimentBreakdown": sentiment_breakdown, "keyThemes": key_themes, "themes": key_themes,
        "topPraises": top_praises, "praises": top_praises, "positives": [f"{p['title']}: {p['description']}" for p in top_praises],
        "topPainPoints": top_pain_points, "painPoints": top_pain_points, "negatives": [f"{p['title']}: {p['description']}" for p in top_pain_points],
        "marketingOpportunities": marketing_opportunities, "recommendations": marketing_opportunities,
        "sections": sections, "comments": mapped_comments,
    }
