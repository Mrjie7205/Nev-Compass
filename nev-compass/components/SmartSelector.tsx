
import React, { useState } from 'react';
import { Sparkles, Loader2, ChevronLeft, Check, RotateCcw, Calculator, Zap, Users, Wallet, RefreshCw } from 'lucide-react';
import { sendMessageToGemini } from '../services/geminiService';
import { CAR_DATABASE } from '../constants';
import { QuizQuestion } from '../types';
import CarCard from './CarCard';

const QUESTIONS: QuizQuestion[] = [
    {
        id: 'budget',
        text: '您的购车预算大约是多少？',
        description: '我们将根据落地价格为您匹配',
        options: [
            { label: '10万以内', value: '10万以内', icon: '💰' },
            { label: '10-20万', value: '10-20万', icon: '💴' },
            { label: '20-30万', value: '20-30万', icon: '💵' },
            { label: '30-50万', value: '30-50万', icon: '💶' },
            { label: '50万以上', value: '50万以上', icon: '💳' }
        ]
    },
    {
        id: 'type',
        text: '您倾向于哪种车型？',
        description: '决定了车身形态和空间布局',
        options: [
            { label: '轿车', value: '轿车', icon: '🚗' },
            { label: 'SUV', value: 'SUV', icon: '🚙' },
            { label: 'MPV', value: 'MPV', icon: '🚐' },
            { label: '跑车/个性', value: '跑车', icon: '🏎️' },
            { label: '越野', value: '越野车', icon: '⛰️' }
        ]
    },
    {
        id: 'power',
        text: '您对动力形式有要求吗？',
        description: '纯电成本低，混动无焦虑',
        options: [
            { label: '纯电 (BEV)', value: '纯电', icon: '⚡' },
            { label: '增程/插混 (可油可电)', value: '混动', icon: '⛽' },
            { label: '都可以', value: '不限', icon: '🤷' }
        ]
    },
    {
        id: 'charging',
        text: '您的充电便利性如何？',
        description: '这直接决定了纯电车型的用车体验',
        options: [
            { label: '有家用充电桩', value: '有家充', icon: '🏠' },
            { label: '周边公共充电方便', value: '公充方便', icon: '🔋' },
            { label: '充电不便/无固定车位', value: '充电困难', icon: '🚫' }
        ]
    },
    {
        id: 'seats',
        text: '您需要几个座位？',
        description: '家庭成员数量决定',
        options: [
            { label: '2-4座 (个人/情侣)', value: '常规', icon: '👫' },
            { label: '大5座 (三口之家)', value: '大5座', icon: '👪' },
            { label: '6/7座 (二胎/三代)', value: '6/7座', icon: '🚐' }
        ]
    },
    {
        id: 'usage',
        text: '这辆车主要怎么用？',
        options: [
            { label: '上下班代步', value: '代步', icon: '🏙️' },
            { label: '家庭主力 (带娃/露营)', value: '家用', icon: '⛺' },
            { label: '商务接待', value: '商务', icon: '💼' },
            { label: '追求驾驶乐趣', value: '操控', icon: '🏁' }
        ]
    },
    {
        id: 'smart',
        text: '对智能驾驶的依赖程度？',
        options: [
            { label: '极客 (必须有城市NOA)', value: '高阶智驾', icon: '🤖' },
            { label: '实用 (高速能自动巡航)', value: '高速智驾', icon: '🛣️' },
            { label: '保守 (不太需要)', value: '基础L2', icon: '🛡️' },
            { label: '无所谓', value: '不限', icon: '🤷' }
        ]
    },
    {
        id: 'cabin',
        text: '座舱风格偏好？',
        options: [
            { label: '大彩电+大沙发 (舒适)', value: '舒适', icon: '🛋️' },
            { label: '极简科技 (特斯拉风)', value: '极简', icon: '📱' },
            { label: '豪华质感 (传统豪华)', value: '豪华', icon: '🎩' }
        ]
    },
    {
        id: 'brand_pref',
        text: '品牌偏好？',
        options: [
            { label: '新势力 (蔚小理/小米等)', value: '新势力', icon: '🚀' },
            { label: '传统大厂 (比亚迪/吉利等)', value: '传统大厂', icon: '🏭' },
            { label: '无所谓', value: '不限', icon: '🤝' }
        ]
    }
];

interface Recommendation {
    id: string;
    reason: string;
}

const SmartSelector: React.FC = () => {
    const [mode, setMode] = useState<'intro' | 'quiz' | 'analyzing' | 'result'>('intro');
    const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [analysisText, setAnalysisText] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    
    // Track recommended car IDs to avoid duplicates when swapping
    const [historyIds, setHistoryIds] = useState<string[]>([]);
    const [isSwapping, setIsSwapping] = useState(false);

    const startQuiz = () => {
        setMode('quiz');
        setCurrentQuestionIdx(0);
        setAnswers({});
        setErrorMsg('');
        setRecommendations([]);
        setHistoryIds([]);
    };

    const handleAnswer = (option: string) => {
        const question = QUESTIONS[currentQuestionIdx];
        const newAnswers = { ...answers, [question.id]: option };
        setAnswers(newAnswers);

        // Small delay for animation feel
        setTimeout(() => {
            if (currentQuestionIdx < QUESTIONS.length - 1) {
                setCurrentQuestionIdx(prev => prev + 1);
            } else {
                submitQuiz(newAnswers);
            }
        }, 200);
    };

    const handlePrevious = () => {
        if (currentQuestionIdx > 0) {
            setCurrentQuestionIdx(prev => prev - 1);
        } else {
            setMode('intro');
        }
    };

    const constructPrompt = (finalAnswers: Record<string, string>, excludeIds: string[] = []) => {
        return `
            用户完成了深度选车问卷，请推荐3款最匹配的车型。
            
            用户画像:
            1. 预算: ${finalAnswers['budget']}
            2. 车型: ${finalAnswers['type']}
            3. 动力: ${finalAnswers['power']}
            4. 充电条件: ${finalAnswers['charging']}
            5. 座位: ${finalAnswers['seats']}
            6. 用途: ${finalAnswers['usage']}
            7. 智驾: ${finalAnswers['smart']}
            8. 座舱: ${finalAnswers['cabin']}
            9. 品牌: ${finalAnswers['brand_pref']}
            
            ${excludeIds.length > 0 ? `
            【重要指令】：用户选择了“换一批”。
            请绝对不要推荐以下车型ID：${excludeIds.join(', ')}。
            请寻找数据库中符合要求的其他备选车型。如果完美匹配的车型已用尽，请推荐稍冷门但符合核心需求（如预算、动力）的车型。
            ` : ''}

            请严格按照JSON格式返回，不要markdown标记。
            {
                "analysis": "50字以内的极简综合分析，只说重点。${excludeIds.length > 0 ? '说明为什么推荐这批备选车型。' : ''}",
                "recommendations": [
                    { "id": "车型ID", "reason": "推荐理由" }
                ]
            }
        `;
    };

    const processAIResponse = (jsonStr: string) => {
        const cleanStr = jsonStr.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanStr);
    };

    const submitQuiz = async (finalAnswers: Record<string, string>) => {
        setMode('analyzing');
        
        const prompt = constructPrompt(finalAnswers, []);

        try {
            const streamResult = await sendMessageToGemini(prompt);
            let fullText = '';
            for await (const chunk of streamResult) {
                if (chunk.text) fullText += chunk.text;
            }

            const result = processAIResponse(fullText);

            setAnalysisText(result.analysis);
            setRecommendations(result.recommendations || []);
            
            // Record history
            const newIds = (result.recommendations || []).map((r: any) => r.id);
            setHistoryIds(newIds);
            
            setMode('result');
        } catch (error) {
            console.error(error);
            setErrorMsg("AI 连接超时，请稍后重试。");
            setMode('intro'); 
        }
    };

    const handleSwapBatch = async () => {
        if (isSwapping) return;
        setIsSwapping(true);

        const prompt = constructPrompt(answers, historyIds);

        try {
            const streamResult = await sendMessageToGemini(prompt);
            let fullText = '';
            for await (const chunk of streamResult) {
                if (chunk.text) fullText += chunk.text;
            }

            const result = processAIResponse(fullText);

            setAnalysisText(result.analysis);
            setRecommendations(result.recommendations || []);

            // Update history with new batch
            const newIds = (result.recommendations || []).map((r: any) => r.id);
            setHistoryIds(prev => [...prev, ...newIds]);

        } catch (error) {
            console.error("Swap error:", error);
            // Optionally show a toast error here
        } finally {
            setIsSwapping(false);
        }
    };

    const getRecommendedCars = () => {
        return recommendations.map(rec => {
            // Fuzzy match logic improved
            const car = CAR_DATABASE.find(c => 
                c.id === rec.id || 
                c.name.toLowerCase().includes(rec.id.toLowerCase()) ||
                rec.id.toLowerCase().includes(c.name.toLowerCase())
            );
            return { car, reason: rec.reason };
        }).filter(item => item.car !== undefined);
    };

    const calculateLandingPrice = (priceWan: number) => {
        const price = priceWan * 10000;
        // Purchase Tax 2024-2025 rule
        const priceWithoutTax = price / 1.13;
        const potentialTax = priceWithoutTax * 0.1;
        const actualTax = potentialTax > 30000 ? potentialTax - 30000 : 0;
        const insurance = 4500 + (price * 0.012); 
        const registration = 500;
        const total = price + actualTax + insurance + registration;
        
        return {
            totalWan: (total / 10000).toFixed(2),
            tax: actualTax.toFixed(0),
            insurance: insurance.toFixed(0)
        };
    };

    return (
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden min-h-[650px] flex flex-col relative">
            
            {/* Background Decorations */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-50 rounded-full blur-3xl opacity-50 -mr-10 -mt-10 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-50 -ml-10 -mb-10 pointer-events-none"></div>

            {/* Header */}
            <div className="relative z-10 bg-white/80 backdrop-blur-sm border-b border-slate-100 p-6 flex justify-between items-center">
                <div className="flex items-center space-x-2 text-cyan-700">
                    <Sparkles size={24} />
                    <h2 className="font-bold text-xl tracking-tight">智能选车专家</h2>
                </div>
                {mode === 'quiz' && (
                    <div className="flex items-center space-x-4">
                         <div className="text-xs font-bold text-slate-400">
                             {currentQuestionIdx + 1}/{QUESTIONS.length}
                         </div>
                         <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                             <div 
                                className="h-full bg-cyan-500 transition-all duration-500 ease-out"
                                style={{ width: `${((currentQuestionIdx + 1) / QUESTIONS.length) * 100}%` }}
                             ></div>
                         </div>
                    </div>
                )}
            </div>

            <div className="flex-1 p-6 md:p-12 flex flex-col justify-center items-center relative z-10">
                
                {/* Intro */}
                {mode === 'intro' && (
                    <div className="text-center max-w-lg animate-fadeIn w-full">
                        
                        <h3 className="text-2xl font-bold text-slate-800 mb-4">找不到心仪的车？</h3>
                        <p className="text-slate-500 mb-8 leading-relaxed">
                            面对市场上数百款新能源车感到眼花缭乱？<br/>
                            花1分钟回答9个问题，AI将分析您的生活方式，<br/>为您推荐最完美的3个选择。
                        </p>
                        
                        <div className="grid grid-cols-2 gap-4 mb-8 text-left">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <Wallet className="text-cyan-600 mb-2" size={20}/>
                                <h4 className="font-bold text-sm">精准预算</h4>
                                <p className="text-xs text-slate-400">含税费保险估算</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <Users className="text-cyan-600 mb-2" size={20}/>
                                <h4 className="font-bold text-sm">场景匹配</h4>
                                <p className="text-xs text-slate-400">充电/二胎/商务</p>
                            </div>
                        </div>

                        {errorMsg && <p className="text-red-500 mb-4 bg-red-50 py-2 px-4 rounded-lg text-sm">{errorMsg}</p>}
                        
                        <button 
                            onClick={startQuiz}
                            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-cyan-500/30 transition-all transform hover:scale-[1.02]"
                        >
                            开始测评
                        </button>
                    </div>
                )}

                {/* Quiz */}
                {mode === 'quiz' && (
                    <div className="w-full max-w-2xl animate-slideUp">
                        <div className="mb-8">
                             <button 
                                onClick={handlePrevious}
                                className="inline-flex items-center text-slate-400 hover:text-cyan-600 transition-colors text-sm font-medium mb-4"
                             >
                                <ChevronLeft size={16} className="mr-1" />
                                {currentQuestionIdx === 0 ? '返回介绍' : '上一题'}
                             </button>
                             
                            <h3 className="text-3xl font-bold text-slate-800 mb-2 text-center">
                                {QUESTIONS[currentQuestionIdx].text}
                            </h3>
                            <p className="text-slate-400 text-center mb-6 text-sm">
                                {QUESTIONS[currentQuestionIdx].description}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {QUESTIONS[currentQuestionIdx].options.map((opt, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleAnswer(opt.value)}
                                    className="relative p-6 rounded-2xl border-2 border-slate-100 hover:border-cyan-500 hover:bg-cyan-50/50 transition-all text-left group flex items-center bg-white"
                                >
                                    <span className="text-3xl mr-4 filter grayscale group-hover:grayscale-0 transition-all">{opt.icon}</span>
                                    <div>
                                        <span className="font-bold text-slate-700 group-hover:text-cyan-900 block">{opt.label}</span>
                                    </div>
                                    <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity text-cyan-500">
                                        <Check size={20} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Analyzing */}
                {mode === 'analyzing' && (
                    <div className="text-center animate-fadeIn">
                        <div className="relative w-24 h-24 mx-auto mb-8">
                             <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                             <div className="absolute inset-0 border-4 border-cyan-500 rounded-full border-t-transparent animate-spin"></div>
                             <Sparkles className="absolute inset-0 m-auto text-cyan-500" size={32} />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 mb-2">AI 正在思考...</h3>
                        <p className="text-slate-500">正在对比上百种车型参数与您的需求</p>
                        <div className="mt-8 space-y-2 text-sm text-slate-400">
                            <p className="animate-pulse delay-75">正在计算落地预算...</p>
                            <p className="animate-pulse delay-150">正在匹配智驾能力...</p>
                            <p className="animate-pulse delay-300">正在筛选最优车源...</p>
                        </div>
                    </div>
                )}

                {/* Result */}
                {mode === 'result' && (
                    <div className="w-full animate-fadeIn max-w-5xl">
                         <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 rounded-2xl mb-10 text-white shadow-xl">
                            <div className="flex items-start">
                                <Sparkles className="text-yellow-400 mt-1 mr-3 flex-shrink-0" />
                                <div>
                                    <h4 className="font-bold text-lg mb-2">选车报告</h4>
                                    <p className="text-slate-300 text-sm leading-relaxed opacity-90">{analysisText}</p>
                                </div>
                            </div>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                             {/* Loading Overlay during Swap */}
                             {isSwapping ? (
                                <div className="col-span-1 md:col-span-3 h-96 flex flex-col items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-300">
                                    <Loader2 className="w-10 h-10 text-cyan-600 animate-spin mb-4" />
                                    <p className="text-slate-500 font-medium">正在寻找备选车型...</p>
                                </div>
                             ) : (
                                getRecommendedCars().map((item: any, idx) => {
                                    const lp = calculateLandingPrice(item.car.priceRange[0]);
                                    return (
                                        <div key={idx} className="relative flex flex-col h-full group animate-scaleIn" style={{animationDelay: `${idx * 100}ms`}}>
                                            {/* Rank Badge */}
                                            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold px-4 py-1 rounded-full shadow-lg text-sm border-2 border-white">
                                                No. {idx + 1} 推荐
                                            </div>
                                            
                                            <div className="transform group-hover:-translate-y-2 transition-transform duration-300 h-full">
                                                <CarCard car={item.car} />
                                            </div>
                                            
                                            <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                                <div className="mb-3">
                                                    <span className="bg-cyan-50 text-cyan-700 text-xs font-bold px-2 py-1 rounded border border-cyan-100">AI 推荐理由</span>
                                                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">{item.reason}</p>
                                                </div>

                                                <div className="border-t border-slate-100 pt-3">
                                                    <div className="flex items-center justify-between text-xs mb-2">
                                                        <span className="text-slate-400 flex items-center"><Calculator size={12} className="mr-1"/> 参考落地价</span>
                                                        <span className="font-bold text-slate-800">约 {lp.totalWan} 万</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2 overflow-hidden flex">
                                                        <div className="bg-slate-400 h-full w-[85%]"></div>
                                                        <div className="bg-orange-400 h-full w-[15%]"></div>
                                                    </div>
                                                    <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 bg-slate-50 p-1.5 rounded-lg">
                                                        <div className="flex flex-col items-center flex-1 border-r border-slate-200">
                                                            <span className="text-slate-400 scale-90">车价</span>
                                                            <span className="font-medium">{item.car.priceRange[0]}w</span>
                                                        </div>
                                                        <div className="flex flex-col items-center flex-1 border-r border-slate-200">
                                                            <span className="text-slate-400 scale-90">购置税</span>
                                                            <span className="font-medium">{(Number(lp.tax)/10000).toFixed(2)}w</span>
                                                        </div>
                                                        <div className="flex flex-col items-center flex-1">
                                                            <span className="text-slate-400 scale-90">保险</span>
                                                            <span className="font-medium">{(Number(lp.insurance)/10000).toFixed(2)}w</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                             )}
                         </div>

                         <div className="flex justify-center gap-4 pb-8">
                            <button 
                                onClick={handleSwapBatch}
                                disabled={isSwapping}
                                className="inline-flex items-center space-x-2 px-6 py-3 bg-cyan-50 border border-cyan-200 rounded-full text-cyan-700 hover:bg-cyan-100 hover:shadow-md transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <RefreshCw size={18} className={`${isSwapping ? 'animate-spin' : ''}`} />
                                <span>{isSwapping ? '生成中...' : '换一批'}</span>
                            </button>

                            <button 
                                onClick={startQuiz}
                                disabled={isSwapping}
                                className="inline-flex items-center space-x-2 px-6 py-3 bg-white border border-slate-200 rounded-full text-slate-600 hover:bg-slate-50 hover:text-cyan-600 transition-colors font-medium shadow-sm disabled:opacity-50"
                            >
                                <RotateCcw size={18} />
                                <span>重新测评</span>
                            </button>
                         </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SmartSelector;
