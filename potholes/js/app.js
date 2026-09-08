/**
 * RASTA Application Controller - Society Pothole Inspection Portal
 * Connects uploaded video feed, real-time detector engine, Map API, GIS map,
 * and Society Management Report generator.
 */

document.addEventListener('DOMContentLoaded', () => {
  const detector = new RASTADetector('videoCanvas', 'uploadedVideoPlayer');
  const map = new RASTAMap('leafletMap');
  const reconciler = new RASTAReconciler();

  let uploadedFile = null;
  let startGps = { lat: 31.478920, lng: 74.305610 };
  let endGps = { lat: 31.482500, lng: 74.311200 };
  let scan1Potholes = [];
  let scan2Potholes = [];
  let lastReconcileResult = null;

  // =========================================================================
  // 1. NAVIGATION TAB CONTROLLER
  // =========================================================================
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');

  function getPriorityItems() {
    const source = window.RASTA_DATASETS && window.RASTA_DATASETS.scan2;
    const potholes = source ? source.potholes : [];
    const severityWeight = { LOW: 28, MEDIUM: 58, HIGH: 88 };

    return potholes.map((pothole, index) => {
      const motorcycleRisk = pothole.depthCm >= 5 || pothole.estimatedAreaCm2 >= 750;
      const recurrenceBonus = index < 4 ? 18 : 8;
      const score = Math.min(99, Math.round(
        severityWeight[pothole.severity] +
        (pothole.confidence * 10) +
        Math.min(10, pothole.estimatedAreaCm2 / 120) +
        recurrenceBonus +
        (motorcycleRisk ? 8 : 0)
      ));

      return {
        id: pothole.id,
        road: source.locationName,
        severity: pothole.severity,
        score,
        cost: pothole.severity === 'HIGH' ? 1800 : (pothole.severity === 'MEDIUM' ? 950 : 420),
        motorcycleRisk,
        action: pothole.severity === 'HIGH' ? 'Dispatch within 48h' : 'Schedule maintenance'
      };
    }).sort((a, b) => b.score - a.score);
  }

  function renderPriorityItem(item, index) {
    return `<div class="priority-item">
      <span class="priority-rank">0${index + 1}</span>
      <div class="priority-main"><strong>${item.id} · ${item.severity} risk${item.motorcycleRisk ? ' · Rider alert' : ''}</strong><span>${item.action} · ${item.road}</span></div>
      <span class="priority-score">${item.score}</span>
    </div>`;
  }

  function renderDecisionViews() {
    const items = getPriorityItems();
    const homeList = document.getElementById('homePriorityList');
    const planner = document.getElementById('priorityPlanner');
    if (homeList) homeList.innerHTML = items.slice(0, 3).map(renderPriorityItem).join('');
    if (planner) {
      const budget = Math.max(0, parseFloat(document.getElementById('budgetInput')?.value) || 0);
      let remaining = budget;
      planner.innerHTML = items.map((item, index) => {
        const funded = remaining >= item.cost;
        if (funded) remaining -= item.cost;
        return `<div class="priority-item">
          <span class="priority-rank">0${index + 1}</span>
          <div class="priority-main"><strong>${item.id} · ${item.severity} · score ${item.score}</strong><span>${item.motorcycleRisk ? 'Motorcycle rider risk flag · ' : ''}${item.action}</span></div>
          <span class="priority-cost">$${item.cost.toLocaleString()}<br><b class="${funded ? 'funded' : 'deferred'}">${funded ? 'FUNDED' : 'DEFERRED'}</b></span>
        </div>`;
      }).join('');
    }
  }

  function switchTab(targetTabId) {
    navTabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    const activeNavBtn = document.querySelector(`[data-tab="${targetTabId}"]`);
    if (activeNavBtn) activeNavBtn.classList.add('active');

    const targetSection = document.getElementById(targetTabId);
    if (targetSection) targetSection.classList.add('active');

    // Initialize Route Picker Map on Tab 1 (Upload Screen)
    if (targetTabId === 'tab-upload') {
      setTimeout(() => {
        map.initPickerMap('pickerMap', startGps, endGps, (newStart, newEnd) => {
          document.getElementById('inputStartLat').value = newStart.lat.toFixed(6);
          document.getElementById('inputStartLng').value = newStart.lng.toFixed(6);
          document.getElementById('inputEndLat').value = newEnd.lat.toFixed(6);
          document.getElementById('inputEndLng').value = newEnd.lng.toFixed(6);
          detector.setStartEndGps(newStart.lat, newStart.lng, newEnd.lat, newEnd.lng);
        });
      }, 150);
    }

    // Initialize Main Pothole GIS Map when Tab 2 opens
    if (targetTabId === 'tab-detection') {
      if (!map.isInitialized) {
        map.init();
      }
      setTimeout(() => {
        if (map.map) map.map.invalidateSize();
        map.plotPotholes(detector.detectedPotholes);
      }, 150);
    }

    // Refresh Society Report view when Tab 3 opens
    if (targetTabId === 'tab-report') {
      updateSocietyReportUI();
    }
  }

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTabId = tab.getAttribute('data-tab');
      switchTab(targetTabId);
    });
  });

  document.querySelectorAll('[data-go-tab]').forEach(button => {
    button.addEventListener('click', () => switchTab(button.dataset.goTab));
  });

  document.querySelectorAll('[data-alert]').forEach(button => {
    button.addEventListener('click', () => alert(button.dataset.alert));
  });

  document.getElementById('budgetInput')?.addEventListener('input', renderDecisionViews);
  renderDecisionViews();

  document.getElementById('btnGoToReport').addEventListener('click', () => switchTab('tab-report'));

  // =========================================================================
  // 2. MAP API LOCATION SEARCH & START/END GPS HANDLERS
  // =========================================================================
  const inputStartLat = document.getElementById('inputStartLat');
  const inputStartLng = document.getElementById('inputStartLng');
  const inputEndLat = document.getElementById('inputEndLat');
  const inputEndLng = document.getElementById('inputEndLng');

  function updateAllCoordinates() {
    startGps.lat = parseFloat(inputStartLat.value) || 31.478920;
    startGps.lng = parseFloat(inputStartLng.value) || 74.305610;
    endGps.lat = parseFloat(inputEndLat.value) || 31.482500;
    endGps.lng = parseFloat(inputEndLng.value) || 74.311200;

    detector.setStartEndGps(startGps.lat, startGps.lng, endGps.lat, endGps.lng);
    map.updatePickerMarkers(startGps, endGps);
  }

  [inputStartLat, inputStartLng, inputEndLat, inputEndLng].forEach(input => {
    input.addEventListener('change', updateAllCoordinates);
  });

  // Map API Location Search
  const btnSearchLocation = document.getElementById('btnSearchLocation');
  const inputLocationSearch = document.getElementById('inputLocationSearch');

  function executeMapSearch() {
    const query = inputLocationSearch.value.trim();
    if (!query) return;

    map.searchMapLocation(query, (lat, lng, displayName) => {
      // Set Start GPS to searched location and offset End GPS
      startGps.lat = lat;
      startGps.lng = lng;
      endGps.lat = lat + 0.0035;
      endGps.lng = lng + 0.0052;

      inputStartLat.value = startGps.lat.toFixed(6);
      inputStartLng.value = startGps.lng.toFixed(6);
      inputEndLat.value = endGps.lat.toFixed(6);
      inputEndLng.value = endGps.lng.toFixed(6);

      detector.setStartEndGps(startGps.lat, startGps.lng, endGps.lat, endGps.lng);
      map.updatePickerMarkers(startGps, endGps);
    });
  }

  btnSearchLocation.addEventListener('click', executeMapSearch);
  inputLocationSearch.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') executeMapSearch();
  });

  // =========================================================================
  // 3. VIDEO FILE & GPS TELEMETRY UPLOAD HANDLER
  // =========================================================================
  const fileVideoInput = document.getElementById('fileVideoInput');
  const videoDropzone = document.getElementById('videoDropzone');
  const videoFileStatus = document.getElementById('videoFileStatus');
  const fileGpsInput = document.getElementById('fileGpsInput');
  const gpsFileStatus = document.getElementById('gpsFileStatus');

  function handleVideoFileSelect(file) {
    if (!file || !file.type.startsWith('video/')) {
      alert("Please select a valid video file (.mp4, .webm, .mov)");
      return;
    }

    uploadedFile = file;
    videoFileStatus.style.display = 'block';
    videoFileStatus.textContent = `✅ Loaded Video: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;

    document.getElementById('currentVideoBadge').textContent = file.name;
    detector.loadVideoFile(file);
  }

  fileVideoInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleVideoFileSelect(e.target.files[0]);
    }
  });

  videoDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    videoDropzone.style.borderColor = 'var(--accent-cyan)';
    videoDropzone.style.background = 'rgba(0, 242, 254, 0.08)';
  });

  videoDropzone.addEventListener('dragleave', () => {
    videoDropzone.style.borderColor = 'rgba(0, 242, 254, 0.4)';
    videoDropzone.style.background = 'rgba(0, 242, 254, 0.02)';
  });

  videoDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    videoDropzone.style.borderColor = 'rgba(0, 242, 254, 0.4)';
    videoDropzone.style.background = 'rgba(0, 242, 254, 0.02)';

    if (e.dataTransfer.files.length > 0) {
      handleVideoFileSelect(e.dataTransfer.files[0]);
    }
  });

  fileGpsInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      const csvFile = e.target.files[0];
      const reader = new FileReader();
      reader.onload = function(evt) {
        const text = evt.target.result;
        const lines = text.split('\n');
        const parsedGps = [];

        lines.forEach(line => {
          const parts = line.split(',');
          if (parts.length >= 3) {
            const lat = parseFloat(parts[1]);
            const lng = parseFloat(parts[2]);
            if (!isNaN(lat) && !isNaN(lng)) {
              parsedGps.push({ lat, lng });
            }
          }
        });

        if (parsedGps.length > 0) {
          detector.setGpsLog(parsedGps);
          gpsFileStatus.style.display = 'block';
          gpsFileStatus.textContent = `📡 Telemetry CSV Synced: ${parsedGps.length} GPS Waypoints Loaded`;
        }
      };
      reader.readAsText(csvFile);
    }
  });

  // =========================================================================
  // 4. START DETECTION ACTION BUTTON
  // =========================================================================
  const btnStartDetection = document.getElementById('btnStartDetection');
  btnStartDetection.addEventListener('click', () => {
    if (!uploadedFile && !detector.isRealVideo) {
      fileVideoInput.click();
      return;
    }

    switchTab('tab-detection');

    setTimeout(() => {
      detector.play();
      document.getElementById('btnPlayPause').textContent = '⏸ Pause Video';
    }, 300);
  });

  document.getElementById('btnChangeVideo').addEventListener('click', () => {
    switchTab('tab-upload');
  });

  // =========================================================================
  // 5. DETECTION TELEMETRY & UI LOGIC
  // =========================================================================
  const videoSeeker = document.getElementById('videoSeeker');
  const timeCurrent = document.getElementById('timeCurrent');
  const timeTotal = document.getElementById('timeTotal');
  const btnPlayPause = document.getElementById('btnPlayPause');

  detector.onTelemetryUpdate = (data) => {
    document.getElementById('hudLat').textContent = data.gps.lat.toFixed(6);
    document.getElementById('hudLng').textContent = data.gps.lng.toFixed(6);
    document.getElementById('hudSpeed').textContent = `${data.speed} km/h`;

    const mins = Math.floor(data.timeSec / 60);
    const secs = (data.timeSec % 60).toFixed(1);
    timeCurrent.textContent = `${mins.toString().padStart(2, '0')}:${secs.padStart(4, '0')}s`;
    document.getElementById('hudTime').textContent = timeCurrent.textContent;

    if (data.durationSec > 0) {
      const tMins = Math.floor(data.durationSec / 60);
      const tSecs = Math.floor(data.durationSec % 60);
      timeTotal.textContent = `${tMins.toString().padStart(2, '0')}:${tSecs.toString().padStart(2, '0')}`;
      videoSeeker.max = data.durationSec;
    }
    videoSeeker.value = data.timeSec;
  };

  detector.onDetectionTrigger = (newPothole, allPotholes) => {
    renderDetectionsTable(allPotholes);
    if (map.isInitialized) {
      map.plotPotholes(allPotholes);
    }
    updateSocietyReportUI();
  };

  videoSeeker.addEventListener('input', (e) => {
    detector.seek(parseFloat(e.target.value));
  });

  btnPlayPause.addEventListener('click', () => {
    if (detector.isPlaying) {
      detector.pause();
      btnPlayPause.textContent = '▶ Play Video';
    } else {
      detector.play();
      btnPlayPause.textContent = '⏸ Pause Video';
    }
  });

  document.getElementById('btnToggleBBox').addEventListener('click', () => {
    detector.showBoundingBoxes = !detector.showBoundingBoxes;
    detector.renderFrame();
  });

  function renderDetectionsTable(potholes) {
    const tbody = document.getElementById('tbodyDetections');
    tbody.innerHTML = '';

    if (!potholes || potholes.length === 0) {
      document.getElementById('detectionCountBadge').textContent = '0 Detections';
      return;
    }

    potholes.forEach(ph => {
      const tr = document.createElement('tr');
      const sevClass = ph.severity === 'HIGH' ? 'chip-recurring' : (ph.severity === 'MEDIUM' ? 'chip-new' : 'badge-system');

      tr.innerHTML = `
        <td>${ph.thumbUrl ? `<img src="${ph.thumbUrl}" class="pothole-thumb" alt="Pothole #${ph.id}"/>` : '📷 Snapshot'}</td>
        <td><strong>#${ph.id}</strong></td>
        <td>${ph.lat.toFixed(6)}, ${ph.lng.toFixed(6)}</td>
        <td style="color:var(--accent-cyan); font-weight:600;">${(ph.confidence * 100).toFixed(0)}%</td>
        <td><span class="status-chip ${sevClass}">${ph.severity}</span></td>
      `;

      tr.addEventListener('click', () => {
        detector.seek(ph.timeSec);
      });

      tbody.appendChild(tr);
    });

    document.getElementById('detectionCountBadge').textContent = `${potholes.length} Detections`;
  }

  // =========================================================================
  // 6. SOCIETY MANAGEMENT REPORT GENERATOR
  // =========================================================================
  function updateSocietyReportUI() {
    const potholes = detector.detectedPotholes || [];
    const reportTbody = document.getElementById('reportTbody');
    const rptTotalCount = document.getElementById('rptTotalCount');
    const rptHighSeverityCount = document.getElementById('rptHighSeverityCount');
    const rptAvgConf = document.getElementById('rptAvgConf');

    rptTotalCount.textContent = potholes.length;
    
    const highCount = potholes.filter(p => p.severity === 'HIGH').length;
    rptHighSeverityCount.textContent = highCount;

    if (potholes.length > 0) {
      const avg = potholes.reduce((acc, curr) => acc + curr.confidence, 0) / potholes.length;
      rptAvgConf.textContent = `${(avg * 100).toFixed(0)}%`;
    } else {
      rptAvgConf.textContent = '0%';
    }

    if (!reportTbody) return;
    reportTbody.innerHTML = '';

    if (potholes.length === 0) {
      reportTbody.innerHTML = `
        <tr>
          <td colspan="6" style="padding: 15px; text-align: center; color: var(--text-muted);">
            No potholes detected yet. Upload a video and press "Detect Potholes" to populate society report data.
          </td>
        </tr>
      `;
      return;
    }

    potholes.forEach(ph => {
      const tr = document.createElement('tr');
      const sevColor = ph.severity === 'HIGH' ? '#E24B4A' : (ph.severity === 'MEDIUM' ? '#EF9F27' : '#639922');

      tr.innerHTML = `
        <td style="padding: 10px; border: 1px solid #334155; font-family:var(--font-mono);"><strong>#${ph.id}</strong></td>
        <td style="padding: 10px; border: 1px solid #334155;">
          ${ph.thumbUrl ? `<img src="${ph.thumbUrl}" style="width:70px; height:50px; border-radius:4px; object-fit:cover;" alt="Pothole"/>` : 'N/A'}
        </td>
        <td style="padding: 10px; border: 1px solid #334155; font-family:var(--font-mono);">
          <a href="https://maps.google.com/?q=${ph.lat},${ph.lng}" target="_blank" style="color:var(--accent-cyan); text-decoration:none;">
            ${ph.lat.toFixed(6)}, ${ph.lng.toFixed(6)} 📍
          </a>
        </td>
        <td style="padding: 10px; border: 1px solid #334155;">
          <strong style="color:${sevColor};">${ph.severity}</strong>
        </td>
        <td style="padding: 10px; border: 1px solid #334155;">${ph.estimatedAreaCm2} cm² (${ph.depthCm}cm deep)</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; font-size:0.8rem; color:#374151; font-weight:600;">${ph.recommendation}</td>
      `;

      reportTbody.appendChild(tr);
    });

    document.getElementById('reportDate').textContent = new Date().toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  document.getElementById('btnGenerateReportTab').addEventListener('click', () => {
    switchTab('tab-report');
  });

  function exportSocietyCSV() {
    const potholes = detector.detectedPotholes || [];
    if (potholes.length === 0) {
      alert("No pothole detections available to export.");
      return;
    }

    let csv = "Pothole_ID,Time_Sec,Frame_No,Latitude,Longitude,Confidence_Pct,Severity,Area_Cm2,Depth_Cm,Recommended_Action\n";
    potholes.forEach(ph => {
      csv += `${ph.id},${ph.timeSec},${ph.frameNo},${ph.lat},${ph.lng},${(ph.confidence * 100).toFixed(0)}%,${ph.severity},${ph.estimatedAreaCm2},${ph.depthCm},"${ph.recommendation}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Society_Pothole_Inspection_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  document.getElementById('btnExportScanCSV').addEventListener('click', exportSocietyCSV);
  document.getElementById('btnExportReportCSV').addEventListener('click', exportSocietyCSV);

  // =========================================================================
  // 7. MULTI-PASS RECONCILIATION TAB LOGIC
  // =========================================================================

  // Read CSV file into text and parse potholes
  function loadReconcileCSV(fileInputId, statusId, targetArray, label) {
    const input = document.getElementById(fileInputId);
    const status = document.getElementById(statusId);
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const parsed = reconciler.parseCSV(evt.target.result);
        if (parsed.length === 0) {
          status.style.display = 'block';
          status.textContent = `⚠️ No valid GPS rows found in "${file.name}". Check CSV format.`;
          return;
        }
        // Clear and populate the target array in-place
        targetArray.length = 0;
        parsed.forEach(p => targetArray.push(p));
        status.style.display = 'block';
        status.textContent = `✅ ${label}: "${file.name}" — ${parsed.length} potholes loaded`;
      };
      reader.readAsText(file);
    });
  }

  loadReconcileCSV('fileScan1CSV', 'scan1Status', scan1Potholes, 'Scan 1');
  loadReconcileCSV('fileScan2CSV', 'scan2Status', scan2Potholes, 'Scan 2');

  // GPS tolerance slider
  const rangeGpsTolerance = document.getElementById('rangeGpsTolerance');
  const labelGpsTolerance = document.getElementById('labelGpsTolerance');
  rangeGpsTolerance.addEventListener('input', () => {
    labelGpsTolerance.textContent = `${parseFloat(rangeGpsTolerance.value).toFixed(1)}m`;
  });

  // Run Reconciliation button
  document.getElementById('btnRunReconcile').addEventListener('click', () => {
    if (scan1Potholes.length === 0 && scan2Potholes.length === 0) {
      alert('Please upload at least one CSV file (Scan 1 or Scan 2) to run reconciliation.');
      return;
    }
    if (scan1Potholes.length === 0) {
      alert('Please upload Scan 1 CSV (the earlier/baseline scan).');
      return;
    }
    if (scan2Potholes.length === 0) {
      alert('Please upload Scan 2 CSV (the follow-up scan).');
      return;
    }

    const tolerance = parseFloat(rangeGpsTolerance.value);
    lastReconcileResult = reconciler.reconcile(scan1Potholes, scan2Potholes, tolerance);
    renderReconcileResults(lastReconcileResult);
  });

  function renderReconcileResults(res) {
    // Show/hide sections
    document.getElementById('reconcileEmptyState').style.display = 'none';
    document.getElementById('reconcileMetrics').style.display = 'grid';
    document.getElementById('reconcileResultsWrap').style.display = 'block';

    // Update metrics
    document.getElementById('rcTotalCount').textContent = res.totalUnique;
    document.getElementById('rcRecurringCount').textContent = res.recurringCount;
    document.getElementById('rcNewCount').textContent = res.newCount;

    // Render results table
    const tbody = document.getElementById('tbodyReconcile');
    tbody.innerHTML = '';

    res.results.forEach(r => {
      const tr = document.createElement('tr');

      let chipClass = '';
      let chipColor = '';
      if (r.status === 'RECURRING') { chipClass = 'chip-recurring'; chipColor = '#E24B4A'; }
      else if (r.status === 'NEW')  { chipClass = 'chip-new'; chipColor = '#EF9F27'; }
      else                          { chipClass = 'chip-repaired'; chipColor = '#639922'; }

      tr.innerHTML = `
        <td><span class="status-chip ${chipClass}">${r.statusLabel}</span></td>
        <td><strong style="font-family:var(--font-mono);">${r.reconciledId}</strong></td>
        <td style="font-family:var(--font-mono);">${r.scan1Id || '<span style="color:var(--text-dim);">—</span>'}</td>
        <td style="font-family:var(--font-mono);">${r.scan2Id || '<span style="color:var(--text-dim);">—</span>'}</td>
        <td style="font-family:var(--font-mono); color:var(--accent-cyan);">${r.distanceMeters > 0 ? r.distanceMeters.toFixed(1) + 'm' : '—'}</td>
        <td>
          <a href="https://maps.google.com/?q=${r.lat},${r.lng}" target="_blank" style="color:var(--accent-cyan); text-decoration:none; font-family:var(--font-mono); font-size:0.8rem;">
            ${r.lat}, ${r.lng} 📍
          </a>
        </td>
        <td style="font-size:0.8rem;">${r.severityTrend || '<span style="color:var(--text-dim);">—</span>'}</td>
        <td style="font-size:0.78rem; color:var(--text-muted); max-width:200px;">${r.notes}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Export Reconciliation CSV
  document.getElementById('btnExportReconcileCSV').addEventListener('click', () => {
    if (!lastReconcileResult) return;

    let csv = 'Reconciled_ID,Status,Scan1_ID,Scan2_ID,GPS_Offset_m,Latitude,Longitude,Severity_Trend,Notes\n';
    lastReconcileResult.results.forEach(r => {
      csv += `${r.reconciledId},${r.status},${r.scan1Id || ''},${r.scan2Id || ''},${r.distanceMeters.toFixed(1)},${r.lat},${r.lng},"${r.severityTrend}","${r.notes}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `RASTA_Reconciliation_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // Default initial tab: the command dashboard is the mobile app home.
  switchTab('tab-home');
});
