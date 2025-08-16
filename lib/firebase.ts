// lib/firebase.ts
// Inicialização opcional do Firebase/Firestore.
// Se as variáveis de ambiente NÃO existirem, exporta `db = null`
// e o app cai no modo local (localStorage).

import { getApps, initializeApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'

const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

function hasMinimumConfig(c: Record<string, any>) {
  // para Firestore precisamos pelo menos destes campos:
  return Boolean(c.apiKey && c.authDomain && c.projectId && c.appId)
}

let db: Firestore | null = null

if (hasMinimumConfig(cfg)) {
  const app = getApps().length ? getApps()[0] : initializeApp(cfg as any)
  db = getFirestore(app)
}

export { db }
