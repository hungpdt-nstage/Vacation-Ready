/**
 * ================= LOGIC GAME CHÍNH (GAME LOOP & CONTROLLER) =================
 * File này quản lý trạng thái trò chơi, luồng game, xử lý va chạm, particle system,
 * và tích hợp bảng xếp hạng Firebase (kèm LocalStorage fallback).
 * Cập nhật: Tích hợp hệ thống phân giải nhiều nguồn nhạc BGM (Multi-source BGM resolver).
 * Ưu tiên file mp3 local, tự động chuyển tiếp sang link nhạc CDN public chất lượng cao,
 * và cuối cùng mới fallback về nhạc Synth Web Audio API nếu mất mạng.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// ================= CẤU HÌNH HỆ THỐNG & FIREBASE =================
const firebaseConfig = {
    apiKey: "AIzaSyA1B2C3D4E5F6G7H8I9J0K-Placeholder",
    authDomain: "waifu-food-catch.firebaseapp.com",
    projectId: "waifu-food-catch",
    storageBucket: "waifu-food-catch.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};

let db = null;
let auth = null;
let isFirebaseActive = false;
const APP_ID = "waifu-food-catch-v1"; // Dùng định danh cho path Firestore

// Khởi tạo Firebase với cơ chế tự động phát hiện lỗi
try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    
    signInAnonymously(auth)
        .then(() => {
            isFirebaseActive = true;
            console.log("Đăng nhập ẩn danh Firebase thành công! Bảng xếp hạng online đã sẵn sàng.");
        })
        .catch(err => {
            console.warn("Không thể xác thực Firebase Auth. Chuyển sang chế độ LocalStorage.", err);
            isFirebaseActive = false;
        });
} catch (e) {
    console.warn("Khởi tạo Firebase thất bại. Game sẽ chạy ở chế độ Offline (LocalStorage).", e);
    isFirebaseActive = false;
}

// ================= HỆ THỐNG ÂM THANH (AUDIO MANAGER) =================
let isMuted = false;
let audioCtx = null;
let bgmGainNode = null;
let synthBgmIntervalId = null;
let currentBGMType = null; // 'menu' hoặc 'game'
let bgmAudio = null; // Đối tượng Audio đang phát BGM hiện tại

// Giai điệu Synth dự phòng
const menuMelody = [
    261.63, 329.63, 392.00, 329.63, 293.66, 349.23, 440.00, 349.23,
    329.63, 392.00, 523.25, 392.00, 293.66, 392.00, 493.88, 392.00
];
const gameMelody = [
    261.63, 329.63, 392.00, 523.25, 440.00, 349.23, 392.00, 293.66,
    329.63, 261.63, 349.23, 440.00, 392.00, 523.25, 493.88, 392.00
];

// Khai báo các liên kết nhiều nguồn BGM (Ưu tiên File Local -> CDN Public chất lượng cao)
const BGM_SOURCES = {
    menu: [
        'sounds/menu_bgm.mp3',
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' // Nhạc không lời dịu ngọt nhẹ nhàng làm menu
    ],
    game: [
        'sounds/game_bgm.mp3',
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' // Nhạc nhịp điệu nhanh, vui nhộn làm game
    ]
};

// Nạp các hiệu ứng âm thanh phụ
const audioAssets = {
    catch: new Audio('sounds/catch.mp3'),
    bomb: new Audio('sounds/bomb.mp3'),
    milestone: new Audio('sounds/milestone.mp3'),
    gameover: new Audio('sounds/gameover.mp3')
};

// Khởi tạo an toàn AudioContext
function initAudioContext() {
    if (!audioCtx) {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContextClass();
        } catch (e) {
            console.warn("Trình duyệt không hỗ trợ Web Audio API", e);
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Phát nhạc nền bằng cơ chế phân giải nhiều nguồn
function playBGMFromSources(type) {
    if (isMuted) return;
    initAudioContext();
    stopBGM(); // Tắt nhạc cũ trước

    currentBGMType = type;
    const sources = BGM_SOURCES[type];
    let sourceIndex = 0;

    function tryNextSource() {
        if (sourceIndex >= sources.length) {
            console.log(`Tất cả nguồn nhạc MP3 cho ${type} đều lỗi. Khởi chạy Synth Fallback...`);
            if (type === 'menu') playSynthMenuBGM();
            else playSynthGameBGM();
            return;
        }

        const src = sources[sourceIndex];
        console.log(`Đang thử phát nhạc ${type} từ nguồn: ${src}`);
        
        try {
            bgmAudio = new Audio(src);
            bgmAudio.loop = true;
            
            // Thiết lập âm lượng nhỏ hơn một chút cho nhạc nền
            bgmAudio.volume = type === 'menu' ? 0.35 : 0.45;
            
            bgmAudio.play()
                .then(() => {
                    console.log(`Phát nhạc nền ${type} thành công từ nguồn: ${src}`);
                })
                .catch((err) => {
                    console.warn(`Lỗi phát nguồn: ${src}. Thử nguồn tiếp theo...`, err);
                    sourceIndex++;
                    tryNextSource();
                });
        } catch (e) {
            sourceIndex++;
            tryNextSource();
        }
    }

    tryNextSource();
}

function playMenuBGM() {
    playBGMFromSources('menu');
}

function playGameBGM() {
    playBGMFromSources('game');
}

// Dừng nhạc nền BGM
function stopBGM() {
    if (bgmAudio) {
        try {
            bgmAudio.pause();
            bgmAudio.currentTime = 0;
        } catch (e) {}
        bgmAudio = null;
    }
    stopSynthBGM();
    currentBGMType = null;
}

// Tổng hợp Synth Menu BGM (Nhịp chậm)
function playSynthMenuBGM() {
    if (!audioCtx) return;
    if (synthBgmIntervalId) return;

    let index = 0;
    bgmGainNode = audioCtx.createGain();
    bgmGainNode.gain.setValueAtTime(0.03, audioCtx.currentTime);
    bgmGainNode.connect(audioCtx.destination);

    synthBgmIntervalId = setInterval(() => {
        if (isMuted || gameActive) return;

        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            const freq = menuMelody[index % menuMelody.length];
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

            gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.6);

            osc.connect(gain);
            gain.connect(bgmGainNode);

            osc.start();
            osc.stop(audioCtx.currentTime + 0.6);
            index++;
        } catch (err) {}
    }, 600);
}

// Tổng hợp Synth Game BGM (Nhịp nhanh)
function playSynthGameBGM() {
    if (!audioCtx) return;
    if (synthBgmIntervalId) return;

    let index = 0;
    bgmGainNode = audioCtx.createGain();
    bgmGainNode.gain.setValueAtTime(0.04, audioCtx.currentTime);
    bgmGainNode.connect(audioCtx.destination);

    synthBgmIntervalId = setInterval(() => {
        if (isMuted || !gameActive || isMilestonePaused) return;

        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            const freq = gameMelody[index % gameMelody.length];
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

            gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);

            osc.connect(gain);
            gain.connect(bgmGainNode);

            osc.start();
            osc.stop(audioCtx.currentTime + 0.25);
            index++;
        } catch (err) {}
    }, 320);
}

function stopSynthBGM() {
    if (synthBgmIntervalId) {
        clearInterval(synthBgmIntervalId);
        synthBgmIntervalId = null;
    }
    if (bgmGainNode) {
        try {
            bgmGainNode.disconnect();
        } catch (e) {}
        bgmGainNode = null;
    }
}

// Phát âm thanh khi hứng trúng đồ ăn
function playCatchSound() {
    if (isMuted) return;
    initAudioContext();

    audioAssets.catch.currentTime = 0;
    audioAssets.catch.play()
        .catch(() => {
            try {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(520, audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(1040, audioCtx.currentTime + 0.12);
                gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.12);
            } catch (e) {}
        });
}

// Phát âm thanh khi dính bom/ớt
function playBombSound() {
    if (isMuted) return;
    initAudioContext();

    audioAssets.bomb.currentTime = 0;
    audioAssets.bomb.play()
        .catch(() => {
            try {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(160, audioCtx.currentTime);
                osc.frequency.linearRampToValueAtTime(10, audioCtx.currentTime + 0.45);
                gain.gain.setValueAtTime(0.28, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.45);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.45);
            } catch (e) {}
        });
}

// Phát âm thanh thăng Milestone
function playMilestoneSound() {
    if (isMuted) return;
    initAudioContext();

    audioAssets.milestone.currentTime = 0;
    audioAssets.milestone.play()
        .catch(() => {
            try {
                const freqs = [523.25, 659.25, 783.99, 1046.50];
                freqs.forEach((freq, i) => {
                    const offset = i * 0.10;
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, audioCtx.currentTime + offset);
                    gain.gain.setValueAtTime(0.18, audioCtx.currentTime + offset);
                    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + offset + 0.25);
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    osc.start(audioCtx.currentTime + offset);
                    osc.stop(audioCtx.currentTime + offset + 0.25);
                });
            } catch (e) {}
        });
}

// Phát âm thanh khi kết thúc trò chơi (Game Over)
function playGameOverSound() {
    if (isMuted) return;
    initAudioContext();

    audioAssets.gameover.currentTime = 0;
    audioAssets.gameover.play()
        .catch(() => {
            try {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(330, audioCtx.currentTime);
                osc.frequency.linearRampToValueAtTime(80, audioCtx.currentTime + 0.9);
                gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.9);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.9);
            } catch (e) {}
        });
}

// PHÁT GIỌNG NÓI NHÂN VẬT ANIME
function playCharVoice(charId, type = "normal") {
    if (isMuted) return;
    initAudioContext();

    const voiceFile = new Audio(`sounds/${charId}_voice.mp3`);
    voiceFile.play()
        .then(() => {
            console.log(`Đang phát giọng nói Waifu từ file: sounds/${charId}_voice.mp3`);
        })
        .catch(() => {
            playSynthVoice(charId, type);
        });
}

function playSynthVoice(charId, type) {
    if (!audioCtx) return;
    try {
        const now = audioCtx.currentTime;
        if (charId === "hana") {
            const osc1 = audioCtx.createOscillator();
            const gain1 = audioCtx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(850, now);
            osc1.frequency.exponentialRampToValueAtTime(1300, now + 0.08);
            gain1.gain.setValueAtTime(0.08, now);
            gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
            osc1.connect(gain1);
            gain1.connect(audioCtx.destination);
            osc1.start(now);
            osc1.stop(now + 0.08);

            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(950, now + 0.05);
            osc2.frequency.exponentialRampToValueAtTime(1500, now + 0.15);
            gain2.gain.setValueAtTime(0.08, now + 0.05);
            gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.start(now + 0.05);
            osc2.stop(now + 0.15);

        } else if (charId === "yuki") {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();
            
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.linearRampToValueAtTime(450, now + 0.20);
            
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1000, now);
            
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.20);
            
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.start(now);
            osc.stop(now + 0.20);

        } else if (charId === "akane") {
            const freqs = [480, 680, 950];
            freqs.forEach((freq, idx) => {
                const time = now + idx * 0.05;
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, time);
                
                gain.gain.setValueAtTime(0.08, time);
                gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
                
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                
                osc.start(time);
                osc.stop(time + 0.12);
            });
        }
    } catch (e) {}
}

// ================= THIẾT LẬP GAME ENGINE =================
const gameCanvas = document.getElementById("gameCanvas");
const waifuCanvas = document.getElementById("waifuCanvas");
const ctxGame = gameCanvas.getContext("2d");
const ctxWaifu = waifuCanvas.getContext("2d");

// Trạng thái màn hình
let currentScreen = "start-screen";

// Biến trạng thái trò chơi
let selectedCharacterId = "hana";
let score = 0;
let combo = 0;
let lives = 5;
let gameActive = false;
let isGameOver = false;

// Trạng thái Tạm dừng Milestone (2 giây)
let isMilestonePaused = false;
let milestonePauseEndTime = 0;

// Các biến vẽ Waifu Canvas Real-time
let currentCustomMessage = null;
let waifuZoomScale = 1.0;
let waifuFlashAlpha = 0.0;
let waifuParticles = [];

// Tải ảnh rổ hứng (basket) tùy chọn
const basketImg = new Image();
basketImg.src = 'assets/basket.png';
let isBasketImgLoaded = false;
basketImg.onload = () => {
    isBasketImgLoaded = true;
    console.log("Basket image loaded successfully!");
};
basketImg.onerror = () => {
    isBasketImgLoaded = false;
    console.log("Using default vector graphics for basket.");
};

// Đối tượng rổ hứng đồ ăn (Basket)
const basket = {
    x: gameCanvas.width / 2 - 50,
    y: 475,
    width: 100,
    height: 80,
    speed: 15,
    color: '#ff8da1'
};

// Mảng chứa các đối tượng đang rơi
let fallingItems = [];
let particles = [];
let floatingTexts = [];

// Cấu hình nhịp sinh vật phẩm rơi ban đầu
let lastItemSpawnTime = 0;
const spawnInterval = 1000; 

// Dữ liệu các loại vật phẩm
const ITEM_TYPES = {
    STRAWBERRY: { type: 'strawberry', label: '🍓', score: 1, speed: 2.2, color: '#ff4d6d' },
    ONIGIRI: { type: 'onigiri', label: '🍙', score: 2, speed: 4.0, color: '#4a4a4a' },
    CAKE: { type: 'cake', label: '🍰', score: 5, speed: 2.8, color: '#ffb7c5', isSine: true },
    BOMB: { type: 'bomb', label: '💣', score: 0, speed: 3.5, color: '#2b2b2b', isHazard: true },
    PEPPER: { type: 'pepper', label: '🌶️', score: 0, speed: 3.8, color: '#e63946', isHazard: true }
};

// ================= QUẢN LÝ MÀN HÌNH (SCREEN NAVIGATION) =================
function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach(screen => {
        screen.classList.remove("active");
    });
    
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add("active");
        currentScreen = screenId;
    }
}

// ================= PARTICLE & VISUAL EFFECTS SYSTEM =================
function createParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 4;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1.5,
            color: color,
            alpha: 1,
            size: 3 + Math.random() * 4,
            life: 30 + Math.random() * 20
        });
    }
}

function createFloatingText(x, y, text, color) {
    floatingTexts.push({
        x: x,
        y: y,
        text: text,
        color: color,
        alpha: 1,
        life: 45
    });
}

function updateAndDrawParticles(ctx) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.alpha -= 1 / p.life;
        
        if (p.alpha <= 0) {
            particles.splice(i, 1);
            continue;
        }
        
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function updateAndDrawFloatingTexts(ctx) {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y -= 0.8;
        ft.alpha -= 1 / ft.life;
        
        if (ft.alpha <= 0) {
            floatingTexts.splice(i, 1);
            continue;
        }
        
        ctx.save();
        ctx.globalAlpha = ft.alpha;
        ctx.fillStyle = ft.color;
        ctx.font = "bold 18px 'Outfit', sans-serif";
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.15)";
        ctx.shadowBlur = 4;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
    }
}

// ================= HỆ THỐNG VẼ WAIFU REAL-TIME HOẠT ẢNH =================

// Hàm sinh các hạt lấp lánh (sparkles) xoay quanh Waifu
function spawnWaifuParticle() {
    const character = WAIFU_DATABASE[selectedCharacterId];
    if (!character) return;

    const shapes = ['circle', 'star', 'heart'];
    const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
    
    const px = isMilestonePaused 
        ? waifuCanvas.width * 0.15 + Math.random() * waifuCanvas.width * 0.7 
        : Math.random() * waifuCanvas.width;
        
    const py = isMilestonePaused 
        ? waifuCanvas.height - 20 - Math.random() * 80 
        : waifuCanvas.height - 10;

    waifuParticles.push({
        x: px,
        y: py,
        vy: -1.0 - Math.random() * 2.0, // bay lên
        vx: (Math.random() - 0.5) * 0.8,
        size: 5 + Math.random() * 8,
        color: character.themeColor,
        alpha: 1.0,
        shape: randomShape,
        frequency: 30 + Math.random() * 30,
        startY: py
    });
}

// Cập nhật và Vẽ Waifu Canvas liên tục mỗi frame
function updateAndDrawWaifuFrame() {
    const spawnChance = isMilestonePaused ? 0.35 : 0.05;
    if (Math.random() < spawnChance) {
        spawnWaifuParticle();
    }

    for (let i = waifuParticles.length - 1; i >= 0; i--) {
        const p = waifuParticles[i];
        p.y += p.vy;
        p.x += p.vx + Math.sin((p.startY - p.y) / p.frequency) * 0.4;
        p.alpha -= isMilestonePaused ? 0.010 : 0.015;
        
        if (p.alpha <= 0 || p.y < 0) {
            waifuParticles.splice(i, 1);
        }
    }

    if (waifuFlashAlpha > 0) {
        waifuFlashAlpha = Math.max(0, waifuFlashAlpha - 0.025);
    }

    if (isMilestonePaused) {
        if (waifuZoomScale < 1.12) {
            waifuZoomScale = Math.min(1.12, waifuZoomScale + 0.008);
        }
    } else {
        if (waifuZoomScale > 1.0) {
            waifuZoomScale = Math.max(1.0, waifuZoomScale - 0.008);
        }
    }

    drawWaifu(
        ctxWaifu, 
        waifuCanvas, 
        selectedCharacterId, 
        score, 
        combo, 
        isGameOver, 
        currentCustomMessage, 
        waifuZoomScale, 
        waifuFlashAlpha, 
        waifuParticles
    );
}

// ================= CORE GAME LOOP MECHANICS =================

// Hàm spawn vật phẩm rơi mới
function spawnItem() {
    const rand = Math.random();
    let itemTemplate;
    
    let hazardChance = 0.20;
    if (score >= 80) hazardChance = 0.45;
    else if (score >= 60) hazardChance = 0.35;
    else if (score >= 40) hazardChance = 0.30;
    else if (score >= 20) hazardChance = 0.25;

    if (rand < hazardChance) {
        itemTemplate = Math.random() < 0.60 ? ITEM_TYPES.BOMB : ITEM_TYPES.PEPPER;
    } else {
        const foodRand = Math.random();
        if (foodRand < 0.60) {
            itemTemplate = ITEM_TYPES.STRAWBERRY;
        } else if (foodRand < 0.85) {
            itemTemplate = ITEM_TYPES.ONIGIRI;
        } else {
            itemTemplate = ITEM_TYPES.CAKE;
        }
    }

    const itemWidth = 48;
    const randomX = itemWidth + Math.random() * (gameCanvas.width - itemWidth * 2);
    
    fallingItems.push({
        x: randomX,
        startX: randomX,
        y: -30,
        width: itemWidth,
        height: itemWidth,
        template: itemTemplate,
        angle: 0,
        sinePhase: Math.random() * Math.PI * 2
    });
}

// Hàm khởi tạo và bắt đầu chơi game
function startGame(charId) {
    initAudioContext();

    selectedCharacterId = charId;
    score = 0;
    combo = 0;
    lives = 5;
    isGameOver = false;
    isMilestonePaused = false;
    gameActive = true;
    fallingItems = [];
    particles = [];
    floatingTexts = [];
    lastItemSpawnTime = performance.now();

    currentCustomMessage = null;
    waifuZoomScale = 1.0;
    waifuFlashAlpha = 0.0;
    waifuParticles = [];

    const character = WAIFU_DATABASE[charId];
    basket.color = character.themeColor;
    basket.x = gameCanvas.width / 2 - basket.width / 2;

    updateHUD();
    showScreen("game-screen");

    // Phát BGM game dồn dập
    playGameBGM();
    
    requestAnimationFrame(gameLoop);
}

// Cập nhật HUD hiển thị trên HTML
function updateHUD() {
    document.getElementById("hud-score").textContent = score;
    document.getElementById("hud-combo").textContent = combo;
    
    const milestone = getMilestoneFromScore(score);
    document.getElementById("hud-milestone").textContent = `${milestone}/5`;

    let hearts = "";
    for (let i = 0; i < 5; i++) {
        hearts += i < lives ? "❤️" : "🖤";
    }
    document.getElementById("hud-lives-hearts").textContent = hearts;
}

// Vòng lặp vẽ và cập nhật game chính
function gameLoop(timestamp) {
    if (!gameActive) return;

    if (isMilestonePaused) {
        if (timestamp >= milestonePauseEndTime) {
            isMilestonePaused = false;
            currentCustomMessage = null;
            lastItemSpawnTime = timestamp;
        }
    }

    ctxGame.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
    drawGameBackground(ctxGame);

    const currentSpawnInterval = Math.max(350, 1000 - score * 12);

    if (!isMilestonePaused && timestamp - lastItemSpawnTime > currentSpawnInterval) {
        spawnItem();
        
        if (score >= 40 && Math.random() < 0.15) {
            spawnItem();
        }
        
        lastItemSpawnTime = timestamp;
    }

    for (let i = fallingItems.length - 1; i >= 0; i--) {
        const item = fallingItems[i];
        
        if (!isMilestonePaused) {
            const difficultyMultiplier = 1 + (score * 0.015);
            item.y += item.template.speed * difficultyMultiplier;
            
            if (item.template.isSine) {
                item.angle += 0.05;
                item.x = item.startX + Math.sin(item.angle + item.sinePhase) * 60;
            }
        }

        ctxGame.save();
        ctxGame.font = "38px 'Outfit', sans-serif";
        ctxGame.textAlign = "center";
        ctxGame.textBaseline = "middle";
        ctxGame.fillText(item.template.label, item.x, item.y);
        ctxGame.restore();

        if (!isMilestonePaused) {
            const collided = checkCollision(item, basket);
            if (collided) {
                handleCatch(item);
                fallingItems.splice(i, 1);
                continue;
            }
        }

        if (!isMilestonePaused && item.y > gameCanvas.height) {
            if (!item.template.isHazard) {
                if (combo > 0) {
                    combo = 0;
                    updateHUD();
                    playCharVoice(selectedCharacterId, "miss");
                    currentCustomMessage = "Oh no... the food dropped! 🍙";
                }
            }
            fallingItems.splice(i, 1);
        }
    }

    drawBasket(ctxGame);
    updateAndDrawParticles(ctxGame);
    updateAndDrawFloatingTexts(ctxGame);

    // Cập nhật và Vẽ Waifu Canvas Real-time
    updateAndDrawWaifuFrame();

    if (isMilestonePaused) {
        drawMilestoneGlow(ctxGame);
    }

    requestAnimationFrame(gameLoop);
}

// Vẽ nền nhẹ cho khu vực chơi game
function drawGameBackground(ctx) {
    ctx.save();
    ctx.fillStyle = '#fafbfc';
    ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    
    ctx.strokeStyle = 'rgba(238, 238, 238, 0.4)';
    ctx.lineWidth = 1;
    const grid = 30;
    
    for (let x = 0; x < gameCanvas.width; x += grid) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, gameCanvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < gameCanvas.height; y += grid) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(gameCanvas.width, y);
        ctx.stroke();
    }
    
    ctx.strokeStyle = 'rgba(240, 138, 156, 0.2)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, 520);
    ctx.lineTo(gameCanvas.width, 520);
    ctx.stroke();
    ctx.restore();
}

function drawBasket(ctx) {
    ctx.save();
    if (isBasketImgLoaded) {
        ctx.drawImage(basketImg, basket.x, basket.y, basket.width, basket.height);
    } else {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 4;

        ctx.fillStyle = basket.color;
        ctx.beginPath();
        ctx.roundRect(basket.x, basket.y, basket.width, basket.height, 10);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(basket.x + 5, basket.y + 3, basket.width - 10, 5, 2);
        ctx.fill();
    }
    ctx.restore();
}

function drawMilestoneGlow(ctx) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 240, 242, 0.45)";
    ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

    const pulse = Math.sin(performance.now() / 120) * 0.35 + 0.65;
    ctx.strokeStyle = `rgba(240, 138, 156, ${pulse})`;
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, gameCanvas.width - 8, gameCanvas.height - 8);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    ctx.shadowColor = "rgba(240, 138, 156, 0.6)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px 'Outfit', sans-serif";
    ctx.fillText("MILESTONE UNLOCKED!", gameCanvas.width / 2, gameCanvas.height / 2 - 20);

    ctx.fillStyle = "#f08a9c";
    ctx.font = "bold 32px 'Outfit', sans-serif";
    ctx.fillText("MILESTONE UNLOCKED!", gameCanvas.width / 2 - 2, gameCanvas.height / 2 - 22);

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#5a5a5a";
    ctx.font = "bold 14px 'Quicksand', sans-serif";
    ctx.fillText("Revealing Waifu's new outfit... ✨", gameCanvas.width / 2, gameCanvas.height / 2 + 25);
    
    ctx.restore();
}

function checkCollision(rect1, rect2) {
    const r1X = rect1.x - 20;
    const r1Y = rect1.y - 20;
    const r1W = 40;
    const r1H = 40;

    return r1X < rect2.x + rect2.width &&
           r1X + r1W > rect2.x &&
           r1Y < rect2.y + rect2.height &&
           r1Y + r1H > rect2.y;
}

// Xử lý khi bắt trúng một vật phẩm
function handleCatch(item) {
    const temp = item.template;
    
    if (temp.isHazard) {
        lives--;
        combo = 0;
        updateHUD();
        
        playBombSound();
        playCharVoice(selectedCharacterId, "hazard");

        const wrapper = document.querySelector(".game-wrapper");
        if (wrapper) {
            wrapper.classList.remove("screen-shake");
            wrapper.classList.remove("flash-red-active");
            void wrapper.offsetWidth;
            wrapper.classList.add("screen-shake");
            wrapper.classList.add("flash-red-active");
        }

        createParticles(item.x, item.y, '#e63946', 22);
        createParticles(item.x, item.y, '#555555', 12);
        createFloatingText(item.x, item.y - 20, "Ouch! 🌶️", '#d32f2f');

        let reaction = "Be careful! Avoid the bombs and peppers! 😰";
        if (lives === 1) reaction = "Oh no! Only 1 life left! You can do it... 🥺";
        currentCustomMessage = reaction;

        if (lives <= 0) {
            triggerGameOver();
        }
    } else {
        const prevMilestone = getMilestoneFromScore(score);
        
        score += temp.score;
        combo++;
        updateHUD();

        playCatchSound();

        const curMilestone = getMilestoneFromScore(score);

        createParticles(item.x, item.y, temp.color, 12);
        createFloatingText(item.x, item.y - 20, `+${temp.score}`, temp.color);

        // Nâng Milestone
        if (curMilestone > prevMilestone) {
            isMilestonePaused = true;
            milestonePauseEndTime = performance.now() + 2000;
            
            waifuFlashAlpha = 1.0; // chớp sáng trắng
            playMilestoneSound();
            playCharVoice(selectedCharacterId, "milestoneUp");

            const characterDb = WAIFU_DATABASE[selectedCharacterId];
            const mKey = `m${curMilestone}`;
            currentCustomMessage = characterDb.dialogues.milestoneUp[mKey] || "Wow! You are amazing!";
            
            // Bắn hạt lấp lánh dồn dập
            for (let k = 0; k < 18; k++) {
                spawnWaifuParticle();
            }
            createParticles(basket.x + basket.width / 2, basket.y, '#fbc02d', 20);
            createParticles(basket.x + basket.width / 2, basket.y, '#e040fb', 20);
        } else {
            if (combo % 5 === 0) {
                playCharVoice(selectedCharacterId, "combo");
                currentCustomMessage = null;
            }
        }
    }
}

function getMilestoneFromScore(s) {
    if (s >= 80) return 5;
    if (s >= 60) return 4;
    if (s >= 40) return 3;
    if (s >= 20) return 2;
    return 1;
}

function triggerGameOver() {
    gameActive = false;
    isGameOver = true;
    isMilestonePaused = false;
    
    stopBGM();
    playGameOverSound();
    playCharVoice(selectedCharacterId, "gameover");

    const characterDb = WAIFU_DATABASE[selectedCharacterId];
    currentCustomMessage = characterDb.dialogues.gameOver;

    document.getElementById("game-over-verdict").innerHTML = `You and <strong>${characterDb.name}</strong> scored <span style="color:#f08a9c; font-size: 1.5rem;">${score}</span> points!`;
    
    document.getElementById("player-name-input").value = "";
    document.getElementById("submission-status").textContent = "";
    
    showScreen("game-over-screen");
    loadLeaderboard();
}

// ================= XỬ LÝ ĐIỀU KHIỂN RỔ HỨNG =================

function moveBasket(clientX) {
    if (isMilestonePaused) return;
    
    const rect = gameCanvas.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    
    let targetX = relativeX - basket.width / 2;
    
    if (targetX < 0) targetX = 0;
    if (targetX > gameCanvas.width - basket.width) targetX = gameCanvas.width - basket.width;
    
    basket.x = targetX;
}

gameCanvas.addEventListener("mousemove", (e) => {
    if (!gameActive) return;
    moveBasket(e.clientX);
});

gameCanvas.addEventListener("touchmove", (e) => {
    if (!gameActive) return;
    
    if (e.touches.length > 0) {
        e.preventDefault();
        moveBasket(e.touches[0].clientX);
    }
}, { passive: false });

gameCanvas.addEventListener("touchstart", (e) => {
    if (gameActive) {
        e.preventDefault();
    }
}, { passive: false });

// ================= LEADERBOARD SERVICE (FIREBASE & LOCALSTORAGE) =================

async function loadLeaderboard() {
    const listElement = document.getElementById("leaderboard-list");
    const globalListElement = document.getElementById("global-leaderboard-list");
    const loader = document.getElementById("leaderboard-loader");
    const modeTag = document.getElementById("leaderboard-mode-tag");

    listElement.innerHTML = "";
    if (globalListElement) globalListElement.innerHTML = "";
    if (loader) loader.style.display = "block";

    if (isFirebaseActive) {
        try {
            const colRef = collection(db, "artifacts", APP_ID, "public", "data", "leaderboard");
            const querySnapshot = await getDocs(colRef);
            
            let scores = [];
            querySnapshot.forEach((doc) => {
                scores.push(doc.data());
            });

            scores.sort((a, b) => b.score - a.score);
            const top5 = scores.slice(0, 5);
            
            if (loader) loader.style.display = "none";
            modeTag.textContent = "Mode: Online Leaderboard 🌐";

            renderLeaderboardItems(listElement, top5);
            if (globalListElement) renderLeaderboardItems(globalListElement, top5);

        } catch (err) {
            console.error("Lỗi lấy dữ liệu từ Firebase, chuyển sang offline:", err);
            loadLocalLeaderboardFallback(listElement, globalListElement, loader, modeTag);
        }
    } else {
        loadLocalLeaderboardFallback(listElement, globalListElement, loader, modeTag);
    }
}

function loadLocalLeaderboardFallback(listElement, globalListElement, loader, modeTag) {
    if (loader) loader.style.display = "none";
    modeTag.textContent = "Mode: Offline (Local Save) 💾";

    let localScores = JSON.parse(localStorage.getItem("waifu_highscores") || "[]");
    localScores.sort((a, b) => b.score - a.score);
    const top3 = localScores.slice(0, 3);

    renderLeaderboardItems(listElement, top3);
    if (globalListElement) renderLeaderboardItems(globalListElement, top3);
}

function renderLeaderboardItems(ulElement, dataList) {
    ulElement.innerHTML = "";
    if (dataList.length === 0) {
        ulElement.innerHTML = `<li class="loader-text">No records set yet. Be the first one!</li>`;
        return;
    }

    dataList.forEach((item, index) => {
        const rank = index + 1;
        const li = document.createElement("li");
        li.className = `leaderboard-item rank-${rank}`;
        
        li.innerHTML = `
            <span class="leaderboard-rank">#${rank}</span>
            <span class="leaderboard-name">${escapeHTML(item.name)} (${item.waifu})</span>
            <span class="leaderboard-score">${item.score} pts</span>
        `;
        ulElement.appendChild(li);
    });
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

async function submitScore() {
    const inputField = document.getElementById("player-name-input");
    const statusText = document.getElementById("submission-status");
    const name = inputField.value.trim();

    if (!name) {
        statusText.textContent = "Please enter a valid name!";
        statusText.style.color = "#d32f2f";
        return;
    }

    statusText.textContent = "Submitting...";
    statusText.style.color = "#ff8da1";

    const scoreData = {
        name: name,
        score: score,
        waifu: WAIFU_DATABASE[selectedCharacterId].name,
        timestamp: Date.now()
    };

    if (isFirebaseActive) {
        try {
            const colRef = collection(db, "artifacts", APP_ID, "public", "data", "leaderboard");
            await addDoc(colRef, scoreData);
            
            statusText.textContent = "Score submitted successfully! 🎉";
            statusText.style.color = "#4db6ac";
            inputField.disabled = true;
            document.getElementById("btn-submit-score").disabled = true;
            
            loadLeaderboard();
        } catch (err) {
            console.error("Lỗi gửi điểm trực tuyến, chuyển sang lưu thiết bị:", err);
            saveLocalScore(scoreData, statusText, inputField);
        }
    } else {
        saveLocalScore(scoreData, statusText, inputField);
    }
}

function saveLocalScore(scoreData, statusText, inputField) {
    try {
        let localScores = JSON.parse(localStorage.getItem("waifu_highscores") || "[]");
        localScores.push(scoreData);
        localStorage.setItem("waifu_highscores", JSON.stringify(localScores));
        
        statusText.textContent = "Score saved locally! 💾";
        statusText.style.color = "#4db6ac";
        inputField.disabled = true;
        document.getElementById("btn-submit-score").disabled = true;
        
        loadLeaderboard();
    } catch (e) {
        statusText.textContent = "Could not save score!";
        statusText.style.color = "#d32f2f";
    }
}

// ================= KẾT NỐI EVENT LISTENERS GIAO DIỆN (UI BINDING) =================

document.addEventListener("DOMContentLoaded", () => {
    // Phát nhạc nền Menu BGM khi người dùng tương tác lần đầu tiên
    const triggerFirstAudio = () => {
        initAudioContext();
        if (currentScreen === "start-screen" || currentScreen === "char-select-screen") {
            playMenuBGM();
        }
        document.removeEventListener("click", triggerFirstAudio);
        document.removeEventListener("touchstart", triggerFirstAudio);
    };

    document.addEventListener("click", triggerFirstAudio);
    document.addEventListener("touchstart", triggerFirstAudio);

    // Nút điều hướng màn hình bắt đầu -> Chọn waifu
    document.getElementById("btn-goto-select").addEventListener("click", () => {
        initAudioContext();
        showScreen("char-select-screen");
        playMenuBGM();
    });

    // Nút xem bảng xếp hạng từ màn hình chính
    document.getElementById("btn-show-leaderboard").addEventListener("click", () => {
        showScreen("leaderboard-overlay-screen");
        loadLeaderboard();
    });

    // Quay lại màn hình bắt đầu từ màn hình xem bảng xếp hạng
    document.getElementById("btn-close-leaderboard").addEventListener("click", () => {
        showScreen("start-screen");
    });

    // Quay lại màn hình bắt đầu từ màn hình chọn nhân vật
    document.getElementById("btn-back-to-start").addEventListener("click", () => {
        showScreen("start-screen");
    });

    // Sự kiện chọn Waifu từ các thẻ Grid
    document.querySelectorAll(".char-card").forEach(card => {
        card.addEventListener("click", () => {
            // Mở khóa âm thanh trực tiếp trong click event của người dùng
            initAudioContext();
            
            const charId = card.getAttribute("data-char");
            
            document.querySelectorAll(".char-card").forEach(c => c.classList.remove("selected"));
            card.classList.add("selected");
            
            // Phát giọng nói anime của Waifu đó trước khi bắt đầu chơi game
            playCharVoice(charId, "welcome");
            
            // Bắt đầu game với nhân vật đã chọn
            setTimeout(() => {
                startGame(charId);
            }, 300); // trễ nhẹ 300ms để nghe rõ giọng nói
        });
    });

    // Nút Đổi Waifu (Quay lại màn chọn nhân vật) khi đang chơi gameplay
    document.getElementById("btn-game-back-select").addEventListener("click", () => {
        initAudioContext();
        if (confirm("Do you want to stop this game and change your Waifu? Your current score will not be saved.")) {
            gameActive = false;
            isMilestonePaused = false;
            stopBGM();
            showScreen("char-select-screen");
            playMenuBGM();
        }
    });

    // Thoát game ngang xương
    document.getElementById("btn-game-quit").addEventListener("click", () => {
        initAudioContext();
        if (confirm("Are you sure you want to quit the current game?")) {
            gameActive = false;
            isMilestonePaused = false;
            stopBGM();
            showScreen("start-screen");
            playMenuBGM();
        }
    });

    // Bật / Tắt âm thanh
    document.getElementById("btn-toggle-audio").addEventListener("click", () => {
        isMuted = !isMuted;
        document.getElementById("btn-toggle-audio").textContent = isMuted ? "🔇" : "🔊";
        
        initAudioContext();
        if (isMuted) {
            stopBGM();
        } else {
            if (gameActive && !isGameOver) {
                playGameBGM();
            } else {
                playMenuBGM();
            }
        }
    });

    // Gửi điểm kỷ lục
    document.getElementById("btn-submit-score").addEventListener("click", () => {
        submitScore();
    });

    document.getElementById("player-name-input").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            submitScore();
        }
    });

    // Chơi lại game
    document.getElementById("btn-restart-game").addEventListener("click", () => {
        document.getElementById("player-name-input").disabled = false;
        document.getElementById("btn-submit-score").disabled = false;
        startGame(selectedCharacterId);
    });

    // Trở về trang chủ từ màn hình Game Over
    document.getElementById("btn-home-from-over").addEventListener("click", () => {
        initAudioContext();
        document.getElementById("player-name-input").disabled = false;
        document.getElementById("btn-submit-score").disabled = false;
        showScreen("start-screen");
        playMenuBGM();
    });
});
