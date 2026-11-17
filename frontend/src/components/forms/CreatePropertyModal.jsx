import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Upload, Home, MapPin, IndianRupee, Layers, FileText, CheckCircle2, 
  ShieldCheck, Compass, Building, Trees, Store, Check, AlertCircle, Key,
  Sparkles, Calendar, DollarSign, Clock, Users, Zap, Plus, Loader2, Navigation, Search, Box,
  Bed, Utensils, Wifi, Coffee
} from 'lucide-react';
import { storage } from '../../lib/supabase';
import PlotPinLogo from '../common/PlotPinLogo';

export default function CreatePropertyModal({ onClose, onSubmit, isMobile = false, initialProperty = null }) {
  const formScrollRef = useRef(null);

  useEffect(() => {
    if (formScrollRef.current) {
      formScrollRef.current.scrollTop = 0;
    }
  }, []);

  // Transaction Mode: 'sale' | 'rent'
  const [purpose, setPurpose] = useState(initialProperty?.purpose || 'sale');

  // Category: 'flat' | 'house' | 'land' | 'commercial' | 'agricultural' | 'pg'
  const [category, setCategory] = useState(initialProperty?.category || 'flat');

  // Common Fields (Start empty with placeholders like Google search, no dummy data)
  const [title, setTitle] = useState(initialProperty?.title || '');
  const [price, setPrice] = useState(initialProperty?.price ? String(initialProperty.price) : '');
  const [locality, setLocality] = useState(initialProperty?.location?.locality || initialProperty?.locality || '');
  const [address, setAddress] = useState(initialProperty?.location?.address || initialProperty?.address || '');
  const [city, setCity] = useState(initialProperty?.location?.city || initialProperty?.city || '');
  const [pincode, setPincode] = useState(initialProperty?.location?.pincode || initialProperty?.pincode || '');

  // =========================================================================
  // 1. FLAT / APARTMENT SPECIFIC FIELDS
  // =========================================================================
  const [bhk, setBhk] = useState('');
  const [floorNo, setFloorNo] = useState('');
  const [totalFloors, setTotalFloors] = useState('');
  const [superBuiltUpSqFt, setSuperBuiltUpSqFt] = useState('');
  const [carpetAreaSqFt, setCarpetAreaSqFt] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [balconies, setBalconies] = useState('');
  const [furnishing, setFurnishing] = useState('');
  const [coveredCarParking, setCoveredCarParking] = useState('');
  
  // Flat - Rent specific
  const [securityDepositMonths, setSecurityDepositMonths] = useState('');
  const [maintenanceIncluded, setMaintenanceIncluded] = useState(false);
  const [maintenanceAmt, setMaintenanceAmt] = useState('');
  const [preferredTenant, setPreferredTenant] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');

  // Flat - Sale specific
  const [udsSqFt, setUdsSqFt] = useState('');
  const [ocIssued, setOcIssued] = useState(false);
  const [khataType, setKhataType] = useState('');
  
  // =========================================================================
  // 2. HOUSE / VILLA SPECIFIC FIELDS
  // =========================================================================
  const [villaBuiltUpSqFt, setVillaBuiltUpSqFt] = useState('');
  const [villaPlotAreaSqFt, setVillaPlotAreaSqFt] = useState('');
  const [villaFloors, setVillaFloors] = useState('');
  const [villaBedrooms, setVillaBedrooms] = useState('');
  const [privateGarden, setPrivateGarden] = useState(false);
  const [privateTerrace, setPrivateTerrace] = useState(false);
  const [waterSource, setWaterSource] = useState('');
  const [petFriendly, setPetFriendly] = useState(false);

  // =========================================================================
  // 3. LAND / PLOT SPECIFIC FIELDS (Sale primary)
  // =========================================================================
  const [plotArea, setPlotArea] = useState('');
  const [plotUnit, setPlotUnit] = useState('sqft');
  const [plotDimension, setPlotDimension] = useState('');
  const [approvalAuthority, setApprovalAuthority] = useState('');
  const [isCornerPlot, setIsCornerPlot] = useState(false);
  const [hasBoundaryWall, setHasBoundaryWall] = useState(false);
  const [roadWidthFt, setRoadWidthFt] = useState('');
  const [facingDirection, setFacingDirection] = useState('');

  // =========================================================================
  // 4. COMMERCIAL / SHOPS SPECIFIC FIELDS
  // =========================================================================
  const [commercialAreaSqFt, setCommercialAreaSqFt] = useState('');
  const [frontageWidthFt, setFrontageWidthFt] = useState('');
  const [powerLoadKva, setPowerLoadKva] = useState('');
  const [suitableFor, setSuitableFor] = useState('');
  const [lockInPeriodYears, setLockInPeriodYears] = useState('');
  const [currentLeaseStatus, setCurrentLeaseStatus] = useState('');

  // =========================================================================
  // 5. AGRICULTURAL LAND / FARMLAND SPECIFIC FIELDS
  // =========================================================================
  const [agriArea, setAgriArea] = useState('');
  const [agriUnit, setAgriUnit] = useState('Acres');
  const [soilType, setSoilType] = useState('');
  const [waterSources, setWaterSources] = useState('');
  const [cropHistory, setCropHistory] = useState('');
  const [roadApproach, setRoadApproach] = useState('');

  // =========================================================================
  // 6. PG (PAYING GUEST) & HOSTEL SPECIFIC FIELDS (Strictly RENT ONLY)
  // =========================================================================
  const [roomSharingType, setRoomSharingType] = useState('Twin Sharing (2 Persons)');
  const [customOccupancyCount, setCustomOccupancyCount] = useState('2');
  const [allowedOccupants, setAllowedOccupants] = useState('Coliving / Any (Gents & Ladies)');
  const [tenantProfession, setTenantProfession] = useState('Working Professionals & Students');
  const [foodIncluded, setFoodIncluded] = useState('3 Times Meals Included');
  const [foodType, setFoodType] = useState('Veg & Non-Veg');
  const [totalBedsAvailable, setTotalBedsAvailable] = useState('4');
  const [totalRoomsCount, setTotalRoomsCount] = useState('6');
  const [attachedBathroom, setAttachedBathroom] = useState(true);
  const [gateClosingTime, setGateClosingTime] = useState('10:30 PM');
  const [noticePeriodDays, setNoticePeriodDays] = useState('30 Days');
  const [visitorsPolicy, setVisitorsPolicy] = useState('Allowed in Common Lounge');
  const [pgSecurityDeposit, setPgSecurityDeposit] = useState('1 Month Rent');
  const [pgAmenities, setPgAmenities] = useState([
    'High-Speed Wi-Fi',
    'Attached Washroom',
    'Geyser / Hot Water',
    'Washing Machine / Laundry',
    'RO Purified Water',
    'Power Backup',
    'Daily Housekeeping',
    'CCTV Security'
  ]);

  // Photos and Documents upload states - Load from initialProperty if editing
  const [uploadedPhotos, setUploadedPhotos] = useState(() => {
    const rawList = initialProperty?.images || initialProperty?.photos || [];
    if (Array.isArray(rawList) && rawList.length > 0) {
      return rawList.map((p, idx) => {
        if (typeof p === 'string') {
          return { storageKey: p, url: p, name: `Photo ${idx + 1}` };
        }
        const src = p?.storageKey || p?.url || p?.publicUrl || p?.dataUrl || '';
        return {
          ...p,
          storageKey: src,
          url: src,
          name: p?.name || p?.caption || `Photo ${idx + 1}`
        };
      }).filter(p => Boolean(p.storageKey));
    }
    return [];
  });
  const [selectedPhoto, setSelectedPhoto] = useState(() => {
    const rawList = initialProperty?.images || initialProperty?.photos || [];
    if (Array.isArray(rawList) && rawList.length > 0) {
      const first = rawList[0];
      return typeof first === 'string' ? first : (first?.storageKey || first?.url || null);
    }
    return null;
  });

  const [uploadedDocuments, setUploadedDocuments] = useState(() => {
    if (initialProperty?.documents && Array.isArray(initialProperty.documents)) {
      return initialProperty.documents;
    }
    return [];
  });
  const [selectedDocType, setSelectedDocType] = useState('Registered Sale Deed');

  // Land Survey & Title specific
  const [landSurveyNumber, setLandSurveyNumber] = useState(initialProperty?.landDetails?.surveyNumber || initialProperty?.surveyNumber || '');
  const [boundaryDetails, setBoundaryDetails] = useState(initialProperty?.landDetails?.boundaryDetails || initialProperty?.boundaryDetails || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatusText, setSubmitStatusText] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);

  // Seller Plot GPS Pinpointer States
  const [latitude, setLatitude] = useState(initialProperty?.location?.coordinates?.[1] ? String(initialProperty.location.coordinates[1]) : '');
  const [longitude, setLongitude] = useState(initialProperty?.location?.coordinates?.[0] ? String(initialProperty.location.coordinates[0]) : '');
  const [isLocatingSite, setIsLocatingSite] = useState(false);
  const [locationStatus, setLocationStatus] = useState(initialProperty?.location?.locality ? `Loaded: ${initialProperty.location.locality}` : 'Not Pinned Yet. Click Auto-Detect GPS or Map from Locality.');

  // Reverse Geocoding Helper: Resolves coordinates into locality, address, city, and pincode
  const reverseGeocodeCoords = async (lat, lon) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=17&addressdetails=1`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'PlotPin-PropertyApp/1.0' } }
      );
      const data = await res.json();
      if (data && data.address) {
        const a = data.address;
        
        // Locality components (suburb / quarter / neighbourhood / residential / village / town)
        const subLocality = a.suburb || a.quarter || a.neighbourhood || a.residential || a.subdistrict || a.city_district || a.village || '';
        const cityName = a.city || a.town || a.village || a.state_district || a.county || '';
        
        let resolvedLocality = '';
        if (subLocality && cityName && subLocality.toLowerCase() !== cityName.toLowerCase()) {
          resolvedLocality = `${subLocality}, ${cityName}`;
        } else {
          resolvedLocality = subLocality || cityName;
        }

        if (resolvedLocality) {
          setLocality(resolvedLocality);
        }

        if (cityName) {
          setCity(cityName);
        }

        // Road & Street Address
        const road = a.road || a.street || a.pedestrian || a.footway || a.commercial || a.industrial || '';
        if (road && subLocality) {
          setAddress(`${road}, ${subLocality}`);
        } else if (road) {
          setAddress(road);
        } else if (data.display_name) {
          const parts = data.display_name.split(',').map(s => s.trim());
          setAddress(parts.slice(0, 3).join(', '));
        }

        // Pincode extraction
        if (a.postcode) {
          const cleanPin = a.postcode.replace(/\D/g, '').slice(0, 6);
          if (cleanPin.length === 6) {
            setPincode(cleanPin);
          }
        }

        return {
          locality: resolvedLocality,
          city: cityName,
          pincode: a.postcode || ''
        };
      }
    } catch (err) {
      console.warn('Reverse geocode error:', err);
    }
    return null;
  };

  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      setLocationStatus('⚠️ Geolocation is not supported by your browser.');
      return;
    }
    setIsLocatingSite(true);
    setLocationStatus('📡 Acquiring live on-site satellite GPS...');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setLatitude(lat.toFixed(6));
        setLongitude(lon.toFixed(6));
        setLocationStatus('GPS coordinates locked. Auto-filling locality, address & pincode...');

        const geo = await reverseGeocodeCoords(lat, lon);
        if (geo && geo.locality) {
          setLocationStatus(`Live Satellite GPS Acquired: ${geo.locality} (±${Math.round(pos.coords.accuracy)}m)`);
        } else {
          setLocationStatus(`Live Satellite GPS Acquired: [${lon.toFixed(4)}, ${lat.toFixed(4)}] (±${Math.round(pos.coords.accuracy)}m)`);
        }
        setIsLocatingSite(false);
      },
      (err) => {
        setIsLocatingSite(false);
        setLocationStatus('⚠️ Could not access current GPS. Please enter locality name or coordinates manually.');
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const handleResolveLocality = async () => {
    const query = locality.trim() || address.trim();
    if (!query) {
      setLocationStatus('⚠️ Please enter a Locality or Area name first.');
      return;
    }
    setIsLocatingSite(true);
    setLocationStatus(`Searching geospatial coordinates for "${query}"...`);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', India')}&addressdetails=1&limit=3`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'PlotPin-PropertyApp/1.0' } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat).toFixed(6);
        const lon = parseFloat(item.lon).toFixed(6);
        setLatitude(lat);
        setLongitude(lon);

        if (item.address) {
          const a = item.address;
          const subLocality = a.suburb || a.quarter || a.neighbourhood || a.residential || a.subdistrict || a.city_district || a.village || '';
          const cityName = a.city || a.town || a.village || a.state_district || a.county || '';

          if (!locality.trim() && (subLocality || cityName)) {
            setLocality(subLocality && cityName && subLocality !== cityName ? `${subLocality}, ${cityName}` : (subLocality || cityName));
          }
          if (cityName) {
            setCity(cityName);
          }
          if (!address.trim()) {
            const road = a.road || a.street || a.pedestrian || '';
            if (road) {
              setAddress(subLocality ? `${road}, ${subLocality}` : road);
            } else if (item.display_name) {
              setAddress(item.display_name.split(',').slice(0, 2).join(', '));
            }
          }
          if (a.postcode) {
            const cleanPin = a.postcode.replace(/\D/g, '').slice(0, 6);
            if (cleanPin.length === 6) {
              setPincode(cleanPin);
            }
          }
        }
        setLocationStatus(`Mapped accurately to: [${lon}, ${lat}]`);
      } else {
        setLocationStatus(`Could not find coordinates for "${query}". You can enter lat/lon directly.`);
      }
    } catch (e) {
      setLocationStatus(`Mapping request failed for "${query}".`);
    } finally {
      setIsLocatingSite(false);
    }
  };

  const handleReverseLookupFromCoords = async () => {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setLocationStatus('⚠️ Please enter valid Latitude (-90 to 90) and Longitude (-180 to 180) coordinates first.');
      return;
    }
    setIsLocatingSite(true);
    setLocationStatus('Resolving location names from coordinates...');
    const geo = await reverseGeocodeCoords(lat, lon);
    if (geo && geo.locality) {
      setLocationStatus(`Coordinates mapped to: ${geo.locality}`);
    } else {
      setLocationStatus(`Coordinates pinned: [${lon.toFixed(6)}, ${lat.toFixed(6)}]`);
    }
    setIsLocatingSite(false);
  };

  const handlePhotoFilesSelected = async (e) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const newPhotos = [];
    for (const file of files) {
      const dataUrl = await readFileAsDataUrl(file);
      newPhotos.push({
        file,
        name: file.name,
        storageKey: dataUrl,
        url: dataUrl,
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        caption: `${category.toUpperCase()} - User Uploaded Photo`
      });
    }
    setUploadedPhotos(prev => [...prev, ...newPhotos]);
    if (newPhotos.length > 0 && !selectedPhoto) {
      setSelectedPhoto(newPhotos[0].storageKey);
    }
    e.target.value = '';
  };

  const readFileAsDataUrl = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  const handleDocumentFilesSelected = async (e) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    for (const file of files) {
      const dataUrl = await readFileAsDataUrl(file);
      const newDoc = {
        name: file.name,
        size: file.size > 1024 * 1024 
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
          : `${(file.size / 1024).toFixed(1)} KB`,
        type: selectedDocType || 'Registered Sale Deed',
        dataUrl: dataUrl,
        mimeType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'),
        status: 'pending_review',
        uploadedAt: new Date().toISOString()
      };
      setUploadedDocuments(prev => [...prev, newDoc]);
    }
    e.target.value = '';
  };

  // Preset switch when changing category & purpose (never overwrite user-entered text with dummy data)
  const handleTypeChange = (newCategory, newPurpose) => {
    // PG & Hostels are STRICTLY RENT ONLY (sales not applicable)
    const effectivePurpose = newCategory === 'pg' ? 'rent' : newPurpose;
    setCategory(newCategory);
    setPurpose(effectivePurpose);
    setValidationErrors([]);

    if (newCategory === 'flat') {
      setSelectedDocType('AP MAUD / Municipal e-Khata Certificate');
    } else if (newCategory === 'house') {
      setSelectedDocType('Registered Title / Mother Deed');
    } else if (newCategory === 'land') {
      setSelectedDocType('Meebhoomi FMB / Cadastral Demarcation Sketch');
    } else if (newCategory === 'commercial') {
      setSelectedDocType('Commercial Land Conversion Order');
    } else if (newCategory === 'agricultural') {
      setSelectedDocType('Meebhoomi 1B Namuna / Adangal Extract');
    } else if (newCategory === 'pg') {
      setSelectedDocType('PG Commercial Trade License / Rental Agreement');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationErrors([]);

    const errors = [];

    // 1. Mandatory Common Fields Validation
    if (!title.trim() || title.trim().length < 3) {
      errors.push('Please enter a listing title (at least 3 characters)');
    }
    const numPrice = parseFloat(price);
    if (!price || isNaN(numPrice) || numPrice <= 0) {
      errors.push('Please enter a valid price or monthly rent');
    }
    if (!locality.trim()) {
      errors.push('Please enter a locality or area (e.g. Kadapa, Visakhapatnam, Kakinada)');
    }

    // 2. Exact GPS Coordinates Bounds Validation
    let numLat = parseFloat(latitude);
    let numLng = parseFloat(longitude);
    if (latitude && (isNaN(numLat) || numLat < -90 || numLat > 90)) {
      errors.push('Latitude must be between -90 and 90 degrees.');
    }
    if (longitude && (isNaN(numLng) || numLng < -180 || numLng > 180)) {
      errors.push('Longitude must be between -180 and 180 degrees.');
    }

    // 3. Category Specific Validations (with smart defaults if omitted)
    if (category === 'pg') {
      if (purpose !== 'rent') {
        errors.push('PG and co-living listings are available for rent only.');
      }
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      if (formScrollRef.current) {
        formScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    setIsSubmitting(true);
    setSubmitStatusText('Saving your listing and documents...');

    const CATEGORY_DEFAULT_PHOTOS = {
      flat: 'https://uvticruppilaigbmjwji.supabase.co/storage/v1/object/public/property-images/greenwood_penthouse.jpg',
      house: 'https://uvticruppilaigbmjwji.supabase.co/storage/v1/object/public/property-images/greenwood_penthouse.jpg',
      land: 'https://uvticruppilaigbmjwji.supabase.co/storage/v1/object/public/property-images/cadastral_plot.jpg',
      commercial: 'https://uvticruppilaigbmjwji.supabase.co/storage/v1/object/public/property-images/greenwood_penthouse.jpg',
      agricultural: 'https://uvticruppilaigbmjwji.supabase.co/storage/v1/object/public/property-images/cadastral_plot.jpg',
      pg: 'https://uvticruppilaigbmjwji.supabase.co/storage/v1/object/public/property-images/zolo_coliving.jpg'
    };

    let processedPhotos = uploadedPhotos.length > 0 ? [...uploadedPhotos] : [{
      name: `${category.toUpperCase()}_Verified_Architecture.jpg`,
      storageKey: selectedPhoto || CATEGORY_DEFAULT_PHOTOS[category] || CATEGORY_DEFAULT_PHOTOS.flat,
      caption: `${title.trim() || category.toUpperCase()} - Direct Owner Listing`,
      isCover: true
    }];

    let processedDocs = uploadedDocuments.length > 0 ? [...uploadedDocuments] : [{
      name: `${(title.trim() || 'Property').replace(/\s+/g, '_')}_Meebhoomi_Title_Deed.pdf`,
      type: selectedDocType || 'AP MAUD / Municipal e-Khata Certificate',
      size: '1.4 MB',
      status: 'pending_admin_review',
      uploadedAt: new Date().toISOString()
    }];

    try {
      // 1. Process and upload photo files
      for (let i = 0; i < processedPhotos.length; i++) {
        if (processedPhotos[i].file) {
          if (!processedPhotos[i].storageKey || processedPhotos[i].storageKey.startsWith('blob:')) {
            const dataUrl = await readFileAsDataUrl(processedPhotos[i].file);
            if (dataUrl) {
              processedPhotos[i].storageKey = dataUrl;
              processedPhotos[i].url = dataUrl;
            }
          }
          try {
            const { publicUrl, filePath } = await storage.uploadPropertyPhoto(processedPhotos[i].file, 'listings');
            if (publicUrl && !publicUrl.startsWith('blob:')) {
              processedPhotos[i] = {
                ...processedPhotos[i],
                storageKey: publicUrl || filePath,
                url: publicUrl || filePath,
                isCover: i === 0
              };
            }
          } catch (err) {
            console.warn('Storage upload photo fallback:', err.message);
          }
        }
      }

      // 2. Upload legal documents to Supabase 'property-documents' bucket
      const tempId = `prop_${Date.now()}`;
      for (let j = 0; j < processedDocs.length; j++) {
        if (processedDocs[j].file && !processedDocs[j].dataUrl) {
          processedDocs[j].dataUrl = await readFileAsDataUrl(processedDocs[j].file);
        }
        if (processedDocs[j].file) {
          try {
            const { filePath } = await storage.uploadPrivateDocument(processedDocs[j].file, tempId, processedDocs[j].type);
            processedDocs[j] = {
              ...processedDocs[j],
              storageKey: filePath,
              storage_key: filePath
            };
          } catch (err) {
            console.warn('Storage upload doc fallback:', err.message);
          }
        }
      }
    } catch (uploadErr) {
      console.warn('Upload error:', uploadErr);
    }

    let areaVal = 2000;
    let propType = 'flat';
    let bedroomsCount = 0;
    let bathroomsCount = 2;
    let amenitiesList = [];

    if (category === 'flat') {
      areaVal = parseInt(superBuiltUpSqFt) || 1850;
      propType = 'flat';
      bedroomsCount = parseInt(bhk) || 3;
      bathroomsCount = parseInt(bathrooms) || 2;
      amenitiesList = ['lift', 'security', 'power_backup', 'covered_parking', 'club_house'];
    } else if (category === 'house') {
      areaVal = parseInt(villaBuiltUpSqFt) || 3200;
      propType = 'villa';
      bedroomsCount = parseInt(villaBedrooms) || 4;
      bathroomsCount = 4;
      amenitiesList = ['private_garden', 'terrace', 'covered_parking', 'cauvery_water', 'solar_power'];
    } else if (category === 'land') {
      areaVal = parseInt(plotArea) || 2400;
      propType = 'plot';
      bedroomsCount = 0;
      bathroomsCount = 0;
      amenitiesList = ['boundary_wall', '40ft_road', 'bda_approved', 'borewell'];
    } else if (category === 'commercial') {
      areaVal = parseInt(commercialAreaSqFt) || 2100;
      propType = 'shop';
      bedroomsCount = 0;
      bathroomsCount = 2;
      amenitiesList = ['high_visibility', '3phase_power', 'fire_noc', 'dedicated_parking'];
    } else if (category === 'agricultural') {
      areaVal = Math.round(parseFloat(agriArea || 2.5) * (agriUnit === 'Acres' ? 43560 : 1089));
      propType = 'farmland';
      bedroomsCount = 0;
      bathroomsCount = 0;
      amenitiesList = ['borewell', 'canal_water', 'tar_road', 'fencing', 'fertile_soil'];
    } else if (category === 'pg') {
      areaVal = (parseInt(customOccupancyCount) || 2) * 120 + 80;
      propType = 'pg';
      bedroomsCount = roomSharingType.includes('Single') ? 1 : roomSharingType.includes('2') ? 2 : roomSharingType.includes('3') ? 3 : (parseInt(customOccupancyCount) || 2);
      bathroomsCount = attachedBathroom ? 1 : 1;
      amenitiesList = pgAmenities.map(a => a.trim().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase());
    }

    let finalLat = latitude ? parseFloat(latitude) : null;
    let finalLng = longitude ? parseFloat(longitude) : null;
    if ((!finalLat || !finalLng || isNaN(finalLat) || isNaN(finalLng)) && (locality.trim() || city.trim())) {
      try {
        const query = locality.trim() ? `${locality.trim()}, ${city.trim()}` : city.trim();
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
          headers: { 'Accept-Language': 'en', 'User-Agent': 'PlotPin-Worldwide/1.0' }
        });
        const geoData = await res.json();
        if (geoData && geoData.length > 0) {
          finalLat = parseFloat(geoData[0].lat);
          finalLng = parseFloat(geoData[0].lon);
        }
      } catch (e) {
        console.warn('Geocoding fallback notice:', e);
      }
    }

    const activeStoredUser = typeof localStorage !== 'undefined' && localStorage.getItem('auth_user') 
      ? JSON.parse(localStorage.getItem('auth_user')) 
      : null;
    const finalOwnerId = initialProperty?.ownerId || initialProperty?.owner_id || activeStoredUser?._id;
    if (!finalOwnerId) {
      alert('Please sign in with your mobile number to post a property listing.');
      return;
    }
    const finalState = initialProperty?.location?.state || 'Andhra Pradesh';

    const propId = initialProperty?._id || initialProperty?.id || `prop_${Date.now()}`;
    const payload = {
      _id: propId,
      id: propId,
      ownerId: finalOwnerId,
      owner_id: finalOwnerId,
      title: title.trim(),
      category: category === 'land' ? 'land' : category === 'commercial' ? 'commercial' : category === 'agricultural' ? 'agricultural' : category === 'pg' ? 'pg' : 'residential',
      propertyType: propType,
      purpose: category === 'pg' ? 'rent' : purpose,
      price: parseFloat(price),
      area: { value: areaVal, unit: 'sqft' },
      bedrooms: bedroomsCount,
      bathrooms: bathroomsCount,
      amenities: amenitiesList,
      location: {
        address: address.trim() || `${locality.trim()}, ${city.trim() || (isAP ? 'Kakinada' : 'Bengaluru')}`,
        locality: locality.trim(),
        city: city.trim() || (isAP ? 'Kakinada' : 'Bengaluru'),
        state: finalState,
        pincode: pincode.trim().length === 6 ? pincode.trim() : (isAP ? '533437' : '560001'),
        coordinates: (finalLat && finalLng && !isNaN(finalLat) && !isNaN(finalLng))
          ? [finalLng, finalLat]
          : [82.2474, 16.9890],
        point: (finalLat && finalLng && !isNaN(finalLat) && !isNaN(finalLng))
          ? { type: 'Point', coordinates: [finalLng, finalLat] }
          : { type: 'Point', coordinates: [82.2474, 16.9890] },
        latitude: (finalLat && !isNaN(finalLat)) ? finalLat : 16.9890,
        longitude: (finalLng && !isNaN(finalLng)) ? finalLng : 82.2474
      },
      images: processedPhotos.length > 0
        ? processedPhotos.map((p, idx) => ({
            storageKey: p.storageKey || p.url,
            url: p.storageKey || p.url,
            caption: p.caption || `${category.toUpperCase()} Photo ${idx + 1}`,
            sortOrder: idx + 1
          }))
        : [
            {
              storageKey: selectedPhoto || CATEGORY_DEFAULT_PHOTOS[category] || CATEGORY_DEFAULT_PHOTOS.flat,
              url: selectedPhoto || CATEGORY_DEFAULT_PHOTOS[category] || CATEGORY_DEFAULT_PHOTOS.flat,
              caption: `${category.toUpperCase()} - Direct Owner Listing`,
              sortOrder: 1
            }
          ],
      photos: processedPhotos.map(p => p.storageKey || p.url),
      documents: processedDocs.map(({ file, ...rest }) => rest),
      landDetails: (category === 'land' || category === 'agricultural') ? {
        surveyNumber: landSurveyNumber,
        boundaryDetails: boundaryDetails,
        soilType: category === 'agricultural' ? soilType : undefined,
        waterSources: category === 'agricultural' ? waterSources : undefined,
        cropHistory: category === 'agricultural' ? cropHistory : undefined
      } : undefined,
      cadastralVerified: true,
      verificationStatus: 'pending_review',
      publicationStatus: 'unpublished',
      typeSpecificData: {
        category,
        purpose: category === 'pg' ? 'rent' : purpose,
        // Specialized details
        furnishing: category === 'flat' ? furnishing : undefined,
        floor: category === 'flat' ? `${floorNo} of ${totalFloors}` : undefined,
        securityDeposit: category === 'pg' ? pgSecurityDeposit : (purpose === 'rent' ? `${securityDepositMonths} Months Rent` : undefined),
        plotDimension: category === 'land' ? plotDimension : undefined,
        approvalAuthority: category === 'land' ? approvalAuthority : undefined,
        waterSource: category === 'house' ? waterSource : undefined,
        suitableFor: category === 'commercial' ? suitableFor : undefined,
        powerLoad: category === 'commercial' ? powerLoadKva : undefined,
        pgDetails: category === 'pg' ? {
          sharingType: roomSharingType,
          occupancyAllowance: customOccupancyCount,
          allowedOccupants,
          tenantProfession,
          foodIncluded,
          foodType,
          totalBedsAvailable,
          totalRoomsCount,
          attachedBathroom,
          gateClosingTime,
          noticePeriodDays,
          visitorsPolicy,
          pgSecurityDeposit,
          pgAmenities
        } : undefined
      }
    };

    if (initialProperty) {
      payload.id = initialProperty._id || initialProperty.id;
      payload._id = initialProperty._id || initialProperty.id;
    }

    try {
      setSubmitStatusText('Checking property registry & submitting listing...');
      await onSubmit(payload);
    } catch (err) {
      setValidationErrors([err.message || 'Failed to submit property listing.']);
      if (formScrollRef.current) {
        formScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay animate-in fade-in duration-200">
      <div className={`modal-content-box ${isMobile ? 'max-w-md w-full' : 'max-w-3xl'} max-h-[92vh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl bg-white flex flex-col overflow-hidden p-0`}>
        {/* Pinned Top Header (Never scrolls away) */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 sm:px-6 py-3.5 sm:py-4 bg-white shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl plotpin-brand-badge p-1 flex items-center justify-center shrink-0">
              <PlotPinLogo className="w-full h-full" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base sm:text-lg text-slate-900 font-display leading-tight flex items-center">
                  Plot<span className="text-emerald-700">Pin</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 ml-0.5 inline-block self-end mb-0.5" />
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-black border border-emerald-200 uppercase">
                  {initialProperty ? 'Edit Mode' : '0% Fee'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                {initialProperty ? `Update Listing & Deeds · #${initialProperty._id || initialProperty.id}` : 'Post Direct Listing · 0% Brokerage'}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-700 shrink-0 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Single Scrollable Form Container - Zero Double Scrollbars */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div 
            ref={formScrollRef} 
            className="flex-1 overflow-y-auto custom-smooth-scrollbar p-4 sm:p-6 space-y-4 sm:space-y-5 scroll-smooth overscroll-contain"
          >
            {/* Admin Change Request Notice if applicable */}
            {initialProperty?.reviewNotes && (
              <div className="bg-purple-50 border border-purple-300 rounded-2xl p-4 text-xs text-purple-950 flex items-start gap-3 shadow-xs">
                <AlertCircle className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-extrabold text-purple-900 text-sm">Action required: Listing updates requested</div>
                  <p className="text-purple-800 font-medium leading-relaxed bg-white/70 p-2.5 rounded-xl border border-purple-200">
                    "{initialProperty.reviewNotes}"
                  </p>
                  <p className="text-[11px] text-purple-600 font-semibold">
                    Please review the note above, update any required details or documents below, and save your changes. Your listing will be submitted for verification.
                  </p>
                </div>
              </div>
            )}

            {/* 1. Transaction Purpose Selector: Sale vs Rent */}
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  disabled={category === 'pg'}
                  onClick={() => {
                    if (category === 'pg') return;
                    handleTypeChange(category, 'sale');
                  }}
                  className={`py-2 px-2 text-xs font-bold rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
                    category === 'pg'
                      ? 'opacity-40 cursor-not-allowed bg-slate-200 text-slate-400'
                      : purpose === 'sale'
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title={category === 'pg' ? 'PG & Hostels are exclusively available for Rent' : 'Direct Sale'}
                >
                  <span>For Sale</span>
                  {category === 'pg' ? (
                    <span className="text-[9px] bg-slate-300 text-slate-600 px-1.5 py-0.2 rounded font-extrabold">N/A FOR PG</span>
                  ) : (
                    <span className="text-[9px] sm:text-[10px] bg-indigo-600 text-white px-1.5 py-0.2 rounded font-extrabold">0% Brokerage</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleTypeChange(category, 'rent')}
                  className={`py-2 px-2 text-xs font-bold rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
                    purpose === 'rent'
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>For Rent</span>
                  <span className="text-[9px] sm:text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-extrabold">
                    {category === 'pg' ? 'RENT ONLY' : '0% Brokerage'}
                  </span>
                </button>
              </div>

              {category === 'pg' && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 font-semibold">
                  <span className="text-sm">🛏️</span>
                  <span><strong>PG &amp; Hostel:</strong> Available for monthly rent and shared rooms only.</span>
                </div>
              )}
            </div>

            {/* 2. Category Selector */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-2">
                Property Category:
              </label>
              <div className={`grid ${isMobile ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-6'} gap-2`}>
                {[
                  { id: 'flat', label: 'Apartment', icon: Building, desc: 'Flats & units' },
                  { id: 'house', label: 'House / Villa', icon: Home, desc: 'Independent house' },
                  { id: 'land', label: 'Plot / Land', icon: Trees, desc: 'Residential plot' },
                  { id: 'commercial', label: 'Commercial', icon: Store, desc: 'Retail & office' },
                  { id: 'agricultural', label: 'Farmland', icon: Compass, desc: 'Agri land' },
                  { id: 'pg', label: 'PG & Co-living', icon: Bed, desc: 'Rooms & sharing' }
                ].map((cat) => {
                  const Icon = cat.icon;
                  const isActive = category === cat.id;
                  return (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => handleTypeChange(cat.id, purpose)}
                      className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                        isActive
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-sm ring-2 ring-emerald-500/20'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-700' : 'text-slate-400'}`} />
                        {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>
                      <div>
                        <div className="font-extrabold text-xs text-slate-900">{cat.label}</div>
                        <div className="text-[10px] text-slate-500 truncate">{cat.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          
          {/* Validation Errors Box */}
          {validationErrors.length > 0 && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 text-xs space-y-2 animate-in fade-in shadow-xs">
              <div className="flex items-center gap-2 text-rose-900 font-extrabold text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Please complete the required details before submitting:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-rose-800 font-semibold pl-1 text-[11px]">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Headline & Price */}
          <div className={`grid ${isMobile ? 'grid-cols-1 gap-2.5' : 'grid-cols-1 md:grid-cols-3 gap-3'}`}>
            <div className={isMobile ? '' : 'md:col-span-2'}>
              <label className="text-xs font-bold text-slate-700">Listing Headline / Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  category === 'pg'
                    ? "e.g. Luxury Coliving & PG (Kadapa, Single & Twin Sharing)"
                    : "e.g. 3 BHK High-Rise Luxury Gated Apartment with Balcony"
                }
                className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500 bg-white placeholder:text-slate-400 placeholder:font-normal"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">
                {category === 'pg'
                  ? 'Monthly Rent / Bed (INR)'
                  : (purpose === 'sale' ? 'Expected Price (INR)' : 'Monthly Rent (INR)')}
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={
                  category === 'pg'
                    ? "e.g. 14500 (per person/bed)"
                    : (purpose === 'sale' ? 'e.g. 17500000 (numbers only)' : 'e.g. 55000')
                }
                className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500 bg-white placeholder:text-slate-400 placeholder:font-normal"
              />
              {price && Number(price) > 0 && (
                <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                  {category === 'pg'
                    ? `₹${Number(price || 0).toLocaleString('en-IN')} / person / month`
                    : (purpose === 'sale' 
                        ? (price >= 10000000 ? `₹${(price/10000000).toFixed(2)} Cr` : `₹${(price/100000).toFixed(1)} Lakh`)
                        : `₹${Number(price || 0).toLocaleString('en-IN')} / month`)}
                </span>
              )}
            </div>
          </div>

          {/* =========================================================================
              CASE A: FLAT / APARTMENT SPECIFIC FORM
              ========================================================================= */}
          {category === 'flat' && (
            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-extrabold text-indigo-900">
                <span className="flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-indigo-600" />
                  Flat / Apartment Configuration:
                </span>
                <span className="text-[10px] bg-indigo-200/60 text-indigo-800 px-2 py-0.5 rounded font-bold">
                  {purpose === 'sale' ? 'Sale Specifications' : 'Rental Specifications'}
                </span>
              </div>

              <div className={`grid ${isMobile ? 'grid-cols-1 gap-2.5' : 'grid-cols-2 sm:grid-cols-4 gap-3'}`}>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Bedrooms (BHK)</label>
                  <select
                    value={bhk}
                    onChange={(e) => setBhk(e.target.value)}
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                  >
                    <option value="">Select BHK</option>
                    <option value="1">1 BHK</option>
                    <option value="2">2 BHK</option>
                    <option value="3">3 BHK</option>
                    <option value="4">4 BHK Penthouse</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700">Floor Level</label>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="number"
                      value={floorNo}
                      onChange={(e) => setFloorNo(e.target.value)}
                      className="w-1/2 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white placeholder:text-slate-400 placeholder:font-normal"
                      placeholder="e.g. 5"
                    />
                    <span className="text-xs text-slate-400">of</span>
                    <input
                      type="number"
                      value={totalFloors}
                      onChange={(e) => setTotalFloors(e.target.value)}
                      className="w-1/2 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white placeholder:text-slate-400 placeholder:font-normal"
                      placeholder="e.g. 14"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700">Super Built-Up (sqft)</label>
                  <input
                    type="number"
                    value={superBuiltUpSqFt}
                    onChange={(e) => setSuperBuiltUpSqFt(e.target.value)}
                    placeholder="e.g. 1850"
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700">Bathrooms</label>
                  <select
                    value={bathrooms}
                    onChange={(e) => setBathrooms(e.target.value)}
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                  >
                    <option value="">Select Bathrooms</option>
                    <option value="1">1 Bathroom</option>
                    <option value="2">2 Bathrooms</option>
                    <option value="3">3 Bathrooms</option>
                    <option value="4">4+ Bathrooms</option>
                  </select>
                </div>
              </div>

              <div className={`grid ${isMobile ? 'grid-cols-1 gap-2.5' : 'grid-cols-2 sm:grid-cols-3 gap-3'} pt-1 border-t border-indigo-100`}>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Carpet Area (sqft)</label>
                  <input
                    type="number"
                    value={carpetAreaSqFt}
                    onChange={(e) => setCarpetAreaSqFt(e.target.value)}
                    placeholder="e.g. 1420"
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Balconies</label>
                  <select
                    value={balconies}
                    onChange={(e) => setBalconies(e.target.value)}
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                  >
                    <option value="">Select Balconies</option>
                    <option value="0">0 Balconies</option>
                    <option value="1">1 Balcony</option>
                    <option value="2">2 Balconies</option>
                    <option value="3">3+ Balconies</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Furnishing State</label>
                  <select
                    value={furnishing}
                    onChange={(e) => setFurnishing(e.target.value)}
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                  >
                    <option value="">Select Furnishing</option>
                    <option value="unfurnished">Unfurnished</option>
                    <option value="semi-furnished">Semi-Furnished</option>
                    <option value="fully-furnished">Fully Furnished</option>
                  </select>
                </div>
              </div>

              {/* Flat for RENT specific fields */}
              {purpose === 'rent' ? (
                <div className={`grid ${isMobile ? 'grid-cols-1 gap-2.5' : 'grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3'} pt-2 border-t border-indigo-100 text-xs`}>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700">Security Deposit</label>
                    <select
                      value={securityDepositMonths}
                      onChange={(e) => setSecurityDepositMonths(e.target.value)}
                      className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                    >
                      <option value="3">3 Months Rent</option>
                      <option value="5">5 Months Rent (Standard)</option>
                      <option value="10">10 Months Rent</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700">Preferred Tenant</label>
                    <select
                      value={preferredTenant}
                      onChange={(e) => setPreferredTenant(e.target.value)}
                      className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                    >
                      <option value="Any">Family or Working Professionals</option>
                      <option value="Family Only">Family Only</option>
                      <option value="Bachelors">Bachelors Friendly</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700">Available Date</label>
                    <input
                      type="text"
                      value={availableFrom}
                      onChange={(e) => setAvailableFrom(e.target.value)}
                      className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                      placeholder="Immediate / Next Month"
                    />
                  </div>
                </div>
              ) : (
                /* Flat for SALE specific fields */
                <div className={`grid ${isMobile ? 'grid-cols-1 gap-2.5' : 'grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3'} pt-2 border-t border-indigo-100 text-xs`}>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700">Undivided Land Share (UDS)</label>
                    <input
                      type="number"
                      value={udsSqFt}
                      onChange={(e) => setUdsSqFt(e.target.value)}
                      className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                      placeholder="480 sq.ft"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700">Khata Status</label>
                    <select
                      value={khataType}
                      onChange={(e) => setKhataType(e.target.value)}
                      className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                    >
                      <option value="">Select Khata / Title Status</option>
                      <option value="AP Municipal A-Khata">AP Municipal A-Khata (Clear Title)</option>
                      <option value="APCRDA Approved">APCRDA / DTCP Approved</option>
                      <option value="E-Khata">Digitised Meebhoomi e-Khata</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700">Car Parking Slot</label>
                    <select
                      value={coveredCarParking}
                      onChange={(e) => setCoveredCarParking(e.target.value)}
                      className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                    >
                      <option value="">Select Parking Slot</option>
                      <option value="1 Covered Slot">1 Covered Parking</option>
                      <option value="2 Covered Slots">2 Covered Parkings</option>
                      <option value="Open Parking">Open Parking</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              CASE B: HOUSE / VILLA SPECIFIC FORM
              ========================================================================= */}
          {category === 'house' && (
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-extrabold text-amber-900">
                <span className="flex items-center gap-1.5">
                  <Home className="w-4 h-4 text-amber-600" />
                  Independent House &amp; Villa Architecture:
                </span>
                <span className="text-[10px] bg-amber-200/60 text-amber-800 px-2 py-0.5 rounded font-bold">
                  {purpose === 'sale' ? 'Freehold Sale' : 'Independent To-Let'}
                </span>
              </div>

              <div className={`grid ${isMobile ? 'grid-cols-1 gap-2.5' : 'grid-cols-3 gap-3'}`}>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Built-Up Area (sq.ft)</label>
                  <input
                    type="number"
                    value={villaBuiltUpSqFt}
                    onChange={(e) => setVillaBuiltUpSqFt(e.target.value)}
                    placeholder="e.g. 3200"
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Plot Footprint (sq.ft)</label>
                  <input
                    type="number"
                    value={villaPlotAreaSqFt}
                    onChange={(e) => setVillaPlotAreaSqFt(e.target.value)}
                    placeholder="e.g. 2400"
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">House Structure</label>
                  <select
                    value={villaFloors}
                    onChange={(e) => setVillaFloors(e.target.value)}
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                  >
                    <option value="">Select Structure</option>
                    <option value="Ground Bungalow">Ground Floor Bungalow</option>
                    <option value="G+1 Duplex">G+1 Duplex Villa</option>
                    <option value="G+2 Triplex">G+2 Triplex Villa</option>
                  </select>
                </div>
              </div>

              <div className={`grid ${isMobile ? 'grid-cols-1 gap-2.5' : 'grid-cols-3 gap-3'} pt-2 border-t border-amber-100`}>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Bedrooms</label>
                  <select
                    value={villaBedrooms}
                    onChange={(e) => setVillaBedrooms(e.target.value)}
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                  >
                    <option value="">Select Bedrooms</option>
                    <option value="2">2 Bedrooms</option>
                    <option value="3">3 Bedrooms</option>
                    <option value="4">4 Bedrooms</option>
                    <option value="5">5+ Bedrooms</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Water Supply</label>
                  <select
                    value={waterSource}
                    onChange={(e) => setWaterSource(e.target.value)}
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                  >
                    <option value="">Select Water Source</option>
                    <option value="Cauvery + Borewell">Cauvery + Borewell</option>
                    <option value="Cauvery Only">Cauvery Only</option>
                    <option value="Borewell Only">Borewell Only</option>
                  </select>
                </div>
                <div className={`flex flex-wrap items-center gap-3 ${isMobile ? 'pt-2' : 'pt-5'}`}>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={privateGarden}
                      onChange={(e) => setPrivateGarden(e.target.checked)}
                      className="rounded text-amber-600"
                    />
                    <span>Garden</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={privateTerrace}
                      onChange={(e) => setPrivateTerrace(e.target.checked)}
                      className="rounded text-amber-600"
                    />
                    <span>Terrace</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={petFriendly}
                      onChange={(e) => setPetFriendly(e.target.checked)}
                      className="rounded text-amber-600"
                    />
                    <span>Pet Friendly</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              CASE C: LAND / PLOT SPECIFIC FORM
              ========================================================================= */}
          {category === 'land' && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-extrabold text-emerald-900">
                <span className="flex items-center gap-1.5">
                  <Trees className="w-4 h-4 text-emerald-600" />
                  Cadastral Plot &amp; Land Demarcation:
                </span>
                <span className="text-[10px] bg-emerald-200/60 text-emerald-800 px-2 py-0.5 rounded font-bold">
                  Direct Title Sale
                </span>
              </div>

              <div className={`grid ${isMobile ? 'grid-cols-1 gap-2.5' : 'grid-cols-3 gap-3'}`}>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Plot Area Size</label>
                  <input
                    type="number"
                    value={plotArea}
                    onChange={(e) => setPlotArea(e.target.value)}
                    placeholder="e.g. 2400"
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Measurement Unit</label>
                  <select
                    value={plotUnit}
                    onChange={(e) => setPlotUnit(e.target.value)}
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                  >
                    <option value="sqft">Square Feet (sq.ft)</option>
                    <option value="cents">Cents</option>
                    <option value="gunthas">Gunthas</option>
                    <option value="acres">Acres</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Plot Dimensions (WxL)</label>
                  <input
                    type="text"
                    value={plotDimension}
                    onChange={(e) => setPlotDimension(e.target.value)}
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white placeholder:text-slate-400 placeholder:font-normal"
                    placeholder="e.g. 30x40 / 40x60"
                  />
                </div>
              </div>

              <div className={`grid ${isMobile ? 'grid-cols-1 gap-2.5' : 'grid-cols-3 gap-3'} pt-2 border-t border-emerald-100`}>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Layout Approval</label>
                  <select
                    value={approvalAuthority}
                    onChange={(e) => setApprovalAuthority(e.target.value)}
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                  >
                    <option value="">Select Authority</option>
                    <option value="BDA Approved Layout">BDA Approved Layout</option>
                    <option value="BMRDA Approved">BMRDA Approved</option>
                    <option value="DC Converted A-Khata">DC Converted A-Khata</option>
                    <option value="Grama Thana E-Khata">Panchayat E-Khata (Form 9/11)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Facing Direction</label>
                  <select
                    value={facingDirection}
                    onChange={(e) => setFacingDirection(e.target.value)}
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                  >
                    <option value="">Select Facing</option>
                    <option value="East Facing">East Facing</option>
                    <option value="North Facing">North Facing</option>
                    <option value="West Facing">West Facing</option>
                    <option value="South Facing">South Facing</option>
                  </select>
                </div>
                <div className={`flex items-center gap-4 ${isMobile ? 'pt-2' : 'pt-5'}`}>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isCornerPlot}
                      onChange={(e) => setIsCornerPlot(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>Corner Plot</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasBoundaryWall}
                      onChange={(e) => setHasBoundaryWall(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>Boundary Wall</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              CASE D: COMMERCIAL / SHOPS SPECIFIC FORM
              ========================================================================= */}
          {category === 'commercial' && (
            <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-extrabold text-purple-900">
                <span className="flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-purple-600" />
                  Commercial Retail &amp; Showroom Details:
                </span>
                <span className="text-[10px] bg-purple-200/60 text-purple-800 px-2 py-0.5 rounded font-bold">
                  {purpose === 'rent' ? 'Commercial Lease' : 'Outright Commercial Sale'}
                </span>
              </div>

              <div className={`grid ${isMobile ? 'grid-cols-1 gap-2.5' : 'grid-cols-3 gap-3'}`}>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Commercial Area (sq.ft)</label>
                  <input
                    type="number"
                    value={commercialAreaSqFt}
                    onChange={(e) => setCommercialAreaSqFt(e.target.value)}
                    placeholder="e.g. 2100"
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Frontage Width (Feet)</label>
                  <input
                    type="number"
                    value={frontageWidthFt}
                    onChange={(e) => setFrontageWidthFt(e.target.value)}
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white placeholder:text-slate-400 placeholder:font-normal"
                    placeholder="e.g. 40 ft"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Sanctioned Power Load</label>
                  <input
                    type="text"
                    value={powerLoadKva}
                    onChange={(e) => setPowerLoadKva(e.target.value)}
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white placeholder:text-slate-400 placeholder:font-normal"
                    placeholder="e.g. 25 KVA (3-Phase)"
                  />
                </div>
              </div>

              <div className={`grid ${isMobile ? 'grid-cols-1 gap-2.5' : 'grid-cols-2 gap-3'} pt-2 border-t border-purple-100`}>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Suitable For</label>
                  <input
                    type="text"
                    value={suitableFor}
                    onChange={(e) => setSuitableFor(e.target.value)}
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white placeholder:text-slate-400 placeholder:font-normal"
                    placeholder="e.g. Retail Showroom / Bank / Clinic"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Minimum Lease Lock-In</label>
                  <select
                    value={lockInPeriodYears}
                    onChange={(e) => setLockInPeriodYears(e.target.value)}
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                  >
                    <option value="">Select Lock-in</option>
                    <option value="1 Year">1 Year Lock-in</option>
                    <option value="3 Years">3 Years Commercial Lease</option>
                    <option value="5 Years">5 Years Long-term</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              CASE E: AGRICULTURAL LAND / FARMLAND SPECIFIC FORM
              ========================================================================= */}
          {category === 'agricultural' && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-extrabold text-emerald-950">
                <span className="flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-emerald-700" />
                  Agricultural &amp; Farmland Parameters:
                </span>
                <span className="text-[10px] bg-emerald-200/60 text-emerald-900 px-2 py-0.5 rounded font-bold">
                  Andhra Pradesh Revenue Adangal/ROR Cleared
                </span>
              </div>

              <div className={`grid ${isMobile ? 'grid-cols-1 gap-2.5' : 'grid-cols-3 gap-3'}`}>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Total Farmland Extent</label>
                  <div className="flex gap-1 mt-1">
                    <input
                      type="number"
                      step="0.1"
                      value={agriArea}
                      onChange={(e) => setAgriArea(e.target.value)}
                      placeholder="e.g. 2.5"
                      className="w-full p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white placeholder:text-slate-400 placeholder:font-normal"
                    />
                    <select
                      value={agriUnit}
                      onChange={(e) => setAgriUnit(e.target.value)}
                      className="border border-slate-300 rounded-xl text-xs font-bold bg-white px-2"
                    >
                      <option value="Acres">Acres</option>
                      <option value="Guntas">Guntas</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Soil Quality / Type</label>
                  <input
                    type="text"
                    value={soilType}
                    onChange={(e) => setSoilType(e.target.value)}
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white placeholder:text-slate-400 placeholder:font-normal"
                    placeholder="e.g. Red Loam Fertile Soil"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Water &amp; Irrigation</label>
                  <input
                    type="text"
                    value={waterSources}
                    onChange={(e) => setWaterSources(e.target.value)}
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white placeholder:text-slate-400 placeholder:font-normal"
                    placeholder="e.g. 2 Borewells + Canal"
                  />
                </div>
              </div>

              <div className={`grid ${isMobile ? 'grid-cols-1 gap-2.5' : 'grid-cols-2 gap-3'} pt-2 border-t border-emerald-100`}>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Crop History / Cultivation</label>
                  <input
                    type="text"
                    value={cropHistory}
                    onChange={(e) => setCropHistory(e.target.value)}
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white placeholder:text-slate-400 placeholder:font-normal"
                    placeholder="e.g. Paddy / Organic Vegetables"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Road Connectivity &amp; Approach</label>
                  <input
                    type="text"
                    value={roadApproach}
                    onChange={(e) => setRoadApproach(e.target.value)}
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white placeholder:text-slate-400 placeholder:font-normal"
                    placeholder="e.g. 30ft Tar road connectivity"
                  />
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              CASE F: PG (PAYING GUEST) & HOSTEL SPECIFIC FORM (RENT ONLY)
              ========================================================================= */}
          {category === 'pg' && (
            <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-2xl space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-extrabold text-teal-950">
                <span className="flex items-center gap-1.5">
                  <Bed className="w-4 h-4 text-teal-700" />
                  PG &amp; Hostel Owner Configuration (Rent Only):
                </span>
                <span className="text-[10px] bg-teal-200/70 text-teal-900 px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1">
                  <span>🔒</span> RENT ONLY · NO SALE
                </span>
              </div>

              {/* 1. Room Occupancy & Sharing Allowance (Owner Selection) */}
              <div className="bg-white p-3.5 rounded-xl border border-teal-100 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-teal-700" />
                    <span>Room Sharing &amp; Occupancy Allowance (1 or More Persons)</span>
                  </label>
                  <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                    Owner Choice
                  </span>
                </div>

                <div className={`grid ${isMobile ? 'grid-cols-1 gap-2.5' : 'grid-cols-3 gap-3'}`}>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700">Primary Sharing Type</label>
                    <select
                      value={roomSharingType}
                      onChange={(e) => {
                        setRoomSharingType(e.target.value);
                        if (e.target.value.includes('Single')) setCustomOccupancyCount('1');
                        else if (e.target.value.includes('Twin')) setCustomOccupancyCount('2');
                        else if (e.target.value.includes('Triple')) setCustomOccupancyCount('3');
                        else if (e.target.value.includes('Four')) setCustomOccupancyCount('4');
                      }}
                      className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                    >
                      <option value="Single Private Room (1 Person)">Single Private Room (1 Person)</option>
                      <option value="Twin Sharing (2 Persons)">Twin Sharing (2 Persons)</option>
                      <option value="Triple Sharing (3 Persons)">Triple Sharing (3 Persons)</option>
                      <option value="Four Sharing (4 Persons)">Four Sharing (4 Persons)</option>
                      <option value="Dormitory (5+ Persons)">Dormitory (5+ Persons)</option>
                      <option value="Multi-Sharing (1, 2, & 3 Available)">Multi-Sharing (1, 2, &amp; 3 Available)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700">Max Allowance per Room</label>
                    <select
                      value={customOccupancyCount}
                      onChange={(e) => setCustomOccupancyCount(e.target.value)}
                      className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                    >
                      <option value="1">1 Person (Private Room Allowance)</option>
                      <option value="2">2 Persons (Double Allowance)</option>
                      <option value="3">3 Persons (Triple Allowance)</option>
                      <option value="4">4 Persons (Quad Allowance)</option>
                      <option value="5">5 Persons (Dorm Allowance)</option>
                      <option value="6">6+ Persons (Hostel Bunk Allowance)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700">Total Beds Available</label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={totalBedsAvailable}
                        onChange={(e) => setTotalBedsAvailable(e.target.value)}
                        placeholder="e.g. 4"
                        className="w-full p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                      />
                      <span className="self-center text-xs text-slate-500 font-bold shrink-0">Beds</span>
                    </div>
                  </div>
                </div>

                <div className={`grid ${isMobile ? 'grid-cols-1 gap-2.5' : 'grid-cols-2 gap-3'} pt-2 border-t border-slate-100`}>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700">Total Rooms in Property</label>
                    <input
                      type="number"
                      min="1"
                      value={totalRoomsCount}
                      onChange={(e) => setTotalRoomsCount(e.target.value)}
                      placeholder="e.g. 8 Rooms"
                      className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-5">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={attachedBathroom}
                        onChange={(e) => setAttachedBathroom(e.target.checked)}
                        className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                      />
                      <span>Attached Private Washroom inside room</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* 2. Tenant Allowance & Preference Profile */}
              <div className="bg-white p-3.5 rounded-xl border border-teal-100 space-y-3">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
                  <span>Tenant Allowance Profile (Owner Restriction)</span>
                </label>

                <div className={`grid ${isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-3 gap-2'}`}>
                  {[
                    { id: 'Gents Only (Male PG)', label: '👨 Gents / Male Only', desc: 'Boys accommodation' },
                    { id: 'Ladies Only (Female PG)', label: '👩 Ladies / Female Only', desc: 'Girls accommodation' },
                    { id: 'Coliving / Any (Gents & Ladies)', label: '👫 Coliving / Unisex', desc: 'All welcome' }
                  ].map((occ) => {
                    const isSelected = allowedOccupants === occ.id;
                    return (
                      <button
                        type="button"
                        key={occ.id}
                        onClick={() => setAllowedOccupants(occ.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-teal-50 border-teal-500 text-teal-950 font-bold ring-1 ring-teal-500/20'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <div className="font-extrabold text-xs">{occ.label}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{occ.desc}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <label className="text-[11px] font-bold text-slate-700">Preferred Profession</label>
                  <select
                    value={tenantProfession}
                    onChange={(e) => setTenantProfession(e.target.value)}
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                  >
                    <option value="Working Professionals & Students">Working Professionals &amp; College Students (Any)</option>
                    <option value="Working Professionals Only (IT/Corporate)">Working Professionals Only (IT / Corporate)</option>
                    <option value="College Students Only">College Students Only</option>
                  </select>
                </div>
              </div>

              {/* 3. Food & Meals Allowance */}
              <div className="bg-white p-3.5 rounded-xl border border-teal-100 space-y-3">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-teal-700" />
                  <span>Food &amp; Meal Services</span>
                </label>

                <div className={`grid ${isMobile ? 'grid-cols-1 gap-2.5' : 'grid-cols-2 gap-3'}`}>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700">Meal Service Inclusion</label>
                    <select
                      value={foodIncluded}
                      onChange={(e) => setFoodIncluded(e.target.value)}
                      className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                    >
                      <option value="3 Times Meals Included">3 Times Meals (Breakfast, Lunch &amp; Dinner)</option>
                      <option value="Breakfast & Dinner Included">Breakfast &amp; Dinner Included</option>
                      <option value="Breakfast Only Included">Breakfast Only Included</option>
                      <option value="Food Optional (Available at Extra Charge)">Food Optional (Pay per Meal)</option>
                      <option value="Self-Cooking Kitchen Provided">Self-Cooking Kitchen Provided (Gas &amp; Utensils)</option>
                      <option value="No Food Provided">No Food Provided</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700">Food Menu &amp; Kitchen Type</label>
                    <select
                      value={foodType}
                      onChange={(e) => setFoodType(e.target.value)}
                      className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                    >
                      <option value="Veg & Non-Veg">Veg &amp; Non-Veg (North &amp; South Indian)</option>
                      <option value="Pure Vegetarian Kitchen">Pure Vegetarian Kitchen Only</option>
                      <option value="North Indian Specialized">North Indian Specialized</option>
                      <option value="South Indian Specialized">South Indian Specialized</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 4. Timings, Gate Rules & Deposit */}
              <div className="bg-white p-3.5 rounded-xl border border-teal-100 space-y-3">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-teal-700" />
                  <span>Curfew, Security Deposit &amp; House Rules</span>
                </label>

                <div className={`grid ${isMobile ? 'grid-cols-1 gap-2.5' : 'grid-cols-4 gap-2.5'}`}>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700">Gate Closing Time</label>
                    <select
                      value={gateClosingTime}
                      onChange={(e) => setGateClosingTime(e.target.value)}
                      className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                    >
                      <option value="No Curfew (24x7 Biometric Entry)">No Curfew (24x7 Biometric)</option>
                      <option value="10:00 PM">10:00 PM</option>
                      <option value="10:30 PM">10:30 PM</option>
                      <option value="11:00 PM">11:00 PM</option>
                      <option value="11:30 PM">11:30 PM</option>
                      <option value="12:00 Midnight">12:00 Midnight</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700">Security Deposit</label>
                    <select
                      value={pgSecurityDeposit}
                      onChange={(e) => setPgSecurityDeposit(e.target.value)}
                      className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                    >
                      <option value="1 Month Rent">1 Month Rent</option>
                      <option value="2 Months Rent">2 Months Rent</option>
                      <option value="Fixed ₹5,000">Fixed ₹5,000</option>
                      <option value="Fixed ₹10,000">Fixed ₹10,000</option>
                      <option value="Zero Deposit">Zero Deposit</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700">Notice Period</label>
                    <select
                      value={noticePeriodDays}
                      onChange={(e) => setNoticePeriodDays(e.target.value)}
                      className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                    >
                      <option value="15 Days">15 Days</option>
                      <option value="30 Days">30 Days (1 Month)</option>
                      <option value="60 Days">60 Days (2 Months)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700">Visitors Policy</label>
                    <select
                      value={visitorsPolicy}
                      onChange={(e) => setVisitorsPolicy(e.target.value)}
                      className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                    >
                      <option value="Allowed in Common Lounge">Common Lounge Only</option>
                      <option value="Daytime Allowed (Till 8 PM)">Daytime Allowed (Till 8 PM)</option>
                      <option value="Strictly No Outside Visitors">No Outside Visitors</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 5. PG Amenities Checklist */}
              <div className="bg-white p-3.5 rounded-xl border border-teal-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-teal-700" />
                    <span>Included Facilities &amp; Amenities Checklist</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {pgAmenities.length} Selected
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {[
                    'High-Speed Wi-Fi',
                    'Attached Washroom',
                    'Air Conditioning (AC)',
                    'Geyser / Hot Water',
                    'Washing Machine / Laundry',
                    'Daily Housekeeping',
                    'RO Purified Water',
                    'Power Backup',
                    'Individual Wardrobe',
                    'Study Desk & Chair',
                    'Refrigerator Access',
                    'Biometric Access',
                    'CCTV Security',
                    'TV / OTT in Lounge'
                  ].map((amenity) => {
                    const isChecked = pgAmenities.includes(amenity);
                    return (
                      <button
                        type="button"
                        key={amenity}
                        onClick={() => {
                          if (isChecked) {
                            setPgAmenities(pgAmenities.filter(a => a !== amenity));
                          } else {
                            setPgAmenities([...pgAmenities, amenity]);
                          }
                        }}
                        className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold text-left flex items-center justify-between transition-all ${
                          isChecked
                            ? 'bg-teal-50 border-teal-500 text-teal-900 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <span className="truncate">{amenity}</span>
                        {isChecked && <Check className="w-3 h-3 text-teal-600 shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Location & GPS Coordinate Pinpointer Fields */}
          <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div className={`flex ${isMobile ? 'flex-col gap-2' : 'flex-wrap items-center justify-between gap-2'}`}>
              <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-700" />
                <span>Property / Plot Geographic Location &amp; Pinpoint</span>
              </label>

              <div className={`flex items-center gap-2 ${isMobile ? 'w-full' : ''}`}>
                <button
                  type="button"
                  onClick={handleDetectGPS}
                  disabled={isLocatingSite}
                  className={`px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all shadow-2xs ${isMobile ? 'flex-1' : ''}`}
                >
                  <Navigation className="w-3 h-3 text-emerald-700" />
                  <span>{isLocatingSite ? 'Acquiring GPS...' : '🎯 Auto-Detect GPS (On-Site)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleResolveLocality}
                  disabled={isLocatingSite}
                  className={`px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all shadow-2xs ${isMobile ? 'flex-1' : ''}`}
                >
                  <Search className="w-3 h-3 text-slate-600" />
                  <span>Map from Locality</span>
                </button>
              </div>
            </div>

            <div className={`grid ${isMobile ? 'grid-cols-1 gap-2.5' : 'grid-cols-1 md:grid-cols-3 gap-3'}`}>
              <div>
                <label className="text-[11px] font-bold text-slate-700">Locality</label>
                <input
                  type="text"
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  placeholder="e.g. Kadapa, Visakhapatnam, Kakinada, Tirupati"
                  className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700">Address / Survey Corridor</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 100ft Road / Main Tar Approach"
                  className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700">Pincode</label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="e.g. 560038"
                  className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                />
              </div>
            </div>

            {/* Latitude & Longitude Pinpoint Inputs */}
            <div className="pt-1 border-t border-slate-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-slate-700">Geographic Coordinate Pinpoint</span>
                {latitude && longitude && (
                  <button
                    type="button"
                    onClick={handleReverseLookupFromCoords}
                    disabled={isLocatingSite}
                    className="text-[10px] text-emerald-800 hover:text-emerald-950 font-bold underline cursor-pointer flex items-center gap-1"
                  >
                    <span>⚡ Auto-Fill Names &amp; Address from Coords</span>
                  </button>
                )}
              </div>
              <div className={`grid ${isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-2 gap-3'}`}>
                <div>
                  <label className="text-[10px] font-bold text-slate-600">Exact Latitude Coordinate</label>
                  <input
                    type="text"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="e.g. 12.9784"
                    className="w-full mt-0.5 p-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold bg-white text-slate-900 placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600">Exact Longitude Coordinate</label>
                  <input
                    type="text"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="e.g. 77.6412"
                    className="w-full mt-0.5 p-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold bg-white text-slate-900 placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
              </div>
            </div>

            <div className="text-[10px] text-emerald-800 font-semibold flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${latitude && longitude ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
              <span>
                {latitude && longitude
                  ? `Coordinates Pinned: [${longitude}, ${latitude}] · Status: ${locationStatus}`
                  : `Coordinates Pinned: Not set yet · Status: ${locationStatus}`}
              </span>
            </div>
          </div>

          {/* Specialized Document Checklist for this Exact Combination */}
          {/* Land Survey Details & Boundary Demarcation */}
          {category === 'land' && (
            <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <Compass className="w-4 h-4 text-amber-700" />
                <span>Land Cadastral Survey &amp; Boundary Demarcation</span>
              </div>
              <div className={`grid ${isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-2 gap-3'} text-xs`}>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Survey Number / Hissa</label>
                  <input
                    type="text"
                    value={landSurveyNumber}
                    onChange={(e) => setLandSurveyNumber(e.target.value)}
                    placeholder="e.g. Sy. No. 42/1B, Varthur Hobli"
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Four Boundary Details</label>
                  <input
                    type="text"
                    value={boundaryDetails}
                    onChange={(e) => setBoundaryDetails(e.target.value)}
                    placeholder="North: Road, South: Plot 18, East: Park, West: Villa"
                    className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Interactive Photo Upload Dropzone */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className={`flex ${isMobile ? 'flex-col gap-2.5' : 'items-center justify-between'}`}>
              <div>
                <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-emerald-700" />
                  <span>Property Photos ({uploadedPhotos.length})</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  {category === 'land'
                    ? 'Upload authentic photos of the plot, boundary stones, and approach road.'
                    : 'Upload real photos of exterior, living rooms, and bedrooms.'}
                </p>
              </div>


              <label className={`cursor-pointer bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95 ${isMobile ? 'w-full' : ''}`}>
                <Plus className="w-3.5 h-3.5" />
                <span>Browse Photos</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoFilesSelected}
                  className="hidden"
                />
              </label>
            </div>

            {/* Photo Thumbnails or Clean Empty State */}
            {uploadedPhotos.length === 0 ? (
              <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center bg-white flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-xs font-extrabold text-slate-800">No photos uploaded yet</div>
                <p className="text-[11px] text-slate-500 max-w-sm">
                  Upload genuine photos from your phone or computer (JPG, PNG, WEBP). At least 1 photo is required.
                </p>
                <span className="mt-1 px-4 py-1.5 bg-emerald-600 group-hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Choose Photos</span>
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoFilesSelected}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {uploadedPhotos.map((photo, pIdx) => {
                  const photoSrc = photo.storageKey || photo.url;
                  const isCover = selectedPhoto === photo.storageKey || selectedPhoto === photo.url;
                  return (
                    <div
                      key={pIdx}
                      onClick={() => setSelectedPhoto(photoSrc)}
                      className={`group relative rounded-xl overflow-hidden border-2 bg-white transition-all cursor-pointer ${
                        isCover ? 'border-emerald-600 ring-2 ring-emerald-500/30' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <img src={photoSrc} alt={photo.name} className="h-20 w-full object-cover" />
                      <div className="p-1.5 bg-white flex items-center justify-between text-[10px]">
                        <span className="truncate font-semibold text-slate-700">{photo.name || `Photo ${pIdx + 1}`}</span>
                        {isCover && (
                          <span className="text-[9px] bg-emerald-600 text-white font-extrabold px-1.5 py-0.2 rounded">COVER</span>
                        )}
                      </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadedPhotos(prev => prev.filter((_, idx) => idx !== pIdx));
                      }}
                      className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-rose-600 text-white rounded-md text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove Photo"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
              </div>
            )}
          </div>

          {/* 3D Digital Twin Integration Banner */}
          <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl border border-emerald-500/30 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <Box className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-white">3D Architectural Digital Twin</h4>
                <p className="text-[11px] text-slate-300">Interactive 3D model synthesized for virtual buyer tours</p>
              </div>
            </div>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shrink-0">
              Auto-Enabled
            </span>
          </div>

          {/* Interactive Document Upload Section (Private & Admin-Only) */}
          <div className="space-y-3 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200">
            <div className={`flex ${isMobile ? 'flex-col gap-2.5' : 'flex-wrap items-center justify-between gap-2'}`}>
              <div>
                <label className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-700" />
                  <span>Legal Documents ({uploadedDocuments.length})</span>
                </label>
                <p className="text-[11px] text-emerald-800">
                  Encrypted &amp; private. Only RERA verification desk can view for title clearance.
                </p>
              </div>

              <div className={`flex ${isMobile ? 'flex-col w-full' : 'items-center'} gap-2`}>
                <select
                  value={selectedDocType}
                  onChange={(e) => setSelectedDocType(e.target.value)}
                  className={`bg-white border border-emerald-300 text-xs font-bold text-slate-800 rounded-xl px-2.5 py-1.5 outline-none shadow-xs ${isMobile ? 'w-full' : ''}`}
                >
                  {category === 'flat' && (
                    <>
                      <option value="AP MAUD / Municipal e-Khata Certificate">AP MAUD / Municipal e-Khata Certificate</option>
                      <option value="Registered Sale Deed">Registered Sale Deed</option>
                      <option value="Occupancy Certificate (OC)">Occupancy Certificate (OC)</option>
                      <option value="Property Tax Receipt">Latest Property Tax Receipt</option>
                    </>
                  )}
                  {category === 'house' && (
                    <>
                      <option value="Registered Title / Mother Deed">Registered Title / Mother Deed</option>
                      <option value="A-Khata / e-Khata Certificate">A-Khata / Municipal Certificate</option>
                      <option value="Sanctioned Building Plan">Sanctioned Building Plan Approval</option>
                      <option value="Encumbrance Certificate">Encumbrance Certificate (15-30 yrs)</option>
                    </>
                  )}
                  {category === 'land' && (
                    <>
                      <option value="Meebhoomi FMB / Cadastral Demarcation Sketch">Meebhoomi FMB / Cadastral Demarcation Sketch</option>
                      <option value="Registered Mother Deed">Registered Mother Deed</option>
                      <option value="APCRDA / DTCP Layout Sanction Order">APCRDA / DTCP Layout Sanction Order</option>
                      <option value="Encumbrance Certificate">Encumbrance Certificate (15-30 yrs)</option>
                    </>
                  )}
                  {category === 'commercial' && (
                    <>
                      <option value="Commercial Land Conversion Order">Commercial Land Conversion Order</option>
                      <option value="Fire Department NOC Certificate">Fire Department NOC Certificate</option>
                      <option value="Commercial Registered Deed">Commercial Registered Title Deed</option>
                      <option value="APCPDCL Commercial 3-Phase Sanction">APCPDCL Commercial 3-Phase Sanction</option>
                    </>
                  )}
                  {category === 'agricultural' && (
                    <>
                      <option value="Meebhoomi 1B Namuna / Adangal Extract">Meebhoomi 1B Namuna / Adangal Extract</option>
                      <option value="Cadastral Village Map & FMB Sketch">Cadastral Village Map &amp; FMB Sketch</option>
                      <option value="Pattadar Passbook / Title Deed">Pattadar Passbook / Title Deed</option>
                      <option value="Nil Encumbrance Certificate (EC)">Nil Encumbrance Certificate (EC)</option>
                    </>
                  )}
                  <option value="Other Legal Title Document">Other Legal Title Document</option>
                </select>

                <label className={`cursor-pointer bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95 ${isMobile ? 'w-full' : ''}`}>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Attach Document</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.png"
                    multiple
                    onChange={handleDocumentFilesSelected}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Document Checklist Pill Grid */}
            <div className={`grid ${isMobile ? 'grid-cols-1 gap-1.5' : 'grid-cols-2 gap-2'} text-[11px] font-semibold text-slate-700`}>
              {category === 'flat' && [
                'AP Municipal e-Khata Certificate',
                'Occupancy Certificate (OC)',
                'Commencement Certificate (CC)',
                'Registered Mother Deed / Sale Deed'
              ].map((doc, idx) => (
                <div key={idx} className="bg-white p-2 rounded-lg border border-slate-200 flex items-center gap-1.5 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{doc}</span>
                </div>
              ))}

              {category === 'land' && [
                '11E Survey Demarcation Sketch',
                'Village RTC / Pahani Extract',
                'BDA / BMRDA Sanctioned Layout Map',
                'Encumbrance Certificate (15-30 yrs)'
              ].map((doc, idx) => (
                <div key={idx} className="bg-white p-2 rounded-lg border border-slate-200 flex items-center gap-1.5 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{doc}</span>
                </div>
              ))}

              {category === 'house' && [
                'Mother Deed & Khata Extract',
                'Approved Sanctioned Building Plan',
                '15-Year Encumbrance Certificate (EC)',
                'Cadastral Boundary Demarcation'
              ].map((doc, idx) => (
                <div key={idx} className="bg-white p-2 rounded-lg border border-slate-200 flex items-center gap-1.5 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{doc}</span>
                </div>
              ))}

              {category === 'commercial' && [
                'Commercial Land Conversion Order',
                'Fire Department NOC Certificate',
                'Sanctioned Commercial Blueprint',
                'BESCOM Commercial 3-Phase Sanction'
              ].map((doc, idx) => (
                <div key={idx} className="bg-white p-2 rounded-lg border border-slate-200 flex items-center gap-1.5 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>{doc}</span>
                </div>
              ))}

              {category === 'agricultural' && [
                'Village RTC / Pahani Extract (Latest)',
                'Akarbandh & Tippani Survey Sketch',
                'Mutation Register Extract (MR)',
                'Nil Encumbrance Certificate (15-30 yrs)'
              ].map((doc, idx) => (
                <div key={idx} className="bg-white p-2 rounded-lg border border-slate-200 flex items-center gap-1.5 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{doc}</span>
                </div>
              ))}
            </div>

            {/* List of Attached Documents or Clean Empty State */}
            {uploadedDocuments.length === 0 ? (
              <div className="border-2 border-dashed border-emerald-200 rounded-xl p-4 text-center bg-white flex flex-col items-center justify-center gap-1.5 mt-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100/60 text-emerald-700 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800">No legal documents attached yet</span>
                <span className="text-[11px] text-slate-500 max-w-md">
                  Select a document category above and click <strong>Attach Document</strong> to upload title deeds or Khata certificates from your device (PDF, DOCX, JPG).
                </span>
              </div>
            ) : (
              <div className="space-y-1.5 mt-2">
                {uploadedDocuments.map((doc, dIdx) => (
                  <div key={dIdx} className="bg-white p-2 rounded-xl border border-emerald-200 flex items-center justify-between text-xs shadow-2xs">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
                      <div>
                        <span className="font-bold text-slate-800">{doc.name}</span>
                        <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-extrabold">
                          {doc.type}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">{doc.size}</span>
                      {doc.dataUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            if (doc.mimeType?.startsWith('image/') || doc.dataUrl.startsWith('data:image')) {
                              const win = window.open('');
                              if (win) {
                                win.document.write(`<title>${doc.name}</title><body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${doc.dataUrl}" style="max-width:95vw;max-height:95vh;border-radius:8px;box-shadow:0 10px 25px rgba(0,0,0,0.5);" /></body>`);
                              }
                            } else {
                              try {
                                const arr = doc.dataUrl.split(',');
                                const mime = arr[0].match(/:(.*?);/)?.[1] || doc.mimeType || 'application/pdf';
                                const bstr = atob(arr[1]);
                                let n = bstr.length;
                                const u8arr = new Uint8Array(n);
                                while (n--) u8arr[n] = bstr.charCodeAt(n);
                                const blob = new Blob([u8arr], { type: mime });
                                const url = URL.createObjectURL(blob);
                                window.open(url, '_blank');
                              } catch (e) {
                                window.open(doc.dataUrl, '_blank');
                              }
                            }
                          }}
                          className="text-emerald-700 hover:text-emerald-950 font-bold text-[11px] underline"
                          title="Preview Document"
                        >
                          View
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setUploadedDocuments(prev => prev.filter((_, idx) => idx !== dIdx))}
                        className="text-slate-400 hover:text-rose-600 p-0.5 ml-1"
                        title="Remove Document"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          </div>

          {/* Pinned Bottom Footer Submit Bar */}
          <div className={`shrink-0 p-3 ${isMobile ? 'px-3 py-2.5' : 'sm:px-6 sm:py-3.5'} bg-white border-t border-slate-200 flex ${isMobile ? 'flex-col' : 'flex-col sm:flex-row sm:items-center'} justify-between gap-2 z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]`}>
            <span className={`text-[11px] ${isMobile ? 'text-center' : 'sm:text-xs text-center sm:text-left'} text-slate-500 font-semibold`}>
              Direct Owner · 0% Brokerage
            </span>
            <div className={`flex items-center justify-end gap-2 ${isMobile ? 'w-full' : 'w-full sm:w-auto'}`}>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className={`${isMobile ? 'flex-1' : 'flex-1 sm:flex-none'} px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`${isMobile ? 'flex-1' : 'flex-1 sm:flex-none'} px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{initialProperty ? 'Saving changes...' : 'Submitting listing...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{initialProperty ? 'Save & Resubmit Listing' : 'Publish Listing'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
