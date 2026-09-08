/**
 * RASTA Dataset Registry
 * Pre-loaded road inspection scans with synchronized GPS tracks and verified ground truth / detection records
 */

window.RASTA_DATASETS = {
  scan1: {
    id: "SCAN-2026-08-01-A",
    title: "Main Blvd Pass A (Day 1 - Initial Survey)",
    date: "2026-08-01 10:15 AM",
    operator: "Inspection Vehicle #01 (Dashcam HD-1080p)",
    locationName: "FAST NUCES Perimeter Road - West Sector",
    startGps: { lat: 31.478500, lng: 74.305200 },
    endGps: { lat: 31.482500, lng: 74.309500 },
    durationSec: 15,
    speedKmh: 35,
    gpsAccuracyMeters: 2.8,
    potholes: [
      {
        id: "P101",
        scanId: "SCAN-2026-08-01-A",
        frameNo: 45,
        timeSec: 3.0,
        lat: 31.478920,
        lng: 74.305610,
        confidence: 0.92,
        severity: "HIGH",
        estimatedAreaCm2: 850,
        depthCm: 6.2,
        bbox: { x: 0.35, y: 0.55, width: 0.22, height: 0.18 },
        notes: "Deep asphalt degradation with sharp edges near lane line."
      },
      {
        id: "P102",
        scanId: "SCAN-2026-08-01-A",
        frameNo: 90,
        timeSec: 6.0,
        lat: 31.479580,
        lng: 74.306340,
        confidence: 0.88,
        severity: "MEDIUM",
        estimatedAreaCm2: 420,
        depthCm: 3.5,
        bbox: { x: 0.52, y: 0.62, width: 0.15, height: 0.12 },
        notes: "Mid-lane fatigue cracking and pothole formation."
      },
      {
        id: "P103",
        scanId: "SCAN-2026-08-01-A",
        frameNo: 125,
        timeSec: 8.3,
        lat: 31.480110,
        lng: 74.306920,
        confidence: 0.94,
        severity: "HIGH",
        estimatedAreaCm2: 1100,
        depthCm: 8.0,
        bbox: { x: 0.28, y: 0.58, width: 0.28, height: 0.22 },
        notes: "Hazardous deep cavity - high motorcycle safety risk!"
      },
      {
        id: "P104",
        scanId: "SCAN-2026-08-01-A",
        frameNo: 170,
        timeSec: 11.3,
        lat: 31.481250,
        lng: 74.308150,
        confidence: 0.81,
        severity: "LOW",
        estimatedAreaCm2: 260,
        depthCm: 2.1,
        bbox: { x: 0.60, y: 0.65, width: 0.12, height: 0.10 },
        notes: "Minor surface depression near drainage grate."
      },
      {
        id: "P105",
        scanId: "SCAN-2026-08-01-A",
        frameNo: 210,
        timeSec: 14.0,
        lat: 31.482080,
        lng: 74.309020,
        confidence: 0.89,
        severity: "MEDIUM",
        estimatedAreaCm2: 580,
        depthCm: 4.3,
        bbox: { x: 0.40, y: 0.60, width: 0.18, height: 0.14 },
        notes: "Outer shoulder pavement failure."
      }
    ]
  },

  scan2: {
    id: "SCAN-2026-08-15-B",
    title: "Main Blvd Pass B (Day 14 - Follow-up Survey)",
    date: "2026-08-15 03:40 PM",
    operator: "Citizen Survey Probe #04 (Mobile Cam 4K)",
    locationName: "FAST NUCES Perimeter Road - West Sector",
    startGps: { lat: 31.478520, lng: 74.305180 },
    endGps: { lat: 31.482510, lng: 74.309490 },
    durationSec: 15,
    speedKmh: 38,
    gpsAccuracyMeters: 3.4,
    potholes: [
      {
        id: "P201",
        scanId: "SCAN-2026-08-15-B",
        frameNo: 42,
        timeSec: 2.8,
        // Corresponding to P101 (with ~1.8 meter consumer GPS drift)
        lat: 31.478932,
        lng: 74.305622,
        confidence: 0.95,
        severity: "HIGH",
        estimatedAreaCm2: 980, // Expanded by ~15% (worsening!)
        depthCm: 7.1,
        bbox: { x: 0.38, y: 0.54, width: 0.24, height: 0.20 },
        notes: "Persistent defect P101. Deteriorated after rainfall."
      },
      {
        id: "P202",
        scanId: "SCAN-2026-08-15-B",
        frameNo: 88,
        timeSec: 5.9,
        // Corresponding to P102 (with ~1.2 meter GPS drift)
        lat: 31.479572,
        lng: 74.306348,
        confidence: 0.91,
        severity: "HIGH", // Increased from Medium to High
        estimatedAreaCm2: 710, // Expanded!
        depthCm: 5.4,
        bbox: { x: 0.50, y: 0.60, width: 0.18, height: 0.15 },
        notes: "Persistent defect P102. Significant structural deterioration."
      },
      // Note: P103 was REPAIRED by municipal authority before Scan 2 (so missing in Scan 2!)
      {
        id: "P204",
        scanId: "SCAN-2026-08-15-B",
        frameNo: 168,
        timeSec: 11.2,
        // Corresponding to P104 (with ~2.1 meter GPS drift)
        lat: 31.4781260,
        lng: 74.308162,
        confidence: 0.86,
        severity: "LOW",
        estimatedAreaCm2: 280,
        depthCm: 2.3,
        bbox: { x: 0.61, y: 0.64, width: 0.13, height: 0.11 },
        notes: "Persistent defect P104. Stable condition."
      },
      {
        id: "P205",
        scanId: "SCAN-2026-08-15-B",
        frameNo: 205,
        timeSec: 13.7,
        // Corresponding to P105 (with ~1.5 meter GPS drift)
        lat: 31.482092,
        lng: 74.309012,
        confidence: 0.90,
        severity: "MEDIUM",
        estimatedAreaCm2: 610,
        depthCm: 4.6,
        bbox: { x: 0.42, y: 0.58, width: 0.19, height: 0.15 },
        notes: "Persistent defect P105. Stable."
      },
      {
        id: "P206", // BRAND NEW POTHOLE!
        scanId: "SCAN-2026-08-15-B",
        frameNo: 140,
        timeSec: 9.3,
        lat: 31.480650,
        lng: 74.307520,
        confidence: 0.93,
        severity: "HIGH",
        estimatedAreaCm2: 780,
        depthCm: 5.8,
        bbox: { x: 0.45, y: 0.52, width: 0.20, height: 0.17 },
        notes: "NEW DEFECT: Pavement collapse near water utility pipe work."
      },
      {
        id: "P207", // BRAND NEW POTHOLE!
        scanId: "SCAN-2026-08-15-B",
        frameNo: 220,
        timeSec: 14.6,
        lat: 31.482380,
        lng: 74.309310,
        confidence: 0.84,
        severity: "LOW",
        estimatedAreaCm2: 310,
        depthCm: 2.5,
        bbox: { x: 0.30, y: 0.68, width: 0.14, height: 0.11 },
        notes: "NEW DEFECT: Early stage spalling near intersection."
      }
    ]
  }
};
