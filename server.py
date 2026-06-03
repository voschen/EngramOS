import os
import json
import logging
import urllib.parse
from http.server import SimpleHTTPRequestHandler, HTTPServer

PORT = 8000
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
NOTES_DIR = os.path.join(DATA_DIR, 'notes')
UPLOADS_DIR = os.path.join(DATA_DIR, 'uploads')

# Ensure data directories exist
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)
if not os.path.exists(NOTES_DIR):
    os.makedirs(NOTES_DIR)
if not os.path.exists(UPLOADS_DIR):
    os.makedirs(UPLOADS_DIR)

class ApiHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/fields':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            fields = []
            if os.path.exists(DATA_DIR):
                for filename in os.listdir(DATA_DIR):
                    if filename.endswith('.json') and filename != 'todos.json':
                        try:
                            with open(os.path.join(DATA_DIR, filename), 'r', encoding='utf-8') as f:
                                data = json.load(f)
                                if 'id' not in data:
                                    data['id'] = filename.replace('.json', '')
                                fields.append(data)
                        except Exception as e:
                            logging.error(f"Error reading file {filename}: {e}")
            
            self.wfile.write(json.dumps(fields).encode('utf-8'))
            return
        elif self.path == '/api/todos':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            filepath = os.path.join(DATA_DIR, 'todos.json')
            if os.path.exists(filepath):
                with open(filepath, 'r', encoding='utf-8') as f:
                    self.wfile.write(f.read().encode('utf-8'))
            else:
                self.wfile.write(b'[]')
            return
            
        elif self.path.startswith('/api/notes/'):
            note_id = self.path.split('/')[-1]
            if not note_id:
                self.send_response(400)
                self.end_headers()
                return
                
            filename = "".join(c for c in note_id if c.isalnum() or c in ('-', '_')) + '.md'
            filepath = os.path.join(NOTES_DIR, filename)
            
            self.send_response(200)
            self.send_header('Content-type', 'text/markdown')
            self.end_headers()
            
            if os.path.exists(filepath):
                with open(filepath, 'r', encoding='utf-8') as f:
                    self.wfile.write(f.read().encode('utf-8'))
            else:
                self.wfile.write(b'# Notes\\n\\nUse this canvas to dump links, thoughts, and images for this node.')
            return
            
        else:
            # Fallback to serving static frontend files from public/
            if not self.path.startswith('/data/'):
                self.path = '/public' + self.path
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/fields':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                field = json.loads(post_data.decode('utf-8'))
                field_id = field.get('id')
                
                if not field_id:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b'{"error": "Field missing ID"}')
                    return
                
                # Sanitize filename
                filename = "".join(c for c in field_id if c.isalnum() or c in ('-', '_')) + '.json'
                filepath = os.path.join(DATA_DIR, filename)
                
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(field, f, indent=2)
                    
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status": "success"}')
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        elif self.path == '/api/todos':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            filepath = os.path.join(DATA_DIR, 'todos.json')
            try:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(post_data.decode('utf-8'))
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status": "success"}')
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
                
        elif self.path.startswith('/api/notes/'):
            note_id = self.path.split('/')[-1]
            if not note_id:
                self.send_response(400)
                self.end_headers()
                return
                
            filename = "".join(c for c in note_id if c.isalnum() or c in ('-', '_')) + '.md'
            filepath = os.path.join(NOTES_DIR, filename)
            
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(post_data.decode('utf-8'))
                    
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status": "success"}')
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
                
        elif self.path == '/api/upload':
            original_filename = self.headers.get('X-File-Name')
            if not original_filename:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'{"error": "Missing X-File-Name header"}')
                return
                
            bname = os.path.basename(original_filename)
            clean_name = "".join(c for c in bname if c.isalnum() or c in ('.', '-', '_'))
            if not clean_name: clean_name = 'upload.bin'
            import time
            safe_filename = f"{int(time.time())}_{clean_name}"
            
            filepath = os.path.join(UPLOADS_DIR, safe_filename)
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                with open(filepath, 'wb') as f:
                    f.write(post_data)
                    
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"url": f"data/uploads/{safe_filename}"}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
                
        else:
            self.send_response(404)
            self.end_headers()
            
    def do_DELETE(self):
        if self.path.startswith('/api/fields/'):
            field_id = self.path.split('/')[-1]
            filename = "".join(c for c in field_id if c.isalnum() or c in ('-', '_')) + '.json'
            filepath = os.path.join(DATA_DIR, filename)
            
            try:
                if os.path.exists(filepath):
                    os.remove(filepath)
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"status": "success"}')
                else:
                    self.send_response(404)
                    self.end_headers()
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    with HTTPServer(("", PORT), ApiHandler) as httpd:
        print(f"Serving at port {PORT}")
        print(f"Data directory: {DATA_DIR}")
        print(f"Open http://localhost:{PORT}/index.html in your browser.")
        httpd.serve_forever()
