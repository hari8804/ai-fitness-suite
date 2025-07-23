import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import * as Tone from 'tone';

// --- Chart.js Registration ---
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// --- Default Data ---
const initialWorkoutPlan = { 'Monday': { emoji: '💪', title: 'Upper Body Push', mainWorkout: { title: 'Main Workout', exercises: [ { name: 'Barbell Bench Press', sets: 4, reps: '8-10', rest: '90s' }, { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12', rest: '60s' }, { name: 'Dumbbell Shoulder Press', sets: 3, reps: '10-12', rest: '60s' }, { name: 'Tricep Pushdowns', sets: 3, reps: '12-15', rest: '45s' }, { name: 'Lateral Raises', sets: 4, reps: '15', rest: '45s' } ] }, warmUp: [ "5-10 min light cardio", "Dynamic chest and shoulder stretches" ], coolDown: "Static chest, shoulder, and tricep stretches" }, 'Tuesday': { emoji: '🦵', title: 'Lower Body Strength', mainWorkout: { title: 'Main Workout', exercises: [ { name: 'Barbell Back Squats', sets: 4, reps: '8-10', rest: '120s' }, { name: 'Romanian Deadlifts', sets: 3, reps: '10-12', rest: '90s' }, { name: 'Leg Press', sets: 3, reps: '12-15', rest: '60s' }, { name: 'Leg Curls', sets: 3, reps: '15', rest: '45s' }, { name: 'Calf Raises', sets: 4, reps: '15-20', rest: '45s' } ] }, warmUp: [ "5 min on stationary bike", "Leg swings and hip mobility drills" ], coolDown: "Quad, hamstring, and glute stretches" }, 'Thursday': { emoji: '✈️', title: 'Upper Body Pull', mainWorkout: { title: 'Main Workout', exercises: [ { name: 'Pull-ups or Lat Pulldowns', sets: 4, reps: '8-12', rest: '90s' }, { name: 'Bent-Over Barbell Rows', sets: 3, reps: '10-12', rest: '60s' }, { name: 'Seated Cable Rows', sets: 3, reps: '12-15', rest: '60s' }, { name: 'Face Pulls', sets: 4, reps: '15-20', rest: '45s' }, { name: 'Bicep Curls', sets: 3, reps: '12-15', rest: '45s' } ] }, warmUp: [ "5 min rowing", "Band pull-aparts and arm circles" ], coolDown: "Lat, bicep, and upper back stretches" }, 'Friday': { emoji: '🔥', title: 'Full Body Conditioning', mainCircuit: { title: 'Functional Circuit', details: 'Complete 3-4 rounds, 45s work, 15s rest', exercises: [ { name: "Kettlebell Swings", sets: 4, reps: "45s", rest: "15s" }, { name: "Dumbbell Thrusters", sets: 4, reps: "45s", rest: "15s" }, { name: "Burpees", sets: 4, reps: "45s", rest: "15s" }, { name: "Renegade Rows", sets: 4, reps: "45s", rest: "15s" }, { name: "Plank", sets: 4, reps: "45s", rest: "15s" } ] }, warmUp: [ "Jumping jacks and high knees", "Full body dynamic movements" ], coolDown: "Full body static stretching" } };

// --- HELPER HOOKS & FUNCTIONS ---
const usePersistentState = (key, defaultValue) => {
    const [state, setState] = useState(() => {
        try {
            const storedValue = localStorage.getItem(key);
            return storedValue ? JSON.parse(storedValue) : defaultValue;
        } catch (error) {
            console.error("Error parsing localStorage key:", key, error);
            return defaultValue;
        }
    });
    useEffect(() => {
        localStorage.setItem(key, JSON.stringify(state));
    }, [key, state]);
    return [state, setState];
};

const callGeminiAPI = async (prompt, jsonSchema = null) => {
    // This now securely reads the API key from the hosting environment
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY; 
    if (!apiKey) return "API Key Missing: Please set up the REACT_APP_GEMINI_API_KEY environment variable in your hosting provider (e.g., Netlify).";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
    if (jsonSchema) payload.generationConfig = { responseMimeType: "application/json", responseSchema: jsonSchema };
    try {
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);
        const result = await response.json();
        if (result.candidates?.[0]?.content?.parts?.[0]?.text) return result.candidates[0].content.parts[0].text;
        throw new Error("Invalid API response structure.");
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return `Sorry, an error occurred: ${error.message}.`;
    }
};

// --- UI COMPONENTS ---
const Icon = ({ name, className }) => {
    const icons = {
        explain: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>,
        swap: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="8 21 3 21 3 16"></polyline><line x1="15" y1="4" x2="3" y2="16"></line></svg>,
        close: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>,
    };
    return <div className={className}>{icons[name]}</div>;
};

const Clock = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timerId = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);

    const date = time.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const currentTime = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="text-center text-slate-400 text-sm mt-4">
            <p>{date} | {currentTime}</p>
        </div>
    );
};

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-slate-700">
                    <h3 className="text-xl font-bold text-slate-100">{title}</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-cyan-400"><Icon name="close" /></button>
                </div>
                <div className="p-6 overflow-y-auto">{children}</div>
            </div>
        </div>
    );
};

const LogWorkoutModal = ({ isOpen, onClose, exercise, onSave }) => {
    const [setsData, setSetsData] = useState([]);
    useEffect(() => {
        if (exercise) {
            const numSets = parseInt(exercise.sets.match(/\d+/)?.[0] || 1);
            const today = new Date().toISOString().slice(0, 10);
            const existingLog = JSON.parse(localStorage.getItem('progressLog'))?.[today]?.[exercise.key]?.sets || [];
            setSetsData(Array.from({ length: numSets }, (_, i) => ({ weight: existingLog[i]?.weight || '', reps: existingLog[i]?.reps || '' })));
        }
    }, [exercise]);

    if (!isOpen || !exercise) return null;
    const handleSave = () => { onSave(exercise, setsData); onClose(); };
    const handleSetChange = (index, field, value) => {
        const newSetsData = [...setsData];
        newSetsData[index][field] = value;
        setSetsData(newSetsData);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Log: ${exercise.name}`}>
            <div className="space-y-4">
                {setsData.map((set, i) => (
                    <div key={i} className="grid grid-cols-3 gap-4 items-center">
                        <span className="font-medium text-slate-300">Set {i + 1}</span>
                        <div><label className="text-xs text-slate-400">Weight</label><input type="number" className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white" value={set.weight} onChange={e => handleSetChange(i, 'weight', e.target.value)} /></div>
                        <div><label className="text-xs text-slate-400">Reps</label><input type="number" className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white" value={set.reps} onChange={e => handleSetChange(i, 'reps', e.target.value)} /></div>
                    </div>
                ))}
            </div>
            <div className="p-4 mt-4 border-t border-slate-700 -mx-6 -mb-6"><button onClick={handleSave} className="w-full bg-cyan-500 text-slate-900 font-bold py-3 rounded-lg hover:bg-cyan-400">Save & Mark Complete</button></div>
        </Modal>
    );
};

const RestTimer = ({ seconds, onSkip }) => {
    const [timeLeft, setTimeLeft] = useState(seconds);
    useEffect(() => {
        if (seconds === 0) return;
        setTimeLeft(seconds);
        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    if (Tone.context.state !== 'running') {
                        Tone.context.resume();
                    }
                    const synth = new Tone.Synth().toDestination();
                    synth.triggerAttackRelease("C5", "0.5");
                    onSkip();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [seconds, onSkip]);

    if (seconds === 0) return null;
    const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
    const secs = String(timeLeft % 60).padStart(2, '0');

    return (
        <div className="fixed bottom-5 right-5 bg-slate-800 border border-slate-700 text-white rounded-2xl shadow-2xl p-6 w-64 z-50 transform transition-all animate-fade-in">
            <h3 className="font-bold text-lg mb-2 text-cyan-400">Rest Timer</h3>
            <p className="text-5xl font-mono text-center mb-4">{mins}:{secs}</p>
            <button onClick={onSkip} className="w-full bg-slate-700 text-slate-200 font-bold py-2 rounded-lg hover:bg-slate-600">Skip</button>
        </div>
    );
};

// --- MAIN APP ---
export default function App() {
    const [activePage, setActivePage] = useState('plan');
    const [workoutPlan, setWorkoutPlan] = usePersistentState('workoutPlan', initialWorkoutPlan);
    const [progressLog, setProgressLog] = usePersistentState('progressLog', {});
    
    const [modalState, setModalState] = useState({ isOpen: false, title: '', content: '', footer: null });
    const [loggingExercise, setLoggingExercise] = useState(null);
    const [timerSeconds, setTimerSeconds] = useState(0);

    const handleAIAction = async (prompt, title, options = {}) => {
        setModalState({ isOpen: true, title, children: <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-400"></div><p className="ml-4 text-slate-300">AI is thinking...</p></div> });
        const response = await callGeminiAPI(prompt, options.schema);
        
        if (options.isPlan) {
            try {
                const newPlan = JSON.parse(response);
                let planHtml = '';
                for(const day in newPlan) {
                    const dayData = newPlan[day];
                    planHtml += `<div class="mb-6"><h3 class="text-xl font-bold text-cyan-400 mb-2">${dayData.emoji || '💪'} ${day} - ${dayData.title}</h3>`;
                    const exercises = dayData.mainWorkout?.exercises || dayData.mainCircuit?.exercises || [];
                    planHtml += '<ul class="list-disc list-inside text-slate-300">';
                    exercises.forEach(ex => { planHtml += `<li><strong>${ex.name}:</strong> ${ex.sets} sets of ${ex.reps}, ${ex.rest} rest</li>`; });
                    planHtml += '</ul></div>';
                }
                const footer = <button onClick={() => { setWorkoutPlan(newPlan); setProgressLog({}); setActivePage('plan'); setModalState({isOpen: false}); }} className="bg-cyan-500 text-slate-900 font-bold py-2 px-6 rounded-lg shadow-md hover:bg-cyan-400">Use This Plan</button>;
                setModalState({ isOpen: true, title, children: <div dangerouslySetInnerHTML={{ __html: planHtml }} />, footerContent: footer });
            } catch (e) {
                setModalState({ isOpen: true, title: 'Generation Failed', children: <p className="text-red-400">The AI returned a plan in an unexpected format. Please try again.</p> });
            }
        } else {
            setModalState(prev => ({ ...prev, children: <div className="prose prose-invert prose-p:text-slate-300 prose-strong:text-white" dangerouslySetInnerHTML={{ __html: response.replace(/\n/g, '<br />') }} /> }));
        }
    };

    const handleSaveLog = useCallback((exercise, setsData) => {
        const today = new Date().toISOString().slice(0, 10);
        const newLog = { ...progressLog };
        if (!newLog[today]) newLog[today] = {};
        newLog[today][exercise.key] = {
            name: exercise.name,
            sets: setsData.map(s => ({ weight: parseFloat(s.weight) || 0, reps: parseInt(s.reps) || 0 })),
            isCompleted: true,
        };
        setProgressLog(newLog);
        const restSeconds = parseInt(exercise.rest.match(/\d+/)?.[0] || 0);
        if (restSeconds > 0) setTimerSeconds(restSeconds);
    }, [progressLog, setProgressLog]);

    const PageContent = () => {
        switch (activePage) {
            case 'plan': return <WorkoutPlanPage plan={workoutPlan} progressLog={progressLog} onLog={setLoggingExercise} onAIAction={handleAIAction} />;
            case 'generator': return <GeneratorPage onGenerate={handleAIAction} />;
            case 'progress': return <ProgressPage progressLog={progressLog} />;
            case 'nutrition': return <NutritionPage onAsk={handleAIAction} />;
            case 'timer': return <Stopwatch />;
            default: return null;
        }
    };

    return (
        <div className="bg-slate-900 text-slate-300 min-h-screen">
            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                <header className="text-center mb-10">
                    <h1 className="text-4xl sm:text-5xl font-bold text-white">AI Fitness Suite</h1>
                    <p className="mt-2 text-lg text-slate-400">Your personalized path to peak performance.</p>
                    <Clock />
                </header>

                <nav className="bg-slate-800/50 backdrop-blur-sm p-2 rounded-xl flex justify-center gap-2 mb-10 sticky top-4 z-40">
                    {['plan', 'generator', 'progress', 'nutrition', 'timer'].map(page => (
                        <button key={page} onClick={() => setActivePage(page)} className={`flex-1 font-semibold py-3 px-6 rounded-lg capitalize transition-colors ${activePage === page ? 'bg-cyan-500 text-slate-900' : 'text-slate-300 hover:bg-slate-700/50'}`}>
                            {page}
                        </button>
                    ))}
                </nav>

                <main><PageContent /></main>
                
                <Modal isOpen={modalState.isOpen} onClose={() => setModalState({isOpen: false})} title={modalState.title}>
                    {modalState.children}
                    {modalState.footerContent && <div className="p-4 mt-4 border-t border-slate-700 text-right">{modalState.footerContent}</div>}
                </Modal>
                <LogWorkoutModal isOpen={!!loggingExercise} onClose={() => setLoggingExercise(null)} exercise={loggingExercise} onSave={handleSaveLog} />
                <RestTimer seconds={timerSeconds} onSkip={() => setTimerSeconds(0)} />
            </div>
        </div>
    );
}

// --- PAGE COMPONENTS ---
const WorkoutPlanPage = ({ plan, progressLog, onLog, onAIAction }) => {
    const dayOfWeek = new Date().toLocaleString('en-us', { weekday: 'long' });
    const [currentDay, setCurrentDay] = useState(Object.keys(plan).includes(dayOfWeek) ? dayOfWeek : Object.keys(plan)[0]);
    
    const today = new Date().toISOString().slice(0, 10);
    const dayData = plan[currentDay];

    const handleExplain = (name) => onAIAction(`Explain how to perform the exercise "${name}". Describe proper form, common mistakes, and primary muscles worked. Format with headings.`, `Explaining: ${name}`);
    const handleSwap = (name) => onAIAction(`Suggest one single alternative exercise for "${name}" that targets similar muscle groups. Provide only the name of the new exercise.`, `Swap Suggestion for: ${name}`);

    return (
        <div className="space-y-8">
            <div className="bg-slate-800/50 p-6 rounded-2xl">
                <h2 className="text-2xl font-bold text-white mb-4">Today's Focus: <span className="text-cyan-400">{plan[dayOfWeek]?.title || 'Rest Day'}</span></h2>
                <div className="flex flex-wrap justify-center gap-2">
                    {Object.keys(plan).map(day => (
                        <button key={day} onClick={() => setCurrentDay(day)} className={`text-sm font-semibold py-2 px-4 rounded-full transition-colors ${day === currentDay ? 'bg-cyan-500 text-slate-900' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                            {plan[day].emoji || '💪'} {day}
                        </button>
                    ))}
                </div>
            </div>

            {dayData && (
                <div className="workout-card bg-slate-800/50 p-6 rounded-2xl">
                    {[dayData.mainWorkout, dayData.mainCircuit, dayData.coreFinisher].filter(Boolean).map(section => (
                        <div key={section.title} className="mb-8">
                            <h3 className="text-xl font-bold text-white mb-4">{section.title}</h3>
                            {section.details && <p className="text-sm text-slate-400 mb-4">{section.details}</p>}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-400 uppercase">
                                        <tr><th className="py-3 px-4">Exercise</th><th className="py-3 px-4 text-center">Sets</th><th className="py-3 px-4 text-center">Reps</th><th className="py-3 px-4 text-center">Rest</th><th className="py-3 px-4 text-center">Actions</th></tr>
                                    </thead>
                                    <tbody>
                                        {section.exercises.map((ex, i) => {
                                            const exerciseKey = `${section.title.toLowerCase().replace(/ /g, '-')}-${i}`;
                                            const isCompleted = progressLog[today]?.[exerciseKey]?.isCompleted || false;
                                            return (
                                                <tr key={exerciseKey} className={`border-b border-slate-700 ${isCompleted ? 'bg-cyan-500/10' : ''}`}>
                                                    <td className="py-4 px-4 font-medium text-white">{ex.name}</td>
                                                    <td className="py-4 px-4 text-center">{ex.sets}</td><td className="py-4 px-4 text-center">{ex.reps}</td><td className="py-4 px-4 text-center">{ex.rest || 'N/A'}</td>
                                                    <td className="py-4 px-4 text-center">
                                                        <div className="flex justify-center items-center gap-3">
                                                            <button onClick={() => onLog({ ...ex, key: exerciseKey })} className="bg-cyan-500 text-slate-900 text-xs font-bold py-1 px-3 rounded-full hover:bg-cyan-400 transition-colors">LOG</button>
                                                            <button onClick={() => handleExplain(ex.name)} className="text-slate-500 hover:text-cyan-400" title="Explain"><Icon name="explain"/></button>
                                                            <button onClick={() => handleSwap(ex.name)} className="text-slate-500 hover:text-cyan-400" title="Swap"><Icon name="swap"/></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const GeneratorPage = ({ onGenerate }) => {
    const [formData, setFormData] = useState({ goal: 'Fat Loss & General Fitness', experience: 'Intermediate', equipment: '' });
    const handleChange = e => setFormData({...formData, [e.target.id]: e.target.value });
    const handleGenerate = () => {
        const { goal, experience, equipment } = formData;
        const prompt = `Create a 4-day workout plan for a user with the goal of "${goal}". The user's experience level is "${experience}" and they have access to the following equipment: "${equipment || 'standard gym equipment'}". The plan should be split over four distinct days (e.g., Monday, Tuesday, Thursday, Friday). For each day, provide a title, a suitable emoji, a warm-up list, a cooldown description, and a list of main exercises. Each exercise must have a name, sets, reps, and rest period. Do not include video links.`;
        const schema = { type: "OBJECT", properties: { "Monday": { "type": "OBJECT", properties: { "emoji": { "type": "STRING" }, "title": { "type": "STRING" }, "warmUp": { "type": "ARRAY", "items": { "type": "STRING" } }, "coolDown": { "type": "STRING" }, "mainWorkout": { "type": "OBJECT", properties: { "title": { "type": "STRING" }, "exercises": { "type": "ARRAY", "items": { "type": "OBJECT", properties: { "name": { "type": "STRING" }, "sets": { "type": "STRING" }, "reps": { "type": "STRING" }, "rest": { "type": "STRING" } } } } } } } }, "Tuesday": { "type": "OBJECT", properties: { "emoji": { "type": "STRING" }, "title": { "type": "STRING" }, "warmUp": { "type": "ARRAY", "items": { "type": "STRING" } }, "coolDown": { "type": "STRING" }, "mainWorkout": { "type": "OBJECT", properties: { "title": { "type": "STRING" }, "exercises": { "type": "ARRAY", "items": { "type": "OBJECT", properties: { "name": { "type": "STRING" }, "sets": { "type": "STRING" }, "reps": { "type": "STRING" }, "rest": { "type": "STRING" } } } } } } } }, "Thursday": { "type": "OBJECT", properties: { "emoji": { "type": "STRING" }, "title": { "type": "STRING" }, "warmUp": { "type": "ARRAY", "items": { "type": "STRING" } }, "coolDown": { "type": "STRING" }, "mainWorkout": { "type": "OBJECT", properties: { "title": { "type": "STRING" }, "exercises": { "type": "ARRAY", "items": { "type": "OBJECT", properties: { "name": { "type": "STRING" }, "sets": { "type": "STRING" }, "reps": { "type": "STRING" }, "rest": { "type": "STRING" } } } } } } } }, "Friday": { "type": "OBJECT", properties: { "emoji": { "type": "STRING" }, "title": { "type": "STRING" }, "warmUp": { "type": "ARRAY", "items": { "type": "STRING" } }, "coolDown": { "type": "STRING" }, "mainWorkout": { "type": "OBJECT", properties: { "title": { "type": "STRING" }, "exercises": { "type": "ARRAY", "items": { "type": "OBJECT", properties: { "name": { "type": "STRING" }, "sets": { "type": "STRING" }, "reps": { "type": "STRING" }, "rest": { "type": "STRING" } } } } } } } } } };
        onGenerate(prompt, 'Your New AI-Generated Plan', { isPlan: true, schema });
    };

    return (
        <div className="bg-slate-800/50 p-8 rounded-2xl max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-2">AI Plan Generator</h2>
            <p className="text-slate-400 mb-8">Let Gemini create a custom workout plan tailored to you.</p>
            <div className="space-y-6">
                <div><label htmlFor="goal" className="block text-sm font-medium text-slate-300 mb-1">Primary Goal</label><select id="goal" value={formData.goal} onChange={handleChange} className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white"><option>Build Muscle (Hypertrophy)</option><option>Increase Strength (Powerlifting)</option><option>Fat Loss & General Fitness</option><option>Improve Athletic Performance</option></select></div>
                <div><label htmlFor="experience" className="block text-sm font-medium text-slate-300 mb-1">Experience Level</label><select id="experience" value={formData.experience} onChange={handleChange} className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white"><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></div>
                <div><label htmlFor="equipment" className="block text-sm font-medium text-slate-300 mb-1">Available Equipment</label><input type="text" id="equipment" value={formData.equipment} onChange={handleChange} className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white" placeholder="e.g., dumbbells, barbells, pull-up bar" /></div>
            </div>
            <div className="mt-8 text-center"><button onClick={handleGenerate} className="bg-cyan-500 text-slate-900 font-bold py-3 px-8 rounded-lg shadow-lg hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 focus:ring-offset-slate-800 transition-transform transform hover:scale-105">Generate My Plan</button></div>
        </div>
    );
};

const ProgressPage = ({ progressLog }) => {
    const [selectedExercise, setSelectedExercise] = useState('');
    const { allLoggedExercises, chartData, stats } = useMemo(() => {
        const exercises = [...new Set(Object.values(progressLog).flatMap(day => Object.values(day).map(ex => ex.name)))];
        const currentExercise = selectedExercise || exercises[0] || '';
        if (!selectedExercise && exercises.length > 0) setSelectedExercise(exercises[0]);

        const filteredData = Object.entries(progressLog)
            .map(([date, dayLog]) => {
                const exLogs = Object.values(dayLog).filter(ex => ex.name === currentExercise && ex.sets);
                if (exLogs.length === 0) return null;
                const maxWeight = Math.max(...exLogs.flatMap(ex => ex.sets.map(s => s.weight || 0)));
                return { date, maxWeight };
            }).filter(Boolean).sort((a,b) => new Date(a.date) - new Date(b.date));

        const bestLift = Math.max(0, ...filteredData.map(d => d.maxWeight));
        const totalWorkouts = Object.keys(progressLog).length;
        
        return {
            allLoggedExercises: exercises,
            stats: { bestLift, totalWorkouts },
            chartData: {
                labels: filteredData.map(d => d.date),
                datasets: [{
                    label: `Max Weight Lifted for ${currentExercise}`,
                    data: filteredData.map(d => d.maxWeight),
                    fill: true,
                    backgroundColor: 'rgba(56, 189, 248, 0.2)',
                    borderColor: 'rgb(56, 189, 248)',
                    tension: 0.1
                }]
            }
        };
    }, [progressLog, selectedExercise]);

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-800/50 p-6 rounded-2xl"><h4 className="text-slate-400 text-sm font-medium">Total Workouts Logged</h4><p className="text-3xl font-bold text-white">{stats.totalWorkouts}</p></div>
                <div className="bg-slate-800/50 p-6 rounded-2xl"><h4 className="text-slate-400 text-sm font-medium">Best Lift ({selectedExercise})</h4><p className="text-3xl font-bold text-white">{stats.bestLift} <span className="text-lg text-slate-400">lbs/kg</span></p></div>
            </div>
            <div className="bg-slate-800/50 p-6 rounded-2xl">
                <h2 className="text-2xl font-bold text-white mb-4">Performance Chart</h2>
                {allLoggedExercises.length > 0 ? (
                    <>
                        <div className="mb-6"><label htmlFor="progress-exercise-select" className="block text-sm font-medium text-slate-300 mb-1">Select an exercise:</label><select id="progress-exercise-select" value={selectedExercise} onChange={e => setSelectedExercise(e.target.value)} className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white">{allLoggedExercises.map(name => <option key={name} value={name}>{name}</option>)}</select></div>
                        <div><Line data={chartData} options={{ scales: { y: { beginAtZero: true, ticks: { color: '#94a3b8' } }, x: { ticks: { color: '#94a3b8' } } }, plugins: { legend: { labels: { color: '#cbd5e1' } } } }} /></div>
                        {chartData.labels.length < 2 && <p className="text-center text-slate-500 mt-4">Log this exercise on another day to see a trend line.</p>}
                    </>
                ) : (
                    <p className="text-center text-slate-500 py-10">Log some workouts to see your progress here!</p>
                )}
            </div>
        </div>
    );
};

const NutritionPage = ({ onAsk }) => {
    const [query, setQuery] = useState('');
    const handleAsk = () => {
        if (!query) return;
        const prompt = `As a helpful nutrition assistant for a fitness app, answer the following user query: "${query}". Provide a clear, helpful, and concise response. Format the response with markdown.`;
        onAsk(prompt, 'AI Nutrition Helper');
    };
    return (
        <div className="bg-slate-800/50 p-8 rounded-2xl max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-2">🥗 Nutrition Helper</h2>
            <p className="text-slate-400 mb-8">Ask Gemini for meal ideas, nutrition tips, and more.</p>
            <textarea value={query} onChange={e => setQuery(e.target.value)} className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white min-h-[120px]" placeholder="e.g., What's a good high-protein meal to eat after my leg day workout?"></textarea>
            <div className="mt-6 text-center"><button onClick={handleAsk} className="bg-cyan-500 text-slate-900 font-bold py-3 px-8 rounded-lg shadow-lg hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 focus:ring-offset-slate-800">Ask AI</button></div>
        </div>
    );
};

const Stopwatch = () => {
    const [time, setTime] = useState(0);
    const [isActive, setIsActive] = useState(false);

    useEffect(() => {
        let interval = null;
        if (isActive) {
            interval = setInterval(() => {
                setTime(prevTime => prevTime + 10);
            }, 10);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isActive]);

    const handleStart = () => setIsActive(true);
    const handleStop = () => setIsActive(false);
    const handleReset = () => {
        setIsActive(false);
        setTime(0);
    };

    const formatTime = (timeInMs) => {
        const minutes = String(Math.floor((timeInMs / 60000) % 60)).padStart(2, '0');
        const seconds = String(Math.floor((timeInMs / 1000) % 60)).padStart(2, '0');
        const milliseconds = String(Math.floor((timeInMs / 10) % 100)).padStart(2, '0');
        return `${minutes}:${seconds}.${milliseconds}`;
    };

    return (
        <div className="bg-slate-800/50 p-8 rounded-2xl max-w-md mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-6">Stopwatch</h2>
            <div className="text-7xl font-mono text-cyan-400 mb-8">{formatTime(time)}</div>
            <div className="flex justify-center gap-4">
                {!isActive ? 
                    <button onClick={handleStart} className="bg-green-500 text-white font-bold py-3 px-10 rounded-lg hover:bg-green-600 transition-colors">Start</button> :
                    <button onClick={handleStop} className="bg-red-500 text-white font-bold py-3 px-10 rounded-lg hover:bg-red-600 transition-colors">Stop</button>
                }
                <button onClick={handleReset} className="bg-slate-600 text-white font-bold py-3 px-10 rounded-lg hover:bg-slate-700 transition-colors">Reset</button>
            </div>
        </div>
    );
};
