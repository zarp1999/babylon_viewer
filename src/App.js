import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import BabylonViewer from './components/BabylonViewer';
import DynamicBabylonViewer from './components/DynamicBabylonViewer';
import FileUploader from './components/FileUploader';
import ControlPanel from './components/ControlPanel';

function App() {
  const [geotiffData, setGeotiffData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [fileInfo, setFileInfo] = useState(null);
  const [viewerSettings, setViewerSettings] = useState({
    heightScale: 1.0,
    wireframe: false,
    showGrid: true,
    cameraSpeed: 1.0
  });
  const [viewerMode, setViewerMode] = useState('static'); // 'static' or 'dynamic'

  const handleFileLoad = async (file) => {
    setIsLoading(true);
    setError(null);
    setProgress(0);
    setFileInfo(null);
    
    try {
      const fileSizeMB = file.size / (1024 * 1024);
      setFileInfo({
        name: file.name,
        size: fileSizeMB,
        isLarge: fileSizeMB > 500
      });
      
      // プログレス更新のシミュレーション
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 10;
        });
      }, 200);
      
      const arrayBuffer = await file.arrayBuffer();
      setProgress(100);
      clearInterval(progressInterval);
      
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
          <div className="viewer-mode-selector">
            <h4>表示モード</h4>
            <div className="mode-buttons">
              <button 
                className={viewerMode === 'static' ? 'active' : ''}
                onClick={() => setViewerMode('static')}
              >
                静的表示
              </button>
              <button 
                className={viewerMode === 'dynamic' ? 'active' : ''}
                onClick={() => setViewerMode('dynamic')}
              >
                動的表示
              </button>
            </div>
            <p className="mode-description">
              {viewerMode === 'static' 
                ? 'GeoTIFFファイルをアップロードして表示' 
                : 'カメラ移動に連動して地形を動的読み込み'
              }
            </p>
          </div>
          
          {viewerMode === 'static' && (
            <FileUploader 
              onFileLoad={handleFileLoad}
              isLoading={isLoading}
              error={error}
              progress={progress}
            />
          )}
          
          {fileInfo && viewerMode === 'static' && (
            <div className="file-info-panel">
              <h4>ファイル情報</h4>
              <p><strong>ファイル名:</strong> {fileInfo.name}</p>
              <p><strong>サイズ:</strong> {fileInfo.size.toFixed(1)}MB</p>
              {fileInfo.isLarge && (
                <p className="large-file-warning">
                  ⚠️ 大規模ファイル - 解像度を自動調整中
                </p>
              )}
            </div>
          )}
          
          <ControlPanel
            settings={viewerSettings}
            onSettingsChange={handleSettingsChange}
            disabled={viewerMode === 'static' ? !geotiffData : false}
          />
        </div>
        
        <div className="viewer-container">
          {viewerMode === 'static' ? (
            <BabylonViewer
              geotiffData={geotiffData}
              settings={viewerSettings}
              isLoading={isLoading}
            />
          ) : (
            <DynamicBabylonViewer
              settings={viewerSettings}
              isLoading={isLoading}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
