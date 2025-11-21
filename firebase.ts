import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCQpYg1yMssRgwYIcIK1CRbQ8f5XG3K8KE",
  authDomain: "tam-project-350c0.firebaseapp.com",
  projectId: "tam-project-350c0",
  storageBucket: "tam-project-350c0.firebasestorage.app",
  messagingSenderId: "743400893160",
  appId: "1:743400893160:web:72e46d6d65c4be76b2f75d",
  measurementId: "G-524SYZ6MQF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);