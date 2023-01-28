module.exports = function (server) {

  // Socket setup

  const io = require('socket.io')(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  })

  const connections = []
  io.sockets.on('connection', (socket) => {
    connections.push(socket)
    console.log('A user connected')

    socket.on('disconnect', function () {
      console.log('A user disconnected')
    })
  })

  const EventEmitter = require('events').EventEmitter
  const reportsEmitter = module.exports = new EventEmitter()
  reportsEmitter.on('report-finished', obj => {
    connections.forEach(socket => {
      socket.emit('report-finished', obj)
    })
  })

  return reportsEmitter
}
