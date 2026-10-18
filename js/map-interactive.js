// =========================================================================
// GESAT FlatGeobuf & Planetary Computer + STAC
// Interactive functions (dedicated panel window & logic): インタラクティブ機能（専用パネルウィンドウ ＆ ロジック） 
// 2026/9/22 Separate from layer-control.js
// 2026/9/25 Change GET request to POST requeset using by local Django
// =========================================================================
window.selectedMunicipios = []; 

(function prepareFgbModule() {
  let isSelectMode = false;
  let fgbGeojsonLayer = null;
  const allMunicipiosData = [];

  // [Color Definition] Set to a somewhat conspicuous color for verification purposes (unselected items appear in a distinct orange).
  //【カラー定義】検証用に少し目立つ色（未選択はハッキリしたオレンジ）に設定しています
  const STYLES = {
    hidden: { color: "#ff3b30", weight: 0, fillOpacity: 0, opacity: 0, interactive: true }, 
    baseModeOn: { color: "#ff6d00", weight: 2.0, fillColor: "#ff6d00", fillOpacity: 0.1, opacity: 0.8, interactive: true }, 
    selected: { color: "#00e676", weight: 3.5, fillColor: "#00e676", fillOpacity: 0.5, opacity: 1.0, interactive: true }  
  };

  // Defined as a global initialization control function so that it can be called from map-main.js.
  // map-main.js から呼び出せるように初期化コントロール関数としてグローバル定義
  window.addGesatInteractiveControl = function(map) {
  console.log("[GESAT FGB] Creating Interactive Control Panel...");

  // Define the second control panel.
  // 2つ目のコントロールパネルを定義
  // Location setting. "Topright":  Below the layer controls.  "Bottomright" or "Topleft" are available. 
  // 配置場所。レイヤ管理の下に並べたい場合は"topright"、別荘にしたい場合は"bottomright"や"topleft"など自由に調整可能です
  const interactiveControl = L.control({
    position: "topright" 
  });

  interactiveControl.onAdd = function() {
  // To ensure visual consistency, the class name "gesat-control"—the same as that used for layer management—is employed.
  // 見た目の統一感を出すため、レイヤ管理と同じクラス名「gesat-control」を使用
  const container = L.DomUtil.create("div", "gesat-control gesat-interactive-panel");
      
  L.DomEvent.disableClickPropagation(container);
  L.DomEvent.disableScrollPropagation(container);
  L.DomEvent.on(container, 'click dblclick keydown keypress', L.DomEvent.stopPropagation);
      
  // 2026/9/22 updated: 
  // Added a style to allow the dropdown to extend beyond the panel itself and display it in the foreground.
  // パネル自体からドロップダウンがはみ出るのを許可し、最前面に表示するスタイルを追加
  container.style.pointerEvents = "auto";
  container.style.overflow = "visible"; // 👈 The candidate list will no longer be hidden behind the panel. これにより、候補枠がパネルの下に隠れなくなります
  container.style.position = "relative";

  // 2026/10/18 Updated
  // HTML dedicated to the function window
  // 機能ウィンドウ専用のHTML
  container.innerHTML = `
    <div class="gesat-title-row">
      <div class="gesat-title">Interactive Analysis</div>
      <button id="btn-toggle-interactive-panel" type="button" class="gesat-collapse-button" aria-expanded="true" aria-controls="interactive-panel-content" title="Collapse panel">−</button>
    </div>

    <div id="interactive-panel-content" class="gesat-children gesat-collapsible-content" style="margin-left: 0; padding: 0 4px;">
    
    <div style="display: flex; gap: 4px; margin-bottom: 6px; width: 100%;">
      <button id="btn-select-mode" class="gesat-btn btn-inactive" style="flex: 3; font-size: 11px; padding: 4px 4px; white-space: nowrap;">Select Municipios: OFF</button>
      <button id="btn-clear-selection" class="gesat-btn" style="flex: 1; background-color: #757575; color: white; border: none; padding: 4px 6px; border-radius: 4px; cursor: pointer; font-size: 11px; text-align: center;">Clear</button>
    </div>
          
    <div class="gesat-search-container">
      <input type="text" id="txt-municipio-search" class="gesat-search-input" placeholder="Search Municipality..." autocomplete="off">
      <div id="search-results-dropdown" class="search-dropdown hidden"></div>
    </div>

    <!-- ================================================== -->
    <!-- 2026/10/16 added:                                  -->
    <!-- ================================================== -->
    <div id="selected-area-summary" style="margin-top: 5px; margin-bottom: 7px; padding: 5px 6px; border: 1px solid #ddd; border-radius: 4px; background: #f7f7f7; color: #555; font-size: 9px; line-height: 1.5;">No municipality selected.</div>

    <!-- ================================================== -->
    <!-- 2026/9/22 added: Section on Satellite imagries throug STAC + TiTiler:【新規追加】衛星画像取得（STAC + TiTiler）セクション -->
    <!-- ================================================== -->
    <div style="border-top: 1px solid #ddd; margin-top: 10px; padding-top: 10px;">
      <div style="font-weight: bold; font-size: 11px; margin-bottom: 6px; color: #333;">Satellite Imagery Fetcher</div>
            
      <!-- Select satellite platform: 衛星（プラットフォーム）の種類選択 -->
      <div style="margin-bottom: 6px;">
        <label style="font-size: 10px; display: block; color: #666;">Satellite Platform</label>
        <select id="sel-satellite-type" style="width: 100%; font-size: 11px; padding: 2px;">
          <option value="sentinel-2">Sentinel-2 (Copernicus)</option>
          <option value="landsat">Landsat 8/9 (USGS)</option>
        </select>
      </div>

      <!-- Select image type (RGB, etc.,): 画像タイプ選択（RGB / 各種インデックス） -->
      <div style="margin-bottom: 6px;">
        <label style="font-size: 10px; display: block; color: #666;">Visualization Style</label>
        <select id="sel-img-type" style="width: 100%; font-size: 11px; padding: 2px;">
          <option value="rgb">True Color (RGB)</option>
          <option value="ndvi">NDVI (Vegetation)</option>
          <option value="ndwi">NDWI (Water)</option>
          <option value="ndmi">NDMI (Moisture)</option>
          <option value="savi">SAVI (Solid-Adjusted Vegetation)</option>
          <option value="nbri">NBRI (Burn Ratio)</option>
        </select>
      </div>

      <!-- Set period: 期間設定（年または特定月範囲などの簡易指定） -->
      <div style="margin-bottom: 6px; display: flex; gap: 4px;">
        <div style="flex: 1;">
          <label style="font-size: 10px; display: block; color: #666;">Start Date</label>
          <input type="date" id="date-start" style="width: 100%; font-size: 10px; padding: 2px;">
        </div>
        <div style="flex: 1;">
          <label style="font-size: 10px; display: block; color: #666;">End Date</label>
          <input type="date" id="date-end" style="width: 100%; font-size: 10px; padding: 2px;">
        </div>
      </div>

      <!-- Set Cloud ratio: 雲量制限の設定 -->
      <div style="margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; font-size: 10px; color: #666;">
          <span>Max Cloud Cover</span>
          <span id="lbl-cloud-value">20%</span>
        </div>
        <input type="range" id="sld-cloud-limit" min="0" max="100" value="20" style="width: 100%; margin: 2px 0;">
      </div>

      <!-- Add button of get imagery: 画像取得アクションボタン -->
      <button id="btn-fetch-satellite" class="gesat-btn" style="width: 100%; background-color: #0288d1; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px;">Fetch Satellite Image</button>

      <!-- 2026/10/17 Added a progress indicator for satellite image display: 衛星画像表示の進捗欄を追加-->
      <div id="imagery-fetch-progress" class="imagery-fetch-progress">
        <div id="imagery-fetch-message" class="imagery-fetch-progress-message">Preparing imagery request...</div>
        <div id="imagery-fetch-elapsed" class="imagery-fetch-progress-elapsed">Elapsed: 0 seconds</div>
        <div class="imagery-fetch-progress-track">
          <div id="imagery-fetch-progress-bar" class="imagery-fetch-progress-bar"></div>
        </div>
      </div>

      <!-- Add button of download imagery: 画像取得アクションボタン -->
      <!-- ================================================== -->
      <!-- Raster Export Settings 2026/10/16 added            -->
      <!-- ================================================== -->
      <div style="margin-top: 8px; padding: 7px; border: 1px solid #ddd; border-radius: 4px; background: #fafafa;">
        <div style="margin-bottom: 6px; font-size: 10px; font-weight: bold; color: #333;">Raster Export</div>

        <!-- Export Purpose -->
        <div style="margin-bottom: 6px;">
          <label style="display: block; font-size: 9px; color: #666;">Export Purpose</label>
          <select id="sel-export-purpose" style="width: 100%; padding: 2px; font-size: 10px;">
            <option value="display" selected>Distribution, 8-bit RGB</option>
            <option value="analysis">Analysis, preserve values</option>
          </select>
        </div>

        <!-- Output Resolution -->
        <div style="margin-bottom: 6px;">
          <label style="display: block; font-size: 9px; color: #666;">Output Resolution</label>
          <select id="sel-export-resolution" style="width: 100%; padding: 2px; font-size: 10px;">
            <option value="auto" selected>Recommended / Native</option>
            <option value="10">10 m</option>
            <option value="20">20 m</option>
            <option value="30">30 m</option>
            <option value="60">60 m</option>
          </select>
        </div>

        <!-- Settings note -->
        <div id="export-settings-note" style="margin-bottom: 6px; padding: 5px; border-radius: 3px; background: #eeeeee; color: #555; font-size: 9px; line-height: 1.4;">Distribution RGB is exported as display-optimized 8-bit.</div>

        <!-- Export progress -->
        <div id="raster-export-progress" style="display: none; margin-bottom: 6px; padding: 6px; border: 1px solid #90caf9; border-radius: 4px; background: #e3f2fd;">
          <div id="raster-export-message" style="font-size: 9px; font-weight: bold; color: #0d47a1;">Preparing export...</div>
          <div id="raster-export-elapsed" style="margin-top: 2px; font-size: 8px; color: #546e7a;">Elapsed: 0 seconds</div>
          <div style="height: 4px; margin-top: 5px; overflow: hidden; border-radius: 2px; background: #bbdefb;">
            <div id="raster-export-progress-bar" style="width: 10%; height: 100%; background: #1976d2; transition: width 0.4s ease;"></div>
          </div>
        </div>

        <button id="btn-export-geotiff" type="button" class="gesat-btn" style="width: 100%; padding: 6px; border: none; border-radius: 4px; background: #2e7d32; color: white; font-size: 10px; font-weight: bold; cursor: pointer;">Export GeoTIFF</button>
      </div>

      <!-- Add table of satellite imageries -->
      <div id="mosaic-scenes-panel" style="width: 268px; max-width: 100%; margin-top: 8px; border: 1px solid #ccc; border-radius: 4px; background: #fff; overflow: hidden; box-sizing: border-box;">
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 3px 4px; background: #f3f3f3; border-bottom: 1px solid #ddd;">
          <span id="mosaic-scenes-title" style="font-size: 9px; font-weight: bold; color: #333;">
            Scene Candidates (0)</span>
          <button id="btn-download-scenes" type="button" style="padding: 2px 4px; border: 0; border-radius: 3px; background: #607d8b; color: white; font-size: 8px; cursor: pointer;">
            CSV</button>
        </div>
        
        <div style="width: 100%; max-height: 100px; overflow-y: auto; overflow-x: hidden;">
          <table style="width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8px;">
            <thead style="position: sticky; top: 0; z-index: 1; background: #fafafa;">
              <tr>
                <th style="width: 45%; padding: 2px; text-align: left; border-bottom: 1px solid #ddd;">
                  Scene</th>
                <th style="width: 25%; padding: 2px; text-align: left; border-bottom: 1px solid #ddd;">
                  Date</th>
                <th style="width: 17%; padding: 2px; text-align: right; border-bottom: 1px solid #bbb;">
                  Cloud</th>
                <th style="width: 13%; padding: 2px; text-align: right; border-bottom: 1px solid #bbb;">
                  Tiles</th>
              </tr>
            </thead>
            <tbody id="mosaic-scenes-body">
              <tr>
                <td colspan="4" style="padding: 7px 3px; color: #777; text-align: center;">
                  No scenes</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>         
  </div>
`;

// The process of setting up events for elements within the panel (this must be performed immediately after the HTML is generated).
// パネル内の要素に対してイベントを設定する処理（HTML生成の直後に行う必要があります）
setTimeout(() => {
  setupPanelEvents(map);
}, 10);

return container;
};

interactiveControl.addTo(map);

// Trigger the background process for reading FlatGeobuf data.
// バックグラウンドでのFlatGeobufデータ読み込み処理をキック
initFgbLayer(map);
};

// // Internal function: Register events for buttons and search boxes within the panel
// 内部関数: パネル内のボタンや検索窓のイベント登録
function setupPanelEvents(map) {
  const btnSelectMode = document.getElementById("btn-select-mode");
  const txtSearch = document.getElementById("txt-municipio-search");
  const dropdown = document.getElementById("search-results-dropdown");
  const btnClearSelection = document.getElementById("btn-clear-selection");

  // Retrieving UI elements for parameters
  // パラメータ用UI要素の取得
  const sldCloud = document.getElementById("sld-cloud-limit");
  const lblCloud = document.getElementById("lbl-cloud-value");
  const btnFetchSatellite = document.getElementById("btn-fetch-satellite");
  // 2026/10/18 Added
  const btnToggleInteractivePanel = document.getElementById("btn-toggle-interactive-panel");
  const interactivePanelContent = document.getElementById("interactive-panel-content");
  const imageryFetchProgress = document.getElementById("imagery-fetch-progress");
  const imageryFetchMessage = document.getElementById("imagery-fetch-message");
  const imageryFetchElapsed = document.getElementById("imagery-fetch-elapsed");
  const imageryFetchProgressBar = document.getElementById("imagery-fetch-progress-bar");
  
  const btnExportGeoTiff = document.getElementById("btn-export-geotiff");

  // 2026/10/16 added.
  const exportPurposeElement = document.getElementById("sel-export-purpose");
  const exportResolutionElement = document.getElementById("sel-export-resolution");
  const exportSettingsNote = document.getElementById("export-settings-note");
  const exportProgressPanel = document.getElementById("raster-export-progress");
  const exportProgressMessage = document.getElementById("raster-export-message");
  const exportElapsedElement = document.getElementById("raster-export-elapsed");
  const exportProgressBar = document.getElementById("raster-export-progress-bar");
  
  // For table list of satellite imageries
  const mosaicScenesTitle = document.getElementById("mosaic-scenes-title");
  const mosaicScenesBody = document.getElementById("mosaic-scenes-body");
  const btnDownloadScenes = document.getElementById("btn-download-scenes");

  // 2026/10/16 Added.
  const selectedAreaSummary = document.getElementById("selected-area-summary");

  if (!btnSelectMode || !txtSearch || !dropdown || !btnClearSelection) {
    console.error("[GESAT FGB] UI Elements missing inside interactive panel!");
    return;
  }

  // 2026/10/18 Added Interactive Analysis collapse event
  if (btnToggleInteractivePanel && interactivePanelContent) {
    btnToggleInteractivePanel.addEventListener("click", function(event) {
      L.DomEvent.stopPropagation(event);
      const collapsed = interactivePanelContent.classList.toggle("is-collapsed");
      const panelContainer = btnToggleInteractivePanel.closest(".gesat-control");
      if (panelContainer) {
        panelContainer.classList.toggle("is-collapsed", collapsed);
      }

      btnToggleInteractivePanel.textContent = collapsed ? "+" : "−";
      btnToggleInteractivePanel.setAttribute("aria-expanded", String(!collapsed));
      btnToggleInteractivePanel.title = collapsed ? "Expand panel" : "Collapse panel";
    });
  }

  // 2026/10/18 Automatically set the date from January 1st of the current year to today.
  const startDateElement = document.getElementById("date-start");
  const endDateElement = document.getElementById("date-end");

  function formatLocalDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return (`${year}-${month}-${day}`);
  }
  
  function setDefaultSatelliteDates() {
    if (!startDateElement || !endDateElement) {
      return;
    }
    const today = new Date();
    const firstDayOfCurrentYear = new Date(today.getFullYear(), 0, 1);
    const todayText = formatLocalDateForInput(today);
    const firstDayText = formatLocalDateForInput(firstDayOfCurrentYear);
    
    /*
     * 既にユーザーが値を入力している場合は、
     * パネル再初期化時に上書きしない。
     */
    if (!startDateElement.value) {
      startDateElement.value = firstDayText;
    }
    if (!endDateElement.value) {
      endDateElement.value = todayText;
    }

    /*
     * 終了日に未来日が入力されないようにする。
     */
    startDateElement.max = todayText;
    endDateElement.max = todayText;
  }
  
  setDefaultSatelliteDates();
    
  // ★ Event to synchronize the cloud cover slider value with the label in real-time
  // ★ 雲量スライダーの数値をリアルタイムにラベルへ連動させるイベント
  if (sldCloud && lblCloud) {
    sldCloud.addEventListener("input", function() {
      lblCloud.textContent = sldCloud.value + "%";
    });
  }

  // ================================================================
  // 2026/10/16 Added.
  // Export Settings UI
  // 画像タイプに応じて用途メニューを制御
  // ================================================================
  function updateExportSettingsUi() {
    if (!exportPurposeElement || !exportSettingsNote) {
      return;
    }

    const imageTypeElement = document.getElementById("sel-img-type");
    const imageType = imageTypeElement ? imageTypeElement.value : "rgb";

    // RGB以外は現段階では解析用に固定
    if (imageType !== "rgb") {
      exportPurposeElement.value = "analysis";
      exportPurposeElement.disabled = true;
      exportSettingsNote.textContent = "Index images are exported as " + "analysis-ready Float32 GeoTIFF.";
      return;
    }

    // RGBに戻した場合は用途選択を有効化
    exportPurposeElement.disabled = false;

    if (exportPurposeElement.value === "display") {
      exportSettingsNote.textContent = "Distribution RGB is converted to " + "display-optimized 8-bit.";
    } else {
      exportSettingsNote.textContent = "Analysis RGB preserves the original " + "source pixel values.";
    }
  }

  // 用途を変更したとき
  if (exportPurposeElement) {
    exportPurposeElement.addEventListener("change", updateExportSettingsUi);
  }

  // RGB、NDVIなどの画像タイプを変更したとき
  const exportImageTypeElement = document.getElementById("sel-img-type");
  if (exportImageTypeElement) {
    exportImageTypeElement.addEventListener("change", updateExportSettingsUi);
  }

  // パネル生成時の初期表示を設定
  updateExportSettingsUi();
  
  // A variable that holds the satellite image layer currently displayed on the map (to prevent duplication).
  // 💡 現在マップ上に表示している衛星画像レイヤーを保持する変数（重複防止用）
  let currentSatelliteLayer = null;
  
  // Scene actually used for the mosaic display
  // 実際にモザイク表示へ使用されたシーン
  let usedMosaicScenes = new Map();
  
  // Prevent duplicate requests for the same tile coordinates
  // 同じタイル座標への重複照会を防止
  let inspectedMosaicTiles = new Set();

  // =====================================================================
  // Satellite image acquisition: 衛星画像取得
  // BBox Search + Planetary Computer Mosaic + BBox Clipping Version
  // BBox検索 + Planetary Computer Mosaic + BBoxクリッピング版
  // =====================================================================
  if (btnFetchSatellite) {
    // Current clipping update function
    // 現在のクリッピング更新関数
    let currentClipUpdateHandler = null;

    // -------------------------------------------------------------------
    // Get the BBox encompassing all selected Municipios.
    // 選択中の全Municipioを包含するBBoxを取得
    // -------------------------------------------------------------------
    function getSelectedMunicipioBbox() {
      if (!window.selectedMunicipios || window.selectedMunicipios.length === 0) {
        throw new Error("No municipality has been selected.");
      }

      const features = window.selectedMunicipios.map(
        function(selectedItem) {
          // Standard GeoJSON Feature: 通常のGeoJSON Feature
          if (selectedItem && selectedItem.type === "Feature" && selectedItem.geometry) {
            return selectedItem;
          }
          // A feature stored in a Leaflet layer.: Leaflet Layerなどに格納されたFeature
          if (selectedItem && selectedItem.feature && selectedItem.feature.type === "Feature" && selectedItem.feature.geometry) {
            return selectedItem.feature;
          }
          // When it contains only geometry: geometryだけを持つ場合
          if (selectedItem && selectedItem.geometry) {
            return {
              type: "Feature",
              properties: selectedItem.properties || {},
              geometry: selectedItem.geometry
            };
          }

          throw new Error("The selected Municipio does not have a valid GeoJSON geometry.");
        }
      );

      const featureCollection = {
        type: "FeatureCollection",
        features: features
      };
      const temporaryLayer = L.geoJSON(featureCollection);
      const bounds = temporaryLayer.getBounds();
      
      if (!bounds.isValid()) {
        throw new Error("Could not calculate the BBox from the selected Municipio.");
      }
      
      const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
      
      return {
        bbox: bbox,
        leafletBounds: L.latLngBounds([bbox[1], bbox[0]], [bbox[3], bbox[2]])
      };
    }
  
    // 2026/10/16 Added
    function calculateGeodesicDistanceMeters(latitude1, longitude1, latitude2, longitude2) {
      const earthRadiusMeters = 6371008.8;
      const degreesToRadians = Math.PI / 180;
      const phi1 = latitude1 * degreesToRadians;
      const phi2 = latitude2 * degreesToRadians;
      const deltaPhi = (latitude2 - latitude1) * degreesToRadians;
      const deltaLambda = (longitude2 - longitude1) * degreesToRadians;
      const haversineValue = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
      const angularDistance = 2 * Math.atan2(Math.sqrt(haversineValue), Math.sqrt(1 - haversineValue));
      
      return (earthRadiusMeters * angularDistance);
    }

    function updateSelectedAreaSummary() {
      if (!selectedAreaSummary) {
        return;
      }
      
      if (!window.selectedMunicipios || window.selectedMunicipios.length === 0) {
        selectedAreaSummary.textContent = "No municipality selected.";
        return;
      }
      
      try {
        const selectedExtent = getSelectedMunicipioBbox();
        const bbox = selectedExtent.bbox;
        const west = bbox[0];
        const south = bbox[1];
        const east = bbox[2];
        const north = bbox[3];
        const centerLatitude = (south + north) / 2;
        const centerLongitude = (west + east) / 2;
        const widthMeters = calculateGeodesicDistanceMeters(centerLatitude, west, centerLatitude, east);
        const heightMeters = calculateGeodesicDistanceMeters(south, centerLongitude, north, centerLongitude);
        const widthKilometers = widthMeters / 1000;
        const heightKilometers = heightMeters / 1000;
        const bboxAreaSquareKilometers = (widthMeters * heightMeters) / 1000000;
        
        selectedAreaSummary.innerHTML =
          `<strong>Selected:</strong> `
          + `${window.selectedMunicipios.length} `
          + `municipio(s)<br>`
          + `<strong>BBox:</strong> `
          + `${widthKilometers.toFixed(1)} × `
          + `${heightKilometers.toFixed(1)} km<br>`
          + `<strong>BBox area:</strong> `
          + `${bboxAreaSquareKilometers.toLocaleString(undefined, {
            maximumFractionDigits: 0
          }
        )} km²`;

      } catch (error) {
        console.error("[Selected Area Summary Error]", error);
        selectedAreaSummary.textContent = "Could not calculate the selected area.";
      }
    }

    // initFgbLayer()からも呼び出せるように公開
    window.updateSelectedAreaSummary = updateSelectedAreaSummary;
    
    // 2026/10/16 Added.
    updateSelectedAreaSummary();
    
    // -------------------------------------------------------------------
    // Clip the TileLayer on screen to the BBox.
    // BBoxに合わせてTileLayerを画面上でクリップ
    //
    // Relying solely on Leaflet's bounds may result in the display of tiles that intersect the BBox (bounding box), 
    // including portions that extend outside the BBox's range.
    // Leafletのboundsだけでは、BBoxと交差する端のタイルがBBox外へ
    // はみ出して表示されることがあります。
    //
    // Use `clip-path` to visually clip the element to a rectangular area.
    // clip-pathを使って、表示上も矩形範囲へ切り抜きます。
    // -------------------------------------------------------------------
    
    function applyBboxClipToLayer(map, tileLayer, leafletBounds) {
      // Release the previously registered event
      // 前回登録したイベントを解除
      if (currentClipUpdateHandler) {
        map.off("move zoom viewreset resize", currentClipUpdateHandler);
        currentClipUpdateHandler = null;
      }
      
      function updateClip() {
        if (!tileLayer || !map.hasLayer(tileLayer)) {
          return;
        }
        const container = tileLayer.getContainer();
        if (!container) {
          return;
        }
        const mapSize = map.getSize();
        const northwest = map.latLngToContainerPoint(leafletBounds.getNorthWest());
        const southeast = map.latLngToContainerPoint(leafletBounds.getSouthEast());
        const left = Math.max(0, Math.min(mapSize.x, northwest.x));
        const top = Math.max(0, Math.min(mapSize.y, northwest.y));
        const right = Math.max(0,Math.min(mapSize.x, southeast.x));
        const bottom = Math.max(0, Math.min(mapSize.y, southeast.y));
        const insetTop = Math.max(0, top);
        const insetRight = Math.max(0, mapSize.x - right);
        const insetBottom = Math.max(0, mapSize.y - bottom);
        const insetLeft = Math.max(0, left);
        
        container.style.clipPath = `inset(${insetTop}px ` + `${insetRight}px ` + `${insetBottom}px ` + `${insetLeft}px)`;
        container.style.webkitClipPath = container.style.clipPath;
      }
      
      currentClipUpdateHandler = updateClip;
      map.on("move zoom viewreset resize", currentClipUpdateHandler);
      tileLayer.on("load", updateClip);
      
      requestAnimationFrame(updateClip);
    }
        
    
    // -------------------------------------------------------------------
    // Get the searchid from the mosaic registration response.
    // モザイク登録レスポンスからsearchidを取得
    // -------------------------------------------------------------------
    function getMosaicSearchId(
      registrationResult
    ) {
      if (!registrationResult) {
        return null;
      }
      return (registrationResult.searchid || registrationResult.search_id || registrationResult.id || null);
    }
    
    // -------------------------------------------------------------------
    // Get the TileJSON link from the mosaic registration response.
    // モザイク登録レスポンスからTileJSONリンクを取得
    // -------------------------------------------------------------------
    function getMosaicTileJsonLink(registrationResult) {
      if (!registrationResult || !Array.isArray(registrationResult.links)) {
        return null;
      }
      const tileJsonLink = registrationResult.links.find(function(link) {
        return link.rel === "tilejson";
        }
      );
      return tileJsonLink ? tileJsonLink.href : null;
    }

    // -------------------------------------------------------------------
    // Recursively extract STAC Item information from the mosaic's assets response
    // モザイクのassetsレスポンスからSTAC Item情報を再帰的に抽出
    // -------------------------------------------------------------------
    function extractSceneRecords(value, records, collectionId) {
      if (value === null || value === undefined) {
        return;
      }

      // ---------------------------------------------------------------
      // 文字列として返されたシーンID
      // ---------------------------------------------------------------
      if (typeof value === "string") {
        const text = value.trim();
        const looksLikeSceneId = /^S2[A-Z0-9_]+$/i.test(text) || /^LC0[89]_[A-Z0-9_]+$/i.test(text) || /^LE0[0-9]_[A-Z0-9_]+$/i.test(text) || /^LT0[0-9]_[A-Z0-9_]+$/i.test(text);
        if (looksLikeSceneId) {
          const sceneKey = `${collectionId}:${text}`;
          if (!records.has(sceneKey)) {
            records.set(sceneKey, {
              id: text,
              collection: collectionId,
              datetime: null,
              cloudCover: null,
              tileCount: 0,
              tileCoordinates: new Set()
            });
          }
        }
        return;
      }

      if (typeof value === "number" || typeof value === "boolean") {
        return;
      }
      
      if (Array.isArray(value)) {
        value.forEach(function(item) {
          extractSceneRecords(item, records, collectionId);
        });
        return;
      }

      if (typeof value !== "object") {
        return;
      }

      // ---------------------------------------------------------------
      // オブジェクトとして返されたシーン情報
      // Check multiple candidate fields to ensure a certain level of adaptability should the Planetary Computer's response format change.
      // Planetary Computerのレスポンス形式が変わってもある程度対応できるよう、複数の候補フィールドを確認。
      // ---------------------------------------------------------------
      const sceneId = value.id || value.item || value.item_id || value.itemId || value.scene || value.scene_id || value.sceneId || null;
      const sceneCollection = value.collection || value.collection_id || value.collectionId || collectionId;

      if (sceneId) {
        const sceneIdText = String(sceneId);
        const looksLikeScene =
          sceneIdText.startsWith("S2") ||
          sceneIdText.startsWith("LC") ||
          sceneIdText.startsWith("LE") ||
          sceneIdText.startsWith("LT") ||
          Boolean(value.properties) ||
          Boolean(value.datetime) ||
          Boolean(value.assets) ||
          Boolean(value.item) ||
          Boolean(value.item_id) ||
          Boolean(value.itemId);
        if (looksLikeScene) {
          const properties = value.properties || {};
          const datetime = properties.datetime || value.datetime || null;
          const cloudCover = properties["eo:cloud_cover"] ?? value["eo:cloud_cover"] ?? value.cloud_cover ?? null;
          const sceneKey = `${sceneCollection}:${sceneIdText}`;
          if (!records.has(sceneKey)) {
            records.set(sceneKey, {
              id: sceneIdText,
              collection: sceneCollection,
              datetime: datetime,
              cloudCover: cloudCover,
              tileCount: 0,
              tileCoordinates: new Set()
            });
          }
        }
      }

      // ---------------------------------------------------------------
      // シーンIDがオブジェクトのキーとして返される場合
      // Object.values()だけではキーを取得できないため、
      // Object.entries()でキーと値の両方を調査する
      // ---------------------------------------------------------------
      Object.entries(value).forEach(
        function(entry) {
          const key = entry[0];
          const childValue = entry[1];
          extractSceneRecords(key, records, collectionId);
          extractSceneRecords(childValue, records, collectionId);
        }
      );
    }

    // -------------------------------------------------------------------
    // Web Mercator XYZタイルの範囲を緯度経度BBoxへ変換
    // -------------------------------------------------------------------
    function tileCoordsToLatLngBounds(coords) {
      const z = coords.z;
      const x = coords.x;
      const y = coords.y;
      const n = Math.pow(2, z);
      const west = x / n * 360 - 180;
      const east = (x + 1) / n * 360 - 180;
      
      function tileYToLatitude(tileY) {
        const mercatorY = Math.PI * (1 - 2 * tileY / n);
        return (180 / Math.PI * Math.atan(Math.sinh(mercatorY)));
      }
      const north = tileYToLatitude(y);
      const south = tileYToLatitude(y + 1);
      return L.latLngBounds([south, west], [north, east]);
    }

    // -------------------------------------------------------------------
    // STAC ItemのBBoxをLeaflet Boundsへ変換
    // -------------------------------------------------------------------
    function getStacItemBounds(item) {
      if (!item || !Array.isArray(item.bbox) || item.bbox.length < 4) {
        return null;
      }
      const bbox = item.bbox;
      return L.latLngBounds([bbox[1], bbox[0]], [bbox[3], bbox[2]]);
    }

    // -------------------------------------------------------------------
    // 表示タイルとSTAC Itemの空間交差から使用候補シーンを記録
    //
    // Planetary Computerのmosaic /assets APIが422を返すため、
    // STAC検索結果と表示タイル範囲を使って候補を判定する。
    // -------------------------------------------------------------------
    async function inspectMosaicTileScenes({
      searchId,
      collectionId,
      coords
    }) {
      if (!collectionId || !coords) {
        return;
      }
      
      const tileKey =  `${coords.z}/${coords.x}/${coords.y}`;
      if (inspectedMosaicTiles.has(tileKey)) {
        return;
      }
      
      inspectedMosaicTiles.add(tileKey);
      const tileBounds = tileCoordsToLatLngBounds(coords);
      const stacItems = Array.isArray(window.debugStacItems) ? window.debugStacItems : [];
      
      if (stacItems.length === 0) {
        console.warn("[Mosaic Scene Inspection] " + "No STAC preview items are available.");
        return;
      }
      
      // この表示タイルと空間的に交差するシーン
      const intersectingItems = stacItems.filter(function(item) {
        const itemBounds = getStacItemBounds(item);
        return (itemBounds && itemBounds.intersects(tileBounds));
      });
      
      if (intersectingItems.length === 0) {
        console.debug("[Mosaic Scene Inspection] " + "No STAC scene intersects tile:", tileKey);
        return;
      }
      
      /*
       * モザイク登録時と同じ優先順位で並べ替える。
       *
       * 1. 雲量の少ない順
       * 2. 同程度なら新しい順
       */
      intersectingItems.sort(function(itemA, itemB) {
        const cloudA = Number(itemA.properties?.["eo:cloud_cover"]);
        const cloudB = Number(itemB.properties?.["eo:cloud_cover"]);
        const normalizedCloudA = Number.isFinite(cloudA) ? cloudA : Number.POSITIVE_INFINITY;
        const normalizedCloudB = Number.isFinite(cloudB) ? cloudB : Number.POSITIVE_INFINITY;
        
        // 雲量が異なる場合は、雲量の少ないシーンを優先
        if (normalizedCloudA !== normalizedCloudB) {
          return (normalizedCloudA - normalizedCloudB);
        }

        // 雲量が同じ場合は、新しい撮影日時を優先
        const dateA = itemA.properties?.datetime || "";
        const dateB = itemB.properties?.datetime || "";
        
        // 新しい日付を先にする
        return dateB.localeCompare(dateA);
      });
      
      /*
       * モザイクの最優先候補を、この表示タイルで
       * 使用された候補シーンとして記録する。
       */
      const selectedItem = intersectingItems[0];
      if (!selectedItem || !selectedItem.id) {
        return;
      }
      
      const properties = selectedItem.properties || {};
      const sceneKey = `${collectionId}:${selectedItem.id}`;
      if (!usedMosaicScenes.has(sceneKey)) {
        usedMosaicScenes.set(sceneKey, {
          id: selectedItem.id,
          collection: collectionId,
          datetime: properties.datetime || null,
          cloudCover: properties["eo:cloud_cover"] ?? null,
          tileCount: 0,
          tileCoordinates: new Set()
        });
      }
      
      const savedScene = usedMosaicScenes.get(sceneKey);
      if (!savedScene.tileCoordinates.has(tileKey)) {
        savedScene.tileCoordinates.add(tileKey);
        savedScene.tileCount += 1;
      }
      
      console.log("[Mosaic Tile Scene Candidate]", {
        tile: tileKey,
        selectedScene: selectedItem.id,
        datetime: properties.datetime || null,
        cloudCover: properties["eo:cloud_cover"] ?? null,
        intersectingSceneCount: intersectingItems.length,
        searchId: searchId
      });
      
      printUsedMosaicScenes();
    }
      
    // -------------------------------------------------------------------
    // 使用シーン一覧をConsoleへ表示
    // -------------------------------------------------------------------
    function getUsedMosaicSceneArray() {
      return Array.from(
        usedMosaicScenes.values()
      )
        .map(function(scene) {
          const stacItem = window.debugStacItemLookup instanceof Map ? window.debugStacItemLookup.get(scene.id) : null;
          const properties = stacItem && stacItem.properties ? stacItem.properties: {};
          const datetime = scene.datetime || properties.datetime || null;
          const cloudCover = scene.cloudCover ?? properties["eo:cloud_cover"] ?? null;
          return {
            sceneId: scene.id,
            collection: scene.collection,
            datetime: datetime,
            date: datetime ? datetime.slice(0, 10) : null,
            cloudCover: cloudCover,
            renderedTileCount: scene.tileCount,
            renderedTiles: Array.from(scene.tileCoordinates).join(", ")
          };
        })
        .sort(function(a, b) {
          return (a.datetime || "").localeCompare(b.datetime || "");
        });
    }

    // -------------------------------------------------------------------
    // パネル内の使用シーン一覧を更新
    // -------------------------------------------------------------------
    function renderUsedMosaicScenesTable() {
      if (!mosaicScenesTitle || !mosaicScenesBody) {
        return;
      }
      
      const sceneList = getUsedMosaicSceneArray();
      mosaicScenesTitle.textContent = `Visible Scene Candidates (${sceneList.length})`;
      mosaicScenesBody.innerHTML = "";
      
      // ---------------------------------------------------------------
      // シーンがまだ取得されていない場合
      // ---------------------------------------------------------------
      if (sceneList.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 4;
        cell.textContent = "No scenes";
        cell.style.padding = "8px 4px";
        cell.style.textAlign = "center";
        cell.style.color = "#777";
        row.appendChild(cell);
        mosaicScenesBody.appendChild(row);
        return;
      }

      // ---------------------------------------------------------------
      // シーン一覧を行として追加
      // ---------------------------------------------------------------
      sceneList.forEach(function(scene) {
        const row = document.createElement("tr");
        const sceneCell = document.createElement("td");
        const dateCell = document.createElement("td");
        const cloudCell = document.createElement("td");
        const tilesCell = document.createElement("td");
        // -------------------------------------------------------------
        // Scene ID
        // -------------------------------------------------------------
        //sceneCell.textContent = scene.sceneId || "-";
        function getShortSceneId(sceneId) {
          if (!sceneId) {
            return "-";
          }
          const text = String(sceneId);
          // Sentinel-2 Item ID
          // 日付とMGRSタイル部分を優先して表示
          const sentinelMatch = text.match(/(S2[A-Z]?)_.*?_(\d{8}T\d{6}).*?_(T\d{2}[A-Z]{3})/i);
          if (sentinelMatch) {
            return (`${sentinelMatch[1]} ` + `${sentinelMatch[2].slice(0, 8)} ` + `${sentinelMatch[3]}`);
          }
          // 長いIDの一般的な短縮
          if (text.length > 24) {
            return (text.slice(0, 11) + "..." + text.slice(-9));
          }
          return text;
        }
        sceneCell.textContent = getShortSceneId(scene.sceneId);
        sceneCell.title = scene.sceneId || "";

        sceneCell.style.padding = "3px";
        sceneCell.style.borderBottom = "1px solid #eee";
        sceneCell.style.whiteSpace = "nowrap";
        sceneCell.style.overflow = "hidden";
        sceneCell.style.textOverflow = "ellipsis";
        // -------------------------------------------------------------
        // Date
        // -------------------------------------------------------------
        dateCell.textContent = scene.date ? scene.date.slice(2) : "-";
        dateCell.title = scene.datetime || scene.date || "";
        dateCell.style.padding = "3px";
        dateCell.style.borderBottom = "1px solid #eee";
        dateCell.style.whiteSpace = "nowrap";
        // -------------------------------------------------------------
        // Cloud cover
        // -------------------------------------------------------------
        const cloudCoverNumber = Number(scene.cloudCover);
        const hasCloudCover = scene.cloudCover !== null && scene.cloudCover !== undefined && scene.cloudCover !== "" && Number.isFinite(cloudCoverNumber);
        cloudCell.textContent = hasCloudCover ? `${cloudCoverNumber.toFixed(1)}%` : "-";
        cloudCell.title = hasCloudCover ? `Cloud cover: ${cloudCoverNumber}%` : "Cloud cover unavailable";
        cloudCell.style.padding = "3px";
        cloudCell.style.borderBottom = "1px solid #eee";
        cloudCell.style.textAlign = "right";
        cloudCell.style.whiteSpace = "nowrap";
        // -------------------------------------------------------------
        // Rendered tile count
        // -------------------------------------------------------------
        const renderedTileCount = Number.isFinite(Number(scene.renderedTileCount)) ? Number(scene.renderedTileCount) : 0;
        tilesCell.textContent = String(renderedTileCount);
        tilesCell.title = scene.renderedTiles ? `Tiles:\n${scene.renderedTiles}` : "No tile coordinates";
        tilesCell.style.padding = "3px";
        tilesCell.style.borderBottom = "1px solid #eee";
        tilesCell.style.textAlign = "right";
        tilesCell.style.whiteSpace = "nowrap";
        // -------------------------------------------------------------
        // 行へ追加
        // -------------------------------------------------------------
        row.appendChild(sceneCell);
        row.appendChild(dateCell);
        row.appendChild(cloudCell);
        row.appendChild(tilesCell);
        mosaicScenesBody.appendChild(row);
      });
    }
    
    function printUsedMosaicScenes() {
      const sceneList = getUsedMosaicSceneArray();
      window.debugUsedMosaicScenes = sceneList;
      // パネル内テーブルを更新
      renderUsedMosaicScenesTable();
      // Consoleにも表示
      if (sceneList.length > 0) {
        console.groupCollapsed(`[Mosaic Used Scenes] ` + `${sceneList.length} scene(s)`);
        console.table(sceneList);
        console.groupEnd();
      } else {
        console.debug("[Mosaic Used Scenes] " + "No scene IDs were extracted.");
      }
    }
    
    // -------------------------------------------------------------------
    // 使用シーン一覧をCSVでダウンロード
    // -------------------------------------------------------------------
    function downloadUsedMosaicScenesCsv() {
      const sceneList = getUsedMosaicSceneArray();
      if (sceneList.length === 0) {
        alert("使用シーンの記録がありません。\n" + "モザイク画像を表示してから実行してください。");
        return;
      }
      const csvRows = [
        [
          "scene_id",
          "collection",
          "datetime",
          "date",
          "cloud_cover_percent",
          "rendered_tile_count",
          "rendered_tiles"
        ]
      ];
      
      sceneList.forEach(function(scene) {
        // 雲量を数値として整形
        const cloudCoverNumber = Number(scene.cloudCover);
        const hasCloudCover = scene.cloudCover !== null && scene.cloudCover !== undefined && scene.cloudCover !== "" && Number.isFinite(cloudCoverNumber);
        const cloudCoverForCsv = hasCloudCover ? cloudCoverNumber.toFixed(2) : "";
        // タイル数を数値として整形
        const renderedTileCountNumber = Number(scene.renderedTileCount);
        const renderedTileCountForCsv = Number.isFinite(renderedTileCountNumber) ? renderedTileCountNumber : 0;
        
        csvRows.push([
          scene.sceneId || "",
          scene.collection || "",
          scene.datetime || "",
          scene.date || "",
          cloudCoverForCsv,
          renderedTileCountForCsv,
          scene.renderedTiles || ""
        ]);
      });

      // CSV値をダブルクォーテーションで囲み、
      // 値内のダブルクォーテーションをエスケープ
      function escapeCsvValue(value) {
        const text = String(value ?? "");
        return `"${text.replace(/"/g, '""')}"`;
      }
      
      // Excelで文字化けしにくいようUTF-8 BOMを付加
      const csvText = "\uFEFF" + csvRows
        .map(function(row) {
          return row
            .map(escapeCsvValue)
            .join(",");
        })
        .join("\r\n");
      
      const blob =
        new Blob(
          [csvText],
          {
            type: "text/csv;charset=utf-8"
          }
        );
      
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, "-");
      link.href = blobUrl;
      link.download = `gesat-mosaic-scenes-candidates-${timestamp}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setTimeout(function() {
        URL.revokeObjectURL(blobUrl);
      }, 1000);
    }
    
    // Consoleから実行できるように公開
    window.downloadUsedMosaicScenesCsv = downloadUsedMosaicScenesCsv;

    if (btnDownloadScenes) {
      btnDownloadScenes.addEventListener("click", function(event) {
        L.DomEvent.stopPropagation(event);
        downloadUsedMosaicScenesCsv();
      });
    }

    // ===================================================================
    // 2026/10/18 Added
    // Added a function to manage the progress of satellite image acquisition.
    // 衛星画像取得の進捗管理関数を追加
    // ===================================================================
    let imageryFetchTimerId = null;
    let imageryFetchStartedAt = null;
    let imageryFetchPercent = 10;
    
    function setImageryFetchProgress(message, percent) {
      if (imageryFetchMessage) {
        imageryFetchMessage.textContent = message;
      }
      if (Number.isFinite(percent) && imageryFetchProgressBar) {
        imageryFetchPercent = Math.max(0, Math.min(100, percent));
        imageryFetchProgressBar.style.width = `${imageryFetchPercent}%`;
      }
    }
    
    function startImageryFetchProgress() {
      imageryFetchStartedAt = Date.now();
      imageryFetchPercent = 10;
      if (imageryFetchProgress) {
        imageryFetchProgress.classList.add("is-visible");
      }
      if (imageryFetchElapsed) {
        imageryFetchElapsed.textContent = "Elapsed: 0 seconds";
      }
      if (imageryFetchProgressBar) {
        imageryFetchProgressBar.style.width = "10%";
        imageryFetchProgressBar.style.background = "#0288d1";
      }
      
      setImageryFetchProgress("Preparing imagery request...", 10);
      if (imageryFetchTimerId) {
        clearInterval(imageryFetchTimerId);
      }
      imageryFetchTimerId = setInterval(
        function() {
          if (!imageryFetchStartedAt) {
            return;
          }
          const elapsedSeconds = Math.floor((Date.now() - imageryFetchStartedAt) / 1000);
          if (imageryFetchElapsed) {
            imageryFetchElapsed.textContent = `Elapsed: ${elapsedSeconds} seconds`;
          }
          
          /*
          * 実際のサーバー進捗率ではないため、
          * 自動増加は最大90%までにする。
          */
          if (imageryFetchProgressBar && imageryFetchPercent < 90) {
            imageryFetchPercent = Math.min(90, imageryFetchPercent + 1);
            imageryFetchProgressBar.style.width = `${imageryFetchPercent}%`;
          }
        },
        1000);
    }
    
    function finishImageryFetchProgress(succeeded, message) {
      if (imageryFetchTimerId) {
        clearInterval(imageryFetchTimerId);
        imageryFetchTimerId = null;
      }
      const elapsedSeconds = imageryFetchStartedAt ? Math.floor((Date.now() - imageryFetchStartedAt) / 1000) : 0;
      if (imageryFetchMessage) {
        imageryFetchMessage.textContent = message;
      }
      if (imageryFetchElapsed) {
        imageryFetchElapsed.textContent = succeeded ? `Completed in ${elapsedSeconds} seconds` : `Stopped after ${elapsedSeconds} seconds`;
      }
      if (imageryFetchProgressBar) {
        imageryFetchProgressBar.style.width = "100%";
        imageryFetchProgressBar.style.background = succeeded ? "#2e7d32" : "#c62828";
      }
      imageryFetchStartedAt = null;
    }
    
    // ===================================================================
    // Fetch Satellite Image
    // ===================================================================
    btnFetchSatellite.addEventListener("click", async function(e) {
      L.DomEvent.stopPropagation(e);
      
      if (!window.selectedMunicipios || window.selectedMunicipios.length === 0) {
        alert("No municipality has been selected.\n" + "Please select at least one Municipio before proceeding.");
        return;
      }
      
      const satelliteElement = document.getElementById("sel-satellite-type");
      const imageTypeElement = document.getElementById("sel-img-type");
      const startDateElement = document.getElementById("date-start");
      const endDateElement = document.getElementById("date-end");
      
      if (!satelliteElement || !imageTypeElement || !startDateElement || !endDateElement || !sldCloud) {
        alert("Could not get the UI elements for satellite image acquisition.");
        return;
      }
      
      const satellite = satelliteElement.value;
      const imgType = imageTypeElement.value;
      const startDate = startDateElement.value;
      const endDate = endDateElement.value;
      const cloudLimit = Number.parseFloat(sldCloud.value);
      
      if (!startDate || !endDate) {
        alert("Please specify the start date and end date.");
       return;
      }
      
      if (startDate > endDate) {
        alert("Please specify a start date that is on or before the end date.");
        return;
      }
      
      if (!Number.isFinite(cloudLimit)) {
        alert("The cloud cover setting value is invalid.");
        return;
      }

      // 2026/10/18 Updated
      btnFetchSatellite.disabled = true;
      setImageryFetchProgress("Searching the STAC catalog...", 30);
      startImageryFetchProgress();
      let imageryLayerStarted = false;
      let imageryCompleted = false;
      try {
        setImageryFetchProgress("Calculating the selected area...", 15);
      
      try {
        // =============================================================
        // 1. Bounding box encompassing the entire selected municipality
        // 1. 選択Municipio全体を包含するBBox
        // =============================================================
        const selectedExtent = getSelectedMunicipioBbox();
        const bbox = selectedExtent.bbox;
        const leafletBboxBounds = selectedExtent.leafletBounds;
        
        console.log("[Selected Municipio Count]", window.selectedMunicipios.length);
        console.log("[Selected BBox]", bbox);
        
        // =============================================================
        // 2. Collection
        // =============================================================
        const collectionId = satellite === "sentinel-2" ? "sentinel-2-l2a" : "landsat-c2-l2";
        const datetimeRange = `${startDate}T00:00:00Z/` + `${endDate}T23:59:59Z`;

        window.lastMosaicRequest = {
          collectionId,
          bbox,
          datetimeRange,
          imgType,
          cloudLimit
        };
        
        console.log("[Collection]", collectionId);
        console.log("[Datetime]", datetimeRange);
        
        // =============================================================
        // 3. Pre-check for image existence using a STAC search.
        // 3. 画像が存在するかSTAC検索で事前確認
        //
        // Before mosaic registration, clearly determine whether there are zero search results.
        // モザイク登録の前に、検索結果0件を分かりやすく判定する。
        // 2026/9/25 Djangoへ移行
        // =============================================================
        btnFetchSatellite.textContent = "Checking STAC...";
        
        const stacSearchUrl = "https://planetarycomputer.microsoft.com/api/stac/v1/search";
        const stacParams = new URLSearchParams();
        
        stacParams.set("collections", collectionId);
        stacParams.set("bbox", bbox.join(","));
        stacParams.set("datetime", datetimeRange);
        stacParams.set("limit", "100");
        stacParams.set("query", JSON.stringify({
          "eo:cloud_cover": {
            lte: cloudLimit
            }
          })
        );
        
        const finalStacSearchUrl = stacSearchUrl + "?" + stacParams.toString();
        
        console.log("[STAC Preview GET URL]", finalStacSearchUrl);
        
        const stacResponse = await fetch("http://localhost:8001/api/stac/search/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            collections: [collectionId],
            bbox: bbox,
            datetime: datetimeRange,
            limit: 100,
            query: {
              "eo:cloud_cover": {
                lte: cloudLimit
              }
            }
          })
        }
        );
        
        if (!stacResponse.ok) {
          const errorText = await stacResponse.text();
          console.error("[STAC Search Error]", {
            status: stacResponse.status,
            statusText: stacResponse.statusText,
            body: errorText,
            url: finalStacSearchUrl
            }
          );
          throw new Error("STAC search failed." + ` HTTP ${stacResponse.status}`);
        }
        
        const stacResult = await stacResponse.json();
        const previewItems = Array.isArray(stacResult.features) ? stacResult.features : [];
        // 2026/10/18 Added.
        setImageryFetchProgress(`Found ${previewItems.length} scene candidates.`, 45);
        console.log("[STAC Preview Result]", stacResult);
        console.log("[STAC Preview Item Count]", previewItems.length);
        
        if (previewItems.length === 0) {
          throw new Error("No satellite images are found matching the specified period, cloud cover, and bounding box.");
        }
        
        // For debugging
        window.debugStacItems = previewItems;
        
        const previewItemLookup = new Map();
        previewItems.forEach(function(item) {
          previewItemLookup.set(item.id, item);
        });
        
        window.debugStacItemLookup = previewItemLookup;

        // =============================================================
        // 4. Mosaic Search Registration
        // 4. モザイク検索登録
        // 4. Django mosaic_create
        // Get the searchid and create a virtual mosaic from multiple scenes.
        // searchidを取得し、複数シーンを仮想モザイク化する。
        // =============================================================
        setImageryFetchProgress("Registering the virtual mosaic...", 55);
        
        usedMosaicScenes.clear();
        inspectedMosaicTiles.clear();
        window.debugUsedMosaicScenes = [];
        renderUsedMosaicScenesTable();
        
        const mosaicResponse = await fetch("http://localhost:8001/api/mosaic/create/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            collections: [collectionId],
            bbox: bbox,
            datetime: datetimeRange,
            image_type: imgType,
            query: {
              "eo:cloud_cover": {
                lte: cloudLimit
              }
            },
            sortby: [
              {
                field:
                  "properties.eo:cloud_cover",
                direction: "asc"
              },
              {
                field:
                  "properties.datetime",
                direction: "desc"
              }
            ]
          })
        });
        
        if (!mosaicResponse.ok) {
          throw new Error(`Django mosaic_create failed. HTTP ${mosaicResponse.status}`);
        }
  
        const mosaicResult = await mosaicResponse.json();
        // 2026/10/18 Added
        setImageryFetchProgress("Preparing map tiles...", 70);
        console.log("[Django Mosaic Result]", mosaicResult);
        const searchId = mosaicResult.searchId;
        // const mosaicTileUrl = mosaicResult.tileUrl;
        const mosaicTileUrl = mosaicResult.tileUrl.replace(/&amp;/g, "&");
        console.log("[Fixed Mosaic Tile URL]", mosaicTileUrl);
        window.debugMosaicSearchId = searchId;
        window.debugMosaicTileUrl = mosaicTileUrl;
        window.debugStacItems = mosaicResult.stacItems || [];
        console.log("[Search ID]", searchId);
        console.log("[Mosaic Tile URL]",mosaicTileUrl);
        
        console.log("[RAW]", mosaicResult.tileUrl);
        console.log("[FIXED]", mosaicTileUrl);

        // =============================================================
        // 7. Remove old satellite layer
        // 7. 古い衛星レイヤーを削除
        // =============================================================
        if (currentSatelliteLayer && map.hasLayer(currentSatelliteLayer)) {
          map.removeLayer(currentSatelliteLayer);
        }
        currentSatelliteLayer = null;
        
        // Clear the previous clipping event.
        // 前のクリッピングイベントを解除
        if (currentClipUpdateHandler) {
          map.off("move zoom viewreset resize", currentClipUpdateHandler);
          currentClipUpdateHandler = null;
        }
        
        // =============================================================
        // 8. Satellite Image Pane
        // 8. 衛星画像Pane
        // =============================================================
        if (!map.getPane("sentinelPane")) {
          map.createPane("sentinelPane");
          map.getPane("sentinelPane").style.zIndex = "450";
        }
        
        // =============================================================
        // 9. Leaflet Mosaic Layer
        // 9. Leafletモザイクレイヤー
        // =============================================================
        setImageryFetchProgress("Rendering mosaic tiles...", 80);
        imageryLayerStarted = true;
        currentSatelliteLayer = L.tileLayer(mosaicTileUrl,
          {
            pane: "sentinelPane",
            minZoom: 1,
            maxZoom: 22,
            opacity: 1.0,
 
            /*
             * Do not request tiles that do not intersect the BBox.
             * The portions of the edge tiles extending outside the BBox are removed using the subsequent CSS `clip-path`.
             * BBoxと交差しないタイルを要求しない。
             * 端のタイルがBBox外へはみ出す部分は、後段のCSS clip-pathで除去する。
             */
            bounds: leafletBboxBounds,
            noWrap: true,
            keepBuffer: 2,
            updateWhenIdle: false,
            updateWhenZooming: false,
            attribution: "© Microsoft Planetary Computer"
          }
        );
        
        let loadedTileCount = 0;
        let failedTileCount = 0;
        let successMessageShown = false;
        // 2026/10/18 Added
        let imageryCompletionTimerId = null;
        
        currentSatelliteLayer.on("tileload", function(tileEvent) {
          loadedTileCount += 1;
          // 2026/10/18 Added
          setImageryFetchProgress(("Rendering mosaic tiles... " + `${loadedTileCount} tile(s) loaded`), Math.min(95, 82 + loadedTileCount));
          if (loadedTileCount === 1) {
            console.log("[Mosaic First Tile Loaded]", tileEvent.coords);
          }
          
          // 実際にこのタイルで使用されたシーンを取得
          inspectMosaicTileScenes({
            searchId: searchId,
            collectionId: collectionId,
            coords: tileEvent.coords
          });
 
        /*
         * It is considered successful only when at least one actual image tile has been loaded, 
         * not simply when the TileJSON has been retrieved.
         * TileJSON取得だけではなく、
         * 実際の画像タイルが1枚以上読み込まれてから成功と表示する。
         */
          // 2026/10/18 Updated
          if (!successMessageShown) {
            successMessageShown = true;
            imageryCompleted = true;
            btnFetchSatellite.disabled = false;
            btnFetchSatellite.textContent = "Fetch Satellite Image";
            finishImageryFetchProgress(true, "Mosaic image displayed successfully.");
            
            /*
             * 成功欄はしばらく残し、後で自動的に閉じる。
             */
            imageryCompletionTimerId = setTimeout(
              function() {
                if (imageryFetchProgress) {
                  imageryFetchProgress.classList.remove("is-visible");
                }
              },
              5000
            );
            console.log("[Mosaic Display Complete]", {
              platform: satellite,
              imageType: imgType,
              selectedMunicipios: window.selectedMunicipios.length,
              firstLoadedTile: tileEvent.coords
            });
          }
        });
        
        // Edit 2026/9/27
        currentSatelliteLayer.on("tileerror", function(tileEvent) {
          failedTileCount += 1;
          setImageryFetchProgress(("Rendering mosaic tiles... " + `${failedTileCount} tile error(s)`), 90);
          console.error("[Mosaic Tile Error URL]", tileEvent.tile.src);
          console.error("[Mosaic Tile Error]", {
            coords: tileEvent.coords,
            error: tileEvent.error,
            url: tileEvent.tile.src,
            failedTileCount: failedTileCount
          });
          //fetch(tileEvent.tile.src).then(async function(response) {
          //  console.error("[Tile HTTP Status]", response.status, response.statusText);
          //  const text = await response.text();
          //  console.error("[Tile Response Body]", text.slice(0, 1000));
          //})
          //  .catch(function(error) {
          //    console.error("[Tile Fetch Error]", error);
          //  });
        });
        
        currentSatelliteLayer.on("loading", function() {
          console.log("[Mosaic Layer Loading]");
        });
        
        // 2026/10/18 Updated
        currentSatelliteLayer.on("load", function() {
          console.log("[Mosaic Layer Load Complete]", {
            loadedTileCount: loadedTileCount,
            failedTileCount: failedTileCount
          });
        /*
         * tileloadが何らかの理由で先に完了処理を
         * 実行していない場合の予備処理。
         */
        if (!imageryCompleted && loadedTileCount > 0) {
          imageryCompleted = true;
          btnFetchSatellite.disabled = false;
          btnFetchSatellite.textContent = "Fetch Satellite Image";
          finishImageryFetchProgress(true, ("Mosaic image displayed. " + `${loadedTileCount} tile(s) loaded.`));
        }
        });
        
        currentSatelliteLayer.addTo(map);
        
        //一時的？
        const satelliteContainer = currentSatelliteLayer.getContainer();
        if (satelliteContainer) {
          satelliteContainer.style.clipPath = "none";
          satelliteContainer.style.webkitClipPath = "none";
          satelliteContainer.style.display = "";
          satelliteContainer.style.visibility = "visible";
          satelliteContainer.style.opacity = "1";
        }
        
        // =============================================================
        // 10. Crip on-screen tiles using a BBox
        // 10. BBoxで画面上のタイルを切り抜く
        // =============================================================
        // Temporarily disable to verify the display.
        // 一時的に無効化して表示確認
        //applyBboxClipToLayer(map, currentSatelliteLayer, leafletBboxBounds);
        
        // =============================================================
        // 11. Move to BBox
        // 11. BBoxへ移動
        // =============================================================
        map.fitBounds(leafletBboxBounds, { padding: [20, 20], animate: true, duration: 1.2 });

        // =============================================================
        // 12. Recalculate Size
        // 12. サイズ再計算
        // =============================================================
        setTimeout(function() {
          map.invalidateSize();
          if (currentClipUpdateHandler) {
            currentClipUpdateHandler();
          }},
          500
        );
        
        console.log("[Mosaic Rendering Initiated]", {
          bbox: bbox,
          searchId: searchId,
          collection: collectionId,
          satellite: satellite,
          imageType: imgType
        });
        
      } catch (error) {
        console.error("[BBox Mosaic Error]", error);
        finishImageryFetchProgress(false, "Failed to display the mosaic image.");
        alert("An error occurred during BBox mosaic processing.\n\n" + error.message);
      
      // 2026/10/18 Updated
      } finally {
      /*
       * TileLayerの作成前に失敗した場合だけ、ここでボタンを戻す。
       * TileLayer作成後はtileload/loadイベント側で戻す。
       */
        if (!imageryLayerStarted) {
          btnFetchSatellite.disabled = false;
          btnFetchSatellite.textContent = "Fetch Satellite Image";
        }
      }  
    }); // addEventListener終了
  } // ← if(btnFetchSatellite)終了                                       
                                       
  // ================================================================
  // 2026/10/16 Updated.
  // GeoTIFF Export
  // ================================================================
  let rasterExportTimerId = null;
  let rasterExportStartedAt = null;

  function startRasterExportProgress() {
    rasterExportStartedAt = Date.now();

    if (exportProgressPanel) {
      exportProgressPanel.style.display = "block";
    }

    if (exportProgressMessage) {
      exportProgressMessage.textContent = "Preparing export...";
    }

    if (exportElapsedElement) {
      exportElapsedElement.textContent = "Elapsed: 0 seconds";
    }

    if (exportProgressBar) {
      exportProgressBar.style.width = "10%";
      exportProgressBar.style.background = "#1976d2";
    }

    if (rasterExportTimerId) {
      clearInterval(rasterExportTimerId);
    }

    rasterExportTimerId = setInterval(
      function() {
        if (!rasterExportStartedAt) {
          return;
        }

        const elapsedSeconds = Math.floor((Date.now() - rasterExportStartedAt) / 1000);

        if (exportElapsedElement) {
          exportElapsedElement.textContent = `Elapsed: ${elapsedSeconds} seconds`;
        }

        if (exportProgressMessage) {
          if (elapsedSeconds < 5) {
            exportProgressMessage.textContent = "Searching satellite scenes...";
          } else if (elapsedSeconds < 20) {
            exportProgressMessage.textContent = "Retrieving raster bands...";
          } else if (elapsedSeconds < 60) {
            exportProgressMessage.textContent = "Creating the multi-scene mosaic...";
          } else {
            exportProgressMessage.textContent = "Still processing. Large areas " + "may take several minutes...";
          }
        }

        if (exportProgressBar) {
          let percent = 20;

          if (elapsedSeconds >= 5) {
            percent = 35;
          }
          if (elapsedSeconds >= 20) {
            percent = 55;
          }
          if (elapsedSeconds >= 60) {
            percent = 75;
          }
          if (elapsedSeconds >= 120) {
            percent = 88;
          }

          exportProgressBar.style.width = `${percent}%`;
        }
      },
      1000
    );
  }

  function finishRasterExportProgress(succeeded, message) {
    if (rasterExportTimerId) {
      clearInterval(rasterExportTimerId);
      rasterExportTimerId = null;
    }

    const elapsedSeconds = rasterExportStartedAt ? Math.floor((Date.now() - rasterExportStartedAt) / 1000) : 0;

    if (exportProgressMessage) {
      exportProgressMessage.textContent = message;
    }

    if (exportElapsedElement) {
      exportElapsedElement.textContent = `Completed in ${elapsedSeconds} seconds`;
    }

    if (exportProgressBar) {
      exportProgressBar.style.width = "100%";
      exportProgressBar.style.background = succeeded ? "#2e7d32" : "#c62828";
    }

    rasterExportStartedAt = null;
  }

  if (btnExportGeoTiff) {
    btnExportGeoTiff.addEventListener("click", async function(event) {
      L.DomEvent.stopPropagation(event);

      if (!window.lastMosaicRequest) {
        alert("Please obtain the satellite imagery first.");
        return;
      }

      const requestData = window.lastMosaicRequest;
      const exportPurpose = exportPurposeElement ? exportPurposeElement.value : "analysis";
      const resolutionValue = exportResolutionElement ? exportResolutionElement.value : "auto";
      const exportBody = {
        collections: [requestData.collectionId],
        bbox: requestData.bbox,
        datetime: requestData.datetimeRange,
        image_type: requestData.imgType,
        export_purpose: exportPurpose,
        query: {
          "eo:cloud_cover": {
            lte: requestData.cloudLimit
          }
        }
      };

      if (resolutionValue !== "auto") {
        exportBody.resolution_m = Number(resolutionValue);
      }

      btnExportGeoTiff.disabled = true;
      btnExportGeoTiff.textContent = "Processing...";

      startRasterExportProgress();

      try {
        console.log("[GeoTIFF Export Request]", exportBody);

        const response = await fetch(
          (
            "http://localhost:8001/"
            + "api/mosaic/export/geotiff/"
          ),
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              "Accept":
                "image/tiff, application/json"
            },
            body: JSON.stringify(
              exportBody
            )
          }
        );

        if (!response.ok) {
          const contentType = response.headers.get("content-type") || "";

          let errorMessage = `HTTP ${response.status}`;

          if (contentType.includes("application/json")) {
            const errorResult = await response.json();

            console.error("[GeoTIFF Export Error]", errorResult);
            errorMessage = errorResult.message || errorResult.error || errorMessage;

          } else {
            const errorText = await response.text();

            console.error("[GeoTIFF Export Error]", errorText);

            errorMessage = errorText.slice(0, 500) || errorMessage;
          }

          throw new Error(errorMessage);
        }

        if (exportProgressMessage) {
          exportProgressMessage.textContent = "Receiving the completed raster...";
        }

        if (exportProgressBar) {
          exportProgressBar.style.width = "95%";
        }

        const blob = await response.blob();

        if (!blob || blob.size === 0) {
          throw new Error("The downloaded raster is empty.");
        }

        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const contentDisposition = response.headers.get("content-disposition");

        let downloadFilename = `gesat_` + `${requestData.collectionId}_` + `${requestData.imgType}_` + `${exportPurpose}.tif`;

        if (contentDisposition) {
          const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/);
          const normalMatch = contentDisposition.match(/filename="?([^";]+)"?/);

          if (utf8Match && utf8Match[1]) {
            downloadFilename = decodeURIComponent(utf8Match[1]);

          } else if (normalMatch && normalMatch[1]) {
            downloadFilename = normalMatch[1];
          }
        }

        link.href = downloadUrl;
        link.download = downloadFilename;

        document.body.appendChild(link);

        link.click();
        link.remove();

        setTimeout(
          function() {
            URL.revokeObjectURL(downloadUrl);
          },
          2000
        );

        finishRasterExportProgress(true, "Export completed. Download started.");

      } catch (error) {
        console.error("[GeoTIFF Export Error]", error);

        finishRasterExportProgress(false, "Export failed.");

        alert("An error occurred during GeoTIFF export.\n\n" + error.message);

      } finally {
        btnExportGeoTiff.disabled = false;
        btnExportGeoTiff.textContent = "Export GeoTIFF";
      }
    }
  );
}
    
    // 選択解除（Clear）
    // 2026/10/16 Updated.
    btnClearSelection.addEventListener("click", function(e) {
      L.DomEvent.stopPropagation(e);
      if (window.selectedMunicipios.length === 0) {
        return;
      }
      
      window.selectedMunicipios = [];
      if (fgbGeojsonLayer) {
        fgbGeojsonLayer.eachLayer(function(layer) {
          layer.setStyle(isSelectMode ? STYLES.baseModeOn : STYLES.hidden);
        });
      }
      updateSelectedAreaSummary();
    });
  
    
    // モード切り替え（Select）
    btnSelectMode.addEventListener("click", function() {
      isSelectMode = !isSelectMode;
      if (isSelectMode) {
        btnSelectMode.textContent = "Select Municipios: ON";
        btnSelectMode.className = "gesat-btn btn-active";
      } else {
        btnSelectMode.textContent = "Select Municipios: OFF";
        btnSelectMode.className = "gesat-btn btn-inactive";
      }

      if (fgbGeojsonLayer) {
        fgbGeojsonLayer.eachLayer(function(layer) {
          const isSelected = window.selectedMunicipios.some(function(f) {
            return f.properties.MUN_CODE === layer.feature.properties.MUN_CODE;
          });
          // 2026/10/18 Updated
          if (!isSelectMode) {
            /*
             * 選択情報は保持するが、Select OFF時は全図形を非表示にする。
             */
            layer.setStyle(STYLES.hidden);
          } else if (isSelected) {
            layer.setStyle(STYLES.selected);
          } else {
            layer.setStyle(STYLES.baseModeOn);
          }
        });
      }
    });

    // Search input processing
    // 検索入力処理
    txtSearch.addEventListener("input", function() {
      const query = txtSearch.value.trim().toLowerCase();
      dropdown.innerHTML = "";

      if (!query) { dropdown.classList.add("hidden"); return; }

      const matches = allMunicipiosData.filter(function(item) {
        const mName = (item.feature.properties.MUN_NAME || "").toLowerCase();
        const dName = (item.feature.properties.DEP_NAME || "").toLowerCase();
        return mName.includes(query) || dName.includes(query);
      }).slice(0, 10);

      if (matches.length === 0) { dropdown.classList.add("hidden"); return; }

      matches.forEach(function(item) {
        const props = item.feature.properties;
        const div = document.createElement("div");
        div.className = "search-item";
        div.innerHTML = `<strong>${props.MUN_NAME}</strong> <span style="font-size:10px; color:#666;">(${props.DEP_NAME})</span>`;
        
        div.addEventListener("click", function(e) {
          L.DomEvent.stopPropagation(e);
          txtSearch.value = props.MUN_NAME;
          dropdown.classList.add("hidden");

          const bounds = item.layer.getBounds();
          map.flyToBounds(bounds, { padding:[20, 20], duration: 1.2 });

          item.layer.setStyle({ color: "#ffd400", weight: 5.0, opacity: 1.0, fillOpacity: 0.4 });
          
          setTimeout(function() {
            const isSelected = window.selectedMunicipios.some(function(f) {
              return f.properties.MUN_CODE === props.MUN_CODE;
            });
            if (isSelected) {
              item.layer.setStyle(STYLES.selected);
            } else {
              item.layer.setStyle(isSelectMode ? STYLES.baseModeOn : STYLES.hidden);
            }
          }, 2500);
        });
        dropdown.appendChild(div);
      });
      dropdown.classList.remove("hidden");
    });

    document.addEventListener("click", function(e) {
      if (e.target !== txtSearch) dropdown.classList.add("hidden");
    });
  }

  // Internal function: Map layer allocation and FGB data fetching
  // 内部関数: 地図レイヤーの確保とFGBデータフェッチ
  function initFgbLayer(map) {
    if (!map.getPane("fgbSelectionPane")) {
      map.createPane("fgbSelectionPane");
    }
    map.getPane("fgbSelectionPane").style.zIndex = "800";
    map.getPane("fgbSelectionPane").style.pointerEvents = "auto";

    fgbGeojsonLayer = L.geoJSON(null, {
      pane: "fgbSelectionPane",
      style: function(feature) {
        const isSelected = window.selectedMunicipios.some(function(f) {
          return f.properties.MUN_CODE === feature.properties.MUN_CODE;
        });
        if (isSelected) return STYLES.selected;
        return isSelectMode ? STYLES.baseModeOn : STYLES.hidden;
      },
      onEachFeature: function(feature, layer) {
        allMunicipiosData.push({ feature: feature, layer: layer });

        layer.bindTooltip(function() {
          if (!isSelectMode) return null; 
          return `<strong>${feature.properties.MUN_NAME}</strong><br><small>${feature.properties.DEP_NAME}</small>`;
        }, { sticky: true, direction: "auto" });

        layer.on("click", function(e) {
          if (!isSelectMode) return; 
          L.DomEvent.stopPropagation(e);

          const props = feature.properties;
          const index = window.selectedMunicipios.findIndex(function(f) {
            return f.properties.MUN_CODE === props.MUN_CODE;
          });

          if (index > -1) {
            window.selectedMunicipios.splice(index, 1);
            layer.setStyle(STYLES.baseModeOn);
          } else {
            window.selectedMunicipios.push(feature);
            layer.setStyle(STYLES.selected);
          }
          
          if (typeof window.updateSelectedAreaSummary === "function") {
            window.updateSelectedAreaSummary();
          }
        });
      }
    }).addTo(map);

    // // Asynchronously fetch data from Cloudflare R2
    // Cloudflare R2からデータを非同期フェッチ
    (async function fetchFgbData() {
      try {
        const fgbUrl = GESAT_CONFIG.data.boliviaMunicipiosFgb;
        if (!fgbUrl) return;

        const response = await fetch(fgbUrl);
        if (!response.ok) return;

        let deserializeFn = null;
        if (typeof flatgeobuf !== "undefined" && flatgeobuf.geojson) {
          deserializeFn = flatgeobuf.geojson.deserialize;
        } else if (typeof flatgeobuf !== "undefined") {
          deserializeFn = flatgeobuf.deserialize;
        }
        if (!deserializeFn) return;

        const buffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);
        const iterator = deserializeFn(uint8Array);
        
        for await (const feature of iterator) {
          fgbGeojsonLayer.addData(feature);
        }
        console.log("[GESAT FGB] Total polygons loaded inside new window.");
      } catch (error) {
        console.error("[GESAT FGB] Fetch error:", error);
      }
    })();
  }
})();

