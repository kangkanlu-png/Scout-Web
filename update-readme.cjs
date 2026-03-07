const fs = require('fs');
let readme = fs.readFileSync('README.md', 'utf8');

readme = readme.replace(
  /-\s*\[ \] 活動管理跟公告管理的功能類似，能否整合/,
  '- [x] 活動管理跟公告管理的功能類似，已整合 (新增「屬性」區分 一般活動/報名活動/最新公告)'
);
readme = readme.replace(
  /-\s*\[ \] 活動報名功能，要能區分哪些是公告，哪些是報名，兩者分開有專門頁面/,
  '- [x] 活動報名功能，已區分公告與報名，兩者分開有專門頁面 (`/announcements`, `/activities`)'
);
readme = readme.replace(
  /-\s*\[ \] 在後台管理可以知道哪些人報名/,
  '- [x] 在後台管理可以知道哪些人報名 (整合於活動管理的「報名」按鈕中)'
);
readme = readme.replace(
  /-\s*\[ \] 執行完的活動，加上照片後按下結案，可以依不同分類項目移到精彩活動/,
  '- [x] 執行完的活動，可於列表點擊「結案並移至精彩活動」按鈕，將活動移至精彩回顧'
);

fs.writeFileSync('README.md', readme);
