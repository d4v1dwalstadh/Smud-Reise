import React, { useState } from 'react';
import nvdbService from '../data/nvdbService';

const NVDBDebugger = () => {
  const [testResults, setTestResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [vehicleHeight, setVehicleHeight] = useState(4.0);

  // Billingstad-området som du testet
  const billingsstadBbox = [10.4, 59.88, 10.5, 59.92];

  const runTest = async (testName, testFunction) => {
    setIsLoading(true);
    console.log(`🧪 Starter test: ${testName}`);
    
    try {
      const startTime = Date.now();
      const result = await testFunction();
      const endTime = Date.now();
      
      const testResult = {
        name: testName,
        success: true,
        result,
        duration: endTime - startTime,
        timestamp: new Date().toLocaleTimeString()
      };
      
      console.log(`✅ Test fullført: ${testName}`, testResult);
      setTestResults(prev => [...(prev || []), testResult]);
      
    } catch (error) {
      const testResult = {
        name: testName,
        success: false,
        error: error.message,
        timestamp: new Date().toLocaleTimeString()
      };
      
      console.error(`❌ Test feilet: ${testName}`, error);
      setTestResults(prev => [...(prev || []), testResult]);
    } finally {
      setIsLoading(false);
    }
  };

  const testNVDBConnection = () => {
    runTest('NVDB Tilkobling', async () => {
      return await nvdbService.testNVDBConnection();
    });
  };

  const testBillingsstadArea = () => {
    runTest(`Billingstad område (${vehicleHeight}m kjøretøy)`, async () => {
      return await nvdbService.debugArea(billingsstadBbox, vehicleHeight);
    });
  };

  const testSpecificAPI = async (objectType, typeName) => {
    runTest(`${typeName} API test`, async () => {
      const url = `https://nvdbapiles.atlas.vegvesen.no/veiobjekter/${objectType}?kartutsnitt=${billingsstadBbox.join(',')}&srid=4326&inkluder=egenskaper,geometri&antall=10`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'X-Client': 'VeiviserApp/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return {
        count: data.objekter?.length || 0,
        objects: data.objekter?.slice(0, 3).map(obj => ({
          id: obj.id,
          egenskaper: obj.egenskaper?.map(e => ({
            id: e.id,
            navn: e.navn,
            verdi: e.verdi
          }))
        }))
      };
    });
  };

  const clearResults = () => {
    setTestResults(null);
    nvdbService.clearCache();
  };

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      left: '10px',
      zIndex: 10000,
      backgroundColor: 'white',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
      maxWidth: '400px',
      maxHeight: '90vh',
      overflow: 'auto'
    }}>
      <h3 style={{ margin: '0 0 15px 0' }}>🔧 NVDB Debugger</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          Kjøretøyhøyde (m):
        </label>
        <input
          type="number"
          value={vehicleHeight}
          onChange={(e) => setVehicleHeight(parseFloat(e.target.value) || 4.0)}
          step="0.1"
          min="0.1"
          max="20"
          style={{
            width: '100%',
            padding: '5px',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
        <button
          onClick={testNVDBConnection}
          disabled={isLoading}
          style={{
            padding: '8px 12px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          Test NVDB Tilkobling
        </button>
        
        <button
          onClick={testBillingsstadArea}
          disabled={isLoading}
          style={{
            padding: '8px 12px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          Test Billingstad Område
        </button>

        <button
          onClick={() => testSpecificAPI(591, 'Høydebegrensninger')}
          disabled={isLoading}
          style={{
            padding: '8px 12px',
            backgroundColor: '#ffc107',
            color: 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          Test Høydebegrensninger API
        </button>

        <button
          onClick={() => testSpecificAPI(60, 'Bruer')}
          disabled={isLoading}
          style={{
            padding: '8px 12px',
            backgroundColor: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          Test Bruer API
        </button>

        <button
          onClick={() => testSpecificAPI(67, 'Tunneler')}
          disabled={isLoading}
          style={{
            padding: '8px 12px',
            backgroundColor: '#6f42c1',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          Test Tunneler API
        </button>

        <button
          onClick={clearResults}
          style={{
            padding: '8px 12px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Rydd resultater
        </button>
      </div>

      {isLoading && (
        <div style={{
          padding: '10px',
          backgroundColor: '#e7f3ff',
          border: '1px solid #b3d9ff',
          borderRadius: '4px',
          marginBottom: '15px'
        }}>
          🔄 Tester...
        </div>
      )}

      {testResults && testResults.length > 0 && (
        <div>
          <h4>Testresultater:</h4>
          <div style={{ maxHeight: '300px', overflow: 'auto' }}>
            {testResults.map((result, index) => (
              <div
                key={index}
                style={{
                  padding: '10px',
                  marginBottom: '8px',
                  backgroundColor: result.success ? '#d4edda' : '#f8d7da',
                  border: `1px solid ${result.success ? '#c3e6cb' : '#f5c6cb'}`,
                  borderRadius: '4px',
                  fontSize: '12px'
                }}
              >
                <div style={{ fontWeight: 'bold' }}>
                  {result.success ? '✅' : '❌'} {result.name}
                </div>
                <div style={{ fontSize: '11px', color: '#666' }}>
                  {result.timestamp} ({result.duration}ms)
                </div>
                
                {result.success && result.result && (
                  <pre style={{
                    marginTop: '8px',
                    padding: '8px',
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #e9ecef',
                    borderRadius: '3px',
                    fontSize: '10px',
                    overflow: 'auto',
                    maxHeight: '200px'
                  }}>
                    {JSON.stringify(result.result, null, 2)}
                  </pre>
                )}
                
                {!result.success && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px',
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #e9ecef',
                    borderRadius: '3px',
                    fontSize: '10px',
                    color: 'red'
                  }}>
                    {result.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div style={{
        marginTop: '15px',
        padding: '10px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        fontSize: '11px'
      }}>
        <strong>Tips:</strong>
        <ul style={{ margin: '5px 0', paddingLeft: '15px' }}>
          <li>Sjekk konsollen for detaljert logging</li>
          <li>Test med forskjellige kjøretøyhøyder</li>
          <li>Verifiser at NVDB API svarer</li>
          <li>Se på objektenes egenskaper for å finne riktige høyde-ID-er</li>
        </ul>
      </div>
    </div>
  );
};

export default NVDBDebugger;