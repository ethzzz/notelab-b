// HTTP / WebSocket 握手相关的零依赖小工具。与具体引擎无关。

export function json(res, code, body) {
  const s = JSON.stringify(body)
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(s),
  })
  res.end(s)
}

/** 拒绝一次 WebSocket 升级：直接写裸 HTTP 响应后断开 */
export function rejectUpgrade(socket, code, reason) {
  try {
    socket.write(`HTTP/1.1 ${code} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
  } catch {
    /* socket 可能已断开 */
  }
  socket.destroy()
}

/** 是否为本机调用（内部端点只对 127.0.0.1 开放） */
export function isLocal(req) {
  const ip = req.socket.remoteAddress || ''
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
}
