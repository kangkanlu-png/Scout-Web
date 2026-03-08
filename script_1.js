
      const CURRENT_YEAR = '115';
      let existingMembers = [];
      let existingSelected = new Set();
      let csvData = [];

      // ===== 職位動態篩選資料 =====
      const ROLES_BY_SECTION = {"童軍":["隊員","小隊長","副小隊長","群長","副群長","群顧問","服務員","童軍團器材長","副器材長","行政長","副行政長","考驗營總協","器材組員","行政組員","公關組長","副公關組長","公關組員","展演組長","副展演組長","活動組長","副活動組長","團長"],"行義童軍":["隊員","小隊長","副小隊長","群長","副群長","群顧問","服務員","聯隊長","副聯隊長","團長","副團長","教練團主席","總團長"],"羅浮童軍":["隊員","小隊長","副小隊長","群長","副群長","群顧問","服務員","團長","羅浮團長","羅浮副團長"],"服務員":["隊員","小隊長","副小隊長","群長","副群長","群顧問","服務員","團長","群長","副群長","組長","服務員"]};

      function updateRolesBySection(sectionId, roleSelectId, currentVal) {
        const section = document.getElementById(sectionId)?.value || '';
        const sel = document.getElementById(roleSelectId);
        if (!sel) return;
        const roles = ROLES_BY_SECTION[section] || [];
        const prev = currentVal || sel.value;
        sel.innerHTML = '<option value="">請選擇...</option>' +
          roles.map(r => `<option value="${r}" ${r===prev?'selected':''}>${r}</option>`).join('');
      }

      // 監聽新增表單的 section 變更
      document.addEventListener('DOMContentLoaded', () => {
        const addSection = document.getElementById('add-section');
        if (addSection) {
          addSection.addEventListener('change', () => updateRolesBySection('add-section', 'add-role_name', ''));
          updateRolesBySection('add-section', 'add-role_name', '');
        }
        const editSection = document.getElementById('edit-section');
        if (editSection) {
          editSection.addEventListener('change', () => updateRolesBySection('edit-section', 'edit-role_name', ''));
        }
      });

      function changeYear(y) {
        window.location.href = '/admin/members?year=' + y;
      }

      function addNewYear() {
        // 取得目前選單顯示的年度，計算下一年
        const sel = document.getElementById('year-select');
        const viewingYear = sel ? parseInt(sel.value) : parseInt(CURRENT_YEAR);
        const nextYear = viewingYear + 1;
        if (confirm('確定要新增 ' + nextYear + ' 年度嗎？\n系統將切換到 ' + nextYear + ' 學年，您可以開始匯入或加入成員。')) {
          fetch('/api/settings', {
            method: 'PUT', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ current_year_label: String(nextYear) })
          }).then(r => {
            if (r.ok) {
              window.location.href = '/admin/members?year=' + nextYear;
            } else {
              alert('新增年度失敗，請稍後再試');
            }
          }).catch(() => alert('網路錯誤，請稍後再試'));
        }
      }

      async function rejoinMember(memberId, name) {
        if (!confirm('確定要將「' + name + '」加入 ' + CURRENT_YEAR + ' 年度？')) return;
        const res = await fetch('/api/enrollments/batch', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ year_label: CURRENT_YEAR, member_ids: [memberId], copy_from_prev: true })
        });
        if (res.ok) {
          alert('已成功復團！');
          location.reload();
        } else {
          alert('復團失敗');
        }
      }

      // ===== 沿用舊資料 =====
      async function openAddExisting() {
        document.getElementById('add-existing-modal').classList.remove('hidden');
        existingSelected = new Set();
        updateExistingCount();
        const res = await fetch('/api/enrollments/available?year=' + CURRENT_YEAR);
        const json = await res.json();
        existingMembers = json.data || [];
        renderExistingList(existingMembers);
      }

      function filterExisting() {
        const q = document.getElementById('existing-search').value.toLowerCase();
        const filtered = existingMembers.filter(m =>
          m.chinese_name.includes(q) || (m.english_name||'').toLowerCase().includes(q)
        );
        renderExistingList(filtered);
      }

      function renderExistingList(list) {
        const container = document.getElementById('existing-list');
        if (!list.length) {
          container.innerHTML = '<div class="text-center text-gray-400 py-8">無可沿用的舊成員（所有人均已在本年度名冊中）</div>';
          return;
        }
        const sectionColor = {童軍:'bg-green-100 text-green-700',行義童軍:'bg-blue-100 text-blue-700',羅浮童軍:'bg-purple-100 text-purple-700',服務員:'bg-gray-100 text-gray-600'};
        container.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 gap-2">' +
          list.map(m => {
            const sel = existingSelected.has(m.id);
            return '<div onclick="toggleExisting(this.dataset.id)" data-id="' + m.id + '" class="p-3 border rounded-lg cursor-pointer flex items-center gap-3 hover:bg-blue-50 transition ' + (sel ? 'bg-blue-50 border-blue-400' : 'bg-white') + '">' +
              '<div class="w-5 h-5 border-2 rounded flex items-center justify-center flex-shrink-0 ' + (sel ? 'bg-blue-600 border-blue-600' : 'border-gray-300') + '">' +
              (sel ? '<span class="text-white text-xs font-bold">✓</span>' : '') + '</div>' +
              '<div class="flex-1 min-w-0">' +
              '<div class="font-medium text-sm">' + m.chinese_name + '</div>' +
              '<div class="text-xs text-gray-500 flex gap-2 flex-wrap mt-0.5">' +
              (m.last_section ? '<span class="' + (sectionColor[m.last_section]||'bg-gray-100 text-gray-600') + ' px-1.5 py-0.5 rounded">' + m.last_section + '</span>' : '') +
              (m.last_unit ? '<span class="text-gray-400">' + m.last_unit + '</span>' : '') +
              (m.last_year ? '<span class="text-gray-300">(' + m.last_year + '學年)</span>' : '') +
              '</div></div></div>';
          }).join('') + '</div>';
      }

      function toggleExisting(id) {
        if (existingSelected.has(id)) existingSelected.delete(id);
        else existingSelected.add(id);
        updateExistingCount();
        renderExistingList(existingMembers.filter(m => {
          const q = document.getElementById('existing-search').value.toLowerCase();
          return m.chinese_name.includes(q) || (m.english_name||'').toLowerCase().includes(q);
        }));
      }

      function updateExistingCount() {
        document.getElementById('existing-selected-count').textContent = '已選擇 ' + existingSelected.size + ' 人';
      }

      async function confirmAddExisting() {
        if (!existingSelected.size) return alert('請先勾選成員');
        const res = await fetch('/api/enrollments/batch', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ year_label: CURRENT_YEAR, member_ids: Array.from(existingSelected), copy_from_prev: true })
        });
        const json = await res.json();
        if (res.ok && json.success) {
          alert('已加入 ' + json.added + ' 位成員！');
          location.reload();
        } else { alert('加入失敗：' + (json.error||'未知錯誤')); }
      }

      // ===== 新增成員 =====
      async function saveNewMember() {
        const data = {
          year_label: CURRENT_YEAR,
          chinese_name: document.getElementById('add-chinese_name').value.trim(),
          english_name: document.getElementById('add-english_name').value.trim(),
          gender: document.getElementById('add-gender').value,
          national_id: document.getElementById('add-national_id').value.trim().toUpperCase(),
          dob: document.getElementById('add-dob').value || null,
          phone: document.getElementById('add-phone').value.trim(),
          email: document.getElementById('add-email').value.trim(),
          parent_name: document.getElementById('add-parent_name').value.trim(),
          country: document.getElementById('add-country').value.trim(),
          university: document.getElementById('add-university').value.trim(),
          section: document.getElementById('add-section').value,
          unit_name: document.getElementById('add-unit_name').value,
          role_name: document.getElementById('add-role_name').value,
          rank_level: document.getElementById('add-rank_level').value,
          membership_status: document.getElementById('add-membership_status').value,
          notes: document.getElementById('add-notes').value.trim(),
        };
        if (!data.chinese_name) { alert('請填寫姓名'); return; }
        const res = await fetch('/api/enrollments', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
        const json = await res.json();
        const msg = document.getElementById('add-member-msg');
        if (res.ok && json.success) {
          msg.textContent = '✅ 新增成功！'; msg.className = 'px-5 pb-3 text-sm text-green-600'; msg.classList.remove('hidden');
          setTimeout(() => location.reload(), 800);
        } else {
          msg.textContent = '❌ 失敗：' + (json.error||'未知錯誤'); msg.className = 'px-5 pb-3 text-sm text-red-600'; msg.classList.remove('hidden');
        }
      }

      // ===== 編輯在籍資料 =====
      function openEditEnroll(m) {
        document.getElementById('edit-enroll-id').value = m.enroll_id;
        document.getElementById('edit-enroll-member-id').value = m.member_id;
        document.getElementById('edit-enroll-name').textContent = m.chinese_name + (m.english_name ? ' / ' + m.english_name : '');
        // 基本資料
        document.getElementById('edit-chinese_name').value = m.chinese_name || '';
        document.getElementById('edit-english_name').value = m.english_name || '';
        document.getElementById('edit-gender').value = m.gender || '';
        document.getElementById('edit-national_id').value = m.national_id || '';
        document.getElementById('edit-dob').value = m.dob ? m.dob.split('T')[0] : '';
        document.getElementById('edit-membership_status').value = m.membership_status || 'ACTIVE';
        // 聯絡資訊
        document.getElementById('edit-phone').value = m.phone || '';
        document.getElementById('edit-email').value = m.email || '';
        document.getElementById('edit-parent_name').value = m.parent_name || '';
        document.getElementById('edit-country').value = m.country || '';
        document.getElementById('edit-university').value = m.university || '';
        // 在籍資料
        document.getElementById('edit-section').value = m.section || '童軍';
        document.getElementById('edit-unit_name').value = m.unit_name || '';
        // 先更新職位選單再設定值
        updateRolesBySection('edit-section', 'edit-role_name', m.role_name || '');
        document.getElementById('edit-rank_level').value = m.rank_level || '';
        // 備註
        document.getElementById('edit-notes').value = m.notes || '';
        document.getElementById('edit-enroll-modal').classList.remove('hidden');
      }

      async function saveEditEnroll() {
        const memberId = document.getElementById('edit-enroll-member-id').value;
        const enrollId = document.getElementById('edit-enroll-id').value;
        const section = document.getElementById('edit-section').value;
        const rank_level = document.getElementById('edit-rank_level').value;

        // 1. 更新成員個人資料
        const memberData = {
          chinese_name: document.getElementById('edit-chinese_name').value.trim(),
          english_name: document.getElementById('edit-english_name').value.trim() || null,
          gender: document.getElementById('edit-gender').value || null,
          national_id: document.getElementById('edit-national_id').value.trim().toUpperCase() || null,
          dob: document.getElementById('edit-dob').value || null,
          phone: document.getElementById('edit-phone').value.trim() || null,
          email: document.getElementById('edit-email').value.trim() || null,
          parent_name: document.getElementById('edit-parent_name').value.trim() || null,
          country: document.getElementById('edit-country').value.trim() || null,
          university: document.getElementById('edit-university').value.trim() || null,
          membership_status: document.getElementById('edit-membership_status').value,
          section,
          rank_level,
          unit_name: document.getElementById('edit-unit_name').value || null,
          role_name: document.getElementById('edit-role_name').value || null,
          notes: document.getElementById('edit-notes').value.trim() || null,
        };
        if (!memberData.chinese_name) { alert('請填寫姓名'); return; }

        const r1 = await fetch('/api/members/' + memberId, {
          method: 'PUT',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(memberData)
        });

        // 2. 更新年度在籍資料
        const enrollData = {
          section,
          unit_name: memberData.unit_name,
          role_name: memberData.role_name,
          rank_level,
          notes: memberData.notes,
        };
        const r2 = await fetch('/api/enrollments/' + enrollId, {
          method: 'PUT',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(enrollData)
        });

        if (r1.ok && r2.ok) {
          location.reload();
        } else {
          const err1 = r1.ok ? '' : (await r1.json().catch(()=>({error:'未知'}))).error;
          const err2 = r2.ok ? '' : '在籍資料更新失敗';
          alert('更新失敗：' + [err1, err2].filter(Boolean).join('；'));
        }
      }

      async function removeEnroll(id, name) {
        if (!confirm('確定要將「' + name + '」從本學年度名冊中移除？（成員資料仍保留）')) return;
        const res = await fetch('/api/enrollments/' + id, { method: 'DELETE' });
        if (res.ok) location.reload(); else alert('移除失敗');
      }

      async function deleteMemberFromList() {
        const memberId = document.getElementById('edit-enroll-member-id').value;
        const memberName = document.getElementById('edit-enroll-name').textContent;
        if (!confirm('⚠️ 確定要永久刪除「' + memberName + '」？

此操作將刪除該成員所有資料，包含出席記錄與進程記錄，且不可復原！')) return;
        const res = await fetch('/api/members/' + memberId, { method: 'DELETE' });
        if (res.ok) {
          alert('✅ 已刪除成員：' + memberName);
          location.reload();
        } else {
          alert('❌ 刪除失敗，請稍後再試');
        }
      }

      // ===== CSV / Excel 匯入 =====
      let xlsxLoaded = false;
      async function loadXLSX() {
        if (xlsxLoaded || typeof XLSX !== 'undefined') { xlsxLoaded = true; return; }
        const cdns = [
          '/static/xlsx.full.min.js',
          'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
          'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'
        ];
        for (const src of cdns) {
          try {
            await new Promise((resolve, reject) => {
              const s = document.createElement('script');
              s.src = src;
              s.onload = () => { 
                // Small delay to ensure browser parsed the script
                setTimeout(() => {
                  if (typeof XLSX !== 'undefined') {
                    xlsxLoaded = true; 
                    resolve(); 
                  } else {
                    reject(new Error('XLSX undefined after load'));
                  }
                }, 50);
              };
              s.onerror = reject;
              document.head.appendChild(s);
            });
            if (typeof XLSX !== 'undefined') return;
          } catch(e) { /* next */ }
        }
        throw new Error('無法載入 Excel 解析套件，請確認網路連線後重試');
      }

      // 民國年日期轉換 → 西元 YYYY-MM-DD
      function convertROCDate(raw) {
        if (!raw) return null;
        const s = String(raw).trim();
        if (!s || s === 'None') return null;

        // 已是西元格式 2002-01-15 或 2002/01/15
        if (/^20d{2}[-/]d{1,2}[-/]d{1,2}$/.test(s)) {
          return s.replace(///g, '-').replace(/(d{4})-(d{1,2})-(d{1,2})/, (_, y, m, d) =>
            y + '-' + m.padStart(2,'0') + '-' + d.padStart(2,'0'));
        }

        // 民國年 091/06/14 或 91/06/14
        const slashMatch = s.match(/^(d{2,3})[/](d{1,2})[/](d{1,2})$/);
        if (slashMatch) {
          const roc = parseInt(slashMatch[1]);
          const ad = roc + 1911;
          return ad + '-' + slashMatch[2].padStart(2,'0') + '-' + slashMatch[3].padStart(2,'0');
        }

        // 民國年 91.7.27 or 91.07.27
        const dotMatch = s.match(/^(d{2,3}).(d{1,2}).(d{1,2})$/);
        if (dotMatch) {
          const roc = parseInt(dotMatch[1]);
          const ad = roc + 1911;
          return ad + '-' + dotMatch[2].padStart(2,'0') + '-' + dotMatch[3].padStart(2,'0');
        }

        // 民國年純數字 950705 (6位) 或 9570518 (7位)
        if (/^d{6,7}$/.test(s)) {
          const num = parseInt(s);
          if (s.length === 6) {
            // YYMMDD - 民國兩位年
            const yy = parseInt(s.slice(0,2));
            const mm = s.slice(2,4);
            const dd = s.slice(4,6);
            const ad = yy + 1911;
            return ad + '-' + mm + '-' + dd;
          } else {
            // YYYMMDD - 民國三位年
            const yyy = parseInt(s.slice(0,3));
            const mm = s.slice(3,5);
            const dd = s.slice(5,7);
            const ad = yyy + 1911;
            return ad + '-' + mm + '-' + dd;
          }
        }

        // Excel serial date (數字)
        if (/^d{5}$/.test(s)) {
          const d = new Date((parseInt(s) - 25569) * 86400 * 1000);
          return d.toISOString().split('T')[0];
        }

        // 嘗試直接解析
        const parsed = new Date(s);
        if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900) {
          return parsed.toISOString().split('T')[0];
        }

        return null;
      }

      // 從欄位名稱取值（支援多種欄位名）
      function getField(row, keys, fallback = '') {
        for (const k of keys) {
          if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
            return String(row[k]).trim();
          }
        }
        return fallback;
      }

      // 欄位說明顯示
      function renderImportPreview(headers, data) {
        document.getElementById('csv-count').textContent = data.length;
        // 偵測到的有效欄位
        const knownFieldMap = {
          '姓名': '姓名✓', '英文名': '英文名✓', '英文姓名': '英文姓名✓',
          '身分證號': '身分證✓', '生日': '生日✓', '性別': '性別✓',
          '童軍階段': '階段✓', '組別': '組別✓', '童軍進程': '進程✓', '進程': '進程✓',
          '小隊': '小隊✓', '職務': '職務✓', '職位': '職位✓',
          '電話': '電話✓', '家長姓名': '家長✓', '團次': '團次✓'
        };
        const detected = headers.filter(h => knownFieldMap[h]).map(h => knownFieldMap[h]);
        document.getElementById('csv-fields').textContent = detected.length ? detected.join('、') : '（請確認欄位名稱）';

        document.getElementById('csv-header').innerHTML = headers.map(h =>
          '<th class="px-2 py-1 text-left font-medium ' + (knownFieldMap[h] ? 'text-green-700' : 'text-gray-400') + '">' + h + '</th>'
        ).join('');
        document.getElementById('csv-body').innerHTML = data.slice(0, 5).map(row =>
          '<tr class="border-t">' + headers.map(h => '<td class="px-2 py-1 whitespace-nowrap">' + (row[h]||'-') + '</td>').join('') + '</tr>'
        ).join('');
        document.getElementById('csv-preview').classList.remove('hidden');
        document.getElementById('csv-import-btn').disabled = false;
      }

      async function parseImportFile() {
        const file = document.getElementById('csv-file').files[0];
        if (!file) return;
        csvData = [];
        document.getElementById('csv-preview').classList.add('hidden');
        document.getElementById('csv-import-btn').disabled = true;

        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'xlsx' || ext === 'xls') {
          try {
            await loadXLSX();
          } catch(e) {
            alert('❌ 無法載入 Excel 解析套件：' + e.message + '，請改用 .csv 格式或確認網路連線。');
            return;
          }
          // 用 FileReader (base64) 讀取，相容性優於 arrayBuffer
          const raw = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              try {
                const data = e.target.result;
                // 改用 read array buffer，避免 binary string 在部分瀏覽器或檔案格式的相容性問題
                const wb = XLSX.read(data, { type: 'array', cellDates: false, raw: false });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
                resolve(rows);
              } catch(err) { reject(err); }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
          }).catch(err => {
            alert('❌ Excel 解析失敗：' + err.message);
            return null;
          });

          if (!raw || raw.length < 2) {
            if (raw) alert('⚠️ Excel 內容為空或格式不符');
            return;
          }
          // 找到標題行：某欄位【完全等於】已知欄位名稱（避免說明文字誤判）
          const KNOWN_HEADERS = new Set(['姓名','中文姓名','英文名','英文姓名','身分證號','生日','性別','童軍階段','童軍進程','電話','小隊','職務','團次','Name','Chinese Name']);
          let headerIdx = 0;
          for (let i = 0; i < Math.min(6, raw.length); i++) {
            if (raw[i].some(c => KNOWN_HEADERS.has(String(c).trim()))) {
              headerIdx = i; break;
            }
          }
          const headers = raw[headerIdx].map(h => String(h).trim());
          csvData = raw.slice(headerIdx + 1)
            .filter(row => row.some(c => c !== '' && c !== null && c !== undefined))
            .filter(row => {
              const nameIdx = headers.findIndex(h => h === '姓名' || h === '中文姓名');
              if (nameIdx < 0) return true;
              return row[nameIdx] && String(row[nameIdx]).trim();
            })
            .map(row => {
              const obj = {};
              headers.forEach((h, i) => { obj[h] = row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : ''; });
              return obj;
            });
          if (csvData.length === 0) {
            alert('⚠️ 找不到有效資料列，請確認 Excel 格式：第2列必須是欄位標頭，第3列起為資料。');
            return;
          }
          renderImportPreview(headers, csvData);
        } else {
          const reader = new FileReader();
          reader.onload = (e) => {
            let text = e.target.result;
            // 移除 BOM
            if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
            const NL=String.fromCharCode(10); const CR=String.fromCharCode(13); const lines = text.trim().replace(new RegExp(CR+NL,'g'),NL).replace(new RegExp(CR,'g'),NL).split(NL).map(l => {
              // 簡單 CSV 解析（支援引號）
              const cells = [];
              let cur = '', inQ = false;
              for (let i = 0; i < l.length; i++) {
                if (l[i] === '"') { inQ = !inQ; }
                else if (l[i] === ',' && !inQ) { cells.push(cur.trim()); cur = ''; }
                else { cur += l[i]; }
              }
              cells.push(cur.trim());
              return cells;
            });
            if (lines.length < 2) { alert('CSV 內容為空'); return; }
            const headers = lines[0].map(h => h.replace(/^"|"$/g,'').trim());
            csvData = lines.slice(1).filter(l => l.some(c => c)).map(row => {
              const obj = {};
              headers.forEach((h, i) => { obj[h] = (row[i] || '').replace(/^"|"$/g,'').trim(); });
              return obj;
            });
            renderImportPreview(headers, csvData);
          };
          reader.readAsText(file, 'UTF-8');
        }
      }

      // 下載 Excel 範例（指向靜態檔案）
      function downloadTemplate() {
        const link = document.createElement('a');
        link.href = '/static/members_import_template.xlsx';
        link.download = '成員匯入範例.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      async function confirmCSVImport() {
        if (!csvData.length) return;
        // 取得使用者選擇的匯入年份
        const importYear = document.getElementById('csv-import-year').value || CURRENT_YEAR;
        const btn = document.getElementById('csv-import-btn');
        btn.disabled = true; btn.textContent = '匯入中 (' + importYear + '學年)...';
        const msg = document.getElementById('csv-msg');
        const progressEl = document.getElementById('csv-progress');
        const progressBar = document.getElementById('csv-progress-bar');
        const progressText = document.getElementById('csv-progress-text');
        progressEl.classList.remove('hidden');
        msg.classList.add('hidden');

        let success = 0, updated = 0, fail = 0, skip = 0;
        const errors = [];

        for (let i = 0; i < csvData.length; i++) {
          const row = csvData[i];
          // 更新進度條
          const pct = Math.round((i / csvData.length) * 100);
          progressBar.style.width = pct + '%';
          progressText.textContent = (i+1) + ' / ' + csvData.length;

          // 取得姓名（支援多種欄位名）
          const name = getField(row, ['姓名', '中文姓名', 'chinese_name', 'Name'], '');
          if (!name) { skip++; continue; }

          // 取得日期（支援民國年各種格式）
          const rawDob = getField(row, ['生日', 'dob', 'birthday', 'DOB'], '');
          const dob = convertROCDate(rawDob) || null;

          // 取得組別（童軍階段 → section）
          const sectionRaw = getField(row, ['童軍階段', '組別', 'section', '階段'], '童軍');
          // 標準化 section 名稱
          const sectionMap = {'童軍':'童軍','行義童軍':'行義童軍','羅浮童軍':'羅浮童軍','服務員':'服務員',
            'junior':'童軍','senior':'行義童軍','rover':'羅浮童軍',
            '行義':'行義童軍','羅浮':'羅浮童軍'};
          const section = sectionMap[sectionRaw] || sectionRaw || '童軍';

          // 職務欄位（職務/職位）
          const roleRaw = getField(row, ['職務', '職位', 'role_name', 'role'], '隊員');
          const roleName = roleRaw || '隊員';

          // 團次（若已含「團」字則不再重複加）
          const troopRaw = getField(row, ['團次', 'troop'], '54');
          let troop = '54團';
          if (troopRaw) {
            troop = /團$/.test(String(troopRaw)) ? String(troopRaw) : String(troopRaw) + '團';
          }

          const body = {
            year_label: importYear,
            chinese_name: name,
            english_name: getField(row, ['英文名', '英文姓名', 'english_name', 'English Name'], ''),
            gender: getField(row, ['性別', 'gender'], ''),
            national_id: getField(row, ['身分證號', '身份證號', 'national_id', 'ID'], '').toUpperCase(),
            dob: dob,
            section: section,
            unit_name: getField(row, ['小隊', 'unit_name', 'unit'], ''),
            role_name: roleName,
            rank_level: getField(row, ['童軍進程', '進程', 'rank_level', 'rank'], ''),
            phone: getField(row, ['電話', 'phone', '手機'], ''),
            parent_name: getField(row, ['家長姓名', '家長', 'parent_name'], ''),
            troop: troop,
          };

          try {
            const res = await fetch('/api/enrollments', {
              method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
            });
            const json = await res.json();
            if (res.ok && json.success) {
              success++;
            } else if (res.status === 409 || (json.error && json.error.includes('已有'))) {
              // 已有此成員，算作更新
              updated++;
            } else {
              fail++;
              errors.push(name + ': ' + (json.error || '未知錯誤'));
            }
          } catch(e) { fail++; errors.push(name + ': 網路錯誤'); }
        }

        progressBar.style.width = '100%';
        progressText.textContent = csvData.length + ' / ' + csvData.length;

        let msgText = '✅ 匯入完成！（' + importYear + ' 學年）';
        if (success) msgText += ' 新增 ' + success + ' 人';
        if (updated) msgText += '、沿用/更新 ' + updated + ' 人';
        if (skip) msgText += '、跳過 ' + skip + ' 筆（無姓名）';
        if (fail) {
          msgText += '、失敗 ' + fail + ' 筆';
          if (errors.length) msgText += ' 錯誤：' + errors.slice(0,3).join('；');
        }
        msg.textContent = msgText;
        msg.className = 'mt-3 text-sm p-3 rounded-lg whitespace-pre-line ' + (fail ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700');
        msg.classList.remove('hidden');
        btn.textContent = '✅ 匯入完成';

        if (success > 0 || updated > 0) {
          // 跳轉到匯入年度的成員頁面
          setTimeout(() => { window.location.href = '/admin/members?year=' + importYear; }, 2000);
        }
      }
    