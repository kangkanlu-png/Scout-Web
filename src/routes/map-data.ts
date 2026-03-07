export const countryCoords: Record<string, [number,number]> = {
    // 東亞
    '台灣': [835, 195], '中國': [780, 160], '日本': [870, 160], '韓國': [840, 155],
    '香港': [815, 195],
    // 東南亞
    '新加坡': [795, 235], '馬來西亞': [785, 225], '泰國': [780, 210],
    '菲律賓': [840, 210], '越南': [800, 205], '印尼': [810, 250],
    // 南亞
    '印度': [720, 200],
    // 中東
    '以色列': [565, 175], '伊朗': [610, 165], '沙烏地阿拉伯': [590, 195], '土耳其': [560, 150],
    // 中亞/俄羅斯
    '俄羅斯': [670, 100],
    // 歐洲
    '英國': [475, 115], '德國': [500, 120], '法國': [485, 130],
    '荷蘭': [490, 115], '瑞典': [510, 95], '丹麥': [500, 105],
    '波蘭': [515, 115], '奧地利': [510, 125], '瑞士': [495, 130],
    '比利時': [485, 120], '義大利': [505, 140], '西班牙': [470, 145],
    // 非洲
    '埃及': [550, 180], '南非': [540, 310],
    // 北美洲
    '美國': [200, 145], '加拿大': [200, 100], '墨西哥': [190, 190],
    // 南美洲
    '巴西': [320, 270], '阿根廷': [300, 330],
    // 大洋洲
    '澳洲': [850, 320], '紐西蘭': [920, 350]
}

export const countryFlags: Record<string, string> = {
  '台灣': '🇹🇼', '中國': '🇨🇳', '日本': '🇯🇵', '韓國': '🇰🇷', '美國': '🇺🇸',
  '加拿大': '🇨🇦', '英國': '🇬🇧', '德國': '🇩🇪', '法國': '🇫🇷', '澳洲': '🇦🇺',
  '紐西蘭': '🇳🇿', '新加坡': '🇸🇬', '馬來西亞': '🇲🇾', '泰國': '🇹🇭', '香港': '🇭🇰',
  '義大利': '🇮🇹', '西班牙': '🇪🇸', '荷蘭': '🇳🇱', '瑞典': '🇸🇪', '丹麥': '🇩🇰',
  '波蘭': '🇵🇱', '奧地利': '🇦🇹', '瑞士': '🇨🇭', '比利時': '🇧🇪', '印度': '🇮🇳',
  '巴西': '🇧🇷', '阿根廷': '🇦🇷', '墨西哥': '🇲🇽', '俄羅斯': '🇷🇺', '土耳其': '🇹🇷',
  '菲律賓': '🇵🇭', '越南': '🇻🇳', '印尼': '🇮🇩', '以色列': '🇮🇱', '伊朗': '🇮🇷',
  '沙烏地阿拉伯': '🇸🇦', '埃及': '🇪🇬', '南非': '🇿🇦'
}

export const googleMapsQuery: Record<string, string> = {
  '台灣': 'Taiwan', '中國': 'China', '日本': 'Japan', '韓國': 'South+Korea', '美國': 'United+States',
  '加拿大': 'Canada', '英國': 'United+Kingdom', '德國': 'Germany', '法國': 'France', '澳洲': 'Australia',
  '紐西蘭': 'New+Zealand', '新加坡': 'Singapore', '馬來西亞': 'Malaysia', '泰國': 'Thailand', '香港': 'Hong+Kong',
  '義大利': 'Italy', '西班牙': 'Spain', '荷蘭': 'Netherlands', '瑞典': 'Sweden', '丹麥': 'Denmark',
  '波蘭': 'Poland', '奧地利': 'Austria', '瑞士': 'Switzerland', '比利時': 'Belgium', '印度': 'India',
  '巴西': 'Brazil', '阿根廷': 'Argentina', '墨西哥': 'Mexico', '俄羅斯': 'Russia', '土耳其': 'Turkey',
  '菲律賓': 'Philippines', '越南': 'Vietnam', '印尼': 'Indonesia', '以色列': 'Israel', '伊朗': 'Iran',
  '沙烏地阿拉伯': 'Saudi+Arabia', '埃及': 'Egypt', '南非': 'South+Africa'
}

export function generateRoverMapHtml(roverCountries: string[], roverCountryMap: any, sectionColors: any) {
  const mapDots = roverCountries.map(country => {
    const coords = countryCoords[country]
    if (!coords) return ''
    const [x, y] = coords
    const cnt = roverCountryMap[country].count
    const r = Math.max(6, Math.min(18, 6 + cnt * 2))
    const color = sectionColors['羅浮童軍'] || '#a855f7'
    const flag = countryFlags[country] || ''
    const members = roverCountryMap[country].members.join('、')
    return `<g class="map-dot-group" data-country="${country}" style="cursor:pointer" onclick="highlightCountry('${country}')">
      <circle cx="${x}" cy="${y}" r="${r}" fill="${color}" fill-opacity="0.8" stroke="white" stroke-width="2"/>
      <circle cx="${x}" cy="${y}" r="${r + 4}" fill="${color}" fill-opacity="0.2"/>
      ${cnt > 1 ? `<text x="${x}" y="${y + 4}" text-anchor="middle" fill="white" font-size="9" font-weight="bold">${cnt}</text>` : ''}
      <title>${flag} ${country}: ${members}</title>
    </g>`
  }).join('')

  const roverCountryCards = roverCountries.map(c => {
    const data = roverCountryMap[c]
    const flag = countryFlags[c] || '🌍'
    return `<div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
      <div class="flex justify-between items-start mb-2">
        <div class="flex items-center gap-2">
          <span class="text-2xl">${flag}</span>
          <h3 class="font-bold text-gray-800 text-lg">${c}</h3>
        </div>
        <span class="bg-purple-100 text-purple-700 text-xs font-bold px-2.5 py-1 rounded-full">${data.count} 人</span>
      </div>
      <div class="text-sm text-gray-600 mt-2 space-y-1">
        ${data.members.map((m: string) => `<div class="flex items-start gap-1"><span class="text-purple-400 mt-0.5">•</span> <span>${m}</span></div>`).join('')}
      </div>
    </div>`
  }).join('')

  return `
    <div class="mb-6">
      <h2 class="text-xl font-bold text-gray-800 mb-1">🌍 羅浮群全球分佈</h2>
      <p class="text-sm text-gray-500">共 ${roverCountries.reduce((s,c)=>s+roverCountryMap[c].count,0)} 位在籍羅浮童軍，分佈於 ${roverCountries.length} 個地區</p>
    </div>
    ${roverCountries.length > 0 ? `
    <!-- SVG 世界地圖 -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
      <div class="p-4 border-b bg-gray-50 flex justify-between items-center flex-wrap gap-2">
        <h3 class="font-semibold text-gray-700 flex items-center gap-2">
          <svg class="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          成員分佈地圖
        </h3>
        <div class="flex gap-1 flex-wrap" id="map-region-filters">
          ${roverCountries.map(c => {
            const flag = countryFlags[c] || ''
            return `<button type="button" 
              class="map-country-btn text-xs px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-all flex items-center gap-1"
              data-country="${c}">
              ${flag} ${c}
              <span class="font-semibold text-purple-600 ml-0.5">${roverCountryMap[c].count}</span>
            </button>`
          }).join('')}
        </div>
      </div>
      <!-- SVG 精確世界地圖 -->
      <div class="relative" style="padding-bottom:42.87%;background:#000">
        <svg id="world-svg" viewBox="0 0 1024 439" class="absolute inset-0 w-full h-full" style="background:#000">
          <image href="/static/8Wyfoby3.jpg" x="0" y="0" width="1024" height="439" />
          <!-- ===== 標記點（人員位置）===== -->
          ${mapDots}
        </svg>
      </div>
      <!-- 選中國家資訊 -->
      <div id="map-info-panel" class="p-4 border-t bg-gradient-to-r from-purple-50 to-blue-50 hidden">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span id="info-flag" class="text-3xl"></span>
              <div>
                <h4 id="info-name" class="font-bold text-gray-800 text-lg"></h4>
                <p id="info-count" class="text-sm text-purple-600 font-semibold"></p>
              </div>
            </div>
            <ul id="info-members" class="text-sm text-gray-600 space-y-0.5"></ul>
          </div>
          <a id="info-map-link" href="#" target="_blank" rel="noopener"
             class="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline mt-1 flex-shrink-0">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            Google Maps
          </a>
        </div>
      </div>
    </div>
    <!-- 國家卡片列表 -->
    <div class="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
      ${roverCountryCards}
    </div>` : `
    <div class="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
      <div class="text-5xl mb-4">✈️</div>
      <h3 class="text-xl font-bold text-gray-700 mb-2">尚無海外羅浮資料</h3>
      <p class="text-gray-500">目前沒有登錄在海外的羅浮童軍成員</p>
    </div>`}
  `
}

export const mapScript = `
    function highlightCountry(country) {
      document.querySelectorAll('.map-dot-group circle:first-child').forEach(c => c.setAttribute('stroke-width', '2'));
      const activeGroup = document.querySelector(\`.map-dot-group[data-country="\${country}"]\`);
      if (activeGroup) {
        activeGroup.querySelector('circle').setAttribute('stroke-width', '4');
        activeGroup.parentNode.appendChild(activeGroup);
      }
      
      const panel = document.getElementById('map-info-panel');
      if (!panel || typeof ROVER_COUNTRY_MAP === 'undefined') return;
      
      const data = ROVER_COUNTRY_MAP[country];
      if (!data) return;
      
      panel.classList.remove('hidden');
      document.getElementById('info-flag').textContent = COUNTRY_FLAGS[country] || '🌍';
      document.getElementById('info-name').textContent = country;
      document.getElementById('info-count').textContent = '共 ' + data.count + ' 人';
      document.getElementById('info-members').innerHTML = data.members.map(m => \`<li><span class="text-purple-400 mr-1">•</span>\${m}</li>\`).join('');
      
      const query = GOOGLE_MAPS_QUERY[country] || country;
      document.getElementById('info-map-link').href = 'https://www.google.com/maps/search/?api=1&query=' + query;
      
      document.querySelectorAll('.map-country-btn').forEach(b => {
        if (b.dataset.country === country) {
          b.classList.add('bg-purple-100', 'border-purple-300');
        } else {
          b.classList.remove('bg-purple-100', 'border-purple-300');
        }
      });
    }

    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('.map-country-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          highlightCountry(btn.dataset.country);
          const svg = document.getElementById('world-svg');
          if(svg) svg.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });
    });
`
