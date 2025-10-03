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
  }

  async loadGeoTIFF(arrayBuffer) {
    try {
      console.log('GeoTIFFファイルの読み込みを開始...');
      
      // GeoTIFFファイルの読み込み
      const tiff = await fromArrayBuffer(arrayBuffer);
      const image = await tiff.getImage();
      
      console.log('GeoTIFFメタデータ:', {
        width: image.getWidth(),
        height: image.getHeight(),
        samplesPerPixel: image.getSamplesPerPixel(),
        bitsPerSample: image.getBitsPerSample(),
        photometricInterpretation: image.getPhotometricInterpretation(),
        planarConfiguration: image.getPlanarConfiguration()
      });

      // 地理参照情報の取得
      const geoKeys = image.getGeoKeys();
      const bbox = image.getBoundingBox();
      const pixelScale = image.getFileDirectory().ModelPixelScale;
      const tiePoint = image.getFileDirectory().ModelTiepoint;
      
      console.log('地理参照情報:', {
        geoKeys,
        bbox,
        pixelScale,
        tiePoint
      });

      // 画像データの読み込み
      const rasters = await image.readRasters();
      const elevationData = rasters[0]; // 最初のバンドを標高データとして使用

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
        originalData: elevationData
      };

    } catch (error) {
      console.error('GeoTIFF読み込みエラー:', error);
      throw new Error(`GeoTIFFファイルの読み込みに失敗しました: ${error.message}`);
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
