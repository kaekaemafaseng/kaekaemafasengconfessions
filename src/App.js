import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import {
  Send,
  CheckCircle,
  Lock,
  MapPin,
  Music,
  X,
  Sparkles,
} from "lucide-react";

// --- 1. PASTE YOUR FIREBASE CONFIG HERE ---
const firebaseConfig = {
  apiKey: "AIzaSyCIQTyvOYDUocYHBSM-ePQ0QARO69DSREw",
  authDomain: "afterhours-anonymous.firebaseapp.com",
  projectId: "afterhours-anonymous",
  storageBucket: "afterhours-anonymous.firebasestorage.app",
  messagingSenderId: "61520853906",
  appId: "1:61520853906:web:19137b725d3390e30a5f4b",
  measurementId: "G-J0Y3Z2J98D",
};
// ------------------------------------------

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const COLLECTION_NAME = "groove_confessions";

// --- HELPER: Split Text into Card-Sized Chunks ---
// Increased to 180 to allow "smart squeezing" of slightly longer stories
const MAX_CHARS = 180; 

const splitTextIntoChunks = (text) => {
  if (!text) return [];
  const words = text.split(" ");
  const chunks = [];
  let currentChunk = "";

  words.forEach((word) => {
    // Check if adding the next word exceeds the max length
    if ((currentChunk + " " + word).trim().length <= MAX_CHARS) {
      currentChunk = (currentChunk + " " + word).trim();
    } else {
      // If current chunk is empty but word is huge (edge case), force it
      if (!currentChunk) {
         chunks.push(word);
      } else {
         chunks.push(currentChunk);
         currentChunk = word;
      }
    }
  });
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
};

// --- Aesthetic Card Component ---
const ScreenshotCard = ({ data }) => {
  const gradients = [
    "from-violet-900 via-slate-900 to-slate-900 border-violet-500/30",
    "from-fuchsia-900 via-slate-900 to-slate-900 border-fuchsia-500/30",
    "from-indigo-900 via-slate-900 to-slate-900 border-indigo-500/30",
    "from-rose-900 via-slate-900 to-slate-900 border-rose-500/30",
  ];

  const bgGradient = gradients[(data.number || 0) % gradients.length];

  // --- SMART FONT SIZING ---
  // Dynamically adjusts font based on how full the card is.
  // This prevents short text from looking tiny, and long text from overflowing.
  const getFontSizeClass = (textLength) => {
    if (textLength < 60) return "text-3xl md:text-4xl leading-tight";  // Short & Punchy
    if (textLength < 110) return "text-2xl md:text-3xl leading-snug";   // Standard
    if (textLength < 150) return "text-xl md:text-2xl leading-normal";   // Getting full
    return "text-lg md:text-xl leading-relaxed";                         // Squeezing it in (150-180 chars)
  };

  const fontSizeClass = getFontSizeClass(data.text ? data.text.length : 0);

  return (
    <div
      className={`relative p-8 rounded-2xl shadow-2xl bg-gradient-to-br ${bgGradient} border flex flex-col justify-between h-full aspect-[4/5] md:aspect-square overflow-hidden`}
    >
      {/* Branding - Bottom Center */}
      <div className="absolute bottom-3 left-0 w-full flex justify-center z-0">
        <span className="text-white/30 font-bold text-[10px] tracking-[0.2em] uppercase select-none">
          @kaekaemafaseng
        </span>
      </div>

      {/* Header */}
      <div className="flex justify-between items-start mb-4 relative z-10 shrink-0">
        <div className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-widest text-white/70 border border-white/10">
          {/* Handles "Session #105" OR "Session #105 (Part 1/3)" */}
          AA Session #{data.number}
          {data.totalParts > 1 && (
            <span className="text-fuchsia-300 ml-1">
              (Part {data.part}/{data.totalParts})
            </span>
          )}
        </div>
        {/* Logo in Creator View */}
        <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain opacity-80" />
      </div>
      
      {/* Content - Smart Dynamic Font */}
      <div className="flex-grow flex items-center justify-center my-2 relative z-10 overflow-hidden">
        <p className={`font-sans ${fontSizeClass} text-white font-medium drop-shadow-md text-center break-words w-full`}>
          "{data.text}"
        </p>
      </div>
      
      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3 text-white/60 text-sm font-medium relative z-10 shrink-0">
        <div className="p-2 bg-white/5 rounded-full">
          <MapPin size={14} className="text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-white text-base font-bold uppercase tracking-wide">
            {data.club}
          </span>
          <span className="text-xs opacity-70">{data.city}</span>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("submit");

  const [formData, setFormData] = useState({
    text: "",
    city: "",
    club: "",
  });

  const [loading, setLoading] = useState(false);
  const [confessions, setConfessions] = useState([]);
  const [lastNumber, setLastNumber] = useState(null);

  useEffect(() => {
    signInAnonymously(auth).catch((err) => console.error("Auth Error", err));
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, COLLECTION_NAME);
    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.number || 0) - (a.number || 0));
      setConfessions(docs);
    });
    return () => unsubscribe();
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const isFormValid =
    formData.text.trim() && formData.city.trim() && formData.club.trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;
    setLoading(true);

    try {
      const maxNum =
        confessions.length > 0
          ? Math.max(...confessions.map((c) => c.number || 0))
          : 0;
      const nextNum = maxNum + 1;

      await addDoc(collection(db, COLLECTION_NAME), {
        text: formData.text.trim(),
        city: formData.city.trim(),
        club: formData.club.trim(),
        number: nextNum,
        createdAt: serverTimestamp(),
      });

      setLastNumber(nextNum);
      setView("success");
      setFormData({ text: "", city: "", club: "" });
    } catch (err) {
      console.error(err);
      alert("Connection error. The bouncer wouldn't let that in.");
    } finally {
      setLoading(false);
    }
  };

  // --- PREPARE DATA FOR ADMIN VIEW (SPLIT LONG STORIES) ---
  const getDisplayCards = () => {
    // We flatten the list so that one confession can turn into multiple card objects
    return confessions.flatMap((confession) => {
      const chunks = splitTextIntoChunks(confession.text);
      
      // If it's short enough, just return original
      if (chunks.length <= 1) return [confession];

      // If long, return array of "Part" objects
      return chunks.map((chunkText, index) => ({
        ...confession,
        text: chunkText,
        part: index + 1,
        totalParts: chunks.length,
        // Create a fake ID for React list keys
        uniqueId: `${confession.id}-part-${index}`
      }));
    });
  };

  if (view === "admin") {
    const displayCards = getDisplayCards();

    return (
      <div className="min-h-screen bg-slate-950 p-6 selection:bg-fuchsia-500 selection:text-white">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <Sparkles className="text-fuchsia-500" size={20} />
            <h1 className="text-2xl font-bold text-white tracking-tighter">
              Afterhours Anonymous{" "}
              <span className="text-slate-600 text-sm font-normal ml-2">
                Creator View
              </span>
            </h1>
          </div>
          <button
            onClick={() => {
              const secret = prompt("Enter Admin Password:");
              if (secret === "2024") {
                setView("submit");
              } else {
                alert("Wrong password. Access denied.");
              }
            }}
            className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-full text-slate-400 hover:text-white text-sm flex items-center gap-2 transition-all"
          >
            <X size={16} /> Close
          </button>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {displayCards.map((c) => (
            <ScreenshotCard 
              key={c.uniqueId || c.id} 
              data={c} 
            />
          ))}
        </div>
        {confessions.length === 0 && (
          <div className="text-center text-slate-700 mt-20 font-mono">
            Waiting for the first story...
          </div>
        )}
      </div>
    );
  }

  if (view === "success") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950"></div>
        <div className="bg-slate-900/80 backdrop-blur-xl p-10 rounded-3xl shadow-2xl border border-white/5 text-center max-w-md w-full relative z-10">
          <div className="w-20 h-20 bg-green-500/10 text-green-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20">
            <CheckCircle size={40} />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
            Submitted.
          </h2>
          <p className="text-slate-400 mb-8">
            Your story is safe with us. It's marked as{" "}
            <span className="font-bold text-fuchsia-400">#{lastNumber}</span>.
          </p>
          <button
            onClick={() => setView("submit")}
            className="w-full py-3.5 bg-white text-black rounded-xl font-bold hover:bg-slate-200 transition-colors"
          >
            Confess Another
          </button>
        </div>
      </div>
    );
  }

  // OPTIMIZED MAIN VIEW
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-fuchsia-500 selection:text-white relative overflow-x-hidden bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-fuchsia-900/20 via-slate-950 to-slate-950">
      
      <div className="relative z-10 flex flex-col items-center min-h-screen p-4 md:p-6">
        <div className="w-full max-w-lg mt-8 md:mt-16 mb-12">
          <div className="mb-10 text-center flex flex-col items-center">
            
            {/* LOGO */}
            <img 
              src="/logo.png" 
              alt="Afterhours Anonymous Logo" 
              className="w-32 h-32 md:w-40 md:h-40 mb-6 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]"
            />
            
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tighter">
              Afterhours Anonymous
            </h1>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed">
              Welcome to your AA session with @kaekaemafaseng — Afterhours
              Anonymous: an anonymous, judgment-free platform for fun, funny,
              relatable, and helpful groove tips and groove confessions, shared
              responsibly by the community.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-slate-900/50 backdrop-blur-sm p-2 rounded-3xl border border-white/10 focus-within:border-fuchsia-500/50 focus-within:ring-4 focus-within:ring-fuchsia-500/10 transition-all duration-300">
              <textarea
                name="text"
                value={formData.text}
                onChange={handleChange}
                placeholder="This is a safe space please share."
                className="w-full h-40 p-4 bg-transparent text-lg text-white placeholder:text-slate-600 border-none focus:ring-0 resize-none"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900/50 backdrop-blur-sm px-4 py-3 rounded-2xl border border-white/10 focus-within:border-fuchsia-500/50 focus-within:ring-4 focus-within:ring-fuchsia-500/10 transition-all duration-300 flex items-center gap-3">
                <Music size={18} className="text-slate-500 flex-shrink-0" />
                <input
                  type="text"
                  name="club"
                  value={formData.club}
                  onChange={handleChange}
                  placeholder="Club Name"
                  className="w-full bg-transparent text-white placeholder:text-slate-600 border-none focus:ring-0 p-0"
                />
              </div>
              <div className="bg-slate-900/50 backdrop-blur-sm px-4 py-3 rounded-2xl border border-white/10 focus-within:border-fuchsia-500/50 focus-within:ring-4 focus-within:ring-fuchsia-500/10 transition-all duration-300 flex items-center gap-3">
                <MapPin size={18} className="text-slate-500 flex-shrink-0" />
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="City / Town"
                  className="w-full bg-transparent text-white placeholder:text-slate-600 border-none focus:ring-0 p-0"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={!isFormValid || loading}
              className="w-full mt-6 bg-white text-black h-14 rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] flex items-center justify-center gap-2"
            >
              {loading ? (
                "Submitting..."
              ) : (
                <>
                  Send It <Send size={18} />
                </>
              )}
            </button>
          </form>
          <div className="mt-8 flex justify-center">
            <p className="text-xs text-slate-600 text-center max-w-xs">
              By clicking send, you agree that this story is true (or close
              enough).
            </p>
          </div>
        </div>
        <footer className="absolute bottom-6 w-full text-center">
          <button
            onClick={() => {
              const secret = prompt("Enter Admin Password:");
              if (secret === "2024") {
                setView("admin");
              } else {
                alert("Wrong password. Access denied.");
              }
            }}
            className="text-slate-800 hover:text-slate-600 transition-colors p-2"
          >
            <Lock size={14} />
          </button>
        </footer>
      </div>
    </div>
  );
};

export default App;
