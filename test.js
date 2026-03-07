    // Tab 切換
    const TAB_MAP = { pending:'panel-pending', approved:'panel-pending', rejected:'panel-pending', uploaded:'panel-pending', all:'panel-pending', calendar:'panel-calendar', schedule:'panel-schedule', settings:'panel-settings' }
    const CURRENT_TAB = 'pending'

    function switchTab(t) {
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'))
      const panel = { pending:'panel-pending', calendar:'panel-calendar', schedule:'panel-schedule', settings:'panel-settings' }[t] || 'panel-pending'
      document.getElementById(panel).classList.remove('hidden')
      // Update tab buttons
      document.querySelectorAll('[id^="tab-"]').forEach(b => b.classList.remove('border-blue-600','text-blue-700'))
      const btn = document.getElementById('tab-' + t)
      if (btn) { btn.classList.add('border-blue-600','text-blue-700') }
      if (t === 'calendar') loadCalendarEvents()
    }

    // Init tabs
    document.querySelectorAll('[id^="tab-"]').forEach(b => {
      b.classList.remove('border-blue-600','text-blue-700')
    })
    document.getElementById('tab-pending').classList.add('border-blue-600','text-blue-700')

    // 審核操作
    async function setStatus(id, status) {
      const note = status === 'rejected' ? (prompt('拒絕原因（選填）：') || '') : ''
      const send_email = confirm('是否發送 Email 通知該學員？');
      const res = await fetch('/api/admin/official-leave/' + id, {
        method: 'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status, admin_note: note || null, send_email })
      })
      const r = await res.json()
      if (r.success) location.reload()
      else alert('操作失敗：' + r.error)
    }

    // 封鎖/解封
    async function toggleBlock(date, isBlocked) {
      const reason = isBlocked ? (prompt('封鎖原因（選填，例：團長有事）：') || '團長有事或不開放') : ''
      const res = await fetch('/api/admin/official-leave/toggle-block', {
        method: 'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ date, is_blocked: isBlocked, reason })
      })
      const r = await res.json()
      if (r.success) location.reload()
      else alert('操作失敗：' + r.error)
    }

    // 新增行事曆事件
    async function addCalendarEvent() {
      const date  = document.getElementById('ev_date').value
      const type  = document.getElementById('ev_type').value
      const title = document.getElementById('ev_title').value.trim()
      const desc  = document.getElementById('ev_desc').value.trim()
      if (!date || !title) { showEvMsg('請填寫日期和標題','red'); return }
      const res = await fetch('/api/admin/official-leave/calendar-event', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ date, type, title, description: desc || null })
      })
      const r = await res.json()
      if (r.success) { showEvMsg('✅ 已新增','green'); loadCalendarEvents() }
      else showEvMsg('失敗：'+r.error,'red')
    }

    function showEvMsg(msg, color) {
      const el = document.getElementById('evMsg')
      const c = { red:'text-red-500', green:'text-green-600', gray:'text-gray-400' }
      el.innerHTML = '<span class="text-sm '+(c[color]||'text-gray-500')+'">'+msg+'</span>'
    }

    async function loadCalendarEvents() {
      const el = document.getElementById('evListContent')
      el.innerHTML = '<span class="text-gray-400 text-sm">載入中...</span>'
      const res = await fetch('/api/official-leave/calendar-events')
      const r = await res.json()
      if (!r.success || r.data.length === 0) {
        el.innerHTML = '<p class="text-gray-400 text-sm">尚無行事曆事件</p>'
        return
      }
      const evTypeIcon = { blocked:'⛔', holiday:'🔴', exam:'📋', event:'📌' }
      el.innerHTML = r.data.map(function(e) {
        return '<div class="flex items-center justify-between py-2 border-b last:border-0" id="ev-'+e.id+'">' +
          '<div class="flex items-center gap-3">' +
          '<span class="font-mono text-xs text-gray-500">'+e.date+'</span>' +
          '<span class="text-sm">'+(evTypeIcon[e.type]||'📌')+' '+e.title+'</span>' +
          (e.description ? '<span class="text-xs text-gray-400">('+e.description+')</span>' : '') +
          '</div>' +
          '<button onclick="deleteCalEvent(\'' + e.id + '\')"  class="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50">刪除</button>' +
          '</div>'
      }).join('')
    }

    async function deleteCalEvent(id) {
      if (!confirm('確定刪除此事件？')) return
      const res = await fetch('/api/admin/official-leave/calendar-event/' + id, { method:'DELETE' })
      const r = await res.json()
      if (r.success) { const el = document.getElementById('ev-'+id); if (el) el.remove() }
      else alert('刪除失敗：'+r.error)
    }

    // 每週例行規則
    let RULES = []

    function renderRules() {
      const dowN = ['日','一','二','三','四','五','六']
      const el = document.getElementById('ruleList')
      if (RULES.length === 0) { el.innerHTML = '<p class="text-gray-400 text-sm">尚無例行活動設定</p>'; return }
      el.innerHTML = RULES.map(function(r,i) {
        return '<div class="flex items-center gap-2 flex-wrap py-1.5 border-b border-gray-50">' +
          '<span class="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded">週'+dowN[r.dayOfWeek]+'</span>' +
          '<span class="text-sm font-medium text-gray-800 flex-1">'+r.title+'</span>' +
          (r.description ? '<span class="text-xs text-gray-400">('+r.description+')</span>' : '') +
          '<button onclick="deleteRule('+i+')" class="text-red-400 hover:text-red-600 text-xs px-2 py-0.5 rounded hover:bg-red-50">刪除</button>' +
          '</div>'
      }).join('')
    }

    async function addRule() {
      const dow   = parseInt(document.getElementById('rule_dow').value)
      const title = document.getElementById('rule_title').value.trim()
      const desc  = document.getElementById('rule_desc').value.trim()
      if (!title) { document.getElementById('ruleMsg').innerHTML='<span class="text-red-500">請填寫標題</span>'; return }
      const id = 'rule-' + Date.now()
      RULES.push({ id, dayOfWeek: dow, title, type:'recurring', description: desc || undefined })
      await saveRules()
      document.getElementById('rule_title').value = ''
      document.getElementById('rule_desc').value = ''
      renderRules()
    }

    async function deleteRule(idx) {
      RULES.splice(idx, 1)
      await saveRules()
      renderRules()
    }

    async function saveRules() {
      await fetch('/api/admin/official-leave/settings', {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ recurringRules: RULES })
      })
    }

    // 系統設定
    async function saveSettings() {
      const start = document.getElementById('set_start').value
      const end   = document.getElementById('set_end').value
      const dow   = [...document.querySelectorAll('.chk-dow:checked')].map(c => parseInt(c.value))
      if (!start || !end) { showSettingsMsg('請填寫學期日期','red'); return }
      showSettingsMsg('儲存中...','gray')
      const res = await fetch('/api/admin/official-leave/settings', {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ semesterStart:start, semesterEnd:end, allowedWeekdays:dow })
      })
      const r = await res.json()
      if (r.success) showSettingsMsg('✅ 設定已儲存','green')
      else showSettingsMsg('儲存失敗：'+r.error,'red')
    }
    function showSettingsMsg(msg, color) {
      const c = { red:'text-red-500', green:'text-green-600', gray:'text-gray-400' }
      document.getElementById('settingsMsg').innerHTML = '<p class="text-sm '+(c[color]||'text-gray-500')+'">'+msg+'</p>'
    }
