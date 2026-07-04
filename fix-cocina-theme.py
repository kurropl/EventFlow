#!/usr/bin/env python3
"""Fix CocinaPanel dark theme to match admin cream/gold design."""
import re

path = '/root/workspace/EventFlow/src/components/b2b/CocinaPanel.tsx'
with open(path, 'r') as f:
    content = f.read()

original_len = len(content)

# 1. Main wrapper
content = content.replace(
    '<div className="min-h-screen bg-[#0a0a0a] text-white">',
    '<div className="min-h-screen bg-[#FAF8F5] text-[#0a0a0a]">'
)
content = content.replace(
    '<h1 className="text-xl font-semibold text-gold flex items-center gap-2">',
    '<h1 className="text-xl font-bold text-[#C9A86A] flex items-center gap-2 font-serif">'
)
content = content.replace(
    '<Icon name="food" className="w-5 h-5 text-gold" />',
    '<Icon name="food" className="w-5 h-5 text-[#C9A86A]" />'
)
content = content.replace(
    '<p className="text-sm text-gray-500 mt-1">',
    '<p className="text-sm text-[#9CA3AF] mt-1">'
)

# 2. Main tabs bar
content = content.replace(
    '<div className="flex gap-1 mb-6 p-1 rounded-lg bg-[#111111] border border-[#1e1e1e] w-fit">',
    '<div className="flex gap-1 mb-6 p-1 rounded-lg bg-[#F8F3E6] border border-[#C9A86A]/20 w-fit">'
)
content = content.replace(
    "activeTab === tab.id\n                  ? 'bg-gold text-black shadow-sm'\n                  : 'text-gray-400 hover:text-white hover:bg-[#1e1e1e]'",
    "activeTab === tab.id\n                  ? 'bg-[#C9A86A] text-white shadow-sm'\n                  : 'text-[#6B7280] hover:text-[#0a0a0a] hover:bg-white'"
)

# 3. Tab content area
content = content.replace(
    '<div className="rounded-xl border border-[#1e1e1e] bg-[#0f0f0f] p-4 sm:p-6">',
    '<div className="rounded-xl border border-[#C9A86A]/20 bg-[#F8F3E6] p-4 sm:p-6">'
)
# Remove the extra div wrapper for HACCPPanel
content = content.replace(
    '''{activeTab === 'appcc' && (
            <div className="bg-white text-stone-800 rounded-lg p-4">
              <HACCPPanel />
            </div>
          )}''',
    '''{activeTab === 'appcc' && <HACCPPanel />}'''
)

# 4. ConfirmDialog
# Find the dialog wrapper
content = content.replace(
    'sm:max-w-md bg-[#0a0a0a] border border-[#1e1e1e] text-white',
    'sm:max-w-md bg-white border border-[#C9A86A]/20 text-[#0a0a0a]'
)

# 5. RecetasTab table
content = content.replace(
    'border-b border-[#1e1e1e] text-gray-400 uppercase text-xs tracking-wider',
    'border-b border-[#C9A86A]/20 text-[#6B7280] uppercase text-xs tracking-wider'
)
content = content.replace(
    'border-b border-[#141414] hover:bg-[#141414] transition-colors',
    'border-b border-[#C9A86A]/10 hover:bg-white transition-colors'
)
content = content.replace(
    'text-white font-medium">\n                {recipe.name}',
    'text-[#0a0a0a] font-medium">\n                {recipe.name}'
)
content = content.replace(
    'text-gray-300">{recipe.category}',
    'text-[#5A4A38]">{recipe.category}'
)
content = content.replace(
    'text-center text-gray-300">\n                v{recipe.version}',
    'text-center text-[#5A4A38]">\n                v{recipe.version}'
)
# Published badge
content = content.replace(
    "? 'bg-green-900/40 text-green-400'\n                      : 'bg-gray-800 text-gray-400'",
    "? 'bg-emerald-100 text-emerald-800'\n                      : 'bg-[#F8F3E6] text-[#6B7280]'"
)
content = content.replace(
    "recipe.published ? 'bg-green-400' : 'bg-gray-500'",
    "recipe.published ? 'bg-emerald-500' : 'bg-[#9CA3AF]'"
)
# Recetas action buttons
content = content.replace(
    'text-gray-300 hover:text-white hover:bg-[#1e1e1e] h-8 px-2 text-xs',
    'text-[#6B7280] hover:text-[#0a0a0a] hover:bg-[#F8F3E6] h-8 px-2 text-xs'
)
content = content.replace(
    'text-green-400 hover:text-green-300 hover:bg-green-900/20 h-8 px-2 text-xs',
    'text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 h-8 px-2 text-xs'
)
content = content.replace(
    'text-red-400 hover:text-red-300 hover:bg-red-900/20 h-8 px-2 text-xs',
    'text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2 text-xs'
)

# 6. EquipamientoTab
# Loading skeletons
content = content.replace(
    'className="h-10 bg-[#1e1e1e] rounded"',
    'className="h-10 bg-[#F8F3E6] rounded"'
)
content = content.replace(
    'text-sm font-medium text-gray-300">\n          {items.length} equipos registrados',
    'text-sm font-medium text-[#6B7280]">\n          {items.length} equipos registrados'
)
# Gold buttons
content = content.replace(
    'bg-gold hover:bg-gold-dark text-black font-medium text-xs h-8',
    'bg-[#C9A86A] hover:bg-[#B8922E] text-white font-medium text-xs h-8'
)
content = content.replace(
    'bg-gold hover:bg-gold-dark text-black h-8 text-xs font-medium',
    'bg-[#C9A86A] hover:bg-[#B8922E] text-white h-8 text-xs font-medium'
)
content = content.replace(
    'bg-gold hover:bg-gold-dark text-black h-7 text-xs px-2',
    'bg-[#C9A86A] hover:bg-[#B8922E] text-white h-7 text-xs px-2'
)
# New equipment form
content = content.replace(
    'rounded-lg border border-[#1e1e1e] bg-[#0f0f0f] space-y-2',
    'rounded-lg border border-[#C9A86A]/20 bg-white space-y-2'
)
# Inputs
content = content.replace(
    'bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder:text-gray-500 h-9 text-sm',
    'bg-white border-[#C9A86A]/30 text-[#0a0a0a] placeholder:text-[#9CA3AF] h-9 text-sm'
)
content = content.replace(
    'bg-[#1a1a1a] border-[#2a2a2a] text-white h-8 text-sm w-20 mx-auto text-center',
    'bg-white border-[#C9A86A]/30 text-[#0a0a0a] h-8 text-sm w-20 mx-auto text-center'
)
content = content.replace(
    'bg-[#1a1a1a] border-[#2a2a2a] text-white h-8 text-sm',
    'bg-white border-[#C9A86A]/30 text-[#0a0a0a] h-8 text-sm'
)
# Cancel buttons
content = content.replace(
    'text-gray-400 hover:text-white h-8 text-xs',
    'text-[#6B7280] hover:text-[#0a0a0a] h-8 text-xs'
)
content = content.replace(
    'text-gray-400 hover:text-white h-7 text-xs px-2',
    'text-[#6B7280] hover:text-[#0a0a0a] h-7 text-xs px-2'
)
# Equipamiento table cells
content = content.replace(
    'text-gray-300">{eq.category}</td>',
    'text-[#5A4A38]">{eq.category}</td>'
)
content = content.replace(
    'text-white font-medium">\n                        {eq.name}',
    'text-[#0a0a0a] font-medium">\n                        {eq.name}'
)

# 7. Pases/Hojas sub-tab bar
content = content.replace(
    'bg-[#111111] border border-[#1e1e1e] w-fit',
    'bg-[#F8F3E6] border border-[#C9A86A]/20 w-fit'
)
content = content.replace(
    'text-gray-400 hover:text-white hover:bg-[#1e1e1e]',
    'text-[#6B7280] hover:text-[#0a0a0a] hover:bg-white'
)

# 8. Empty states
content = content.replace(
    'text-gold">',
    'text-[#C9A86A]">'
)

# 9. Any remaining text-gray-400 in CocinaPanel context (not shadcn)
# Be careful to only replace in our file context
content = content.replace(
    'text-gray-400">\n            Gestión de recetas',
    'text-[#9CA3AF]">\n            Gestión de recetas'
)

with open(path, 'w') as f:
    f.write(content)

new_len = len(content)
print(f"Original: {original_len} chars, New: {new_len} chars")
print(f"Changed: {new_len - original_len} chars")

# Verify no dark theme remains in CocinaPanel
import subprocess
result = subprocess.run(
    ['grep', '-c', 'bg-\[#0a0a0a\]', path],
    capture_output=True, text=True
)
print(f"Remaining bg-[#0a0a0a]: {result.stdout.strip()}")

result = subprocess.run(
    ['grep', '-c', 'bg-\[#1e1e1e\]', path],
    capture_output=True, text=True
)
print(f"Remaining bg-[#1e1e1e]: {result.stdout.strip()}")

result = subprocess.run(
    ['grep', '-c', 'bg-\[#0f0f0f\]', path],
    capture_output=True, text=True
)
print(f"Remaining bg-[#0f0f0f]: {result.stdout.strip()}")

result = subprocess.run(
    ['grep', '-c', 'bg-\[#111111\]', path],
    capture_output=True, text=True
)
print(f"Remaining bg-[#111111]: {result.stdout.strip()}")