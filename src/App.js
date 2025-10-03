import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import BabylonViewer from './components/BabylonViewer';
import FileUploader from './components/FileUploader';
import ControlPanel from './components/ControlPanel';

function App() {
  const [geotiffData, setGeotiffData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewerSettings, setViewerSettings] = useState({
    heightScale: 1.0,
    wireframe: false,
    showGrid: true,
    cameraSpeed: 1.0
  });

  const handleFileLoad = async (file) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      setGeotiffData(arrayBuffer);
    } catch (err) {
      setError('ファイルの読み込みに失敗しました: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingsChange = (newSettings) => {
    setViewerSettings(prev => ({ ...prev, ...newSettings }));
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>GeoTIFF 3D Viewer</h1>
        <p>GeoTIFFファイルをアップロードして3次元で表示</p>
      </header>
      
      <main className="App-main">
        <div className="sidebar">
          <FileUploader 
            onFileLoad={handleFileLoad}
            isLoading={isLoading}
            error={error}
          />
          <ControlPanel
            settings={viewerSettings}
            onSettingsChange={handleSettingsChange}
            disabled={!geotiffData}
          />
        </div>
        
        <div className="viewer-container">
          <BabylonViewer
            geotiffData={geotiffData}
            settings={viewerSettings}
            isLoading={isLoading}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
