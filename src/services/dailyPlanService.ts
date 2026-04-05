import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  Timestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { format, subDays } from 'date-fns';

export interface DailyPlanItem {
  id?: string;
  userId: string;
  exerciseId?: string;
  exerciseType: string;
  exerciseName: string;
  date: string; // YYYY-MM-DD
  status: 'not_started' | 'in_progress' | 'completed';
  addedBy: 'doctor' | 'patient';
  targetReps?: number;
  createdAt: Timestamp;
}

export const dailyPlanService = {
  async getTodayPlan(userId: string): Promise<DailyPlanItem[]> {
    const today = format(new Date(), 'yyyy-MM-dd');
    const q = query(
      collection(db, 'todays_plan'),
      where('userId', '==', userId),
      where('date', '==', today)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyPlanItem));
  },

  async addToPlan(item: Omit<DailyPlanItem, 'id' | 'createdAt' | 'date'>): Promise<string> {
    const today = format(new Date(), 'yyyy-MM-dd');
    const newItem: Omit<DailyPlanItem, 'id'> = {
      ...item,
      date: today,
      createdAt: Timestamp.now()
    };
    const docRef = await addDoc(collection(db, 'todays_plan'), newItem);
    return docRef.id;
  },

  async updateStatus(planId: string, status: DailyPlanItem['status']): Promise<void> {
    const docRef = doc(db, 'todays_plan', planId);
    await updateDoc(docRef, { status });
  },

  async removeFromPlan(planId: string): Promise<void> {
    const docRef = doc(db, 'todays_plan', planId);
    await deleteDoc(docRef);
  },

  async getSuggestions(userId: string): Promise<any[]> {
    // 1. Get exercises not completed yesterday
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const qYesterday = query(
      collection(db, 'todays_plan'),
      where('userId', '==', userId),
      where('date', '==', yesterday),
      where('status', '!=', 'completed')
    );
    const snapshotYesterday = await getDocs(qYesterday);
    const missed = snapshotYesterday.docs.map(doc => doc.data());

    // 2. Get low accuracy exercises from recent results
    const qResults = query(
      collection(db, 'results'),
      where('patientId', '==', userId),
      orderBy('completedAt', 'desc'),
      limit(5)
    );
    const snapshotResults = await getDocs(qResults);
    const lowAccuracy = snapshotResults.docs
      .map(doc => doc.data())
      .filter(res => res.accuracy < 70);

    return [
      ...missed.map(m => ({ type: 'missed', data: m })),
      ...lowAccuracy.map(l => ({ type: 'improvement', data: l }))
    ];
  }
};
