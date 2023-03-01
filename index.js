const express = require('express')
const app = express()

const queue = require('express-queue')
const cors = require('cors')
const morgan = require('morgan')
const rutaFiltros = require('./filtros/routes')
const { con } = require('./db')
const { CARPETA_DESCARGA } = require('./config')
require('./cron')
const handler = require('./routes')
const { restartQueueExecution } = require('./helper/Queue')
const moment = require('moment-timezone')

// Server config

// app.use(queue({ activeLimit: 10, queuedLimit: -1 }))
app.use(cors())
app.use(express.json())
app.set('port', process.env.PORT || 3000)
app.use(morgan('tiny'))
app.use(express.urlencoded({ extended: false }))

// Routes Middleware

app.use(function (req, res, next) {
  console.log(req.body)
  req.setTimeout(0)
  next()
})

// Initialize database configuration

if (process.env.IS_LOCALHOST == 1) {
  (async () => {
    await con.raw("SET GLOBAL sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''))")
  })()
}

// Start server

const server = app.listen(app.get('port'), () => {
  console.log(`Your DIR DOWNLOADS is : ${process.env.CARPETA_DESCARGA}`)
  console.log(`Your HOST is : ${process.env.DB_HOST}`)
  console.log(`Your DB is : ${process.env.DB_NAME}`)
  console.log(`Your USER is : ${process.env.DB_USER}`)
  console.log(`Your PORT is : ${process.env.PORT}`)
})

// Initialize socket.io library to submit events to frontend

const io = require('socket.io')(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
})

io.sockets.on('connection', (socket) => {
  console.log('A user connected')
  socket.on('disconnect', function () {
    console.log('A user disconnected')
  })
})

// Initialize routes

const rutaReportes = require('./routes/routes.route.js')(io)
//app.get('/exportar', queue({ activeLimit: 2, queuedLimit: -1 }))
app.use('/exportar', rutaReportes)
app.use('/filtros', rutaFiltros)
// Route to re-start queue
app.post('/reports/queue/started/:workspaceId', async (req, res) => {
  const protocol = process.env.IS_LOCALHOST == 1 ? 'http' : 'https'
  res.json({ started: await restartQueueExecution(io, req.body.adminId, req.params.workspaceId, protocol + '://' + req.headers.host) })
})
app.get('/reports/:filename', (req, res) => {
  const file = CARPETA_DESCARGA + `/${req.params.filename}`
  res.download(file)
})
