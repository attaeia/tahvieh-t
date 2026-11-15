/**
 * PayeshProposalGenerator - Fast, Memory-Safe PDF Proposal Builder
 * Fixes out-of-memory errors by compressing images before embedding and revoking ObjectURLs.
 */
const PayeshProposalGenerator = (() => {

    /**
     * Compresses an image File/Blob/DataURL to a lightweight JPEG ArrayBuffer
     * Prevents pdf-lib from crashing due to high-res camera photos.
     */
    function compressImageToJpegBuffer(imageSource, maxWidth = 1000, quality = 0.72) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (!blob) return reject(new Error('Image compression failed'));
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        // Help GC clean up canvas
                        canvas.width = 0;
                        canvas.height = 0;
                        resolve(reader.result);
                    };
                    reader.onerror = reject;
                    reader.readAsArrayBuffer(blob);
                }, 'image/jpeg', quality);
            };
            img.onerror = (err) => reject(err);

            if (imageSource instanceof Blob) {
                const url = URL.createObjectURL(imageSource);
                img.src = url;
            } else {
                img.src = imageSource;
            }
        });
    }

    /**
     * Generates a PDF safely using pdf-lib, caching template in IndexedDB for instant offline speed
     */
    async function generateProposal({
        templateUrl = './proposal-template.pdf',
        outputFilename = 'Payesh-Proposal.pdf',
        drawCallback // async function(pdfDoc, pages, helpers)
    }) {
        if (typeof PDFLib === 'undefined') {
            throw new Error('کتابخانه pdf-lib بارگذاری نشده است.');
        }

        // 1. Load template from IndexedDB cache or fetch & cache it
        let templateBytes = null;
        if (typeof PayeshStorage !== 'undefined') {
            templateBytes = await PayeshStorage.getItem('cached_proposal_template');
        }

        if (!templateBytes) {
            const response = await fetch(templateUrl);
            if (!response.ok) throw new Error(`خطا در دریافت فایل قالب پروپوزال: ${response.status}`);
            templateBytes = await response.arrayBuffer();
            if (typeof PayeshStorage !== 'undefined') {
                await PayeshStorage.setItem('cached_proposal_template', templateBytes);
            }
        }

        // 2. Load PDFDocument
        const pdfDoc = await PDFLib.PDFDocument.load(templateBytes, {
            ignoreEncryption: true
        });

        const pages = pdfDoc.getPages();

        // Helper utilities passed to your drawing function
        const helpers = {
            embedCompressedImage: async (imageSource, maxWidth = 1000, quality = 0.72) => {
                const jpegBuffer = await compressImageToJpegBuffer(imageSource, maxWidth, quality);
                return await pdfDoc.embedJpg(jpegBuffer);
            }
        };

        // 3. Execute custom form/text/image drawing logic
        if (typeof drawCallback === 'function') {
            await drawCallback(pdfDoc, pages, helpers);
        }

        // 4. Serialize & Trigger Download with immediate memory cleanup
        const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const downloadUrl = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = outputFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Revoke URL after 10 seconds to free RAM
        setTimeout(() => {
            URL.revokeObjectURL(downloadUrl);
        }, 10000);

        return true;
    }

    return {
        compressImageToJpegBuffer,
        generateProposal
    };
})();