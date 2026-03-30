import React, { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Edit2, Play, Settings, Trophy, User, CheckCircle2, XCircle, AlertCircle, Save, X, FileJson, Sparkles, Loader2, LogIn, LogOut, ShieldCheck, GraduationCap, History as HistoryIcon, BookOpen, ArrowLeft } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { auth, db } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  Timestamp,
  getDocs,
  deleteDoc,
  updateDoc,
  where
} from 'firebase/firestore';

// Declare MediaPipe globals
declare global {
  interface Window {
    Hands: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    HAND_CONNECTIONS: any;
  }
}

type GameMode = 'menu' | 'setup' | 'editor' | 'quiz' | 'gameover' | 'win';
type ItemType = 'debris' | 'satellite' | 'bonus_score' | 'bonus_slow' | 'bomb' | 'boss_ship' | 'answer';

interface Question {
  id?: string;
  setId?: string;
  q: string;
  options: { A: string; B: string; C: string; D: string };
  correct: 'A' | 'B' | 'C' | 'D';
}

interface QuestionSet {
  id: string;
  title: string;
  description?: string;
  createdAt: any;
}

const QUESTIONS: Question[] = [
  {
    q: "Lực nào giữ các hành tinh quay quanh Mặt Trời?",
    options: { A: "Lực ma sát", B: "Lực hấp dẫn", C: "Lực đàn hồi", D: "Lực điện" },
    correct: "B"
  },
  {
    q: "Đơn vị của cường độ dòng điện là gì?",
    options: { A: "Volt (V)", B: "Watt (W)", C: "Ampere (A)", D: "Ohm (Ω)" },
    correct: "C"
  },
  {
    q: "Hiện tượng khúc xạ ánh sáng xảy ra khi nào?",
    options: { A: "Ánh sáng truyền qua gương", B: "Ánh sáng truyền qua hai môi trường khác nhau", C: "Ánh sáng bị chặn bởi vật cản", D: "Ánh sáng truyền trong chân không" },
    correct: "B"
  },
  {
    q: "Hạt nhân nguyên tử gồm những loại hạt nào?",
    options: { A: "Electron và Proton", B: "Proton và Neutron", C: "Electron và Neutron", D: "Chỉ có Proton" },
    correct: "B"
  },
  {
    q: "Công thức tính vận tốc (v) theo quãng đường (s) và thời gian (t) là:",
    options: { A: "v = s * t", B: "v = s / t", C: "v = t / s", D: "v = s + t" },
    correct: "B"
  },
  {
    q: "Trọng lực là lực hút của Trái Đất tác dụng lên vật, có phương:",
    options: { A: "Nằm ngang", B: "Thẳng đứng", C: "Xiên góc", D: "Tùy ý" },
    correct: "B"
  },
  {
    q: "Nhiệt độ sôi của nước nguyên chất ở áp suất chuẩn là bao nhiêu?",
    options: { A: "0°C", B: "50°C", C: "100°C", D: "200°C" },
    correct: "C"
  },
  {
    q: "Thấu kính hội tụ có đặc điểm gì đối với chùm tia tới song song?",
    options: { A: "Làm loe rộng chùm tia", B: "Làm hội tụ chùm tia", C: "Giữ nguyên chùm tia", D: "Phản xạ chùm tia" },
    correct: "B"
  }
];

// Sound Synthesis Utility
const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

const playSound = (type: 'grab' | 'score' | 'penalty' | 'explosion' | 'powerup' | 'boss') => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  const now = audioCtx.currentTime;
  
  switch (type) {
    case 'grab':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    case 'score':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
      break;
    case 'penalty':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(50, now + 0.3);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;
    case 'explosion':
      // Noise-like sound
      osc.type = 'square';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(10, now + 0.5);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
      break;
    case 'powerup':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.2);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;
    case 'boss':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(100, now + 1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 1);
      osc.start(now);
      osc.stop(now + 1);
      break;
  }
};

// Procedural Background Music
let musicInterval: any = null;
const stopMusic = () => {
  if (musicInterval) {
    clearInterval(musicInterval);
    musicInterval = null;
  }
};

const playMusic = (mode: GameMode, enabled: boolean = true) => {
  stopMusic();
  if (!enabled) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const notes = [196, 220, 247, 293, 329]; // Calm pentatonic
  const tempo = 400;
  let step = 0;

  musicInterval = setInterval(() => {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    const freq = notes[step % notes.length];
    osc.frequency.setValueAtTime(freq, now);
    
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(now);
    osc.stop(now + 0.3);
    step++;
  }, tempo);
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

interface GameItem {
  id: number;
  type: ItemType;
  emoji: string;
  label?: string;
  x: number;
  y: number;
  size: number;
  speed: number;
  isGrabbed: boolean;
  grabbedBy: number | null;
  isLarge: boolean;
}

interface Obstacle {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  direction: number;
}

const DEBRIS_EMOJIS = ['🪨', '🔩', '🗑️'];
const SATELLITE_EMOJIS = ['🛰️', '🚀'];
const BONUS_SCORE_EMOJI = '⭐';
const BONUS_SLOW_EMOJI = '⏱️';
const BOMB_EMOJI = '💣';
const BOSS_EMOJI = '👾';

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [uiMode, setUiMode] = useState<GameMode>('menu');
  const [finalScore, setFinalScore] = useState(0);
  const [playerNames, setPlayerNames] = useState(['Người chơi 1', 'Người chơi 2', 'Người chơi 3', 'Người chơi 4']);
  const [questions, setQuestions] = useState([...QUESTIONS]);
  const [tick, setTick] = useState(0);
  const [feedback, setFeedback] = useState<{ message: string, type: 'correct' | 'wrong' | 'none' } | null>(null);
  const [isMusicEnabled, setIsMusicEnabled] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const isMediaPipeInitialized = useRef(false);

  // Firebase State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'student' | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Helper for Firestore Error Handling
  const handleFirestoreError = (error: any, operation: string, path: string) => {
    const errInfo = {
      error: error?.message || String(error),
      operation,
      path,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        providerInfo: auth.currentUser?.providerData.map(p => ({
          providerId: p.providerId,
          displayName: p.displayName,
          email: p.email
        })) || []
      }
    };
    console.error(`Firestore Error [${operation}] at [${path}]:`, JSON.stringify(errInfo));
    // We don't throw here to avoid crashing the app, but we log it clearly
  };
  const [gameHistory, setGameHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Question Sets State
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [isCreatingSet, setIsCreatingSet] = useState(false);
  const [newSetTitle, setNewSetTitle] = useState('');

  // Auth Effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsAuthLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          // Check user role in Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role);
          } else {
            // New user, default to student
            const newRole = firebaseUser.email === 'hiep.kha@wellspringsaigon.edu.vn' ? 'admin' : 'student';
            await setDoc(doc(db, 'users', firebaseUser.uid), {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || 'Người dùng',
              role: newRole,
              createdAt: new Date().toISOString()
            });
            setUserRole(newRole);
          }
        } catch (error) {
          handleFirestoreError(error, 'get/set', 'users');
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sync Question Sets from Firestore
  useEffect(() => {
    if (!user || isAuthLoading) {
      setQuestionSets([]);
      return;
    }
    const q = query(collection(db, 'questionSets'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSets: QuestionSet[] = [];
      snapshot.forEach((doc) => {
        fetchedSets.push({ id: doc.id, ...doc.data() } as QuestionSet);
      });
      setQuestionSets(fetchedSets);
    }, (error) => {
      handleFirestoreError(error, 'list', 'questionSets');
    });
    return () => unsubscribe();
  }, [user, isAuthLoading]);

  // Sync Questions from Firestore based on selectedSetId
  useEffect(() => {
    if (!user || !selectedSetId || isAuthLoading) {
      setQuestions([]);
      return;
    }
    const q = query(
      collection(db, 'questions'), 
      where('setId', '==', selectedSetId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedQuestions: (Question & { id: string })[] = [];
      snapshot.forEach((doc) => {
        fetchedQuestions.push({ id: doc.id, ...doc.data() } as any);
      });
      setQuestions(fetchedQuestions as any);
    }, (error) => {
      handleFirestoreError(error, 'list', 'questions');
    });
    return () => unsubscribe();
  }, [user, selectedSetId, isAuthLoading]);

  // Fetch History
  useEffect(() => {
    if (!user || isAuthLoading) return;
    
    let hQuery;
    if (userRole === 'admin') {
      hQuery = query(
        collection(db, 'history'),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
    } else {
      hQuery = query(
        collection(db, 'history'),
        where('studentUid', '==', user.uid),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
    }
    
    const unsubscribe = onSnapshot(hQuery, (snapshot) => {
      const history: any[] = [];
      snapshot.forEach((doc) => {
        history.push({ id: doc.id, ...doc.data() });
      });
      setGameHistory(history);
    }, (error) => {
      handleFirestoreError(error, 'list', 'history');
    });
    return () => unsubscribe();
  }, [user, userRole, isAuthLoading]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUiMode('menu');
  };

  const saveHistory = async (score: number) => {
    if (!user) return;
    const setName = questionSets.find(s => s.id === selectedSetId)?.title || 'Không rõ';
    const path = 'history';
    try {
      await addDoc(collection(db, path), {
        studentUid: user.uid,
        studentName: user.displayName || 'Học sinh',
        score: score,
        timestamp: Timestamp.now(),
        setId: selectedSetId,
        setTitle: setName
      });
    } catch (error) {
      handleFirestoreError(error, 'create', path);
    }
  };

  // Editor State
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showAiParser, setShowAiParser] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [bulkJson, setBulkJson] = useState('');
  const [editForm, setEditForm] = useState<Question>({
    q: '',
    options: { A: '', B: '', C: '', D: '' },
    correct: 'A'
  });

  const handleAiParse = async () => {
    if (!aiInput.trim() || !userRole || userRole !== 'admin' || !selectedSetId) return;
    setIsAiParsing(true);
    const path = 'questions';
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Chuyển đổi nội dung sau đây thành định dạng JSON cho bài tập trắc nghiệm. 
        Mỗi câu hỏi phải có: "q" (nội dung câu hỏi), "options" (đối tượng {A, B, C, D}), và "correct" (chữ cái A, B, C hoặc D).
        Chỉ trả về JSON thô, không có markdown hay giải thích gì thêm.
        Nội dung: ${aiInput}`,
      });

      const text = response.text;
      const jsonStr = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      
      let questionsToImport = Array.isArray(parsed) ? parsed : (parsed.exercises || []);
      
      if (questionsToImport.length > 0) {
        for (const item of questionsToImport) {
          const qText = item.q || item.question || '';
          let options = item.options || {};
          let correct = item.correct || item.correct_answer || 'A';

          if (Array.isArray(options)) {
            options = {
              A: options[0] || '',
              B: options[1] || '',
              C: options[2] || '',
              D: options[3] || ''
            };
          }

          if (typeof correct === 'string') {
            if (correct.startsWith('A')) correct = 'A';
            else if (correct.startsWith('B')) correct = 'B';
            else if (correct.startsWith('C')) correct = 'C';
            else if (correct.startsWith('D')) correct = 'D';
            else correct = 'A';
          }

          await addDoc(collection(db, path), {
            q: qText,
            options,
            correct,
            setId: selectedSetId,
            createdBy: user?.uid
          });
        }

        setShowAiParser(false);
        setAiInput('');
      } else {
        alert('Không tìm thấy câu hỏi nào trong kết quả AI.');
      }
    } catch (e) {
      handleFirestoreError(e, 'create', path);
    } finally {
      setIsAiParsing(false);
    }
  };

  const handleBulkImport = async () => {
    if (!userRole || userRole !== 'admin' || !selectedSetId) return;
    const path = 'questions';
    try {
      let parsed = JSON.parse(bulkJson);
      
      if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.exercises)) {
        parsed = parsed.exercises;
      }

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const qText = item.q || item.question || '';
          let options = item.options || {};
          let correct = item.correct || item.correct_answer || 'A';

          if (Array.isArray(options)) {
            options = {
              A: options[0] || '',
              B: options[1] || '',
              C: options[2] || '',
              D: options[3] || ''
            };
          }

          await addDoc(collection(db, path), {
            q: qText,
            options,
            correct,
            setId: selectedSetId,
            createdBy: user?.uid
          });
        }
        setShowBulkImport(false);
        setBulkJson('');
      } else {
        alert('Dữ liệu phải là một mảng các câu hỏi hoặc một đối tượng chứa mảng "exercises".');
      }
    } catch (e) {
      handleFirestoreError(e, 'create', path);
    }
  };

  const handleCreateSet = async () => {
    if (!newSetTitle.trim() || !user) return;
    const path = 'questionSets';
    try {
      await addDoc(collection(db, path), {
        title: newSetTitle.trim(),
        createdBy: user.uid,
        createdAt: Timestamp.now()
      });
      setNewSetTitle('');
      setIsCreatingSet(false);
    } catch (e) {
      handleFirestoreError(e, 'create', path);
    }
  };

  const handleDeleteSet = async (setId: string) => {
    if (!window.confirm('Xóa bộ câu hỏi này sẽ xóa tất cả câu hỏi bên trong. Tiếp tục?')) return;
    try {
      // Delete questions in set
      const qSnap = await getDocs(query(collection(db, 'questions'), where('setId', '==', setId)));
      const deletePromises = qSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      // Delete set
      await deleteDoc(doc(db, 'questionSets', setId));
      if (selectedSetId === setId) setSelectedSetId(null);
    } catch (e) {
      handleFirestoreError(e, 'delete', 'questionSets/questions');
    }
  };

  const handleClearAll = async () => {
    if (!userRole || userRole !== 'admin' || !selectedSetId) return;
    if (window.confirm('Bạn có chắc chắn muốn xóa tất cả câu hỏi trong bộ này?')) {
      try {
        const qSnap = await getDocs(query(collection(db, 'questions'), where('setId', '==', selectedSetId)));
        const deletePromises = qSnap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);
      } catch (e) {
        handleFirestoreError(e, 'delete', 'questions');
      }
    }
  };

  const handleAddQuestion = () => {
    if (!selectedSetId) return;
    setEditingIndex(-1); // Use -1 for new question
    setEditForm({
      q: '',
      options: { A: '', B: '', C: '', D: '' },
      correct: 'A'
    });
  };

  const handleEditQuestion = (index: number) => {
    setEditingIndex(index);
    setEditForm(questions[index]);
  };

  const handleDeleteQuestion = async (index: number) => {
    if (!userRole || userRole !== 'admin') return;
    const q = questions[index] as any;
    if (q.id) {
      try {
        await deleteDoc(doc(db, 'questions', q.id));
      } catch (e) {
        handleFirestoreError(e, 'delete', 'questions');
      }
    }
  };

  const handleSaveQuestion = async () => {
    if (editingIndex === null || !userRole || userRole !== 'admin' || !selectedSetId) return;
    
    const path = 'questions';
    try {
      if (editingIndex === -1) {
        // Create new
        await addDoc(collection(db, path), {
          ...editForm,
          setId: selectedSetId,
          createdBy: user?.uid
        });
      } else {
        // Update existing
        const q = questions[editingIndex] as any;
        if (q.id) {
          await updateDoc(doc(db, path, q.id), {
            ...editForm
          });
        }
      }
      setEditingIndex(null);
    } catch (e) {
      handleFirestoreError(e, 'write', path);
    }
  };

  // Error Boundary Component
  const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
    const [hasError, setHasError] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
      const handleError = (event: ErrorEvent) => {
        setHasError(true);
        setErrorMsg(event.error?.message || 'Đã có lỗi xảy ra trong ứng dụng.');
      };
      window.addEventListener('error', handleError);
      return () => window.removeEventListener('error', handleError);
    }, []);

    if (hasError) {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900 p-8">
          <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl border-2 border-rose-500 shadow-2xl text-center">
            <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Rất tiếc!</h2>
            <p className="text-slate-400 mb-6">{errorMsg}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-all"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }
    return <>{children}</>;
  };
  
  // Game state refs (to avoid stale closures in requestAnimationFrame)
  const gameState = useRef({
    mode: 'menu' as GameMode,
    level: 1,
    score: 0,
    lives: 5,
    items: [] as GameItem[],
    obstacles: [] as Obstacle[],
    boss: { active: false, hp: 100, maxHp: 100, x: 0, y: 120, speed: 4, direction: 1 },
    effects: { slowUntil: 0 },
    cursors: [] as { x: number, y: number, isGrabbing: boolean, grabbedItemId: number | null, color: string }[],
    questionIndex: 0,
    questions: [...QUESTIONS],
    cooldownUntil: 0,
    playerScores: [0, 0, 0, 0],
    playerNames: ['Người chơi 1', 'Người chơi 2', 'Người chơi 3', 'Người chơi 4'],
    lastSpawnTime: 0,
    startTime: 0,
    timeLeft: 0,
    width: window.innerWidth,
    height: window.innerHeight,
    lastShuffleTime: 0,
    particles: [] as Particle[],
    screenShake: 0,
  });

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
        gameState.current.width = window.innerWidth;
        gameState.current.height = window.innerHeight;
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const initGame = (mode: GameMode) => {
    const now = Date.now();
    gameState.current = {
      ...gameState.current,
      mode: mode,
      level: 1,
      score: 0,
      lives: 5,
      items: [],
      obstacles: [],
      boss: { active: false, hp: 100, maxHp: 100, x: window.innerWidth / 2, y: 120, speed: 4, direction: 1 },
      effects: { slowUntil: 0 },
      cursors: [],
      questionIndex: 0,
      questions: [...questions],
      cooldownUntil: 0,
      playerScores: [0, 0, 0, 0],
      playerNames: [...playerNames],
      startTime: now,
      timeLeft: 0,
    };
    setUiMode(mode);
    setFeedback(null);
    setTick(0);
    gameState.current.particles = [];
    gameState.current.screenShake = 0;
    gameState.current.lastShuffleTime = now;
    playSound('score'); // Start sound
    playMusic(mode, isMusicEnabled);

    if (!isMediaPipeInitialized.current) {
      isMediaPipeInitialized.current = true;
      startMediaPipe();
    }
  };

  const startMediaPipe = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    const canvasCtx = canvasElement.getContext('2d');
    
    if (!canvasCtx) return;

    const hands = new window.Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 4,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    hands.onResults((results: any) => {
      const state = gameState.current;
      const now = Date.now();
      
      // Clear canvas
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      
      // Draw video frame
      canvasCtx.save();
      if (state.screenShake > 0) {
        const dx = (Math.random() - 0.5) * state.screenShake;
        const dy = (Math.random() - 0.5) * state.screenShake;
        canvasCtx.translate(dx, dy);
        state.screenShake *= 0.9;
        if (state.screenShake < 0.1) state.screenShake = 0;
      }
      canvasCtx.translate(canvasElement.width, 0);
      canvasCtx.scale(-1, 1);
      canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.restore();

      // If not playing, just show camera background
      // if (state.mode !== 'quiz') {
      //   return;
      // }

      // Process Hand Landmarks
      if (results.multiHandLandmarks) {
        // Update cursors array to match number of hands
        if (state.cursors.length !== results.multiHandLandmarks.length) {
          state.cursors = results.multiHandLandmarks.map((_: any, i: number) => ({
            x: 0, y: 0, isGrabbing: false, grabbedItemId: null,
            color: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'][i % 4]
          }));
        }

        results.multiHandLandmarks.forEach((landmarks: any, index: number) => {
          const cursor = state.cursors[index];
          if (!cursor) return;

          // Draw hand landmarks
          canvasCtx.save();
          canvasCtx.translate(canvasElement.width, 0);
          canvasCtx.scale(-1, 1);
          window.drawConnectors(canvasCtx, landmarks, window.HAND_CONNECTIONS, {color: cursor.color, lineWidth: 2});
          window.drawLandmarks(canvasCtx, landmarks, {color: '#FFF', lineWidth: 1, radius: 2});
          canvasCtx.restore();

          const thumbTip = landmarks[4];
          const indexTip = landmarks[8];
          
          const thumbX = (1 - thumbTip.x) * state.width;
          const thumbY = thumbTip.y * state.height;
          const indexX = (1 - indexTip.x) * state.width;
          const indexY = indexTip.y * state.height;
          
          const dx = indexX - thumbX;
          const dy = indexY - thumbY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          cursor.x = (thumbX + indexX) / 2;
          cursor.y = (thumbY + indexY) / 2;
          
          if (distance < 40) {
            cursor.isGrabbing = true;
            if (cursor.grabbedItemId === null) {
              // Try to grab an item
              for (let i = state.items.length - 1; i >= 0; i--) {
                const item = state.items[i];
                const distToItem = Math.sqrt(Math.pow(cursor.x - item.x, 2) + Math.pow(cursor.y - item.y, 2));
                
                if (distToItem < item.size * 1.5 && item.grabbedBy === null) {
                  item.isGrabbed = true;
                  item.grabbedBy = index;
                  cursor.grabbedItemId = item.id;
                  playSound('grab');
                  break;
                }
              }
            } else {
              // Already grabbing - check for bin collision while holding
              const item = state.items.find(i => i.id === cursor.grabbedItemId);
              if (item) {
                const binCenterX = state.width / 2;
                const binCenterY = state.height - 150;
                const distToBin = Math.sqrt(Math.pow(item.x - binCenterX, 2) + Math.pow(item.y - binCenterY, 2));
                
                if (distToBin < 120) {
                  const currentQ = state.questions[state.questionIndex];
                  if (item.label === currentQ.correct) {
                    const pName = state.playerNames[index] || `Người chơi ${index + 1}`;
                    state.playerScores[index] += 100;
                    state.score += 100;
                    playSound('score');
                    state.screenShake = 20;

                    // Create particles
                    for (let i = 0; i < 30; i++) {
                      state.particles.push({
                        x: item.x,
                        y: item.y,
                        vx: (Math.random() - 0.5) * 15,
                        vy: (Math.random() - 0.5) * 15,
                        life: 1.0,
                        color: ['#FFD700', '#FFA500', '#FFFFFF'][Math.floor(Math.random() * 3)],
                        size: 4 + Math.random() * 6
                      });
                    }
                    
                    setFeedback({ 
                      message: `CHÚC MỪNG ${pName.toUpperCase()}! ĐÁP ÁN ${currentQ.correct} LÀ CHÍNH XÁC!`, 
                      type: 'correct' 
                    });

                    // Move to next question after cooldown
                    state.items = [];
                    const nextIndex = state.questionIndex + 1;
                    if (nextIndex >= state.questions.length) {
                      setTimeout(() => {
                        setFinalScore(state.score);
                        setUiMode('win');
                        state.mode = 'win';
                        setFeedback(null);
                        saveHistory(state.score);
                      }, 2000);
                    } else {
                      state.cooldownUntil = Date.now() + 3000;
                      setTimeout(() => {
                        state.questionIndex = nextIndex;
                        setFeedback(null);
                        setTick(t => t + 1);
                      }, 3000);
                    }
                  } else {
                    const pName = state.playerNames[index] || `Người chơi ${index + 1}`;
                    state.playerScores[index] = Math.max(0, state.playerScores[index] - 50);
                    playSound('penalty');
                    state.screenShake = 10;
                    state.items = state.items.filter(i => i.id !== item.id);
                    
                    // Create particles (red)
                    for (let i = 0; i < 15; i++) {
                      state.particles.push({
                        x: item.x,
                        y: item.y,
                        vx: (Math.random() - 0.5) * 10,
                        vy: (Math.random() - 0.5) * 10,
                        life: 1.0,
                        color: '#FF0000',
                        size: 3 + Math.random() * 4
                      });
                    }

                    setFeedback({ 
                      message: `RẤT TIẾC ${pName.toUpperCase()}! ĐÁP ÁN ${item.label} CHƯA ĐÚNG.`, 
                      type: 'wrong' 
                    });
                    setTimeout(() => setFeedback(null), 2000);
                  }
                  cursor.grabbedItemId = null;
                  setTick(t => t + 1);
                }
              }
            }
          } else {
            cursor.isGrabbing = false;
            
            // Release grabbed item
            if (cursor.grabbedItemId !== null) {
              const item = state.items.find(i => i.id === cursor.grabbedItemId);
              if (item) {
                item.isGrabbed = false;
                item.grabbedBy = null;
              }
              cursor.grabbedItemId = null;
            }
          }
        });
      } else {
        state.cursors.forEach(cursor => {
          cursor.isGrabbing = false;
          if (cursor.grabbedItemId !== null) {
            const item = state.items.find(i => i.id === cursor.grabbedItemId);
            if (item) {
              item.isGrabbed = false;
              item.grabbedBy = null;
            }
            cursor.grabbedItemId = null;
          }
        });
      }

      // Quiz Spawning Logic
      if (Date.now() > state.cooldownUntil && state.items.length === 0) {
        const labels = ['A', 'B', 'C', 'D'];
        labels.forEach((label, i) => {
          state.items.push({
            id: Date.now() + i,
            type: 'answer',
            emoji: '',
            label: label,
            x: Math.random() * (state.width - 100) + 50,
            y: -50 - (i * 100), // Staggered spawn
            size: 60,
            speed: 2 + Math.random() * 1.5,
            isGrabbed: false,
            grabbedBy: null,
            isLarge: false
          });
        });
        state.lastShuffleTime = Date.now();
      }

      // Dynamic Shuffling Logic (Every 3 seconds)
      if (state.items.length > 0 && Date.now() - state.lastShuffleTime > 3000) {
        state.items.forEach(item => {
          if (item.grabbedBy === null) {
            item.x = Math.random() * (state.width - 100) + 50;
            // Add some particles on shuffle
            for (let i = 0; i < 5; i++) {
              state.particles.push({
                x: item.x,
                y: item.y,
                vx: (Math.random() - 0.5) * 5,
                vy: (Math.random() - 0.5) * 5,
                life: 0.5,
                color: '#FFFFFF',
                size: 2
              });
            }
          }
        });
        state.lastShuffleTime = Date.now();
      }

      // Update items
      for (let i = state.items.length - 1; i >= 0; i--) {
        const item = state.items[i];
        if (item.grabbedBy !== null) {
          const cursor = state.cursors[item.grabbedBy];
          if (cursor) {
            item.x = cursor.x;
            item.y = cursor.y;
          }
        } else {
          item.y += item.speed;
          if (item.y > state.height + 50) {
            item.y = -50;
            item.x = Math.random() * (state.width - 100) + 50;
          }
        }
      }

      // Update Particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // Gravity
        p.life -= 0.02;
        if (p.life <= 0) {
          state.particles.splice(i, 1);
        }
      }

      // Draw Particles
      state.particles.forEach(p => {
        canvasCtx.globalAlpha = p.life;
        canvasCtx.fillStyle = p.color;
        canvasCtx.beginPath();
        canvasCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        canvasCtx.fill();
      });
      canvasCtx.globalAlpha = 1.0;

      // Draw Bin (Blackboard Style)
      const binCenterX = state.width / 2;
      const binCenterY = state.height - 150;
      const binW = 240;
      const binH = 140;
      
      canvasCtx.save();
      // Shadow
      canvasCtx.shadowColor = 'rgba(0,0,0,0.5)';
      canvasCtx.shadowBlur = 15;
      
      // Board border
      canvasCtx.fillStyle = '#3d2b1f'; // Wood color
      canvasCtx.beginPath();
      canvasCtx.roundRect(binCenterX - binW/2 - 10, binCenterY - binH/2 - 10, binW + 20, binH + 20, 10);
      canvasCtx.fill();
      
      // Board surface
      canvasCtx.fillStyle = '#1e3a2f'; // Dark green board
      canvasCtx.beginPath();
      canvasCtx.roundRect(binCenterX - binW/2, binCenterY - binH/2, binW, binH, 5);
      canvasCtx.fill();
      
      // Chalk text
      canvasCtx.font = 'bold 20px "Comic Sans MS", cursive';
      canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      canvasCtx.textAlign = 'center';
      canvasCtx.fillText('KÉO ĐÁP ÁN', binCenterX, binCenterY - 15);
      canvasCtx.fillText('VÀO ĐÂY', binCenterX, binCenterY + 25);
      
      // Dashed drop zone
      canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      canvasCtx.setLineDash([5, 5]);
      canvasCtx.lineWidth = 2;
      canvasCtx.strokeRect(binCenterX - binW/2 + 10, binCenterY - binH/2 + 10, binW - 20, binH - 20);
      
      canvasCtx.restore();

      // Draw Items
      state.items.forEach(item => {
        canvasCtx.save();
        canvasCtx.fillStyle = '#FFF';
        canvasCtx.shadowColor = 'rgba(0,0,0,0.5)';
        canvasCtx.shadowBlur = 10;
        
        const boxSize = item.size + 20;
        canvasCtx.fillStyle = 'rgba(30, 41, 59, 0.8)';
        canvasCtx.strokeStyle = '#60A5FA';
        canvasCtx.lineWidth = 3;
        canvasCtx.beginPath();
        canvasCtx.roundRect(item.x - boxSize/2, item.y - boxSize/2, boxSize, boxSize, 10);
        canvasCtx.fill();
        canvasCtx.stroke();
        
        canvasCtx.fillStyle = '#FFF';
        canvasCtx.font = `bold ${item.size}px Arial`;
        canvasCtx.textAlign = 'center';
        canvasCtx.textBaseline = 'middle';
        canvasCtx.fillText(item.label || '', item.x, item.y);
        canvasCtx.restore();
      });

      // Draw Cursors
      state.cursors.forEach((cursor, i) => {
        canvasCtx.save();
        canvasCtx.beginPath();
        canvasCtx.arc(cursor.x, cursor.y, 20, 0, Math.PI * 2);
        canvasCtx.fillStyle = cursor.color + '88';
        canvasCtx.strokeStyle = '#FFF';
        canvasCtx.lineWidth = 2;
        canvasCtx.fill();
        canvasCtx.stroke();
        
        canvasCtx.fillStyle = '#FFF';
        canvasCtx.font = 'bold 16px Arial';
        canvasCtx.textAlign = 'center';
        canvasCtx.fillText(`P${i+1}`, cursor.x, cursor.y + 5);
        canvasCtx.restore();
      });

      // Draw HUD
      canvasCtx.save();
      canvasCtx.textAlign = 'left';
      canvasCtx.textBaseline = 'top';
      canvasCtx.fillStyle = 'white';
      canvasCtx.shadowColor = 'black';
      canvasCtx.shadowBlur = 4;
      canvasCtx.font = 'bold 24px monospace';
      
      state.playerScores.forEach((score, i) => {
        canvasCtx.fillStyle = state.cursors[i]?.color || '#FFF';
        const name = state.playerNames[i] || `P${i+1}`;
        canvasCtx.fillText(`${name}: ${score}`, 30, 30 + i * 35);
      });
      canvasCtx.restore();
    });

    const camera = new window.Camera(videoElement, {
      onFrame: async () => {
        await hands.send({image: videoElement});
      },
      width: 1280,
      height: 720
    });
    
    try {
      await camera.start();
    } catch (error: any) {
      console.error("Camera error:", error);
      setCameraError(error.message || "Không thể truy cập camera. Vui lòng cấp quyền truy cập.");
    }
  };

  return (
    <ErrorBoundary>
      <div className="relative w-screen h-screen overflow-hidden bg-slate-900 text-white font-sans">
      {cameraError && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-900/90 p-8">
          <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl border-2 border-rose-500 shadow-2xl text-center">
            <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Lỗi Camera</h2>
            <p className="text-slate-400 mb-6">{cameraError}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-all"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      )}
      {/* Main Game Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 z-10 w-full h-full object-cover"></canvas>

      {/* Background Physics Elements */}
      <div className="absolute inset-0 z-20 opacity-10 pointer-events-none flex flex-wrap justify-around items-center p-20 overflow-hidden">
        <div className="text-8xl font-serif">E = mc²</div>
        <div className="text-8xl font-serif">F = ma</div>
        <div className="text-8xl font-serif">λ = v/f</div>
        <div className="text-8xl font-serif">P = UI</div>
        <div className="text-8xl font-serif">v = s/t</div>
        <div className="text-8xl font-serif">Ω</div>
        <div className="text-8xl font-serif">α β γ</div>
      </div>
      
      {/* Background stars */}
      <div className="absolute inset-0 z-20 opacity-20 pointer-events-none" 
           style={{
             backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
             backgroundSize: '50px 50px'
           }}>
      </div>

      {/* Menus & Overlays */}
      {/* Settings / Controls Overlay */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        {user && (
          <div className="flex items-center gap-2 bg-slate-800/80 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-white text-sm">
            {userRole === 'admin' ? <ShieldCheck className="w-4 h-4 text-amber-400" /> : <GraduationCap className="w-4 h-4 text-blue-400" />}
            <span className="font-medium">{user.displayName}</span>
          </div>
        )}

        <button 
          onClick={() => {
            const newEnabled = !isMusicEnabled;
            setIsMusicEnabled(newEnabled);
            if (newEnabled) {
              playMusic(uiMode, true);
            } else {
              stopMusic();
            }
          }}
          className={`p-3 rounded-full backdrop-blur-md border border-white/20 shadow-lg transition-all ${
            isMusicEnabled ? 'bg-blue-600/80 text-white' : 'bg-slate-800/80 text-slate-400'
          }`}
          title={isMusicEnabled ? "Tắt nhạc" : "Bật nhạc"}
        >
          {isMusicEnabled ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
          )}
        </button>
        
        {uiMode === 'menu' && userRole === 'admin' && (
          <button 
            onClick={() => setUiMode('editor')}
            className="p-3 rounded-full bg-slate-800/80 text-white backdrop-blur-md border border-white/20 shadow-lg hover:bg-slate-700 transition-all"
            title="Cài đặt câu hỏi"
          >
            <Settings className="w-6 h-6" />
          </button>
        )}

        {user ? (
          <button 
            onClick={handleLogout}
            className="p-3 rounded-full bg-rose-600/80 text-white backdrop-blur-md border border-white/20 shadow-lg hover:bg-rose-500 transition-all"
            title="Đăng xuất"
          >
            <LogOut className="w-6 h-6" />
          </button>
        ) : (
          <button 
            onClick={handleLogin}
            className="p-3 rounded-full bg-emerald-600/80 text-white backdrop-blur-md border border-white/20 shadow-lg hover:bg-emerald-500 transition-all"
            title="Đăng nhập"
          >
            <LogIn className="w-6 h-6" />
          </button>
        )}
      </div>

      {uiMode === 'menu' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm p-8">
          <div className="max-w-2xl bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 w-full">
            <h1 className="text-4xl font-bold text-blue-400 mb-6 text-center">Vật Lý AR Quiz</h1>
            
            <div className="space-y-4 text-slate-300 mb-8 leading-relaxed text-sm">
              <p className="text-center text-lg">Chào mừng thầy Hiệp và các em học sinh!</p>
              <p>Trò chơi trắc nghiệm tương tác AR hỗ trợ tối đa 4 người chơi cùng lúc.</p>
              
              <div className="grid grid-cols-1 gap-4 mt-4 bg-slate-900 p-4 rounded-xl">
                <div>
                  <h3 className="font-semibold text-blue-400 mb-1">Hướng dẫn chơi:</h3>
                  <ul className="list-disc list-inside space-y-2 text-slate-400">
                    <li>Đứng trước camera sao cho thấy rõ bàn tay.</li>
                    <li>Chụm ngón cái và ngón trỏ để <b>GẮP</b> đáp án.</li>
                    <li>Kéo đáp án đúng thả vào <b>GIỎ</b> ở giữa màn hình.</li>
                    <li>Trả lời đúng được +100 điểm, sai bị -50 điểm.</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {user ? (
                <>
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 mb-2">
                    <h3 className="text-blue-400 font-bold mb-3 flex items-center gap-2">
                      <BookOpen className="w-5 h-5" /> Chọn bộ câu hỏi (Bài học):
                    </h3>
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {questionSets.length === 0 ? (
                        <p className="text-slate-500 text-sm italic text-center py-2">Chưa có bộ câu hỏi nào.</p>
                      ) : (
                        questionSets.map((set) => (
                          <button
                            key={set.id}
                            onClick={() => setSelectedSetId(set.id)}
                            className={`w-full p-3 rounded-lg text-left transition-all border ${
                              selectedSetId === set.id 
                                ? 'bg-blue-600/20 border-blue-500 text-blue-100 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium">{set.title}</span>
                              {selectedSetId === set.id && <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      if (!selectedSetId) {
                        alert('Vui lòng chọn một bộ câu hỏi trước khi bắt đầu!');
                        return;
                      }
                      initGame('quiz');
                    }}
                    disabled={!selectedSetId}
                    className={`w-full py-4 font-bold rounded-xl transition-all transform hover:scale-105 text-xl flex items-center justify-center gap-3 ${
                      selectedSetId 
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]' 
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <Play className="w-6 h-6 fill-current" />
                    BẮT ĐẦU CHƠI
                  </button>

                  <button 
                    onClick={() => setShowHistory(!showHistory)}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(37,99,235,0.4)] text-xl flex items-center justify-center gap-3"
                  >
                    <HistoryIcon className="w-6 h-6" />
                    LỊCH SỬ ĐẤU
                  </button>

                  {showHistory && (
                    <div className="mt-4 bg-slate-900/50 rounded-xl p-4 max-h-60 overflow-y-auto border border-white/10 animate-in slide-in-from-top-4 duration-300">
                      <h3 className="text-blue-400 font-bold mb-3 flex items-center gap-2 sticky top-0 bg-slate-900/90 py-1">
                        <Trophy className="w-4 h-4" /> Thành tích gần đây
                      </h3>
                      <div className="space-y-2">
                        {gameHistory.length === 0 ? (
                          <p className="text-slate-500 text-sm italic text-center py-4">Chưa có dữ liệu lịch sử.</p>
                        ) : (
                          gameHistory.map((h) => (
                            <div key={h.id} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-white/5 hover:border-blue-500/30 transition-colors">
                              <div>
                                <p className="text-white text-sm font-semibold">{h.studentName}</p>
                                <p className="text-blue-400 text-[10px] uppercase font-bold">{h.setTitle || 'Bộ câu hỏi'}</p>
                                <p className="text-slate-500 text-xs">
                                  {h.timestamp?.toDate ? h.timestamp.toDate().toLocaleString('vi-VN') : 'Vừa xong'}
                                </p>
                              </div>
                              <div className="text-emerald-400 font-bold text-lg">{h.score}đ</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {userRole === 'admin' && (
                    <button 
                      onClick={() => setUiMode('editor')}
                      className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all transform hover:scale-105 border border-slate-600 text-xl flex items-center justify-center gap-3"
                    >
                      <Settings className="w-6 h-6" />
                      QUẢN LÝ CÂU HỎI
                    </button>
                  )}
                </>
              ) : (
                <button 
                  onClick={handleLogin}
                  className="w-full py-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all transform hover:scale-105 shadow-[0_0_30px_rgba(16,185,129,0.4)] text-2xl flex items-center justify-center gap-4"
                >
                  <LogIn className="w-8 h-8" />
                  ĐĂNG NHẬP ĐỂ BẮT ĐẦU
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {uiMode === 'editor' && (
        <div className="absolute inset-0 bg-slate-900/95 flex flex-col p-8 overflow-auto z-50">
          <div className="max-w-6xl mx-auto w-full flex flex-col md:flex-row gap-8">
            {/* Sidebar: Question Sets */}
            <div className="w-full md:w-72 flex-shrink-0 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2">
                  <BookOpen className="w-5 h-5" /> Bộ câu hỏi
                </h2>
                <button 
                  onClick={() => setIsCreatingSet(true)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-blue-400 transition-colors"
                  title="Tạo bộ mới"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {isCreatingSet && (
                <div className="bg-slate-800 p-4 rounded-xl border border-blue-500/30 animate-in slide-in-from-top-2 duration-200">
                  <input 
                    type="text"
                    placeholder="Tên bộ câu hỏi..."
                    value={newSetTitle}
                    onChange={(e) => setNewSetTitle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white p-2 rounded-lg mb-3 outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={handleCreateSet}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-1.5 rounded-lg text-xs font-bold"
                    >
                      Tạo
                    </button>
                    <button 
                      onClick={() => setIsCreatingSet(false)}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-1.5 rounded-lg text-xs font-bold"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {questionSets.map((set) => (
                  <div 
                    key={set.id}
                    className={`group relative flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedSetId === set.id 
                        ? 'bg-blue-600/20 border-blue-500 text-blue-100' 
                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                    onClick={() => setSelectedSetId(set.id)}
                  >
                    <span className="font-medium truncate pr-6">{set.title}</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSet(set.id);
                      }}
                      className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all"
                      title="Xóa bộ này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {questionSets.length === 0 && !isCreatingSet && (
                  <p className="text-slate-500 text-sm italic text-center py-8">Chưa có bộ câu hỏi nào.</p>
                )}
              </div>

              <button 
                onClick={() => setUiMode('menu')}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <ArrowLeft className="w-4 h-4" /> Quay lại Menu
              </button>
            </div>

            {/* Main Content: Questions */}
            <div className="flex-1 min-w-0">
              {!selectedSetId ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4 py-20 bg-slate-800/30 rounded-3xl border-2 border-dashed border-slate-700">
                  <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center">
                    <BookOpen className="w-10 h-10 opacity-20" />
                  </div>
                  <p className="text-xl font-medium">Vui lòng chọn hoặc tạo một bộ câu hỏi để quản lý</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Settings className="w-8 h-8 text-blue-400" />
                        {questionSets.find(s => s.id === selectedSetId)?.title}
                      </h1>
                      <p className="text-slate-500 text-sm mt-1">Quản lý các câu hỏi trong bộ này</p>
                    </div>
                  </div>

                  {editingIndex !== null ? (
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-8">
                <h2 className="text-2xl font-semibold text-white mb-6">
                  {editingIndex >= questions.length ? 'Thêm câu hỏi mới' : 'Chỉnh sửa câu hỏi'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-400 text-sm mb-1">Câu hỏi</label>
                    <textarea 
                      value={editForm.q}
                      onChange={(e) => setEditForm({...editForm, q: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.keys(editForm.options).map((key) => (
                      <div key={key}>
                        <label className="block text-slate-400 text-sm mb-1">Đáp án {key}</label>
                        <input 
                          type="text"
                          value={editForm.options[key as keyof typeof editForm.options]}
                          onChange={(e) => setEditForm({
                            ...editForm, 
                            options: { ...editForm.options, [key]: e.target.value }
                          })}
                          className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-slate-400 text-sm mb-1">Đáp án đúng</label>
                    <select 
                      value={editForm.correct}
                      onChange={(e) => setEditForm({...editForm, correct: e.target.value as 'A'|'B'|'C'|'D'})}
                      className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={handleSaveQuestion}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2"
                    >
                      <Save className="w-5 h-5" />
                      Lưu câu hỏi
                    </button>
                    <button 
                      onClick={() => setEditingIndex(null)}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2"
                    >
                      <X className="w-5 h-5" />
                      Hủy
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-4">
                  <button 
                    onClick={handleAddQuestion}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20"
                  >
                    <Plus className="w-6 h-6" />
                    Thêm câu hỏi mới
                  </button>
                  <button 
                    onClick={() => setShowAiParser(true)}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
                    title="AI Parser (Dán văn bản thô)"
                  >
                    <Sparkles className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={() => {
                      setBulkJson(JSON.stringify(questions, null, 2));
                      setShowBulkImport(true);
                    }}
                    className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
                    title="Nhập hàng loạt JSON"
                  >
                    <FileJson className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={handleClearAll}
                    className="bg-red-900/50 hover:bg-red-800 text-red-200 px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg border border-red-500/30"
                    title="Xóa tất cả"
                  >
                    <Trash2 className="w-6 h-6" />
                  </button>
                </div>

                {showAiParser && (
                  <div className="bg-slate-800 p-6 rounded-2xl border-2 border-purple-500/50 shadow-2xl animate-in fade-in zoom-in duration-200">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold text-purple-400 flex items-center gap-2">
                        <Sparkles className="w-6 h-6" />
                        AI Parser (Dán văn bản thô)
                      </h3>
                      <button onClick={() => setShowAiParser(false)} className="text-slate-400 hover:text-white">
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                    <p className="text-slate-400 text-sm mb-4">
                      Dán nội dung bài học hoặc danh sách câu hỏi thô vào đây. AI sẽ tự động bóc tách thành câu hỏi trắc nghiệm.
                    </p>
                    <textarea 
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      className="w-full h-64 bg-slate-900 border border-slate-700 text-white p-4 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none mb-4"
                      placeholder="Ví dụ: Câu 1: Trái đất quay quanh mặt trời mất bao lâu? A. 24h, B. 365 ngày, C. 1 tháng, D. 1 năm..."
                    />
                    <div className="flex gap-4">
                      <button 
                        onClick={handleAiParse}
                        disabled={isAiParsing || !aiInput.trim()}
                        className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 disabled:text-purple-400 text-white py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2"
                      >
                        {isAiParsing ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Đang bóc tách...
                          </>
                        ) : (
                          'Bắt đầu bóc tách'
                        )}
                      </button>
                      <button 
                        onClick={() => setShowAiParser(false)}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-bold transition-all"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}

                {showBulkImport && (
                  <div className="bg-slate-800 p-6 rounded-2xl border-2 border-blue-500/50 shadow-2xl animate-in fade-in zoom-in duration-200">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold text-blue-400">Nhập hàng loạt JSON</h3>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            const template = [
                              {
                                q: "Câu hỏi mẫu?",
                                options: { A: "Đáp án A", B: "Đáp án B", C: "Đáp án C", D: "Đáp án D" },
                                correct: "A"
                              }
                            ];
                            setBulkJson(JSON.stringify(template, null, 2));
                          }}
                          className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-slate-300"
                        >
                          Mẫu chuẩn
                        </button>
                        <button onClick={() => setShowBulkImport(false)} className="text-slate-400 hover:text-white">
                          <X className="w-6 h-6" />
                        </button>
                      </div>
                    </div>
                    <p className="text-slate-400 text-sm mb-4">
                      Dán mảng JSON chứa các câu hỏi vào đây. Hỗ trợ cả định dạng từ "AI Parser".
                    </p>
                    <textarea 
                      value={bulkJson}
                      onChange={(e) => setBulkJson(e.target.value)}
                      className="w-full h-64 bg-slate-900 border border-slate-700 text-white p-4 rounded-xl font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none mb-4"
                      placeholder='[{"q": "Câu hỏi?", "options": {"A": "ĐA1", ...}, "correct": "A"}]'
                    />
                    <div className="flex gap-4">
                      <button 
                        onClick={handleBulkImport}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold transition-all"
                      >
                        Xác nhận nhập
                      </button>
                      <button 
                        onClick={() => setShowBulkImport(false)}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-bold transition-all"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid gap-4">
                  {questions.map((q, idx) => (
                    <div key={idx} className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="text-blue-400 text-sm font-mono mb-1">Câu {idx + 1}</div>
                        <p className="text-white font-medium mb-3">{q.q}</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {Object.entries(q.options).map(([key, val]) => (
                            <div key={key} className={`${q.correct === key ? 'text-green-400 font-bold' : 'text-slate-400'}`}>
                              {key}: {val}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => handleEditQuestion(idx)}
                          className="p-2 bg-slate-700 hover:bg-blue-600 text-white rounded-lg transition-colors"
                          title="Sửa"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteQuestion(idx)}
                          className="p-2 bg-slate-700 hover:bg-red-600 text-white rounded-lg transition-colors"
                          title="Xóa"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  </div>
)}

      {uiMode === 'setup' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-md p-8">
          <div className="max-w-md bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 w-full">
            <h2 className="text-2xl font-bold text-blue-400 mb-6 text-center uppercase tracking-wider">Tên Người Chơi</h2>
            <div className="space-y-4 mb-8">
              {playerNames.map((name, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-lg" 
                       style={{ backgroundColor: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'][i] }}>
                    P{i+1}
                  </div>
                  <input 
                    type="text" 
                    value={name}
                    placeholder={`Người chơi ${i+1}`}
                    onChange={(e) => {
                      const newNames = [...playerNames];
                      newNames[i] = e.target.value;
                      setPlayerNames(newNames);
                    }}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              ))}
            </div>
            <button 
              onClick={() => initGame('quiz')}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg text-xl uppercase tracking-widest"
            >
              VÀO TRẬN ĐẤU
            </button>
          </div>
        </div>
      )}

      {/* Quiz UI Overlay */}
      {uiMode === 'quiz' && (
        <div className="absolute top-10 left-0 w-full z-50 flex flex-col items-center pointer-events-none">
          <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl border-2 border-blue-500 shadow-2xl max-w-3xl w-[90%] text-center">
            <h2 className="text-blue-400 text-sm font-bold uppercase tracking-widest mb-2">Câu hỏi {gameState.current.questionIndex + 1} / {gameState.current.questions.length}</h2>
            <p className="text-2xl font-bold mb-6 leading-tight">
              {gameState.current.questions[gameState.current.questionIndex].q}
            </p>
            <div className="grid grid-cols-2 gap-4 text-left">
              {Object.entries(gameState.current.questions[gameState.current.questionIndex].options).map(([key, val]) => (
                <div key={key} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 text-lg">
                  <span className="text-blue-400 font-bold mr-2">{key}.</span> {val}
                </div>
              ))}
            </div>
          </div>
          
          {/* Feedback Overlay */}
          {feedback && (
            <div className={`mt-8 px-10 py-4 rounded-2xl font-bold text-2xl animate-bounce shadow-2xl border-4 ${
              feedback.type === 'correct' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-rose-600 border-rose-400 text-white'
            }`}>
              {feedback.message}
            </div>
          )}
          
          {/* Cooldown Overlay (Legacy, replaced by feedback but keeping for safety) */}
          {!feedback && Date.now() < gameState.current.cooldownUntil && (
            <div className="mt-8 bg-blue-500 text-white px-8 py-3 rounded-full font-bold text-xl animate-pulse shadow-lg">
              CHUẨN BỊ CÂU TIẾP THEO...
            </div>
          )}
        </div>
      )}

      {uiMode === 'gameover' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-900/90 backdrop-blur-md p-8">
          <div className="max-w-2xl w-full bg-slate-900/80 p-8 rounded-3xl border border-red-500/30 shadow-2xl">
            <h1 className="text-5xl font-bold text-white mb-2 text-center drop-shadow-lg">KẾT THÚC</h1>
            <p className="text-xl text-red-200 mb-8 text-center">Bảng thành tích cuối cùng</p>
            
            <div className="space-y-4 mb-10">
              {gameState.current.playerScores.map((score, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-md" 
                         style={{ backgroundColor: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'][i] }}>
                      P{i+1}
                    </div>
                    <span className="text-xl font-semibold">{gameState.current.playerNames[i]}</span>
                  </div>
                  <span className="text-2xl font-mono text-yellow-400 font-bold">{score}</span>
                </div>
              ))}
            </div>

            <div className="text-center border-t border-slate-700 pt-8">
              <p className="text-slate-400 mb-2">Tổng điểm</p>
              <p className="text-5xl font-mono text-white font-bold mb-8">{finalScore}</p>
              <button 
                onClick={() => setUiMode('menu')}
                className="px-12 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xl transition-all hover:scale-105 shadow-xl"
              >
                Về Menu Chính
              </button>
            </div>
          </div>
        </div>
      )}

      {uiMode === 'win' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-emerald-900/90 backdrop-blur-md p-8">
          <div className="max-w-2xl w-full bg-slate-900/80 p-8 rounded-3xl border border-emerald-500/30 shadow-2xl">
            <h1 className="text-5xl font-bold text-white mb-2 text-center drop-shadow-lg">HOÀN THÀNH!</h1>
            <p className="text-xl text-emerald-200 mb-8 text-center">Bảng thành tích của cả lớp</p>
            
            <div className="space-y-4 mb-10">
              {gameState.current.playerScores.map((score, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-md" 
                         style={{ backgroundColor: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'][i] }}>
                      P{i+1}
                    </div>
                    <span className="text-xl font-semibold">{gameState.current.playerNames[i]}</span>
                  </div>
                  <span className="text-2xl font-mono text-yellow-400 font-bold">{score}</span>
                </div>
              ))}
            </div>

            <div className="text-center border-t border-slate-700 pt-8">
              <p className="text-slate-400 mb-2">Tổng điểm cả lớp</p>
              <p className="text-5xl font-mono text-white font-bold mb-8">{finalScore}</p>
              <button 
                onClick={() => setUiMode('menu')}
                className="px-12 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xl transition-all hover:scale-105 shadow-xl"
              >
                Về Menu Chính
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden video element for MediaPipe */}
      <video ref={videoRef} className="hidden" playsInline autoPlay></video>
    </div>
    </ErrorBoundary>
  );
}
