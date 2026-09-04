#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DET 练习站 · 本地代理 + 静态服务器（单文件，Python 标准库，零依赖）

用法（Windows PowerShell 示例）：
    # 方式 A：系统环境变量
    $env:DET_PROXY_KEY='sk-你的key'
    $env:DET_PROXY_ENDPOINT='https://api.deepseek.com/chat/completions'   # 可选
    python server.py 8787
    # 方式 B：配置文件（复制 server.env.example 为 server.env，兼容不支持环境变量的场景）
    python server.py
    # 健康检查： http://127.0.0.1:8787/api/health
    # 优先级：命令行端口 > 系统环境变量 > server.env

功能：
1. 静态服务：托管本站根目录（index.html / js/ / images/ / docs/ 等）。
   首页打开 http://127.0.0.1:8787 即可完整使用（含视线守护，localhost 属于安全上下文）。
2. POST /v1/chat/completions：转发到 DET_PROXY_ENDPOINT，附加服务端
   DET_PROXY_KEY。浏览器永远看不到 Key —— 公开部署也不泄露。
3. CORS：允许任意源调用代理（代理无 Cookie、无凭据，风险低），
   这样即便页面由其它静态服务（如 python -m http.server 8123）打开，
   也能通过 http://127.0.0.1:8787/v1/chat/completions 使用 AI 功能。

安全说明：
- 只监听 127.0.0.1；如需局域网/公网访问，自行改用 0.0.0.0 并加鉴权。
- 上行的 Authorization 由服务端注入，客户端传入的 Authorization 会被忽略。
- 未配置 DET_PROXY_KEY 时，/v1/chat/completions 返回 500，静态页面不受影响。
"""

import json
import mimetypes
import os
import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 8787
PROXY_KEY = ''
PROXY_ENDPOINT = 'https://api.deepseek.com/chat/completions'
ROOT = os.path.dirname(os.path.abspath(__file__))
UPSTREAM_TIMEOUT = 120
PUBLIC_ROOT_FILES = {'index.html'}
PUBLIC_DIRS = {'js', 'images', 'fonts'}


def _public_file_for_path(url_path, root=ROOT):
    """把 URL 映射到允许公开的静态文件；服务端配置和源码一律不提供。"""
    path = url_path.split('?', 1)[0]
    if path in ('', '/'):
        path = '/index.html'
    parts = [part for part in path.replace('\\', '/').split('/') if part]
    if not parts or any(part in ('.', '..') or part.startswith('.') for part in parts):
        return None
    if len(parts) == 1:
        if parts[0] not in PUBLIC_ROOT_FILES:
            return None
    elif parts[0] not in PUBLIC_DIRS:
        return None
    fp = os.path.abspath(os.path.join(root, *parts))
    try:
        if os.path.commonpath((os.path.abspath(root), fp)) != os.path.abspath(root):
            return None
    except ValueError:
        return None
    return fp if os.path.isfile(fp) else None


def _load_env_file(path):
    """从 server.env 读取 KEY=VALUE（支持 # 注释、引号剥离、UTF-8 BOM 容错）。"""
    env = {}
    if not os.path.isfile(path):
        return env
    with open(path, 'r', encoding='utf-8') as f:
        for raw in f:
            line = raw.strip().lstrip('\ufeff')  # 记事本等编辑器可能留 BOM
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, _, v = line.partition('=')
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


# 优先级：命令行端口 > 系统环境变量 > server.env 文件
_FILE_ENV = _load_env_file(os.path.join(ROOT, 'server.env'))
if __name__ == '__main__' and len(sys.argv) > 1:
    PORT = int(sys.argv[1])
elif _FILE_ENV.get('PORT') or os.environ.get('PORT'):
    PORT = int(_FILE_ENV.get('PORT') or os.environ.get('PORT'))
PROXY_KEY = os.environ.get('DET_PROXY_KEY') or _FILE_ENV.get('DET_PROXY_KEY', '')
PROXY_ENDPOINT = os.environ.get('DET_PROXY_ENDPOINT') or _FILE_ENV.get(
    'DET_PROXY_ENDPOINT', 'https://api.deepseek.com/chat/completions')


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print('[%s] %s' % (self.log_date_time_string(), fmt % args), flush=True)

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        path = self.path.split('?', 1)[0]
        if path == '/api/health':
            self._json(200, {
                'ok': True,
                'service': 'det-practice-server',
                'proxyEndpoint': PROXY_ENDPOINT,
                'keyConfigured': bool(PROXY_KEY),
                'port': PORT
            })
            return
        fp = _public_file_for_path(path)
        if not fp:
            self.send_error(404)
            return
        with open(fp, 'rb') as f:
            body = f.read()
        ctype = mimetypes.guess_type(fp)[0] or 'application/octet-stream'
        if ctype.startswith('text/') or ctype in ('application/json', 'application/javascript'):
            ctype += '; charset=utf-8'
        self.send_response(200)
        self._cors()
        self.send_header('Content-Type', ctype)
        self.send_header('Cache-Control', 'no-cache')  # 开发期避免旧缓存干扰
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path.split('?', 1)[0] != '/v1/chat/completions':
            self._json(404, {'error': 'not found'})
            return
        if not PROXY_KEY:
            self._json(500, {'error': 'server not configured: set DET_PROXY_KEY env, then restart'})
            return
        try:
            length = int(self.headers.get('Content-Length') or 0)
            payload = self.rfile.read(length) if length else b''
            data = json.loads(payload) if payload else {}
            if not isinstance(data, dict):
                raise ValueError('body must be a JSON object')
            data.setdefault('model', 'deepseek-chat')
            # 忽略客户端 Authorization：Key 只在服务端注入
            req = urllib.request.Request(
                PROXY_ENDPOINT,
                data=json.dumps(data).encode('utf-8'),
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + PROXY_KEY,
                },
                method='POST',
            )
            try:
                with urllib.request.urlopen(req, timeout=UPSTREAM_TIMEOUT) as resp:
                    body = resp.read()
                    status = resp.status
            except urllib.error.HTTPError as err:
                body = err.read()
                status = err.code
            self.send_response(status)
            self._cors()
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as err:  # noqa: BLE001 本地工具，聚合错误即可
            self._json(500, {'error': str(err)})

    def _json(self, status, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self._cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    print('DET 代理+静态服务器: http://127.0.0.1:%d' % PORT)
    print('代理目标:', PROXY_ENDPOINT)
    print('服务端 Key 已配置' if PROXY_KEY else '警告: 未设置 DET_PROXY_KEY，/v1/chat/completions 将返回 500')
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
