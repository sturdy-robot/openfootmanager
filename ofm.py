import socket
import threading

import uvicorn
import webview
from ofm_ui.app import app


def get_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return s.getsockname()[1]


port = get_free_port()
thread = threading.Thread(
    target=uvicorn.run,
    args=(app,),
    kwargs={"host": "0.0.0.0", "port": port},
    daemon=True,
)
thread.start()

webview.create_window(
    "Openfoot Manager",
    f"http://127.0.0.1:{port}/",
    width=800,
    height=600,
)
webview.start(gui="qt")
