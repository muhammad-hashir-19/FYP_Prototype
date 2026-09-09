/**
 * RASTA Real Video Detector & Canvas Processing Engine
 * Processes uploaded road inspection videos, extracts frame pixels,
 * sends JPEG frames to the deployed YOLO detection API,
 * calculates GPS coordinates, and displays real detections.
 */

class RASTADetector {
  constructor(canvasId, videoId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.video = document.getElementById(videoId);

    this.isPlaying = false;
    this.currentTimeSec = 0;
    this.durationSec = 0;
    this.animFrameId = null;

    this.onTelemetryUpdate = null;
    this.onDetectionTrigger = null;

    this.showBoundingBoxes = true;
    this.activeDetections = [];
    this.detectedPotholes = [];
    this.isRealVideo = false;

    /*
     * IMPORTANT:
     * This is the deployed Render backend.
     * Do NOT use localhost here.
     */
    this.inferenceApiUrl =
      'https://fyp-prototype-0xdc.onrender.com/detect';

    this.inferenceInFlight = false;
    this.lastInferenceAt = 0;

    /*
     * Send approximately one frame every 700ms.
     */
    this.inferenceIntervalMs = 700;

    // Survey Road Route Endpoints
    this.startGps = {
      lat: 31.478920,
      lng: 74.305610
    };

    this.endGps = {
      lat: 31.482500,
      lng: 74.311200
    };

    this.gpsLog = [];

    this.setupVideoEvents();

    console.log(
      'RASTA detector initialized.'
    );

    console.log(
      'RASTA Detection API:',
      this.inferenceApiUrl
    );
  }

  setupVideoEvents() {
    if (!this.video) return;

    this.video.addEventListener('loadedmetadata', () => {
      this.durationSec = this.video.duration || 15;

      console.log(
        'RASTA video loaded. Duration:',
        this.durationSec
      );

      if (this.onTelemetryUpdate) {
        this.onTelemetryUpdate({
          timeSec: 0,
          durationSec: this.durationSec,
          gps: this.getCurrentGPS(0),
          speed: 35
        });
      }
    });

    this.video.addEventListener('ended', () => {
      this.pause();
    });
  }

  setStartEndGps(startLat, startLng, endLat, endLng) {
    this.startGps = {
      lat: parseFloat(startLat),
      lng: parseFloat(startLng)
    };

    this.endGps = {
      lat: parseFloat(endLat),
      lng: parseFloat(endLng)
    };
  }

  setGpsLog(csvData) {
    this.gpsLog = csvData;
  }

  loadVideoFile(file) {
    this.stop();

    const videoUrl = URL.createObjectURL(file);

    this.video.src = videoUrl;
    this.video.load();

    this.isRealVideo = true;

    this.lastInferenceAt = 0;
    this.inferenceInFlight = false;

    this.detectedPotholes = [];
    this.activeDetections = [];

    console.log(
      'RASTA video file loaded:',
      file.name,
      file.type,
      file.size
    );
  }

  play() {
    if (this.isPlaying) return;

    this.isPlaying = true;

    if (this.video && this.isRealVideo) {
      this.video.play().catch(e => {
        console.error(
          'RASTA video play error:',
          e
        );
      });
    }

    this.lastTimestamp = performance.now();

    this.loop();

    console.log('RASTA video playback started.');
  }

  pause() {
    this.isPlaying = false;

    if (this.video && this.isRealVideo) {
      this.video.pause();
    }

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  stop() {
    this.pause();

    if (this.video && this.isRealVideo) {
      this.video.currentTime = 0;
    }

    this.currentTimeSec = 0;

    this.renderFrame();
  }

  seek(timeSec) {
    this.currentTimeSec = Math.max(
      0,
      Math.min(
        timeSec,
        this.durationSec || 15
      )
    );

    if (this.video && this.isRealVideo) {
      this.video.currentTime =
        this.currentTimeSec;
    }

    this.renderFrame();
  }

  // Calculates GPS coordinates for any timestamp
  getCurrentGPS(timeSec) {
    if (this.gpsLog && this.gpsLog.length > 0) {
      const idx = Math.min(
        Math.floor(
          (timeSec /
            (this.durationSec || 1)) *
            this.gpsLog.length
        ),
        this.gpsLog.length - 1
      );

      return this.gpsLog[idx];
    }

    const progress =
      this.durationSec > 0
        ? timeSec / this.durationSec
        : 0;

    return {
      lat:
        this.startGps.lat +
        (this.endGps.lat -
          this.startGps.lat) *
          progress,

      lng:
        this.startGps.lng +
        (this.endGps.lng -
          this.startGps.lng) *
          progress
    };
  }

  loop() {
    if (!this.isPlaying) return;

    if (
      this.video &&
      this.isRealVideo
    ) {
      this.currentTimeSec =
        this.video.currentTime;

      this.durationSec =
        this.video.duration || 15;
    } else {
      const now = performance.now();

      const dt =
        (now - this.lastTimestamp) /
        1000;

      this.lastTimestamp = now;

      this.currentTimeSec += dt;
    }

    this.renderFrame();

    if (this.isPlaying) {
      this.animFrameId =
        requestAnimationFrame(
          () => this.loop()
        );
    }
  }

  renderFrame() {
    const width =
      (this.canvas.width = 1280);

    const height =
      (this.canvas.height = 720);

    const ctx = this.ctx;

    if (
      this.isRealVideo &&
      this.video.readyState >= 2
    ) {
      ctx.drawImage(
        this.video,
        0,
        0,
        width,
        height
      );

      this.analyzeVideoFrame(
        ctx,
        width,
        height,
        this.currentTimeSec
      );
    } else {
      ctx.fillStyle = '#0f172a';

      ctx.fillRect(
        0,
        0,
        width,
        height
      );

      ctx.fillStyle = '#94a3b8';

      ctx.font =
        '600 24px "Outfit", sans-serif';

      ctx.textAlign = 'center';

      ctx.fillText(
        'Please Upload a Road Inspection Video to Begin Detection',
        width / 2,
        height / 2 - 10
      );

      ctx.font =
        '16px "Inter", sans-serif';

      ctx.fillStyle = '#64748b';

      ctx.fillText(
        'Go to "1. Upload Inspection Video" tab and click Choose Video File',
        width / 2,
        height / 2 + 25
      );

      ctx.textAlign = 'left';
    }

    const currentGps =
      this.getCurrentGPS(
        this.currentTimeSec
      );

    if (this.onTelemetryUpdate) {
      this.onTelemetryUpdate({
        timeSec: this.currentTimeSec,
        durationSec:
          this.durationSec || 15,
        gps: currentGps,
        speed: 35
      });
    }
  }

  analyzeVideoFrame(
    ctx,
    width,
    height,
    timeSec
  ) {
    this.detectPotholeInFrame(
      ctx,
      width,
      height,
      timeSec
    );

    if (this.showBoundingBoxes) {
      this.detectedPotholes.forEach(
        ph => {
          const timeDiff =
            timeSec - ph.timeSec;

          if (
            timeDiff >= -0.5 &&
            timeDiff <= 2.5
          ) {
            this.drawBoundingBox(
              ctx,
              ph,
              width,
              height
            );
          }
        }
      );
    }
  }

  detectPotholeInFrame(
    ctx,
    width,
    height,
    timeSec
  ) {
    const now =
      performance.now();

    /*
     * Don't send another request while
     * the previous one is still running.
     */
    if (
      this.inferenceInFlight ||
      now - this.lastInferenceAt <
        this.inferenceIntervalMs
    ) {
      return;
    }

    this.inferenceInFlight = true;
    this.lastInferenceAt = now;

    /*
     * Convert the current video frame
     * into a JPEG image.
     */
    this.canvas.toBlob(
      async blob => {
        if (!blob) {
          console.error(
            'RASTA could not create JPEG frame.'
          );

          this.inferenceInFlight = false;
          return;
        }

        console.log(
          'RASTA sending frame to:',
          this.inferenceApiUrl,
          'Time:',
          timeSec.toFixed(2)
        );

        const formData =
          new FormData();

        formData.append(
          'file',
          blob,
          'rasta-frame.jpg'
        );

        try {
          /*
           * Send JPEG frame to Render.
           */
          const response =
            await fetch(
              this.inferenceApiUrl,
              {
                method: 'POST',
                body: formData
              }
            );

          /*
           * Read response as text first.
           * This gives us useful debugging
           * information if Render returns an error.
           */
          const responseText =
            await response.text();

          if (!response.ok) {
            throw new Error(
              `Detection API returned ${response.status}: ${responseText}`
            );
          }

          let payload;

          try {
            payload =
              JSON.parse(
                responseText
              );
          } catch (jsonError) {
            throw new Error(
              `Invalid JSON returned by detection API: ${responseText}`
            );
          }

          /*
           * IMPORTANT DEBUG OUTPUT
           */
          console.log(
            'RASTA detection response:',
            payload
          );

          const detections =
            payload.detections || [];

          console.log(
            `RASTA detections found: ${detections.length}`
          );

          this.applyModelDetections(
            detections,
            timeSec,
            width,
            height,
            ctx
          );

        } catch (error) {
          console.error(
            'RASTA detection API error:',
            error
          );

        } finally {
          this.inferenceInFlight =
            false;
        }
      },
      'image/jpeg',
      0.82
    );
  }

  applyModelDetections(
    detections,
    timeSec,
    width,
    height,
    ctx
  ) {
    const gps =
      this.getCurrentGPS(
        timeSec
      );

    const currentDetections = [];

    detections.forEach(
      (detection, index) => {
        /*
         * Backend coordinates are based on
         * the 1280x720 image sent from canvas.
         */
        const box = {
          x: Math.max(
            0,
            detection.x1 / width
          ),

          y: Math.max(
            0,
            detection.y1 / height
          ),

          width: Math.min(
            1,
            (detection.x2 -
              detection.x1) /
              width
          ),

          height: Math.min(
            1,
            (detection.y2 -
              detection.y1) /
              height
          )
        };

        const areaRatio =
          box.width *
          box.height;

        const confidence =
          Number(
            detection.confidence
          ) || 0;

        const severity =
          confidence >= 0.85 ||
          areaRatio >= 0.08
            ? 'HIGH'
            : confidence >= 0.6
              ? 'MEDIUM'
              : 'LOW';

        const existing =
          this.detectedPotholes.find(
            pothole =>
              Math.abs(
                pothole.timeSec -
                  timeSec
              ) < 1.5 &&
              this.boxIoU(
                pothole.bbox,
                box
              ) > 0.2
          );

        const pothole =
          existing || {
            id: `PTH-${String(
              this.detectedPotholes
                .length + 1
            ).padStart(3, '0')}`,

            timeSec:
              Number(
                timeSec.toFixed(1)
              ),

            frameNo:
              Math.floor(
                timeSec * 30
              ),

            lat: gps.lat,
            lng: gps.lng,

            estimatedAreaCm2:
              Math.max(
                250,
                Math.round(
                  areaRatio *
                    12000
                )
              ),

            depthCm:
              severity === 'HIGH'
                ? 6.5
                : severity === 'MEDIUM'
                  ? 4.2
                  : 2.5,

            thumbUrl:
              this.cropCanvasFrameSnapshot(
                ctx,
                detection.x1,
                detection.y1,
                detection.x2 -
                  detection.x1,
                detection.y2 -
                  detection.y1,
                width,
                height
              ),

            recommendation:
              severity === 'HIGH'
                ? 'Urgent: Execute hot-mix asphalt patching within 24-48 hours.'
                : severity === 'MEDIUM'
                  ? 'Medium: Apply bitumen crack filler within 7 business days.'
                  : 'Routine Monitor - Inspect next quarterly maintenance pass.'
          };

        pothole.bbox = box;

        pothole.confidence =
          Number(
            confidence.toFixed(2)
          );

        pothole.severity =
          severity;

        pothole.timeSec =
          Number(
            timeSec.toFixed(1)
          );

        pothole.lat =
          gps.lat;

        pothole.lng =
          gps.lng;

        pothole.className =
          detection.class_name;

        if (!existing) {
          this.detectedPotholes.push(
            pothole
          );

          console.log(
            'RASTA NEW POTHOLE:',
            pothole
          );
        }

        currentDetections.push(
          pothole
        );
      }
    );

    this.activeDetections =
      currentDetections;

    if (
      this.onDetectionTrigger &&
      currentDetections.length > 0
    ) {
      this.onDetectionTrigger(
        currentDetections[0],
        this.detectedPotholes
      );
    }
  }

  boxIoU(first, second) {
    const x1 = Math.max(
      first.x,
      second.x
    );

    const y1 = Math.max(
      first.y,
      second.y
    );

    const x2 = Math.min(
      first.x +
        first.width,
      second.x +
        second.width
    );

    const y2 = Math.min(
      first.y +
        first.height,
      second.y +
        second.height
    );

    const intersection =
      Math.max(
        0,
        x2 - x1
      ) *
      Math.max(
        0,
        y2 - y1
      );

    const union =
      first.width *
        first.height +
      second.width *
        second.height -
      intersection;

    return union > 0
      ? intersection / union
      : 0;
  }

  cropCanvasFrameSnapshot(
    ctx,
    x,
    y,
    w,
    h,
    stageW,
    stageH
  ) {
    const tempCanvas =
      document.createElement(
        'canvas'
      );

    tempCanvas.width = 200;
    tempCanvas.height = 140;

    const tCtx =
      tempCanvas.getContext(
        '2d'
      );

    const cropX =
      Math.max(
        0,
        x - 20
      );

    const cropY =
      Math.max(
        0,
        y - 20
      );

    const cropW =
      Math.min(
        stageW - cropX,
        w + 40
      );

    const cropH =
      Math.min(
        stageH - cropY,
        h + 40
      );

    try {
      tCtx.drawImage(
        this.canvas,
        cropX,
        cropY,
        cropW,
        cropH,
        0,
        0,
        200,
        140
      );

      tCtx.strokeStyle =
        '#E2793D';

      tCtx.lineWidth = 2;

      tCtx.strokeRect(
        10,
        10,
        180,
        120
      );

      return tempCanvas.toDataURL(
        'image/jpeg',
        0.85
      );

    } catch (e) {
      console.error(
        'RASTA snapshot error:',
        e
      );

      return '';
    }
  }

  drawBoundingBox(
    ctx,
    ph,
    width,
    height
  ) {
    const boxX =
      ph.bbox.x *
      width;

    const boxY =
      ph.bbox.y *
      height;

    const boxW =
      ph.bbox.width *
      width;

    const boxH =
      ph.bbox.height *
      height;

    const strokeColor =
      ph.severity === 'HIGH'
        ? '#E24B4A'
        : ph.severity === 'MEDIUM'
          ? '#EF9F27'
          : '#639922';

    ctx.save();

    ctx.strokeStyle =
      strokeColor;

    ctx.lineWidth = 3;

    ctx.strokeRect(
      boxX,
      boxY,
      boxW,
      boxH
    );

    const cl = 14;

    ctx.fillStyle =
      strokeColor;

    ctx.fillRect(
      boxX - 2,
      boxY - 2,
      cl,
      3
    );

    ctx.fillRect(
      boxX - 2,
      boxY - 2,
      3,
      cl
    );

    ctx.fillRect(
      boxX +
        boxW -
        cl +
        2,
      boxY - 2,
      cl,
      3
    );

    ctx.fillRect(
      boxX +
        boxW -
        1,
      boxY - 2,
      3,
      cl
    );

    ctx.fillStyle =
      strokeColor;

    ctx.fillRect(
      boxX,
      boxY - 26,
      180,
      26
    );

    ctx.fillStyle =
      '#040914';

    ctx.font =
      'bold 12px "JetBrains Mono", monospace';

    ctx.fillText(
      `POTHOLE #${ph.id} (${(
        ph.confidence * 100
      ).toFixed(0)}%)`,
      boxX + 6,
      boxY - 8
    );

    ctx.fillStyle =
      'rgba(7, 10, 18, 0.9)';

    ctx.fillRect(
      boxX,
      boxY + boxH + 4,
      230,
      22
    );

    ctx.fillStyle =
      '#E2793D';

    ctx.font =
      '11px "JetBrains Mono", monospace';

    ctx.fillText(
      `GPS: ${ph.lat.toFixed(
        6
      )}, ${ph.lng.toFixed(6)}`,
      boxX + 6,
      boxY + boxH + 19
    );

    ctx.restore();
  }
}

window.RASTADetector =
  RASTADetector;
