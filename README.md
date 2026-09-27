# 無損自動去背

在瀏覽器裡執行的 AI 自動去背工具。圖片不會上傳，全部在你的裝置上處理。

- **無損**：輸出與原圖相同尺寸的 PNG。透明模式下主體每個像素的顏色都跟原圖完全一樣，只多了透明度（Alpha）通道，不縮放、不重新壓縮。
- **自動**：AI 模型（IMG.LY ISNet）自動辨識主體。
- **批次**：可一次選多張，並用 ZIP 一次下載。
- **背景**：可選透明、白色或自訂顏色。
- **比對**：按住「按住看原圖」可以對照原圖。
- 手機和電腦都能用（Chrome、Edge、Safari、Firefox）。

第一次使用時會下載模型（高品質約 88 MB，快速約 44 MB），之後由瀏覽器快取。

## 使用方式

### 方法一：GitHub Pages（推薦，手機電腦都能直接開）

1. 到倉庫的 **Settings → Pages**
2. Source 選 **Deploy from a branch**，Branch 選 `main`，資料夾選 `/ (root)`，按 Save
3. 等一兩分鐘後打開 `https://knucklesssss.github.io/my-app/`

### 方法二：在自己電腦上執行

需要先安裝 [Node.js](https://nodejs.org/)。

```bash
git clone https://github.com/Knucklesssss/my-app.git
cd my-app
npm run serve
```

然後用瀏覽器打開 <http://localhost:8080>。

> 直接雙擊 `index.html` 打不開，瀏覽器不允許這樣載入模組，所以要用上面的方式開。

## 修改程式

原始碼在 `src/main.js`，改完後重新打包成 `app.js`：

```bash
npm install
npm run build
```

## 授權

去背模型與函式庫來自 [@imgly/background-removal](https://github.com/imgly/background-removal-js)，採用 AGPL-3.0 授權，因此本專案也使用 AGPL-3.0。個人使用沒有問題；若要用在商業的閉源產品中，請先閱讀 IMG.LY 的授權條款。
