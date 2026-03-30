import os
import re

html_files = ["index.html", "conditions.html", "guide.html", "emergency.html", "self-test.html"]
nav_item = '<li class="nav-item"><a class="nav-link" href="community.html" data-i18n="nav_community">Community</a></li>\n          '

for f in html_files:
    path = os.path.join(r"d:\khdem\iyed", f)
    if not os.path.exists(path):
        continue
    with open(path, "r", encoding="utf-8") as file:
        content = file.read()
    
    # Replace if not already there
    if 'href="community.html"' not in content:
        content = re.sub(r'(<li class="nav-item"><a [^>]*?href="emergency\.html")', nav_item + r'\1', content)
        
        with open(path, "w", encoding="utf-8") as file:
            file.write(content)

print("Navbars updated")
