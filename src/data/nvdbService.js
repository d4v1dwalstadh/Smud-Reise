// nvdbService.js - Service for å hente undergangdata fra NVDB API med forbedret debugging

const NVDB_BASE_URL = 'https://nvdbapiles.atlas.vegvesen.no';

// Veiobjekttyper i NVDB (verifiserte)
const OBJECT_TYPES = {
  HEIGHT_RESTRICTION: 591,       // Høydebegrensning  
  TUNNEL: 67,                   // Tunnel
  UNDERPASS: 60,                // Bru (som kan ha høydebegrensning under)
  BRIDGE: 60                    // Bru
};

// Mulige egenskapstyper for høyde (disse kan variere)
const HEIGHT_PROPERTIES = {
  // Disse må vi teste for å finne riktige ID-er
  POSSIBLE_HEIGHT_IDS: [
    5135,  // Vanlig høydebegrensning
    5136,  // Høyde-relatert
    1081,  // Fri høyde
    1224,  // Tverrsnittshøyde
    1304,  // Fri høyde under bru
    9595,  // Andre høyde-egenskaper
    9596,
    9597
  ],
  NAME: 8129,
  RESTRICTION_REASON: 5136
};

class NVDBService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutter cache
    this.debugMode = true; // Aktiverer detaljert logging
    this.lastRequestTime = 0;
    this.minRequestInterval = 200; // Minimum 200ms mellom forespørsler
  }

  /**
   * Korrekte headers for NVDB API (basert på offisiell dokumentasjon)
   */
  getHeaders() {
    return {
      'Accept': 'application/json',
      'X-Client': 'VeiviserApp/1.0',
      'X-Kontaktperson': 'utvikler@veiviser.no', // Endre til din e-post
      'Content-Type': 'application/json'
    };
  }

  /**
   * Rate limiting for å unngå for mange forespørsler
   */
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.log(`⏳ Venter ${waitTime}ms for rate limiting`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Hent alle veiobjekter som kan være problematiske for kjøretøy av gitt høyde
   */
  async getObstructionsForVehicle(bbox, vehicleHeight) {
    if (!vehicleHeight || vehicleHeight <= 0) {
      console.warn('Ugyldig kjøretøyhøyde:', vehicleHeight);
      return [];
    }

    console.log(`🔍 Søker etter obstruksjoner for kjøretøy ${vehicleHeight}m i område:`, bbox);

    try {
      // Test først en enkel API-kall for å se om NVDB svarer
      await this.testNVDBConnection();

      // Hent alle relevante veiobjekter uten høydefilter først
      const [allHeightRestrictions, allTunnels, allBridges] = await Promise.all([
        this.fetchAllObjectsInArea(OBJECT_TYPES.HEIGHT_RESTRICTION, bbox, 'høydebegrensninger'),
        this.fetchAllObjectsInArea(OBJECT_TYPES.TUNNEL, bbox, 'tunneler'),
        this.fetchAllObjectsInArea(OBJECT_TYPES.BRIDGE, bbox, 'bruer')
      ]);

      console.log(`📊 Funnet totalt: ${allHeightRestrictions.length} høydebegrensninger, ${allTunnels.length} tunneler, ${allBridges.length} bruer`);

      // Analyser alle objekter for høydebegrensninger
      const problematicObstructions = [];

      // Analyser høydebegrensninger
      for (const restriction of allHeightRestrictions) {
        const analysis = this.analyzeHeightRestriction(restriction, vehicleHeight);
        if (analysis.isProblematic) {
          problematicObstructions.push({...analysis, type: 'height_restriction'});
        }
      }

      // Analyser tunneler
      for (const tunnel of allTunnels) {
        const analysis = this.analyzeTunnel(tunnel, vehicleHeight);
        if (analysis.isProblematic) {
          problematicObstructions.push({...analysis, type: 'tunnel'});
        }
      }

      // Analyser bruer
      for (const bridge of allBridges) {
        const analysis = this.analyzeBridge(bridge, vehicleHeight);
        if (analysis.isProblematic) {
          problematicObstructions.push({...analysis, type: 'bridge'});
        }
      }

      console.log(`⚠️ Funnet ${problematicObstructions.length} problematiske obstruksjoner for kjøretøy ${vehicleHeight}m`);
      
      return problematicObstructions;

    } catch (error) {
      console.error('❌ Feil ved henting av obstruksjoner:', error);
      
      // Hvis det er 403-feil, prøv alternative metoder
      if (error.message.includes('403')) {
        console.log('🔄 Prøver alternative metode for 403-feil...');
        return await this.getObstructionsAlternative(bbox, vehicleHeight);
      }
      
      return [];
    }
  }

  /**
   * Alternativ metode hvis hovedmetoden feiler med 403
   */
  async getObstructionsAlternative(bbox, vehicleHeight) {
    console.log('🔄 Bruker alternativ metode - JSONP eller proxy');
    
    try {
      // Prøv med JSONP hvis tilgjengelig
      return await this.fetchWithJSONP(bbox, vehicleHeight);
    } catch (error) {
      console.error('❌ Alternativ metode feilet også:', error);
      
      // Returner mock data for testing hvis alt feiler
      return this.getMockObstructions(bbox, vehicleHeight);
    }
  }

  /**
   * Test NVDB-tilkobling med forbedret feilhåndtering
   */
  async testNVDBConnection() {
    try {
      await this.waitForRateLimit();
      
      const testUrl = `${NVDB_BASE_URL}/veiobjekter/${OBJECT_TYPES.HEIGHT_RESTRICTION}?antall=1`;
      
      console.log('🧪 Tester NVDB-tilkobling:', testUrl);
      
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: this.getHeaders(),
        mode: 'cors', // Eksplisitt CORS-modus
        credentials: 'omit' // Ikke send cookies
      });

      console.log('📡 Response status:', response.status, response.statusText);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ NVDB API error response:', errorText);
        throw new Error(`NVDB API test failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ NVDB API tilkobling OK. Antall objekter:', data.objekter?.length || 0);
      
      if (data.objekter && data.objekter.length > 0) {
        console.log('📍 Første objekt eksempel:', {
          id: data.objekter[0].id,
          egenskaper: data.objekter[0].egenskaper?.slice(0, 3)
        });
      }
      
      return true;
    } catch (error) {
      console.error('❌ NVDB API tilkobling feilet:', error);
      
      // Gi spesifikk veiledning basert på feiltype
      if (error.message.includes('403')) {
        console.error('🚫 403 Forbidden - Mulige årsaker:');
        console.error('   • CORS-policy blokkerer forespørselen');
        console.error('   • API-nøkkel mangler eller er ugyldig');
        console.error('   • User-Agent eller Referer-header er påkrevd');
        console.error('   • Rate limiting - for mange forespørsler');
      } else if (error.message.includes('CORS')) {
        console.error('🌐 CORS-feil - API-et tillater ikke forespørsler fra denne domenen');
      }
      
      throw error;
    }
  }

  /**
   * Hent alle objekter av en type i et område med forbedret feilhåndtering
   */
  async fetchAllObjectsInArea(objectType, bbox, typeName) {
    // Sjekk cache først
    const cacheKey = `${objectType}-${bbox.join(',')}-${typeName}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log(`📦 Bruker cached data for ${typeName}`);
        return cached.data;
      }
    }

    await this.waitForRateLimit();

    const params = new URLSearchParams({
      kartutsnitt: bbox.join(','),
      srid: '4326',
      inkluder: 'egenskaper,geometri,metadata,vegreferanse,lokasjon',
      antall: '1000' // Begrens antall for testing
    });

    const url = `${NVDB_BASE_URL}/veiobjekter/${objectType}?${params}`;
    
    console.log(`🌐 Henter ${typeName} fra:`, url);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        mode: 'cors',
        credentials: 'omit'
      });

      console.log(`📡 ${typeName} response:`, response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`⚠️ NVDB API warning for ${typeName}: ${response.status} ${response.statusText}`);
        console.warn('Error body:', errorText);
        
        if (response.status === 403) {
          throw new Error(`403 Forbidden for ${typeName}: ${errorText}`);
        }
        
        return [];
      }

      const data = await response.json();
      const objects = data.objekter || [];
      
      // Cache resultatet
      this.cache.set(cacheKey, {
        data: objects,
        timestamp: Date.now()
      });
      
      console.log(`📍 Funnet ${objects.length} ${typeName}`);
      
      // Log første objekt for debugging
      if (objects.length > 0 && this.debugMode) {
        console.log(`🔍 Første ${typeName.slice(0, -1)} eksempel:`, {
          id: objects[0].id,
          egenskaper: objects[0].egenskaper?.map(e => ({id: e.id, navn: e.navn, verdi: e.verdi})),
          geometri: objects[0].geometri?.type,
          vegreferanse: objects[0].vegreferanse?.kortform
        });
      }

      return objects;
    } catch (error) {
      console.error(`❌ Feil ved henting av ${typeName}:`, error);
      
      // Hvis 403, kast videre for alternativ håndtering
      if (error.message.includes('403')) {
        throw error;
      }
      
      return [];
    }
  }

  /**
   * JSONP fallback-metode (hvis NVDB støtter det)
   */
  async fetchWithJSONP(bbox, vehicleHeight) {
    console.log('🔄 Prøver JSONP-metode...');
    
    return new Promise((resolve) => {
      // Dette er en mock implementasjon
      // I realiteten må du sjekke om NVDB API støtter JSONP
      setTimeout(() => {
        resolve(this.getMockObstructions(bbox, vehicleHeight));
      }, 1000);
    });
  }

  /**
   * Mock data for testing når API feiler
   */
  getMockObstructions(bbox, vehicleHeight) {
    console.log('🎭 Bruker mock data for testing');
    
    // Returner noen testobstruksjoner i området
    const mockObstructions = [];
    
    if (vehicleHeight > 3.5) {
      mockObstructions.push({
        id: 'mock-1',
        type: 'height_restriction',
        coordinates: [59.9, 10.45], // Billingstad-området
        clearanceHeight: 3.8,
        heightDifference: vehicleHeight - 3.8,
        isProblematic: true,
        name: 'Test Høydebegrensning',
        description: `Høydebegrensning: 3.8m (${(vehicleHeight - 3.8).toFixed(1)}m for høyt kjøretøy)`,
        roadInfo: {
          roadNumber: 'Rv 167',
          municipality: 'Asker'
        },
        dataSource: 'MOCK'
      });
    }
    
    return mockObstructions;
  }

  // Resten av metodene forblir uendret...
  analyzeHeightRestriction(restriction, vehicleHeight) {
    const coordinates = this.extractCoordinates(restriction.geometri);
    const heightInfo = this.findHeightInProperties(restriction.egenskaper, 'height_restriction');
    
    console.log(`🔍 Analyserer høydebegrensning ${restriction.id}:`, {
      heightInfo,
      coordinates,
      egenskaper: restriction.egenskaper?.map(e => ({id: e.id, navn: e.navn, verdi: e.verdi}))
    });

    const isProblematic = heightInfo.height && heightInfo.height < vehicleHeight;
    
    return {
      id: restriction.id,
      coordinates,
      clearanceHeight: heightInfo.height,
      heightDifference: heightInfo.height ? vehicleHeight - heightInfo.height : null,
      isProblematic,
      name: this.extractName(restriction.egenskaper) || 'Høydebegrensning',
      description: this.createDescription('height_restriction', heightInfo.height, vehicleHeight),
      roadInfo: {
        roadNumber: restriction.vegreferanse?.kortform || 'Ukjent veg',
        municipality: restriction.lokasjon?.kommune || 'Ukjent kommune'
      },
      dataSource: 'NVDB',
      rawHeightInfo: heightInfo,
      debugInfo: this.debugMode ? restriction : undefined
    };
  }

  analyzeTunnel(tunnel, vehicleHeight) {
    const coordinates = this.extractCoordinates(tunnel.geometri);
    const heightInfo = this.findHeightInProperties(tunnel.egenskaper, 'tunnel');
    
    console.log(`🔍 Analyserer tunnel ${tunnel.id}:`, {
      heightInfo,
      coordinates,
      egenskaper: tunnel.egenskaper?.map(e => ({id: e.id, navn: e.navn, verdi: e.verdi}))
    });

    const isProblematic = heightInfo.height && heightInfo.height < vehicleHeight;
    
    return {
      id: tunnel.id,
      coordinates,
      clearanceHeight: heightInfo.height,
      heightDifference: heightInfo.height ? vehicleHeight - heightInfo.height : null,
      isProblematic,
      name: this.extractName(tunnel.egenskaper) || 'Tunnel',
      description: this.createDescription('tunnel', heightInfo.height, vehicleHeight),
      roadInfo: {
        roadNumber: tunnel.vegreferanse?.kortform || 'Ukjent veg',
        municipality: tunnel.lokasjon?.kommune || 'Ukjent kommune'
      },
      dataSource: 'NVDB',
      rawHeightInfo: heightInfo,
      debugInfo: this.debugMode ? tunnel : undefined
    };
  }

  analyzeBridge(bridge, vehicleHeight) {
    const coordinates = this.extractCoordinates(bridge.geometri);
    const heightInfo = this.findHeightInProperties(bridge.egenskaper, 'bridge');
    
    console.log(`🔍 Analyserer bru ${bridge.id}:`, {
      heightInfo,
      coordinates,
      egenskaper: bridge.egenskaper?.map(e => ({id: e.id, navn: e.navn, verdi: e.verdi}))
    });

    const isProblematic = heightInfo.height && heightInfo.height < vehicleHeight;
    
    return {
      id: bridge.id,
      coordinates,
      clearanceHeight: heightInfo.height,
      heightDifference: heightInfo.height ? vehicleHeight - heightInfo.height : null,
      isProblematic,
      name: this.extractName(bridge.egenskaper) || 'Bru',
      description: this.createDescription('bridge', heightInfo.height, vehicleHeight),
      roadInfo: {
        roadNumber: bridge.vegreferanse?.kortform || 'Ukjent veg',
        municipality: bridge.lokasjon?.kommune || 'Ukjent kommune'
      },
      dataSource: 'NVDB',
      rawHeightInfo: heightInfo,
      debugInfo: this.debugMode ? bridge : undefined
    };
  }

  findHeightInProperties(egenskaper, objectType) {
    if (!egenskaper || !Array.isArray(egenskaper)) {
      return { height: null, source: 'no_properties' };
    }

    // Søk gjennom alle mulige høyde-ID-er
    for (const heightId of HEIGHT_PROPERTIES.POSSIBLE_HEIGHT_IDS) {
      const heightProp = egenskaper.find(prop => prop.id === heightId);
      if (heightProp && typeof heightProp.verdi === 'number') {
        const heightInMeters = heightProp.verdi >= 100 ? heightProp.verdi / 100 : heightProp.verdi;
        console.log(`📏 Funnet høyde ${heightInMeters}m i egenskap ${heightId} (${heightProp.navn || 'ukjent'})`);
        return {
          height: heightInMeters,
          source: `property_${heightId}`,
          propertyName: heightProp.navn,
          originalValue: heightProp.verdi
        };
      }
    }

    // Søk etter egenskaper som inneholder "høyde" i navnet
    const heightProperty = egenskaper.find(prop => 
      prop.navn && 
      prop.navn.toLowerCase().includes('høyde') &&
      typeof prop.verdi === 'number'
    );

    if (heightProperty) {
      const heightInMeters = heightProperty.verdi >= 100 ? heightProperty.verdi / 100 : heightProperty.verdi;
      console.log(`📏 Funnet høyde ${heightInMeters}m i egenskap "${heightProperty.navn}"`);
      return {
        height: heightInMeters,
        source: 'name_search',
        propertyName: heightProperty.navn,
        originalValue: heightProperty.verdi
      };
    }

    console.log(`❌ Ingen høydeinformasjon funnet for ${objectType}. Tilgjengelige egenskaper:`, 
      egenskaper.map(e => ({id: e.id, navn: e.navn, verdi: e.verdi}))
    );
    
    return { height: null, source: 'not_found' };
  }

  extractCoordinates(geometri) {
    if (!geometri || !geometri.coordinates) return null;
    
    try {
      if (geometri.type === 'Point') {
        const [lon, lat] = geometri.coordinates;
        return [lat, lon]; // Leaflet format
      } else if (geometri.type === 'LineString' && geometri.coordinates.length > 0) {
        const coords = geometri.coordinates;
        const midIndex = Math.floor(coords.length / 2);
        const [lon, lat] = coords[midIndex];
        return [lat, lon];
      }
    } catch (error) {
      console.warn('⚠️ Feil ved ekstraktering av koordinater:', error);
    }
    
    return null;
  }

  extractName(egenskaper) {
    if (!egenskaper || !Array.isArray(egenskaper)) return null;
    
    const nameProperty = egenskaper.find(prop => prop.id === HEIGHT_PROPERTIES.NAME);
    if (nameProperty && nameProperty.verdi) {
      return nameProperty.verdi;
    }
    
    return null;
  }

  createDescription(type, clearanceHeight, vehicleHeight) {
    const heightText = clearanceHeight ? `${clearanceHeight.toFixed(1)}m` : 'ukjent høyde';
    const diffText = clearanceHeight && vehicleHeight ? 
      ` (${(vehicleHeight - clearanceHeight).toFixed(1)}m for høyt kjøretøy)` : '';
    
    switch (type) {
      case 'height_restriction':
        return `Høydebegrensning: ${heightText}${diffText}`;
      case 'tunnel':
        return `Tunnel med høyde: ${heightText}${diffText}`;
      case 'bridge':
        return `Bru med fri høyde: ${heightText}${diffText}`;
      default:
        return `Obstruksjon: ${heightText}${diffText}`;
    }
  }

  setDebugMode(enabled) {
    this.debugMode = enabled;
    console.log(`🐛 Debug-modus ${enabled ? 'aktivert' : 'deaktivert'}`);
  }

  clearCache() {
    this.cache.clear();
    console.log('🗑️ Cache ryddet');
  }

  async debugArea(bbox, vehicleHeight = 4.0) {
    console.log('🔧 DEBUG: Tester område', bbox, 'for kjøretøy', vehicleHeight, 'm');
    
    try {
      const result = await this.getObstructionsForVehicle(bbox, vehicleHeight);
      console.log('🔧 DEBUG: Resultat:', result);
      return result;
    } catch (error) {
      console.error('🔧 DEBUG: Feil:', error);
      throw error;
    }
  }
}

// Eksporter singleton med debug aktivert
const nvdbService = new NVDBService();
export default nvdbService;