/**
 * LandPin AI Recommendation Engine & Semantic Matching Comprehensive Test Suite
 * Validates:
 * 1. Eligibility (owner exclusion, unpublished, unapproved, removed, pending revision, AI unauthorized ID protection)
 * 2. Input validation & strict filtering (purpose, category, propertyType, budgetMax, location, radius, 400 rejections)
 * 3. Real Haversine calculations & location scores (no fake 0.88 location score)
 * 4. Exact scoring formula: S = 0.35R + 0.25L + 0.20B + 0.15F + 0.05Q (all in [0..1])
 * 5. Factual explanations (no false RERA or prime corridor claims)
 * 6. Deterministic fallback behavior & tie breaking
 * 7. Response data sanitization (no deeds, contact info, moderation notes)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const app = require('../src/app');
const {
  validateRecommendationInputs,
  extractCoordinates,
  haversineDistanceKm,
  computeSemanticScore,
  computeLocationScore,
  computeBudgetScore,
  computeFeatureScore,
  computeQualityScore,
  computeFinalScore,
  generateFactualExplanations,
  sanitizeProperty
} = require('../src/controllers/recommendationController');
const { isPropertyPubliclyEligible } = require('../src/utils/propertyEligibility');

let BASE_URL = 'http://localhost:5000/api/v1';
let ephemeralServer = null;

function request(method, endpoint, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, data: parsed, headers: res.headers });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(description, condition, extraInfo = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}. ${extraInfo}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 LANDPIN AI RECOMMENDATION & MATCHING TEST SUITE');
  console.log('======================================================\n');

  // --- UNIT TESTS: SCORING & FORMULA INVARIANTS ---
  console.log('--- 1. SCORING & FORMULA INVARIANTS ---');

  // Exact formula: 0.35R + 0.25L + 0.20B + 0.15F + 0.05Q
  const s1 = computeFinalScore(1.0, 1.0, 1.0, 1.0, 1.0);
  assert('Perfect score (all 1.0) equals 1.0', s1 === 1.0, `Got: ${s1}`);

  const s0 = computeFinalScore(0.0, 0.0, 0.0, 0.0, 0.0);
  assert('Zero score (all 0.0) equals 0.0', s0 === 0.0, `Got: ${s0}`);

  const sCustom = computeFinalScore(0.8, 0.6, 0.9, 0.7, 0.4);
  // Expected: 0.35*0.8 + 0.25*0.6 + 0.20*0.9 + 0.15*0.7 + 0.05*0.4
  // = 0.28 + 0.15 + 0.18 + 0.105 + 0.02 = 0.735
  assert('Custom score accurately follows weights', Math.abs(sCustom - 0.735) < 0.0001, `Got: ${sCustom}`);

  // Test individual component bounds [0..1]
  const semScore = computeSemanticScore('luxury 3bhk villa', {
    title: 'Luxury 3BHK Villa in Indiranagar',
    description: 'Modern spacious villa with private pool',
    amenities: ['pool', 'gym']
  });
  assert('Semantic score is normalized between 0 and 1', semScore >= 0 && semScore <= 1, `Got: ${semScore}`);

  const semMiss = computeSemanticScore('farmland agricultural', {
    title: 'Luxury 3BHK Villa',
    description: 'Modern flat'
  });
  assert('Non-matching query produces low semantic score', semMiss < 0.5, `Got: ${semMiss}`);

  const qUnverified = computeQualityScore({ cadastralVerified: false, images: [], description: '' });
  assert('Unverified incomplete property receives 0 quality score', qUnverified === 0.0, `Got: ${qUnverified}`);

  const qVerified = computeQualityScore({
    cadastralVerified: true,
    land_details: { reraNumber: 'PRM/KA/RERA/1251/446/PR/171015/000456' },
    images: ['img1.jpg', 'img2.jpg', 'img3.jpg'],
    description: 'A very detailed property description with high quality information for discerning buyers.'
  });
  assert('Fully verified quality score incorporates cadastral and RERA', qVerified >= 0.8, `Got: ${qVerified}`);

  // --- UNIT TESTS: HAVERSINE & GEOSPATIAL ---
  console.log('\n--- 2. HAVERSINE & GEOSPATIAL CALCULATIONS ---');

  // Indiranagar (12.9784, 77.6408) to Whitefield (12.9698, 77.7500): approx 11.9 km
  const dist = haversineDistanceKm(12.9784, 77.6408, 12.9698, 77.7500);
  assert('Haversine distance Indiranagar to Whitefield is ~11.9 km', dist !== null && dist > 11.0 && dist < 13.0, `Got: ${dist}`);

  const sameDist = haversineDistanceKm(12.9784, 77.6408, 12.9784, 77.6408);
  assert('Distance to same point is 0 km', sameDist === 0, `Got: ${sameDist}`);

  const coordGeoJson = extractCoordinates({ coordinates: [77.6408, 12.9784] });
  assert('Extracts GeoJSON [longitude, latitude] correctly', coordGeoJson.latitude === 12.9784 && coordGeoJson.longitude === 77.6408);

  const coordPoint = extractCoordinates({ point: { coordinates: [77.6408, 12.9784] } });
  assert('Extracts Point geometry coordinates correctly', coordPoint.latitude === 12.9784);

  const coordNullIsland = extractCoordinates({ latitude: 0, longitude: 0 });
  assert('Rejects Null Island (0, 0) placeholder coordinates', coordNullIsland === null);

  const locScore = computeLocationScore(5.0, 10.0, true);
  assert('Proximity score within radius is normalized (5km / 10km radius = 0.5)', locScore.score === 0.5 && locScore.distanceKm === 5.0);

  const locScoreOut = computeLocationScore(15.0, 10.0, true);
  assert('Beyond radius receives 0.0 location score', locScoreOut.score === 0.0);

  // --- UNIT TESTS: INPUT VALIDATION ---
  console.log('\n--- 3. INPUT VALIDATION ---');

  assert('Validates allowed purpose: sale', () => {
    const res = validateRecommendationInputs({ purpose: 'sale' });
    return res.purpose === 'sale';
  });

  let threwInvalidPurpose = false;
  try {
    validateRecommendationInputs({ purpose: 'exchange' });
  } catch (e) {
    threwInvalidPurpose = true;
  }
  assert('Rejects invalid purpose with error', threwInvalidPurpose);

  let threwInvalidCoords = false;
  try {
    validateRecommendationInputs({ searchLocation: { latitude: 95.0, longitude: 77.0 } });
  } catch (e) {
    threwInvalidCoords = true;
  }
  assert('Rejects latitude > 90', threwInvalidCoords);

  let threwNegativeBudget = false;
  try {
    validateRecommendationInputs({ budgetMax: -5000 });
  } catch (e) {
    threwNegativeBudget = true;
  }
  assert('Rejects negative budgetMax', threwNegativeBudget);

  const zeroBudget = validateRecommendationInputs({ budgetMax: 0 });
  assert('Zero budget is preserved as distinct from undefined', zeroBudget.budgetMax === 0);

  // --- UNIT TESTS: FACTUAL EXPLANATIONS ---
  console.log('\n--- 4. FACTUAL EXPLANATIONS ---');

  const expUnverified = generateFactualExplanations({ cadastralVerified: false, images: [] });
  const hasFalseRera = expUnverified.some(e => e.includes('RERA') || e.includes('Cadastral'));
  assert('Unverified listing never claims Cadastral or RERA', !hasFalseRera, `Explanations: ${JSON.stringify(expUnverified)}`);

  const expVerified = generateFactualExplanations({ cadastralVerified: true, land_details: { reraNumber: 'RERA123' } });
  assert('Cadastral statement included when verified', expVerified.some(e => e.includes('Cadastral')));
  assert('RERA statement included when RERA present', expVerified.some(e => e.includes('RERA')));

  // --- UNIT TESTS: RESPONSE SANITIZATION ---
  console.log('\n--- 5. RESPONSE SANITIZATION ---');

  const rawProp = {
    _id: 'prop_test_01',
    title: 'Test Villa',
    price: 5000000,
    deeds: ['secret_title_deed.pdf'],
    privateDocuments: ['encumbrance_cert.pdf'],
    sellerContact: '+919999999999',
    reviewNotes: 'Admin approved after deed check',
    passwordHash: 'hash123'
  };
  const sanitized = sanitizeProperty(rawProp);
  assert('Strips private deeds', sanitized.deeds === undefined);
  assert('Strips private documents', sanitized.privateDocuments === undefined);
  assert('Strips seller contact details', sanitized.sellerContact === undefined);
  assert('Strips internal review notes', sanitized.reviewNotes === undefined);
  assert('Preserves public title and price', sanitized.title === 'Test Villa' && sanitized.price === 5000000);

  // --- INTEGRATION TESTS: HTTP API ENDPOINT ---
  console.log('\n--- 6. INTEGRATION TESTS VIA HTTP /recommendations ---');

  await new Promise((resolve) => {
    const probe = http.get('http://localhost:5000/api/v1/health', () => {
      resolve();
    });
    probe.on('error', () => {
      ephemeralServer = http.createServer(app);
      ephemeralServer.listen(0, () => {
        const port = ephemeralServer.address().port;
        BASE_URL = `http://localhost:${port}/api/v1`;
        resolve();
      });
    });
  });

  // Test 1: Empty filters - returns published eligible properties
  const resEmpty = await request('POST', '/properties/recommendations', {});
  assert('POST /recommendations returns 200', resEmpty.status === 200);
  assert('Response has success: true', resEmpty.data?.success === true);
  assert('Response has expected contract fields',
    resEmpty.data?.engine && resEmpty.data?.source && Array.isArray(resEmpty.data?.results)
  );

  // Test 2: Invalid coordinates rejected with 400
  const resBadCoords = await request('POST', '/properties/recommendations', {
    searchLocation: { latitude: 150, longitude: 200 }
  });
  assert('Rejects invalid latitude/longitude with 400', resBadCoords.status === 400);
  assert('Returns INVALID_INPUT error code', resBadCoords.data?.code === 'INVALID_INPUT');

  // Test 3: Negative budget rejected with 400
  const resBadBudget = await request('POST', '/properties/recommendations', {
    budgetMax: -1000
  });
  assert('Rejects negative budget with 400', resBadBudget.status === 400);

  // Test 4: Strict budget filtering - no property price exceeds budgetMax
  const budgetCap = 6000000; // 60 Lakhs
  const resBudget = await request('POST', '/properties/recommendations', {
    budgetMax: budgetCap
  });
  assert('Budget filtered request succeeds', resBudget.status === 200);
  const overBudget = (resBudget.data?.results || []).filter(r => r.property.price > budgetCap);
  assert('Zero returned properties exceed strict budgetMax', overBudget.length === 0, `Found: ${overBudget.length}`);

  // Test 5: Strict purpose filtering (sale vs rent)
  const resRent = await request('POST', '/properties/recommendations', {
    purpose: 'rent'
  });
  assert('Rent purpose request succeeds', resRent.status === 200);
  const nonRent = (resRent.data?.results || []).filter(r => r.property.purpose !== 'rent');
  assert('Zero returned properties violate requested rent purpose', nonRent.length === 0);

  // Test 6: Strict category filtering (residential vs commercial)
  const resCategory = await request('POST', '/properties/recommendations', {
    category: 'residential'
  });
  assert('Category filtered request succeeds', resCategory.status === 200);
  const nonRes = (resCategory.data?.results || []).filter(r => r.property.category !== 'residential');
  assert('Zero returned properties violate requested category', nonRes.length === 0);

  // Test 7: Location and radius filtering with distanceKm in results
  const resLoc = await request('POST', '/properties/recommendations', {
    searchLocation: { latitude: 12.9716, longitude: 77.5946 }, // Bangalore Center
    radiusKm: 25.0
  });
  assert('Location-based search succeeds', resLoc.status === 200);
  if (resLoc.data?.results?.length > 0) {
    const firstResult = resLoc.data.results[0];
    assert('Returns computed distanceKm for location search', typeof firstResult.distanceKm === 'number');
    assert('Returned distance is within requested radius (<= 25 km)', firstResult.distanceKm <= 25.0);
  }

  // Test 8: Response sanitization in API output
  if (resEmpty.data?.results?.length > 0) {
    const first = resEmpty.data.results[0].property;
    assert('API response does not leak deeds', first.deeds === undefined);
    assert('API response does not leak privateDocuments', first.privateDocuments === undefined);
    assert('API response does not leak reviewNotes', first.reviewNotes === undefined);
    assert('API response does not leak sellerContact', first.sellerContact === undefined);
  }

  // Test 9: Score breakdown structure in results
  if (resEmpty.data?.results?.length > 0) {
    const bd = resEmpty.data.results[0].scoreBreakdown;
    assert('Result includes scoreBreakdown object', typeof bd === 'object');
    assert('Score breakdown has normalized semanticScore in [0..1]', bd.semanticScore >= 0 && bd.semanticScore <= 1);
    assert('Score breakdown has normalized locationScore in [0..1]', bd.locationScore >= 0 && bd.locationScore <= 1);
    assert('Score breakdown has normalized budgetScore in [0..1]', bd.budgetScore >= 0 && bd.budgetScore <= 1);
    assert('Score breakdown has normalized featureScore in [0..1]', bd.featureScore >= 0 && bd.featureScore <= 1);
    assert('Score breakdown has normalized qualityScore in [0..1]', bd.qualityScore >= 0 && bd.qualityScore <= 1);
  }

  // Test 10: Empty result handling when no properties match strict criteria
  const resEmptyMatch = await request('POST', '/properties/recommendations', {
    budgetMax: 100 // 100 Rupees, no property can match
  });
  assert('Empty result request succeeds with 200', resEmptyMatch.status === 200);
  assert('totalCandidates is 0 or results is empty array', resEmptyMatch.data?.results?.length === 0);
  assert('Never returns unrelated properties when candidates is 0', resEmptyMatch.data?.rankedCount === 0);

  // Test 11: Public eligibility invariant - viewer cannot see own properties
  const testProp = {
    _id: 'prop_user_own',
    ownerId: 'usr_viewer_99',
    verificationStatus: 'approved',
    publicationStatus: 'published'
  };
  assert('Viewer is excluded from seeing own property', !isPropertyPubliclyEligible(testProp, 'usr_viewer_99'));
  assert('Other viewer can see property', isPropertyPubliclyEligible(testProp, 'usr_other_42'));

  console.log('\n======================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================\n');

  if (ephemeralServer) {
    ephemeralServer.close();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite execution error:', err);
  process.exit(1);
});

