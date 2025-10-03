import React, { useRef } from 'react';
import './FileUploader.css';

const FileUploader = ({ onFileLoad, isLoading, error, progress }) => {
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // ファイル形式の検証
      if (!file.name.toLowerCase().endsWith('.tif') && 
          !file.name.toLowerCase().endsWith('.tiff')) {
        alert('GeoTIFFファイル（.tif または .tiff）を選択してください。');
        return;
      }

      // ファイルサイズの検証（1GB制限に拡張）
      const maxSize = 1024 * 1024 * 1024; // 1GB
      if (file.size > maxSize) {
        alert('ファイルサイズが大きすぎます。1GB以下のファイルを選択してください。');
        return;
      }

      // 大規模ファイルの警告
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > 500) {
        const confirmed = window.confirm(
          `大規模ファイル（${fileSizeMB.toFixed(1)}MB）が検出されました。\n` +
          'パフォーマンスを向上させるため、解像度を自動的に調整します。\n' +
          '続行しますか？'
        );
        if (!confirmed) return;
      }

      onFileLoad(file);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileSelect({ target: { files: [file] } });
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="file-uploader">
      <h3>ファイルアップロード</h3>
      
      <div 
        className="drop-zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={openFileDialog}
      >
        {isLoading ? (
          <div className="upload-loading">
            <div className="loading-spinner"></div>
            <p>読み込み中...</p>
            {progress !== undefined && (
              <div className="progress-container">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="progress-text">{progress.toFixed(1)}%</p>
              </div>
            )}
          </div>
        ) : (
          <div className="upload-content">
            <div className="upload-icon">📁</div>
            <p>GeoTIFFファイルをドラッグ&ドロップ</p>
            <p>または</p>
            <button 
              type="button" 
              className="select-file-btn"
              disabled={isLoading}
            >
              ファイルを選択
            </button>
            <p className="file-info">
              対応形式: .tif, .tiff<br/>
              最大サイズ: 1GB<br/>
              <span className="large-file-note">
                ※500MB以上のファイルは自動的に最適化されます
              </span>
            </p>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".tif,.tiff"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={isLoading}
      />

      {error && (
        <div className="error-message">
          <strong>エラー:</strong> {error}
        </div>
      )}
    </div>
  );
};

export default FileUploader;
