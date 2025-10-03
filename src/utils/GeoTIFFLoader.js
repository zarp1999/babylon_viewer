import { fromArrayBuffer } from 'geotiff';
import proj4 from 'proj4';

class GeoTIFFLoader {
  constructor() {
    // 一般的な投影法の定義
    this.proj4Definitions = {
      'EPSG:4326': '+proj=longlat +datum=WGS84 +no_defs',
      'EPSG:3857': '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs',
      'EPSG:32633': '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs',
      'EPSG:32634': '+proj=utm +zone=34 +datum=WGS84 +units=m +no_defs',
    };
    
    // 大規模データ対応の設定
    this.maxFileSize = 500 * 1024 * 1024; // 500MB
    this.chunkSize = 1024 * 1024; // 1MB chunks
    this.maxResolution = 2048; // 最大解像度
    this.progressiveLoading = true;
  }

  async loadGeoTIFF(arrayBuffer, options = {}) {
    try {
      console.log('GeoTIFFファイルの読み込みを開始...');
      
      const fileSize = arrayBuffer.byteLength;
      console.log(`ファイルサイズ: ${(fileSize / (1024 * 1024)).toFixed(2)}MB`);
      
      // 大規模データの場合はプログレッシブローディングを使用
      if (fileSize > this.maxFileSize) {
        return await this.loadLargeGeoTIFF(arrayBuffer, options);
      }
      
      // GeoTIFFファイルの読み込み
      let tiff = null;
      let image = null;

      try {
        tiff = await fromArrayBuffer(arrayBuffer);
        image = await tiff.getImage();
      } catch (e) {
        console.error('GeoTIFFファイルの解析に失敗:', e);
        throw new Error(`GeoTIFFファイルの解析に失敗しました: ${e.message}`);
      }
      
      // メタデータの安全な取得
      const metadata = {
        width: image.getWidth(),
        height: image.getHeight(),
        samplesPerPixel: image.getSamplesPerPixel(),
        bitsPerSample: image.getBitsPerSample()
      };

      // オプショナルなメタデータの安全な取得
      try {
        if (typeof image.getPhotometricInterpretation === 'function') {
          metadata.photometricInterpretation = image.getPhotometricInterpretation();
        }
      } catch (e) {
        console.warn('PhotometricInterpretationの取得に失敗:', e);
      }

      try {
        if (typeof image.getPlanarConfiguration === 'function') {
          metadata.planarConfiguration = image.getPlanarConfiguration();
        }
      } catch (e) {
        console.warn('PlanarConfigurationの取得に失敗:', e);
      }

      console.log('GeoTIFFメタデータ:', metadata);

      // 地理参照情報の安全な取得
      let geoKeys = null;
      let bbox = null;
      let pixelScale = null;
      let tiePoint = null;

      try {
        geoKeys = image.getGeoKeys();
      } catch (e) {
        console.warn('GeoKeysの取得に失敗:', e);
      }

      try {
        bbox = image.getBoundingBox();
      } catch (e) {
        console.warn('BoundingBoxの取得に失敗:', e);
      }

      try {
        const fileDirectory = image.getFileDirectory();
        if (fileDirectory) {
          pixelScale = fileDirectory.ModelPixelScale;
          tiePoint = fileDirectory.ModelTiepoint;
        }
      } catch (e) {
        console.warn('FileDirectoryの取得に失敗:', e);
      }
      
      console.log('地理参照情報:', {
        geoKeys,
        bbox,
        pixelScale,
        tiePoint
      });

      // 画像データの安全な読み込み
      let rasters = null;
      let elevationData = null;

      try {
        rasters = await image.readRasters();
        if (rasters && rasters.length > 0) {
          elevationData = rasters[0]; // 最初のバンドを標高データとして使用
        } else {
          throw new Error('ラスターデータが取得できませんでした');
        }
      } catch (e) {
        console.error('ラスターデータの読み込みに失敗:', e);
        throw new Error(`ラスターデータの読み込みに失敗しました: ${e.message}`);
      }

      // バウンディングボックスの計算
      const bounds = this.calculateBounds(bbox, geoKeys);
      
      // データの正規化
      const normalizedData = this.normalizeElevationData(elevationData);

      console.log('GeoTIFFデータの読み込み完了:', {
        width: image.getWidth(),
        height: image.getHeight(),
        bounds,
        elevationRange: {
          min: Math.min(...normalizedData),
          max: Math.max(...normalizedData)
        }
      });

      return {
        elevationData: normalizedData,
        width: image.getWidth(),
        height: image.getHeight(),
        bounds,
        geoKeys,
        originalData: elevationData,
        isLargeFile: false
      };

    } catch (error) {
      console.error('GeoTIFF読み込みエラー:', error);
      
      // より詳細なエラーメッセージを提供
      let errorMessage = 'GeoTIFFファイルの読み込みに失敗しました';
      
      if (error.message.includes('getPhotometricInterpretation')) {
        errorMessage = 'GeoTIFFファイルの形式がサポートされていません。別のGeoTIFFファイルを試してください。';
      } else if (error.message.includes('readRasters')) {
        errorMessage = 'GeoTIFFファイルの画像データを読み込めませんでした。ファイルが破損している可能性があります。';
      } else if (error.message.includes('fromArrayBuffer')) {
        errorMessage = 'GeoTIFFファイルの解析に失敗しました。有効なGeoTIFFファイルであることを確認してください。';
      } else {
        errorMessage = `GeoTIFFファイルの読み込みに失敗しました: ${error.message}`;
      }
      
      throw new Error(errorMessage);
    }
  }

  calculateBounds(bbox, geoKeys) {
    if (bbox && bbox.length >= 4) {
      return {
        minX: bbox[0],
        minY: bbox[1],
        maxX: bbox[2],
        maxY: bbox[3]
      };
    }

    // デフォルトのバウンディングボックス（WGS84）
    return {
      minX: -180,
      minY: -90,
      maxX: 180,
      maxY: 90
    };
  }

  normalizeElevationData(data) {
    if (!data || data.length === 0) {
      return [];
    }

    // NoData値の処理（一般的な値: -9999, -32768, 0）
    const noDataValues = [-9999, -32768, 0];
    const validData = data.filter(value => 
      value !== null && 
      value !== undefined && 
      !noDataValues.includes(value) &&
      !isNaN(value)
    );

    if (validData.length === 0) {
      console.warn('有効な標高データが見つかりません');
      return new Array(data.length).fill(0);
    }

    const min = Math.min(...validData);
    const max = Math.max(...validData);
    
    console.log(`標高データの正規化: min=${min}, max=${max}`);

    // データの正規化（0-1の範囲に）
    return data.map(value => {
      if (noDataValues.includes(value) || value === null || value === undefined || isNaN(value)) {
        return 0;
      }
      return (value - min) / (max - min);
    });
  }

  // 投影変換のヘルパーメソッド
  transformCoordinates(x, y, fromEPSG, toEPSG = 'EPSG:4326') {
    try {
      const fromProj = this.proj4Definitions[fromEPSG];
      const toProj = this.proj4Definitions[toEPSG];
      
      if (!fromProj || !toProj) {
        console.warn(`投影法の定義が見つかりません: ${fromEPSG} -> ${toEPSG}`);
        return { x, y };
      }

      const result = proj4(fromProj, toProj, [x, y]);
      return { x: result[0], y: result[1] };
    } catch (error) {
      console.error('座標変換エラー:', error);
      return { x, y };
    }
  }

  // 大規模GeoTIFFファイルのプログレッシブローディング
  async loadLargeGeoTIFF(arrayBuffer, options = {}) {
    console.log('大規模ファイルのプログレッシブローディングを開始...');
    
    try {
      let tiff = null;
      let image = null;

      try {
        tiff = await fromArrayBuffer(arrayBuffer);
        image = await tiff.getImage();
      } catch (e) {
        console.error('大規模GeoTIFFファイルの解析に失敗:', e);
        throw new Error(`大規模GeoTIFFファイルの解析に失敗しました: ${e.message}`);
      }
      
      const originalWidth = image.getWidth();
      const originalHeight = image.getHeight();
      
      // 解像度を下げてメモリ使用量を削減
      const scaleFactor = this.calculateScaleFactor(originalWidth, originalHeight);
      const targetWidth = Math.floor(originalWidth * scaleFactor);
      const targetHeight = Math.floor(originalHeight * scaleFactor);
      
      console.log(`解像度を ${originalWidth}x${originalHeight} から ${targetWidth}x${targetHeight} に縮小`);
      
      // 地理参照情報の安全な取得
      let geoKeys = null;
      let bbox = null;

      try {
        geoKeys = image.getGeoKeys();
      } catch (e) {
        console.warn('GeoKeysの取得に失敗:', e);
      }

      try {
        bbox = image.getBoundingBox();
      } catch (e) {
        console.warn('BoundingBoxの取得に失敗:', e);
      }

      const bounds = this.calculateBounds(bbox, geoKeys);
      
      // 低解像度でのデータ読み込み
      let rasters = null;
      let elevationData = null;

      try {
        rasters = await image.readRasters({
          width: targetWidth,
          height: targetHeight,
          resampleMethod: 'nearest'
        });
        
        if (rasters && rasters.length > 0) {
          elevationData = rasters[0];
        } else {
          throw new Error('ラスターデータが取得できませんでした');
        }
      } catch (e) {
        console.error('低解像度ラスターデータの読み込みに失敗:', e);
        throw new Error(`低解像度ラスターデータの読み込みに失敗しました: ${e.message}`);
      }
      
      const normalizedData = this.normalizeElevationData(elevationData);
      
      console.log('大規模ファイルの読み込み完了:', {
        originalSize: `${originalWidth}x${originalHeight}`,
        loadedSize: `${targetWidth}x${targetHeight}`,
        scaleFactor,
        bounds
      });
      
      return {
        elevationData: normalizedData,
        width: targetWidth,
        height: targetHeight,
        originalWidth,
        originalHeight,
        bounds,
        geoKeys,
        isLargeFile: true,
        scaleFactor
      };
      
    } catch (error) {
      console.error('大規模ファイル読み込みエラー:', error);
      
      // より詳細なエラーメッセージを提供
      let errorMessage = '大規模GeoTIFFファイルの読み込みに失敗しました';
      
      if (error.message.includes('getPhotometricInterpretation')) {
        errorMessage = 'GeoTIFFファイルの形式がサポートされていません。別のGeoTIFFファイルを試してください。';
      } else if (error.message.includes('readRasters')) {
        errorMessage = 'GeoTIFFファイルの画像データを読み込めませんでした。ファイルが破損している可能性があります。';
      } else if (error.message.includes('fromArrayBuffer')) {
        errorMessage = 'GeoTIFFファイルの解析に失敗しました。有効なGeoTIFFファイルであることを確認してください。';
      } else {
        errorMessage = `大規模GeoTIFFファイルの読み込みに失敗しました: ${error.message}`;
      }
      
      throw new Error(errorMessage);
    }
  }
  
  // 解像度のスケールファクターを計算
  calculateScaleFactor(width, height) {
    const maxDimension = Math.max(width, height);
    if (maxDimension <= this.maxResolution) {
      return 1.0;
    }
    return this.maxResolution / maxDimension;
  }
  
  // チャンクベースのデータ読み込み（将来の拡張用）
  async loadGeoTIFFChunked(arrayBuffer, chunkSize = this.chunkSize) {
    console.log('チャンクベースの読み込みを開始...');
    
    const totalSize = arrayBuffer.byteLength;
    const chunks = Math.ceil(totalSize / chunkSize);
    
    const results = [];
    
    for (let i = 0; i < chunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, totalSize);
      const chunk = arrayBuffer.slice(start, end);
      
      try {
        // チャンクごとの処理
        const chunkResult = await this.processChunk(chunk, i, chunks);
        results.push(chunkResult);
        
        // プログレスコールバック
        if (this.onProgress) {
          this.onProgress((i + 1) / chunks * 100);
        }
        
      } catch (error) {
        console.warn(`チャンク ${i} の処理に失敗:`, error);
      }
    }
    
    return this.mergeChunkResults(results);
  }
  
  // チャンクの処理（実装例）
  async processChunk(chunk, index, total) {
    // ここでチャンクごとの処理を実装
    // 実際の実装では、GeoTIFFの構造に応じて適切に処理する必要があります
    return {
      index,
      data: new Uint8Array(chunk),
      size: chunk.byteLength
    };
  }
  
  // チャンク結果のマージ
  mergeChunkResults(results) {
    // チャンク結果をマージする処理
    const totalSize = results.reduce((sum, result) => sum + result.size, 0);
    const mergedData = new Uint8Array(totalSize);
    
    let offset = 0;
    for (const result of results) {
      mergedData.set(result.data, offset);
      offset += result.size;
    }
    
    return mergedData;
  }
  
  // メモリ使用量の監視
  monitorMemoryUsage() {
    if (performance.memory) {
      const memory = performance.memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        usage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit * 100).toFixed(2) + '%'
      };
    }
    return null;
  }
  
  // メモリクリーンアップ
  cleanupMemory() {
    if (global.gc) {
      global.gc();
    }
  }

  // 標高データの統計情報を取得
  getElevationStatistics(elevationData) {
    const validData = elevationData.filter(value => 
      value !== null && 
      value !== undefined && 
      !isNaN(value) && 
      value !== 0
    );

    if (validData.length === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        std: 0,
        count: 0
      };
    }

    const sum = validData.reduce((acc, val) => acc + val, 0);
    const mean = sum / validData.length;
    const variance = validData.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / validData.length;
    const std = Math.sqrt(variance);

    return {
      min: Math.min(...validData),
      max: Math.max(...validData),
      mean,
      std,
      count: validData.length
    };
  }
}

export { GeoTIFFLoader };
