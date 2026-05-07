const youtubeDl = require('yt-dlp-exec');
const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');

/**
 * Fetch metadata for a given URL
 */
const getMetadata = async (url) => {
    try {
        const metadata = await youtubeDl(url, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addHeader: ['referer:youtube.com', 'user-agent:googlebot']
        });
        return {
            title: metadata.title,
            thumbnail: metadata.thumbnail,
            duration: metadata.duration_string || `${Math.floor(metadata.duration / 60)}:${metadata.duration % 60}`,
            formats: metadata.formats
        };
    } catch (error) {
        console.error('Error fetching metadata:', error);
        throw new Error('تعذر جلب بيانات الرابط. تأكد من أن الرابط صحيح ومدعوم.');
    }
};

/**
 * Download media
 */
const downloadMedia = async (url, options, outputPath) => {
    try {
        await youtubeDl(url, {
            ...options,
            output: outputPath,
            noCheckCertificates: true,
            noWarnings: true,
            addHeader: ['referer:youtube.com', 'user-agent:googlebot']
        });
        return outputPath;
    } catch (error) {
        console.error('Download error:', error);
        throw new Error('حدث خطأ أثناء التحميل. حاول مرة أخرى لاحقاً.');
    }
};

/**
 * Get download options based on type and quality
 */
const getDownloadOptions = (type, quality) => {
    if (type === 'mp3') {
        return {
            extractAudio: true,
            audioFormat: 'mp3',
            audioQuality: 0, // Best
        };
    } else {
        let format = 'bestvideo[height<=720]+bestaudio/best[height<=720]'; // Default 720p
        if (quality === '360p') format = 'bestvideo[height<=360]+bestaudio/best[height<=360]';
        if (quality === '1080p') format = 'bestvideo[height<=1080]+bestaudio/best[height<=1080]';
        
        return {
            format: format,
            mergeOutputFormat: 'mp4'
        };
    }
};

const downloadThumbnail = async (url, outputPath) => {
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });
        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        console.error('Error downloading thumbnail:', error);
        return null;
    }
};

module.exports = {
    getMetadata,
    downloadMedia,
    getDownloadOptions,
    downloadThumbnail
};
