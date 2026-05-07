const { getMetadata, downloadMedia, getDownloadOptions, downloadThumbnail } = require('./downloader');
const { setState, getState, deleteState } = require('./state');
const path = require('path');
const fs = require('fs-extra');
const { delay } = require('@whiskeysockets/baileys');

const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

const handleMessage = async (sock, m) => {
    const msg = m.messages[0];
    if (!msg.message) return;

    const sender = msg.key.remoteJid;
    const text = (
        msg.message.conversation || 
        msg.message.extendedTextMessage?.text || 
        msg.message.imageMessage?.caption || 
        msg.message.videoMessage?.caption || 
        ''
    ).trim();
    const state = getState(sender);

    try {
        // Check for links first
        const links = text.match(urlRegex);
        if (links && !state) {
            const url = links[0];
            await sock.sendMessage(sender, { text: '⏳ جاري جلب بيانات الفيديو...' }, { quoted: msg });
            
            const meta = await getMetadata(url);
            const thumbPath = path.join(__dirname, '../temp', `thumb_${Date.now()}.jpg`);
            await downloadThumbnail(meta.thumbnail, thumbPath);

            const caption = `🎬 *${meta.title}*\n\n⏱️ *المدة:* ${meta.duration}\n\nاختر نوع التحميل:\n1- MP3 (صوت)\n2- MP4 (فيديو)`;
            
            if (fs.existsSync(thumbPath)) {
                await sock.sendMessage(sender, { 
                    image: { url: thumbPath }, 
                    caption: caption 
                }, { quoted: msg });
                fs.unlinkSync(thumbPath);
            } else {
                await sock.sendMessage(sender, { text: caption }, { quoted: msg });
            }

            setState(sender, { 
                url, 
                title: meta.title, 
                step: 'waiting_for_type' 
            });
            return;
        }

        // Handle choices if in state
        if (state) {
            if (state.step === 'waiting_for_type') {
                if (text === '1') {
                    // MP3 Selection
                    await processDownload(sock, sender, state.url, 'mp3', null, state.title, msg);
                    deleteState(sender);
                } else if (text === '2') {
                    // MP4 Selection -> Ask Quality
                    await sock.sendMessage(sender, { 
                        text: 'اختر الجودة المطلوبة:\n360p\n720p\n1080p' 
                    }, { quoted: msg });
                    setState(sender, { ...state, step: 'waiting_for_quality', type: 'mp4' });
                } else {
                    await sock.sendMessage(sender, { text: 'الرجاء اختيار 1 أو 2، أو أرسل رابطاً جديداً لإلغاء العملية الحالية.' });
                }
            } else if (state.step === 'waiting_for_quality') {
                const qualities = ['360p', '720p', '1080p'];
                if (qualities.includes(text.toLowerCase())) {
                    await processDownload(sock, sender, state.url, 'mp4', text.toLowerCase(), state.title, msg);
                    deleteState(sender);
                } else {
                    await sock.sendMessage(sender, { text: 'الرجاء اختيار جودة صحيحة (360p, 720p, 1080p).' });
                }
            }
        } else if (!links) {
            // Default response for non-link, non-state messages
            const welcomeText = `أهلاً بك! 👋 أنا بوت تحميل الفيديوهات.\n\nأرسل لي أي رابط فيديو (YouTube, TikTok, Instagram, etc.) وسأقوم بتحميله لك.\n\nيمكنني تحميل:\n✅ MP3 (صوت)\n✅ MP4 (فيديو بجميع الجودات)`;
            await sock.sendMessage(sender, { text: welcomeText }, { quoted: msg });
        }

    } catch (error) {
        console.error('Handler Error:', error);
        await sock.sendMessage(sender, { text: `❌ حدث خطأ: ${error.message}` });
        deleteState(sender);
    }
};

const processDownload = async (sock, sender, url, type, quality, title, quoted) => {
    const ext = type === 'mp3' ? 'mp3' : 'mp4';
    const fileName = `${title.replace(/[/\\?%*:|"<>]/g, '')}_${Date.now()}.${ext}`;
    const outputPath = path.join(__dirname, '../temp', fileName);
    
    await sock.sendMessage(sender, { text: `🚀 جاري بدء التحميل (${type.toUpperCase()}${quality ? ' - ' + quality : ''})...` }, { quoted });

    try {
        const options = getDownloadOptions(type, quality);
        await downloadMedia(url, options, outputPath);

        if (fs.existsSync(outputPath)) {
            await sock.sendMessage(sender, { text: '✅ اكتمل التحميل، جاري الإرسال...' }, { quoted });
            
            const stats = fs.statSync(outputPath);
            const fileSizeMB = stats.size / (1024 * 1024);

            if (type === 'mp3') {
                await sock.sendMessage(sender, { 
                    audio: { url: outputPath }, 
                    mimetype: 'audio/mpeg',
                    fileName: fileName
                }, { quoted });
            } else {
                // For videos, if it's large, send as document to avoid compression issues or limit issues
                if (fileSizeMB > 50) {
                    await sock.sendMessage(sender, { 
                        document: { url: outputPath }, 
                        mimetype: 'video/mp4',
                        fileName: fileName,
                        caption: title
                    }, { quoted });
                } else {
                    await sock.sendMessage(sender, { 
                        video: { url: outputPath }, 
                        caption: title
                    }, { quoted });
                }
            }
            
            // Cleanup
            fs.unlinkSync(outputPath);
        } else {
            throw new Error('فشل التحميل، الملف غير موجود.');
        }
    } catch (error) {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        throw error;
    }
};

module.exports = {
    handleMessage
};
