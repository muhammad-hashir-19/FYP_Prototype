/**
 * RASTA Multi-Pass Reconciliation Engine
 * Uses Haversine distance formula to match potholes across two road scans
 * and classify them as RECURRING, NEW, or REPAIRED.
 */

class RASTAReconciler {

  // Haversine formula: calculates real-world distance in meters between two GPS points
  haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth radius in meters
    const toRad = deg => deg * (Math.PI / 180);

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  }

  /**
   * Main reconciliation function.
   * scan1Potholes: array of {id, lat, lng, severity, confidence, ...}
   * scan2Potholes: array of {id, lat, lng, severity, confidence, ...}
   * toleranceMeters: GPS buffer radius to consider two detections as the same pothole
   */
  reconcile(scan1Potholes, scan2Potholes, toleranceMeters = 5) {
    const results = [];
    const matchedScan2Ids = new Set();

    // Step 1: For each Scan 1 pothole, find closest match in Scan 2
    scan1Potholes.forEach((p1, idx) => {
      let bestMatch = null;
      let bestDist = Infinity;

      scan2Potholes.forEach(p2 => {
        if (matchedScan2Ids.has(p2.id)) return; // already matched
        const dist = this.haversineDistance(p1.lat, p1.lng, p2.lat, p2.lng);
        if (dist < bestDist) {
          bestDist = dist;
          bestMatch = p2;
        }
      });

      if (bestMatch && bestDist <= toleranceMeters) {
        // RECURRING: found in both scans within GPS tolerance
        matchedScan2Ids.add(bestMatch.id);
        results.push({
          reconciledId: `RC-${String(idx + 1).padStart(3, '0')}`,
          status: 'RECURRING',
          statusLabel: '🔁 Recurring',
          scan1Id: p1.id,
          scan2Id: bestMatch.id,
          lat: parseFloat(((p1.lat + bestMatch.lat) / 2).toFixed(6)),
          lng: parseFloat(((p1.lng + bestMatch.lng) / 2).toFixed(6)),
          distanceMeters: bestDist,
          scan1Severity: p1.severity,
          scan2Severity: bestMatch.severity,
          severityTrend: this.getSeverityTrend(p1.severity, bestMatch.severity),
          confidence: Math.max(p1.confidence || 0.85, bestMatch.confidence || 0.85),
          notes: `Persistent pothole. GPS offset: ${bestDist.toFixed(1)}m. ${this.getSeverityTrend(p1.severity, bestMatch.severity)}`
        });
      } else {
        // REPAIRED: in Scan 1 but no match found in Scan 2
        results.push({
          reconciledId: `RC-${String(idx + 1).padStart(3, '0')}`,
          status: 'REPAIRED',
          statusLabel: '✅ Repaired / Not Found',
          scan1Id: p1.id,
          scan2Id: null,
          lat: p1.lat,
          lng: p1.lng,
          distanceMeters: 0,
          scan1Severity: p1.severity,
          scan2Severity: null,
          severityTrend: '',
          confidence: p1.confidence || 0.85,
          notes: `Pothole ${p1.id} from Scan 1 has no match in Scan 2 (within ${toleranceMeters}m). Likely repaired.`
        });
      }
    });

    // Step 2: Any Scan 2 pothole that was not matched = NEW DEFECT
    let newIdx = scan1Potholes.length + 1;
    scan2Potholes.forEach(p2 => {
      if (!matchedScan2Ids.has(p2.id)) {
        results.push({
          reconciledId: `RC-${String(newIdx).padStart(3, '0')}`,
          status: 'NEW',
          statusLabel: '🆕 New Defect',
          scan1Id: null,
          scan2Id: p2.id,
          lat: p2.lat,
          lng: p2.lng,
          distanceMeters: 0,
          scan1Severity: null,
          scan2Severity: p2.severity,
          severityTrend: '',
          confidence: p2.confidence || 0.85,
          notes: `New pothole formed after Scan 1. Not observed in first survey.`
        });
        newIdx++;
      }
    });

    // Summary stats
    const recurringCount = results.filter(r => r.status === 'RECURRING').length;
    const newCount = results.filter(r => r.status === 'NEW').length;
    const repairedCount = results.filter(r => r.status === 'REPAIRED').length;

    return {
      results,
      recurringCount,
      newCount,
      repairedCount,
      totalUnique: results.length
    };
  }

  getSeverityTrend(sev1, sev2) {
    const rank = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3 };
    if (!sev2) return '';
    const diff = rank[sev2] - rank[sev1];
    if (diff > 0) return `⬆️ Worsened: ${sev1} → ${sev2}`;
    if (diff < 0) return `⬇️ Improved: ${sev1} → ${sev2}`;
    return `➡️ Stable: ${sev2}`;
  }

  // Parse a CSV string exported from RASTA into an array of pothole objects
  parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const potholes = [];

    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',');
      if (vals.length < 5) continue;

      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = vals[idx] ? vals[idx].trim().replace(/"/g, '') : '';
      });

      const lat = parseFloat(obj['Latitude']);
      const lng = parseFloat(obj['Longitude']);
      if (isNaN(lat) || isNaN(lng)) continue;

      potholes.push({
        id: obj['Pothole_ID'] || `P${i}`,
        lat,
        lng,
        severity: obj['Severity'] || 'MEDIUM',
        confidence: parseFloat(obj['Confidence_Pct']) / 100 || 0.85,
        estimatedAreaCm2: parseFloat(obj['Area_Cm2']) || 0,
        depthCm: parseFloat(obj['Depth_Cm']) || 0,
        timeSec: parseFloat(obj['Time_Sec']) || 0,
        recommendation: obj['Recommended_Action'] || ''
      });
    }

    return potholes;
  }
}

window.RASTAReconciler = RASTAReconciler;
