#!/bin/bash

echo "GeoTIFF 3D Viewer セットアップを開始します..."
echo

echo "依存関係をインストール中..."
npm install

if [ $? -ne 0 ]; then
    echo "エラー: npm install が失敗しました"
    exit 1
fi

echo
echo "セットアップが完了しました！"
echo
echo "アプリケーションを起動するには以下のコマンドを実行してください:"
echo "npm start"
echo
echo "ブラウザで http://localhost:3000 を開いてアプリケーションを使用できます。"
echo
