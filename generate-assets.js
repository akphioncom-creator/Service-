const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputFile = 'main-logo.png'; 
const baseOutputDir = 'android/app/src/main/res/';

// অ্যান্ড্রয়েড ডেনসিটি অ্যারে
const mipmapDensities = [
    { name: 'mipmap-mdpi', size: 108 },
    { name: 'mipmap-hdpi', size: 162 },
    { name: 'mipmap-xhdpi', size: 216 },
    { name: 'mipmap-xxhdpi', size: 324 },
    { name: 'mipmap-xxxhdpi', size: 432 }
];

const drawableDensities = [
    { name: 'drawable-mdpi', size: 192 },
    { name: 'drawable-hdpi', size: 288 },
    { name: 'drawable-xhdpi', size: 384 },
    { name: 'drawable-xxhdpi', size: 576 },
    { name: 'drawable-xxxhdpi', size: 768 }
];

const transparentBg = { r: 0, g: 0, b: 0, alpha: 0 };

const splashXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/ic_launcher_background" />
    <item>
        <bitmap
            android:gravity="center"
            android:src="@drawable/splashscreen_logo" />
    </item>
</layer-list>`;

/**
 * ফাইল ডিলিশন অ্যালগরিদম: এটি প্রিফিক্স অনুযায়ী .png, .webp, .jpg ফাইল স্ক্যান করে মুছে ফেলে
 */
function purgeTargetFiles(dirPath, targetPrefixes) {
    if (!fs.existsSync(dirPath)) return;
    
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
        // ফাইলটি আমাদের টার্গেট লিস্টের কোনো নামের সাথে মিলে কিনা এবং সেটি ইমেজ কিনা তা চেক করা
        const matchesPrefix = targetPrefixes.some(prefix => file.startsWith(prefix + '.'));
        const isImage = file.endsWith('.png') || file.endsWith('.webp') || file.endsWith('.jpg');
        
        if (matchesPrefix && isImage) {
            const exactFilePath = path.join(dirPath, file);
            fs.unlinkSync(exactFilePath);
            console.log(`🗑️ ক্লিনআপ সম্পন্ন: ${dirPath.split('/').pop()}/${file}`);
        }
    }
}

async function generateAllAssets() {
    try {
        if (!fs.existsSync(inputFile)) {
            throw new Error(`[ক্রিটিক্যাল এরর] ${inputFile} ফাইলটি রুড ফোল্ডারে পাওয়া যায়নি!`);
        }

        console.log("অটোমেটেড বিল্ড পাইপলাইন: লেগ্যাসি ডেটা রিমুভ এবং নতুন অ্যাসেট রেন্ডারিং শুরু হচ্ছে...\n");

        // ==========================================
        // ফেজ ১: ডিপ-ক্লিনআপ (পুরোনো ic_launcher, round_icon এবং .webp ফাইল ধ্বংস)
        // ==========================================
        const mipmapTargets = ['ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground'];
        for (const density of mipmapDensities) {
            purgeTargetFiles(path.join(baseOutputDir, density.name), mipmapTargets);
        }

        const drawableTargets = ['splashscreen_logo'];
        for (const density of drawableDensities) {
            purgeTargetFiles(path.join(baseOutputDir, density.name), drawableTargets);
        }
        
        const drawableBaseDir = path.join(baseOutputDir, 'drawable');
        const splashXmlPath = path.join(drawableBaseDir, 'splashscreen_background.xml');
        if (fs.existsSync(splashXmlPath)) {
            fs.unlinkSync(splashXmlPath);
        }

        console.log("\nমেমরি ক্লিনআপ ১০০% সফল। নতুন অ্যাসেট রেন্ডারিং চলছে...\n");

        // ==========================================
        // ফেজ ২: লঞ্চার আইকন (Adaptive Foreground) তৈরি
        // ==========================================
        for (const density of mipmapDensities) {
            const outputDir = path.join(baseOutputDir, density.name);
            if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

            const outputFile = path.join(outputDir, 'ic_launcher_foreground.png');
            const safeZoneSize = Math.floor(density.size * (48 / 108));

            const resizedLogo = await sharp(inputFile)
                .trim()
                .resize({ width: safeZoneSize, height: safeZoneSize, fit: 'inside' })
                .toBuffer();

            await sharp({ create: { width: density.size, height: density.size, channels: 4, background: transparentBg } })
                .composite([{ input: resizedLogo, gravity: 'center' }])
                .toFile(outputFile);

            console.log(`✅ জেনারেটেড (Foreground): ${density.name}/ic_launcher_foreground.png`);
        }

        // ==========================================
        // ফেজ ৩: স্প্ল্যাশ স্ক্রিন লোগো তৈরি
        // ==========================================
        for (const density of drawableDensities) {
            const outputDir = path.join(baseOutputDir, density.name);
            if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

            const outputFile = path.join(outputDir, 'splashscreen_logo.png');

            await sharp(inputFile)
                .trim()
                .resize({ width: density.size, height: density.size, fit: 'inside' })
                .toFile(outputFile);

            console.log(`✅ জেনারেটেড (Splash): ${density.name}/splashscreen_logo.png`);
        }

        // ==========================================
        // ফেজ ৪: স্প্ল্যাশ স্ক্রিন XML জেনারেশন
        // ==========================================
        if (!fs.existsSync(drawableBaseDir)) {
            fs.mkdirSync(drawableBaseDir, { recursive: true });
        }
        fs.writeFileSync(splashXmlPath, splashXmlContent, 'utf8');
        console.log(`✅ XML ক্যানভাস জেনারেটেড: drawable/splashscreen_background.xml`);

        console.log("\nসিস্টেম আপডেট: ডুপ্লিকেট .webp ফাইলগুলো ধ্বংস করে সম্পূর্ণ নতুন অ্যাসেট সফলভাবে তৈরি করা হয়েছে।");

    } catch (error) {
        console.error("অ্যাসেট তৈরিতে ত্রুটি:", error);
    }
}

// স্ক্রিপ্ট এক্সিকিউশন
generateAllAssets();
