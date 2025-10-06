/**
 * Dynamic Terrain Manager
 * カメラの位置に基づいて地形タイルを動的に読み込み・管理
 */

import { Vector3, Mesh, StandardMaterial, Color3, VertexData } from '@babylonjs/core';
import { COGLoader } from './COGLoader';

export class DynamicTerrainManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.terrainTiles = new Map();
    this.loadingTiles = new Set();
    this.tileSize = 256; // タイルサイズ（小さくしてテスト用）
    this.loadRadius = 2; // 読み込み半径
    this.unloadRadius = 4; // アンロード半径
    this.tileSpacing = 1000; // タイル間の距離
    this.lastCameraPosition = new Vector3();
    this.updateThreshold = 100; // カメラ移動の閾値
    
    // COGローダーの初期化
    this.cogLoader = new COGLoader();
    
    // デバッグ用
    this.debugMode = true;
  }

  /**
   * カメラの位置に基づいて地形を更新
   */
  async updateTerrain() {
    const cameraPosition = this.camera.position;
    
    // カメラが十分移動したかチェック
    if (Vector3.Distance(cameraPosition, this.lastCameraPosition) < this.updateThreshold) {
      return;
    }
    
    this.lastCameraPosition = cameraPosition.clone();
    
    if (this.debugMode) {
      console.log('Dynamic Terrain: カメラ位置更新', cameraPosition);
    }
    
    // 現在のタイル座標を計算
    const currentTile = this.getTileCoordinate(cameraPosition);
    
    // 必要なタイルを計算
    const requiredTiles = this.calculateRequiredTiles(currentTile);
    
    if (this.debugMode) {
      console.log('Dynamic Terrain: 必要なタイル数', requiredTiles.length);
    }
    
    // 不要なタイルをアンロード
    this.unloadUnusedTiles(requiredTiles);
    
    // 新しいタイルを読み込み
    for (const tileCoord of requiredTiles) {
      if (!this.terrainTiles.has(tileCoord.key) && !this.loadingTiles.has(tileCoord.key)) {
        this.loadTile(tileCoord);
      }
    }
  }

  /**
   * ワールド座標からタイル座標を計算
   */
  getTileCoordinate(worldPosition) {
    const x = Math.floor(worldPosition.x / this.tileSpacing);
    const z = Math.floor(worldPosition.z / this.tileSpacing);
    return { x, z, key: `${x}_${z}` };
  }

  /**
   * 必要なタイルのリストを計算
   */
  calculateRequiredTiles(centerTile) {
    const tiles = [];
    
    for (let x = centerTile.x - this.loadRadius; x <= centerTile.x + this.loadRadius; x++) {
      for (let z = centerTile.z - this.loadRadius; z <= centerTile.z + this.loadRadius; z++) {
        const key = `${x}_${z}`;
        tiles.push({ x, z, key });
      }
    }
    
    return tiles;
  }

  /**
   * 不要なタイルをアンロード
   */
  unloadUnusedTiles(requiredTiles) {
    const requiredKeys = new Set(requiredTiles.map(tile => tile.key));
    const tilesToRemove = [];
    
    for (const [key, mesh] of this.terrainTiles) {
      if (!requiredKeys.has(key)) {
        tilesToRemove.push(key);
      }
    }
    
    for (const key of tilesToRemove) {
      const mesh = this.terrainTiles.get(key);
      if (mesh) {
        this.scene.remove(mesh);
        mesh.dispose();
        this.terrainTiles.delete(key);
        
        if (this.debugMode) {
          console.log('Dynamic Terrain: タイルアンロード', key);
        }
      }
    }
  }

  /**
   * タイルを読み込み
   */
  async loadTile(tileCoord) {
    this.loadingTiles.add(tileCoord.key);
    
    if (this.debugMode) {
      console.log('Dynamic Terrain: タイル読み込み開始', tileCoord.key);
    }
    
    try {
      // タイルの境界ボックスを計算
      const bbox = this.getTileBoundingBox(tileCoord);
      
      // テスト用のダミーデータを生成（実際のCOGローダーに置き換え）
      const tileData = await this.generateTestTileData(bbox, tileCoord);
      
      // 地形メッシュを作成
      const terrainMesh = this.createTerrainMesh(tileData, tileCoord);
      
      this.terrainTiles.set(tileCoord.key, terrainMesh);
      this.scene.add(terrainMesh);
      
      if (this.debugMode) {
        console.log('Dynamic Terrain: タイル読み込み完了', tileCoord.key);
      }
      
    } catch (error) {
      console.error('Dynamic Terrain: タイル読み込みエラー', tileCoord.key, error);
    } finally {
      this.loadingTiles.delete(tileCoord.key);
    }
  }

  /**
   * タイルの境界ボックスを計算
   */
  getTileBoundingBox(tileCoord) {
    const minX = tileCoord.x * this.tileSpacing;
    const maxX = (tileCoord.x + 1) * this.tileSpacing;
    const minZ = tileCoord.z * this.tileSpacing;
    const maxZ = (tileCoord.z + 1) * this.tileSpacing;
    
    return {
      minX,
      maxX,
      minZ,
      maxZ,
      centerX: (minX + maxX) / 2,
      centerZ: (minZ + maxZ) / 2
    };
  }

  /**
   * テスト用のダミータイルデータを生成
   */
  async generateTestTileData(bbox, tileCoord) {
    // 実際の実装では、COGローダーを使用
    // const tileData = await this.cogLoader.loadTileFromCOG(this.cogUrl, bbox, this.tileSize);
    
    // テスト用のノイズベースの地形データを生成
    const width = this.tileSize;
    const height = this.tileSize;
    const elevationData = new Float32Array(width * height);
    
    // パーリンノイズ風の地形を生成
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        
        // タイル座標に基づくオフセット
        const worldX = bbox.minX + (x / width) * (bbox.maxX - bbox.minX);
        const worldZ = bbox.minZ + (y / height) * (bbox.maxZ - bbox.minZ);
        
        // 複数のノイズレイヤーを組み合わせ
        const noise1 = this.simplexNoise(worldX * 0.01, worldZ * 0.01) * 100;
        const noise2 = this.simplexNoise(worldX * 0.02, worldZ * 0.02) * 50;
        const noise3 = this.simplexNoise(worldX * 0.04, worldZ * 0.04) * 25;
        
        elevationData[index] = noise1 + noise2 + noise3;
      }
    }
    
    return {
      elevationData,
      bbox,
      width,
      height,
      metadata: {
        tileCoord,
        generated: true
      }
    };
  }

  /**
   * 簡易ノイズ関数（実際の実装では専用ライブラリを使用）
   */
  simplexNoise(x, z) {
    // 簡易的なノイズ関数（実際の実装ではSimplexNoiseライブラリを使用）
    const n1 = Math.sin(x) * Math.cos(z);
    const n2 = Math.sin(x * 2.1) * Math.cos(z * 2.1) * 0.5;
    const n3 = Math.sin(x * 4.1) * Math.cos(z * 4.1) * 0.25;
    return n1 + n2 + n3;
  }

  /**
   * 地形メッシュを作成
   */
  createTerrainMesh(tileData, tileCoord) {
    const { elevationData, bbox, width, height } = tileData;
    
    // 標高データの正規化
    let minElevation = elevationData[0];
    let maxElevation = elevationData[0];
    
    for (let i = 1; i < elevationData.length; i++) {
      const value = elevationData[i];
      if (value < minElevation) minElevation = value;
      if (value > maxElevation) maxElevation = value;
    }
    
    const elevationRange = maxElevation - minElevation;
    
    // 頂点データの作成
    const positions = [];
    const indices = [];
    const uvs = [];
    
    // 頂点の生成
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        const elevation = elevationData[index] || 0;
        
        // 正規化された標高を実際の標高に変換
        const normalizedElevation = elevationRange > 0 ? 
          (elevation - minElevation) / elevationRange : 0;
        
        const actualElevation = minElevation + (normalizedElevation * elevationRange);
        
        // ワールド座標を計算
        const xPos = bbox.minX + (x / (width - 1)) * (bbox.maxX - bbox.minX);
        const zPos = bbox.minZ + (y / (height - 1)) * (bbox.maxZ - bbox.minZ);
        const yPos = actualElevation * 0.1; // スケール調整
        
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
        indices.push(topLeft, topRight, bottomLeft);
        // 2番目の三角形
        indices.push(topRight, bottomRight, bottomLeft);
      }
    }
    
    // VertexDataを作成
    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.uvs = uvs;
    
    // 法線を計算
    vertexData.normals = [];
    VertexData.ComputeNormals(positions, indices, vertexData.normals);
    
    // メッシュを作成
    const mesh = new Mesh(`terrain_${tileCoord.key}`, this.scene);
    vertexData.applyToMesh(mesh);
    
    // マテリアルを設定
    const material = new StandardMaterial(`terrain_material_${tileCoord.key}`, this.scene);
    material.diffuseColor = new Color3(0.4, 0.6, 0.3);
    material.specularColor = new Color3(0.1, 0.1, 0.1);
    mesh.material = material;
    
    return mesh;
  }

  /**
   * 設定を更新
   */
  updateSettings(settings) {
    // 設定に基づいて地形を更新
    for (const [key, mesh] of this.terrainTiles) {
      if (mesh.material) {
        mesh.material.wireframe = settings.wireframe;
      }
    }
  }

  /**
   * デバッグ情報を取得
   */
  getDebugInfo() {
    return {
      loadedTiles: this.terrainTiles.size,
      loadingTiles: this.loadingTiles.size,
      tileKeys: Array.from(this.terrainTiles.keys())
    };
  }

  /**
   * リソースをクリーンアップ
   */
  dispose() {
    for (const [key, mesh] of this.terrainTiles) {
      this.scene.remove(mesh);
      mesh.dispose();
    }
    this.terrainTiles.clear();
    this.loadingTiles.clear();
  }
}
