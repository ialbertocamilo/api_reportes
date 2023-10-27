const { Model, DataTypes: { INTEGER, STRING, BOOLEAN } } = require('sequelize');
const sequelize = require('../sequelize.js');

/* models */
const Workspace = require('./Workspace');
const CriterionValueUser = require('./CriterionValueUser');
const CriterionValue = require('./CriterionValue');

class User extends Model {
}

User.init({
    subworkspace_id: INTEGER,
    name: STRING,
    lastname: STRING,
    surname: STRING,
    active: BOOLEAN,
    document: STRING,
    email: STRING
},{
    sequelize,
    modelName: 'users',
    tableName: 'users',
    timestamps: false
});

User.belongsTo(Workspace, {
    foreignKey: 'subworkspace_id'
});

User.belongsToMany(CriterionValue, { through: CriterionValueUser, foreignKey: 'user_id' } );
CriterionValue.belongsToMany(User, { through: CriterionValueUser, foreignKey: 'criterion_value_id' } );

module.exports = User;
