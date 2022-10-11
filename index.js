const express = require('express')
const app = express()
const queue = require('express-queue')
const cors = require('cors')
const morgan = require('morgan')
const { CARPETA_DESCARGA } = require('./config')
require('./cron')

// Server config
app.use(queue({ activeLimit: 2, queuedLimit: -1 }))
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

// Routes
const rutaFiltros = require('./filtros/routes')
const rutaReportes = require('./routes/routes.route.js')
const { con } = require('./db')
// const reportesPruebas = require('./test/routes/routes.route.js')

// app.use('/test/exportar', reportesPruebas)
app.use('/exportar', rutaReportes)
app.use('/filtros', rutaFiltros)

app.get('/reports/:filename', (req, res) => {
  const file = CARPETA_DESCARGA + `/${req.params.filename}`
  res.download(file)
})

// Starting
app.listen(app.get('port'), () => {
  console.log(`Your DIR DOWNLOADS is : ${process.env.CARPETA_DESCARGA}`)
  console.log(`Your HOST is : ${process.env.DB_HOST}`)
  console.log(`Your DB is : ${process.env.DB_NAME}`)
  console.log(`Your USER is : ${process.env.DB_USER}`)
  console.log(`Your PORT is : ${process.env.PORT}`)
})
