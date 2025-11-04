#!/usr/bin/env python3
import http.server
import ssl

server_address = ('0.0.0.0', 8443)
httpd = http.server.HTTPServer(server_address, http.server.SimpleHTTPRequestHandler)

context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain('cert.pem', 'key.pem')

httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

print(f"HTTPS Server running on https://0.0.0.0:8443")
print(f"On your phone, go to: https://10.0.0.9:8443")
print(f"Note: You'll see a security warning - click 'Advanced' and 'Proceed' to continue")
httpd.serve_forever()
