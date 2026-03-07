const fs = require('fs');
const file = 'src/routes/frontend.tsx';
let code = fs.readFileSync(file, 'utf8');

// Update navBar
const oldNavDesktop = `        <!-- 桌面版選單 -->
        <div class="hidden lg:flex items-center gap-4 text-sm">
          <a href="/#about" class="hover:text-amber-300 transition-colors">關於我們</a>
          <a href="/#groups" class="hover:text-amber-300 transition-colors">分組</a>
          <a href="/announcements" class="hover:text-amber-300 transition-colors">📢 公告</a>
          <a href="/activities" class="hover:text-amber-300 transition-colors">📅 活動報名</a>
          <a href="/highlights" class="hover:text-amber-300 transition-colors">📸 精彩回顧</a>
          <a href="/honor" class="hover:text-amber-300 transition-colors">🏅 榮譽榜</a>
          <a href="/group/senior-scout/coaches-list" class="hover:text-amber-300 transition-colors">🧢 教練團</a>
          <a href="/stats" class="hover:text-amber-300 transition-colors">📊 統計</a>
          <a href="/links" class="hover:text-amber-300 transition-colors">🔗 相關網頁</a>`;

const newNavDesktop = `        <!-- 桌面版選單 -->
        <div class="hidden lg:flex items-center gap-4 text-sm">
          <div class="relative group">
            <a href="/#about" class="hover:text-amber-300 transition-colors flex items-center gap-1 py-2">關於我們 ▾</a>
            <div class="absolute left-0 mt-0 w-32 bg-white rounded-md shadow-lg py-1 hidden group-hover:block text-gray-800 border border-gray-100">
              <a href="/about/scout" class="block px-4 py-2 hover:bg-green-50 hover:text-green-700 transition-colors">認識童軍</a>
              <a href="/about/leaders" class="block px-4 py-2 hover:bg-green-50 hover:text-green-700 transition-colors">服務員介紹</a>
            </div>
          </div>
          <a href="/activities" class="hover:text-amber-300 transition-colors">📅 活動報名</a>
          <a href="/honor" class="hover:text-amber-300 transition-colors">🏅 榮譽榜</a>
          <a href="/highlights" class="hover:text-amber-300 transition-colors">📸 精彩回顧</a>
          <a href="/stats" class="hover:text-amber-300 transition-colors">📊 統計資料</a>
          <a href="/links" class="hover:text-amber-300 transition-colors">🔗 相關網頁</a>`;

code = code.replace(oldNavDesktop, newNavDesktop);

// Update navBar Mobile
const oldNavMobile = `      <!-- 手機版下拉選單 (預設隱藏) -->
      <div id="mobile-menu" class="hidden lg:hidden mt-3 pb-2 border-t border-[#2d6a4f] pt-3">
        <div class="flex flex-col space-y-3 text-sm">
          <a href="/#about" class="hover:text-amber-300 transition-colors px-2">關於我們</a>
          <a href="/#groups" class="hover:text-amber-300 transition-colors px-2">分組</a>
          <a href="/#activities" class="hover:text-amber-300 transition-colors px-2">活動</a>
          <a href="/highlights" class="hover:text-amber-300 transition-colors px-2">📸 精彩回顧</a>
          <a href="/honor" class="hover:text-amber-300 transition-colors px-2">🏅 榮譽榜</a>
          <a href="/group/senior-scout/coaches-list" class="hover:text-amber-300 transition-colors px-2">🧢 教練團</a>
          <a href="/stats" class="hover:text-amber-300 transition-colors px-2">📊 統計</a>
          <a href="/links" class="hover:text-amber-300 transition-colors px-2">🔗 相關網頁</a>`;

const newNavMobile = `      <!-- 手機版下拉選單 (預設隱藏) -->
      <div id="mobile-menu" class="hidden lg:hidden mt-3 pb-2 border-t border-[#2d6a4f] pt-3">
        <div class="flex flex-col space-y-3 text-sm">
          <div class="px-2 font-bold text-amber-300">關於我們</div>
          <a href="/about/scout" class="hover:text-amber-300 transition-colors pl-6">認識童軍</a>
          <a href="/about/leaders" class="hover:text-amber-300 transition-colors pl-6">服務員介紹</a>
          <a href="/activities" class="hover:text-amber-300 transition-colors px-2">📅 活動報名</a>
          <a href="/honor" class="hover:text-amber-300 transition-colors px-2">🏅 榮譽榜</a>
          <a href="/highlights" class="hover:text-amber-300 transition-colors px-2">📸 精彩回顧</a>
          <a href="/stats" class="hover:text-amber-300 transition-colors px-2">📊 統計資料</a>
          <a href="/links" class="hover:text-amber-300 transition-colors px-2">🔗 相關網頁</a>`;

code = code.replace(oldNavMobile, newNavMobile);

// Update renderHomePage layout
// We need to reorder: About, Groups, Announcements, Activities, Highlights
const homePageLayoutStart = `  <div class="max-w-6xl mx-auto px-4 py-10">`;

// Extract parts
const annMatch = code.match(/\s*\$\{announcementsHtml\}/);
const annHtml = annMatch ? annMatch[0] : '';
code = code.replace(/\s*\$\{announcementsHtml\}/, '');

const aboutRegex = /    <!-- 關於我們.*?<\/section>/s;
const groupsRegex = /    <!-- 童軍分組.*?<\/section>/s;
const activitiesRegex = /    <!-- 活動記錄.*?<\/section>/s;

const aboutMatch = code.match(aboutRegex);
const groupsMatch = code.match(groupsRegex);
const activitiesMatch = code.match(activitiesRegex);

if (aboutMatch && groupsMatch && activitiesMatch) {
  // Replace the original sections with a marker
  code = code.replace(aboutMatch[0], '%%ABOUT%%');
  code = code.replace(groupsMatch[0], '%%GROUPS%%');
  code = code.replace(activitiesMatch[0], '%%ACTIVITIES%%');

  // Change "活動記錄" title to "活動報名"
  let activitiesFixed = activitiesMatch[0].replace(
    '<i class="fas fa-campground text-[#1a472a]"></i> 活動記錄',
    '<i class="fas fa-campground text-[#1a472a]"></i> 活動報名'
  );
  
  // Reconstruct in desired order
  const newOrder = aboutMatch[0] + '\n\n' + groupsMatch[0] + '\n\n' + annHtml + '\n\n' + activitiesFixed;
  
  // Replace the first marker with the new order
  code = code.replace('%%ABOUT%%', newOrder);
  code = code.replace('%%GROUPS%%', '');
  code = code.replace('%%ACTIVITIES%%', '');
}

fs.writeFileSync(file, code);
console.log('Patched nav and home layout');
