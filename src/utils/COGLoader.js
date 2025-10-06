/**
 * COG (Cloud Optimized GeoTIFF) Loader
 * 大規模GeoTIFFファイルから必要な部分を効率的に読み込み
 */

import { fromArrayBuffer } from 'geotiff';

export class COGLoader {
  constructor() {
    this.cache = new Map();
    this.maxCacheSize = 50; // キャッシュサイズ制限
    this.baseUrl = ''; // COGファイルのベースURL
  }

  /**
   * COGファイルからタイルデータを読み込み
   */
  async loadTileFromCOG(cogUrl, bbox, resolution = 256) {
    const cacheKey = `${cogUrl}_${bbox.minX}_${bbox.minZ}_${bbox.maxX}_${bbox.maxZ}_${resolution}`;
    
    if (this.cache.has(cacheKey)) {
      console.log('COG Loader: キャッシュから取得', cacheKey);
      return this.cache.get(cacheKey);
    }

    try {
      console.log('COG Loader: タイル読み込み開始', { cogUrl, bbox, resolution });
      
      // 現在はテスト用のダミーデータを返す
      // 実際の実装では、COGファイルから必要な部分を取得
      const tileData = await this.generateTestTileData(bbox, resolution);
      
      // キャッシュに保存
      this.cache.set(cacheKey, tileData);
      this.manageCacheSize();
      
      return tileData;
      
    } catch (error) {
      console.error('COG Loader: タイル読み込みエラー', error);
      throw error;
    }
  }

  /**
   * テスト用のダミータイルデータを生成
   * 実際の実装では、COGファイルからデータを取得
   */
  async generateTestTileData(bbox, resolution) {
    // 実際のCOGファイルの読み込み処理
    // const response = await fetch(cogUrl);
    // const arrayBuffer = await response.arrayBuffer();
    // const tiff = await fromArrayBuffer(arrayBuffer);
    // const image = await tiff.getImage();
    
    // テスト用のノイズベースの地形データを生成
    const width = resolution;
    const height = resolution;
    const elevationData = new Float32Array(width * height);
    
    // パーリンノイズ風の地形を生成
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        
        // ワールド座標を計算
        const worldX = bbox.minX + (x / width) * (bbox.maxX - bbox.minX);
        const worldZ = bbox.minZ + (y / height) * (bbox.maxZ - bbox.minZ);
        
        // 複数のノイズレイヤーを組み合わせて地形を生成
        const noise1 = this.simplexNoise(worldX * 0.01, worldZ * 0.01) * 200;
        const noise2 = this.simplexNoise(worldX * 0.02, worldZ * 0.02) * 100;
        const noise3 = this.simplexNoise(worldX * 0.04, worldZ * 0.04) * 50;
        const noise4 = this.simplexNoise(worldX * 0.08, worldZ * 0.08) * 25;
        
        elevationData[index] = noise1 + noise2 + noise3 + noise4;
      }
    }
    
    return {
      elevationData,
      bbox,
      width,
      height,
      metadata: {
        resolution,
        generated: true,
        timestamp: Date.now()
      }
    };
  }

  /**
   * 簡易ノイズ関数
   * 実際の実装では、SimplexNoiseライブラリを使用
   */
  simplexNoise(x, z) {
    // 簡易的なノイズ関数
    const n1 = Math.sin(x) * Math.cos(z);
    const n2 = Math.sin(x * 2.1) * Math.cos(z * 2.1) * 0.5;
    const n3 = Math.sin(x * 4.1) * Math.cos(z * 4.1) * 0.25;
    const n4 = Math.sin(x * 8.1) * Math.cos(z * 8.1) * 0.125;
    return n1 + n2 + n3 + n4;
  }

  /**
   * 実際のCOGファイルからデータを取得（将来の実装）
   */
  async loadFromRealCOG(cogUrl, bbox, resolution) {
    try {
      // COGファイルのヘッダー情報を取得
      const headerResponse = await fetch(cogUrl, {
        headers: { 'Range': 'bytes=0-1023' }
      });
      
      if (!headerResponse.ok) {
        throw new Error(`COGファイルのヘッダー取得に失敗: ${headerResponse.status}`);
      }
      
      // 必要な部分のバイト範囲を計算
      const byteRange = this.calculateByteRange(bbox, resolution);
      
      // 指定された範囲のデータを取得
      const dataResponse = await fetch(cogUrl, {
        headers: { 'Range': `bytes=${byteRange.start}-${byteRange.end}` }
      });
      
      if (!dataResponse.ok) {
        throw new Error(`COGファイルのデータ取得に失敗: ${dataResponse.status}`);
      }
      
      const arrayBuffer = await dataResponse.arrayBuffer();
      const tiff = await fromArrayBuffer(arrayBuffer);
      const image = await tiff.getImage();
      
      // 指定された範囲のデータを読み込み
      const rasters = await image.readRasters({
        window: [bbox.minX, bbox.minZ, bbox.maxX, bbox.maxZ],
        width: resolution,
        height: resolution
      });

      return {
        elevationData: rasters[0],
        bbox: bbox,
        width: resolution,
        height: resolution,
        metadata: {
          geoKeys: image.getGeoKeys(),
          bbox: image.getBoundingBox(),
          resolution,
          timestamp: Date.now()
        }
      };
      
    } catch (error) {
      console.error('COG Loader: 実際のCOGファイル読み込みエラー', error);
      throw error;
    }
  }

  /**
   * バイト範囲を計算（COGファイルの構造に基づく）
   */
  calculateByteRange(bbox, resolution) {
    // これはCOGファイルの具体的な構造に依存します
    // 簡易的な実装
    const tileIndex = this.getTileIndex(bbox);
    const tileSize = resolution * resolution * 4; // Float32の場合
    const offset = tileIndex * tileSize;
    
    return {
      start: offset,
      end: offset + tileSize - 1
    };
  }

  /**
   * タイルインデックスを計算
   */
  getTileIndex(bbox) {
    // 簡易的な実装
    const x = Math.floor(bbox.minX / 1000);
    const z = Math.floor(bbox.minZ / 1000);
    return x * 1000 + z; // 仮の計算
  }

  /**
   * キャッシュサイズを管理
   */
  manageCacheSize() {
    if (this.cache.size > this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      console.log('COG Loader: キャッシュから古いエントリを削除', firstKey);
    }
  }

  /**
   * キャッシュをクリア
   */
  clearCache() {
    this.cache.clear();
    console.log('COG Loader: キャッシュをクリア');
  }

  /**
   * キャッシュ統計を取得
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      keys: Array.from(this.cache.keys())
    };
  }
}
