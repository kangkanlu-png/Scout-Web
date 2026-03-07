const fs = require('fs');
const file = 'src/routes/frontend.tsx';
let code = fs.readFileSync(file, 'utf8');

const igSection = `
      <!-- IG Section -->
      <section class="mb-16">
        <div class="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-2xl shadow-lg p-1">
          <div class="bg-white rounded-xl p-8 text-center">
            <i class="fab fa-instagram text-5xl text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 mb-4"></i>
            <h2 class="text-2xl font-bold text-gray-800 mb-2">追蹤我們的 Instagram</h2>
            <p class="text-gray-600 mb-6">獲取最新活動照片與童軍日常動態！</p>
            <a href="https://www.instagram.com/kcis.lk_scouts/" target="_blank" class="inline-block px-8 py-3 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white font-bold rounded-full hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300">
              @kcis.lk_scouts
            </a>
          </div>
        </div>
      </section>
`;

if (!code.includes('<!-- IG Section -->')) {
  code = code.replace('<!-- Footer -->', igSection + '\n      <!-- Footer -->');
  fs.writeFileSync(file, code);
  console.log('Added IG section');
} else {
  console.log('IG section already exists');
}
