import re
from typing import List, Set

def tokenize(text: str) -> Set[str]:
    clean = re.sub(r'[^a-zA-Z0-9\s]', ' ', (text or "").lower())
    tokens = set(t for t in clean.split() if len(t) > 2)
    # Stopwords filter
    stopwords = {"and", "the", "for", "with", "this", "that", "near", "from"}
    return tokens - stopwords

def compute_semantic_score(query: str, title: str, description: str, amenities: List[str]) -> float:
    """
    Computes semantic text relevance score between user natural search terms and property content.
    """
    if not query:
        return 0.75  # Default baseline when no freeform text is supplied
    
    query_tokens = tokenize(query)
    if not query_tokens:
        return 0.75
    
    prop_tokens = tokenize(f"{title} {description} {' '.join(amenities)}")
    overlap = query_tokens.intersection(prop_tokens)
    
    # Coverage of user query terms
    coverage = len(overlap) / len(query_tokens)
    
    # Exact phrase or title booster
    title_lower = (title or "").lower()
    query_lower = query.lower().strip()
    if query_lower in title_lower:
        coverage = min(1.0, coverage + 0.35)
        
    return min(1.0, round(max(0.1, coverage), 3))
