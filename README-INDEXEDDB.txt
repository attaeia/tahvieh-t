راهنمای نصب و جایگزینی ماژول‌های بهینه‌سازی دستیار پایش الکترونیک
=================================================================

این بسته شامل فایل‌های ارتقایافته برای رفع محدودیت حافظه ۱۰ مگابایتی، افزایش سرعت اجرا و رفع خطای ساخت پروپوزال PDF است:

۱. فایل payesh-storage.js (افزایش حافظه از ۱۰ مگابایت به چند گیگابایت):
- این فایل را جایگزین فایل قبلی در پوشه پروژه کنید.
- به جای localStorage از IndexedDB استفاده می‌کند و به صورت خودکار داده‌های قبلی شما را منتقل (Migrate) می‌کند.
- روش استفاده در کدهای برنامه:
  * ذخیره: await PayeshStorage.setItem('projects', data);
  * خواندن: const data = await PayeshStorage.getItem('projects', []);
  * انتقال خودکار داده‌های قدیمی هنگام لود صفحه: await PayeshStorage.migrateFromLocalStorage();

۲. فایل proposal-generator.js (رفع خطای حافظه هنگام ساخت پروپوزال):
- این فایل را در پوشه پروژه قرار دهید و در index.html فراخوانی کنید:
  <script src="./proposal-generator.js"></script>
- ویژگی‌ها:
  * تصاویر و امضاهای آپلودشده را قبل از قرار دادن در PDF به صورت خودکار فشرده می‌کند تا مرورگر دچار کمبود RAM و کرش نشود.
  * فایل proposal-template.pdf را در IndexedDB کش می‌کند تا ساخت پروپوزال در دفعات بعدی در کسری از ثانیه انجام شود.
  * حافظه رم را پس از دانلود PDF آزاد می‌کند.
- نمونه فراخوانی:
  await PayeshProposalGenerator.generateProposal({
      templateUrl: './proposal-template.pdf',
      outputFilename: 'Proposal.pdf',
      drawCallback: async (pdfDoc, pages, helpers) => {
          // برای درج عکس فشرده‌شده:
          // const jpgImage = await helpers.embedCompressedImage(userPhotoFile);
          // pages[0].drawImage(jpgImage, { x: 50, y: 100, width: 200, height: 150 });
      }
  });

۳. فایل sw.js (افزایش سرعت بارگذاری و اجرای آفلاین):
- جایگزین فایل sw.js قبلی کنید. فایل‌های سنگین مثل pdf-lib.min.js و proposal-template.pdf را در کش نگه می‌دارد تا سرعت باز شدن برنامه و ساخت PDF به حداکثر برسد.