/**
 * ================= DATABASE NHÂN VẬT & ENGINE VẼ WAIFU =================
 * File này quản lý thông tin các nhân vật Waifu, xử lý tải ảnh (preloading)
 * và engine vẽ vector chibi nghệ thuật khi không có ảnh (fallback system).
 * Cập nhật Phase 3: Hỗ trợ hiệu ứng biến hình lấp lánh (sparkles), zoom scale,
 * và camera flash phép thuật trên Waifu Canvas.
 */

// Định nghĩa cơ sở dữ liệu các nhân vật Waifu
const WAIFU_DATABASE = {
    hana: {
        id: 'hana',
        name: 'Hana',
        personality: 'Sweet & Cute',
        hairColor: '#ffb7c5',       // Hồng đào pastel
        eyeColor: '#4db6ac',        // Ngọc teal
        themeColor: '#ff8da1',      // Hồng đậm chủ đạo
        skirtColor: '#f06292',      // Váy hồng
        dialogues: {
            m1: [
                "Hello! It's a bit cold today, let's catch some strawberries together! 🌸",
                "Oh, you want to play with Hana? I'm so excited!"
            ],
            m2: [
                "I just washed this school uniform, how do I look? 🏫",
                "You're so good at catching! Hana is cheering you on!"
            ],
            m3: [
                "It's starting to get warm... The breeze feels nice! ☀️",
                "Wow, the score is rising fast! Keep it up!"
            ],
            m4: [
                "Oh... this outfit is a bit... Don't stare at me, it's embarrassing... 😳",
                "You play so well, but... I feel so shy..."
            ],
            m5: [
                "I-I spent a lot of time choosing this bikini... It's only for you to see! 💖",
                "Summer is amazing! Thank you for catching food for me!"
            ],
            gameOver: "Oops... we lost. Let me put on warm clothes. Play again? 🥺",
            combo: "Great job! Keep this up and we'll win! 🌟",
            milestoneUp: {
                m2: "Oh... A school uniform! Do you think it suits me? 🏫",
                m3: "You're awesome at catching! This sailor dress is so breezy! ☀️",
                m4: "Ugh... I'm so embarrassed... please don't look at me right now... 😳",
                m5: "T-This bikini... is only for your eyes! I'm dying of embarrassment... 🫣"
            }
        }
    },
    yuki: {
        id: 'yuki',
        name: 'Yuki',
        personality: 'Cool & Stoic',
        hairColor: '#78909c',       // Xám xanh lạnh lùng
        eyeColor: '#42a5f5',        // Xanh dương sáng
        themeColor: '#37474f',      // Xám đậm chủ đạo (nam tính)
        skirtColor: '#263238',      // Quần xám đen
        dialogues: {
            m1: [
                "Hm... I'm only here because I have free time. Don't get the wrong idea. ❄️",
                "Focus on catching food, why are you looking at me?"
            ],
            m2: [
                "It's just a normal uniform. Haven't you seen one before? 🎒",
                "It's okay... But don't get cocky, this is just the beginning."
            ],
            m3: [
                "It's getting hot... Let me roll up my sleeves a bit. 💪",
                "Impressive... I mean, it's not as bad as I thought."
            ],
            m4: [
                "Oh... this outfit is a bit too revealing. Stop staring! 😤",
                "Why did you suddenly get so good? How annoying..."
            ],
            m5: [
                "T-This is just gym wear! Because it's so hot! 🏋️",
                "Fine... stare if you want. I don't care."
            ],
            gameOver: "You lost. I'm putting my jacket back on. Try again! 😒",
            combo: "Not bad! Don't let anything drop now!",
            milestoneUp: {
                m2: "It's just a uniform. What are you looking at, keep playing! 🎒",
                m3: "Just rolling my sleeves because it's hot. Don't get any ideas! 💪",
                m4: "D-Don't look at me right now... Focus on the game! 😤",
                m5: "This is just workout gear! It's hot, get it?! 🏋️"
            }
        }
    },
    akane: {
        id: 'akane',
        name: 'Akane',
        personality: 'Energetic & Playful',
        hairColor: '#ffb74d',       // Cam pastel rực rỡ
        eyeColor: '#8bc34a',        // Xanh olive lá cây
        themeColor: '#ff5722',      // Cam đỏ chủ đạo
        skirtColor: '#d84315',      // Váy cam đỏ đậm
        dialogues: {
            m1: [
                "Yo! Feel the energy? Start catching food, friend! 🔥",
                "Today I'll help you score maximum points! Let's go!"
            ],
            m2: [
                "An active shirt, right? Super comfortable for running and jumping! 🏃‍♀️",
                "Look, there's cake! Catch it quick!"
            ],
            m3: [
                "Yeah! Short skirts are perfect for this weather! 🍃",
                "Awesome! You're catching every single one!"
            ],
            m4: [
                "Haha, your face is completely red! You love looking, don't you? 😜",
                "Wow, so breezy~ Want to dance with me?"
            ],
            m5: [
                "Beach bikini is the best! Let's go swimming together after this! 🌊",
                "You're the food-catching champion! So awesome, Akane loves it!"
            ],
            gameOver: "Whoops, game over! Let me put my coat back on. Let's start a new game! 🤩",
            combo: "Super fire! Keep that combo going! ⚡",
            milestoneUp: {
                m2: "Looking active in this shirt? Let's keep fighting! 🏃‍♀️",
                m3: "Yeah! Pleated short skirt is super cool and cute! 🍃",
                m4: "Hehe, your face is blushing~ You love seeing me in lingerie, don't you? 😜",
                m5: "Colorful summer bikini! Let's hit the beach together after playing! 🌊"
            }
        }
    }
};

// Quản lý bộ đệm ảnh để không load lại nhiều lần
const WaifuImageCache = {
    hana: {},
    yuki: {},
    akane: {}
};

// Kiểm tra và bắt đầu tải trước toàn bộ ảnh waifu
function preloadWaifuImages() {
    console.log("Đang bắt đầu tải trước (preload) tài nguyên hình ảnh Waifu...");
    // Thêm cache-busting timestamp để trình duyệt luôn tải ảnh mới nhất
    const cacheBuster = `?v=${Date.now()}`;
    Object.keys(WAIFU_DATABASE).forEach(charId => {
        for (let m = 1; m <= 5; m++) {
            const img = new Image();
            img.src = `assets/${charId}_${m}.png${cacheBuster}`;

            img.onload = () => {
                WaifuImageCache[charId][m] = img;
                console.log(`Đã tải thành công ảnh: assets/${charId}_${m}.png`);
            };

            img.onerror = () => {
                WaifuImageCache[charId][m] = null;
            };
        }
    });
}

// Gọi preload ngay khi file được nhúng
preloadWaifuImages();

/**
 * Lấy câu thoại ngẫu nhiên của Waifu dựa trên Milestone và trạng thái
 */
function getWaifuDialogue(character, milestone, isGameOver, isHighCombo) {
    const db = WAIFU_DATABASE[character.id];
    if (!db) return "Xin chào!";

    if (isGameOver) {
        return db.dialogues.gameOver;
    }

    if (isHighCombo) {
        return db.dialogues.combo;
    }

    const milestoneKey = `m${milestone}`;
    const dialogueList = db.dialogues[milestoneKey] || db.dialogues.m1;

    const randomIndex = Math.floor(Math.random() * dialogueList.length);
    return dialogueList[randomIndex];
}

/**
 * ENGINE VẼ WAIFU CHÍNH - HỖ TRỢ ZOOM, CHỚP SÁNG VÀ HẠT LẤP LÁNH
 */
function drawWaifu(ctx, charCanvas, charId, score, combo, isGameOver, customMessage = null, zoomScale = 1.0, flashAlpha = 0.0, waifuParticles = []) {
    const character = WAIFU_DATABASE[charId];
    if (!character) return;

    // Xác định Milestone dựa trên điểm số (tối đa 5)
    let currentMilestone = 1;
    if (score >= 80) currentMilestone = 5;
    else if (score >= 60) currentMilestone = 4;
    else if (score >= 40) currentMilestone = 3;
    else if (score >= 20) currentMilestone = 2;

    if (isGameOver) {
        currentMilestone = 1;
    }

    // Xóa canvas cũ
    ctx.clearRect(0, 0, charCanvas.width, charCanvas.height);

    // 1. Vẽ background riêng theo tone màu nhân vật
    const grad = ctx.createLinearGradient(0, 0, 0, charCanvas.height);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, character.hairColor + '33'); // Độ mờ 20%
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, charCanvas.width, charCanvas.height);

    // Vẽ chi tiết vòng tròn mờ nền
    ctx.save();
    ctx.fillStyle = character.hairColor + '1a'; // 10% opacity
    ctx.beginPath();
    ctx.arc(charCanvas.width / 2, charCanvas.height / 2 + 50, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Vẽ các hạt lấp lánh (Sparkle Particles) bay quanh nhân vật
    if (waifuParticles && waifuParticles.length > 0) {
        waifuParticles.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;

            if (p.shape === 'heart') {
                drawHeartShape(ctx, p.x, p.y, p.size);
            } else if (p.shape === 'star') {
                drawStarShape(ctx, p.x, p.y, 5, p.size, p.size / 2);
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        });
    }

    // 3. Áp dụng Zoom Scale và vẽ Waifu (PNG hoặc Vector)
    ctx.save();

    // Thực hiện zoom đồng tâm từ điểm chính giữa dưới đáy canvas
    ctx.translate(charCanvas.width / 2, charCanvas.height);
    ctx.scale(zoomScale, zoomScale);
    ctx.translate(-charCanvas.width / 2, -charCanvas.height);

    const cachedImg = WaifuImageCache[charId][currentMilestone];
    let isDrawingPlaceholder = false;

    if (cachedImg) {
        const imgRatio = cachedImg.width / cachedImg.height;
        // Vẽ ảnh vừa khít 100% chiều rộng canvas
        let drawWidth = charCanvas.width * 1.0;
        let drawHeight = drawWidth / imgRatio;

        // Căn giữa theo chiều ngang, sát đáy canvas
        let x = (charCanvas.width - drawWidth) / 2;
        let y = charCanvas.height - drawHeight;

        ctx.drawImage(cachedImg, x, y, drawWidth, drawHeight);
    } else {
        isDrawingPlaceholder = true;
        drawVectorChibi(ctx, charCanvas, character, currentMilestone, combo);
    }

    ctx.restore(); // Khôi phục trạng thái canvas trước khi vẽ UI bong bóng thoại

    // 4. Vẽ bong bóng thoại hội thoại (Speech Bubble) - Đặt ở đáy canvas để không che mặt nhân vật
    const textToShow = customMessage || getWaifuDialogue(character, currentMilestone, isGameOver, combo >= 10);
    // Tính toán vị trí bubble ở phía dưới canvas (cách đáy ~90px)
    const bubbleY = charCanvas.height - 90;
    drawSpeechBubble(ctx, charCanvas.width / 2, bubbleY, textToShow, character.themeColor);

    // 5. Hiệu ứng Camera Flash phép thuật (Phủ trắng mờ dần)
    if (flashAlpha > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
        ctx.fillRect(0, 0, charCanvas.width, charCanvas.height);
        ctx.restore();
    }

    // Nếu đang vẽ Placeholder, hiển thị cảnh báo debug ở chân canvas
    if (isDrawingPlaceholder) {
        ctx.save();
        ctx.fillStyle = "rgba(244, 67, 54, 0.08)";
        ctx.fillRect(5, charCanvas.height - 30, charCanvas.width - 10, 25);
        ctx.strokeStyle = "rgba(244, 67, 54, 0.3)";
        ctx.lineWidth = 1;
        ctx.strokeRect(5, charCanvas.height - 30, charCanvas.width - 10, 25);

        ctx.fillStyle = "#d32f2f";
        ctx.font = "bold 9px 'Quicksand', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`MISSING ASSET: assets/${charId}_${currentMilestone}.png (Drawing Placeholder Chibi)`, charCanvas.width / 2, charCanvas.height - 14);
        ctx.restore();
    }
}

/**
 * HÀM VẼ TRÁI TIM DỄ THƯƠNG
 */
function drawHeartShape(ctx, x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y - size / 4);
    ctx.bezierCurveTo(x, y - size, x - size, y - size, x - size, y - size / 4);
    ctx.bezierCurveTo(x - size, y + size / 3, x, y + size * 0.8, x, y + size);
    ctx.bezierCurveTo(x, y + size * 0.8, x + size, y + size / 3, x + size, y - size / 4);
    ctx.bezierCurveTo(x + size, y - size, x, y - size, x, y - size / 4);
    ctx.closePath();
    ctx.fill();
}

/**
 * HÀM VẼ NGÔI SAO LẤP LÁNH
 */
function drawStarShape(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
}

/**
 * HÀM VẼ CHIBI VECTOR CHÍNH
 */
function drawVectorChibi(ctx, canvas, character, milestone, combo) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2 + 80; // Trọng tâm cơ thể dịch xuống dưới một chút

    ctx.save();

    // 1. Vẽ Chân (Legs)
    ctx.fillStyle = '#ffebd6'; // Màu da pastel sáng
    ctx.beginPath();
    ctx.ellipse(cx - 18, cy + 90, 8, 30, Math.PI / 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 18, cy + 90, 8, 30, -Math.PI / 18, 0, Math.PI * 2);
    ctx.fill();

    if (milestone <= 3) {
        ctx.fillStyle = milestone === 3 ? '#ffffff' : '#222222';
        ctx.beginPath();
        ctx.ellipse(cx - 18, cy + 95, 8.2, 15, Math.PI / 18, 0, Math.PI * 2);
        ctx.ellipse(cx + 18, cy + 95, 8.2, 15, -Math.PI / 18, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.fillStyle = '#3e2723';
    ctx.beginPath();
    ctx.arc(cx - 20, cy + 115, 9, 0, Math.PI * 2);
    ctx.arc(cx + 20, cy + 115, 9, 0, Math.PI * 2);
    ctx.fill();

    // 2. Vẽ Thân & Trang phục (Body & Clothes)
    ctx.fillStyle = '#ffebd6';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 30, 20, 35, 0, 0, Math.PI * 2);
    ctx.fill();

    if (milestone === 1) {
        // --- MILESTONE 1: WINTER COAT ---
        ctx.fillStyle = character.themeColor;
        ctx.beginPath();
        ctx.ellipse(cx, cy + 40, 24, 38, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy + 10, 16, 0, Math.PI * 2);
        ctx.arc(cx - 18, cy + 15, 12, 0, Math.PI * 2);
        ctx.arc(cx + 18, cy + 15, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fbc02d';
        ctx.beginPath();
        ctx.arc(cx, cy + 35, 4, 0, Math.PI * 2);
        ctx.arc(cx, cy + 55, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = character.themeColor;
        ctx.beginPath();
        ctx.ellipse(cx - 26, cy + 35, 10, 22, Math.PI / 8, 0, Math.PI * 2);
        ctx.ellipse(cx + 26, cy + 35, 10, 22, -Math.PI / 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffebd6';
        ctx.beginPath();
        ctx.arc(cx - 32, cy + 52, 6, 0, Math.PI * 2);
        ctx.arc(cx + 32, cy + 52, 6, 0, Math.PI * 2);
        ctx.fill();

    } else if (milestone === 2) {
        // --- MILESTONE 2: SCHOOL UNIFORM ---
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 32, 21, 30, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(cx - 24, cy + 30, 8, 20, Math.PI / 10, 0, Math.PI * 2);
        ctx.ellipse(cx + 24, cy + 30, 8, 20, -Math.PI / 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = character.skirtColor;
        ctx.beginPath();
        ctx.moveTo(cx - 22, cy + 45);
        ctx.lineTo(cx + 22, cy + 45);
        ctx.lineTo(cx + 28, cy + 75);
        ctx.lineTo(cx - 28, cy + 75);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#e53935';
        ctx.beginPath();
        ctx.moveTo(cx, cy + 15);
        ctx.lineTo(cx - 10, cy + 8);
        ctx.lineTo(cx - 10, cy + 22);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx, cy + 15);
        ctx.lineTo(cx + 10, cy + 8);
        ctx.lineTo(cx + 10, cy + 22);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffebd6';
        ctx.beginPath();
        ctx.arc(cx - 29, cy + 45, 5, 0, Math.PI * 2);
        ctx.arc(cx + 29, cy + 45, 5, 0, Math.PI * 2);
        ctx.fill();

    } else if (milestone === 3) {
        // --- MILESTONE 3: SAILOR COLLAR ---
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 28, 20, 26, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx - 21, cy + 18, 8, 0, Math.PI * 2);
        ctx.arc(cx + 21, cy + 18, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = character.themeColor;
        ctx.beginPath();
        ctx.moveTo(cx - 16, cy + 12);
        ctx.lineTo(cx + 16, cy + 12);
        ctx.lineTo(cx, cy + 26);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = character.skirtColor;
        ctx.beginPath();
        ctx.moveTo(cx - 21, cy + 40);
        ctx.lineTo(cx + 21, cy + 40);
        ctx.lineTo(cx + 28, cy + 65);
        ctx.lineTo(cx - 28, cy + 65);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffebd6';
        ctx.beginPath();
        ctx.ellipse(cx - 24, cy + 30, 5.5, 14, Math.PI / 12, 0, Math.PI * 2);
        ctx.ellipse(cx + 24, cy + 30, 5.5, 14, -Math.PI / 12, 0, Math.PI * 2);
        ctx.fill();

    } else if (milestone === 4) {
        // --- MILESTONE 4: LINGERIE ---
        ctx.fillStyle = '#fff0f2';
        ctx.beginPath();
        ctx.arc(cx - 9, cy + 20, 8, 0, Math.PI * 2);
        ctx.arc(cx + 9, cy + 20, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = character.themeColor + '88';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#fff0f2';
        ctx.beginPath();
        ctx.moveTo(cx - 18, cy + 42);
        ctx.lineTo(cx + 18, cy + 42);
        ctx.lineTo(cx, cy + 62);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = character.themeColor;
        ctx.beginPath();
        ctx.arc(cx - 17, cy + 43, 2.5, 0, Math.PI * 2);
        ctx.arc(cx + 17, cy + 43, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffebd6';
        ctx.beginPath();
        ctx.ellipse(cx - 22, cy + 28, 5, 16, Math.PI / 10, 0, Math.PI * 2);
        ctx.ellipse(cx + 22, cy + 28, 5, 16, -Math.PI / 10, 0, Math.PI * 2);
        ctx.fill();

    } else if (milestone === 5) {
        // --- MILESTONE 5: SEXY BIKINI ---
        ctx.fillStyle = character.skirtColor;
        ctx.beginPath();
        ctx.moveTo(cx - 16, cy + 24);
        ctx.lineTo(cx - 2, cy + 24);
        ctx.lineTo(cx - 9, cy + 14);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(cx + 16, cy + 24);
        ctx.lineTo(cx + 2, cy + 24);
        ctx.lineTo(cx + 9, cy + 14);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = character.skirtColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 9, cy + 14);
        ctx.lineTo(cx - 3, cy + 8);
        ctx.moveTo(cx + 9, cy + 14);
        ctx.lineTo(cx + 3, cy + 8);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx - 16, cy + 45);
        ctx.lineTo(cx + 16, cy + 45);
        ctx.lineTo(cx, cy + 62);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = character.themeColor;
        ctx.beginPath();
        ctx.arc(cx - 15, cy + 46, 3, 0, Math.PI * 2);
        ctx.arc(cx + 15, cy + 46, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffebd6';
        ctx.beginPath();
        ctx.ellipse(cx - 22, cy + 28, 5, 16, Math.PI / 10, 0, Math.PI * 2);
        ctx.ellipse(cx + 22, cy + 28, 5, 16, -Math.PI / 10, 0, Math.PI * 2);
        ctx.fill();
    }

    // 3. Vẽ Cổ & Đầu (Neck & Head)
    ctx.fillStyle = '#ffebd6';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 8, 8, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy - 40, 48, 0, Math.PI * 2);
    ctx.fill();

    // 4. Vẽ Đôi Mắt Long Lanh (Anime Eyes)
    const eyeY = cy - 38;
    const eyeSpacing = 20;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - eyeSpacing, eyeY, 10, 0, Math.PI * 2);
    ctx.arc(cx + eyeSpacing, eyeY, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = character.eyeColor;
    ctx.beginPath();
    ctx.arc(cx - eyeSpacing, eyeY, 7, 0, Math.PI * 2);
    ctx.arc(cx + eyeSpacing, eyeY, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath();
    ctx.arc(cx - eyeSpacing, eyeY, 4, 0, Math.PI * 2);
    ctx.arc(cx + eyeSpacing, eyeY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - eyeSpacing - 2, eyeY - 2, 2.5, 0, Math.PI * 2);
    ctx.arc(cx - eyeSpacing + 2, eyeY + 2, 1, 0, Math.PI * 2);
    ctx.arc(cx + eyeSpacing - 2, eyeY - 2, 2.5, 0, Math.PI * 2);
    ctx.arc(cx + eyeSpacing + 2, eyeY + 2, 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#2d2d2d';
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx - eyeSpacing, eyeY - 2, 10, Math.PI * 1.1, Math.PI * 1.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + eyeSpacing, eyeY - 2, 10, Math.PI * 1.2, Math.PI * 1.9);
    ctx.stroke();

    // Má Hồng Thẹn Thùng
    const blushIntensity = 0.15 + (milestone - 1) * 0.15;
    ctx.fillStyle = `rgba(255, 105, 180, ${blushIntensity})`;
    ctx.beginPath();
    ctx.ellipse(cx - 30, cy - 28, 9, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 30, cy - 28, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (milestone >= 4) {
        ctx.strokeStyle = `rgba(233, 30, 99, 0.6)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cx - 33, cy - 25); ctx.lineTo(cx - 30, cy - 31); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - 29, cy - 25); ctx.lineTo(cx - 26, cy - 31); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 26, cy - 25); ctx.lineTo(cx + 29, cy - 31); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 30, cy - 25); ctx.lineTo(cx + 33, cy - 31); ctx.stroke();
    }

    // Miệng
    ctx.strokeStyle = '#2d2d2d';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (milestone >= 4) {
        ctx.moveTo(cx - 5, cy - 26);
        ctx.bezierCurveTo(cx - 2, cy - 29, cx + 2, cy - 23, cx + 5, cy - 26);
    } else {
        ctx.arc(cx, cy - 28, 4, 0, Math.PI);
    }
    ctx.stroke();

    // 5. Vẽ Tóc (Hairstyle)
    ctx.fillStyle = character.hairColor;

    if (character.id === 'hana') {
        ctx.beginPath();
        ctx.moveTo(cx - 48, cy - 50);
        ctx.bezierCurveTo(cx - 30, cy - 85, cx + 30, cy - 85, cx + 48, cy - 50);
        ctx.lineTo(cx + 42, cy - 35);
        ctx.bezierCurveTo(cx + 20, cy - 55, cx - 20, cy - 55, cx - 42, cy - 35);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(cx - 55, cy - 20, 16, 45, Math.PI / 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + 55, cy - 20, 16, 45, -Math.PI / 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = character.themeColor;
        ctx.beginPath();
        ctx.arc(cx - 46, cy - 50, 5, 0, Math.PI * 2);
        ctx.arc(cx + 46, cy - 50, 5, 0, Math.PI * 2);
        ctx.fill();

    } else if (character.id === 'yuki') {
        ctx.beginPath();
        ctx.moveTo(cx - 48, cy - 48);
        ctx.bezierCurveTo(cx - 20, cy - 90, cx + 35, cy - 85, cx + 48, cy - 48);
        ctx.lineTo(cx + 38, cy - 25);
        ctx.lineTo(cx + 10, cy - 45);
        ctx.lineTo(cx - 20, cy - 30);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(cx - 46, cy - 48);
        ctx.bezierCurveTo(cx - 60, cy - 20, cx - 45, cy + 10, cx - 40, cy + 15);
        ctx.lineTo(cx - 35, cy - 10);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(cx + 46, cy - 48);
        ctx.bezierCurveTo(cx + 60, cy - 20, cx + 45, cy + 10, cx + 40, cy + 15);
        ctx.lineTo(cx + 35, cy - 10);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = character.skirtColor;
        ctx.fillRect(cx - 30, cy - 65, 8, 3);

    } else if (character.id === 'akane') {
        ctx.beginPath();
        ctx.moveTo(cx - 48, cy - 50);
        ctx.bezierCurveTo(cx - 25, cy - 85, cx + 25, cy - 85, cx + 48, cy - 50);
        ctx.lineTo(cx + 35, cy - 20);
        ctx.lineTo(cx + 25, cy - 35);
        ctx.lineTo(cx + 10, cy - 38);
        ctx.lineTo(cx, cy - 28);
        ctx.lineTo(cx - 10, cy - 38);
        ctx.lineTo(cx - 25, cy - 35);
        ctx.lineTo(cx - 35, cy - 20);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(cx + 35, cy - 65);
        ctx.bezierCurveTo(cx + 75, cy - 85, cx + 80, cy - 20, cx + 60, cy - 5);
        ctx.bezierCurveTo(cx + 50, cy - 20, cx + 40, cy - 45, cx + 38, cy - 55);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = character.themeColor;
        ctx.beginPath();
        ctx.ellipse(cx + 38, cy - 60, 6, 9, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

/**
 * HÀM VẼ BONG BÓNG HỘI THOẠI
 */
function drawSpeechBubble(ctx, x, y, text, themeColor) {
    ctx.save();

    const maxTextWidth = 260;
    ctx.font = "bold 12px 'Quicksand', sans-serif";
    const words = text.split(" ");
    let lines = [];
    let currentLine = "";

    for (let i = 0; i < words.length; i++) {
        let testLine = currentLine + words[i] + " ";
        let testWidth = ctx.measureText(testLine).width;
        if (testWidth > maxTextWidth && i > 0) {
            lines.push(currentLine.trim());
            currentLine = words[i] + " ";
        } else {
            currentLine = testLine;
        }
    }
    lines.push(currentLine.trim());

    const lineHeight = 16;
    const bubbleHeight = lines.length * lineHeight + 18;
    const bubbleWidth = maxTextWidth + 26;

    const bx = x - bubbleWidth / 2;
    // Mũi tên chỉ lên trên (phía nhân vật), bubble nằm phía dưới mũi tên
    const arrowTipY = y; // Đỉnh mũi tên
    const by = arrowTipY + 12; // Thân bubble bắt đầu sau mũi tên

    // Vẽ bóng mờ
    ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
    ctx.beginPath();
    ctx.roundRect(bx + 2, by + 2, bubbleWidth, bubbleHeight, 14);
    ctx.fill();

    // Vẽ nền bubble trắng với viền
    ctx.fillStyle = "rgba(255, 255, 255, 0.93)";
    ctx.strokeStyle = themeColor + '99';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.roundRect(bx, by, bubbleWidth, bubbleHeight, 14);
    ctx.fill();
    ctx.stroke();

    // Vẽ mũi tên CHỈ LÊN TRÊN (hướng về phía nhân vật)
    ctx.fillStyle = "rgba(255, 255, 255, 0.93)";
    ctx.strokeStyle = themeColor + '99';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.moveTo(x - 10, by + 1);
    ctx.lineTo(x, arrowTipY);
    ctx.lineTo(x + 10, by + 1);
    ctx.closePath();
    ctx.fill();

    // Che viền ngang của mũi tên nơi giao với bubble
    ctx.strokeStyle = "rgba(255, 255, 255, 0.93)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - 8, by + 1);
    ctx.lineTo(x + 8, by + 1);
    ctx.stroke();

    // Vẽ viền ngoài mũi tên
    ctx.strokeStyle = themeColor + '99';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 10, by + 1);
    ctx.lineTo(x, arrowTipY);
    ctx.lineTo(x + 10, by + 1);
    ctx.stroke();

    // Vẽ text
    ctx.fillStyle = "#333333";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    lines.forEach((line, index) => {
        ctx.fillText(line, x, by + 10 + index * lineHeight);
    });

    ctx.restore();
}
