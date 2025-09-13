// This is a Vercel Serverless Function
// It securely reads your environment variables on the server and sends them to the client.
export default function handler(request, response) {
  // Check if environment variables are set
  if (!process.env.FIREBASE_API_KEY) {
    return response.status(500).json({ error: 'Firebase environment variables are not set on the server.' });
  }

  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
  };
  
  // Send the config object as a JSON response
  response.status(200).json(firebaseConfig);
}
