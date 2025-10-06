import React, { useRef, useEffect, useState } from 'react';
import { Engine, Scene, ArcRotateCamera, HemisphericLight, Vector3, Color3 } from '@babylonjs/core';
import { DynamicTerrainManager } from '../utils/DynamicTerrainManager';
import './BabylonViewer.css';

const DynamicBabylonViewer = ({ settings, isLoading }) => {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const terrainManagerRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [memoryUsage, setMemoryUsage] = useState(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Babylon.jsエンジンとシーンの初期化
    const engine = new Engine(canvasRef.current, true);
    const scene = new Scene(engine);
    
    // カメラの設定
    const camera = new ArcRotateCamera(
      "camera",
      -Math.PI / 2,
      Math.PI / 3,
      200,
      Vector3.Zero(),
      scene
    );
    
    // カメラの設定を調整
    camera.setTarget(Vector3.Zero());
    camera.wheelPrecision = 10;
    camera.pinchPrecision = 10;
    camera.upperRadiusLimit = 10000;
    camera.lowerRadiusLimit = 10;
    camera.minZ = 0.1;
    camera.maxZ = 100000;
    
    // ライティングの設定
    const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
    light.intensity = 0.8;
    
    // 追加の方向光
    const directionalLight = new HemisphericLight("directionalLight", new Vector3(-1, -1, 1), scene);
    directionalLight.intensity = 0.3;
    
    // 背景色の設定
    scene.clearColor = new Color3(0.1, 0.1, 0.1);
    
    // Dynamic Terrain Managerの初期化
    const terrainManager = new DynamicTerrainManager(scene, camera);
    terrainManagerRef.current = terrainManager;
    
    // カメラ移動時のイベントリスナー
    camera.onViewMatrixChangedObservable.add(() => {
      if (terrainManagerRef.current) {
        terrainManagerRef.current.updateTerrain();
      }
    });
    
    // レンダーループ
    engine.runRenderLoop(() => {
      scene.render();
    });
    
    // メモリ使用量の監視
    const memoryInterval = setInterval(() => {
      if (performance.memory) {
        const memory = performance.memory;
        setMemoryUsage({
          used: (memory.usedJSHeapSize / (1024 * 1024)).toFixed(1),
          total: (memory.totalJSHeapSize / (1024 * 1024)).toFixed(1),
          limit: (memory.jsHeapSizeLimit / (1024 * 1024)).toFixed(1),
          usage: ((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(1)
        });
      }
    }, 2000);
    
    // デバッグ情報の更新
    const debugInterval = setInterval(() => {
      if (terrainManagerRef.current) {
        setDebugInfo(terrainManagerRef.current.getDebugInfo());
      }
    }, 1000);
    
    // リサイズハンドラー
    const handleResize = () => {
      engine.resize();
    };
    window.addEventListener('resize', handleResize);
    
    engineRef.current = engine;
    sceneRef.current = scene;
    cameraRef.current = camera;
    setIsInitialized(true);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(memoryInterval);
      clearInterval(debugInterval);
      
      if (terrainManagerRef.current) {
        terrainManagerRef.current.dispose();
      }
      
      engine.dispose();
    };
  }, []);

  // 設定変更時の処理
  useEffect(() => {
    if (terrainManagerRef.current) {
      terrainManagerRef.current.updateSettings(settings);
    }
  }, [settings]);

  // 初期地形の読み込み
  useEffect(() => {
    if (isInitialized && terrainManagerRef.current) {
      // 初期位置周辺の地形を読み込み
      terrainManagerRef.current.updateTerrain();
    }
  }, [isInitialized]);

  return (
    <div className="dynamic-babylon-viewer">
      <canvas ref={canvasRef} className="babylon-canvas" />
      
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Dynamic Terrainを読み込み中...</p>
        </div>
      )}
      
      {/* デバッグ情報の表示 */}
      {debugInfo && (
        <div className="debug-overlay">
          <h4>Dynamic Terrain デバッグ情報</h4>
          <p>読み込み済みタイル: {debugInfo.loadedTiles}</p>
          <p>読み込み中タイル: {debugInfo.loadingTiles}</p>
          <p>タイルキー: {debugInfo.tileKeys.join(', ')}</p>
        </div>
      )}
      
      {/* メモリ使用量の表示 */}
      {memoryUsage && (
        <div className="memory-overlay">
          <h4>メモリ使用量</h4>
          <p>使用中: {memoryUsage.used}MB / {memoryUsage.limit}MB</p>
          <p>使用率: {memoryUsage.usage}%</p>
        </div>
      )}
      
      {/* 操作説明 */}
      <div className="controls-overlay">
        <h4>操作方法</h4>
        <ul>
          <li>マウス左ドラッグ: 回転</li>
          <li>マウス右ドラッグ: パン</li>
          <li>マウスホイール: ズーム</li>
          <li>WASD: 移動</li>
        </ul>
        <p>カメラを移動すると、周辺の地形が動的に読み込まれます。</p>
      </div>
    </div>
  );
};

export default DynamicBabylonViewer;
