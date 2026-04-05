export type ExerciseCategory = 
  | 'Knee Rehabilitation' 
  | 'Shoulder Rehabilitation' 
  | 'Arm Rehabilitation'
  | 'Back / Spine Exercises' 
  | 'Neck Exercises' 
  | 'Full Body Mobility'
  | 'Chest / Upper Body';

export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

export interface ExerciseTemplate {
  id: string;
  name: string;
  category: ExerciseCategory;
  description: string;
  difficulty: DifficultyLevel;
  targetJoints: string[];
  idealAngles?: {
    joint: string;
    min: number;
    max: number;
  }[];
  demoUrl?: string;
  instructions: string[];
}

export const EXERCISE_LIBRARY: ExerciseTemplate[] = [
  {
    id: 'squat',
    name: 'Bodyweight Squats',
    category: 'Knee Rehabilitation',
    description: 'A fundamental lower body exercise that strengthens the quadriceps, hamstrings, and glutes while improving knee stability.',
    difficulty: 'Medium',
    targetJoints: ['knee', 'hip', 'ankle'],
    idealAngles: [
      { joint: 'knee', min: 90, max: 150 },
      { joint: 'hip', min: 85, max: 180 }
    ],
    instructions: [
      'Stand with your feet shoulder-width apart.',
      'Keep your back straight and chest up.',
      'Lower your hips as if sitting in a chair until your thighs are parallel to the floor.',
      'Push through your heels to return to the starting position.'
    ]
  },
  {
    id: 'arm_raise',
    name: 'Lateral Arm Raises',
    category: 'Shoulder Rehabilitation',
    description: 'Improves shoulder mobility and strengthens the deltoid muscles. Great for recovering from rotator cuff injuries.',
    difficulty: 'Easy',
    targetJoints: ['shoulder', 'elbow'],
    idealAngles: [
      { joint: 'shoulder', min: 30, max: 90 }
    ],
    instructions: [
      'Stand straight with your arms at your sides.',
      'Slowly raise both arms out to the sides until they are parallel with the floor.',
      'Hold for a brief second at the top.',
      'Slowly lower your arms back to the starting position.'
    ]
  },
  {
    id: 'knee_bend',
    name: 'Standing Knee Bends',
    category: 'Knee Rehabilitation',
    description: 'A gentle exercise to improve knee flexion and strengthen the hamstrings.',
    difficulty: 'Easy',
    targetJoints: ['knee'],
    idealAngles: [
      { joint: 'knee', min: 120, max: 180 }
    ],
    instructions: [
      'Stand straight, holding onto a chair or wall for balance if needed.',
      'Slowly bend one knee, bringing your heel toward your glutes.',
      'Keep your thighs parallel to each other.',
      'Slowly lower your foot back to the floor.'
    ]
  },
  {
    id: 'spine_extension',
    name: 'Standing Spine Extension',
    category: 'Back / Spine Exercises',
    description: 'Helps relieve lower back tension and improves spinal mobility.',
    difficulty: 'Easy',
    targetJoints: ['spine', 'hip'],
    instructions: [
      'Stand tall with feet hip-width apart.',
      'Place your hands firmly on your lower back for support.',
      'Keep your knees straight but not locked.',
      'Slowly lean your upper body backward, extending your spine.',
      'Hold the stretch for 2-3 seconds.',
      'Slowly return to the upright starting position.'
    ]
  },
  {
    id: 'neck_rotation',
    name: 'Neck Rotations',
    category: 'Neck Exercises',
    description: 'Improves cervical spine mobility and reduces neck stiffness.',
    difficulty: 'Easy',
    targetJoints: ['neck'],
    instructions: [
      'Sit or stand tall with shoulders relaxed.',
      'Look straight ahead (starting position).',
      'Slowly turn your head to the right as far as comfortable.',
      'Hold for 1-2 seconds, then return to center.',
      'Slowly turn your head to the left.',
      'Hold for 1-2 seconds, then return to center.'
    ]
  },
  {
    id: 'full_body_stretch',
    name: 'Overhead Reach',
    category: 'Full Body Mobility',
    description: 'A full-body stretch to improve overall posture and mobility.',
    difficulty: 'Easy',
    targetJoints: ['shoulder', 'spine', 'hip'],
    instructions: [
      'Stand with your feet shoulder-width apart.',
      'Interlace your fingers with palms facing up (optional).',
      'Slowly reach both arms straight up toward the ceiling.',
      'Elongate your spine and reach as high as you can without lifting your heels.',
      'Hold the top position for 5 seconds.',
      'Slowly lower your arms back to your sides.'
    ]
  },
  {
    id: 'push_up',
    name: 'Push-ups',
    category: 'Chest / Upper Body',
    description: 'A classic exercise that builds upper body strength, focusing on the chest, shoulders, and triceps while engaging the core.',
    difficulty: 'Hard',
    targetJoints: ['shoulder', 'elbow', 'wrist', 'core'],
    idealAngles: [
      { joint: 'elbow', min: 90, max: 180 },
      { joint: 'body', min: 160, max: 180 }
    ],
    instructions: [
      'Start in a high plank position with your hands slightly wider than shoulder-width apart.',
      'Keep your body in a straight line from head to heels.',
      'Lower your body until your chest is close to the floor (elbows at about a 90-degree angle).',
      'Push back up to the starting position.'
    ]
  },
  {
    id: 'bicep_curl',
    name: 'Bicep Curls',
    category: 'Arm Rehabilitation',
    description: 'Strengthens the biceps and improves elbow joint mobility.',
    difficulty: 'Easy',
    targetJoints: ['elbow', 'shoulder'],
    idealAngles: [
      { joint: 'elbow', min: 30, max: 160 }
    ],
    instructions: [
      'Stand or sit straight with your arms fully extended downwards.',
      'Keep your upper arms stationary and elbows close to your body.',
      'Bend your elbows to curl your hands up towards your shoulders.',
      'Slowly lower your hands back to the starting position.'
    ]
  },
  {
    id: 'lunge',
    name: 'Forward Lunges',
    category: 'Knee Rehabilitation',
    description: 'Improves balance, coordination, and strengthens the quadriceps, hamstrings, and glutes.',
    difficulty: 'Medium',
    targetJoints: ['knee', 'hip', 'ankle'],
    idealAngles: [
      { joint: 'knee', min: 90, max: 180 }
    ],
    instructions: [
      'Stand tall with your feet hip-width apart and hands on your hips.',
      'Take a controlled step forward with one leg.',
      'Lower your hips until both knees are bent at approximately a 90-degree angle.',
      'Ensure your front knee is directly above your ankle, not pushed out too far.',
      'Keep your torso upright and core engaged throughout the movement.',
      'Push back through your front heel to return to the starting position.'
    ]
  }
];
