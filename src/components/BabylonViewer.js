import React, { useRef, useEffect, useState } from 'react';
import { Engine, Scene, ArcRotateCamera, HemisphericLight, Vector3, Color3, MeshBuilder, StandardMaterial, VertexData, Mesh } from '@babylonjs/core';
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
      Math.PI / 4,
      100,
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
    
    // カメラの位置を初期化
    camera.position = new Vector3(100, 100, 100);
    
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
    
    // スケールの計算
    const scaleX = (bounds.maxX - bounds.minX) / (width - 1);
    const scaleZ = (bounds.maxY - bounds.minY) / (height - 1);
    
    // 地形メッシュの作成
    const terrainMesh = createHeightMapMesh(
      elevationData,
      width,
      height,
      bounds,
      sceneRef.current,
      scaleX,
      scaleZ
    );
    
    if (terrainMesh) {
      terrainMesh.name = 'terrain-main';
      
      // カメラの位置を調整（Three.jsと同じロジック）
      if (cameraRef.current) {
        const maxDimension = Math.max(width, height);
        const scale = Math.max(scaleX, scaleZ);
        const terrainSize = maxDimension * scale;
        
        // 標高範囲を計算
        let minElevation = elevationData[0];
        let maxElevation = elevationData[0];
        for (let i = 1; i < elevationData.length; i++) {
          const value = elevationData[i];
          if (value < minElevation) minElevation = value;
          if (value > maxElevation) maxElevation = value;
        }
        const elevationRange = maxElevation - minElevation;
        
        // 垂直強調係数を計算
        const getVerticalExaggeration = (elevationRange) => {
          if (elevationRange < 10) return 10;
          else if (elevationRange < 100) return 5;
          else if (elevationRange < 500) return 2;
          else return 1;
        };
        
        const verticalExaggeration = getVerticalExaggeration(elevationRange);
        const maxElevationHeight = maxElevation * verticalExaggeration * settings.heightScale;
        const adjustedRadius = Math.max(terrainSize, maxElevationHeight * 0.5);
        const distance = Math.max(adjustedRadius * 2, 200);
        
        console.log(`カメラ調整: 地形サイズ=${terrainSize}, 標高範囲=${elevationRange}, 最大標高=${maxElevationHeight}, 垂直強調=${verticalExaggeration}x`);
        
        // カメラの位置を直接設定（ArcRotateCameraの制限を回避）
        const cameraPosition = new Vector3(
          distance * 0.7,  // X位置
          distance * 0.7,  // Y位置（高さ）
          distance * 0.5   // Z位置
        );
        
        cameraRef.current.position = cameraPosition;
        cameraRef.current.setTarget(Vector3.Zero());
        
        // カメラの制限を設定
        cameraRef.current.upperRadiusLimit = distance * 3;
        cameraRef.current.lowerRadiusLimit = distance * 0.1;
        cameraRef.current.minZ = 0.1;
        cameraRef.current.maxZ = distance * 10;
        
        console.log(`カメラ位置: (${cameraPosition.x.toFixed(2)}, ${cameraPosition.y.toFixed(2)}, ${cameraPosition.z.toFixed(2)})`);
        
        // カメラを強制的に更新
        cameraRef.current.attachControls(canvasRef.current, true);
      }
    }
  };

  const createHeightMapMesh = (elevationData, width, height, bounds, scene, scaleX, scaleZ) => {
    try {
      console.log(`地形メッシュ作成開始: ${width}x${height}, データ数: ${elevationData.length}`);
      
      // スタックオーバーフローを防ぐため、ループでmin/maxを計算
      let minElevation = elevationData[0];
      let maxElevation = elevationData[0];
      for (let i = 1; i < elevationData.length; i++) {
        const value = elevationData[i];
        if (value < minElevation) minElevation = value;
        if (value > maxElevation) maxElevation = value;
      }
      const elevationRange = maxElevation - minElevation;
      
      console.log(`標高範囲: ${minElevation} - ${maxElevation}, 範囲: ${elevationRange}`);

      // 垂直強調係数を計算（Three.jsと同じロジック）
      const getVerticalExaggeration = (elevationRange) => {
        if (elevationRange < 10) {
          return 10; // 平坦な地形は10倍強調
        } else if (elevationRange < 100) {
          return 5;  // 丘陵地は5倍強調
        } else if (elevationRange < 500) {
          return 2;  // 山地は2倍強調
        } else {
          return 1;  // 高山地は強調なし
        }
      };

      const verticalExaggeration = getVerticalExaggeration(elevationRange);
      console.log(`垂直強調係数: ${verticalExaggeration}x`);

      // 頂点データの作成
      const positions = [];
      const indices = [];
      const uvs = [];

      // 頂点の生成
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = y * width + x;
          const elevation = elevationData[index] || 0;
          
          // 無効な標高値の場合は最小値を使用
          const validElevation = (elevation !== null && elevation !== undefined && !isNaN(elevation) && isFinite(elevation)) 
            ? elevation 
            : minElevation;
          
          // 正規化された標高を実際の標高に変換
          const actualElevation = minElevation + (validElevation * elevationRange);
          
          // 3D座標を計算（垂直強調を適用）
          const worldY = actualElevation * verticalExaggeration * settings.heightScale;
          
          // デバッグ用：最初の数点の座標をログ出力
          if (x < 5 && y < 5) {
            console.log(`頂点(${x},${y}): 正規化=${validElevation.toFixed(3)}, 実際標高=${actualElevation.toFixed(3)}, Y座標=${worldY.toFixed(3)}`);
          }
          
          const xPos = (x - width / 2) * scaleX;
          const zPos = (y - height / 2) * scaleZ;
          const yPos = worldY;

          positions.push(xPos, yPos, zPos);
          uvs.push(x / (width - 1), y / (height - 1));
        }
      }

      // インデックスの生成（正しい三角形の作成）
      for (let y = 0; y < height - 1; y++) {
        for (let x = 0; x < width - 1; x++) {
          const topLeft = y * width + x;
          const topRight = topLeft + 1;
          const bottomLeft = (y + 1) * width + x;
          const bottomRight = bottomLeft + 1;

          // 最初の三角形（時計回り）
          indices.push(topLeft, topRight, bottomLeft);
          // 2番目の三角形（時計回り）
          indices.push(topRight, bottomRight, bottomLeft);
        }
      }

      console.log(`頂点数: ${positions.length / 3}, インデックス数: ${indices.length}`);
      console.log(`最初の10頂点: ${positions.slice(0, 30).map((v, i) => i % 3 === 0 ? `\n(${v.toFixed(2)},` : i % 3 === 1 ? `${v.toFixed(2)},` : `${v.toFixed(2)})`).join('')}`);

      // VertexDataを使用してメッシュを作成
      const vertexData = new VertexData();
      vertexData.positions = positions;
      vertexData.indices = indices;
      vertexData.uvs = uvs;
      
      // 法線を計算
      vertexData.normals = [];
      VertexData.ComputeNormals(positions, indices, vertexData.normals);

      // カスタムメッシュを作成
      const customMesh = new Mesh('terrain', scene);
      vertexData.applyToMesh(customMesh);

    // 地形を底面が原点0になるように下げる
    const minValue = minElevation * verticalExaggeration * settings.heightScale;
    customMesh.position.y = -minValue;

    // マテリアルの設定
    const material = new StandardMaterial('terrainMaterial', scene);
    material.diffuseColor = new Color3(0.4, 0.6, 0.3);
    material.specularColor = new Color3(0.1, 0.1, 0.1);
    material.wireframe = settings.wireframe;
    customMesh.material = material;

    console.log('地形メッシュ作成完了');
    console.log(`メッシュ位置: (${customMesh.position.x.toFixed(2)}, ${customMesh.position.y.toFixed(2)}, ${customMesh.position.z.toFixed(2)})`);
    console.log(`メッシュ境界: min=(${customMesh.getBoundingInfo().minimum.x.toFixed(2)}, ${customMesh.getBoundingInfo().minimum.y.toFixed(2)}, ${customMesh.getBoundingInfo().minimum.z.toFixed(2)}), max=(${customMesh.getBoundingInfo().maximum.x.toFixed(2)}, ${customMesh.getBoundingInfo().maximum.y.toFixed(2)}, ${customMesh.getBoundingInfo().maximum.z.toFixed(2)})`);
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
