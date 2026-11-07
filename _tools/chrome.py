"""Write the shared header, menus, search panel and footer into every page.

Run from the site folder:  python _tools/chrome.py
Each page keeps its own content. Only the blocks between the
<!-- site-header --> and <!-- site-footer --> markers are replaced.
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700'
         '&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">')
ICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230E2A5C'/%3E"
        "%3Ccircle cx='16' cy='16' r='9.5' fill='none' stroke='%23fff' stroke-width='2'/%3E%3Ccircle cx='16' cy='16' r='3.5' fill='%234FB3F0'/%3E%3C/svg%3E")
MARK = ('<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="10" fill="#0E2A5C"/>'
        '<circle cx="20" cy="20" r="11.5" fill="none" stroke="#fff" stroke-width="2.2"/><circle cx="20" cy="20" r="4.2" fill="#4FB3F0"/>'
        '<path d="M20 4v8M20 28v8M4 20h8M28 20h8" stroke="#4FB3F0" stroke-width="2.2" stroke-linecap="round"/></svg>')
SEARCH_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>'
MENU_ICON = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'

INDUSTRIES = [
    ('steel-fabrication', 'Steel fabrication', 'Frames, brackets and welded assemblies', 'التصنيع المعدني', 'هياكل وحوامل وتجميعات ملحومة'),
    ('pumps', 'Pumps and fluid handling', 'Impellers, housings, shafts and seals', 'المضخات ونقل السوائل', 'دافعات وأغلفة وأعمدة وموانع تسرب'),
    ('oil-gas-piping', 'Oil, gas and piping', 'Flanges, fittings and threaded pipe work', 'النفط والغاز والأنابيب', 'شفاه ووصلات وأعمال الأنابيب الملولبة'),
    ('industrial-machinery', 'Industrial machinery', 'Gears, shafts, pulleys and machine parts', 'الآلات الصناعية', 'تروس وأعمدة وبكرات وقطع آلات'),
    ('automotive', 'Automotive and transport', 'Vehicle, truck and off-highway parts', 'السيارات والنقل', 'قطع المركبات والشاحنات والمعدات الثقيلة'),
]
SERVICES = [
    ('design', 'Mechanical design', 'Concept to released CAD and drawings', 'التصميم الميكانيكي', 'من المفهوم إلى نماذج CAD والرسومات المعتمدة'),
    ('analysis', 'Engineering analysis', 'FEA, fatigue and tolerance stack-ups', 'التحليل الهندسي', 'تحليل العناصر المحدودة والكلال وتراكم التفاوتات'),
    ('reverse', 'Reverse engineering', 'Rebuild parts from samples and scans', 'الهندسة العكسية', 'إعادة بناء القطع من العينات والمسح'),
    ('prototyping', 'Prototyping', '3D printing, one-offs and soft tooling', 'النماذج الأولية', 'طباعة ثلاثية الأبعاد وقطع مفردة وقوالب مؤقتة'),
    ('manufacturing', 'Manufacturing', 'CNC, sheet metal, fabrication and casting', 'التصنيع', 'تشغيل CNC وصاج ولحام وسباكة'),
    ('inspection', 'Inspection and documentation', 'Dimensional inspection and reports', 'الفحص والتوثيق', 'فحص الأبعاد والتقارير'),
]
APPS = [
    ('check-my-part.html', 'Check My Part', 'Open your STL and request a quote', 'افحص قطعتك', 'افتح ملف STL واطلب عرض سعر'),
    ('machining-simulator.html', 'Machining Simulation', 'Watch G-code cut a block in 3D', 'محاكاة التشغيل', 'شاهد G-code يقطع كتلة بالأبعاد الثلاثية'),
    ('part-viewer.html', '3D Part Viewer', 'Size, section and export parts', 'عارض القطع', 'غيّر المقاسات واعرض المقاطع وصدّر القطع'),
    ('parts-library.html', '3D Parts Library', 'Eleven adjustable parts', 'مكتبة القطع', 'إحدى عشرة قطعة قابلة للتعديل'),
    ('fits-calculator.html', 'Fits Calculator', 'ISO 286 hole and shaft fits', 'حاسبة التوافقات', 'توافقات الثقب والعمود وفق ISO 286'),
    ('cutting-data.html', 'Cutting Data', 'Speed, feed and power', 'بيانات القطع', 'السرعة والتغذية والقدرة'),
    ('bolt-circle.html', 'Bolt Circle', 'Hole positions on a circle', 'دائرة البراغي', 'مواقع الثقوب على دائرة'),
    ('thread-chart.html', 'Thread and Drill Chart', 'Tap drills and clearance holes', 'جدول اللوالب', 'مثاقب اللولبة وثقوب الخلوص'),
    ('tolerance-guide.html', 'Tolerance Guide', 'Which process holds your number', 'دليل التفاوتات', 'أي عملية تحقق التفاوت المطلوب'),
]

T = {
    'en': dict(skip='Skip to content', home='MDM home', tag='Mechanical Design &amp; Manufacturing', main='Main',
               industries='Industries', services='Services', apps='Apps', insights='Insights', contact='Contact', quote='Request a quote',
               ind_intro='Engineering and parts for five sectors, from one design and manufacturing team.',
               svc_intro='Six services that work alone or together, from first sketch to measured part.',
               app_intro='Free engineering tools that run in your browser.',
               all_ind='All industries', all_svc='All services', all_apps='All nine apps',
               search='Search the site', search_ph='Search pages, apps and services', close='Close search', menu='Open menu',
               lang_label='العربية', lang_attr='ar', foot_text='Mechanical design, analysis, manufacturing and inspection, from first sketch to measured part.',
               company='Company', email_label='Email', rights='MDM Mechanical Design &amp; Manufacturing', foot_line='Engineered from first sketch to measured part.'),
    'ar': dict(skip='انتقل إلى المحتوى', home='الصفحة الرئيسية لـ MDM', tag='للتصميم والتصنيع الميكانيكي', main='القائمة الرئيسية',
               industries='القطاعات', services='الخدمات', apps='التطبيقات', insights='مقالات', contact='تواصل معنا', quote='اطلب عرض سعر',
               ind_intro='هندسة وقطع لخمسة قطاعات، من فريق واحد للتصميم والتصنيع.',
               svc_intro='ست خدمات تعمل منفردة أو مجتمعة، من الرسم الأولي حتى القطعة المقاسة.',
               app_intro='أدوات هندسية مجانية تعمل في متصفحك، باللغة الإنجليزية حالياً.',
               all_ind='كل القطاعات', all_svc='كل الخدمات', all_apps='كل التطبيقات التسعة',
               search='البحث في الموقع', search_ph='ابحث في الصفحات والتطبيقات والخدمات', close='إغلاق البحث', menu='فتح القائمة',
               lang_label='English', lang_attr='en', foot_text='التصميم الميكانيكي والتحليل والتصنيع والفحص، من الرسم الأولي حتى القطعة المقاسة.',
               company='الشركة', email_label='البريد', rights='MDM للتصميم والتصنيع الميكانيكي', foot_line='هندسة من الرسم الأولي حتى القطعة المقاسة.'),
}


def links(items, base, lang, folder, page_suffix='.html', anchor=False):
    out = []
    for key, en, en_d, ar, ar_d in items:
        name, desc = (ar, ar_d) if lang == 'ar' else (en, en_d)
        url = f'{base}services.html#{key}' if anchor else (f'{base}{folder}{key}' + ('' if key.endswith('.html') else page_suffix))
        out.append(f'<li><a href="{url}"><b>{name}</b><span>{desc}</span></a></li>')
    return '\n            '.join(out)


def header(lang, P):
    t = T[lang]
    home = (P + ('ar/' if lang == 'ar' else '')) or './'
    other = (P if lang == 'ar' else P + 'ar/') or './'
    quote = home + '#quote'
    def mega(mid, title, intro, all_label, all_url, items):
        return f'''<li class="has-mega">
          <button type="button" class="nav-btn" aria-expanded="false" aria-controls="mega-{mid}">{title}</button>
          <div class="mega" id="mega-{mid}"><div class="wrap mega-inner">
            <div class="mega-intro"><p class="mega-title">{title}</p><p>{intro}</p><a class="text-link" href="{all_url}">{all_label}</a></div>
            <ul class="mega-links">
            {items}
            </ul>
          </div></div>
        </li>'''
    return f'''<!-- site-header -->
<a class="skip" href="#main">{t['skip']}</a>
<header class="site-header" id="site-header">
  <div class="wrap header-bar">
    <a class="logo" href="{home}" aria-label="{t['home']}">{MARK}<span><b>MDM</b><small>{t['tag']}</small></span></a>
    <nav class="main-nav" id="main-nav" aria-label="{t['main']}">
      <ul class="nav-list">
        {mega('industries', t['industries'], t['ind_intro'], t['all_ind'], home + '#industries', links(INDUSTRIES, P, lang, 'industries/'))}
        {mega('services', t['services'], t['svc_intro'], t['all_svc'], P + 'services.html', links(SERVICES, P, lang, '', anchor=True))}
        {mega('apps', t['apps'], t['app_intro'], t['all_apps'], P + 'apps/', links(APPS, P, lang, 'apps/'))}
        <li><a class="nav-link" href="{P}insights/">{t['insights']}</a></li>
        <li><a class="nav-link" href="{quote}">{t['contact']}</a></li>
        <li class="mobile-cta"><a class="btn btn-primary" href="{quote}">{t['quote']}</a></li>
      </ul>
    </nav>
    <div class="header-tools">
      <button class="icon-btn" type="button" id="search-open" aria-label="{t['search']}">{SEARCH_ICON}</button>
      <a class="lang" href="{other}" lang="{t['lang_attr']}" hreflang="{t['lang_attr']}">{t['lang_label']}</a>
      <a class="btn btn-primary btn-sm header-cta" href="{quote}">{t['quote']}</a>
      <button class="icon-btn menu-btn" type="button" id="menu-open" aria-expanded="false" aria-controls="main-nav" aria-label="{t['menu']}">{MENU_ICON}</button>
    </div>
  </div>
</header>
<div class="search" id="search" role="dialog" aria-modal="true" aria-label="{t['search']}" hidden>
  <div class="search-panel">
    <div class="search-row">
      <input type="search" id="search-input" placeholder="{t['search_ph']}" aria-label="{t['search']}" autocomplete="off">
      <button class="btn btn-sm" type="button" id="search-close">{t['close']}</button>
    </div>
    <div class="search-results" id="search-results"></div>
  </div>
</div>
<!-- /site-header -->'''


def footer(lang, P):
    t = T[lang]
    home = (P + ('ar/' if lang == 'ar' else '')) or './'
    def col(title, items):
        return f'<div><p class="footer-h">{title}</p><ul>' + ''.join(items) + '</ul></div>'
    ind = [f'<li><a href="{P}industries/{k}.html">{ar if lang == "ar" else en}</a></li>' for k, en, _, ar, _ in INDUSTRIES]
    svc = [f'<li><a href="{P}services.html#{k}">{ar if lang == "ar" else en}</a></li>' for k, en, _, ar, _ in SERVICES]
    app = [f'<li><a href="{P}apps/{k}">{ar if lang == "ar" else en}</a></li>' for k, en, _, ar, _ in APPS[:6]]
    app.append(f'<li><a href="{P}apps/">{t["all_apps"]}</a></li>')
    comp = [f'<li><a href="{P}insights/">{t["insights"]}</a></li>', f'<li><a href="{home}#quote">{t["quote"]}</a></li>',
            f'<li><a href="{P if lang == "ar" else P + "ar/"}" lang="{t["lang_attr"]}">{t["lang_label"]}</a></li>']
    return f'''<!-- site-footer -->
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="footer-brand">
      <a class="logo" href="{home}">{MARK}<span><b>MDM</b><small>{t['tag']}</small></span></a>
      <p>{t['foot_text']}</p>
      <p>{t['email_label']}: <a href="mailto:mahmoudsobhyelagha@gmail.com">mahmoudsobhyelagha@gmail.com</a></p>
    </div>
    {col(t['industries'], ind)}
    {col(t['services'], svc)}
    {col(t['apps'], app)}
    {col(t['company'], comp)}
  </div>
  <div class="wrap footer-bottom"><span>© <span data-year>2026</span> {t['rights']}</span><span>{t['foot_line']}</span></div>
</footer>
<!-- /site-footer -->'''


def process(path):
    rel = os.path.relpath(path, ROOT).replace('\\', '/')
    depth = rel.count('/')
    P = '../' * depth
    lang = 'ar' if rel.startswith('ar/') else 'en'
    s = open(path, encoding='utf-8', newline='').read().replace('\r\n', '\n')
    before = s

    # Header
    if '<!-- site-header -->' in s:
        s = re.sub(r'<!-- site-header -->.*?<!-- /site-header -->', lambda m: header(lang, P), s, flags=re.S)
    elif re.search(r'<div class="top">\s*<header class="wrap topbar">.*?</header>\s*</div>', s, re.S):
        s = re.sub(r'<div class="top">\s*<header class="wrap topbar">.*?</header>\s*</div>', lambda m: header(lang, P), s, count=1, flags=re.S)
    else:
        print('  no header slot:', rel)

    # Footer
    if '<!-- site-footer -->' in s:
        s = re.sub(r'<!-- site-footer -->.*?<!-- /site-footer -->', lambda m: footer(lang, P), s, flags=re.S)
    else:
        m = re.search(r'<footer class="foot"><div class="wrap">(.*?)</div></footer>', s, re.S)
        if m:
            s = s.replace(m.group(0), f'<div class="page-note"><div class="wrap">{m.group(1)}</div></div>\n' + footer(lang, P))
        else:
            print('  no footer slot:', rel)

    # Fonts, icon, main landmark and behaviour script
    s = re.sub(r'(<link rel="preconnect" href="https://fonts\.googleapis\.com">\n)?(<link rel="preconnect" href="https://fonts\.gstatic\.com" crossorigin>\n)?<link rel="stylesheet" href="https://fonts\.googleapis\.com/css2\?[^"]*">',
               lambda m: FONTS, s, count=1)
    s = re.sub(r'<link rel="icon" href="[^"]*">', lambda m: f'<link rel="icon" href="{ICON}">', s, count=1)
    if 'id="main"' not in s:
        s = s.replace('<main class="wrap">', '<main class="wrap" id="main">', 1).replace('<main>', '<main id="main">', 1)
    tag = f'<script src="{P}assets/site.js" defer></script>'
    if 'assets/site.js' not in s:
        s = s.replace('</body>', tag + '\n</body>', 1)
    if s != before:
        open(path, 'w', encoding='utf-8', newline='').write(s)
        print('updated', rel)


def main():
    targets = sys.argv[1:]
    if not targets:
        for base, dirs, files in os.walk(ROOT):
            dirs[:] = [d for d in dirs if not d.startswith(('.', '_'))]
            targets += [os.path.join(base, f) for f in files if f.endswith('.html') and f != '404.html']
    for t in sorted(targets):
        process(os.path.abspath(t))


if __name__ == '__main__':
    main()
