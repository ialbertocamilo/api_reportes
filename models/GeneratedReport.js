const { Model, DataTypes: { INTEGER, STRING, BOOLEAN, BIGINT, DATE } } = require('sequelize')
const sequelize = require('../sequelize.js')
const Workspace = require('./Workspace')
const User = require('./Usuario')
class GeneratedReport extends Model {

}


GeneratedReport.init({
  id: {
    type: INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  report_type: STRING,
  name: STRING,
  download_url: STRING,
  filters: STRING,
  filters_descriptions: STRING,
  workspace_id: BIGINT,
  admin_id: BIGINT,
  is_ready: BOOLEAN,
  is_processing: BOOLEAN,
  failed: BOOLEAN,
  created_at: DATE,
  updated_at: DATE
}, {
  sequelize,
  timestamps: false,
  modelName: 'generated_report',
  tableName: 'generated_reports'
})

GeneratedReport.belongsTo(Workspace, {
  foreignKey: 'workspace_id'
})

GeneratedReport.belongsTo(User, {
  foreignKey: 'admin_id'
})

module.exports = GeneratedReport
