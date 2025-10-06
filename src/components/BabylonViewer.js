import React, { useRef, useEffect, useState } from 'react';
import { Engine, Scene, UniversalCamera, HemisphericLight, Vector3, Color3, MeshBuilder, StandardMaterial, VertexData, Mesh } from '@babylonjs/core';
import { fromArrayBuffer } from 'geotiff';
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
    
    // カメラの設定（UniversalCamera）
    const camera = new UniversalCamera(
      "camera",
      new Vector3(100, 100, 100),
      scene
    );
    
    // カメラの設定を調整
    camera.setTarget(Vector3.Zero());
    camera.speed = 2.0;
    camera.angularSensibility = 2000;
    camera.inertia = 0.9;
    camera.minZ = 0.1;
    camera.maxZ = 100000;
    
    // カメラコントロールを有効化
    camera.attachControls(canvasRef.current, true);
    
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
      console.log('GeoTIFFファイルの読み込みを開始...');
      
      // geotiff.jsを直接使用
      const tiff = await fromArrayBuffer(arrayBuffer);
      const image = await tiff.getImage();
      
      // 画像のサイズを取得
      const width = image.getWidth();
      const height = image.getHeight();
      
      console.log(`GeoTIFF画像サイズ: ${width} x ${height}`);
      
      // 全バンドのデータを読み込み
      const rasterData = await image.readRasters();
      console.log(`読み込まれたバンド数: ${rasterData.length}`);
      console.log(`データ型: ${typeof rasterData[0]}, 長さ: ${rasterData[0]?.length}`);
      
      // 地理情報を取得
      const bbox = image.getBoundingBox();
      const geoKeys = image.getGeoKeys();
      
      console.log('地理参照情報:', {
        bbox: bbox,
        geoKeys: geoKeys,
        pixelScale: image.getFileDirectory().ModelPixelScale,
        tiepoint: image.getFileDirectory().ModelTiepoint
      });
      
      // データの構造を正しく処理
      let elevationArray, colorData = null;
      
      // データが1次元配列か2次元配列かを判定
      if (Array.isArray(rasterData[0]) && rasterData[0].length > 0) {
        // 2次元配列の場合（複数バンド）
        if (rasterData.length === 1) {
          // 単一バンド：標高データ
          elevationArray = rasterData[0];
          console.log('単一バンド: 標高データとして処理');
        } else if (rasterData.length >= 3) {
          // 複数バンド：RGB + 標高の可能性
          elevationArray = rasterData[0];
          colorData = {
            red: rasterData[0],
            green: rasterData[1],
            blue: rasterData[2]
          };
          console.log('複数バンド: RGB + 標高データとして処理');
        } else {
          // 2バンドの場合
          elevationArray = rasterData[0];
          colorData = {
            red: rasterData[0],
            green: rasterData[1],
            blue: rasterData[0]
          };
          console.log('2バンド: 標高 + 色データとして処理');
        }
      } else {
        // 1次元配列の場合（単一バンド）
        elevationArray = rasterData;
        console.log('1次元配列: 単一バンドとして処理');
      }
      
      // 配列の長さをチェック
      if (!elevationArray || elevationArray.length === 0) {
        throw new Error('標高データが空です');
      }
      
      console.log(`標高データ長: ${elevationArray.length}, 期待値: ${width * height}`);
      
      // データ長が期待値と一致するかチェック
      if (elevationArray.length !== width * height) {
        console.warn(`データ長が一致しません: 実際=${elevationArray.length}, 期待=${width * height}`);
        // データを切り詰めるか、パディングする
        if (elevationArray.length > width * height) {
          elevationArray = elevationArray.slice(0, width * height);
          console.log('データを切り詰めました');
        } else {
          // 不足分を最小値でパディング
          const padding = new Array(width * height - elevationArray.length).fill(elevationArray[0]);
          elevationArray = [...elevationArray, ...padding];
          console.log('データをパディングしました');
        }
      }
      
      // 標高データの統計を計算（実際のGeoTIFFの値を使用）
      let minElevation = elevationArray[0];
      let maxElevation = elevationArray[0];
      let validCount = 0;
      
      for (let i = 0; i < elevationArray.length; i++) {
        const elevation = elevationArray[i];
        if (elevation !== null && elevation !== undefined && !isNaN(elevation) && isFinite(elevation)) {
          if (elevation < minElevation) minElevation = elevation;
          if (elevation > maxElevation) maxElevation = elevation;
          validCount++;
        }
      }
      
      console.log(`標高範囲: ${minElevation.toFixed(2)}m - ${maxElevation.toFixed(2)}m`);
      console.log(`有効な標高データ数: ${validCount}/${elevationArray.length}`);
      
      const terrainData = {
        elevationData: elevationArray,
        colorData: colorData,
        width: width,
        height: height,
        bounds: {
          minX: bbox[0],
          minY: bbox[1],
          maxX: bbox[2],
          maxY: bbox[3]
        },
        minElevation: minElevation,
        maxElevation: maxElevation,
        geoKeys: geoKeys
      };
      
      if (terrainData && sceneRef.current) {
        // 地形情報の設定
        setTerrainInfo({
          width: terrainData.width,
          height: terrainData.height,
          originalWidth: terrainData.width,
          originalHeight: terrainData.height,
          isLargeFile: false,
          scaleFactor: 1.0
        });
        
        await createTerrainMesh(terrainData);
      }
    } catch (error) {
      console.error('GeoTIFFの読み込みエラー:', error);
    }
  };

  const createTerrainMesh = async (terrainData) => {
    if (!sceneRef.current) return;

    const { elevationData, colorData, width, height, bounds, minElevation, maxElevation } = terrainData;
    
    // スケールの計算
    const scaleX = (bounds.maxX - bounds.minX) / (width - 1);
    const scaleZ = (bounds.maxY - bounds.minY) / (height - 1);
    
    // 地形メッシュの作成
    const terrainMesh = await createHeightMapMesh(
      elevationData,
      colorData,
      width,
      height,
      bounds,
      minElevation,
      maxElevation,
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
        
        // GeoTIFFの実際の標高範囲を使用
        const elevationRange = maxElevation - minElevation;
        const maxElevationHeight = maxElevation * settings.heightScale;
        const adjustedRadius = Math.max(terrainSize, maxElevationHeight * 0.5);
        const distance = Math.max(adjustedRadius * 2, 200);
        
        console.log(`カメラ調整: 地形サイズ=${terrainSize}, GeoTIFF標高範囲=${elevationRange.toFixed(2)}m, 最大標高=${maxElevationHeight.toFixed(2)}m`);
        
        // UniversalCameraの位置を設定
        const cameraPosition = new Vector3(
          distance * 0.7,  // X位置
          distance * 0.7,  // Y位置（高さ）
          distance * 0.5   // Z位置
        );
        
        cameraRef.current.position = cameraPosition;
        cameraRef.current.setTarget(Vector3.Zero());
        
        // UniversalCameraの制限を設定
        cameraRef.current.minZ = 0.1;
        cameraRef.current.maxZ = distance * 10;
        
        console.log(`カメラ位置: (${cameraPosition.x.toFixed(2)}, ${cameraPosition.y.toFixed(2)}, ${cameraPosition.z.toFixed(2)})`);
      }
    }
  };

  const createHeightMapMesh = async (elevationData, colorData, width, height, bounds, minElevation, maxElevation, scene, scaleX, scaleZ) => {
    try {
      console.log(`地形メッシュ作成開始: ${width}x${height}, データ数: ${elevationData.length}`);
      console.log(`GeoTIFF標高範囲: ${minElevation.toFixed(2)}m - ${maxElevation.toFixed(2)}m`);
      
      // GeoTIFFの実際の標高範囲を使用
      const elevationRange = maxElevation - minElevation;
      console.log(`標高範囲: ${elevationRange.toFixed(2)}m`);

      // 頂点データの作成
      const positions = [];
      const indices = [];
      const uvs = [];

      // 頂点の生成（GeoTIFFの実際の値を使用）
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = y * width + x;
          const elevation = elevationData[index];
          
          // 無効な標高値の場合は最小値を使用
          const validElevation = (elevation !== null && elevation !== undefined && !isNaN(elevation) && isFinite(elevation)) 
            ? elevation 
            : minElevation;
          
          // GeoTIFFの実際の標高値をそのまま使用（メートル単位）
          const worldY = validElevation * settings.heightScale;
          
          // デバッグ用：最初の数点の座標をログ出力
          if (x < 5 && y < 5) {
            console.log(`頂点(${x},${y}): GeoTIFF標高=${validElevation.toFixed(3)}m, Y座標=${worldY.toFixed(3)}`);
          }
          
          const xPos = (x - width / 2) * scaleX;
          const zPos = (y - height / 2) * scaleZ;
          const yPos = worldY;

          positions.push(xPos, yPos, zPos);
          uvs.push(x / (width - 1), y / (height - 1));
        }
      }

      // インデックスの生成（安全な同期的処理）
      const totalVertices = width * height;
      console.log(`インデックス生成開始: 頂点数=${totalVertices}, 位置配列長=${positions.length / 3}`);
      
      for (let y = 0; y < height - 1; y++) {
        for (let x = 0; x < width - 1; x++) {
          const topLeft = y * width + x;
          const topRight = topLeft + 1;
          const bottomLeft = (y + 1) * width + x;
          const bottomRight = bottomLeft + 1;

          // インデックスの範囲チェック
          if (topLeft >= totalVertices || topRight >= totalVertices || 
              bottomLeft >= totalVertices || bottomRight >= totalVertices) {
            console.warn(`インデックス範囲外: ${topLeft}, ${topRight}, ${bottomLeft}, ${bottomRight} (最大: ${totalVertices - 1})`);
            continue;
          }

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
    const minValue = minElevation * settings.heightScale;
    customMesh.position.y = -minValue;

    // マテリアルの設定（GeoTIFFの色情報を使用）
    const material = new StandardMaterial('terrainMaterial', scene);
    
    if (colorData && colorData.red && colorData.green && colorData.blue) {
      // GeoTIFFの色情報がある場合、頂点カラーを設定
      const colorArray = [];
      const colorLength = Math.min(elevationData.length, colorData.red.length);
      
      for (let i = 0; i < colorLength; i++) {
        const r = (colorData.red[i] || 0) / 255.0;   // 0-255を0-1に正規化
        const g = (colorData.green[i] || 0) / 255.0;
        const b = (colorData.blue[i] || 0) / 255.0;
        colorArray.push(r, g, b, 1.0); // RGBA
      }
      
      // 不足分をデフォルト色でパディング
      while (colorArray.length < elevationData.length * 4) {
        colorArray.push(0.5, 0.5, 0.5, 1.0); // グレー
      }
      
      // 頂点カラーを設定
      vertexData.colors = colorArray;
      vertexData.applyToMesh(customMesh);
      
      console.log(`GeoTIFFの色情報を適用: ${colorLength}/${elevationData.length}ピクセル`);
    } else {
      // 色情報がない場合、標高に基づく色を生成
      const colorArray = [];
      for (let i = 0; i < elevationData.length; i++) {
        const elevation = elevationData[i];
        const normalizedElevation = (elevation - minElevation) / (maxElevation - minElevation);
        
        // 標高に基づいて色を計算
        let r, g, b;
        if (normalizedElevation < 0.3) {
          // 低地：青（海）
          r = 0.2; g = 0.4; b = 0.8;
        } else if (normalizedElevation < 0.6) {
          // 平地：緑（草地）
          r = 0.3; g = 0.7; b = 0.3;
        } else if (normalizedElevation < 0.8) {
          // 丘陵：茶色（土）
          r = 0.6; g = 0.4; b = 0.2;
        } else {
          // 高地：白（雪）
          r = 0.9; g = 0.9; b = 0.9;
        }
        
        colorArray.push(r, g, b, 1.0); // RGBA
      }
      
      // 頂点カラーを設定
      vertexData.colors = colorArray;
      vertexData.applyToMesh(customMesh);
      
      console.log('標高ベースの色を適用');
    }
    
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
