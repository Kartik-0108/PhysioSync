import { FilesetResolver, PoseLandmarker, DrawingUtils, NormalizedLandmark } from '@mediapipe/tasks-vision';

// Suppress the specific XNNPACK info log from MediaPipe (which comes from the Wasm core)
const suppressXNNPACK = (originalMethod: any) => {
  return (...args: any[]) => {
    // Convert all arguments to a single string to check for the message
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
    if (msg.includes('Created TensorFlow Lite XNNPACK delegate for CPU')) {
      return; // Suppress this specific message
    }
    originalMethod(...args);
  };
};

console.log = suppressXNNPACK(console.log);
console.info = suppressXNNPACK(console.info);
console.warn = suppressXNNPACK(console.warn);
console.error = suppressXNNPACK(console.error);

export class PoseEstimator {
  private poseLandmarker: PoseLandmarker | null = null;
  private runningMode: "IMAGE" | "VIDEO" = "VIDEO";
  private previousLandmarks: NormalizedLandmark[] | null = null;
  private landmarksHistory: NormalizedLandmark[][] = [];
  private historySize = 5; // Moving average over 5 frames
  private smoothingFactor = 0.7; // Higher = more smoothing
  private minConfidence = 0.65; // Filter low confidence points

  async initialize() {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );
    this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "GPU"
      },
      runningMode: this.runningMode,
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
  }

  detectVideo(videoElement: HTMLVideoElement, timestamp: number) {
    if (!this.poseLandmarker) return null;
    const results = this.poseLandmarker.detectForVideo(videoElement, timestamp);
    
    // Apply Smoothing and Filtering
    if (results && results.landmarks && results.landmarks.length > 0) {
      const currentLandmarks = results.landmarks[0];
      const smoothedLandmarks: NormalizedLandmark[] = [];
      
      // Add to history for moving average
      this.landmarksHistory.push([...currentLandmarks]);
      if (this.landmarksHistory.length > this.historySize) {
        this.landmarksHistory.shift();
      }

      for (let i = 0; i < currentLandmarks.length; i++) {
        const currentPoint = currentLandmarks[i];
        
        // Filter low confidence points by using previous if available
        let pointToUse = currentPoint;
        if (currentPoint.visibility && currentPoint.visibility < this.minConfidence && this.previousLandmarks) {
           pointToUse = this.previousLandmarks[i];
        }

        // Moving Average Calculation
        let avgX = 0, avgY = 0, avgZ = 0, count = 0;
        for (const historyFrame of this.landmarksHistory) {
            const histPoint = historyFrame[i];
            if (histPoint.visibility && histPoint.visibility >= this.minConfidence) {
                avgX += histPoint.x;
                avgY += histPoint.y;
                avgZ += histPoint.z || 0;
                count++;
            }
        }

        if (count > 0) {
            avgX /= count;
            avgY /= count;
            avgZ /= count;
        } else {
            avgX = pointToUse.x;
            avgY = pointToUse.y;
            avgZ = pointToUse.z || 0;
        }

        // EMA Smoothing + Stability Lock (reduce jitter for small movements)
        if (this.previousLandmarks) {
          const prev = this.previousLandmarks[i];
          const dist = Math.sqrt(Math.pow(avgX - prev.x, 2) + Math.pow(avgY - prev.y, 2));
          
          // If movement is very small, lock it to reduce jitter
          if (dist < 0.002) {
             avgX = prev.x;
             avgY = prev.y;
             avgZ = prev.z || 0;
          } else {
             avgX = prev.x * this.smoothingFactor + avgX * (1 - this.smoothingFactor);
             avgY = prev.y * this.smoothingFactor + avgY * (1 - this.smoothingFactor);
             avgZ = (prev.z || 0) * this.smoothingFactor + avgZ * (1 - this.smoothingFactor);
          }
        }

        smoothedLandmarks.push({
          x: avgX,
          y: avgY,
          z: avgZ,
          visibility: pointToUse.visibility
        });
      }
      
      this.previousLandmarks = smoothedLandmarks.map(l => ({ ...l })); // Deep copy
      
      // Create a new results object to avoid modifying read-only properties
      return {
        ...results,
        landmarks: [smoothedLandmarks]
      };
    } else {
      this.previousLandmarks = null;
      this.landmarksHistory = [];
    }
    
    return results;
  }

  calculateAngle(a: any, b: any, c: any) {
    // Calculate 2D angle with normalized coordinates
    // We normalize by the distance between a and c to make it scale-invariant
    const distAC = Math.sqrt(Math.pow(c.x - a.x, 2) + Math.pow(c.y - a.y, 2)) || 1;
    
    const ax = a.x / distAC;
    const ay = a.y / distAC;
    const bx = b.x / distAC;
    const by = b.y / distAC;
    const cx = c.x / distAC;
    const cy = c.y / distAC;

    const radians = Math.atan2(cy - by, cx - bx) - Math.atan2(ay - by, ax - bx);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) {
      angle = 360 - angle;
    }
    return angle;
  }

  // 3D angle calculation for more precise movements (e.g., spine extension)
  calculateAngle3D(a: any, b: any, c: any) {
    const v1 = { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) };
    const v2 = { x: c.x - b.x, y: c.y - b.y, z: (c.z || 0) - (b.z || 0) };
    
    const dotProduct = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
    
    if (mag1 === 0 || mag2 === 0) return 0;
    
    const cosTheta = Math.max(-1, Math.min(1, dotProduct / (mag1 * mag2)));
    return Math.acos(cosTheta) * (180.0 / Math.PI);
  }

  draw(canvas: HTMLCanvasElement, results: any, incorrectJoints: number[] = []) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const time = Date.now();
    const pulse = Math.sin(time / 150) * 0.5 + 0.5; // 0 to 1

    if (results.landmarks) {
      for (const landmark of results.landmarks) {
        const connections = PoseLandmarker.POSE_CONNECTIONS;
        
        // Draw connections
        ctx.lineWidth = 8; // Thicker lines
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (const connection of connections) {
          const start = landmark[connection.start];
          const end = landmark[connection.end];
          
          if (start && end && start.visibility && start.visibility > this.minConfidence && end.visibility && end.visibility > this.minConfidence) {
            const isIncorrect = incorrectJoints.includes(connection.start) || incorrectJoints.includes(connection.end);
            
            ctx.beginPath();
            ctx.moveTo(start.x * canvas.width, start.y * canvas.height);
            ctx.lineTo(end.x * canvas.width, end.y * canvas.height);
            
            if (isIncorrect) {
              ctx.strokeStyle = `rgba(239, 68, 68, ${0.9 + pulse * 0.1})`; // Red with pulse
            } else {
              ctx.strokeStyle = 'rgba(16, 185, 129, 0.95)'; // Green
            }
            ctx.stroke();
          }
        }

        // Draw landmarks
        for (let i = 0; i < landmark.length; i++) {
          const point = landmark[i];
          if (point.visibility && point.visibility > this.minConfidence) {
            const isIncorrect = incorrectJoints.includes(i);
            ctx.beginPath();
            
            const z = point.z || 0;
            // Larger joints
            let radius = Math.max(6, Math.min(12, 12 - (z + 0.15) * (6 / 0.25)));
            
            if (isIncorrect) {
              radius += pulse * 4; // Pulse size for incorrect joints
              ctx.fillStyle = '#ef4444';
            } else {
              ctx.fillStyle = '#10b981';
            }
            
            ctx.arc(point.x * canvas.width, point.y * canvas.height, radius, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.stroke();
          }
        }
      }
    }
  }
}
