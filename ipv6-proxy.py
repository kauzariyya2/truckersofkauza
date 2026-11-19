import socket
import threading

NAT64_PREFIX = '2a01:4f8:c2c:123f:64:5'

def ipv4_to_ipv6(ipv4_str):
    parts = [int(p) for p in ipv4_str.split('.')]
    hex1 = f"{parts[0]:02x}{parts[1]:02x}"
    hex2 = f"{parts[2]:02x}{parts[3]:02x}"
    return f"{NAT64_PREFIX}:{hex1}:{hex2}"

def pipe(src, dst):
    try:
        while True:
            data = src.recv(32768)
            if not data:
                break
            dst.sendall(data)
    except:
        pass
    finally:
        try:
            dst.shutdown(socket.SHUT_WR)
        except:
            pass

def handle_client(client_socket):
    try:
        req = b''
        while b'\r\n\r\n' not in req:
            buf = client_socket.recv(4096)
            if not buf:
                client_socket.close()
                return
            req += buf
        
        first_line = req.split(b'\r\n')[0].decode('latin1')
        if first_line.startswith('CONNECT'):
            parts = first_line.split()
            target = parts[1]
            host, port = target.split(':')
            port = int(port)
            
            ipv4 = socket.gethostbyname(host)
            ipv6_target = ipv4_to_ipv6(ipv4)
            
            dest = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
            dest.connect((ipv6_target, port))
            client_socket.sendall(b'HTTP/1.1 200 Connection Established\r\n\r\n')
            
            t1 = threading.Thread(target=pipe, args=(client_socket, dest), daemon=True)
            t2 = threading.Thread(target=pipe, args=(dest, client_socket), daemon=True)
            t1.start()
            t2.start()
            t1.join()
            t2.join()
            dest.close()
    except Exception:
        pass
    finally:
        try:
            client_socket.close()
        except:
            pass

def main():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(('127.0.0.1', 8888))
    server.listen(50)
    print("NAT64 proxy running on 127.0.0.1:8888")
    while True:
        client, _ = server.accept()
        threading.Thread(target=handle_client, args=(client,), daemon=True).start()

if __name__ == '__main__':
    main()
