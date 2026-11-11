#!/usr/bin/env python3
"""Verification runner for ByTheSea. See SKILL.md."""
import json, os, re, signal, subprocess, sys, time
from pathlib import Path
REPO = Path(__file__).resolve().parents[3]
failures = []
def check(name, ok, detail=''):
    print(('PASS' if ok else 'FAIL'), name, (':: ' + str(detail))[:400] if detail else '')
    if not ok: failures.append(name)
def run(cmd, **kw):
    return subprocess.run(cmd, cwd=REPO, capture_output=True, text=True, timeout=900, **kw)
def main():
    if not (REPO / 'node_modules').is_dir():
        check('npm install', run(['npm', 'install', '--no-audit', '--no-fund']).returncode == 0)
    server = subprocess.Popen(['npx', 'serve', 'public', '-l', '3000'], cwd=REPO,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    try:
        up = False
        import urllib.request
        for _ in range(40):
            try:
                if urllib.request.urlopen('http://localhost:3000/', timeout=2).status == 200:
                    up = True; break
            except Exception:
                time.sleep(0.5)
        check('static server up', up)
        proc = run(['npx', 'playwright', 'test'])
        tail = re.sub(r'\x1b\[[0-9;]*m', '', proc.stdout + proc.stderr)
        check('playwright mission check (map init, markers, keyboard focus)', proc.returncode == 0 and ' failed' not in tail and 'passed' in tail, tail[-300:])
    finally:
        try:
            os.killpg(os.getpgid(server.pid), signal.SIGTERM)
        except Exception:
            pass
    print('FAILURES=%d' % len(failures))
    with open(REPO / '.cursor/skills/verify-by-the-sea/evidence.json', 'w') as f:
        json.dump({'repo': 'ByTheSea', 'ts': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'failures': failures}, f, indent=2)
    return 1 if failures else 0
if __name__ == '__main__':
    sys.exit(main())
