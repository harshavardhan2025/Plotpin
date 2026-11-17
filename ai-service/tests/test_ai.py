import json
import urllib.request
import urllib.error

def run():
    print("====================================================")
    print("[AI-TEST] LANDPIN AI MICROSERVICE REGRESSION TEST SUITE")
    print("====================================================")
    
    passed = 0
    failed = 0
    
    # 1. Unauthenticated / Wrong Secret
    print("\nTest 1: Internal Service Authentication Enforcement")
    try:
        req = urllib.request.Request(
            'http://127.0.0.1:8000/v1/embeddings',
            data=json.dumps({'text': 'luxury villa in Whitefield'}).encode('utf-8'),
            headers={'Content-Type': 'application/json', 'x-ai-secret': 'invalid_secret'}
        )
        urllib.request.urlopen(req)
        print("  [FAIL]: Request with invalid secret should be rejected with 403")
        failed += 1
    except urllib.error.HTTPError as e:
        if e.code == 403:
            print("  [PASS]: Request with invalid secret rejected with 403 Forbidden")
            passed += 1
        else:
            print(f"  [FAIL]: Expected 403, got {e.code}")
            failed += 1
            
    # 2. Genuine Embeddings Endpoint
    print("\nTest 2: Semantic Embeddings Generation")
    try:
        req = urllib.request.Request(
            'http://127.0.0.1:8000/v1/embeddings',
            data=json.dumps({'text': '3 BHK luxury villa with private garden in Whitefield'}).encode('utf-8'),
            headers={'Content-Type': 'application/json', 'x-ai-secret': 'property_marketplace_ai_secret'}
        )
        resp = urllib.request.urlopen(req)
        data = json.loads(resp.read().decode('utf-8'))
        dims = data.get('dimensions')
        emb = data.get('embedding')
        model = data.get('model_name')
        is_fallback = data.get('is_fallback')
        
        if dims == 128 and isinstance(emb, list) and len(emb) == 128 and model:
            print(f"  [PASS]: Generated valid 128-d embedding (model: {model}, is_fallback: {is_fallback})")
            passed += 1
        else:
            print(f"  [FAIL]: Invalid embedding response: {data}")
            failed += 1
    except Exception as e:
        print(f"  [FAIL]: Embedding request failed: {e}")
        failed += 1

    # 3. Candidate Ranking & Hard Filtering Invariants
    print("\nTest 3: Ranking Invariants & Ineligible Listing Exclusion")
    try:
        ranking_payload = {
            "purpose": "sale",
            "category": "residential",
            "budgetMax": 30000000,
            "searchLocation": {"latitude": 12.9784, "longitude": 77.6412},
            "radiusKm": 15.0,
            "queryText": "luxury villa",
            "candidates": [
                {
                    "id": "cand_01",
                    "title": "Eligible Luxury Villa Whitefield",
                    "description": "3 BHK villa with garden and solar power",
                    "category": "residential",
                    "propertyType": "villa",
                    "purpose": "sale",
                    "price": 25000000,
                    "bedrooms": 3,
                    "bathrooms": 3,
                    "areaSqFt": 2400,
                    "amenities": ["parking", "garden"],
                    "location": {
                        "locality": "Whitefield",
                        "city": "Bengaluru",
                        "coordinates": [77.7499, 12.9698]
                    },
                    "verificationStatus": "approved",
                    "publicationStatus": "published",
                    "availabilityStatus": "available",
                    "cadastralVerified": True
                },
                {
                    "id": "cand_02_sold",
                    "title": "Sold Duplex Penthouse",
                    "description": "Already completed transaction",
                    "category": "residential",
                    "propertyType": "flat",
                    "purpose": "sale",
                    "price": 22000000,
                    "location": {
                        "locality": "Indiranagar",
                        "city": "Bengaluru",
                        "coordinates": [77.6412, 12.9784]
                    },
                    "verificationStatus": "approved",
                    "publicationStatus": "published",
                    "availabilityStatus": "sold",
                    "cadastralVerified": True
                },
                {
                    "id": "cand_03_unapproved",
                    "title": "Unapproved Plot",
                    "description": "Draft listing pending RERA review",
                    "category": "residential",
                    "propertyType": "plot",
                    "purpose": "sale",
                    "price": 15000000,
                    "location": {
                        "locality": "Sarjapur",
                        "city": "Bengaluru",
                        "coordinates": [77.6800, 12.9080]
                    },
                    "verificationStatus": "pending_review",
                    "publicationStatus": "unpublished",
                    "availabilityStatus": "available",
                    "cadastralVerified": False
                }
            ]
        }
        req = urllib.request.Request(
            'http://127.0.0.1:8000/v1/recommendations/rank',
            data=json.dumps(ranking_payload).encode('utf-8'),
            headers={'Content-Type': 'application/json', 'x-ai-secret': 'property_marketplace_ai_secret'}
        )
        resp = urllib.request.urlopen(req)
        rank_data = json.loads(resp.read().decode('utf-8'))
        results = rank_data.get('results', [])
        
        result_ids = [r.get('propertyId') for r in results]
        if "cand_01" in result_ids and "cand_02_sold" not in result_ids and "cand_03_unapproved" not in result_ids:
            print("  [PASS]: Sold and unapproved candidates strictly excluded from recommendations")
            passed += 1
        else:
            print(f"  [FAIL]: Ineligible candidate leaked: {result_ids}")
            failed += 1
            
        # Check explanation
        top_prop = results[0]
        explanations = top_prop.get('explanation', [])
        has_cadastral = any("Cadastral" in exp for exp in explanations)
        if has_cadastral:
            print("  [PASS]: Factual cadastral title verification explanation present")
            passed += 1
        else:
            print(f"  [FAIL]: Missing factual explanation: {explanations}")
            failed += 1
            
    except Exception as e:
        print(f"  [FAIL]: Candidate ranking test failed: {e}")
        failed += 1

    print("\n====================================================")
    print(f"[RESULTS] AI SERVICE: {passed} PASSED | {failed} FAILED")
    print("====================================================")
    if failed > 0:
        exit(1)

if __name__ == '__main__':
    run()
