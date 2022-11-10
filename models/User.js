const { Model, DataTypes: { INTEGER, STRING } } = require('sequelize');
const sequelize = require('../sequelize.js');

/* models */
const Workspace = require('./Workspace');
const CriterionValueUser = require('./CriterionValueUser');

class User extends Model {
}

User.init({
    subworkspace_id: INTEGER,
    name: STRING,
    lastname: STRING,
    surname: STRING,
    document: STRING
},{
    sequelize,
    modelName: 'users',
    tableName: 'users',
    timestamps: false
});

User.belongsTo(Workspace, {
    foreignKey: 'subworkspace_id'
});

module.exports = User;