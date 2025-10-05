import React from 'react';
import './ControlPanel.css';

const ControlPanel = ({ settings, onSettingsChange, disabled }) => {
  const handleSliderChange = (key, value) => {
    onSettingsChange({ [key]: parseFloat(value) });
  };

  const handleCheckboxChange = (key, checked) => {
    onSettingsChange({ [key]: checked });
  };

  const resetSettings = () => {
    onSettingsChange({
      heightScale: 1.0,
      wireframe: false,
      showGrid: true,
      cameraSpeed: 1.0
    });
  };

  return (
    <div className="control-panel">
      <h3>表示設定</h3>
      
      <div className="control-group">
        <label className="control-label">
          標高スケール
          <span className="control-value">{settings.heightScale.toFixed(1)}x</span>
        </label>
        <input
          type="range"
          min="0.1"
          max="10.0"
          step="0.1"
          value={settings.heightScale}
          onChange={(e) => handleSliderChange('heightScale', e.target.value)}
          disabled={disabled}
          className="control-slider"
        />
      </div>

      <div className="control-group">
        <label className="control-label">
          ワイヤーフレーム表示
        </label>
        <input
          type="checkbox"
          checked={settings.wireframe}
          onChange={(e) => handleCheckboxChange('wireframe', e.target.checked)}
          disabled={disabled}
          className="control-checkbox"
        />
      </div>

      <div className="control-group">
        <label className="control-label">
          グリッド表示
        </label>
        <input
          type="checkbox"
          checked={settings.showGrid}
          onChange={(e) => handleCheckboxChange('showGrid', e.target.checked)}
          disabled={disabled}
          className="control-checkbox"
        />
      </div>

      <div className="control-group">
        <label className="control-label">
          カメラ速度
          <span className="control-value">{settings.cameraSpeed.toFixed(1)}x</span>
        </label>
        <input
          type="range"
          min="0.1"
          max="3.0"
          step="0.1"
          value={settings.cameraSpeed}
          onChange={(e) => handleSliderChange('cameraSpeed', e.target.value)}
          disabled={disabled}
          className="control-slider"
        />
      </div>

      <div className="control-actions">
        <button
          onClick={resetSettings}
          disabled={disabled}
          className="reset-btn"
        >
          設定をリセット
        </button>
      </div>

      <div className="control-info">
        <h4>操作方法</h4>
        <ul>
          <li>マウス左ドラッグ: 回転</li>
          <li>マウス右ドラッグ: パン</li>
          <li>マウスホイール: ズーム</li>
          <li>WASD: 移動</li>
        </ul>
      </div>
    </div>
  );
};

export default ControlPanel;
