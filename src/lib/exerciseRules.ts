import { PoseEstimator } from './poseEstimation';

export interface ExerciseState {
  isDown: boolean;
  reps: number;
  lastTime: number;
  repStartTime: number;
  totalFrames: number;
  correctFrames: number;
  paceStats: {
    tooFast: number;
    optimal: number;
    tooSlow: number;
  };
  faultFrames: Record<string, number>;
  // Generic state machine support
  phase?: 'start' | 'moving' | 'peak' | 'returning';
  repValid?: boolean;
  // Exercise specific
  squatState?: 'standing' | 'going_down' | 'bottom' | 'going_up';
  kneeAngle?: number;
  angleHistory?: number[];
  // Pace history for smoothing
  recentPaces: number[];
}

export interface RuleResult {
  isCorrect: boolean;
  feedback: string;
  repCompleted: boolean;
  incorrectJoints?: number[];
  repDuration?: number;
  paceClassification?: 'too-fast' | 'good' | 'too-slow';
}

export type ExerciseRuleFunction = (
  landmarks: any[],
  state: ExerciseState,
  poseEstimator: PoseEstimator,
  targetReps: number
) => RuleResult;

export const exerciseRules: Record<string, ExerciseRuleFunction> = {
  squat: (landmarks, state, poseEstimator, targetReps) => {
    // Helper for temporal consistency
    const checkFault = (faultId: string, condition: boolean, framesThreshold = 5) => {
      if (condition) {
        state.faultFrames[faultId] = (state.faultFrames[faultId] || 0) + 1;
        return state.faultFrames[faultId] >= framesThreshold;
      } else {
        state.faultFrames[faultId] = 0;
        return false;
      }
    };

    // Initialize custom state for squat if not present
    const s = state as any;
    if (!s.squatState) {
      s.squatState = 'standing'; // standing, going_down, bottom, going_up
      s.angleHistory = [];
      s.repValid = true;
    }

    // Determine which side is more visible (left or right)
    const leftVisibility = (landmarks[23]?.visibility || 0) + (landmarks[25]?.visibility || 0) + (landmarks[27]?.visibility || 0);
    const rightVisibility = (landmarks[24]?.visibility || 0) + (landmarks[26]?.visibility || 0) + (landmarks[28]?.visibility || 0);
    const useLeft = leftVisibility > rightVisibility;

    const hip = useLeft ? landmarks[23] : landmarks[24];
    const knee = useLeft ? landmarks[25] : landmarks[26];
    const ankle = useLeft ? landmarks[27] : landmarks[28];
    const shoulder = useLeft ? landmarks[11] : landmarks[12];
    const toe = useLeft ? landmarks[31] : landmarks[32];
    
    let isCorrect = true;
    let feedback = "Tracking active...";
    let repCompleted = false;
    const incorrectJoints: number[] = [];

    let repDuration: number | undefined;
    let paceClassification: 'too-fast' | 'good' | 'too-slow' | undefined;

    if (hip && knee && ankle && shoulder && toe &&
        hip.visibility > 0.5 && knee.visibility > 0.5 && ankle.visibility > 0.5) {
      
      const rawKneeAngle = poseEstimator.calculateAngle(hip, knee, ankle);
      const hipAngle = poseEstimator.calculateAngle(shoulder, hip, knee);
      const backAngle = poseEstimator.calculateAngle(shoulder, hip, ankle);

      // Apply smoothing to knee angle
      s.angleHistory.push(rawKneeAngle);
      if (s.angleHistory.length > 5) s.angleHistory.shift();
      const kneeAngle = s.angleHistory.reduce((a: number, b: number) => a + b, 0) / s.angleHistory.length;
      state.kneeAngle = kneeAngle;
      
      // 1. Fault Conditions
      const isLeaningForward = backAngle < 140; // Relaxed from 150
      const isKneePastToe = Math.abs(knee.x - ankle.x) > Math.abs(toe.x - ankle.x) + 0.08; // Relaxed from 0.05
      
      const leftKneeAngle = poseEstimator.calculateAngle(landmarks[23], landmarks[25], landmarks[27]);
      const rightKneeAngle = poseEstimator.calculateAngle(landmarks[24], landmarks[26], landmarks[28]);
      const isUneven = leftVisibility > 2.0 && rightVisibility > 2.0 && Math.abs(leftKneeAngle - rightKneeAngle) > 25; // Relaxed from 20

      const shoulderWidth = Math.abs(landmarks[11].x - landmarks[12].x);
      const stanceWidth = Math.abs(landmarks[27].x - landmarks[28].x);
      const isStanceTooNarrow = shoulderWidth > 0.1 && stanceWidth < shoulderWidth * 0.6; // Relaxed from 0.7
      const isStanceTooWide = shoulderWidth > 0.1 && stanceWidth > shoulderWidth * 1.6; // Relaxed from 1.5

      // Relaxed Multi-Condition Check: Require at least 2 out of 3 key angles to be "good"
      // Key angles: Knee, Hip, Back
      const isKneeGood = kneeAngle <= 115; // Tolerance buffer added (110 + 5)
      const isHipGood = hipAngle <= 115;
      const isBackGood = backAngle >= 140;

      const goodConditionsCount = [isKneeGood, isHipGood, isBackGood].filter(Boolean).length;
      const isFormAcceptable = goodConditionsCount >= 2;

      const currentFaults: string[] = [];
      
      if (checkFault('leaningForward', isLeaningForward)) {
        currentFaults.push("Keep back straight");
        incorrectJoints.push(11, 12, 23, 24);
      }
      if (checkFault('kneePastToe', isKneePastToe)) {
        currentFaults.push("Knees behind toes");
        incorrectJoints.push(25, 26, 27, 28, 31, 32);
      }
      if (checkFault('uneven', isUneven)) {
        currentFaults.push("Keep movement even");
        incorrectJoints.push(23, 24, 25, 26);
      }

      // Only invalidate rep if form is really bad (e.g., multiple faults or extremely poor angles)
      if (s.squatState !== 'standing' && currentFaults.length >= 2) {
        s.repValid = false;
      }

      // State Machine Logic
      // Thresholds: Bottom (70-110), Standing (160-180)
      if (s.squatState === 'standing') {
        feedback = "Ready. Squat down.";
        if (kneeAngle < 150) {
          s.squatState = 'going_down';
          state.repStartTime = Date.now();
          s.repValid = true;
          state.isDown = true;
        }
      } else if (s.squatState === 'going_down') {
        feedback = "Go lower...";
        if (kneeAngle < 110) {
          s.squatState = 'bottom';
        } else if (kneeAngle > 165) {
          s.squatState = 'standing';
          state.isDown = false;
        }
      } else if (s.squatState === 'bottom') {
        feedback = "Good depth! Now stand up.";
        if (kneeAngle > 115) {
          s.squatState = 'going_up';
        }
        // Check for "too deep" fault but don't necessarily block the rep unless extreme
        if (kneeAngle < 60) {
          feedback = "Too deep! Rise up.";
        }
      } else if (s.squatState === 'going_up') {
        feedback = "Stand up completely.";
        if (kneeAngle > 160) {
          repDuration = (Date.now() - state.repStartTime) / 1000;
          
          // Squat Pace: 1.5s - 4s
          if (repDuration < 1.5) paceClassification = 'too-fast';
          else if (repDuration > 4.0) paceClassification = 'too-slow';
          else paceClassification = 'good';

          if (s.repValid) {
            repCompleted = true;
            feedback = paceClassification === 'good' ? "Good squat!" : (paceClassification === 'too-fast' ? "Too fast! Slow down." : "Too slow! Speed up.");
          } else {
            feedback = "Focus on form next time.";
          }
          s.squatState = 'standing';
          state.isDown = false;
        }
      }

      // Debug Visualization in Feedback
      const debugInfo = `[${s.squatState.toUpperCase()}] Angle: ${Math.round(kneeAngle)}°`;
      feedback = `${debugInfo} | ${currentFaults.length > 0 ? currentFaults.join(" | ") : feedback}`;

    } else {
      feedback = "Step back for full visibility";
      isCorrect = false;
    }

    return { isCorrect, feedback, repCompleted, incorrectJoints, repDuration, paceClassification };
  },

  arm_raise: (landmarks, state, poseEstimator, targetReps) => {
    const checkFault = (faultId: string, condition: boolean, framesThreshold = 5) => {
      if (condition) {
        state.faultFrames[faultId] = (state.faultFrames[faultId] || 0) + 1;
        return state.faultFrames[faultId] >= framesThreshold;
      } else {
        state.faultFrames[faultId] = 0;
        return false;
      }
    };

    const s = state as any;
    if (!s.armState) {
      s.armState = 'start'; // start, moving, peak, returning
      s.repValid = true;
    }

    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftElbow = landmarks[13];
    const rightElbow = landmarks[14];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    
    let isCorrect = true;
    let feedback = "Tracking active...";
    let repCompleted = false;
    const incorrectJoints: number[] = [];
    let repDuration: number | undefined;
    let paceClassification: 'too-fast' | 'good' | 'too-slow' | undefined;

    if (leftShoulder && rightShoulder && leftElbow && rightElbow && leftWrist && rightWrist && leftHip && rightHip && 
        leftShoulder.visibility > 0.5 && rightShoulder.visibility > 0.5 && 
        leftElbow.visibility > 0.5 && rightElbow.visibility > 0.5) {
        
      // 1. Shoulder Angles (Hip -> Shoulder -> Elbow)
      const leftShoulderAngle = poseEstimator.calculateAngle(leftHip, leftShoulder, leftElbow);
      const rightShoulderAngle = poseEstimator.calculateAngle(rightHip, rightShoulder, rightElbow);
      
      // 2. Elbow Angles (Shoulder -> Elbow -> Wrist)
      const leftElbowAngle = poseEstimator.calculateAngle(leftShoulder, leftElbow, leftWrist);
      const rightElbowAngle = poseEstimator.calculateAngle(rightShoulder, rightElbow, rightWrist);

      // 3. Back Angle (Shoulder -> Hip -> Ankle)
      const leftBackAngle = leftAnkle && leftAnkle.visibility > 0.5 ? poseEstimator.calculateAngle(leftShoulder, leftHip, leftAnkle) : 180;
      const rightBackAngle = rightAnkle && rightAnkle.visibility > 0.5 ? poseEstimator.calculateAngle(rightShoulder, rightHip, rightAnkle) : 180;

      // --- ERROR DETECTION ---
      const isSwinging = leftBackAngle < 160 || rightBackAngle < 160;
      const isElbowBent = leftElbowAngle < 140 || rightElbowAngle < 140;
      const isUneven = Math.abs(leftShoulderAngle - rightShoulderAngle) > 20 && Math.max(leftShoulderAngle, rightShoulderAngle) > 40;
      const isTooHigh = leftShoulderAngle > 110 || rightShoulderAngle > 110;

      const currentFaults: string[] = [];
      
      if (checkFault('swinging', isSwinging)) {
        currentFaults.push("Keep back straight");
        incorrectJoints.push(11, 12, 23, 24);
      }
      if (checkFault('elbowBent', isElbowBent)) {
        currentFaults.push("Keep arms straighter");
        if (leftElbowAngle < 140) incorrectJoints.push(11, 13, 15);
        if (rightElbowAngle < 140) incorrectJoints.push(12, 14, 16);
      }
      if (checkFault('unevenArms', isUneven)) {
        currentFaults.push("Keep arms even");
        if (leftShoulderAngle > rightShoulderAngle) incorrectJoints.push(11, 13);
        else incorrectJoints.push(12, 14);
      }
      if (checkFault('tooHigh', isTooHigh)) {
        currentFaults.push("Stop at shoulder level");
        if (leftShoulderAngle > 110) incorrectJoints.push(11, 13);
        if (rightShoulderAngle > 110) incorrectJoints.push(12, 14);
      }

      if (currentFaults.length > 0) {
        feedback = currentFaults.join(" | ");
      }

      if (s.armState !== 'start' && currentFaults.length >= 2) {
        s.repValid = false;
      }

      // --- STATE MACHINE & PACE ---
      const avgShoulderAngle = (leftShoulderAngle + rightShoulderAngle) / 2;

      if (s.armState === 'start') {
        feedback = "Ready. Raise arms to the side.";
        if (avgShoulderAngle > 30) {
          s.armState = 'moving';
          state.repStartTime = Date.now();
          s.repValid = true;
          state.isDown = true;
        }
      } else if (s.armState === 'moving') {
        feedback = "Keep raising...";
        if (avgShoulderAngle >= 80) {
          s.armState = 'peak';
        } else if (avgShoulderAngle < 25) {
          s.armState = 'start';
          state.isDown = false;
        }
      } else if (s.armState === 'peak') {
        feedback = "Good height! Now lower slowly.";
        if (avgShoulderAngle < 75) {
          s.armState = 'returning';
        }
      } else if (s.armState === 'returning') {
        feedback = "Lower your arms completely.";
        if (avgShoulderAngle < 30) {
          repDuration = (Date.now() - state.repStartTime) / 1000;
          
          // Arm Raise Pace: 1s - 3s
          if (repDuration < 1.0) paceClassification = 'too-fast';
          else if (repDuration > 3.0) paceClassification = 'too-slow';
          else paceClassification = 'good';

          if (s.repValid) {
            repCompleted = true;
            feedback = paceClassification === 'good' ? "Good job!" : (paceClassification === 'too-fast' ? "Too fast! Slow down." : "Too slow! Speed up.");
          } else {
            feedback = "Rep invalid due to poor posture.";
          }
          s.armState = 'start';
          state.isDown = false;
        }
      }

    } else {
      feedback = "Step back for full visibility";
      isCorrect = false;
    }

    return { isCorrect, feedback, repCompleted, incorrectJoints, repDuration, paceClassification };
  },

  knee_bend: (landmarks, state, poseEstimator, targetReps) => {
    const checkFault = (faultId: string, condition: boolean, framesThreshold = 5) => {
      if (condition) {
        state.faultFrames[faultId] = (state.faultFrames[faultId] || 0) + 1;
        return state.faultFrames[faultId] >= framesThreshold;
      } else {
        state.faultFrames[faultId] = 0;
        return false;
      }
    };

    const leftHip = landmarks[23];
    const leftKnee = landmarks[25];
    const leftAnkle = landmarks[27];
    const leftShoulder = landmarks[11];
    
    const rightHip = landmarks[24];
    const rightKnee = landmarks[26];
    const rightAnkle = landmarks[28];
    const rightShoulder = landmarks[12];
    
    let isCorrect = true;
    let feedback = "Tracking active...";
    let repCompleted = false;
    const incorrectJoints: number[] = [];
    let repDuration: number | undefined;
    let paceClassification: 'too-fast' | 'good' | 'too-slow' | undefined;

    // Initialize custom state for knee bend
    const s = state as any;
    if (!s.kbState) {
      s.kbState = 'standing'; // standing, bending, top_position, returning
      s.activeLeg = null; // 'left' or 'right'
      s.leftReps = 0;
      s.rightReps = 0;
      s.repValid = true;
      s.repStartTime = 0;
    }

    if (leftHip && leftKnee && leftAnkle && rightHip && rightKnee && rightAnkle && leftShoulder && rightShoulder &&
        (leftKnee.visibility > 0.65 || rightKnee.visibility > 0.65)) {
        
      const leftKneeAngle = poseEstimator.calculateAngle(leftHip, leftKnee, leftAnkle);
      const rightKneeAngle = poseEstimator.calculateAngle(rightHip, rightKnee, rightAnkle);
      
      const leftHipAngle = poseEstimator.calculateAngle(leftShoulder, leftHip, leftKnee);
      const rightHipAngle = poseEstimator.calculateAngle(rightShoulder, rightHip, rightKnee);

      // Determine active leg based on which knee is bending more
      let currentActiveLeg = s.activeLeg;
      
      if (s.kbState === 'standing') {
        if (leftKneeAngle < 150 && rightKneeAngle > 160) {
          currentActiveLeg = 'left';
        } else if (rightKneeAngle < 150 && leftKneeAngle > 160) {
          currentActiveLeg = 'right';
        } else {
          currentActiveLeg = null;
        }
      }

      const activeKneeAngle = currentActiveLeg === 'left' ? leftKneeAngle : (currentActiveLeg === 'right' ? rightKneeAngle : Math.min(leftKneeAngle, rightKneeAngle));
      const activeHipAngle = currentActiveLeg === 'left' ? leftHipAngle : (currentActiveLeg === 'right' ? rightHipAngle : Math.min(leftHipAngle, rightHipAngle));
      const standingKneeAngle = currentActiveLeg === 'left' ? rightKneeAngle : (currentActiveLeg === 'right' ? leftKneeAngle : Math.max(leftKneeAngle, rightKneeAngle));
      const standingHipAngle = currentActiveLeg === 'left' ? rightHipAngle : (currentActiveLeg === 'right' ? leftHipAngle : Math.max(leftHipAngle, rightHipAngle));

      const currentFaults: string[] = [];

      // Fault: Bending too much (knee angle < 45)
      if (checkFault('bendingTooMuch', activeKneeAngle < 45)) {
        currentFaults.push("Bending too much");
        isCorrect = false;
        incorrectJoints.push(currentActiveLeg === 'left' ? 25 : 26);
      }

      // Fault: Using hip instead of knee (hip angle < 140 while standing leg is straight)
      if (checkFault('usingHip', activeHipAngle < 140)) {
        currentFaults.push("Keep thigh straight, bend only knee");
        isCorrect = false;
        incorrectJoints.push(currentActiveLeg === 'left' ? 23 : 24);
      }

      // Fault: Standing leg is bending
      if (currentActiveLeg && checkFault('standingLegBent', standingKneeAngle < 150)) {
        currentFaults.push("Keep standing leg straight");
        isCorrect = false;
        incorrectJoints.push(currentActiveLeg === 'left' ? 26 : 25);
      }
      
      // Fault: Leaning forward (torso angle)
      const torsoAngle = poseEstimator.calculateAngle(
        currentActiveLeg === 'left' ? rightShoulder : leftShoulder, 
        currentActiveLeg === 'left' ? rightHip : leftHip, 
        currentActiveLeg === 'left' ? rightAnkle : leftAnkle
      );
      if (checkFault('leaningForward', torsoAngle < 160)) {
        currentFaults.push("Keep torso upright");
        isCorrect = false;
        incorrectJoints.push(11, 12, 23, 24);
      }

      if (currentFaults.length > 0) {
        feedback = currentFaults.join(" | ");
      }

      if (s.kbState !== 'standing' && !isCorrect) {
        s.repValid = false;
      }

      // State Machine
      if (s.kbState === 'standing') {
        feedback = "Stand straight. Bend one knee backward.";
        if (activeKneeAngle < 150 && standingKneeAngle > 160) {
          s.kbState = 'bending';
          s.activeLeg = currentActiveLeg;
          s.repValid = true;
          state.repStartTime = Date.now();
        }
      } else if (s.kbState === 'bending') {
        feedback = `Bending ${s.activeLeg} knee...`;
        if (activeKneeAngle < 90) {
          s.kbState = 'top_position';
        } else if (activeKneeAngle > 160) {
          // Aborted
          s.kbState = 'standing';
          s.activeLeg = null;
        }
      } else if (s.kbState === 'top_position') {
        feedback = "Hold... Now return slowly.";
        if (activeKneeAngle > 110) {
          s.kbState = 'returning';
        }
      } else if (s.kbState === 'returning') {
        feedback = "Returning to start...";
        if (activeKneeAngle > 160) {
          repDuration = (Date.now() - state.repStartTime) / 1000;
          
          // Knee Bend Pace: 1.5s - 4s
          if (repDuration < 1.5) paceClassification = 'too-fast';
          else if (repDuration > 4.0) paceClassification = 'too-slow';
          else paceClassification = 'good';

          if (s.repValid) {
            repCompleted = true;
            if (s.activeLeg === 'left') s.leftReps++;
            if (s.activeLeg === 'right') s.rightReps++;
            feedback = paceClassification === 'good' ? `Good job! (${s.activeLeg} leg)` : (paceClassification === 'too-fast' ? "Too fast! Slow down." : "Too slow! Speed up.");
          } else {
            feedback = "Rep invalid due to poor form.";
          }
          s.kbState = 'standing';
          s.activeLeg = null;
        }
      }

      // Provide active leg info for UI
      s.currentActiveLeg = s.activeLeg;

    } else {
      feedback = "Please step back so legs are visible";
      isCorrect = false;
    }

    return { isCorrect, feedback, repCompleted, incorrectJoints, repDuration, paceClassification };
  },

  spine_extension: (landmarks, state, poseEstimator, targetReps) => {
    const checkFault = (faultId: string, condition: boolean, framesThreshold = 5) => {
      if (condition) {
        state.faultFrames[faultId] = (state.faultFrames[faultId] || 0) + 1;
        return state.faultFrames[faultId] >= framesThreshold;
      } else {
        state.faultFrames[faultId] = 0;
        return false;
      }
    };

    const shoulder = landmarks[11];
    const hip = landmarks[23];
    const knee = landmarks[25];
    const ankle = landmarks[27];
    
    let isCorrect = true;
    let feedback = "Tracking active...";
    let repCompleted = false;
    const incorrectJoints: number[] = [];
    let repDuration: number | undefined;
    let paceClassification: 'too-fast' | 'good' | 'too-slow' | undefined;

    if (shoulder && hip && knee && ankle && 
        shoulder.visibility > 0.65 && hip.visibility > 0.65 && knee.visibility > 0.65) {
      
      const extensionAngle = poseEstimator.calculateAngle(shoulder, hip, knee);
      const kneeAngle = poseEstimator.calculateAngle(hip, knee, ankle);
      
      const currentFaults: string[] = [];

      // 1. Check if knees are straight
      if (checkFault('kneesBent', kneeAngle < 160)) {
        currentFaults.push("Keep knees straight");
        incorrectJoints.push(25, 26);
      }
      // 2. Check extension depth
      if (checkFault('leaningTooFar', extensionAngle < 145)) {
        currentFaults.push("Leaning too far");
        incorrectJoints.push(11, 12, 23, 24);
      }
      
      if (currentFaults.length > 0) {
        feedback = currentFaults.join(" | ");
      }

      if (state.isDown && currentFaults.length >= 2) {
        (state as any).repValid = false;
      }

      if (extensionAngle < 160) {
        feedback = "Good extension! Now return slowly.";
        if (state.isDown) {
          repDuration = (Date.now() - state.repStartTime) / 1000;
          
          // Spine Extension Pace: 1.5s - 4s
          if (repDuration < 1.5) paceClassification = 'too-fast';
          else if (repDuration > 4.0) paceClassification = 'too-slow';
          else paceClassification = 'good';

          if ((state as any).repValid !== false) {
            repCompleted = true;
            feedback = paceClassification === 'good' ? "Good extension!" : (paceClassification === 'too-fast' ? "Too fast! Slow down." : "Too slow! Speed up.");
          } else {
            feedback = "Rep invalid due to poor posture.";
          }
          state.isDown = false;
          (state as any).repValid = true;
        }
      } else if (extensionAngle > 175) {
        feedback = "Slowly lean your upper body back";
        if (!state.isDown) {
          state.isDown = true;
          (state as any).repValid = isCorrect;
          state.repStartTime = Date.now();
        }
      } else {
        feedback = state.isDown ? "Keep leaning back gently..." : "Return to upright position...";
      }

      // Add extension angle for UI
      (state as any).extensionAngle = 180 - extensionAngle;
    } else {
      feedback = "Please step back so your side profile is visible";
      isCorrect = false;
    }

    return { isCorrect, feedback, repCompleted, incorrectJoints, repDuration, paceClassification };
  },

  neck_rotation: (landmarks, state, poseEstimator, targetReps) => {
    const checkFault = (faultId: string, condition: boolean, framesThreshold = 5) => {
      if (condition) {
        state.faultFrames[faultId] = (state.faultFrames[faultId] || 0) + 1;
        return state.faultFrames[faultId] >= framesThreshold;
      } else {
        state.faultFrames[faultId] = 0;
        return false;
      }
    };

    const nose = landmarks[0];
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    
    let isCorrect = true;
    let feedback = "Tracking active...";
    let repCompleted = false;
    const incorrectJoints: number[] = [];
    let repDuration: number | undefined;
    let paceClassification: 'too-fast' | 'good' | 'too-slow' | undefined;

    if (nose && leftEar && rightEar && leftShoulder && rightShoulder && 
        nose.visibility > 0.65 && leftEar.visibility > 0.5 && rightEar.visibility > 0.5) {
      
      // Calculate rotation ratio based on nose position between ears
      // 0.5 is center, < 0.5 is left, > 0.5 is right (approx)
      const earDist = Math.abs(rightEar.x - leftEar.x);
      const nosePos = (nose.x - leftEar.x) / (rightEar.x - leftEar.x);
      
      // Detect if shoulders are moving (they should stay still)
      const shoulderMovement = Math.abs(leftShoulder.y - rightShoulder.y);
      const currentFaults: string[] = [];

      if (checkFault('shouldersMoving', shoulderMovement > 0.05)) {
        currentFaults.push("Keep shoulders still");
        isCorrect = false;
        incorrectJoints.push(11, 12);
      }

      // Logic for rep counting: Center -> Right -> Center -> Left -> Center = 1 Rep
      const isRight = nosePos > 0.7;
      const isLeft = nosePos < 0.3;
      const isCenter = nosePos > 0.4 && nosePos < 0.6;

      if (!(state as any).neckState) {
        (state as any).neckState = 'center';
      }

      if (state.isDown && !isCorrect) {
        (state as any).repValid = false;
      }

      let repDuration: number | undefined;
      let paceClassification: 'too-fast' | 'good' | 'too-slow' | undefined;

      if (currentFaults.length > 0) {
        feedback = currentFaults.join(" | ");
      } else {
        if ((state as any).neckState === 'center') {
          feedback = "Look straight, then turn right";
          if (isRight) {
            (state as any).neckState = 'right';
            (state as any).repValid = isCorrect;
            state.repStartTime = Date.now();
            state.isDown = true;
          }
        } else if ((state as any).neckState === 'right') {
          feedback = "Hold, then return to center";
          if (isCenter) {
            (state as any).neckState = 'center_mid';
          }
        } else if ((state as any).neckState === 'center_mid') {
          feedback = "Now turn left";
          if (isLeft) {
            (state as any).neckState = 'left';
          }
        } else if ((state as any).neckState === 'left') {
          feedback = "Hold, then return to center";
          if (isCenter) {
            repDuration = (Date.now() - state.repStartTime) / 1000;
            
            // Neck Rotation Pace: 2s - 5s
            if (repDuration < 2.0) paceClassification = 'too-fast';
            else if (repDuration > 5.0) paceClassification = 'too-slow';
            else paceClassification = 'good';

            if ((state as any).repValid !== false) {
              repCompleted = true;
              feedback = paceClassification === 'good' ? "Good rotation!" : (paceClassification === 'too-fast' ? "Too fast! Slow down." : "Too slow! Speed up.");
            } else {
              feedback = "Rep invalid due to poor posture. Try again.";
            }
            (state as any).neckState = 'center';
            (state as any).repValid = true;
            state.isDown = false;
          }
        }
      }

      // Add rotation angle estimation for the UI
      const currentAngle = (nosePos - 0.5) * 180;
      (state as any).rotationAngle = currentAngle;
    } else {
      feedback = "Please ensure your face and shoulders are clearly visible";
      isCorrect = false;
    }

    return { isCorrect, feedback, repCompleted, incorrectJoints, repDuration, paceClassification };
  },

  full_body_stretch_old: (landmarks, state, poseEstimator, targetReps) => {
    const checkFault = (faultId: string, condition: boolean, framesThreshold = 5) => {
      if (condition) {
        state.faultFrames[faultId] = (state.faultFrames[faultId] || 0) + 1;
        return state.faultFrames[faultId] >= framesThreshold;
      } else {
        state.faultFrames[faultId] = 0;
        return false;
      }
    };

    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    
    let isCorrect = true;
    let feedback = "Tracking active...";
    let repCompleted = false;
    const incorrectJoints: number[] = [];

    let repDuration: number | undefined;
    let paceClassification: 'too-fast' | 'good' | 'too-slow' | undefined;

    if (leftWrist && rightWrist && leftShoulder && rightShoulder && leftHip && rightHip &&
        leftWrist.visibility > 0.5 && rightWrist.visibility > 0.5 && 
        leftShoulder.visibility > 0.5 && rightShoulder.visibility > 0.5) {
      
      const avgWristY = (leftWrist.y + rightWrist.y) / 2;
      const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;

      // Check if arms are straight (Elbow angle)
      const leftElbowAngle = poseEstimator.calculateAngle(leftShoulder, landmarks[13], leftWrist);
      const rightElbowAngle = poseEstimator.calculateAngle(rightShoulder, landmarks[14], rightWrist);

      const currentFaults: string[] = [];

      if (checkFault('armsNotStraight', leftElbowAngle < 150 || rightElbowAngle < 150)) {
        currentFaults.push("Keep arms straight");
        isCorrect = false;
        if (leftElbowAngle < 150) incorrectJoints.push(11, 13, 15);
        if (rightElbowAngle < 150) incorrectJoints.push(12, 14, 16);
      }
      
      if (currentFaults.length > 0) {
        feedback = currentFaults.join(" | ");
      }

      if (state.isDown && !isCorrect) {
        (state as any).repValid = false;
      }

      if (avgWristY > avgShoulderY - 0.1) {
        feedback = "Reach higher toward the ceiling!";
        if (state.isDown) {
          // If they were up and now they are down, they might be finishing a rep
          // but we only count it if they held it.
        }
      } else if (avgWristY < avgShoulderY - 0.25) {
        feedback = "Great reach! Hold for 5 seconds.";
        if (!state.isDown) {
          state.isDown = true;
          (state as any).repValid = isCorrect;
          state.repStartTime = Date.now();
        }
        
        // Check hold time
        const holdTime = (Date.now() - state.repStartTime) / 1000;
        if (holdTime >= 5) {
          feedback = "Excellent hold! Now lower your arms slowly.";
        }
      } else {
        feedback = "Keep reaching up...";
      }

      // Rep completion logic: must go up, hold, then come back down
      if (state.isDown && avgWristY > avgShoulderY) {
        const holdTime = (Date.now() - state.repStartTime) / 1000;
        if (holdTime >= 5) {
          if ((state as any).repValid !== false) {
            repCompleted = true;
          } else {
            feedback = "Rep invalid due to poor posture. Try again.";
          }
        } else {
          feedback = "Hold for the full 5 seconds next time!";
        }
        state.isDown = false;
        (state as any).repValid = true;
      }

    } else {
      feedback = "Please step back so your full upper body is visible";
      isCorrect = false;
    }

    return { isCorrect, feedback, repCompleted, incorrectJoints, repDuration, paceClassification };
  },

  push_up: (landmarks, state, poseEstimator, targetReps) => {
    const checkFault = (faultId: string, condition: boolean, framesThreshold = 5) => {
      if (condition) {
        state.faultFrames[faultId] = (state.faultFrames[faultId] || 0) + 1;
        return state.faultFrames[faultId] >= framesThreshold;
      } else {
        state.faultFrames[faultId] = 0;
        return false;
      }
    };

    const leftShoulder = landmarks[11];
    const leftElbow = landmarks[13];
    const leftWrist = landmarks[15];
    const leftHip = landmarks[23];
    const leftAnkle = landmarks[27];

    const rightShoulder = landmarks[12];
    const rightElbow = landmarks[14];
    const rightWrist = landmarks[16];
    const rightHip = landmarks[24];
    const rightAnkle = landmarks[28];

    // Determine which side is more visible to track
    const leftVisibility = (leftShoulder?.visibility || 0) + (leftElbow?.visibility || 0) + (leftWrist?.visibility || 0);
    const rightVisibility = (rightShoulder?.visibility || 0) + (rightElbow?.visibility || 0) + (rightWrist?.visibility || 0);

    const useLeft = leftVisibility > rightVisibility;

    const shoulder = useLeft ? leftShoulder : rightShoulder;
    const elbow = useLeft ? leftElbow : rightElbow;
    const wrist = useLeft ? leftWrist : rightWrist;
    const hip = useLeft ? leftHip : rightHip;
    const ankle = useLeft ? leftAnkle : rightAnkle;

    let isCorrect = true;
    let feedback = "Tracking active...";
    let repCompleted = false;
    const incorrectJoints: number[] = [];

    let repDuration: number | undefined;
    let paceClassification: 'too-fast' | 'good' | 'too-slow' | undefined;

    if (shoulder && elbow && wrist && hip && ankle && 
        shoulder.visibility > 0.65 && elbow.visibility > 0.65 && wrist.visibility > 0.65) {
      
      const elbowAngle = poseEstimator.calculateAngle(shoulder, elbow, wrist);
      const bodyAngle = poseEstimator.calculateAngle(shoulder, hip, ankle);

      const currentFaults: string[] = [];

      if (checkFault('bodyNotStraight', bodyAngle < 150 || bodyAngle > 210)) { 
        currentFaults.push("Keep body straight");
        isCorrect = false;
        incorrectJoints.push(11, 12, 23, 24, 27, 28); // Shoulders, hips, ankles
      }
      
      if (currentFaults.length > 0) {
        feedback = currentFaults.join(" | ");
      }

      if (state.isDown && !isCorrect) {
        (state as any).repValid = false;
      }

      let repDuration: number | undefined;
      let paceClassification: 'too-fast' | 'good' | 'too-slow' | undefined;

      if (elbowAngle < 90) {
        feedback = "Good depth! Push up.";
        if (!state.isDown) {
          state.isDown = true;
          (state as any).repValid = isCorrect;
          state.repStartTime = Date.now();
        }
      } else if (elbowAngle > 160) {
        feedback = "Lower your body";
        if (state.isDown) {
          repDuration = (Date.now() - state.repStartTime) / 1000;
          
          // Push Up Pace: 1.5s - 4s
          if (repDuration < 1.5) paceClassification = 'too-fast';
          else if (repDuration > 4.0) paceClassification = 'too-slow';
          else paceClassification = 'good';

          if ((state as any).repValid !== false) {
            repCompleted = true;
            feedback = paceClassification === 'good' ? "Good push up!" : (paceClassification === 'too-fast' ? "Too fast! Slow down." : "Too slow! Speed up.");
          } else {
            feedback = "Rep invalid due to poor posture. Try again.";
          }
          state.isDown = false;
          (state as any).repValid = true;
        }
      } else {
        feedback = state.isDown ? "Keep pushing up..." : "Keep lowering...";
      }
    } else {
      feedback = "Please position yourself so your side profile is visible";
      isCorrect = false;
    }

    return { isCorrect, feedback, repCompleted, incorrectJoints, repDuration, paceClassification };
  },

  bicep_curl: (landmarks, state, poseEstimator, targetReps) => {
    const checkFault = (faultId: string, condition: boolean, framesThreshold = 5) => {
      if (condition) {
        state.faultFrames[faultId] = (state.faultFrames[faultId] || 0) + 1;
        return state.faultFrames[faultId] >= framesThreshold;
      } else {
        state.faultFrames[faultId] = 0;
        return false;
      }
    };

    const leftShoulder = landmarks[11];
    const leftElbow = landmarks[13];
    const leftWrist = landmarks[15];
    
    const rightShoulder = landmarks[12];
    const rightElbow = landmarks[14];
    const rightWrist = landmarks[16];

    let isCorrect = true;
    let feedback = "Tracking active...";
    let repCompleted = false;
    const incorrectJoints: number[] = [];

    let repDuration: number | undefined;
    let paceClassification: 'too-fast' | 'good' | 'too-slow' | undefined;

    if (leftShoulder && leftElbow && leftWrist && rightShoulder && rightElbow && rightWrist && 
        (leftElbow.visibility > 0.65 || rightElbow.visibility > 0.65)) {
        
      const leftAngle = poseEstimator.calculateAngle(leftShoulder, leftElbow, leftWrist);
      const rightAngle = poseEstimator.calculateAngle(rightShoulder, rightElbow, rightWrist);
      
      // Track the arm that is bending the most
      const minAngle = Math.min(leftAngle, rightAngle);
      
      const currentFaults: string[] = [];

      if (checkFault('curlingTooMuch', minAngle < 30)) {
        currentFaults.push("Curling too much");
        isCorrect = false;
        incorrectJoints.push(13, 14); // Elbows
      }
      
      if (currentFaults.length > 0) {
        feedback = currentFaults.join(" | ");
      }

      if (state.isDown && !isCorrect) {
        (state as any).repValid = false;
      }

      if (minAngle > 150) {
        feedback = "Arms fully extended";
        if (state.isDown) {
          repDuration = (Date.now() - state.repStartTime) / 1000;
          
          // Bicep Curl Pace: 1.5s - 4s
          if (repDuration < 1.5) paceClassification = 'too-fast';
          else if (repDuration > 4.0) paceClassification = 'too-slow';
          else paceClassification = 'good';

          if ((state as any).repValid !== false) {
            repCompleted = true;
            feedback = paceClassification === 'good' ? "Good curl!" : (paceClassification === 'too-fast' ? "Too fast! Slow down." : "Too slow! Speed up.");
          } else {
            feedback = "Rep invalid due to poor posture. Try again.";
          }
          state.isDown = false;
          (state as any).repValid = true;
        }
      } else if (minAngle < 45) {
        feedback = "Good curl! Now lower slowly.";
        if (!state.isDown) {
          state.isDown = true;
          (state as any).repValid = isCorrect;
          state.repStartTime = Date.now();
        }
      } else {
        feedback = state.isDown ? "Keep lowering..." : "Keep curling...";
      }
    } else {
      feedback = "Please step back so your arms are visible";
      isCorrect = false;
    }

    return { isCorrect, feedback, repCompleted, incorrectJoints, repDuration, paceClassification };
  },

  lunge: (landmarks, state, poseEstimator, targetReps) => {
    const checkFault = (faultId: string, condition: boolean, framesThreshold = 5) => {
      if (condition) {
        state.faultFrames[faultId] = (state.faultFrames[faultId] || 0) + 1;
        return state.faultFrames[faultId] >= framesThreshold;
      } else {
        state.faultFrames[faultId] = 0;
        return false;
      }
    };

    const leftHip = landmarks[23];
    const leftKnee = landmarks[25];
    const leftAnkle = landmarks[27];
    const leftShoulder = landmarks[11];
    
    const rightHip = landmarks[24];
    const rightKnee = landmarks[26];
    const rightAnkle = landmarks[28];
    const rightShoulder = landmarks[12];

    let isCorrect = true;
    let feedback = "Tracking active...";
    let repCompleted = false;
    const incorrectJoints: number[] = [];

    let repDuration: number | undefined;
    let paceClassification: 'too-fast' | 'good' | 'too-slow' | undefined;

    if (leftHip && leftKnee && leftAnkle && rightHip && rightKnee && rightAnkle && 
        (leftKnee.visibility > 0.65 || rightKnee.visibility > 0.65)) {
        
      const leftAngle = poseEstimator.calculateAngle(leftHip, leftKnee, leftAnkle);
      const rightAngle = poseEstimator.calculateAngle(rightHip, rightKnee, rightAnkle);
      
      // Determine which leg is in front (lower knee angle)
      const isLeftFront = leftAngle < rightAngle;
      const frontKnee = isLeftFront ? leftKnee : rightKnee;
      const frontAnkle = isLeftFront ? leftAnkle : rightAnkle;
      const shoulder = isLeftFront ? leftShoulder : rightShoulder;
      const hip = isLeftFront ? leftHip : rightHip;
      
      const minAngle = Math.min(leftAngle, rightAngle);
      const maxAngle = Math.max(leftAngle, rightAngle);
      
      // 1. Check Torso Uprightness (Shoulder -> Hip -> Ankle/Knee)
      let isTorsoLeaning = false;
      if (shoulder && hip) {
        const torsoAngle = poseEstimator.calculateAngle(shoulder, hip, isLeftFront ? leftAnkle : rightAnkle);
        isTorsoLeaning = torsoAngle < 160;
      }

      // 2. Check Knee Alignment (Knee shouldn't go too far past ankle)
      const isKneePastAnkle = Math.abs(frontKnee.x - frontAnkle.x) > 0.15;

      const currentFaults: string[] = [];

      if (checkFault('torsoLeaning', isTorsoLeaning)) {
        currentFaults.push("Keep torso upright");
        isCorrect = false;
        incorrectJoints.push(11, 12, 23, 24);
      }
      if (checkFault('kneePastAnkle', isKneePastAnkle)) {
        currentFaults.push("Knee above ankle");
        isCorrect = false;
        incorrectJoints.push(isLeftFront ? 25 : 26);
      }
      
      if (checkFault('tooDeep', minAngle < 70, 3)) {
        currentFaults.push("Lunging too deep");
        isCorrect = false;
        incorrectJoints.push(25, 26); // Knees
      }

      if (currentFaults.length > 0) {
        feedback = currentFaults.join(" | ");
      }

      if (state.isDown && !isCorrect) {
        (state as any).repValid = false;
      }

      if (minAngle > 160 && maxAngle > 160) {
        feedback = "Stand straight";
        if (state.isDown) {
          repDuration = (Date.now() - state.repStartTime) / 1000;
          
          // Lunge Pace: 2s - 5s
          if (repDuration < 2.0) paceClassification = 'too-fast';
          else if (repDuration > 5.0) paceClassification = 'too-slow';
          else paceClassification = 'good';

          if ((state as any).repValid !== false) {
            repCompleted = true;
            feedback = paceClassification === 'good' ? "Good lunge!" : (paceClassification === 'too-fast' ? "Too fast! Slow down." : "Too slow! Speed up.");
          } else {
            feedback = "Rep invalid due to poor posture. Try again.";
          }
          state.isDown = false;
          (state as any).repValid = true;
        }
      } else if (minAngle < 100) {
        feedback = isCorrect ? "Good depth! Push back up." : feedback;
        if (!state.isDown) {
          state.isDown = true;
          (state as any).repValid = isCorrect;
          state.repStartTime = Date.now();
        }
      } else {
        feedback = isCorrect ? (state.isDown ? "Push back up..." : "Lower your hips...") : feedback;
      }

      // Add lunge depth for UI
      (state as any).lungeDepth = Math.max(0, Math.min(100, (180 - minAngle) / 90 * 100));
    } else {
      feedback = "Please step back so your full body is visible";
      isCorrect = false;
    }

    return { isCorrect, feedback, repCompleted, incorrectJoints, repDuration, paceClassification };
  },

  full_body_stretch: (landmarks, state, poseEstimator, targetReps) => {
    const checkFault = (faultId: string, condition: boolean, framesThreshold = 5) => {
      if (condition) {
        state.faultFrames[faultId] = (state.faultFrames[faultId] || 0) + 1;
        return state.faultFrames[faultId] >= framesThreshold;
      } else {
        state.faultFrames[faultId] = 0;
        return false;
      }
    };

    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftElbow = landmarks[13];
    const rightElbow = landmarks[14];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];
    
    let isCorrect = true;
    let feedback = "Tracking active...";
    let repCompleted = false;
    const incorrectJoints: number[] = [];
    let repDuration: number | undefined;
    let paceClassification: 'too-fast' | 'good' | 'too-slow' | undefined;

    // Initialize custom state for overhead reach
    const s = state as any;
    if (!s.orState) {
      s.orState = 'down'; // down, raising, top_position, lowering
      s.repValid = true;
      s.repStartTime = 0;
    }

    if (leftShoulder && rightShoulder && leftElbow && rightElbow && leftWrist && rightWrist && leftHip && rightHip && 
        leftShoulder.visibility > 0.5 && rightShoulder.visibility > 0.5) {
        
      // 1. Shoulder Angles (Hip -> Shoulder -> Elbow)
      const leftShoulderAngle = poseEstimator.calculateAngle(leftHip, leftShoulder, leftElbow);
      const rightShoulderAngle = poseEstimator.calculateAngle(rightHip, rightShoulder, rightElbow);
      
      // 2. Back Angle (Shoulder -> Hip -> Knee)
      const leftBackAngle = leftKnee ? poseEstimator.calculateAngle(leftShoulder, leftHip, leftKnee) : 180;
      const rightBackAngle = rightKnee ? poseEstimator.calculateAngle(rightShoulder, rightHip, rightKnee) : 180;
      const avgBackAngle = (leftBackAngle + rightBackAngle) / 2;
      s.backAngle = avgBackAngle;

      // 3. Vertical Alignment (Wrist above Shoulder)
      const isLeftWristAbove = leftWrist.y < leftShoulder.y;
      const isRightWristAbove = rightWrist.y < rightShoulder.y;
      s.armAlignment = isLeftWristAbove && isRightWristAbove;

      // --- ERROR DETECTION ---
      const currentFaults: string[] = [];

      // Fault: Bending backward
      if (checkFault('bendingBackward', leftBackAngle < 155 || rightBackAngle < 155)) {
        currentFaults.push("Keep your back straight");
        isCorrect = false;
        incorrectJoints.push(11, 12, 23, 24);
      }

      // Fault: Uneven arms
      if (Math.abs(leftShoulderAngle - rightShoulderAngle) > 25 && Math.max(leftShoulderAngle, rightShoulderAngle) > 60) {
        if (checkFault('unevenArms', true)) {
          currentFaults.push("Keep arms even");
          isCorrect = false;
          if (leftShoulderAngle > rightShoulderAngle) incorrectJoints.push(11, 13, 15);
          else incorrectJoints.push(12, 14, 16);
        }
      }

      // Fault: Arms not straight
      const leftElbowAngle = poseEstimator.calculateAngle(leftShoulder, leftElbow, leftWrist);
      const rightElbowAngle = poseEstimator.calculateAngle(rightShoulder, rightElbow, rightWrist);
      if (checkFault('elbowsBent', leftElbowAngle < 140 || rightElbowAngle < 140)) {
        currentFaults.push("Keep arms straight");
        isCorrect = false;
        if (leftElbowAngle < 140) incorrectJoints.push(13, 15);
        if (rightElbowAngle < 140) incorrectJoints.push(14, 16);
      }

      if (currentFaults.length > 0) {
        feedback = currentFaults.join(" | ");
      }

      if (s.orState !== 'down' && !isCorrect) {
        s.repValid = false;
      }

      // --- STATE MACHINE ---
      const avgShoulderAngle = (leftShoulderAngle + rightShoulderAngle) / 2;

      // Symmetry calculation
      const symmetry = 100 - Math.min(40, Math.abs(leftShoulderAngle - rightShoulderAngle));
      s.symmetryScore = symmetry;
      
      // Reach height for UI (0-100%)
      s.reachHeight = Math.max(0, Math.min(100, (avgShoulderAngle / 170) * 100));

      if (s.orState === 'down') {
        feedback = "Stand straight. Raise arms overhead.";
        if (avgShoulderAngle > 45) {
          s.orState = 'raising';
          s.repValid = true;
          state.repStartTime = Date.now();
        }
      } else if (s.orState === 'raising') {
        feedback = "Raising arms...";
        
        // Check if they are lowering before reaching the top
        if (s.lastAvgShoulderAngle && avgShoulderAngle < s.lastAvgShoulderAngle - 10 && avgShoulderAngle > 60) {
           feedback = "Raise higher! Reach all the way up.";
           isCorrect = false;
           incorrectJoints.push(11, 12, 13, 14, 15, 16);
           if (checkFault('notHighEnough', true, 10)) {
             s.repValid = false;
           }
        }

        if (avgShoulderAngle > 155 && isLeftWristAbove && isRightWristAbove) {
          s.orState = 'top_position';
        } else if (avgShoulderAngle < 30) {
          s.orState = 'down'; // Aborted
        }
      } else if (s.orState === 'top_position') {
        feedback = "Hold! Now lower slowly.";
        if (avgShoulderAngle < 145) {
          s.orState = 'lowering';
        }
      } else if (s.orState === 'lowering') {
        feedback = "Lowering arms...";
        if (avgShoulderAngle < 30) {
          repDuration = (Date.now() - state.repStartTime) / 1000;
          
          // Full Body Stretch Pace: 2s - 6s
          if (repDuration < 2.0) paceClassification = 'too-fast';
          else if (repDuration > 6.0) paceClassification = 'too-slow';
          else paceClassification = 'good';

          if (s.repValid) {
            repCompleted = true;
            feedback = paceClassification === 'good' ? "Excellent rep!" : (paceClassification === 'too-fast' ? "Too fast! Slow down." : "Too slow! Speed up.");
          } else {
            feedback = "Rep invalid due to poor posture.";
          }
          s.orState = 'down';
        }
      }

      s.lastAvgShoulderAngle = avgShoulderAngle;

    } else {
      feedback = "Please step back so upper body is visible";
      isCorrect = false;
    }

    return { isCorrect, feedback, repCompleted, incorrectJoints };
  }
};
