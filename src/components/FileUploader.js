import React, { useRef } from 'react';
import './FileUploader.css';

const FileUploader = ({ onFileLoad, isLoading, error }) => {
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

      // ファイルサイズの検証（100MB制限）
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxSize) {
        alert('ファイルサイズが大きすぎます。100MB以下のファイルを選択してください。');
        return;
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
              最大サイズ: 100MB
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
