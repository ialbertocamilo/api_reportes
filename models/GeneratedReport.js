const { Model, DataTypes: { STRING, BOOLEAN, BIGINT } } = require('sequelize')
const sequelize = require('../sequelize.js')
const Workspace = require('./Workspace')
const User = require('./Usuario')

class GeneratedReport extends Model {

}

GeneratedReport.init({
  report_type: STRING,
  name: STRING,
  download_url: STRING,
  filters: STRING,
  filters_descriptions: STRING,
  workspace_id: BIGINT,
  admin_id: BIGINT,
  is_ready: BOOLEAN
}, {
  sequelize,
  modelName: 'generated_report',
  tableName: 'generated_reports',

  createdAt: 'created_at',
  updatedAt: 'updated_at'
})

GeneratedReport.hasOne(Workspace, {
  foreignKey: 'workspace_id'
})

GeneratedReport.hasOne(User, {
  foreignKey: 'admin_id'
})

module.exports = GeneratedReport
