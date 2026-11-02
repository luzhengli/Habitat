"""Optional local browser smoke; requires Python Playwright + Chromium.
Start `npm run start:fixture` before running. Never launches or writes user Agent files.
"""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
root = Path(__file__).resolve().parents[1]
out = root / 'verification'
base = os.environ.get('HABITAT_TEST_URL', 'http://127.0.0.1:4173')
results = []
with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'), args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1440,'height':960}, device_scale_factor=1)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base, wait_until='networkidle')
    page.get_by_text('2 项 · 只读完成', exact=True).wait_for()
    results.append({'check':'fixture-root-real-read','status':'passed'})
    page.get_by_role('button',name='读取 SKILL.md').first.click()
    page.locator('#content').filter(has_text='Synthetic sample only').wait_for()
    results.append({'check':'SKILL.md-read-as-text','status':'passed'})
    page.screenshot(path=str(out/'current-bootstrap-1440.png'), full_page=True)
    page.goto(base+'/demo', wait_until='networkidle')
    page.get_by_role('heading',name='技能库',exact=True).wait_for()
    cards=page.locator('.skill-card').count()
    assert cards == 9, cards
    results.append({'check':'approved-react-demo-renders','status':'passed','cards':cards})
    page.screenshot(path=str(out/'current-air-demo-1440.png'),full_page=True)
    page.get_by_role('textbox',name='搜索技能').fill('frontend')
    assert page.locator('.skill-card').count()==1
    results.append({'check':'reference-search','status':'passed'})
    page.locator('.card-title').first.click()
    page.get_by_role('dialog').wait_for()
    page.screenshot(path=str(out/'current-air-detail.png'))
    page.keyboard.press('Escape')
    assert page.get_by_role('dialog').count()==0
    results.append({'check':'reference-detail-and-Escape','status':'passed'})
    page.get_by_role('button',name='项目',exact=True).first.click()
    assert '项目' in page.locator('.breadcrumbs').inner_text()
    results.append({'check':'reference-project-navigation','status':'passed'})
    page.set_viewport_size({'width':960,'height':640})
    page.screenshot(path=str(out/'current-air-960.png'))
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    results.append({'check':'reference-960-no-horizontal-overflow','status':'passed'})
    page.goto(base, wait_until='networkidle')
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    results.append({'check':'bootstrap-390-no-horizontal-overflow','status':'passed'})
    assert not errors, errors
    results.append({'check':'page-errors','status':'passed','errors':errors})
    (out/'current-browser-results.json').write_text(json.dumps({'browser':'Chromium','base':base,'checks':results,'scope':'Bootstrap + unchanged approved Air demo. Not the unbuilt Vite frontend.'},ensure_ascii=False,indent=2))
    browser.close()
print(json.dumps(results,ensure_ascii=False,indent=2))
