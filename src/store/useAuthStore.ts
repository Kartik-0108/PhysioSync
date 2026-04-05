import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export type Role = 'doctor' | 'patient' | null;

interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: Role;
  doctorId?: string;
  createdAt: any;
}

interface AuthState {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  setUser: (user: FirebaseUser | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  fetchProfile: (uid: string) => Promise<void>;
  createProfile: (uid: string, email: string, name: string, role: Role) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  loading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile, loading: false }),
  setLoading: (loading) => set({ loading }),
  fetchProfile: async (uid) => {
    set({ loading: true });
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        set({ profile: docSnap.data() as UserProfile, loading: false });
      } else {
        set({ profile: null, loading: false });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      set({ profile: null, loading: false });
    }
  },
  createProfile: async (uid, email, name, role) => {
    try {
      const newProfile: UserProfile = {
        uid,
        email,
        name,
        role,
        createdAt: new Date()
      };
      await setDoc(doc(db, 'users', uid), newProfile);
      set({ profile: newProfile, loading: false });
    } catch (error) {
      console.error("Error creating profile:", error);
      set({ loading: false });
      throw error;
    }
  }
}));
