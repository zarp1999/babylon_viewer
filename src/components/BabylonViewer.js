import React, { useRef, useEffect, useState } from 'react';
import { Engine, Scene, ArcRotateCamera, HemisphericLight, Vector3, Color3, MeshBuilder, StandardMaterial } from '@babylonjs/core';
import { GeoTIFFLoader } from '../utils/GeoTIFFLoader';
import './BabylonViewer.css';

const BabylonViewer = ({ geotiffData, settings, isLoading }) => {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [memoryUsage, setMemoryUsage] = useState(null);
  const [terrainInfo, setTerrainInfo] = useState(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Babylon.jsエンジンとシーンの初期化
    const engine = new Engine(canvasRef.current, true);
    const scene = new Scene(engine);
    
    // カメラの設定
    const camera = new ArcRotateCamera(
      "camera",
      -Math.PI / 2,
      Math.PI / 2.5,
      10,
      Vector3.Zero(),
      scene
    );
    
    // カメラの設定を調整
    camera.setTarget(Vector3.Zero());
    camera.wheelPrecision = 50;
    camera.pinchPrecision = 50;
    camera.upperRadiusLimit = 1000;
    camera.lowerRadiusLimit = 1;
    
    // カメラコントロールの設定（Babylon.js v6対応）
    // カメラコントロールは自動的に有効になるため、追加設定は不要
    
    // ライティングの設定
    const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
    light.intensity = 0.7;
    
    // 背景色の設定
    scene.clearColor = new Color3(0.1, 0.1, 0.1);
    
    engineRef.current = engine;
    sceneRef.current = scene;
    cameraRef.current = camera;
    setIsInitialized(true);

    // レンダーループの開始
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

    // リサイズハンドラー
    const handleResize = () => {
      engine.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(memoryInterval);
      engine.dispose();
    };
  }, []);

  useEffect(() => {
    if (!isInitialized || !sceneRef.current) return;

    // 既存の地形メッシュをクリア
    const existingMeshes = sceneRef.current.meshes.filter(mesh => mesh.name.startsWith('terrain'));
    existingMeshes.forEach(mesh => mesh.dispose());

    if (geotiffData) {
      loadGeoTIFFData(geotiffData);
    }
  }, [geotiffData, isInitialized]);

  useEffect(() => {
    if (!isInitialized || !sceneRef.current) return;

    // 設定変更時の処理
    updateTerrainSettings();
  }, [settings, isInitialized]);

  const loadGeoTIFFData = async (arrayBuffer) => {
    try {
      const loader = new GeoTIFFLoader();
      const terrainData = await loader.loadGeoTIFF(arrayBuffer);
      
      if (terrainData && sceneRef.current) {
        // 地形情報の設定
        setTerrainInfo({
          width: terrainData.width,
          height: terrainData.height,
          originalWidth: terrainData.originalWidth,
          originalHeight: terrainData.originalHeight,
          isLargeFile: terrainData.isLargeFile,
          scaleFactor: terrainData.scaleFactor
        });
        
        createTerrainMesh(terrainData);
        
        // メモリクリーンアップ
        if (terrainData.isLargeFile) {
          loader.cleanupMemory();
        }
      }
    } catch (error) {
      console.error('GeoTIFFの読み込みエラー:', error);
    }
  };

  const createTerrainMesh = (terrainData) => {
    if (!sceneRef.current) return;

    const { elevationData, width, height, bounds } = terrainData;
    
    // 地形メッシュの作成
    const terrainMesh = createHeightMapMesh(
      elevationData,
      width,
      height,
      bounds,
      sceneRef.current
    );
    
    if (terrainMesh) {
      terrainMesh.name = 'terrain-main';
      terrainMesh.position.y = 0;
      
      // カメラの位置を調整
      if (cameraRef.current) {
        const maxDimension = Math.max(width, height);
        cameraRef.current.setTarget(Vector3.Zero());
        cameraRef.current.radius = maxDimension * 2;
        cameraRef.current.alpha = -Math.PI / 2;
        cameraRef.current.beta = Math.PI / 2.5;
      }
    }
  };

  const createHeightMapMesh = (elevationData, width, height, bounds, scene) => {
    try {
      // 頂点データの作成
      const positions = [];
      const indices = [];
      const uvs = [];
      const normals = [];

      const scaleX = (bounds.maxX - bounds.minX) / (width - 1);
      const scaleZ = (bounds.maxY - bounds.minY) / (height - 1);
      const minElevation = Math.min(...elevationData);
      const maxElevation = Math.max(...elevationData);
      const elevationRange = maxElevation - minElevation;

      // 頂点の生成
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = y * width + x;
          const elevation = elevationData[index] || 0;
          const normalizedElevation = elevationRange > 0 ? 
            (elevation - minElevation) / elevationRange : 0;
          
          const xPos = (x - width / 2) * scaleX;
          const zPos = (y - height / 2) * scaleZ;
          const yPos = normalizedElevation * settings.heightScale * 100;

          positions.push(xPos, yPos, zPos);
          uvs.push(x / (width - 1), y / (height - 1));
        }
      }

      // インデックスの生成
      for (let y = 0; y < height - 1; y++) {
        for (let x = 0; x < width - 1; x++) {
          const topLeft = y * width + x;
          const topRight = topLeft + 1;
          const bottomLeft = (y + 1) * width + x;
          const bottomRight = bottomLeft + 1;

          // 最初の三角形
          indices.push(topLeft, bottomLeft, topRight);
          // 2番目の三角形
          indices.push(topRight, bottomLeft, bottomRight);
        }
      }

      // 法線の計算
      for (let i = 0; i < positions.length; i += 3) {
        normals.push(0, 1, 0); // 簡易的な法線計算
      }

      // メッシュの作成
      const customMesh = MeshBuilder.CreateGround(
        'terrain',
        {
          width: (width - 1) * scaleX,
          height: (height - 1) * scaleZ,
          subdivisions: Math.min(width - 1, height - 1)
        },
        scene
      );

      // カスタムジオメトリの適用
      customMesh.setVerticesData('position', positions);
      customMesh.setVerticesData('uv', uvs);
      customMesh.setVerticesData('normal', normals);
      customMesh.setIndices(indices);

      // マテリアルの設定
      const material = new StandardMaterial('terrainMaterial', scene);
      material.diffuseColor = new Color3(0.4, 0.6, 0.3);
      material.specularColor = new Color3(0.1, 0.1, 0.1);
      material.wireframe = settings.wireframe;
      customMesh.material = material;

      return customMesh;
    } catch (error) {
      console.error('地形メッシュの作成エラー:', error);
      return null;
    }
  };

  const updateTerrainSettings = () => {
    if (!sceneRef.current) return;

    const terrainMesh = sceneRef.current.getMeshByName('terrain-main');
    if (terrainMesh && terrainMesh.material) {
      terrainMesh.material.wireframe = settings.wireframe;
    }
  };

  return (
    <div className="babylon-viewer">
      <canvas ref={canvasRef} className="babylon-canvas" />
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>GeoTIFFファイルを読み込み中...</p>
        </div>
      )}
      
      {/* メモリ使用量と地形情報の表示 */}
      {(memoryUsage || terrainInfo) && (
        <div className="info-overlay">
          {memoryUsage && (
            <div className="memory-info">
              <h4>メモリ使用量</h4>
              <p>使用中: {memoryUsage.used}MB / {memoryUsage.limit}MB</p>
              <p>使用率: {memoryUsage.usage}%</p>
            </div>
          )}
          {terrainInfo && (
            <div className="terrain-info">
              <h4>地形情報</h4>
              <p>解像度: {terrainInfo.width}×{terrainInfo.height}</p>
              {terrainInfo.isLargeFile && (
                <p>元の解像度: {terrainInfo.originalWidth}×{terrainInfo.originalHeight}</p>
              )}
              {terrainInfo.scaleFactor && (
                <p>スケール: {(terrainInfo.scaleFactor * 100).toFixed(1)}%</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BabylonViewer;
