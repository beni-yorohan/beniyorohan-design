import http.server, socketserver, os
os.chdir("/Users/bennyyorohan/Desktop/by-design-portfolio")
socketserver.TCPServer(("", 8000), http.server.SimpleHTTPRequestHandler).serve_forever()
