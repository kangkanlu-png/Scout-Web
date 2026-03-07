const fs = require('fs')

let code = fs.readFileSync('src/routes/admin.tsx', 'utf8')

const oldBlock = `  let availableYears: string[] = []
  if (groupSections.length > 0) {
    const pyrRows = await db.prepare(
      \`SELECT DISTINCT year_label FROM member_year_records WHERE section IN (\${sectionPlaceholders}) ORDER BY year_label DESC\`
    ).bind(...groupSections).all()
    const penRows = await db.prepare(
      \`SELECT DISTINCT year_label FROM member_enrollments WHERE section IN (\${sectionPlaceholders}) ORDER BY year_label DESC\`
    ).bind(...groupSections).all()
    const yearSet = new Set<string>()
    ;(pyrRows.results as any[]).forEach((r: any) => yearSet.add(r.year_label))
    ;(penRows.results as any[]).forEach((r: any) => yearSet.add(r.year_label))
    availableYears = Array.from(yearSet).sort((a, b) => b.localeCompare(a))
  }`

const newBlock = `  const maxYear = Math.max(parseInt(currentYear) || 115, 115)
  let availableYears = Array.from({length: maxYear - 108 + 1}, (_, i) => String(108 + i)).reverse()`

code = code.replace(oldBlock, newBlock)

fs.writeFileSync('src/routes/admin.tsx', code)
console.log('Years patched')
