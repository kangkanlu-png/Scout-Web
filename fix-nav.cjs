const fs = require('fs');
let code = fs.readFileSync('src/routes/frontend.tsx', 'utf8');

const oldNav = `function navBar(settings: Record<string, string>, groups: any[] = []) {
  return \`
  <nav class="bg-[#1a472a] text-white shadow-lg sticky top-0 z-50">
    <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <a href="/" class="flex items-center gap-3 hover:opacity-90 transition-opacity">
        <span class="text-2xl">⚜️</span>
        <div>
          <div class="font-bold text-base leading-tight">林口康橋圓桌武士童軍團</div>
          <div class="text-xs text-green-200">KCISLK Excalibur Knights Scout Groups</div>
        </div>
      </a>
      <div class="flex items-center gap-4 text-sm">
        <a href="/#about" class="hover:text-amber-300 transition-colors hidden md:inline">關於我們</a>
        <a href="/#groups" class="hover:text-amber-300 transition-colors hidden md:inline">分組</a>
        <a href="/#activities" class="hover:text-amber-300 transition-colors hidden md:inline">活動</a>
        <a href="/highlights" class="hover:text-amber-300 transition-colors hidden md:inline">📸 精彩回顧</a>
        <a href="/honor" class="hover:text-amber-300 transition-colors hidden md:inline">🏅 榮譽榜</a>
        <a href="/group/senior-scout/coaches-list" class="hover:text-amber-300 transition-colors hidden md:inline">🧢 教練團</a>
        <a href="/stats" class="hover:text-amber-300 transition-colors hidden md:inline">📊 統計</a>
        <a href="/links" class="hover:text-amber-300 transition-colors hidden md:inline">🔗 相關網頁</a>
        <a href="/member" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">👤 會員入口</a>
        <a href="/admin" class="bg-amber-500 hover:bg-amber-400 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">⚙ 後台管理</a>
      </div>
    </div>
  </nav>\`
}`;

const newNav = `function navBar(settings: Record<string, string>, groups: any[] = []) {
  return \`
  <nav class="bg-[#1a472a] text-white shadow-lg sticky top-0 z-50">
    <div class="max-w-6xl mx-auto px-4 py-3">
      <div class="flex items-center justify-between">
        <a href="/" class="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <span class="text-2xl">⚜️</span>
          <div>
            <div class="font-bold text-base leading-tight">林口康橋圓桌武士童軍團</div>
            <div class="text-xs text-green-200">KCISLK Excalibur Knights Scout Groups</div>
          </div>
        </a>
        
        <!-- 桌面版選單 -->
        <div class="hidden lg:flex items-center gap-4 text-sm">
          <a href="/#about" class="hover:text-amber-300 transition-colors">關於我們</a>
          <a href="/#groups" class="hover:text-amber-300 transition-colors">分組</a>
          <a href="/#activities" class="hover:text-amber-300 transition-colors">活動</a>
          <a href="/highlights" class="hover:text-amber-300 transition-colors">📸 精彩回顧</a>
          <a href="/honor" class="hover:text-amber-300 transition-colors">🏅 榮譽榜</a>
          <a href="/group/senior-scout/coaches-list" class="hover:text-amber-300 transition-colors">🧢 教練團</a>
          <a href="/stats" class="hover:text-amber-300 transition-colors">📊 統計</a>
          <a href="/links" class="hover:text-amber-300 transition-colors">🔗 相關網頁</a>
          <div class="flex gap-2 ml-2">
            <a href="/member" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">👤 會員入口</a>
            <a href="/admin" class="bg-amber-500 hover:bg-amber-400 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">⚙ 後台管理</a>
          </div>
        </div>

        <!-- 手機版選單按鈕與主要入口 (隱藏於桌面版) -->
        <div class="flex lg:hidden items-center gap-2">
          <a href="/member" class="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors">會員入口</a>
          <a href="/admin" class="bg-amber-500 hover:bg-amber-400 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors">後台</a>
          <button id="mobile-menu-btn" class="p-2 ml-1 text-white hover:bg-[#2d6a4f] rounded-lg transition-colors focus:outline-none">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
        </div>
      </div>
      
      <!-- 手機版下拉選單 (預設隱藏) -->
      <div id="mobile-menu" class="hidden lg:hidden mt-3 pb-2 border-t border-[#2d6a4f] pt-3">
        <div class="flex flex-col space-y-3 text-sm">
          <a href="/#about" class="hover:text-amber-300 transition-colors px-2">關於我們</a>
          <a href="/#groups" class="hover:text-amber-300 transition-colors px-2">分組</a>
          <a href="/#activities" class="hover:text-amber-300 transition-colors px-2">活動</a>
          <a href="/highlights" class="hover:text-amber-300 transition-colors px-2">📸 精彩回顧</a>
          <a href="/honor" class="hover:text-amber-300 transition-colors px-2">🏅 榮譽榜</a>
          <a href="/group/senior-scout/coaches-list" class="hover:text-amber-300 transition-colors px-2">🧢 教練團</a>
          <a href="/stats" class="hover:text-amber-300 transition-colors px-2">📊 統計</a>
          <a href="/links" class="hover:text-amber-300 transition-colors px-2">🔗 相關網頁</a>
        </div>
      </div>
    </div>
  </nav>
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const btn = document.getElementById('mobile-menu-btn');
      const menu = document.getElementById('mobile-menu');
      if (btn && menu) {
        btn.addEventListener('click', () => {
          menu.classList.toggle('hidden');
        });
      }
    });
  </script>\`
}`;

code = code.replace(oldNav, newNav);
fs.writeFileSync('src/routes/frontend.tsx', code);
