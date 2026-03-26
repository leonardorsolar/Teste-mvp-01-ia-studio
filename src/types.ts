import { Timestamp } from './firebase';

export interface AppData {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Timestamp;
  platform: 'iOS' | 'Android' | 'Web';
  status: 'Draft' | 'Published';
  version?: string;
  defaultDevice?: 'mobile' | 'desktop';
}

export interface ScreenData {
  id: string;
  appId: string;
  imageUrl: string;
  order: number;
  name: string;
  device?: 'mobile' | 'desktop';
}

export interface HotspotData {
  id: string;
  screenId: string;
  targetScreenId: string;
  targetScreenName?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface IssueData {
  id: string;
  appId: string;
  screenId: string;
  authorId: string;
  authorName: string;
  text: string;
  x: number;
  y: number;
  createdAt: Timestamp;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Open' | 'Resolved';
}

export interface GuestSuggestionData {
  id: string;
  appId: string;
  screenId: string;
  guestId: string;
  guestName: string;
  text: string;
  x: number;
  y: number;
  createdAt: Timestamp;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Open' | 'Resolved';
  source: 'guest';
}

export interface GuestSession {
  guestId: string;
  guestName: string;
  appId: string;
  createdAt: number;
}

export interface NpsResponseData {
  id: string;
  appId: string;
  userName: string;
  score: number;
  classification: 'detractor' | 'neutral' | 'promoter';
  issueIds: string[];
  createdAt: Timestamp;
}
