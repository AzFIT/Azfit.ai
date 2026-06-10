/** All mock data for the Coach dashboard */

export interface Client {
  id: number;
  name: string;
  avatar: string;
  age: number;
  status: 'active' | 'away' | 'new';
  fitnessScore: number;
  weight: number;
  weightChange: number;
  streak: number;
  lastActive: string;
  goal: string;
  nextSession: string;
  compliance: number;
  progress: number;
}

export interface Program {
  id: number;
  name: string;
  color: string;
  description: string;
  duration: string;
  frequency: string;
  clients: number;
  completionRate: number;
  createdDate: string;
}

export interface Conversation {
  id: number;
  clientName: string;
  clientAvatar: string;
  preview: string;
  time: string;
  unread: number;
  messages: Message[];
}

export interface Message {
  id: number | string;
  sender: 'coach' | 'client';
  text: string;
  timestamp: string;
}

export const clients: Client[] = [
  {
    id: 1,
    name: 'Alex Chen',
    avatar: '/avatar-alex.jpg',
    age: 28,
    status: 'active',
    fitnessScore: 82,
    weight: 82.5,
    weightChange: -3.8,
    streak: 12,
    lastActive: 'Active 2h ago',
    goal: 'Build Strength',
    nextSession: 'Tomorrow, 7:00 AM',
    compliance: 95,
    progress: 82,
  },
  {
    id: 2,
    name: 'Sarah Miller',
    avatar: '/avatar-sarah.jpg',
    age: 26,
    status: 'active',
    fitnessScore: 76,
    weight: 58.2,
    weightChange: -1.5,
    streak: 8,
    lastActive: 'Active 5h ago',
    goal: 'Lose Weight',
    nextSession: 'Today, 5:00 PM',
    compliance: 88,
    progress: 65,
  },
  {
    id: 3,
    name: 'Marcus Johnson',
    avatar: '/avatar-marcus.jpg',
    age: 32,
    status: 'active',
    fitnessScore: 88,
    weight: 95.0,
    weightChange: 2.1,
    streak: 21,
    lastActive: 'Active 1d ago',
    goal: 'Improve Endurance',
    nextSession: 'Tomorrow, 6:00 PM',
    compliance: 72,
    progress: 70,
  },
  {
    id: 4,
    name: 'Emily Davis',
    avatar: '/avatar-default-f.jpg',
    age: 29,
    status: 'away',
    fitnessScore: 71,
    weight: 64.5,
    weightChange: -0.5,
    streak: 0,
    lastActive: 'Active 3d ago',
    goal: 'Muscle Gain',
    nextSession: 'No session scheduled',
    compliance: 60,
    progress: 45,
  },
  {
    id: 5,
    name: 'James Wilson',
    avatar: '/avatar-default-m.jpg',
    age: 35,
    status: 'active',
    fitnessScore: 79,
    weight: 78.0,
    weightChange: -2.0,
    streak: 5,
    lastActive: 'Active now',
    goal: 'General Fitness',
    nextSession: 'Today, 8:00 AM',
    compliance: 98,
    progress: 90,
  },
  {
    id: 6,
    name: 'Olivia Taylor',
    avatar: '/avatar-default-f.jpg',
    age: 24,
    status: 'new',
    fitnessScore: 68,
    weight: 55.0,
    weightChange: -0.2,
    streak: 3,
    lastActive: 'Active 6h ago',
    goal: 'Tone Up',
    nextSession: 'Friday, 9:00 AM',
    compliance: 82,
    progress: 55,
  },
  {
    id: 7,
    name: 'Daniel Lee',
    avatar: '/avatar-default-m.jpg',
    age: 30,
    status: 'active',
    fitnessScore: 85,
    weight: 88.0,
    weightChange: 1.5,
    streak: 15,
    lastActive: 'Active 30m ago',
    goal: 'Powerlifting',
    nextSession: 'Tomorrow, 6:00 AM',
    compliance: 91,
    progress: 78,
  },
  {
    id: 8,
    name: 'Sophia Garcia',
    avatar: '/avatar-default-f.jpg',
    age: 27,
    status: 'active',
    fitnessScore: 74,
    weight: 61.0,
    weightChange: -1.2,
    streak: 7,
    lastActive: 'Active 4h ago',
    goal: 'Yoga & Flexibility',
    nextSession: 'Today, 6:00 PM',
    compliance: 85,
    progress: 62,
  },
];

export const programs: Program[] = [
  {
    id: 1,
    name: 'Strength Builder',
    color: '#0D9488',
    description: '12-week progressive overload program focused on compound lifts and strength gains.',
    duration: '12 weeks',
    frequency: '4 days/week',
    clients: 8,
    completionRate: 85,
    createdDate: 'Jan 15, 2025',
  },
  {
    id: 2,
    name: 'Fat Loss Fundamentals',
    color: '#06B6D4',
    description: '8-week nutrition + HIIT combined program for maximum fat burning.',
    duration: '8 weeks',
    frequency: '5 days/week',
    clients: 6,
    completionRate: 72,
    createdDate: 'Feb 1, 2025',
  },
  {
    id: 3,
    name: 'Hypertrophy Master',
    color: '#8B5CF6',
    description: '16-week muscle building program with advanced volume techniques.',
    duration: '16 weeks',
    frequency: '6 days/week',
    clients: 5,
    completionRate: 68,
    createdDate: 'Dec 1, 2024',
  },
  {
    id: 4,
    name: 'Beginner Blueprint',
    color: '#F59E0B',
    description: '4-week introductory program for new clients. Builds foundational movement patterns.',
    duration: '4 weeks',
    frequency: '3 days/week',
    clients: 10,
    completionRate: 90,
    createdDate: 'Mar 1, 2025',
  },
];

export const conversations: Conversation[] = [
  {
    id: 1,
    clientName: 'Alex Chen',
    clientAvatar: '/avatar-alex.jpg',
    preview: 'Great squat session today! Hit 100kg for 5 reps clean.',
    time: '2m ago',
    unread: 1,
    messages: [
      { id: 1, sender: 'client', text: 'Just hit 100kg on squat!', timestamp: '2:30 PM' },
      { id: 2, sender: 'coach', text: 'Amazing work Alex! That\'s a new PR!', timestamp: '2:32 PM' },
      { id: 3, sender: 'client', text: 'Thanks coach! Feeling stronger every week', timestamp: '2:33 PM' },
      { id: 4, sender: 'coach', text: 'Let\'s celebrate with a deload week. Check your program', timestamp: '2:35 PM' },
    ],
  },
  {
    id: 2,
    clientName: 'Sarah Miller',
    clientAvatar: '/avatar-sarah.jpg',
    preview: 'Can we adjust my push day? My shoulder is feeling tight.',
    time: '1h ago',
    unread: 2,
    messages: [
      { id: 1, sender: 'client', text: 'Can we adjust my push day? My shoulder is feeling tight.', timestamp: '1:15 PM' },
      { id: 2, sender: 'coach', text: 'Of course! Let me modify those exercises for you.', timestamp: '1:20 PM' },
    ],
  },
  {
    id: 3,
    clientName: 'Marcus Johnson',
    clientAvatar: '/avatar-marcus.jpg',
    preview: 'Thanks for the new program. Starting hypertrophy phase Monday.',
    time: '3h ago',
    unread: 0,
    messages: [
      { id: 1, sender: 'client', text: 'Thanks for the new program. Starting hypertrophy phase Monday.', timestamp: '11:00 AM' },
      { id: 2, sender: 'coach', text: 'Excited to see your progress! Track everything in the app.', timestamp: '11:30 AM' },
    ],
  },
  {
    id: 4,
    clientName: 'Emily Davis',
    clientAvatar: '/avatar-default-f.jpg',
    preview: 'Missed yesterday due to work. Back on track today!',
    time: '5h ago',
    unread: 1,
    messages: [
      { id: 1, sender: 'client', text: 'Missed yesterday due to work. Back on track today!', timestamp: '9:00 AM' },
      { id: 2, sender: 'coach', text: 'No worries! Consistency over perfection. Let me know how today goes.', timestamp: '9:30 AM' },
    ],
  },
  {
    id: 5,
    clientName: 'James Wilson',
    clientAvatar: '/avatar-default-m.jpg',
    preview: 'Completed all sessions this week. Feeling great!',
    time: '1d ago',
    unread: 0,
    messages: [
      { id: 1, sender: 'client', text: 'Completed all sessions this week. Feeling great!', timestamp: 'Yesterday' },
      { id: 2, sender: 'coach', text: 'Excellent work James! Your consistency is paying off.', timestamp: 'Yesterday' },
    ],
  },
];

// Analytics data
export const weeklyRevenueData = [
  { week: 'W1', revenue: 2800 },
  { week: 'W2', revenue: 3100 },
  { week: 'W3', revenue: 2900 },
  { week: 'W4', revenue: 3650 },
];

export const retentionData = [
  { month: 'Jan', rate: 88 },
  { month: 'Feb', rate: 90 },
  { month: 'Mar', rate: 92 },
  { month: 'Apr', rate: 91 },
  { month: 'May', rate: 93 },
  { month: 'Jun', rate: 94 },
];

export const fitnessScoreDistribution = [
  { name: '60-69', value: 1, color: '#F87171' },
  { name: '70-79', value: 3, color: '#F59E0B' },
  { name: '80-89', value: 3, color: '#0D9488' },
  { name: '90-100', value: 1, color: '#84CC16' },
];
