const con = require('../db')

exports.query = async (consulta) => {
  const [rows, fields] = await con.query(consulta)
  return rows
}
